// Moderacion automatica de palabras ofensivas.
//
// Como funciona:
//  1) Normaliza el mensaje: minusculas, sin tildes, cambia "leet" (p4t4 -> puta)
//     y colapsa letras repetidas (puuuta -> puta).
//  2) Busca cada palabra prohibida como PALABRA COMPLETA (así "computadora"
//     no activa "puta"), respetando la lista blanca.
//  3) Detecta evasiones con letras separadas ("p u t a", "p.u.t.a") juntandolas.
//  4) Aplica la sancion que toque segun los avisos acumulados del usuario.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// Quita tildes y diacriticos
export function sinTildes(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Cambia las sustituciones tipicas por letras reales
const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };

export function normalizar(texto) {
  let t = sinTildes(String(texto || '').toLowerCase());
  t = t.normalize('NFKC');
  // caracteres invisibles que se usan para colar palabras
  t = t.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
  t = t.replace(/[0-9!|@$+]/g, (c) => LEET[c] ?? c);
  // colapsa 3 o mas letras iguales seguidas: puuuta -> puta
  t = t.replace(/(.)\1{2,}/g, '$1$1');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// Escapa un texto para usarlo dentro de una expresion regular
function escapar(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Convierte la palabra en una expresion que admite letras repetidas:
//   "mierda"       ->  m+i+e+r+d+a+      (así pilla "mierdaaa")
//   "hijo de puta" ->  h+i+j+o+\s+d+e+\s+p+u+t+a+
function aExpresion(palabra) {
  return String(palabra)
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => parte.split('').map((c) => `${escapar(c)}+`).join(''))
    .join('\\s+');
}

// Junta secuencias de letras sueltas: "p u t a" -> "puta", "p.u.t.a" -> "puta"
// El (?![a-z0-9]) final evita que se coma la primera letra de la palabra
// siguiente (en "p.u.t.a madre" tiene que quedarse con "puta", no "putam").
export function compactarLetrasSueltas(texto) {
  const encontradas = [];
  const re = /(?:\b\w[^a-z0-9]+){2,}\w(?![a-z0-9])/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const junto = m[0].replace(/[^a-z0-9]/gi, '');
    if (junto.length >= 3) encontradas.push(junto.toLowerCase());
  }
  return encontradas;
}

export class Moderador {
  constructor({ cfg, store, logger: log = logger }) {
    this.cfg = cfg;
    this.store = store;
    this.log = log;
    this.prohibidas = [];   // [{ original, regex, regexSuelto }]
    this.blanca = new Set(); // palabras normales que no deben marcarse
    this.cargar();
  }

  cargar() {
    const archivos = [];
    if (this.cfg.useSpanishList) archivos.push(path.join(AQUI, 'moderation', 'palabras-es.txt'));
    if (this.cfg.useEnglishList) archivos.push(path.join(AQUI, 'moderation', 'palabras-en.txt'));
    if (this.cfg.useCustomFile) archivos.push(path.join(AQUI, 'moderation', 'palabras-custom.txt'));

    const palabras = new Set();

    for (const archivo of archivos) {
      if (!fs.existsSync(archivo)) continue;
      let n = 0;
      for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
        const limpia = linea.trim();
        if (!limpia || limpia.startsWith('#')) continue;
        // permite comentarios al final de la linea:  palabra  # motivo
        const sinComentario = limpia.split('#')[0].trim();
        // ignora marcadores de "no vale" que quedaron en el archivo
        if (!sinComentario || /\? no$/i.test(sinComentario)) continue;
        palabras.add(normalizar(sinComentario));
        n += 1;
      }
      this.log.info(`Lista de moderacion cargada: ${path.basename(archivo)} (${n} entradas)`);
    }

    for (const extra of this.cfg.extraWords || []) {
      const limpia = normalizar(extra).trim();
      if (limpia) palabras.add(limpia);
    }

    for (const permitida of this.cfg.whitelist || []) {
      this.blanca.add(normalizar(permitida).trim());
    }
    for (const permitida of this.cfg.extraAllowed || []) {
      this.blanca.add(normalizar(permitida).trim());
    }

    this.prohibidas = [...palabras].filter(Boolean).map((p) => ({
      original: p,
      regex: new RegExp(`(^|[^a-z0-9])${aExpresion(p)}([^a-z0-9]|$)`, 'i'),
      regexSuelto: new RegExp(`^${aExpresion(p)}$`, 'i'),
    }));

    this.log.ok(`Moderacion lista: ${this.prohibidas.length} palabras prohibidas | ${this.blanca.size} permitidas.`);
  }

  // Analiza un texto. Devuelve { ofensivo, encontradas: [palabras] }
  analizar(texto) {
    const normal = normalizar(texto);
    if (!normal) return { ofensivo: false, encontradas: [] };

    let base = normal;
    // Quitamos las palabras de la lista blanca para que no den falso positivo
    for (const permitida of this.blanca) {
      if (!permitida) continue;
      base = base.replace(new RegExp(`(^|[^a-z0-9])${aExpresion(permitida)}([^a-z0-9]|$)`, 'gi'), ' ');
    }

    const encontradas = new Set();
    for (const p of this.prohibidas) {
      if (p.regex.test(base)) encontradas.add(p.original);
    }

    // Evasiones con letras separadas: "p u t a"
    if (encontradas.size === 0) {
      for (const junto of compactarLetrasSueltas(normal)) {
        for (const p of this.prohibidas) {
          if (p.regexSuelto.test(junto)) encontradas.add(p.original);
        }
      }
    }

    return { ofensivo: encontradas.size > 0, encontradas: [...encontradas] };
  }

  // Decide la sancion segun los avisos acumulados
  decidirAccion(avisos) {
    let accion = this.cfg.action;
    let segundos = this.cfg.timeoutSeconds;
    for (const regla of (this.cfg.escalation || []).slice().sort((a, b) => a.warnings - b.warnings)) {
      if (avisos >= regla.warnings) {
        accion = regla.action;
        if (regla.seconds) segundos = regla.seconds;
      }
    }
    return { accion, segundos };
  }
}

// Envoltorio que ya ejecuta las acciones contra Twitch.
export function crearModerador({ cfg, store, helix, broadcasterId, botId, decir, log = logger }) {
  const mod = new Moderador({ cfg, store, logger: log });
  const cache = new Map(); // userId por nombre, para no pedirlo dos veces

  async function idDe(mensaje) {
    if (mensaje.userId) return mensaje.userId;
    const clave = mensaje.usuarioMin;
    if (cache.has(clave)) return cache.get(clave);
    const u = await helix.usuario(clave);
    if (u?.id) { cache.set(clave, u.id); return u.id; }
    return null;
  }

  return {
    mod,
    analizar: (texto) => mod.analizar(texto),

    // Borra un mensaje concreto (lo usa el juego de BPM para que el chat no vea
    // la respuesta cuando el streamer la fija)
    async borrar(mensaje) {
      if (!mensaje || !mensaje.id || !broadcasterId || !botId) return false;
      const r = await helix.borrarMensaje(broadcasterId, botId, mensaje.id);
      return Boolean(r && r.ok);
    },

    // Devuelve null si no hay nada que hacer, o un resumen de la sancion
    async procesar(mensaje) {
      if (!cfg.enabled) return null;
      if (cfg.ignoreMods && mensaje.esMod) return null;
      if (cfg.ignoreBroadcaster && mensaje.esBroadcaster) return null;
      if (cfg.ignoreVips && mensaje.esVip) return null;

      const { ofensivo, encontradas } = mod.analizar(mensaje.texto);
      if (!ofensivo) return null;

      const avisos = store.warn(mensaje.usuario);
      const { accion, segundos } = mod.decidirAccion(avisos);
      log.warn(`Mensaje marcado de ${mensaje.usuario} (aviso nº ${avisos}, accion: ${accion})`);

      const userId = await idDe(mensaje);
      const resumen = { usuario: mensaje.usuario, avisos, accion, encontradas, borrado: false, sancionado: false };

      // 1) borrar el mensaje
      if (cfg.deleteMessage && mensaje.id && broadcasterId && botId) {
        const r = await helix.borrarMensaje(broadcasterId, botId, mensaje.id);
        resumen.borrado = r.ok;
      }

      // 2) sancionar
      if ((accion === 'timeout' || accion === 'ban') && userId && broadcasterId && botId) {
        const dur = accion === 'ban' ? null : (segundos || cfg.timeoutSeconds);
        const r = await helix.sancionar(broadcasterId, botId, userId, dur, 'Lenguaje ofensivo (bot)');
        resumen.sancionado = r.ok;
      }

      // 3) avisar en el chat (sin repetir la palabra)
      if (cfg.notifyUser) {
        if (accion === 'ban') decir(`@${mensaje.usuario} te has pasado con el lenguaje. Fuera del canal.`);
        else if (accion === 'timeout') decir(`@${mensaje.usuario} eso no se dice por aquí. Te vas ${Math.round((segundos || 300) / 60)} minuto(s).`);
        else if (accion === 'delete') decir(`@${mensaje.usuario} mensaje borrado: aquí nos tratamos con respeto 🙂`);
        else decir(`@${mensaje.usuario} cuidado con el lenguaje, por favor.`);
      }

      return resumen;
    },
  };
}

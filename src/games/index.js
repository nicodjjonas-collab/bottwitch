// Gestor de juegos.
//
// Cada juego vive en su propio archivo dentro de esta carpeta y exporta un objeto:
//   { id, name, aliases, help, multiplayer, create(api) -> { onMessage, onTick, status, finished } }
//
// Este gestor se encarga de: cargarlos, arrancar partidas, repartir los mensajes
// del chat al juego activo, los tiempos de espera, la inactividad y los puntos.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../logger.js';
import { sinTildes } from '../moderation.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// Normalizador para las respuestas de los juegos: minusculas, sin tildes y
// espacios colapsados. IMPORTANTE: a diferencia del normalizador de moderacion,
// este NO convierte números en letras (4 -> a), porque los juegos comparan
// respuestas como "25" o "4" tal cual.
export function normalizarRespuesta(texto) {
  return sinTildes(String(texto ?? '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

export class GameManager {
  constructor({ cfg, configCompleto, store, chat, canal, log = logger, esModInterno = () => false }) {
    this.cfg = cfg || {};
    this.configCompleto = configCompleto || {};
    this.store = store;
    this.chat = chat;
    this.canal = canal;
    this.log = log;
    this.esModInterno = esModInterno;
    this.juegos = new Map();
    this.sesión = null;
    this.ultimoUso = new Map();
    this.temporizador = null;
    this.avisadoInactividad = false;
  }

  // ---- carga de archivos ----
  async cargar() {
    if (!fs.existsSync(AQUI)) { this.log.error('No existe la carpeta de juegos.'); return 0; }
    const archivos = fs.readdirSync(AQUI).filter((f) => f.endsWith('.js') && f !== 'index.js');

    for (const archivo of archivos) {
      try {
        const modulo = await import(pathToFileURL(path.join(AQUI, archivo)).href);
        const juego = modulo.default;
        if (!juego || typeof juego !== 'object') { this.log.warn(`El archivo ${archivo} no exporta un juego valido.`); continue; }
        if (!juego.id || typeof juego.create !== 'function') { this.log.warn(`El juego ${archivo} no tiene "id" o "create()".`); continue; }
        this.juegos.set(juego.id, {
          id: juego.id,
          name: juego.name || juego.id,
          aliases: (juego.aliases || []).map((a) => String(a).toLowerCase()),
          help: juego.help || '',
          multiplayer: Boolean(juego.multiplayer),
          cooldownMs: juego.cooldownMs,
          create: juego.create,
          archivo,
        });
        this.log.info(`Juego cargado: ${juego.name || juego.id}  (!${juego.id})`);
      } catch (e) {
        this.log.error(`No pude cargar el juego ${archivo}: ${e.message}`);
      }
    }
    this.log.ok(`Juegos disponibles: ${this.juegos.size}`);
    return this.juegos.size;
  }

  // ---- consultas ----
  listar() { return [...this.juegos.values()].filter((j) => !(this.cfg.disabled || []).includes(j.id)); }

  buscar(token) {
    const t = String(token || '').toLowerCase().replace(/^!/, '');
    for (const j of this.juegos.values()) {
      if (j.id === t || j.aliases.includes(t) || j.name.toLowerCase() === t) return j;
    }
    return null;
  }

  enCurso() { return this.sesión && !this.sesión.instancia.finished ? this.sesión : null; }

  cooldownRestante(juego) {
    const enfriamiento = juego.cooldownMs ?? (this.cfg.defaultCooldownSeconds ?? 45) * 1000;
    const último = this.ultimoUso.get(juego.id) || 0;
    return Math.max(0, Math.ceil((enfriamiento - (Date.now() - último)) / 1000));
  }

  // ---- API que reciben los juegos ----
  // usuario = quien ha lanzado el comando (algunos juegos lo necesitan, ej: tres en raya)
  // sello   = { activa: true }; cuando la partida acaba pasa a false y sus
  //           mensajes dejan de enviarse. Así un juego cancelado no puede seguir
  //           hablando por el chat si le queda algun temporizador pendiente.
  crearApi(usuario = null, sello = { activa: true }) {
    const chat = this.chat;
    const vivo = () => sello.activa;
    return {
      say: (texto) => { if (vivo()) chat.say(texto); },
      sayMany: (textos) => { if (vivo()) return chat.sayMany(textos); return undefined; },
      channel: this.canal,
      user: usuario,
      config: this.configCompleto,
      logger: this.log,
      store: this.store,
      random: (n) => Math.floor(Math.random() * Math.max(1, Number(n) || 1)),
      pick: (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined),
      normalize: (t) => normalizarRespuesta(t),
      isMod: (u) => this.esModInterno(u),
      seconds: (n) => n * 1000,
    };
  }

  // ---- arrancar partida ----
  arrancar(token, mensaje, args = []) {
    if (!this.cfg.enabled) return { ok: false, motivo: 'juegos-desactivados' };
    const juego = this.buscar(token);
    if (!juego) return { ok: false, motivo: 'no-existe' };
    if ((this.cfg.disabled || []).includes(juego.id)) return { ok: false, motivo: 'desactivado' };

    const activo = this.enCurso();
    if (activo && this.cfg.oneGameAtATime !== false) {
      return { ok: false, motivo: 'ocupado', juego: activo.juego.name };
    }

    const restante = this.cooldownRestante(juego);
    if (restante > 0) return { ok: false, motivo: 'enfriamiento', faltan: restante, juego };

    const sello = { activa: true };
    const api = this.crearApi(mensaje.usuario, sello);
    let instancia;
    try {
      instancia = juego.create(api, args);
    } catch (e) {
      this.log.error(`El juego ${juego.name} fallo al arrancar: ${e.stack || e.message}`);
      return { ok: false, motivo: 'juego-roto' };
    }
    if (!instancia || typeof instancia.onMessage !== 'function') {
      this.log.error(`El juego ${juego.name} no devolvio una partida valida.`);
      return { ok: false, motivo: 'juego-roto' };
    }

    this.sesión = {
      juego,
      instancia,
      sello,
      iniciadoPor: mensaje.usuario,
      inicio: Date.now(),
      ultimaActividad: Date.now(),
      args,
    };
    this.avisadoInactividad = false;
    this.ultimoUso.set(juego.id, Date.now());

    // Puntos por participar
    const premio = this.cfg.points?.participate ?? 0;
    if (premio > 0 && mensaje.usuario) this.store.addPoints(mensaje.usuario, premio);

    this.log.info(`Partida de ${juego.name} iniciada por ${mensaje.usuario}.`);
    return { ok: true, juego, instancia };
  }

  // ---- repartir un mensaje del chat ----
  manejarMensaje(mensaje) {
    const s = this.sesión;
    if (!s) return false;
    if (s.instancia.finished) { this.limpiar('finalizada'); return false; }

    s.ultimaActividad = Date.now();
    this.avisadoInactividad = false;

    const prefijo = this.configCompleto?.prefix || '!';
    const texto = mensaje.texto;

    let consumido = false;
    try {
      consumido = s.instancia.onMessage(mensaje.usuario, texto) === true;
      // Si el juego no lo ha consumido y venia con "!", probamos sin el prefijo.
      // Así funciona igual escribir "!entrar", "entrar" o "5".
      if (!consumido && texto.startsWith(prefijo)) {
        consumido = s.instancia.onMessage(mensaje.usuario, texto.slice(prefijo.length).trim()) === true;
      }
    } catch (e) {
      this.log.error(`Error dentro del juego ${s.juego.name}: ${e.stack || e.message}`);
      this.chat.say('Ups, se me ha liado el juego. Lo cancelo, probad otra vez 🙂');
      this.limpiar('error');
      return true;
    }

    if (s.instancia.finished) this.limpiar('finalizada');
    return consumido;
  }

  // ---- latido: se llama cada 5 segundos ----
  tick() {
    const s = this.sesión;
    if (!s) return;

    try { s.instancia.onTick?.(); }
    catch (e) { this.log.error(`Error en onTick de ${s.juego.name}: ${e.message}`); this.limpiar('error'); return; }

    if (s.instancia.finished) { this.limpiar('finalizada'); return; }

    const limite = (this.cfg.inactivitySeconds ?? 180) * 1000;
    const parado = Date.now() - s.ultimaActividad;
    if (parado > limite) {
      if (this.cfg.announceInactivityWarning) {
        this.chat.say(`Nadie juega, cancelo la partida de ${s.juego.name}. Escribid !${s.juego.id} para otra 🎮`);
      }
      this.limpiar('inactividad');
    } else if (this.cfg.announceInactivityWarning && !this.avisadoInactividad && parado > limite * 0.66) {
      this.avisadoInactividad = true;
      this.chat.say(`¿Seguimos con ${s.juego.name}? Si nadie dice nada en un minuto lo cancelo ⏳`);
    }
  }

  cancelar(motivo = 'cancelada') {
    if (!this.sesión) return false;
    try { this.sesión.instancia.onCancel?.(); } catch { /* opcional */ }
    this.limpiar(motivo);
    return true;
  }

  limpiar(motivo) {
    if (!this.sesión) return;
    // Apagamos el sello: cualquier temporizador que le quedara al juego deja de enviar mensajes
    if (this.sesión.sello) this.sesión.sello.activa = false;
    this.log.info(`Partida de ${this.sesión.juego.name} terminada (${motivo}).`);
    this.sesión = null;
    this.avisadoInactividad = false;
  }

  estado() {
    const s = this.sesión;
    if (!s) return { activa: false, juegos: this.juegos.size };
    let est = '';
    try { est = s.instancia.status?.() || ''; } catch { est = ''; }
    return {
      activa: true,
      juego: s.juego.name,
      id: s.juego.id,
      iniciadaPor: s.iniciadoPor,
      segundos: Math.round((Date.now() - s.inicio) / 1000),
      estado: est,
      juegos: this.juegos.size,
    };
  }

  ayudaJuegos() {
    return this.listar().map((j) => `!${j.id}${j.aliases.length ? ` (o !${j.aliases[0]})` : ''}: ${j.help || j.name}`);
  }
}

// El cerebro del bot: decide CUANDO hablar, QUE decir y con que retardo,
// para que no parezca un robot que contesta a todo al instante.
//
//  - Guarda el contexto de los ultimos mensajes (sigue el hilo).
//  - Si conversation.mode = 'llm' usa la IA; si no, el motor local.
//  - Respeta: probabilidad de respuesta, limite por minuto y silencio si el chat esta muerto.
//  - Filtra su propia salida por si la IA suelta algo fuera de tono.

import fs from 'node:fs';
import { cerebroLocal } from './local.js';
import { crearLLM } from './llm.js';
import { leerJson, escribirJson } from '../store.js';
import { logger } from '../logger.js';

export class Brain {
  constructor({ cfg, llmCfg, memoryFile, store, moderador, log = logger, llm = null }) {
    this.cfg = cfg;
    this.store = store;
    this.moderador = moderador;
    this.log = log;
    this.memoryFile = memoryFile;
    this.contexto = leerJson(memoryFile, []) || [];
    if (!Array.isArray(this.contexto)) this.contexto = [];
    this.local = cerebroLocal({ cfg });
    this.llm = llm || crearLLM({ cfg: llmCfg, logger: log });
    this.respuestasRecientes = [];
    this.ultimasPorUsuario = new Map();
    this.ultimoHiloCon = { usuario: null, cuando: 0 };
    this.ultimoMensajeChat = 0;
    this.ultimaRespuesta = 0;
  }

  get modo() { return this.llm.configurado && this.cfg.mode === 'llm' ? 'llm' : 'local'; }

  guardarMemoria() {
    escribirJson(this.memoryFile, this.contexto.slice(-40));
  }

  // Registra un mensaje en el contexto. Devuelve si es la primera vez del usuario.
  registrar({ usuario, texto, deBot = false, primeraVez = false }) {
    const ahora = Date.now();
    this.ultimoMensajeChat = ahora;
    this.contexto.push({
      usuario, texto, deBot, cuando: ahora,
      mencionaBot: new RegExp(`\\b${this.nombreBot || 'bot'}\\b`, 'i').test(texto),
    });
    if (this.contexto.length > 60) this.contexto = this.contexto.slice(-60);
    return { primeraVez };
  }

  // ¿El chat esta vivo? (para no hablar solo)
  chatActivo() {
    if (!this.cfg.onlyWhenChatActive) return true;
    const ventana = (this.cfg.chatActiveWindowSeconds ?? 120) * 1000;
    return Date.now() - this.ultimoMensajeChat < ventana;
  }

  // Control de ritmo: no mas de N respuestas por minuto, con pausa minima
  // entre respuestas (mas corta en pleno hilo, como un humano conversando)
  puedeResponder(enHilo = false) {
    const ahora = Date.now();
    this.respuestasRecientes = this.respuestasRecientes.filter((t) => ahora - t < 60000);
    if (this.respuestasRecientes.length >= (this.cfg.maxRepliesPerMinute ?? 6)) return false;
    // Pausa minima: 4 segundos normal, 1,5 en hilo para seguir el ritmo
    const pausa = enHilo ? 1500 : 4000;
    if (ahora - this.ultimaRespuesta < pausa) return false;
    return true;
  }

  // No responde dos veces seguidas a la misma persona (así no parece un loro)
  puedeResponderA(usuario) {
    const espera = (this.cfg.esperaPorUsuarioSegundos ?? 25) * 1000;
    if (espera <= 0) return true;
    const última = this.ultimasPorUsuario.get(String(usuario || '').toLowerCase()) || 0;
    return Date.now() - última >= espera;
  }

  // Un mensaje para animar el chat cuando esta parado. Con IA si esta disponible.
  async ambiente() {
    if (!this.cfg.enabled) return null;
    let texto = null;
    if (this.modo === 'llm') {
      texto = await this.llm.ambiente({ contexto: this.contexto.slice(-6) });
    }
    if (!texto) return null; // sin IA, el modulo de promos usa sus propios mensajes

    if (this.moderador) {
      const rev = this.moderador.analizar(texto);
      if (rev.ofensivo) {
        this.log.warn('Mensaje de ambiente descartado por el filtro de seguridad.');
        return null;
      }
    }
    this.registrar({ usuario: 'bot', texto, deBot: true });
    return texto;
  }

  // Decide si hay que responder y que. Devuelve { texto, retardoMs } o null.
  async pensar({ usuario, texto, esMod = false, esBroadcaster = false }) {
    if (!this.cfg.enabled) return null;
    if (this.cfg.ignoreCommands && texto.startsWith(this.prefijo || '!')) return null;
    if (!this.chatActivo()) return null;

    const t = texto.toLowerCase();
    const menciona = new RegExp(`\\b${this.nombreBot || 'bot'}\\b`, 'i').test(t);
    // Pregunta aunque no lleve "?": en español muchas van sin interrogar
    const esPregunta = /\?/.test(t)
      || /\b(qu[eé]|c[oó]mo|cu[áa]l(es)?|d[oó]nde|cu[áa]ndo|por qu[eé]|para qu[eé]|qui[eé]n|cu[áa]ntos?|porque)\b/.test(t);

    // Hilo abierto: si el bot le acaba de responder y contesta en <hiloAbiertoSegundos>,
    // sigue la conversación con ella sin aplicarle la espera (como un humano)
    const hiloSegundos = this.cfg.hiloAbiertoSegundos ?? 90;
    const enHilo = this.ultimoHiloCon.usuario === String(usuario || '').toLowerCase()
      && (Date.now() - this.ultimoHiloCon.cuando) < hiloSegundos * 1000;

    if (!this.puedeResponder(enHilo)) return null;

    // Si no le han mencionado, no repite con la misma persona tan seguido
    // (salvo que estén en pleno hilo)
    if (!menciona && !enHilo && !this.puedeResponderA(usuario)) return null;

    // ¿Le toca hablar?
    let motivado = false;
    if (enHilo) motivado = true;
    else if (menciona && this.cfg.replyToMentions) motivado = true;
    else if (esPregunta && this.cfg.replyToQuestions) motivado = Math.random() < 0.9;
    else motivado = Math.random() < (this.cfg.replyChance ?? 0.6);

    if (!motivado) return null;

    // --- elegir el texto ---
    let respuesta = null;
    let fuente = 'local';

    if (this.modo === 'llm') {
      const extra = this.store ? `Puntos de ${usuario}: ${this.store.getPoints(usuario)}.` : '';
      // La IA tiene 7 segundos: si tarda más (hora punta, cola...), se tira de
      // plantillas al momento en vez de dejar el chat esperando y atrasarse.
      const rapido = new Promise((resolver) => setTimeout(() => resolver(null), 7000));
      respuesta = await Promise.race([
        this.llm.responder({
          contexto: this.contexto.slice(-(this.cfg.contextMessages ?? 25)),
          mensaje: texto,
          usuario,
          extra,
        }),
        rapido,
      ]);
      if (respuesta) fuente = 'ia';
      else if (this.llm.configurado) this.log.debug('IA lenta: respuesta local para no atrasar el chat.');
    }

    if (!respuesta) {
      respuesta = this.local.responder({ texto, usuario, contexto: this.contexto.slice(-4) });
      fuente = 'local';
    }

    if (!respuesta) return null;

    // --- filtro de seguridad sobre la respuesta del propio bot ---
    if (this.moderador) {
      const rev = this.moderador.analizar(respuesta);
      if (rev.ofensivo) {
        this.log.warn(`El bot iba a decir algo fuera de tono; lo descarto (${rev.encontradas.join(', ')}).`);
        return null;
      }
    }

    // --- retardo humano aleatorio ---
    const min = this.cfg.minDelayMs ?? 1200;
    const max = Math.max(min, this.cfg.maxDelayMs ?? 4200);
    // Un poco mas rápido si le han mencionado directamente
    const factor = menciona ? 0.6 : 1;
    const retardoMs = Math.round((min + Math.random() * (max - min)) * factor);

    this.ultimaRespuesta = Date.now();
    this.respuestasRecientes.push(Date.now());
    this.ultimasPorUsuario.set(String(usuario || '').toLowerCase(), Date.now());
    // Marca el hilo abierto con esta persona para seguirla como un humano
    this.ultimoHiloCon = { usuario: String(usuario || '').toLowerCase(), cuando: Date.now() };

    return { texto: respuesta, fuente, retardoMs };
  }

  estado() {
    return {
      modo: this.modo,
      ia: this.llm.estado,
      contexto: this.contexto.length,
      respuestasUltimoMinuto: this.respuestasRecientes.filter((t) => Date.now() - t < 60000).length,
    };
  }

  cerrar() { this.guardarMemoria(); }
}

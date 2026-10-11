// Tuberia de procesado de cada mensaje del chat.
// Esta separada del arranque para poder probarla sin conectarse a Twitch (selftest).
//
// Orden de prioridades:
//   1) moderacion   (si el mensaje es ofensivo, se corta aquí)
//   2) bienvenida a quien escribe por primera vez
//   3) juego en curso
//   4) comandos (!algo)
//   5) conversacion

import { logger } from './logger.js';

export function crearPipeline({ config, store, chat, brain, juegos, moderador, comandos, promos, log = logger }) {
  return {
    async procesarMensaje(mensaje) {
      try {
        // ---- 1) moderacion ----
        const sancion = await moderador.procesar(mensaje);
        if (sancion) {
          log.warn(`Moderacion: ${sancion.usuario} -> ${sancion.accion} (aviso ${sancion.avisos})`);
          return { consumido: true, motivo: 'moderacion' };
        }

        // ---- 2) actividad y bienvenida ----
        const { primeraVez } = store.markSeen(mensaje.usuario);
        if (primeraVez && promos) promos.bienvenida(mensaje.usuario);

        // ---- 2-bis) bits: el que anima el canal se lleva puntos ----
        if (mensaje.bits > 0) {
          const premio = Math.min(500, mensaje.bits);
          store.addPoints(mensaje.usuario, premio);
          store.addStat(mensaje.usuario, 'bits_dados', mensaje.bits);
          chat.say(`💎 ¡Gracias por los ${mensaje.bits} bits, ${mensaje.usuario}! Te apunto ${premio} puntos`);
          log.info(`Bits: ${mensaje.usuario} ha dado ${mensaje.bits} (${premio} puntos).`);
        }

        // ---- 3) juego en curso ----
        if (juegos.manejarMensaje(mensaje)) return { consumido: true, motivo: 'juego' };

        // ---- 4) comandos ----
        if (await comandos.manejar(mensaje)) return { consumido: true, motivo: 'comando' };

        // ---- 5) conversacion ----
        brain.registrar({ usuario: mensaje.usuario, texto: mensaje.texto, deBot: false });
        const decision = await brain.pensar(mensaje);
        if (decision) {
          setTimeout(() => {
            chat.say(decision.texto);
            brain.registrar({ usuario: 'bot', texto: decision.texto, deBot: true });
          }, decision.retardoMs || 0);
          return { consumido: false, motivo: 'conversacion', respuesta: decision };
        }

        return { consumido: false, motivo: 'ignorado' };
      } catch (e) {
        log.error(`Error procesando un mensaje: ${e.stack || e.message}`);
        return { consumido: false, motivo: 'error' };
      }
    },
  };
}

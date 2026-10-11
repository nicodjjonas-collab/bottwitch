// ============================================================
// sorteo.js - Sorteo / rifa para el bot de Twitch
// La gente entra con !entro o !participar durante N segundos.
// Al terminar se elige un ganador al azar y se guarda en api.store.
// ESM puro, cero dependencias externas.
// ============================================================

const DURACION_POR_DEFECTO = 60; // segundos
const DURACION_MIN = 10;
const DURACION_MAX = 600;

export default {
  id: 'sorteo',
  name: 'Sorteo',
  aliases: ['sorteo', 'rifa', 'raffle'],
  help: 'Sorteo entre el chat: escribe !entro o !participar. !sorteo 90 para 90 segundos.',
  multiplayer: true,
  minArgs: 0,

  create(api, args) {
    // ---------- Utilidades defensivas ----------
    const safeSay = (texto) => {
      const limpio = typeof texto === 'string' ? texto.trim() : '';
      if (!limpio) return;
      try {
        api.say(limpio);
      } catch (err) {
        try {
          api.logger.warn('sorteo: no se pudo enviar el mensaje');
        } catch (err2) {
          // nada
        }
      }
    };

    // Nunca enviamos cadenas vacias ni solo espacios.
    const safeSayMany = (lineas) => {
      const lista = (Array.isArray(lineas) ? lineas : [lineas])
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t.length > 0)
        .slice(0, 4);
      if (!lista.length) return;
      try {
        if (typeof api.sayMany === 'function') {
          api.sayMany(lista);
          return;
        }
      } catch (err) {
        // individual
      }
      lista.forEach(safeSay);
    };

    const normalizar = (texto) => {
      try {
        return api.normalize(String(texto == null ? '' : texto)).trim();
      } catch (err) {
        return String(texto == null ? '' : texto).toLowerCase().trim();
      }
    };

    const azar = (n) => {
      try {
        const v = api.random(n);
        if (typeof v === 'number' && isFinite(v) && v >= 0 && v < n) return v;
      } catch (err) {
        // Math.random
      }
      return Math.floor(Math.random() * n);
    };

    // ---------- Duración ----------
    let duración = DURACION_POR_DEFECTO;
    try {
      const pedido = Array.isArray(args) && args.length ? parseInt(String(args[0]), 10) : NaN;
      if (isFinite(pedido) && pedido > 0) duración = Math.min(Math.max(pedido, DURACION_MIN), DURACION_MAX);
    } catch (err) {
      duración = DURACION_POR_DEFECTO;
    }

    // ---------- Estado ----------
    let restante = duración;
    let fin = false;
    const participantes = []; // en orden de entrada
    const vistos = new Set(); // para un solo !entro por usuario
    let aviso15 = false;
    let aviso5 = false;
    let anunciadoCierre = false;

    const terminar = (lineas) => {
      fin = true;
      safeSayMany(lineas);
    };

    const elegirGanador = () => {
      if (anunciadoCierre) return;
      anunciadoCierre = true;

      if (!participantes.length) {
        terminar([
          '🎟️ El sorteo ha terminado... ¡y no se ha apuntado nadie!',
          'La próxima vez escribid !entro nada mas abrirse el sorteo 😅',
        ]);
        return;
      }

      const ganador = participantes[azar(participantes.length)];
      try {
        api.store.addStat(ganador, 'sorteos_ganados', 1);
      } catch (err) {
        api.logger.warn('sorteo: no se pudo guardar la estadistica del ganador');
      }

      const nombres = participantes.slice(0, 10).join(', ');
      terminar([
        `🎉 ¡¡${ganador} GANA EL SORTEO!! Enhorabuena 🏆`,
        `Participaban ${participantes.length} personas: ${nombres}${participantes.length > 10 ? ' y mas...' : ''}`,
        '¡Gracias a todos por participar! 🎧',
      ]);
    };

    // ---------- Arranque ----------
    safeSayMany([
      `🎟️ ¡SORTEO ABIERTO durante ${duración} segundos! Escribe !entro (o !participar) para participar.`,
      'Un solo intento por persona. Al terminar elijo ganador al azar 🎲',
    ]);

    const partida = {
      onMessage(user, message) {
        try {
          if (fin) return false;

          const texto = normalizar(message);
          if (!texto) return false;

          const cmd = texto.replace(/^!+/, '');
          if (cmd !== 'entro' && cmd !== 'participar' && cmd !== 'apunto' && cmd !== 'join') {
            return false;
          }

          if (vistos.has(user)) {
            safeSay(`😉 ${user}, ya estas apuntado. Suerte 🍀`);
            return true;
          }

          vistos.add(user);
          participantes.push(user);

          // Avisamos solo de vez en cuando para no saturar el chat
          if (participantes.length === 1 || participantes.length % 5 === 0) {
            safeSay(`🎟️ ${user} esta dentro (${participantes.length} participantes). Quedan ~${Math.max(restante, 0)}s`);
          }
          return true;
        } catch (err) {
          api.logger.error('sorteo: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;

          restante -= 5;

          if (!aviso15 && restante <= 15 && restante > 5) {
            aviso15 = true;
            safeSay(`⏳ ¡Quedan 15 segundos para cerrar el sorteo! Escribid !entro ya mismo 🎟️`);
          }

          if (!aviso5 && restante <= 5 && restante > 0) {
            aviso5 = true;
            safeSay(`🚨 ¡Ultimos 5 segundos! Se cierra el sorteo...`);
          }

          if (restante <= 0) {
            elegirGanador();
          }
        } catch (err) {
          api.logger.error('sorteo: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Sorteo terminado. Escribe !sorteo para abrir otro.';
          return `Sorteo abierto: quedan ~${Math.max(restante, 0)}s y hay ${participantes.length} participante(s)`;
        } catch (err) {
          return 'Sorteo en curso.';
        }
      },

      get finished() {
        return fin;
      },
    };

    return partida;
  },
};

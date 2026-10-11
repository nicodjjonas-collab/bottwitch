// ============================================================
// ppt.js - Piedra, papel o tijera contra el bot (al mejor de 3)
// Se juega escribiendo piedra, papel o tijera. ESM puro.
// ============================================================

const OPCIONES = ['piedra', 'papel', 'tijera'];
const EMOJI = { piedra: '🪨', papel: '📄', tijera: '✂️' };
const META_VICTORIAS = 2; // al mejor de 3 -> 2 rondas ganadas
const TIEMPO_ESPERA = 90; // segundos para escribir una tirada

export default {
  id: 'ppt',
  name: 'Piedra, papel o tijera',
  aliases: ['ppt', 'piedrapapeltijera', 'rps'],
  help: 'Juega al mejor de 3 contra el bot: escribe piedra, papel o tijera.',
  multiplayer: false,
  minArgs: 0,

  create(api) {
    // ---------- Utilidades defensivas ----------
    const safeSay = (texto) => {
      const limpio = typeof texto === 'string' ? texto.trim() : '';
      if (!limpio) return;
      try {
        api.say(limpio);
      } catch (err) {
        try {
          api.logger.warn('ppt: no se pudo enviar el mensaje');
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

    const darPuntos = (user, n) => {
      try {
        if (user && n > 0) api.store.addPoints(user, n);
      } catch (err) {
        api.logger.warn('ppt: no se pudieron sumar puntos');
      }
    };

    // ---------- Estado ----------
    let jugador = null;
    let puntosJugador = 0;
    let puntosBot = 0;
    let ronda = 1;
    let fin = false;
    let ultimaTirada = Date.now();
    const historial = [];

    // Normaliza lo que escribe el usuario a una opcion valida.
    const traducir = (texto) => {
      if (texto === 'piedra' || texto === 'roca' || texto === 'piedras') return 'piedra';
      if (texto === 'papel' || texto === 'papeles') return 'papel';
      if (texto === 'tijera' || texto === 'tijeras' || texto === 'tijerita') return 'tijera';
      return null;
    };

    // Devuelve 'jugador', 'bot' o 'empate'.
    const resolver = (a, b) => {
      if (a === b) return 'empate';
      if (a === 'piedra' && b === 'tijera') return 'jugador';
      if (a === 'papel' && b === 'piedra') return 'jugador';
      if (a === 'tijera' && b === 'papel') return 'jugador';
      return 'bot';
    };

    const terminar = (lineas) => {
      fin = true;
      safeSayMany(lineas);
    };

    const finalizarPartida = () => {
      if (puntosJugador > puntosBot) {
        darPuntos(jugador, 5);
        terminar([
          `🏆 ¡${jugador} gana la partida ${puntosJugador}-${puntosBot}! +5 puntos`,
          'Revuelta? Escribe !ppt cuando quieras 🎧',
        ]);
        return;
      }
      terminar([
        `🤖 El bot gana la partida ${puntosBot}-${puntosJugador}. ¡Casi, ${jugador}!`,
        'Otra oportunidad con !ppt 😉',
      ]);
    };

    // ---------- Arranque ----------
    safeSayMany([
      '✊ ¡Reto al bot a piedra, papel o tijera! Se juega al mejor de 3 (gana quien llegue a 2).',
      'Escribe piedra, papel o tijera (también vale "tijeras") y empecemos 🎯',
    ]);

    const partida = {
      onMessage(user, message) {
        try {
          if (fin) return false;

          // El primer jugador que escribe pasa a ser el retado.
          if (!jugador) {
            const p = traducir(normalizar(message));
            if (!p) return false;
            jugador = user;
            safeSay(`🎮 Muy bien ${jugador}, nos enfrentamos al mejor de 3. ¡Tu primera tirada cuenta: ${EMOJI[p]}!`);
            // La tirada que abrio el juego también vale
            return procesarTirada(user, p);
          }

          if (user !== jugador) {
            const p = traducir(normalizar(message));
            if (p) {
              safeSay(`👀 Esta partida es de ${jugador}, ${user}. Lanza tu propio !ppt para retarme.`);
              return true;
            }
            return false;
          }

          const opcion = traducir(normalizar(message));
          if (!opcion) return false;
          return procesarTirada(user, opcion);
        } catch (err) {
          api.logger.error('ppt: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          if (Date.now() - ultimaTirada >= TIEMPO_ESPERA * 1000) {
            terminar([
              `⏰ Se acabo el tiempo, ${jugador}. Partida abandonada ${puntosJugador}-${puntosBot}.`,
              'Cuando quieras la revancha: !ppt',
            ]);
          }
        } catch (err) {
          api.logger.error('ppt: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Piedra, papel o tijera terminado. Usa !ppt para otro duelo.';
          return `PPT al mejor de 3: ${jugador} ${puntosJugador} - ${puntosBot} bot (ronda ${ronda})`;
        } catch (err) {
          return 'Partida de piedra, papel o tijera en curso.';
        }
      },

      get finished() {
        return fin;
      },
    };

    // Resuelve una tirada del jugador contra la del bot.
    function procesarTirada(user, opcion) {
      if (fin) return true;
      ultimaTirada = Date.now();

      const delBot = OPCIONES[azar(3)];
      const resultado = resolver(opcion, delBot);
      historial.push(`${ronda}: ${opcion} vs ${delBot}`);

      let linea;
      if (resultado === 'jugador') {
        puntosJugador += 1;
        darPuntos(user, 1);
        linea = `Ronda ${ronda}: ${user} saca ${EMOJI[opcion]} y el bot ${EMOJI[delBot]} -> ¡punto para ${user}! (+1)`;
      } else if (resultado === 'bot') {
        puntosBot += 1;
        linea = `Ronda ${ronda}: ${user} saca ${EMOJI[opcion]} y el bot ${EMOJI[delBot]} -> punto para el bot 😈`;
      } else {
        linea = `Ronda ${ronda}: empate ${EMOJI[opcion]} contra ${EMOJI[delBot]}. Se repite, sin punto.`;
      }

      // Comprobamos si la partida ha terminado
      if (puntosJugador >= META_VICTORIAS || puntosBot >= META_VICTORIAS) {
        safeSayMany([linea, `Marcador final: ${jugador} ${puntosJugador} - ${puntosBot} bot`]);
        finalizarPartida();
        return true;
      }

      ronda += 1;
      safeSayMany([linea, `Marcador: ${jugador} ${puntosJugador} - ${puntosBot} bot. Tirad otra vez 🎯`]);
      return true;
    }

    return partida;
  },
};

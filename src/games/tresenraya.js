// ============================================================
// tresenraya.js - Tres en raya (multiplayer) para el bot de Twitch
// El que lanza el comando empieza. Otro entra con !entrar o !join.
// Si nadie entra en 30 segundos, juega el bot con IA sencilla.
// ESM puro, cero dependencias externas.
// ============================================================

const JUGADOR = 'X';
const BOT = 'O';
const VENTANA_ENTRADA = 30; // segundos para aceptar al segundo jugador
const TIEMPO_MAX = 15 * 60; // segundos maximos de partida

// Todas las lineas ganadoras del tablero 1-9.
const LINEAS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
  [1, 5, 9],
  [3, 5, 7],
];

export default {
  id: 'tresenraya',
  name: 'Tres en raya',
  aliases: ['tresenraya', 'ttt', '3enraya'],
  help: 'Reto al chat al tres en raya: otro entra con !entrar y se juega con casillas 1-9 o a1-c3.',
  multiplayer: true,
  minArgs: 0,

  create(api) {
    // ---------- Utilidades defensivas ----------
    // Nunca enviamos cadenas vacias ni solo espacios (Twitch lo mostraria en blanco).
    const textosValidos = (lineas) => {
      const lista = Array.isArray(lineas) ? lineas : [lineas];
      return lista
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t.length > 0)
        .slice(0, 4);
    };

    const safeSay = (texto) => {
      const limpio = typeof texto === 'string' ? texto.trim() : '';
      if (!limpio) return;
      try {
        api.say(limpio);
      } catch (err) {
        try {
          api.logger.warn('tresenraya: no se pudo enviar el mensaje');
        } catch (err2) {
          // nada
        }
      }
    };

    const safeSayMany = (lineas) => {
      const lista = textosValidos(lineas);
      if (!lista.length) return;
      try {
        if (typeof api.sayMany === 'function') {
          api.sayMany(lista);
          return;
        }
      } catch (err) {
        // envio individual
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
        api.logger.warn('tresenraya: no se pudieron sumar puntos');
      }
    };

    // ---------- Estado de la partida ----------
    // El nombre ya viene en el texto del comando; este es el segundo aviso.
    const quienReto = (() => {
      try {
        if (typeof api.user === 'string' && api.user.trim()) return api.user.trim();
      } catch (err) {
        // sin usuario disponible
      }
      return null;
    })();
    let tablero = []; // indice 1..9, '' si libre
    let propietario = quienReto; // quien lanzo el comando
    let rival = null; // segundo jugador humano (o null)
    let botJuega = false; // true cuando es partida contra el bot
    let turno = JUGADOR; // 'X' o 'O'
    let fin = false;
    let esperandoEntrada = false;
    let esperandoRival = false; // el retador ya movio pero aun se puede unir alguien
    const creadaEn = Date.now();
    let momentoEntrada = Date.now();
    let cambioEstado = false;

    const symbolOf = (user) => {
      if (rival && user === rival) return BOT;
      if (user === propietario) return JUGADOR;
      return null;
    };

    const nameOf = (marca) => (marca === JUGADOR ? propietario || 'el retador' : rival || 'el bot');

    // Nombre visible del bando al que le toca: si juega el bot, lo dice claro.
    const turnoTexto = () => {
      const segunda = botJuega ? 'el bot 🤖' : rival || 'el rival';
      return turno === JUGADOR ? propietario || 'el retador' : segunda;
    };

    const limpiar = () => {
      tablero = [null, '', '', '', '', '', '', '', '', ''];
    };
    limpiar();

    const textoCasilla = (n) => {
      try {
        const v = tablero[n];
        if (v === JUGADOR) return '❌';
        if (v === BOT) return '⭕';
        return String(n);
      } catch (err) {
        return String(n);
      }
    };

    // Texto de respaldo: nunca mandamos un mensaje vacio al chat.
    const pintarRespaldo = () => {
      const filas = [];
      for (let f = 0; f < 3; f += 1) {
        filas.push([1, 2, 3].map((c) => textoCasilla(f * 3 + c)).join(' '));
      }
      return `Tablero: ${filas.join(' / ')}`;
    };

    // Tablero 3x3 con rejilla y las casillas libres numeradas.
    const pintar = () => {
      try {
        const filas = [];
        for (let f = 0; f < 3; f += 1) {
          const celdas = [1, 2, 3].map((c) => textoCasilla(f * 3 + c));
          filas.push(`${celdas[0]} | ${celdas[1]} | ${celdas[2]}`);
        }
        const linea = '---------';
        const texto = `${filas[0]}\n${linea}\n${filas[1]}\n${linea}\n${filas[2]}`;
        if (!texto || !texto.trim()) return pintarRespaldo();
        return texto;
      } catch (err) {
        return pintarRespaldo();
      }
    };

    const libres = () => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !tablero[n]);

    // Devuelve 'X', 'O' o null si nadie ha cerrado linea.
    const ganadorActual = () => {
      for (const [a, b, c] of LINEAS) {
        if (tablero[a] && tablero[a] === tablero[b] && tablero[b] === tablero[c]) return tablero[a];
      }
      return null;
    };

    const terminar = (lineas) => {
      fin = true;
      safeSayMany(lineas);
    };

    // IA sencilla: ganar > bloquear > centro > esquina > lo que quede.
    const iaElegir = () => {
      const disponibles = libres();
      for (const n of disponibles) {
        tablero[n] = BOT;
        const gano = ganadorActual() === BOT;
        tablero[n] = '';
        if (gano) return n;
      }
      for (const n of disponibles) {
        tablero[n] = JUGADOR;
        const peligro = ganadorActual() === JUGADOR;
        tablero[n] = '';
        if (peligro) return n;
      }
      if (disponibles.includes(5)) return 5;
      const esquinas = [1, 3, 7, 9].filter((n) => disponibles.includes(n));
      if (esquinas.length) return esquinas[azar(esquinas.length)];
      return disponibles[azar(disponibles.length)];
    };

    const jugarBot = () => {
      if (fin) return;
      const n = iaElegir();
      if (!n) return;
      tablero[n] = BOT;
      if (resolver()) return;
      turno = JUGADOR;
      safeSayMany([`🤖 El bot pone su ⭕ en la casilla ${n}.`, pintar(), `Le toca a ${propietario} (escribe un número 1-9)`]);
    };

    // Comprueba victoria/empate. Devuelve true si la partida ha acabado.
    const resolver = () => {
      const g = ganadorActual();
      if (g === JUGADOR) {
        darPuntos(propietario, 5);
        terminar([`🏆 ¡${propietario} gana el tres en raya!`, pintar(), '+5 puntos. Otro reto con !tresenraya']);
        return true;
      }
      if (g === BOT) {
        if (rival) {
          darPuntos(rival, 5);
          terminar([`🏆 ¡${rival} gana la partida!`, pintar(), '+5 puntos. Revancha con !tresenraya']);
        } else {
          terminar([`🤖 El bot gana esta vez. ¡Buen intento, ${propietario}!`, pintar(), 'Revancha con !tresenraya']);
        }
        return true;
      }
      if (!libres().length) {
        terminar(['🤝 ¡Empate! Nadie suma puntos esta vez.', pintar(), 'Otra con !tresenraya']);
        return true;
      }
      return false;
    };

    const aceptarRival = (user) => {
      rival = user;
      botJuega = false;
      esperandoEntrada = false;
      cambioEstado = true;
      const yaHayFicha = tablero.includes(JUGADOR) || tablero.includes(BOT);
      safeSayMany([
        `⚔️ ¡${rival} entra en la partida contra ${propietario}!`,
        yaHayFicha
          ? `${propietario} ya ha puesto su ❌, así que ahora le toca a ${rival} (⭕). Casillas 1-9.`
          : `${propietario} juega con ❌ y empieza. Casillas 1-9 (o a1-c3).`,
      ]);
    };

    // ---------- Mensajes iniciales ----------
    safeSayMany([
      `🎮 ¡Tres en raya abierto por ${quienReto || 'el chat'}! Escribe !entrar (o !join) para retarle, tienes ${VENTANA_ENTRADA}s.`,
      'Si nadie entra, juega el bot 🤖. Casillas numeradas 1-9 (también valen a1, b2, c3).',
    ]);
    esperandoEntrada = true;
    momentoEntrada = Date.now();

    // ---------- Objeto partida ----------
    const partida = {
      onMessage(user, message) {
        try {
          if (fin) return false;

          const texto = normalizar(message);
          if (!texto) return false;

          // Fase de entrada del segundo jugador.
          // Si no sabemos quien reto, el primero que escriba una casilla abre la partida.
          if (!propietario) {
            const cmdInicial = texto.replace(/^!+/, '');
            if (cmdInicial === 'entrar' || cmdInicial === 'join') {
              safeSay(`😅 Todavia no hay retador, ${user}. Escribe una casilla (1-9) para abrir la partida.`);
              return true;
            }
            const casillaInicial = parsearCasilla(texto, message);
            if (!casillaInicial) return false;
            propietario = user;
            momentoEntrada = Date.now();
            safeSay(`🎮 ${user} abre la partida y juega con ❌. ¡Buscamos rival (!entrar) o juego yo en ${VENTANA_ENTRADA}s!`);
          }

          // El retador puede empezar a jugar aunque aun no haya rival
          let primerMovimiento = false;
          if (esperandoEntrada && user === propietario && parsearCasilla(texto, message)) {
            esperandoEntrada = false;
            esperandoRival = true;
            momentoEntrada = Date.now();
            primerMovimiento = true;
          }

          // ¿Alguien entra en la partida?
          const cmdEntrada = texto.replace(/^!+/, '');
          const quiereEntrar = cmdEntrada === 'entrar' || cmdEntrada === 'join';
          if ((esperandoEntrada || esperandoRival) && quiereEntrar && user !== propietario) {
            esperandoEntrada = false;
            esperandoRival = false;
            aceptarRival(user);
            // Si el retador ya movio, le toca al rival; si no, empieza el retador.
            turno = tablero.includes(JUGADOR) ? BOT : JUGADOR;
            return true;
          } else if (esperandoEntrada && quiereEntrar && user === propietario) {
            safeSay(`😅 ${user}, ya estas dentro. Esperamos a otro jugador o al bot.`);
            return true;
          } else if (esperandoRival && quiereEntrar && user === propietario) {
            safeSay(`😅 ${user}, ya estas jugando. Esperamos a otra persona.`);
            return true;
          }

          // Solo los jugadores de la partida pueden mover
          const marca = symbolOf(user);
          if (!marca) return false;
          if (marca !== turno) {
            safeSay(`⏳ Tranquilo ${user}, ahora le toca a ${turnoTexto()}.`);
            return true;
          }

          const casilla = parsearCasilla(texto, message);
          if (!casilla) return false;
          if (tablero[casilla]) {
            safeSay(`🚫 La casilla ${casilla} ya esta ocupada, ${user}.`);
            return true;
          }

          tablero[casilla] = marca;
          cambioEstado = true;
          if (resolver()) return true;

          // Cambio de turno
          turno = marca === JUGADOR ? BOT : JUGADOR;
          const linea = `✅ ${user} pone su ${marca === JUGADOR ? '❌' : '⭕'} en ${casilla}.`;

          // Primera jugada y todavia puede entrar un rival: no movemos el bot
          if (primerMovimiento && esperandoRival) {
            safeSayMany([linea, pintar(), 'Espero un rival (!entrar) o sigo yo...']);
            return true;
          }

          if (turno === BOT && botJuega) {
            safeSayMany([linea, pintar()]);
            jugarBot();
            return true;
          }

          safeSayMany([linea, pintar(), `Le toca a ${turnoTexto()}`]);
          return true;
        } catch (err) {
          api.logger.error('tresenraya: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;

          // Nadie ha entrado: juega el bot
          if ((esperandoEntrada || esperandoRival) && propietario && Date.now() - momentoEntrada >= VENTANA_ENTRADA * 1000) {
            esperandoEntrada = false;
            esperandoRival = false;
            botJuega = true;
            cambioEstado = true;
            if (turno === BOT) {
              // El retador ya movio: el bot responde y le devuelve el turno
              safeSay('⏰ Nadie ha entrado, así que juego yo 🤖. ¡Vamos!');
              jugarBot();
            } else {
              turno = JUGADOR;
              safeSayMany(['⏰ Nadie ha entrado, así que juego yo 🤖. ¡Vamos!', pintar(), `Empieza ${propietario} con un número 1-9`]);
            }
          }

          // Limite de tiempo global para no dejar la partida colgada
          if (Date.now() - creadaEn >= TIEMPO_MAX * 1000) {
            terminar([
              '⏰ La partida de tres en raya ha caducado por inactividad.',
              pintarRespaldo(),
              'Retadme de nuevo con !tresenraya',
            ]);
          }
        } catch (err) {
          api.logger.error('tresenraya: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Tres en raya terminado. Usa !tresenraya para otro reto.';
          const quien = propietario || 'el chat';
          if (esperandoEntrada) {
            if (!propietario) {
              return 'Tres en raya: nadie ha escrito una casilla todavia. Escribe 1-9 para empezar.';
            }
            return `Tres en raya: ${quien} espera rival (!entrar). Quedan unos ${Math.max(0, VENTANA_ENTRADA - Math.floor((Date.now() - momentoEntrada) / 1000))}s`;
          }
          const rivalTxt = rival ? rival : 'el bot 🤖';
          return `Tres en raya: ${quien} vs ${rivalTxt} | turno de ${turnoTexto()} | tablero ${pintar().replace(/\n/g, ' ')}`;
        } catch (err) {
          return 'Tres en raya en curso.';
        }
      },

      // El gestor lee esta propiedad: refleja si la partida ha terminado.
      get finished() {
        return fin;
      },
    };

    // Convierte "5", "b2" o "c3" en el número de casilla 1-9 (o null si no vale).
    function parsearCasilla(texto, original) {
      if (/^[1-9]$/.test(texto)) return Number(texto);
      const m = /^([abc])([123])$/.exec(texto);
      if (m) {
        const fila = { a: 0, b: 1, c: 2 }[m[1]];
        const col = Number(m[2]) - 1;
        return fila * 3 + col + 1;
      }
      // Aceptamos también "!5" o "!b2" escritos como comando
      const sinPrefijo = String(original).trim().replace(/^!+/, '');
      const n2 = normalizar(sinPrefijo);
      if (n2 !== texto) return parsearCasilla(n2, n2);
      return null;
    }

    // Reflejamos finished en el objeto devuelto mediante un getter sencillo.
    return partida;
  },
};


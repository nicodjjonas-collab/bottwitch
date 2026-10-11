// ============================================================
// dados.js - Tiradas de dados y duelos 1v1 para el bot de Twitch
// Modos:
//   !dados        -> tira 2 dados de 6 y compara con el bot
//   !dados 20     -> tira un dado de 20 caras (2-1000)
//   !dados (otro) -> duelo: el segundo que escriba !dados reta al primero
// ESM puro, cero dependencias externas.
// ============================================================

const CARAS_POR_DEFECTO = 6;
const CARAS_MIN = 2;
const CARAS_MAX = 1000;
const DADOS_POR_DEFECTO = 2;
const VENTANA_DUELO = 20; // segundos para aceptar un duelo

export default {
  id: 'dados',
  name: 'Dados',
  aliases: ['dados', 'dado', 'roll'],
  help: '!dados tira 2d6 contra el bot, !dados 20 tira un d20, y dos personas pueden duelo con !dados.',
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
          api.logger.warn('dados: no se pudo enviar el mensaje');
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

    const tirada = (caras) => azar(caras) + 1;

    const sumarPuntos = (user, n) => {
      try {
        if (user && n > 0) api.store.addPoints(user, n);
      } catch (err) {
        api.logger.warn('dados: no se pudieron sumar puntos');
      }
    };

    const sumarStat = (user, clave, n) => {
      try {
        if (user) api.store.addStat(user, clave, n);
      } catch (err) {
        api.logger.warn('dados: no se pudieron guardar estadisticas');
      }
    };

    // ---------- Argumentos ----------
    let caras = CARAS_POR_DEFECTO;
    let modoCustom = false;
    try {
      const bruto = Array.isArray(args) && args.length ? parseInt(String(args[0]).replace(/^d/i, ''), 10) : NaN;
      if (isFinite(bruto)) {
        caras = Math.min(Math.max(bruto, CARAS_MIN), CARAS_MAX);
        modoCustom = true;
      }
    } catch (err) {
      caras = CARAS_POR_DEFECTO;
      modoCustom = false;
    }

    // ---------- Estado ----------
    let fin = false;
    let retador = null; // primer jugador
    let puntosRetador = 0;
    let esperandoRival = false;
    let momentoAviso = Date.now();
    let momentoInicio = Date.now();
    const historial = [];

    const tirarDados = (cantidad, nCaras) => {
      const valores = [];
      for (let i = 0; i < cantidad; i += 1) valores.push(tirada(nCaras));
      const total = valores.reduce((a, b) => a + b, 0);
      return { valores, total };
    };

    const terminar = (mensajes) => {
      fin = true;
      safeSayMany(mensajes);
    };

    // ---------- Modo dado personalizado (!dados 20) ----------
    if (modoCustom) {
      // El primer jugador que escriba un número también participa, pero aquí ya
      // tiramos nosotros en nombre del que lanzo el comando.
      retador = 'el chat';
      const mia = tirarDados(1, caras);
      const rival = tirarDados(1, caras);
      safeSayMany([
        `🎲 Dado de ${caras} caras: ha salido **${mia.total}**`,
        `El bot tira el mismo dado y saca **${rival.total}**. ${mia.total > rival.total ? '¡Gana el chat! 🎉' : mia.total < rival.total ? 'Gana el bot esta vez 🤖' : '¡Empate exacto! 🤝'}`,
        `Escribid !dados ${caras} para volver a tirar.`,
      ]);
      fin = true;
      return {
        onMessage() {
          return false;
        },
        onTick() {},
        status() {
          return `Dados de ${caras} caras ya lanzados. Escribe !dados ${caras} para otra tirada.`;
        },
        finished: true,
      };
    }

    // ---------- Modo normal: 2d6 contra el bot + duelo opcional ----------
    safeSayMany([
      '🎲 ¡Mesa de dados abierta! Escribe !dados y tiras 2d6 contra el bot.',
      `Si en los ${VENTANA_DUELO}s siguientes otra persona escribe !dados, se convierte en duelo 1v1. También vale !dados 20 para un dado de 20 caras.`,
    ]);

    const partida = {
      onMessage(user, message) {
        try {
          if (fin) return false;

          const texto = normalizar(message);
          const esComando = String(message).trim().startsWith('!');
          const cmd = texto.replace(/^!+/, '');

          // ¿Es una invocacion de dados?
          const esTirada = cmd === 'dados' || cmd === 'dado' || cmd === 'roll';
          // En modo duelo aceptamos también la palabra suelta
          if (!esComando && !esTirada) return false;
          if (esComando && !esTirada) return false;

          // Primer jugador: lanza contra el bot y abre ventana de duelo
          if (!retador) {
            retador = user;
            sumarStat(user, 'dados_tirados', 1);
            const mia = tirarDados(DADOS_POR_DEFECTO, CARAS_POR_DEFECTO);
            const bot = tirarDados(DADOS_POR_DEFECTO, CARAS_POR_DEFECTO);
            puntosRetador = mia.total;
            historial.push(`${user}: ${mia.valores.join(',')} = ${mia.total}`);

            if (mia.total > bot.total) {
              sumarPuntos(user, 2);
              sumarStat(user, 'dados_ganados', 1);
              safeSayMany([
                `🎲 ${user} saca ${mia.valores.join(' + ')} = **${mia.total}**`,
                `🤖 El bot saca ${bot.valores.join(' + ')} = ${bot.total}. ¡Gana ${user}! +2 puntos 🎉`,
                `${VENTANA_DUELO}s para que alguien reta con !dados...`,
              ]);
            } else if (mia.total < bot.total) {
              safeSayMany([
                `🎲 ${user} saca ${mia.valores.join(' + ')} = **${mia.total}**`,
                `🤖 El bot saca ${bot.valores.join(' + ')} = ${bot.total}. Gana el bot esta vez 😈`,
                `${VENTANA_DUELO}s para una revancha con !dados...`,
              ]);
            } else {
              safeSayMany([
                `🎲 ${user} saca ${mia.valores.join(' + ')} = **${mia.total}**`,
                `🤖 El bot saca ${bot.valores.join(' + ')} = ${bot.total}. ¡Empate! Se repite la tirada.`,
                'Escribe !dados otra vez para reintentar.',
              ]);
            }
            esperandoRival = true;
            momentoAviso = Date.now();
            return true;
          }

          // Segundo jugador: duelo
          if (esperandoRival && user !== retador) {
            esperandoRival = false;
            sumarStat(user, 'dados_tirados', 1);
            const suya = tirarDados(DADOS_POR_DEFECTO, CARAS_POR_DEFECTO);
            historial.push(`${user}: ${suya.valores.join(',')} = ${suya.total}`);

            if (suya.total > puntosRetador) {
              sumarPuntos(user, 3);
              sumarStat(user, 'dados_ganados', 1);
              terminar([
                `⚔️ ¡Duelo! ${retador} tenia **${puntosRetador}** y ${user} saca ${suya.valores.join(' + ')} = **${suya.total}**`,
                `🏆 ¡Gana ${user}! +3 puntos. Otra con !dados 🎲`,
              ]);
            } else if (suya.total < puntosRetador) {
              sumarPuntos(retador, 3);
              sumarStat(retador, 'dados_ganados', 1);
              terminar([
                `⚔️ ¡Duelo! ${retador} tenia **${puntosRetador}** y ${user} saca ${suya.valores.join(' + ')} = **${suya.total}**`,
                `🏆 ¡Gana ${retador}! +3 puntos. Revancha con !dados 🎲`,
              ]);
            } else {
              terminar([
                `⚔️ ¡Empate a ${suya.total}! En el duelo el empate no cuenta.`,
                'Tirad otra vez: !dados para ambos 🎲',
              ]);
            }
            return true;
          }

          if (user === retador) {
            const mia = tirarDados(DADOS_POR_DEFECTO, CARAS_POR_DEFECTO);
            puntosRetador = mia.total;
            safeSay(`${user} repite tirada: ${mia.valores.join(' + ')} = **${mia.total}**. Esperando rival...`);
            esperandoRival = true;
            momentoAviso = Date.now();
            return true;
          }

          return false;
        } catch (err) {
          api.logger.error('dados: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;

          // La ventana de duelo caduca y la tirada contra el bot queda como definitiva
          if (esperandoRival && Date.now() - momentoAviso >= VENTANA_DUELO * 1000) {
            esperandoRival = false;
            const resumen = historial.length ? ` Ultimas tiradas: ${historial.slice(-2).join(' | ')}` : '';
            safeSay(`⌛ Se acabo el tiempo del duelo. La tirada de ${retador} (${puntosRetador}) se queda como resultado.${resumen}`);
          }

          // Caducidad general para no dejar la partida colgada
          if (Date.now() - momentoInicio >= 5 * 60 * 1000) {
            terminar(['⏰ La mesa de dados se cierra. ¡Otra ronda con !dados cuando queráis! 🎲']);
          }
        } catch (err) {
          api.logger.error('dados: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Tirada de dados terminada. Usa !dados para otra.';
          if (!retador) return 'Dados: esperando la primera tirada (!dados).';
          if (esperandoRival) return `Dados: ${retador} saco ${puntosRetador}. Quedan ~${Math.max(0, VENTANA_DUELO - Math.floor((Date.now() - momentoAviso) / 1000))}s para retarle con !dados`;
          return `Dados: última tirada de ${retador} = ${puntosRetador}`;
        } catch (err) {
          return 'Dados en curso.';
        }
      },

      get finished() {
        return fin;
      },
    };

    return partida;
  },
};

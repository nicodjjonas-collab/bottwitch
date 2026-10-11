// ============================================================
// adivina.js - Adivina el número que piensa el bot
// !adivina         -> número del 1 al 100
// !adivina 500     -> número del 1 al 500 (maximo 10000)
// El bot responde "mas alto", "mas bajo" o "¡correcto!".
// ESM puro, cero dependencias externas.
// ============================================================

const RANGO_POR_DEFECTO = 100;
const RANGO_MAX = 10000;
const TIEMPO_TOTAL = 180; // segundos de partida

export default {
  id: 'adivina',
  name: 'Adivina el número',
  aliases: ['adivina', 'numero', 'number'],
  help: 'El bot piensa un número y te dice mas alto o mas bajo. !adivina 500 para cambiar el rango.',
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
          api.logger.warn('adivina: no se pudo enviar el mensaje');
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
        api.logger.warn('adivina: no se pudieron sumar puntos');
      }
    };

    // ---------- Rango y número secreto ----------
    let maximo = RANGO_POR_DEFECTO;
    try {
      const pedido = Array.isArray(args) && args.length ? parseInt(String(args[0]), 10) : NaN;
      if (isFinite(pedido) && pedido >= 2) maximo = Math.min(pedido, RANGO_MAX);
    } catch (err) {
      maximo = RANGO_POR_DEFECTO;
    }

    const secreto = azar(maximo) + 1;

    // ---------- Estado ----------
    let intentos = 0;
    let fin = false;
    let cercaAvisada = false;
    const inicio = Date.now();
    const marcador = new Map(); // user -> intentos gastados

    const terminar = (lineas) => {
      fin = true;
      safeSayMany(lineas);
    };

    // ---------- Arranque ----------
    safeSayMany([
      `🔢 ¡He pensado un número del 1 al ${maximo}! Escribid vuestras propuestas en el chat.`,
      `Os dire si el número es mas alto o mas bajo. Tenéis 3 minutos. Quien acierte suma puntos 🎯`,
    ]);

    const partida = {
      onMessage(user, message) {
        try {
          if (fin) return false;
          const texto = normalizar(message);
          if (!texto) return false;
          if (String(message).trim().startsWith('!')) return false;

          // Solo aceptamos números puros para no consumir conversacion normal
          if (!/^\d{1,6}$/.test(texto)) return false;

          const número = parseInt(texto, 10);
          if (!isFinite(número)) return false;

          if (número < 1 || número > maximo) {
            safeSay(`🚫 ${user}, el número tiene que estar entre 1 y ${maximo}.`);
            return true;
          }

          intentos += 1;
          marcador.set(user, (marcador.get(user) || 0) + 1);

          if (número === secreto) {
            const gastados = marcador.get(user) || 1;
            const premio = gastados <= 3 ? 10 : gastados <= 6 ? 7 : 4;
            darPuntos(user, premio);
            terminar([
              `🎉 ¡CORRECTO, ${user}! El número era el **${secreto}**.`,
              `Lo has acertado en ${gastados} intento(s) y te llevas +${premio} puntos. Intentos totales del chat: ${intentos} 🎧`,
            ]);
            return true;
          }

          // Respuesta caliente/frio
          const distancia = Math.abs(número - secreto);
          let calor = '';
          if (distancia <= Math.max(2, Math.round(maximo * 0.01))) calor = ' ¡Estas muy cerca! 🔥';
          else if (distancia <= Math.max(5, Math.round(maximo * 0.05))) calor = ' Caliente 😏';
          else if (distancia <= Math.max(15, Math.round(maximo * 0.15))) calor = ' Tibio 🌤️';
          else calor = ' Frio 🧊';

          if (número < secreto) {
            safeSay(`⬆️ ${user}: ${número} es MAS ALTO.${calor}`);
          } else {
            safeSay(`⬇️ ${user}: ${número} es MAS BAJO.${calor}`);
          }

          // Si quedan pocas opciones, avisamos una vez
          if (!cercaAvisada && intentos >= 10) {
            cercaAvisada = true;
            const margen = Math.max(5, Math.round(maximo * 0.1));
            safeSay(`💡 Pista del bot: el número esta entre ${Math.max(1, secreto - margen)} y ${Math.min(maximo, secreto + margen)}.`);
          }
          return true;
        } catch (err) {
          api.logger.error('adivina: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          if (Date.now() - inicio >= TIEMPO_TOTAL * 1000) {
            terminar([
              `⏰ Se acabo el tiempo y nadie lo ha acertado. El número era el **${secreto}**.`,
              `Han sido ${intentos} intentos en total. Otra vez con !adivina 🎲`,
            ]);
          }
        } catch (err) {
          api.logger.error('adivina: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'El juego de adivinar el número ha terminado. Usa !adivina para otra ronda.';
          const participantes = marcador.size ? [...marcador.keys()].slice(0, 5).join(', ') : 'nadie todavia';
          return `Adivina el número (1-${maximo}): ${intentos} intentos, participan: ${participantes}`;
        } catch (err) {
          return 'Adivina el número en curso.';
        }
      },

      get finished() {
        return fin;
      },
    };

    return partida;
  },
};

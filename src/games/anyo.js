// ============================================================
// año.js - ADIVINA EL AÑO
// El streamer fija el año del tema y el chat lo intenta.
// Gana el que se quede mas cerca.
//
// Uso:  !anyo 1998          (el streamer fija el año correcto)
//       el chat escribe: 1995
// ============================================================

export default {
  id: 'anyo',
  name: 'Adivina el año',
  aliases: ['anyo', 'ano', 'adivinaelanyo'],
  help: 'Adivina el año del tema que suena. Gana el que se acerque mas.',
  multiplayer: true,
  minArgs: 1,

  create(api, args) {
    const safeSay = (t) => {
      const s = String(t == null ? '' : t).trim();
      if (!s) return;
      try { api.say(s); } catch (e) { /* nada */ }
    };
    const safeSayMany = (arr) => {
      const l = (Array.isArray(arr) ? arr : [arr])
        .map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, 4);
      if (!l.length) return;
      try { if (typeof api.sayMany === 'function') { api.sayMany(l); return; } } catch (e) { /* seguimos */ }
      l.forEach(safeSay);
    };
    const puntos = (u, n) => { try { if (u && n > 0) api.store.addPoints(u, n); } catch (e) { /* da igual */ } };

    const objetivo = parseInt(String((Array.isArray(args) ? args[0] : '') || '').replace(/[^0-9]/g, ''), 10);
    const valido = isFinite(objetivo) && objetivo > 1900 && objetivo < 2100;
    const apuestas = new Map(); // user -> año
    const premio = Number((api.config.games && api.config.games.points && api.config.games.points.win) || 10);
    let tiempo = 75;
    let fin = false;

    if (!valido) {
      safeSay('Uso: !anyo 1998   (el año del tema que está sonando)');
      fin = true;
    } else {
      safeSayMany([
        '📅 ¡ADIVINA EL AÑO! ¿De qué año es el tema que suena?',
        `Escribe un año de 4 cifras en el chat. Tenéis ${tiempo} s. Gana el que se acerque más 🏆`,
        '(Streamer: escribe /delete para borrar tu mensaje con la respuesta)',
      ]);
    }

    const finalizar = () => {
      if (fin) return;
      fin = true;
      if (!apuestas.size) {
        safeSayMany([`📅 El año era **${objetivo}** y nadie ha apostado 😅`, 'Otra con !anyo 🎧']);
        return;
      }
      const lista = [...apuestas.entries()].map(([u, a]) => ({ u, a, d: Math.abs(a - objetivo) }));
      lista.sort((x, y) => x.d - y.d);
      const ganador = lista[0];
      puntos(ganador.u, premio);

      const tabla = lista.slice(0, 5).map((x) => `${x.u} (${x.a})`).join(' · ');
      safeSayMany([
        `📅 ¡Era **${objetivo}**! Gana ${ganador.u} diciendo ${ganador.a} (se fue por ${ganador.d} año(s)) 🏆 +${premio} puntos`,
        `Apuestas -> ${tabla}`,
        'Otra ronda con !anyo 🎧',
      ]);
    };

    return {
      onMessage(user, message) {
        try {
          if (fin) return true;
          const texto = String(message || '').trim();
          if (!texto || texto.startsWith('!')) return false;

          const esMando = (() => { try { return api.isMod(user); } catch (e) { return false; } })();
          if (esMando && /^(fin|cerrar|revelar|acabar)$/i.test(texto)) {
            finalizar();
            return true;
          }

          // Solo aceptamos años de 4 cifras (1900-2099) y no gastamos el turno con otra cosa
          if (!/^\d{4}$/.test(texto)) return false;
          const año = parseInt(texto, 10);
          if (año < 1900 || año > 2099) return false;

          if (!apuestas.has(user)) {
            apuestas.set(user, año);
            return true; // no decimos nada: así nadie copia a nadie
          }
          return true;
        } catch (e) {
          api.logger.error('año: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          if (tiempo <= 0) finalizar();
        } catch (e) {
          api.logger.error('año: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Adivina el año: terminado.';
          return `Adivina el año en curso: ${apuestas.size} apuesta(s), quedan ~${Math.max(tiempo, 0)}s`;
        } catch (e) {
          return 'Adivina el año en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

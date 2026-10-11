// ============================================================
// década.js - ADIVINA LA DECADA
// Suena un tema y el chat vota de que década es.
// El streamer fija la correcta; el bot recuenta los votos al final.
//
// Uso:  !decada 90          (o 80, 2000, 2010)
//       el chat vota escribiendo: 80s / 90s / 2000 / 2010
// ============================================================

const VALIDAS = ['80', '90', '2000', '2010'];

function limpiarDecada(texto) {
  const t = String(texto || '').toLowerCase().replace(/[^0-9]/g, '');
  if (!t) return null;
  if (t.startsWith('8')) return '80';
  if (t.startsWith('9')) return '90';
  if (t.startsWith('20')) return '2000';
  if (t.startsWith('201')) return '2010';
  return null;
}

export default {
  id: 'decada',
  name: 'Adivina la década',
  aliases: ['decada', 'decadas'],
  help: 'Vota de que década es el tema que suena. El streamer fija la correcta con !decada 90.',
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

    const correcta = limpiarDecada(Array.isArray(args) ? args[0] : '');
    const votos = new Map(); // user -> década
    const premio = Number((api.config.games && api.config.games.points && api.config.games.points.win) || 10);
    let tiempo = 75;
    let fin = false;

    if (!correcta || !VALIDAS.includes(correcta)) {
      safeSay('Uso: !decada 90   (décadas válidas: 80, 90, 2000, 2010)');
      fin = true;
    } else {
      safeSayMany([
        '🕰️ ¡ADIVINA LA DÉCADA! ¿De qué década es el tema que suena?',
        'Escribe tu voto en el chat: 80s · 90s · 2000 · 2010',
        `Tenéis ${tiempo} segundos. Los que acierten se llevan puntos 🏆`,
      ]);
    }

    const recuento = () => {
      const cuentas = { '80': 0, '90': 0, '2000': 0, '2010': 0 };
      for (const v of votos.values()) if (cuentas[v] != null) cuentas[v] += 1;
      return cuentas;
    };

    const finalizar = () => {
      if (fin) return;
      fin = true;
      const cuentas = recuento();
      const resumen = Object.entries(cuentas).filter(([, n]) => n > 0)
        .map(([d, n]) => `${d}s: ${n}`).join(' · ') || 'sin votos';

      let aciertos = 0;
      for (const [u, v] of votos.entries()) {
        if (v === correcta) { aciertos += 1; puntos(u, premio); }
      }

      safeSayMany([
        `🎯 ¡Era de los ${correcta}s! Votos -> ${resumen}`,
        aciertos
          ? `🏆 Han acertado ${aciertos} persona(s) y se llevan ${premio} puntos cada una. ¡Bien!`
          : '😅 Nadie ha acertado esta vez. ¡La próxima cae!',
        'Otra ronda con !decada 🎧',
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

          const d = limpiarDecada(texto);
          if (!d) return false;

          if (!votos.has(user)) {
            votos.set(user, d);
            safeSay(`🗳️ ${user} vota: ${d}s`);
          } else {
            safeSay(`✋ ${user}, ya has votado (${votos.get(user)}s). Solo cuenta el primer voto.`);
          }
          return true;
        } catch (e) {
          api.logger.error('década: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          if (tiempo <= 0) finalizar();
        } catch (e) {
          api.logger.error('década: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Adivina la década: terminado.';
          return `Adivina la década en curso: ${votos.size} voto(s), quedan ~${Math.max(tiempo, 0)}s`;
        } catch (e) {
          return 'Adivina la década en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

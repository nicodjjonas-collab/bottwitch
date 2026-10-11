// ============================================================
// frase.js - COMPLETA LA FRASE
// El streamer escribe una frase con un hueco y el chat lo rellena.
//
// Uso:  !frase London | El grupo es ___ y son dos hermanos
//       (antes de la barra va la RESPUESTA; después, la frase con ___)
//
// Nota: el texto lo pones tu en el momento. No metas letras de canciones
// que no sean tuyas: con titulos, nombres de grupos o datos va perfecto.
// ============================================================

export default {
  id: 'frase',
  name: 'Completa la frase',
  aliases: ['frase', 'completa', 'hueco'],
  help: 'El streamer pone una frase con un hueco (___) y el chat lo rellena.',
  multiplayer: true,
  minArgs: 2,

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
    const norm = (t) => {
      let s = '';
      try { s = api.normalize(String(t == null ? '' : t)); } catch (e) { s = String(t == null ? '' : t).toLowerCase(); }
      return s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const puntos = (u, n) => { try { if (u && n > 0) api.store.addPoints(u, n); } catch (e) { /* da igual */ } };

    const unido = Array.isArray(args) ? args.join(' ') : String(args || '');
    const trozos = unido.split('|');
    const respuesta = norm(trozos[0] || '');
    const frase = (trozos.slice(1).join('|') || '').trim();
    const premio = Number((api.config.games && api.config.games.points && api.config.games.points.win) || 10);
    let tiempo = 60;
    let fin = false;
    let intentos = 0;

    if (!respuesta || !frase) {
      safeSay('Uso: !frase RESPUESTA | La frase con un ___ donde va');
      fin = true;
    } else {
      safeSayMany([
        `📝 ¡COMPLETA LA FRASE! ${frase}`,
        `Escribid en el chat lo que falta. Tenéis ${tiempo} s y el que acierte se lleva ${premio} puntos 🏆`,
      ]);
    }

    const revelar = (texto) => {
      fin = true;
      safeSayMany([texto, 'Otra ronda con !frase 🎧']);
    };

    return {
      onMessage(user, message) {
        try {
          if (fin) return false;
          const texto = String(message || '').trim();
          if (!texto || texto.startsWith('!')) return false;

          const esMando = (() => { try { return api.isMod(user); } catch (e) { return false; } })();
          if (esMando && /^(fin|revelar|rendirse|acabar)$/i.test(texto)) {
            revelar(`📝 La respuesta era: **${respuesta.toUpperCase()}**`);
            return true;
          }

          intentos += 1;
          if (norm(texto) === respuesta) {
            puntos(user, premio);
            revelar(`🎉 ¡${user} lo tiene! Era **${respuesta.toUpperCase()}** 🏆 +${premio} puntos`);
            return true;
          }
          return false;
        } catch (e) {
          api.logger.error('frase: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          if (tiempo <= 0) revelar(`⏰ Se acabó el tiempo. La respuesta era: **${respuesta.toUpperCase()}**`);
        } catch (e) {
          api.logger.error('frase: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Completa la frase: terminado.';
          return `Completa la frase en curso (quedan ~${Math.max(tiempo, 0)}s)`;
        } catch (e) {
          return 'Completa la frase en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

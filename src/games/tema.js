// ============================================================
// tema.js - ADIVINA EL TEMA
// El streamer fija la respuesta y el chat intenta adivinarla.
// Pensado para un canal de música: suena el tema y el chat escribe.
//
// Uso:  !tema Cafe del Mar
//       (el streamer escribe /delete después para borrar la respuesta)
// ============================================================

export default {
  id: 'tema',
  name: 'Adivina el tema',
  aliases: ['tema', 'cancion', 'adivinaeltema'],
  help: 'Adivina la canción que suena. El streamer la fija con !tema <respuesta>.',
  multiplayer: true,
  minArgs: 1,

  create(api, args) {
    const safeSay = (t) => {
      const s = String(t == null ? '' : t).trim();
      if (!s) return;
      try { api.say(s); } catch (e) { /* sin chat no hay juego */ }
    };
    const safeSayMany = (arr) => {
      const l = (Array.isArray(arr) ? arr : [arr])
        .map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, 4);
      if (!l.length) return;
      try { if (typeof api.sayMany === 'function') { api.sayMany(l); return; } } catch (e) { /* seguimos */ }
      l.forEach(safeSay);
    };
    // Compara sin tildes, sin mayusculas y sin signos: "Café del Mar!" = "cafe del mar"
    const norm = (t) => {
      let s = '';
      try { s = api.normalize(String(t == null ? '' : t)); } catch (e) { s = String(t == null ? '' : t).toLowerCase(); }
      return s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const puntos = (u, n) => { try { if (u && n > 0) api.store.addPoints(u, n); } catch (e) { /* da igual */ } };

    const respuesta = norm(Array.isArray(args) ? args.join(' ') : '');
    const premio = Number((api.config.games && api.config.games.points && api.config.games.points.win) || 10);
    let tiempo = 90;
    let fin = false;
    let ganador = null;
    let intentos = 0;

    if (!respuesta) {
      safeSay('Uso: !tema <respuesta> (por ejemplo: !tema Cafe del Mar)');
      fin = true;
    } else {
      safeSayMany([
        '🎵 ¡ADIVINA EL TEMA! Escribe en el chat qué canción está sonando.',
        `Tenéis ${tiempo} segundos. Premio: ${premio} puntos 🏆`,
        '(Streamer: escribe /delete para borrar tu mensaje con la respuesta)',
      ]);
    }

    const finalizar = (motivo) => {
      if (fin) return;
      fin = true;
      if (ganador) return;
      safeSayMany([
        `⏰ Se acabó el tiempo. La respuesta era: **${respuesta.toUpperCase()}**`,
        'Otra ronda cuando quieras con !tema 🎧',
      ]);
    };

    return {
      onMessage(user, message) {
        try {
          if (fin) return false;
          const texto = String(message || '').trim();
          if (!texto || texto.startsWith('!')) return false;

          // El streamer o un mod pueden revelar cuando quieran
          const esMando = (() => { try { return api.isMod(user); } catch (e) { return false; } })();
          if (esMando && /^(fin|revelar|rendirse|acabar)$/i.test(texto)) {
            safeSay(`🎵 La respuesta era: **${respuesta.toUpperCase()}**`);
            fin = true;
            return true;
          }

          intentos += 1;
          if (norm(texto) === respuesta) {
            ganador = user;
            fin = true;
            puntos(user, premio);
            safeSayMany([
              `🎉 ¡${user} lo ha adivinado! Era **${respuesta.toUpperCase()}** 🏆 +${premio} puntos`,
              'Otra ronda cuando quieras con !tema 🎧',
            ]);
            return true;
          }
          // Pista después de muchos intentos fallidos
          if (intentos === 12) {
            const letras = respuesta.replace(/ /g, '').length;
            safeSay(`💡 Pista: la respuesta tiene ${letras} letras y ${respuesta.split(' ').length} palabra(s).`);
          }
          return false; // dejamos pasar el mensaje como conversacion normal
        } catch (e) {
          api.logger.error('tema: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          if (tiempo <= 0) finalizar('tiempo');
        } catch (e) {
          api.logger.error('tema: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Adivina el tema: partida terminada.';
          return `Adivina el tema en curso (quedan ~${Math.max(tiempo, 0)}s, ${intentos} intento(s))`;
        } catch (e) {
          return 'Adivina el tema en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

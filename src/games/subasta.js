// ============================================================
// subasta.js - SUBASTA DE PUNTOS
// Se subasta el derecho a elegir el próximo tema (o lo que tu quieras).
// Gana la puja mas alta y se le descuentan los puntos.
//
// Uso:  !subasta                -> abre la subasta
//       !subasta El próximo tema -> abre la subasta con ese premio
//       el chat puja escribiendo:  50   o  puja 50
// ============================================================

export default {
  id: 'subasta',
  name: 'Subasta de puntos',
  aliases: ['subasta', 'pujar'],
  help: 'Subasta por puntos: gana la puja mas alta. El chat puja escribiendo un número.',
  multiplayer: true,
  minArgs: 0,

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
    const leer = (u) => { try { return Number(api.store.getPoints(u)) || 0; } catch (e) { return 0; } };
    const sumar = (u, n) => { try { api.store.addPoints(u, n); } catch (e) { /* da igual */ } };

    const premio = (Array.isArray(args) && args.length ? args.join(' ') : 'elegir el próximo tema').slice(0, 90);
    let mejor = 0;
    let mejorPujador = null;
    let pujas = 0;
    let tiempo = 90;
    let fin = false;

    safeSayMany([
      `🔨 ¡SUBASTA ABIERTA! Se subasta: **${premio}**`,
      'Puja en el chat escribiendo un número (por ejemplo: 50). Gana la más alta 🏆',
      `Tenéis ${tiempo} segundos. Solo valen pujas que puedas pagar.`,
    ]);

    const cerrar = () => {
      if (fin) return;
      fin = true;
      if (!mejorPujador) {
        safeSayMany(['🔨 Se cierra la subasta... ¡y sin ninguna puja! Otra con !subasta 😅']);
        return;
      }
      sumar(mejorPujador, -mejor);      // se le cobra la puja
      safeSayMany([
        `🏆 ¡Subasta cerrada! Gana **${mejorPujador}** con ${mejor} puntos (le quedan ${leer(mejorPujador)}).`,
        `Se lleva: ${premio} 🎧`,
      ]);
    };

    return {
      onMessage(user, message) {
        try {
          if (fin) return false;
          const texto = String(message || '').trim();
          if (!texto || texto.startsWith('!')) return false;

          const esMando = (() => { try { return api.isMod(user); } catch (e) { return false; } })();
          if (esMando && /^(cerrar|fin|adjudicar|acabar)$/i.test(texto)) {
            cerrar();
            return true;
          }

          // Aceptamos "50" o "puja 50"
          const m = texto.match(/^(?:puja|pujo|apuesto|ofrezco)?\s*(\d{1,5})$/i);
          if (!m) return false;

          const cantidad = parseInt(m[1], 10);
          if (!isFinite(cantidad) || cantidad <= 0) return false;

          if (cantidad <= mejor) {
            safeSay(`📉 ${user}, hay que pujar más de ${mejor}. ¡Anímate!`);
            return true;
          }
          const tiene = leer(user);
          if (cantidad > tiene) {
            safeSay(`🚫 ${user}, tienes ${tiene} puntos y has pujado ${cantidad}. Gana más con !trivia 🎯`);
            return true;
          }

          mejor = cantidad;
          mejorPujador = user;
          pujas += 1;
          safeSay(`🔨 ${user} puja ${cantidad} puntos. ¿Alguien da más?`);
          return true;
        } catch (e) {
          api.logger.error('subasta: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          // Aviso a falta de 15 segundos
          if (tiempo === 15 && mejorPujador) {
            safeSay(`⏳ ¡Quedan 15 segundos! La mejor puja es de ${mejorPujador} con ${mejor}. ¿Alguien da más?`);
          }
          if (tiempo <= 0) cerrar();
        } catch (e) {
          api.logger.error('subasta: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Subasta terminada.';
          return `Subasta en curso: ${pujas} puja(s), mejor ${mejor}${mejorPujador ? ` (${mejorPujador})` : ''}, quedan ~${Math.max(tiempo, 0)}s`;
        } catch (e) {
          return 'Subasta en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

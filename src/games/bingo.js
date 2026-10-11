// ============================================================
// bingo.js - BINGO
// Cada participante recibe un carton de 5 números (del 1 al 90).
// El bot va sacando bolas y gana el primero que complete su carton.
//
// Uso:  !bingo          -> abre el bingo
//       el chat escribe: carton   (para pedir su carton)
// ============================================================

export default {
  id: 'bingo',
  name: 'Bingo',
  aliases: ['bingo', 'carton'],
  help: 'Cada uno pide carton y el bot saca bolas: gana el primero que complete los 5 números.',
  multiplayer: true,
  minArgs: 0,

  create(api) {
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

    const premio = Number((api.config.games && api.config.games.points && api.config.games.points.win) || 10) * 2;
    const cartones = new Map();     // user -> [5 números]
    const sacadas = [];             // bolas sacadas
    const bolas = [];
    for (let i = 1; i <= 90; i++) bolas.push(i);

    let fin = false;
    let tiempo = 240;               // 4 minutos de bingo como maximo
    let contadorTick = 0;
    let ganador = null;

    const sacarBola = () => {
      if (!bolas.length) return null;
      const idx = Math.floor(Math.random() * bolas.length);
      const bola = bolas.splice(idx, 1)[0];
      sacadas.push(bola);
      return bola;
    };

    const tablero = () => sacadas.slice(-8).join(' · ');

    const comprobar = () => {
      for (const [user, carton] of cartones.entries()) {
        if (carton.every((n) => sacadas.includes(n))) return user;
      }
      return null;
    };

    const finalizar = (motivo) => {
      if (fin) return;
      fin = true;
      if (ganador) {
        puntos(ganador, premio);
        safeSayMany([
          `🎉 ¡¡BINGO!! **${ganador}** completa su carton (${cartones.get(ganador).join(', ')}) y se lleva ${premio} puntos 🏆`,
          `Bolas sacadas: ${tablero()}`,
          'Otro bingo cuando queráis con !bingo 🎧',
        ]);
        return;
      }
      safeSayMany([
        `⏰ Se acabó el tiempo y nadie ha completado el cartón. Bolas: ${tablero()}`,
        'Otra ronda con !bingo 🎧',
      ]);
    };

    safeSayMany([
      `🎱 ¡BINGO! Escribe **carton** para recibir tus 5 números (del 1 al 90).`,
      `Voy sacando una bola cada 10 segundos. Completa tus 5 números y ganas ${premio} puntos 🏆`,
    ]);

    return {
      onMessage(user, message) {
        try {
          if (fin) return false;
          const texto = String(message || '').trim();
          if (!texto || texto.startsWith('!')) return false;

          const esMando = (() => { try { return api.isMod(user); } catch (e) { return false; } })();
          if (esMando && /^(fin|cerrar|acabar|parar)$/i.test(texto)) {
            finalizar('fin');
            return true;
          }

          if (/^(carton|cartón|quiero|apuntame|apúntame|bingo)$/i.test(texto)) {
            if (cartones.has(user)) {
              safeSay(`🎫 ${user}, ya tienes carton: ${cartones.get(user).join(', ')}`);
              return true;
            }
            if (cartones.size >= 12) {
              safeSay('🎫 Ya hay 12 cartones (es para no saturar el chat). ¡Los siguientes a la próxima!');
              return true;
            }
            const carton = [];
            const libres = bolas.slice();
            for (let i = 0; i < 5 && libres.length; i++) {
              const idx = Math.floor(Math.random() * libres.length);
              carton.push(libres.splice(idx, 1)[0]);
            }
            carton.sort((a, b) => a - b);
            cartones.set(user, carton);
            safeSay(`🎫 ${user} tiene su carton: ${carton.join(' · ')}  ¡Suerte!`);
            return true;
          }
          return false;
        } catch (e) {
          api.logger.error('bingo: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          contadorTick += 1;

          // Una bola cada dos tics (unos 10 segundos)
          if (contadorTick % 2 === 0) {
            const bola = sacarBola();
            if (bola == null) { finalizar('sinbolas'); return; }
            ganador = comprobar();
            // Solo cantamos las bolas cada 3 tiradas, para no inundar el chat
            if (contadorTick % 6 === 0 || ganador) {
              safeSay(`🎱 Bola ${bola}. Van saliendo: ${tablero()}`);
            }
            if (ganador) { finalizar('bingo'); return; }
          }

          if (tiempo <= 0) finalizar('tiempo');
        } catch (e) {
          api.logger.error('bingo: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Bingo terminado.';
          return `Bingo en curso: ${cartones.size} carton(es), ${sacadas.length} bola(s) sacada(s), quedan ~${Math.max(tiempo, 0)}s`;
        } catch (e) {
          return 'Bingo en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

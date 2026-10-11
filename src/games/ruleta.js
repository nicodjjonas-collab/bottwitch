// ============================================================
// ruleta.js - RULETA DE PUNTOS
// Se abre una ruleta con una apuesta y quien escriba "girar" juega.
//
// Uso:  !ruleta 50     -> se abre la ruleta con 50 puntos de apuesta
//       !ruleta        -> apuesta por defecto: 10
//       el chat escribe:  girar   (para probar)   |   otra  (para repetir)
// ============================================================

// Cada casilla: multiplicador y probabilidad (sobre 100)
const CASILLAS = [
  { mult: 0,   prob: 30, texto: '💀 PIERDES la apuesta' },
  { mult: 0.5, prob: 20, texto: '😬 te devuelven la mitad' },
  { mult: 1,   prob: 18, texto: '😐 te devuelven lo apostado' },
  { mult: 1.5, prob: 14, texto: '🙂 ganas x1.5' },
  { mult: 2,   prob: 10, texto: '😄 ganas x2' },
  { mult: 3,   prob: 5,  texto: '🤩 ganas x3' },
  { mult: 5,   prob: 2,  texto: '🔥 GANAS x5' },
  { mult: 10,  prob: 1,  texto: '💎 ¡JACKPOT x10!' },
];

export default {
  id: 'ruleta',
  name: 'Ruleta de puntos',
  aliases: ['ruleta', 'girar', 'apuesta'],
  help: 'Apuesta puntos y escribe "girar": puedes multiplicarlos o perderlo todo.',
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

    let apuesta = 10;
    try {
      const pedido = Array.isArray(args) && args.length ? parseInt(String(args[0]), 10) : NaN;
      if (isFinite(pedido) && pedido > 0) apuesta = Math.min(pedido, 500);
    } catch (e) { apuesta = 10; }

    let fin = false;
    let tiempo = 60;
    let giros = 0;
    let ultimoJugador = null;

    const elegirCasilla = () => {
      const total = CASILLAS.reduce((a, c) => a + c.prob, 0);
      let dado = Math.random() * total;
      for (const c of CASILLAS) {
        dado -= c.prob;
        if (dado <= 0) return c;
      }
      return CASILLAS[0];
    };

    const girar = (user) => {
      const tiene = leer(user);
      if (tiene < apuesta) {
        safeSay(`🚫 ${user}, necesitas ${apuesta} puntos y tienes ${tiene}. Gánalos con !trivia o !musicquiz 😉`);
        return false;
      }

      sumar(user, -apuesta);                    // se cobra la apuesta
      const casilla = elegirCasilla();
      const ganancia = Math.floor(apuesta * casilla.mult);
      if (ganancia > 0) sumar(user, ganancia);

      giros += 1;
      ultimoJugador = user;
      tiempo = 45;                              // damos mas tiempo para repetir

      const balance = ganancia - apuesta;
      const signo = balance >= 0 ? `+${balance}` : `${balance}`;
      safeSayMany([
        `🎰 ${user} apuesta ${apuesta}... ¡${casilla.texto}!`,
        `💰 Balance: ${signo} puntos · ahora tiene ${leer(user)}`,
        'Si quieres repetir, escribe **otra** (con la misma apuesta) 🎲',
      ]);
      return true;
    };

    safeSayMany([
      `🎰 ¡RULETA ABIERTA en #${api.channel}! Apuesta: ${apuesta} puntos.`,
      'Escribe **girar** para probar suerte. Puedes perderlo o multiplicarlo x2, x3, x5 y hasta x10 💎',
    ]);

    return {
      onMessage(user, message) {
        try {
          if (fin) return false;
          const texto = String(message || '').trim();
          if (!texto || texto.startsWith('!')) return false;

          if (/^(girar|gira|tirar|ruleta|jugar|va)$/i.test(texto)) {
            girar(user);
            return true;
          }
          if (/^(otra|otra vez|again|repetir)$/i.test(texto)) {
            if (!ultimoJugador) { girar(user); return true; }
            girar(user);
            return true;
          }
          return false;
        } catch (e) {
          api.logger.error('ruleta: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          if (tiempo <= 0) {
            fin = true;
            if (giros === 0) {
              safeSay('🎰 Se acabó el tiempo y nadie se atrevió a girar. Otra con !ruleta 😅');
            } else {
              safeSay(`🎰 Ruleta cerrada tras ${giros} tirada(s). ¡Otra cuando queráis con !ruleta!`);
            }
          }
        } catch (e) {
          api.logger.error('ruleta: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Ruleta terminada.';
          return `Ruleta abierta (apuesta ${apuesta}, ${giros} tirada(s), quedan ~${Math.max(tiempo, 0)}s)`;
        } catch (e) {
          return 'Ruleta en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

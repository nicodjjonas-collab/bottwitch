// ============================================================
// musicquiz.js - TRIVIA MUSICAL
// Preguntas de cultura musical (años, generos, aparatos, historia).
// Son preguntas propias sobre hechos: no hay letras ni material de nadie.
//
// Uso:  !musicquiz        (6 preguntas)
//       !musicquiz 10     (10 preguntas)
// ============================================================

// Cada pregunta: enunciado + respuestas validas (sin tildes, en minusculas)
const PREGUNTAS = [
  { p: '¿En qué ciudad nació el techno?', r: ['detroit', 'detroit michigan'] },
  { p: '¿En qué país nació el house?', r: ['estados unidos', 'eeuu', 'usa', 'chicago'] },
  { p: '¿Qué significan las siglas BPM?', r: ['beats por minuto', 'pulsaciones por minuto', 'beat por minuto'] },
  { p: '¿Cómo se llama el aparato donde un DJ pincha vinilos?', r: ['tocadiscos', 'giradiscos', 'plato', 'plato giradiscos'] },
  { p: '¿En qué década se popularizó el CD?', r: ['90', 'los 90', 'noventa', '90s'] },
  { p: '¿Qué género va más rápido: el house o el drum and bass?', r: ['drum and bass', 'drum & bass', 'dnb', 'el drum and bass'] },
  { p: '¿Qué aparato de Roland hizo famoso el sonido del acid house?', r: ['303', 'tb-303', 'tb303', 'roland 303'] },
  { p: '¿Cómo se llama pasar de un tema a otro sin que se note?', r: ['mezcla', 'mix', 'mezclar', 'beatmatching'] },
  { p: '¿Qué instrumento toca un DJ con la mano derecha en un plato?', r: ['vinilo', 'disco', 'el vinilo'] },
  { p: '¿En qué década apareció el formato mp3?', r: ['90', 'los 90', 'noventa', '90s'] },
  { p: '¿Qué efecto se usa para que un tema acabe poco a poco?', r: ['fade', 'fade out', 'fundido', 'desvanecer'] },
  { p: '¿Cómo se llama la caja de ritmos más famosa de los 80?', r: ['808', 'tr-808', 'tr808', 'roland 808'] },
  { p: '¿Qué género mezcla música electrónica con jazz?', r: ['jazz house', 'nu jazz', 'acid jazz'] },
  { p: '¿Qué quiere decir que un tema está "en vinilo"?', r: ['que esta en disco', 'que es un disco', 'disco de vinilo', 'que sale en disco'] },
  { p: '¿Qué es un "bootleg" en música electrónica?', r: ['una mezcla no oficial', 'mezcla no oficial', 'remix no oficial', 'una edicion no oficial'] },
  { p: '¿Cuántos canales tiene el sonido estéreo?', r: ['2', 'dos', 'dos canales'] },
  { p: '¿Qué aparato sirve para escuchar sin que suene por los altavoces?', r: ['auriculares', 'cascos', 'auriculares o cascos'] },
  { p: '¿Cómo se llama la persona que pone la música en una sesión?', r: ['dj', 'disc jockey', 'pinchadiscos'] },
];

export default {
  id: 'musicquiz',
  name: 'Trivia musical',
  aliases: ['musicquiz', 'quizmusical', 'triviamusical'],
  help: 'Preguntas de cultura musical. Gana el primero que acierte.',
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
    const norm = (t) => {
      let s = '';
      try { s = api.normalize(String(t == null ? '' : t)); } catch (e) { s = String(t == null ? '' : t).toLowerCase(); }
      return s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const puntos = (u, n) => { try { if (u && n > 0) api.store.addPoints(u, n); } catch (e) { /* da igual */ } };

    let rondas = 6;
    try {
      const pedido = Array.isArray(args) && args.length ? parseInt(String(args[0]), 10) : NaN;
      if (isFinite(pedido) && pedido > 0) rondas = Math.min(pedido, PREGUNTAS.length);
    } catch (e) { rondas = 6; }

    const premio = Number((api.config.games && api.config.games.points && api.config.games.points.win) || 10);
    const usadas = [];
    const marcador = new Map();
    let ronda = 0;
    let actual = null;
    let tiempo = 45;
    let fin = false;

    const elegir = () => {
      const libres = PREGUNTAS.map((_, i) => i).filter((i) => !usadas.includes(i));
      if (!libres.length) return null;
      const idx = libres[Math.floor(Math.random() * libres.length)];
      usadas.push(idx);
      return PREGUNTAS[idx];
    };

    const preguntar = () => {
      ronda += 1;
      if (ronda > rondas) { terminar(); return; }
      actual = elegir();
      if (!actual) { terminar(); return; }
      tiempo = 45;
      safeSay(`❓ Pregunta ${ronda}/${rondas}: ${actual.p} (45 s)`);
    };

    const terminar = () => {
      if (fin) return;
      fin = true;
      const orden = [...marcador.entries()].sort((a, b) => b[1] - a[1]);
      if (!orden.length) {
        safeSay('🏁 Fin de la trivia musical... ¡nadie ha acertado! Otra con !musicquiz 😅');
        return;
      }
      const tabla = orden.slice(0, 5).map(([u, n]) => `${u}: ${n}`).join(' · ');
      safeSayMany([`🏁 Fin de la trivia. Marcador -> ${tabla}`, 'Otra ronda con !musicquiz 🎧']);
    };

    const acertar = (user) => {
      puntos(user, premio);
      marcador.set(user, (marcador.get(user) || 0) + 1);
      safeSay(`✅ ¡${user} acierta! +${premio} puntos.`);
      actual = null;
      if (ronda >= rondas) { terminar(); return; }
      setTimeout(() => { if (!fin) preguntar(); }, 5000);
    };

    safeSayMany([
      `🧠 ¡TRIVIA MUSICAL en #${api.channel}! ${rondas} preguntas.`,
      'Escribe la respuesta en el chat. Gana el primero que acierte 🎧',
    ]);
    setTimeout(() => { if (!fin) preguntar(); }, 3000);

    return {
      onMessage(user, message) {
        try {
          if (fin) return false;
          const texto = String(message || '').trim();
          if (!texto || texto.startsWith('!')) return false;
          if (!actual) return false;

          const esMando = (() => { try { return api.isMod(user); } catch (e) { return false; } })();
          if (esMando && /^(saltar|pasar|siguiente)$/i.test(texto)) {
            safeSay(`⏭️ Pregunta saltada. Era: ${actual.r[0]}.`);
            actual = null;
            setTimeout(() => { if (!fin) preguntar(); }, 3000);
            return true;
          }

          const dicho = norm(texto);
          if (actual.r.some((r) => norm(r) === dicho)) {
            acertar(user);
            return true;
          }
          return false;
        } catch (e) {
          api.logger.error('musicquiz: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin || !actual) return;
          tiempo -= 5;
          if (tiempo <= 0) {
            safeSay(`⏰ Se acabó el tiempo. La respuesta era: ${actual.r[0]}.`);
            actual = null;
            if (ronda >= rondas) terminar();
            else setTimeout(() => { if (!fin) preguntar(); }, 3000);
          }
        } catch (e) {
          api.logger.error('musicquiz: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Trivia musical terminada.';
          return `Trivia musical: pregunta ${ronda}/${rondas} (quedan ~${Math.max(tiempo, 0)}s)`;
        } catch (e) {
          return 'Trivia musical en curso.';
        }
      },

      get finished() { return fin; },
    };
  },
};

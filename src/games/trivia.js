// ============================================================
// trivia.js - Trivia musical/electronica con rondas y tiempo limite
// El primero que acierte se lleva el punto. Respuestas a/b/c/d o texto.
// ESM puro, cero dependencias externas.
// ============================================================

// 44 preguntas. correcta puede ser 'a','b','c','d' o el texto exacto.
const PREGUNTAS = [
  { p: '¿Que genero nacio en Detroit a mediados de los 80?', o: ['Techno', 'Trance', 'Reggaeton', 'Country'], c: 'a' },
  { p: '¿Que genero se asocia a Chicago y al club Warehouse?', o: ['House', 'Dubstep', 'Rock', 'Jazz'], c: 'a' },
  { p: '¿Cuantos BPM tiene normalmente una pista de house?', o: ['60-70', '120-128', '150-160', '180-200'], c: 'b' },
  { p: '¿Que significa BPM?', o: ['Beats Por Minuto', 'Bajos Por Melodia', 'Beat Perfecto Musical', 'Bombo Por Medida'], c: 'a' },
  { p: '¿Como se llama el efecto de eco con retardo?', o: ['Reverb', 'Delay', 'Flanger', 'Chorus'], c: 'b' },
  { p: '¿Que efecto simula un espacio grande como una catedral?', o: ['Reverb', 'Distorsion', 'Bitcrusher', 'Gate'], c: 'a' },
  { p: '¿Que DAW tiene como logo una fruta?', o: ['Ableton Live', 'FL Studio', 'Logic Pro', 'Reaper'], c: 'b' },
  { p: '¿Que empresa fabrica la famosa caja de ritmos TR-909?', o: ['Korg', 'Roland', 'Yamaha', 'Akai'], c: 'b' },
  { p: '¿Que controla un crossfader en un mezclador?', o: ['El tono', 'La mezcla entre dos canales', 'El tempo', 'La ganancia del micro'], c: 'b' },
  { p: '¿Como se llama el auricular que usa el DJ para escuchar la siguiente pista?', o: ['Cue', 'Monitor', 'Sub', 'Booth'], c: 'a' },
  { p: '¿Que significa "beatmatching"?', o: ['Igualar los BPM de dos pistas', 'Subir el volumen', 'Cortar el bajo', 'Grabar la sesión'], c: 'a' },
  { p: '¿En que formato gira un tocadiscos de DJ?', o: ['CD', 'Vinilo', 'Casete', 'MiniDisc'], c: 'b' },
  { p: '¿Que aguja lee los surcos del vinilo?', o: ['La capsula', 'La aguja o stylus', 'El fader', 'El brazo MIDI'], c: 'b' },
  { p: '¿Que es un "loop" en produccion?', o: ['Un fragmento que se repite', 'Un silencio largo', 'Un tipo de micro', 'Una escala'], c: 'a' },
  { p: '¿Que es un "sample"?', o: ['Un trozo de audio reutilizado', 'Un sintetizador analogico', 'Un tipo de cable', 'Una nota fantasma'], c: 'a' },
  { p: '¿Cuantos tiempos suele tener un compas de música dance?', o: ['2', '3', '4', '7'], c: 'c' },
  { p: '¿Que golpe marca el 4x4 en la música electronica?', o: ['La caja', 'El bombo (kick)', 'El charles', 'El clap'], c: 'b' },
  { p: '¿Como se llama el momento de maxima energia de una pista?', o: ['Breakdown', 'Drop', 'Intro', 'Outro'], c: 'b' },
  { p: '¿Como se llama la seccion donde se quita el bombo antes del drop?', o: ['Breakdown', 'Solo', 'Puente', 'Loop'], c: 'a' },
  { p: '¿Que son los "subgraves"?', o: ['Frecuencias muy bajas', 'Notas agudas', 'Efectos de reverb', 'Un tipo de pad'], c: 'a' },
  { p: '¿Que aparato conecta un teclado al ordenador sin sonar por si solo?', o: ['Controlador MIDI', 'Amplificador', 'Mesa de luces', 'DAC'], c: 'a' },
  { p: '¿Que significa MIDI?', o: ['Musical Instrument Digital Interface', 'Multi Input Digital Audio', 'Music Internal Data', 'Master Input Device'], c: 'a' },
  { p: '¿Que hace un ecualizador?', o: ['Ajusta graves, medios y agudos', 'Cambia el tempo', 'Graba la voz', 'Crea loops'], c: 'a' },
  { p: '¿Que genera la onda en un sintetizador?', o: ['El filtro', 'El oscilador', 'La envolvente', 'El LFO'], c: 'b' },
  { p: '¿Que parametros forman una envolvente ADSR?', o: ['Attack, Decay, Sustain, Release', 'Audio, Delay, Sound, Reverb', 'Amp, Drive, Soft, Ratio', 'Attack, Drive, Sustain, Rate'], c: 'a' },
  { p: '¿Que hace un filtro paso bajo?', o: ['Deja pasar agudos', 'Deja pasar graves y corta agudos', 'Sube el volumen', 'Anade reverb'], c: 'b' },
  { p: '¿Que genero destaca por sus melodias largas y pads hipnoticos?', o: ['Trance', 'Punk', 'Blues', 'Flamenco'], c: 'a' },
  { p: '¿Que DJ es conocido como el rey del trance y pincha en A State of Trance?', o: ['Armin van Buuren', 'Tiesto', 'David Guetta', 'Skrillex'], c: 'a' },
  { p: '¿Que festival neerlandes es el mas famoso de trance?', o: ['Tomorrowland', 'A State of Trance', 'Ultra', 'EDC'], c: 'b' },
  { p: '¿Que significa "DJ"?', o: ['Disc Jockey', 'Digital Jockey', 'Dance Joker', 'Deep Jockey'], c: 'a' },
  { p: '¿Que hace un productor musical?', o: ['Crea y mezcla la música', 'Solo pincha en directo', 'Vende entradas', 'Monta el escenario'], c: 'a' },
  { p: '¿Que es una "sesión" o set de DJ?', o: ['La seleccion y mezcla continua de pistas', 'Un solo tema', 'Una lista de invitados', 'Un tipo de altavoz'], c: 'a' },
  { p: '¿Que herramienta sube el volumen de un canal de forma gradual?', o: ['El fader', 'El jack', 'El pad', 'El secuenciador'], c: 'a' },
  { p: '¿Que es un "pad" en un sintetizador?', o: ['Un sonido sostenido y atmosferico', 'Un tipo de cable', 'Un golpe de bateria', 'Un microfono'], c: 'a' },
  { p: '¿Que significa "acapella"?', o: ['Voz sola sin instrumental', 'Percusion sola', 'Un remix', 'Un silencio'], c: 'a' },
  { p: '¿Que es un "remix"?', o: ['Una nueva version de un tema', 'Una grabacion en directo', 'Un genero', 'Un tipo de reverb'], c: 'a' },
  { p: '¿Que escala tiene siete notas y es la mas usada en música occidental?', o: ['Pentatonica', 'Mayor', 'Cromatica', 'De blues'], c: 'b' },
  { p: '¿Que significa "cue point" en un reproductor de DJ?', o: ['Un punto de entrada guardado', 'El final de la pista', 'El volumen maximo', 'Un efecto'], c: 'a' },
  { p: '¿Que dispositivo permite pinchar sin vinilos fisicos?', o: ['Controlador digital (CDJ)', 'Tocadiscos de 78 rpm', 'Radio AM', 'Amplificador de valvulas'], c: 'a' },
  { p: '¿Que es el "gain" o ganancia?', o: ['El nivel de entrada de la senal', 'El tempo', 'La reverb', 'El tono de la voz'], c: 'a' },
  { p: '¿Que club de Ibiza es mitico en la música electronica?', o: ['Pacha', 'La Catedral', 'El Barrio', 'La Plaza'], c: 'a' },
  { p: '¿Que genero mezcla techno con bajos distorsionados y medios tiempos?', o: ['Hard techno', 'Bossa nova', 'Ska', 'Gospel'], c: 'a' },
  { p: '¿Que significa "drop the beat"?', o: ['Entrar la base ritmica', 'Parar la música', 'Bajar el volumen', 'Cambiar de pista'], c: 'a' },
  { p: '¿Que tipo de microfono usan normalmente los DJ para hablar?', o: ['Dinamico', 'De cinta', 'De carbon', 'Parlante'], c: 'a' },
];

const TIEMPO_PREGUNTA = 25; // segundos por pregunta
const LETRAS = ['a', 'b', 'c', 'd'];

export default {
  id: 'trivia',
  name: 'Trivia',
  aliases: ['trivia', 'pregunta', 'quiz'],
  help: 'Trivia de música electronica: responde a, b, c o d antes de que acabe el tiempo. !trivia 3 para 3 rondas.',
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
          api.logger.warn('trivia: no se pudo enviar el mensaje');
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
        api.logger.warn('trivia: no se pudieron sumar puntos');
      }
    };

    // ---------- Configuración de rondas ----------
    let rondas = 5;
    try {
      const pedido = Array.isArray(args) ? parseInt(String(args[0]), 10) : NaN;
      if (isFinite(pedido) && pedido > 0) rondas = Math.min(pedido, 15);
    } catch (err) {
      rondas = 5;
    }

    // Barajamos las preguntas para que no se repitan en la misma partida.
    const mazo = PREGUNTAS.slice();
    for (let i = mazo.length - 1; i > 0; i -= 1) {
      const j = azar(i + 1);
      const tmp = mazo[i];
      mazo[i] = mazo[j];
      mazo[j] = tmp;
    }

    // ---------- Estado ----------
    let indice = 0;
    let actual = mazo[0];
    let fin = false;
    let respondida = false;
    let tiempoRestante = TIEMPO_PREGUNTA;
    let pistaDada = false;
    const marcador = new Map(); // user -> aciertos
    const ganadoresRondas = [];

    const opcionesTexto = (q) => q.o.map((t, i) => `${LETRAS[i]}) ${t}`).join(' | ');

    const lanzarPregunta = () => {
      respondida = false;
      pistaDada = false;
      tiempoRestante = TIEMPO_PREGUNTA;
      actual = mazo[indice % mazo.length];
      safeSayMany([
        `🎧 Pregunta ${indice + 1}/${rondas}: ${actual.p}`,
        `${opcionesTexto(actual)}`,
        `Tenéis ${TIEMPO_PREGUNTA}s. Responde con la letra o el texto exacto.`,
      ]);
    };

    const finalizar = () => {
      fin = true;
      const orden = [...marcador.entries()].sort((a, b) => b[1] - a[1]);
      if (!orden.length) {
        safeSayMany(['🏁 Trivia terminada... ¡y nadie ha acertado nada! Otra con !trivia 😅']);
        return;
      }
      const tabla = orden.slice(0, 5).map(([u, n]) => `${u}: ${n}`).join(' · ');
      safeSayMany([
        `🏁 Trivia terminada. Marcador final -> ${tabla}`,
        '¡Gracias por jugar! Otra ronda con !trivia 🎵',
      ]);
    };

    const siguiente = () => {
      indice += 1;
      if (indice >= rondas) {
        finalizar();
        return;
      }
      lanzarPregunta();
    };

    const acierta = (user, correctaTexto) => {
      respondida = true;
      const previos = marcador.get(user) || 0;
      marcador.set(user, previos + 1);
      darPuntos(user, 4);
      ganadoresRondas.push(user);
      safeSayMany([
        `✅ ¡Correcto, ${user}! Era ${correctaTexto}. +4 puntos`,
        `Marcador: ${user} lleva ${previos + 1}. Siguiente pregunta en 5 segundos...`,
      ]);
      setTimeout(siguiente, 5000);
    };

    // ---------- Arranque ----------
    safeSayMany([
      `🎵 ¡Trivia de música electronica! ${rondas} rondas, gana el que mas acierte.`,
      'Cada pregunta dura 25 segundos. Responded con a, b, c o d.',
    ]);
    lanzarPregunta();

    const partida = {
      onMessage(user, message) {
        try {
          if (fin || respondida) return false;
          const texto = normalizar(message);
          if (!texto) return false;
          if (String(message).trim().startsWith('!')) return false;

          const correctaTexto = LETRAS.includes(actual.c) ? actual.o[LETRAS.indexOf(actual.c)] : String(actual.c);
          const correctaNorm = normalizar(correctaTexto);

          const esLetra = texto.length === 1 && LETRAS.includes(texto);
          const letraCorrecta = normalizar(actual.c).slice(0, 1);

          // Respuesta por letra
          if (esLetra) {
            if (texto === letraCorrecta) {
              acierta(user, `${LETRAS[LETRAS.indexOf(actual.c)]}) ${correctaTexto}`);
              return true;
            }
            safeSay(`❌ No era la ${texto.toUpperCase()}, ${user}. ¡Sigue intentandolo!`);
            return true;
          }

          // Respuesta por texto completo
          if (texto === correctaNorm) {
            acierta(user, correctaTexto);
            return true;
          }
          return false;
        } catch (err) {
          api.logger.error('trivia: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin || respondida) return;

          tiempoRestante -= 5;

          // Pista a mitad de tiempo: descartamos una opción incorrecta
          if (!pistaDada && tiempoRestante <= 12) {
            pistaDada = true;
            const letraCorrecta = normalizar(actual.c).slice(0, 1);
            const candidatas = LETRAS.map((l, i) => ({ l, i })).filter((x) => x.l !== letraCorrecta);
            if (candidatas.length) {
              const fuera = candidatas[azar(candidatas.length)];
              safeSay(`💡 Pista: la opción ${fuera.l.toUpperCase()}) queda descartada. Quedan unos ${Math.max(tiempoRestante, 0)}s.`);
            }
          }

          if (tiempoRestante <= 0) {
            respondida = true;
            const correctaTexto = LETRAS.includes(actual.c) ? actual.o[LETRAS.indexOf(actual.c)] : String(actual.c);
            safeSayMany([
              `⏰ ¡Se acabo el tiempo! La respuesta era: ${correctaTexto}`,
              'Siguiente pregunta en 5 segundos...',
            ]);
            setTimeout(siguiente, 5000);
          }
        } catch (err) {
          api.logger.error('trivia: error en onTick');
        }
      },

      status() {
        try {
          if (fin) {
            return 'Trivia terminada. Escribe !trivia para jugar otra.';
          }
          return `Trivia ronda ${indice + 1}/${rondas} (quedan ~${Math.max(tiempoRestante, 0)}s): ${actual.p}`;
        } catch (err) {
          return 'Trivia en curso.';
        }
      },

      get finished() {
        return fin;
      },
    };

    return partida;
  },
};

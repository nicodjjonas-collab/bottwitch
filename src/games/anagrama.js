// ============================================================
// anagrama.js - Anagramas musicales para el bot de Twitch
// El bot muestra una palabra desordenada y el chat adivina la original.
// Varias rondas, pistas y puntos. ESM puro, cero dependencias.
// ============================================================

// 34 palabras con su pista. Todas tematica musical/electronica.
const PALABRAS = [
  { palabra: 'trance', pista: 'Genero hipnotico de melodias largas' },
  { palabra: 'techno', pista: 'Genero nacido en Detroit' },
  { palabra: 'house', pista: 'Genero de Chicago, 4x4' },
  { palabra: 'sintetizador', pista: 'Instrumento con osciladores y filtros' },
  { palabra: 'mezclador', pista: 'Mesa con faders' },
  { palabra: 'auriculares', pista: 'Se ponen en las orejas para el cue' },
  { palabra: 'vinilo', pista: 'Disco negro que gira' },
  { palabra: 'plato', pista: 'Base giratoria del tocadiscos' },
  { palabra: 'crossfader', pista: 'Fader horizontal del mezclador' },
  { palabra: 'fader', pista: 'Deslizador de volumen' },
  { palabra: 'melodia', pista: 'Notas que se tararean' },
  { palabra: 'armonia', pista: 'Notas que suenan bien juntas' },
  { palabra: 'ritmo', pista: 'Organizacion de los golpes' },
  { palabra: 'ecualizador', pista: 'Graves, medios y agudos' },
  { palabra: 'reverb', pista: 'Efecto de espacio amplio' },
  { palabra: 'delay', pista: 'Eco con retardo' },
  { palabra: 'filtro', pista: 'Recorta frecuencias' },
  { palabra: 'bombo', pista: 'Golpe grave del 4x4' },
  { palabra: 'charles', pista: 'Platillo corto de los offbeats' },
  { palabra: 'secuenciador', pista: 'Programa notas en patrones' },
  { palabra: 'patron', pista: 'Combinacion de pasos' },
  { palabra: 'controlador', pista: 'Teclado MIDI que no suena solo' },
  { palabra: 'oscilador', pista: 'Genera la onda en el sinte' },
  { palabra: 'subgraves', pista: 'Frecuencias muy bajas' },
  { palabra: 'beatmatching', pista: 'Igualar los BPM de dos pistas' },
  { palabra: 'breakdown', pista: 'Seccion sin bombo antes del drop' },
  { palabra: 'cabina', pista: 'Donde esta el DJ con sus equipos' },
  { palabra: 'festival', pista: 'Evento con muchos escenarios' },
  { palabra: 'productor', pista: 'Crea la música en el estudio' },
  { palabra: 'sampler', pista: 'Maquina que dispara samples' },
  { palabra: 'amplificador', pista: 'Da potencia a las cajas' },
  { palabra: 'tornamesa', pista: 'Otro nombre del tocadiscos de DJ' },
  { palabra: 'modulacion', pista: 'Movimiento del sonido en el tiempo' },
  { palabra: 'reproductor', pista: 'Reproduce la pista en el estudio' },
];

const RONDAS_POR_DEFECTO = 3;
const TIEMPO_RONDA = 45; // segundos por anagrama

export default {
  id: 'anagrama',
  name: 'Anagrama',
  aliases: ['anagrama', 'scramble', 'desordenada'],
  help: 'Adivina la palabra musical escondida en las letras desordenadas. !anagrama 5 para 5 rondas.',
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
          api.logger.warn('anagrama: no se pudo enviar el mensaje');
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
        api.logger.warn('anagrama: no se pudieron sumar puntos');
      }
    };

    // ---------- Rondas ----------
    let rondas = RONDAS_POR_DEFECTO;
    try {
      const pedido = Array.isArray(args) ? parseInt(String(args[0]), 10) : NaN;
      if (isFinite(pedido) && pedido > 0) rondas = Math.min(pedido, 10);
    } catch (err) {
      rondas = RONDAS_POR_DEFECTO;
    }

    // Barajamos la lista de palabras para la partida
    const mazo = PALABRAS.slice();
    for (let i = mazo.length - 1; i > 0; i -= 1) {
      const j = azar(i + 1);
      const tmp = mazo[i];
      mazo[i] = mazo[j];
      mazo[j] = tmp;
    }

    // Desordena las letras (intenta que no salga igual que la original).
    const desordenar = (palabra) => {
      const letras = palabra.toUpperCase().split('');
      let salida = letras.join('');
      for (let intento = 0; intento < 10; intento += 1) {
        for (let i = letras.length - 1; i > 0; i -= 1) {
          const j = azar(i + 1);
          const tmp = letras[i];
          letras[i] = letras[j];
          letras[j] = tmp;
        }
        salida = letras.join('');
        if (salida !== palabra.toUpperCase()) break;
      }
      return salida;
    };

    // ---------- Estado ----------
    let indice = 0;
    let actual = mazo[0];
    let desordenada = desordenar(actual.palabra);
    let fin = false;
    let resuelta = false;
    let tiempo = TIEMPO_RONDA;
    let pistaDada = false;
    const marcador = new Map();

    const lanzarRonda = () => {
      actual = mazo[indice % mazo.length];
      desordenada = desordenar(actual.palabra);
      resuelta = false;
      pistaDada = false;
      tiempo = TIEMPO_RONDA;
      safeSayMany([
        `🔀 Anagrama ${indice + 1}/${rondas}: ordena estas letras -> **${desordenada}**`,
        `Pista: ${actual.pista}. Tenéis ${TIEMPO_RONDA}s. Escribid la palabra en el chat.`,
      ]);
    };

    const finalizar = () => {
      fin = true;
      const orden = [...marcador.entries()].sort((a, b) => b[1] - a[1]);
      if (!orden.length) {
        safeSay('🏁 Anagramas terminados y nadie ha acertado... ¡otra vez con !anagrama! 😅');
        return;
      }
      const tabla = orden.slice(0, 5).map(([u, n]) => `${u}: ${n}`).join(' · ');
      safeSayMany([`🏁 Anagramas terminados. Marcador -> ${tabla}`, '¡Buen oido! Otra ronda con !anagrama 🎧']);
    };

    const siguiente = () => {
      indice += 1;
      if (indice >= rondas) {
        finalizar();
        return;
      }
      lanzarRonda();
    };

    const acertar = (user) => {
      resuelta = true;
      const previos = marcador.get(user) || 0;
      marcador.set(user, previos + 1);
      darPuntos(user, 3);
      safeSayMany([
        `✅ ¡Bien, ${user}! Era **${actual.palabra.toUpperCase()}**. +3 puntos`,
        `Llevas ${previos + 1}. Siguiente anagrama en 5 segundos...`,
      ]);
      setTimeout(siguiente, 5000);
    };

    // ---------- Arranque ----------
    safeSayMany([
      `🔀 ¡Anagramas musicales! ${rondas} rondas para el chat.`,
      'Ordena las letras y escribe la palabra original. Gana el que mas acierte.',
    ]);
    lanzarRonda();

    const partida = {
      onMessage(user, message) {
        try {
          if (fin || resuelta) return false;
          const texto = normalizar(message);
          if (!texto) return false;
          if (String(message).trim().startsWith('!')) return false;

          if (texto === normalizar(actual.palabra)) {
            acertar(user);
            return true;
          }

          // Si escribe la palabra desordenada o algo parecido, ignoramos (no consumimos).
          if (texto === normalizar(desordenada)) {
            safeSay(`😄 Eso es lo que ya puse, ${user}. ¡Ordena las letras!`);
            return true;
          }
          return false;
        } catch (err) {
          api.logger.error('anagrama: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (fin || resuelta) return;

          tiempo -= 5;

          // Primera letra revelada a mitad de ronda
          if (!pistaDada && tiempo <= 25) {
            pistaDada = true;
            safeSay(`💡 Pista extra: empieza por "${actual.palabra[0].toUpperCase()}" y tiene ${actual.palabra.length} letras. Quedan ${Math.max(tiempo, 0)}s.`);
          }

          if (tiempo <= 0) {
            resuelta = true;
            safeSayMany([
              `⏰ ¡Tiempo! La palabra era **${actual.palabra.toUpperCase()}**`,
              'Siguiente anagrama en 5 segundos...',
            ]);
            setTimeout(siguiente, 5000);
          }
        } catch (err) {
          api.logger.error('anagrama: error en onTick');
        }
      },

      status() {
        try {
          if (fin) return 'Anagramas terminados. Escribe !anagrama para otra partida.';
          return `Anagrama ${indice + 1}/${rondas} (quedan ~${Math.max(tiempo, 0)}s): ${desordenada} | pista: ${actual.pista}`;
        } catch (err) {
          return 'Anagrama en curso.';
        }
      },

      get finished() {
        return fin;
      },
    };

    return partida;
  },
};

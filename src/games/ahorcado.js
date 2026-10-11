// ============================================================
// ahorcado.js - Juego del ahorcado para el bot de Twitch
// Tematica: música electronica / DJ / trance / FL Studio
// ESM puro, cero dependencias externas.
// ============================================================

// Lista de palabras con su pista. 45 entradas.
const PALABRAS = [
  { palabra: 'trance', pista: 'Genero hipnotico de melodias largas y pads' },
  { palabra: 'techno', pista: 'Genero de Detroit con bombo seco y repetitivo' },
  { palabra: 'house', pista: 'Genero de Chicago en 4x4 con groove' },
  { palabra: 'beat', pista: 'Pulso que marca el ritmo de una pista' },
  { palabra: 'loop', pista: 'Fragmento que se repite sin parar' },
  { palabra: 'sample', pista: 'Trozo de audio reutilizado en una produccion' },
  { palabra: 'sintetizador', pista: 'Instrumento electronico con teclas y osciladores' },
  { palabra: 'mezclador', pista: 'Mesa con faders donde suenan todos los canales' },
  { palabra: 'auriculares', pista: 'Se ponen en la cabeza para escuchar el cue' },
  { palabra: 'vinilo', pista: 'Disco negro que gira bajo la aguja' },
  { palabra: 'aguja', pista: 'Punta que lee los surcos del vinilo' },
  { palabra: 'plato', pista: 'Base giratoria del tocadiscos' },
  { palabra: 'crossfader', pista: 'Fader horizontal que mezcla los dos decks' },
  { palabra: 'fader', pista: 'Deslizador que sube o baja el volumen' },
  { palabra: 'compas', pista: 'Ciclo de cuatro tiempos en la música dance' },
  { palabra: 'melodia', pista: 'Secuencia de notas que se puede tararear' },
  { palabra: 'armonia', pista: 'Notas que suenan a la vez y suenan bien' },
  { palabra: 'ritmo', pista: 'Organizacion de los golpes en el tiempo' },
  { palabra: 'ecualizador', pista: 'Sube graves, medios y agudos' },
  { palabra: 'reverb', pista: 'Efecto de espacio y cola larga' },
  { palabra: 'delay', pista: 'Eco que repite la senal con retardo' },
  { palabra: 'filtro', pista: 'Recorta frecuencias altas o bajas' },
  { palabra: 'bombo', pista: 'Golpe grave que sostiene el 4x4' },
  { palabra: 'caja', pista: 'Golpe seco que cae en el contratiempo' },
  { palabra: 'charles', pista: 'Platillo corto que marca los offbeats' },
  { palabra: 'caja de ritmos', pista: 'Maquina clasica tipo 808 o 909' },
  { palabra: 'secuenciador', pista: 'Programa notas paso a paso en patrones' },
  { palabra: 'patron', pista: 'Combinacion de pasos que forma un groove' },
  { palabra: 'midi', pista: 'Protocolo que conecta teclados y ordenadores' },
  { palabra: 'controlador', pista: 'Teclado o pad que no suena por si solo' },
  { palabra: 'oscilador', pista: 'Corazón del sintetizador que genera la onda' },
  { palabra: 'envolvente', pista: 'ADSR que moldea el ataque y la cola' },
  { palabra: 'subgraves', pista: 'Frecuencias muy bajas que se sienten en el pecho' },
  { palabra: 'bpm', pista: 'Siglas de pulsos por minuto' },
  { palabra: 'beatmatching', pista: 'Alinear los BPM de dos pistas' },
  { palabra: 'cue', pista: 'Punto donde arranca la siguiente pista' },
  { palabra: 'drop', pista: 'Momento en que entra toda la potencia' },
  { palabra: 'breakdown', pista: 'Seccion donde se quita el bombo antes del clímax' },
  { palabra: 'climax', pista: 'Punto mas alto de energia del set' },
  { palabra: 'set', pista: 'Sesión completa de un DJ' },
  { palabra: 'cabina', pista: 'Lugar donde esta el DJ con sus equipos' },
  { palabra: 'festival', pista: 'Evento gigante con muchos escenarios' },
  { palabra: 'pista', pista: 'Canción que suena en la sesión' },
  { palabra: 'productor', pista: 'Persona que crea la música en el estudio' },
  { palabra: 'flstudio', pista: 'DAW con el logo de la fruta, muy usado en trap y house' },
];

// Estados del muneco segun los fallos (0 a 6).
const DIBUJOS = [
  '  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========',
];

const MAX_FALLOS = 6;
const TIEMPO_TOTAL = 180; // segundos antes de rendirse
const TIEMPO_PISTA = 45; // segundos para revelar una letra extra

export default {
  id: 'ahorcado',
  name: 'Ahorcado',
  aliases: ['ahorcado', 'hangman'],
  help: 'Adivina la palabra secreta letra a letra o entera. 6 fallos y se acaba. Pide ayuda con !pista.',
  multiplayer: false,
  minArgs: 0,

  create(api) {
    // --- Utilidades defensivas: nada debe romper el juego ---
    const safeRandom = (n) => {
      try {
        const v = api.random(n);
        if (typeof v === 'number' && isFinite(v) && v >= 0 && v < n) return v;
      } catch (err) {
        // seguimos con Math.random
      }
      return Math.floor(Math.random() * n);
    };

    // Nunca enviamos cadenas vacias ni solo espacios (Twitch lo mostraria en blanco).
    const textosValidos = (lineas) => {
      const lista = Array.isArray(lineas) ? lineas : [lineas];
      return lista
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t.length > 0)
        .slice(0, 4);
    };

    const safeSay = (texto) => {
      const limpio = typeof texto === 'string' ? texto.trim() : '';
      if (!limpio) return;
      try {
        api.say(limpio);
      } catch (err) {
        try {
          api.logger.warn('ahorcado: no se pudo enviar el mensaje');
        } catch (err2) {
          // sin logger disponible: no hacemos nada
        }
      }
    };

    const safeSayMany = (lineas) => {
      const limpio = textosValidos(lineas);
      if (!limpio.length) return;
      try {
        if (typeof api.sayMany === 'function') {
          api.sayMany(limpio);
          return;
        }
      } catch (err) {
        // caemos al envio uno a uno
      }
      limpio.forEach(safeSay);
    };

    const normalizar = (texto) => {
      try {
        return api.normalize(String(texto == null ? '' : texto)).trim();
      } catch (err) {
        return String(texto == null ? '' : texto).toLowerCase().trim();
      }
    };

    const puntos = (user, n) => {
      try {
        if (n > 0) api.store.addPoints(user, n);
      } catch (err) {
        api.logger.warn('ahorcado: no se pudieron sumar puntos');
      }
    };

    // --- Elegimos palabra y preparamos la partida ---
    let elegida = PALABRAS[0];
    try {
      elegida = api.pick(PALABRAS) || PALABRAS[safeRandom(PALABRAS.length)];
    } catch (err) {
      elegida = PALABRAS[safeRandom(PALABRAS.length)];
    }

    const secreta = normalizar(elegida.palabra);
    const pista = elegida.pista;

    const acertadas = new Set(); // letras ya dichas
    const falladas = []; // letras falladas, en orden
    const usuariosQueIntentaron = new Set();
    const inicio = Date.now();
    let ultimaPistaEn = inicio;
    let avisoPistaDado = false;
    let terminado = false;
    let pistasPedidas = 0; // maximo 3 pistas manuales por partida
    const MAX_PISTAS = 3;

    // Palabras que el chat puede escribir para pedir una pista (sin el prefijo !).
    const ATAJOS_PISTA = ['pista', 'ayuda', 'hint', 'dame pista', 'dame una pista', '?'];

    const esPedirPista = (texto) => ATAJOS_PISTA.includes(String(texto).replace(/^!+/, '').trim());

    const dibujar = () => {
      const letras = secreta.split('');
      const visible = letras.map((car) => (car === ' ' ? '/' : acertadas.has(car) ? car : '_')).join(' ');
      return visible.toUpperCase();
    };

    const acertoTodas = () => [...new Set(secreta.split('').filter((c) => c >= 'a' && c <= 'z'))].every((c) => acertadas.has(c));

    const estado = () => `${dibujar()} | fallos ${falladas.length}/${MAX_FALLOS}${falladas.length ? ` (${falladas.join(', ')})` : ''}`;

    const terminar = (mensajes) => {
      terminado = true;
      safeSayMany(mensajes);
    };

    const partida = {
      // Se llama con CADA mensaje del chat mientras la partida vive.
      onMessage(user, message) {
        try {
          if (terminado) return false;

          const texto = normalizar(message);
          if (!texto) return false;

          // Peticion de pista: vale con !pista, pista, ayuda, hint, dame pista o "?".
          // No cuenta como fallo ni como intento de palabra.
          if (esPedirPista(texto)) {
            darPista(user);
            return true;
          }

          // Ignoramos el resto de comandos (empiezan por !) para no pisar al gestor.
          if (String(message).trim().startsWith('!')) {
            return false;
          }

          usuariosQueIntentaron.add(user);

          // Palabra completa (o varias palabras con espacios)
          if (texto.length > 1) {
            if (texto === secreta) {
              puntos(user, 10);
              terminar([
                `🎉 ¡${user} ha acertado la palabra! Era **${elegida.palabra.toUpperCase()}**`,
                `Pista que teniais: ${pista}. ¡+10 puntos para ${user}! Escribid !ahorcado para otra ronda.`,
              ]);
              return true;
            }
            if (secreta.includes(' ') && texto.replace(/\s+/g, ' ') === secreta) {
              puntos(user, 10);
              terminar([
                `🎉 ¡${user} la ha clavado! Era **${elegida.palabra.toUpperCase()}**`,
                `¡+10 puntos! Otra ronda con !ahorcado`,
              ]);
              return true;
            }
            if (texto.length >= 3 && texto.length <= 20 && /^[a-z ]+$/.test(texto)) {
              safeSay(`❌ "${texto.toUpperCase()}" no es la palabra, ${user}. Seguid probando 😉`);
              return true;
            }
            return false;
          }

          // Letra suelta
          const letra = texto;
          if (!/^[a-zñ]$/.test(letra)) return false;
          if (acertadas.has(letra) || falladas.includes(letra)) {
            safeSay(`🤔 La letra "${letra.toUpperCase()}" ya se ha dicho, ${user}.`);
            return true;
          }

          if (secreta.includes(letra)) {
            acertadas.add(letra);
            if (acertoTodas()) {
              puntos(user, 8);
              terminar([
                `🎉 ¡${user} ha completado la palabra **${elegida.palabra.toUpperCase()}**!`,
                `¡+8 puntos! Escribid !ahorcado para jugar otra ronda 🎧`,
              ]);
              return true;
            }
            puntos(user, 1);
            safeManyEstado(`✅ ¡Bien, ${user}! La "${letra.toUpperCase()}" esta en la palabra.`);
            return true;
          }

          falladas.push(letra);
          if (falladas.length >= MAX_FALLOS) {
            terminar([
              '💀 ¡Se acabaron los fallos! El muneco ha caido.',
              `La palabra era **${elegida.palabra.toUpperCase()}** (pista: ${pista}). Otra con !ahorcado`,
            ]);
            return true;
          }
          safeManyEstado(`❌ La "${letra.toUpperCase()}" no esta. Fallos ${falladas.length}/${MAX_FALLOS}.`);
          return true;
        } catch (err) {
          api.logger.error('ahorcado: error en onMessage');
          return false;
        }
      },

      onTick() {
        try {
          if (terminado) return;

          // Pista automatica si nadie acierta nada durante un rato
          if (!avisoPistaDado && Date.now() - ultimaPistaEn >= TIEMPO_PISTA * 1000) {
            avisoPistaDado = true;
            const ocultas = [...new Set(secreta.split(''))].filter((c) => c >= 'a' && c <= 'z' && !acertadas.has(c));
            if (ocultas.length > 2) {
              const revelada = ocultas[safeRandom(ocultas.length)];
              acertadas.add(revelada);
              if (acertoTodas()) {
                terminar([`🎁 Pista automatica y... ¡la palabra era **${elegida.palabra.toUpperCase()}**! Nadie se lleva puntos. !ahorcado para reintentar`]);
                return;
              }
              safeSay(`💡 Pista: os regalo la letra "${revelada.toUpperCase()}". Palabra: ${dibujar()}`);
            }
            ultimaPistaEn = Date.now();
          }

          if (Date.now() - inicio >= TIEMPO_TOTAL * 1000) {
            terminar([
              '⏰ Se acabo el tiempo del ahorcado.',
              `La palabra secreta era **${elegida.palabra.toUpperCase()}** (pista: ${pista}). !ahorcado para otra ronda`,
            ]);
          }
        } catch (err) {
          api.logger.error('ahorcado: error en onTick');
        }
      },

      status() {
        try {
          if (terminado) return 'Ahorcado terminado. Usa !ahorcado para empezar otra ronda.';
          return `Ahorcado: ${estado()} | pista: ${pista}`;
        } catch (err) {
          return 'Ahorcado en curso.';
        }
      },

      // El gestor lee esta propiedad: refleja si la partida ha terminado.
      get finished() {
        return terminado;
      },
    };

    // Envia el estado de la partida sin saturar el chat (2 mensajes max).
    function safeManyEstado(primeraLinea) {
      const restante = MAX_FALLOS - falladas.length;
      if (falladas.length >= 4 && !terminado) {
        const plural = restante === 1 ? 'os queda 1 fallo' : `os quedan ${restante} fallos`;
        safeSayMany([primeraLinea, `🎵 ${dibujar()} | ${plural}`]);
        return;
      }
      safeSay(`${primeraLinea} ${dibujar()}`);
    }

    // Muestra una pista: como maximo 3 por partida. No cuenta como fallo.
    function darPista(user) {
      if (terminado) return;

      if (pistasPedidas >= MAX_PISTAS) {
        safeSay(`🚫 ${user}, ya hemos gastado las ${MAX_PISTAS} pistas de esta ronda. Palabra: ${dibujar()} ¡Ya casi la tenéis!`);
        return;
      }

      pistasPedidas += 1;
      ultimaPistaEn = Date.now();
      const restantes = MAX_PISTAS - pistasPedidas;
      const avisoRestantes = restantes === 0
        ? 'Era la última pista 😅'
        : restantes === 1
          ? 'Os queda 1 pista mas.'
          : `Os quedan ${restantes} pistas mas.`;

      // 1a pista: la primera letra (si aun no se sabe). Después, una letra que falte.
      let textoPista;
      const primera = secreta[0] || '';
      if (!acertadas.has(primera)) {
        acertadas.add(primera);
        textoPista = `💡 Empieza por "${primera.toUpperCase()}" y tiene ${secreta.replace(/ /g, '').length} letras.`;
      } else {
        const ocultas = [...new Set(secreta.split(''))].filter((c) => c >= 'a' && c <= 'z' && !acertadas.has(c));
        if (ocultas.length) {
          const revelada = ocultas[safeRandom(ocultas.length)];
          acertadas.add(revelada);
          textoPista = `💡 Os regalo la letra "${revelada.toUpperCase()}".`;
        } else {
          textoPista = `💡 Ya tenéis todas las letras: solo falta ordenarlas. Tenia ${secreta.replace(/ /g, '').length} letras.`;
        }
      }

      if (acertoTodas()) {
        terminar([`🎁 La pista ha completado la palabra: era **${elegida.palabra.toUpperCase()}**. Nadie se lleva puntos esta vez. !ahorcado para otra ronda`]);
        return;
      }

      safeSayMany([
        textoPista,
        `Tema: ${pista}. ${avisoRestantes} Palabra: ${dibujar()}`,
      ]);
    }

    // --- Arranque: mensajes iniciales (3 como maximo) ---
    safeSayMany([
      `🎵 ¡Nueva partida de ahorcado en #${api.channel}! Tema: ${pista}`,
      `Palabra secreta: ${dibujar()} | tenéis ${MAX_FALLOS} fallos y 3 minutos. Escribid letras sueltas o la palabra completa.`,
      'Si os atascais, escribid !pista (o pista, ayuda, hint) para pedir una pista 🎧',
    ]);
    ultimaPistaEn = Date.now();

    return partida;
  },
};

// ============================================================
// _plantilla.js - PLANTILLA COMENTADA PARA CREAR JUEGOS NUEVOS
// ------------------------------------------------------------
// Este archivo es un juego real y funcional: el bot dice un número
// y gana el primero que escriba su DOBLE. Copialo, renombralo y
// cambia la logica para crear tu propio juego.
//
// REGLAS DE ORO de un archivo de juego:
//   1. Un archivo = un juego. Aquí no se importa nada de otros juegos.
//   2. ESM siempre: export default { ... }. Nunca require().
//   3. Cero dependencias externas: solo JavaScript puro.
//   4. Todos los textos visibles en espanol (los acentos, en el texto).
//   5. Nada debe lanzar excepciones: envuelve lo dudoso en try/catch.
//   6. Usa api.sayMany([...]) para agrupar (2-4 mensajes por accion).
//   7. Nada de console.log: usa api.logger.
//   8. Twitch corta a 500 caracteres por mensaje: no mandes tochos.
//
// API DISPONIBLE DENTRO DE create(api):
//   api.say(texto)              -> envia UN mensaje al chat
//   api.sayMany([t1, t2])       -> envia varios con pausa entre ellos
//   api.channel                 -> nombre del canal (string)
//   api.config                  -> objeto de configuración
//                                  (api.config.prefix, api.config.games.*, ...)
//   api.logger                  -> { info(msg), warn(msg), error(msg) }
//   api.store                   -> { getPoints(u), addPoints(u, n),
//                                    getStat(u, k), addStat(u, k, n) }
//   api.random(n)               -> entero aleatorio 0..n-1
//   api.pick(array)             -> elemento aleatorio del array
//   api.normalize(texto)        -> minusculas y sin tildes, para comparar
//   api.isMod(user)             -> true si es moderador del canal
//   api.seconds(n)              -> n * 1000 (comodidad para tiempos)
//
// Lo que DEVUELVE create(api) es LA PARTIDA EN CURSO, con exactamente
// estas 4 cosas: onMessage, onTick, status y finished.
// ============================================================

export default {
  // ------------------------------------------------------------------
  // METADATOS DEL JUEGO
  // ------------------------------------------------------------------
  // id: unico, sin espacios, sin tildes, en minusculas.
  id: 'plantilla',

  // name: lo que ve el usuario en !ayuda / !juegos.
  name: 'El doble (plantilla)',

  // aliases: palabras para invocar el juego SIN el prefijo !.
  // Ejemplos: 'plantilla', 'doble'. Con api.config.prefix '!' seria !doble.
  aliases: ['plantilla', 'doble', 'ejemplo'],

  // help: una sola linea corta explicando como se juega.
  help: 'El bot dice un número y gana el primero que escriba su doble.',

  // multiplayer: true si pueden jugar varias personas a la vez.
  multiplayer: true,

  // minArgs: número minimo de argumentos después del comando.
  // Con 0, el juego funciona igual con "!plantilla" que con "!plantilla 3".
  minArgs: 0,

  // ------------------------------------------------------------------
  // create(api): se llama UNA vez al arrancar la partida.
  // Aquí vive todo el estado: variables locales, listas, contadores...
  // Recibe args (los argumentos escritos tras el comando) como segundo
  // parametro opcional.
  // ------------------------------------------------------------------
  create(api, args) {
    // ==== CAPA DEFENSIVA ============================================
    // Envolvemos las llamadas a la API. Si algo falla, el juego no
    // debe romper el bot ni dejar la partida colgada.
    const safeSay = (texto) => {
      // Si la cadena esta vacia o solo tiene espacios, no la enviamos.
      const limpio = typeof texto === 'string' ? texto.trim() : '';
      if (!limpio) return;
      try {
        api.say(limpio);
      } catch (err) {
        // Si no se puede hablar, al menos dejamos rastro en el log.
        try {
          api.logger.warn('plantilla: no se pudo enviar el mensaje');
        } catch (err2) {
          // Ni logger hay: no hacemos nada mas.
        }
      }
    };

    // sayMany agrupa varios mensajes con pausa entre ellos.
    // Limitamos a 4 y descartamos los vacios para no ensuciar el chat.
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
        // Si sayMany falla, caemos al envio individual.
      }
      lista.forEach(safeSay);
    };

    // normalize() quita tildes y mayusculas: ideal para comparar respuestas.
    const normalizar = (texto) => {
      try {
        return api.normalize(String(texto == null ? '' : texto)).trim();
      } catch (err) {
        return String(texto == null ? '' : texto).toLowerCase().trim();
      }
    };

    // random() con red de seguridad por si la API devolviera algo raro.
    const azar = (n) => {
      try {
        const v = api.random(n);
        if (typeof v === 'number' && isFinite(v) && v >= 0 && v < n) return v;
      } catch (err) {
        // Usamos Math.random como plan B.
      }
      return Math.floor(Math.random() * n);
    };

    // Puntos y estadisticas: siempre dentro de try/catch.
    const darPuntos = (user, n) => {
      try {
        if (user && n > 0) api.store.addPoints(user, n);
      } catch (err) {
        api.logger.warn('plantilla: no se pudieron sumar puntos');
      }
    };

    // ==== CONFIGURACION DESDE ARGUMENTOS ============================
    // Soporta "!plantilla 5" para jugar 5 rondas (por defecto 3).
    let rondas = 3;
    try {
      const pedido = Array.isArray(args) && args.length ? parseInt(String(args[0]), 10) : NaN;
      if (isFinite(pedido) && pedido > 0) rondas = Math.min(pedido, 10);
    } catch (err) {
      rondas = 3;
    }

    // ==== ESTADO DE LA PARTIDA ======================================
    // Estas variables viven en el cierre de create: son privadas del juego.
    let número = azar(9) + 1; // número del 1 al 9 que hay que doblar
    let ronda = 1;
    let fin = false; // se sincroniza con 'finished' mediante un getter
    let tiempo = 30; // segundos para responder en cada ronda
    const marcador = new Map(); // user -> aciertos

    // ==== MENSAJES DE ARRANQUE ======================================
    // 2 mensajes: presentacion y reglas. Nunca un muro de texto.
    safeSayMany([
      `🔢 ¡Nuevo juego en #${api.channel}! Escribe el DOBLE del número que digo.`,
      `Ronda 1/${rondas}: el número es **${número}**. Tenéis ${tiempo}s. ¡Rápido!`,
    ]);

    // ==== FUNCIONES INTERNAS DEL JUEGO ==============================
    const finalizar = () => {
      fin = true;
      const orden = [...marcador.entries()].sort((a, b) => b[1] - a[1]);
      if (!orden.length) {
        safeSay('🏁 Fin de la partida... ¡y nadie ha acertado nada! Otra con !plantilla 😅');
        return;
      }
      const tabla = orden.slice(0, 5).map(([u, n]) => `${u}: ${n}`).join(' · ');
      safeSayMany([`🏁 Fin de la partida. Marcador -> ${tabla}`, 'Otra ronda con !plantilla 🎧']);
    };

    const siguienteRonda = () => {
      ronda += 1;
      if (ronda > rondas) {
        finalizar();
        return;
      }
      número = azar(9) + 1;
      tiempo = 30;
      safeSay(`➡️ Ronda ${ronda}/${rondas}: el número es **${número}**. Tenéis 30s.`);
    };

    const acertar = (user) => {
      darPuntos(user, 2);
      const previos = marcador.get(user) || 0;
      marcador.set(user, previos + 1);
      tiempo = 0; // paramos el contador de esta ronda
      if (ronda >= rondas) {
        safeSayMany([`✅ ¡${user} escribe ${número * 2} y acierta! +2 puntos`, 'Era la última ronda...']);
        finalizar();
        return;
      }
      safeSay(`✅ ¡${user} escribe ${número * 2} y acierta! +2 puntos. Siguiente ronda en 5s...`);
      // setTimeout es JavaScript puro, no hace falta ninguna dependencia.
      setTimeout(siguienteRonda, 5000);
    };

    // ==== OBJETO PARTIDA (EL CONTRATO) ==============================
    const partida = {
      // onMessage: se llama con CADA mensaje del chat mientras la partida viva.
      // Devuelve true si el juego lo consume (el bot no lo trata como comando
      // ni como conversacion normal), false si lo deja pasar.
      onMessage(user, message) {
        try {
          if (fin) return false;

          const texto = normalizar(message);
          if (!texto) return false;

          // No consumimos comandos con ! para no pisar al gestor de comandos.
          if (String(message).trim().startsWith('!')) return false;

          // Solo aceptamos números correctos: el doble exacto.
          if (texto === String(número * 2)) {
            acertar(user);
            return true;
          }

          // Si escribe un número pero no es el doble, avisamos (educado).
          if (/^\d{1,3}$/.test(texto)) {
            safeSay(`❌ ${user}, ${texto} no es el doble de ${número}. ¡Sigue intentandolo!`);
            return true;
          }

          // Cualquier otra cosa la ignoramos: es conversacion normal del chat.
          return false;
        } catch (err) {
          api.logger.error('plantilla: error en onMessage');
          return false;
        }
      },

      // onTick: se llama cada ~5 segundos. Solo si necesitas temporizadores.
      onTick() {
        try {
          if (fin) return;
          tiempo -= 5;
          if (tiempo <= 0) {
            // Se acabo el tiempo de esta ronda: pasamos a la siguiente.
            safeSay(`⏰ ¡Se acabo el tiempo! El doble de ${número} era ${número * 2}.`);
            if (ronda >= rondas) {
              finalizar();
            } else {
              siguienteRonda();
            }
          }
        } catch (err) {
          api.logger.error('plantilla: error en onTick');
        }
      },

      // status: texto corto del estado. Se usa para !estado y recordatorios.
      // Cuida la longitud: nada de parrafos enormes.
      status() {
        try {
          if (fin) return 'Partida de la plantilla terminada. Usa !plantilla para otra.';
          return `El doble: ronda ${ronda}/${rondas}, el número es ${número} y quedan ~${Math.max(tiempo, 0)}s`;
        } catch (err) {
          return 'Partida de la plantilla en curso.';
        }
      },

      // finished: el juego DEBE ponerlo a true cuando termina. Aquí lo
      // exponemos como getter para que siempre refleje la variable 'fin'.
      get finished() {
        return fin;
      },
    };

    return partida;
  },
};

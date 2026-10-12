/* ============================================================================
 * sprites.js  —  Generador de avatares pixel-art para overlay estilo Stream Avatars
 * ----------------------------------------------------------------------------
 * - Script CLASICO (sin import/export). Todo cuelga de window.SA_SPRITES.
 * - Sin dependencias externas ni imagenes: los munecos se dibujan por codigo.
 * - NO toca el DOM al cargarse: `document` solo se usa DENTRO de las funciones.
 *   Asi el archivo se puede cargar en Node para probar la parte determinista.
 * - El mismo nombre de usuario produce SIEMPRE el mismo muneco (hash estable,
 *   sin Math.random()).
 * ==========================================================================*/
(function (raiz) {
  'use strict';

  var ANCHO = 12; // ancho del lienzo de cada fotograma, en pixeles
  var ALTO = 22;  // alto del lienzo de cada fotograma, en pixeles
  var MAX_NIVEL = 20;
  var NOMBRE_ARCHIVO = 'sprites.js';

  /* --------------------------------------------------------------------------
   * 1. HASH DETERMINISTA
   * ------------------------------------------------------------------------*/

  // Hash tipo FNV-1a sobre los puntos de codigo UTF-16 del nombre.
  // Devuelve SIEMPRE un entero sin signo de 32 bits.
  function codigoDeNombre(usuario) {
    var texto;
    try {
      texto = (usuario === undefined || usuario === null) ? '' : String(usuario);
    } catch (e) {
      texto = '';
    }
    var h = 2166136261 >>> 0;
    for (var i = 0; i < texto.length; i++) {
      h = (h ^ texto.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 16777619) >>> 0; // imul evita perdida de bits
    }
    return h >>> 0;
  }

  // Hash "con sal": mismo nombre + misma sal -> mismo entero.
  // Permite elegir varios rasgos con el mismo nombre sin que vayan correlados.
  function hashConSal(codigo, sal) {
    var s = String(sal);
    var h = (codigo ^ 2166136261) >>> 0;
    for (var i = 0; i < s.length; i++) {
      h = (h ^ s.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function elegir(lista, codigo, sal) {
    var h = hashConSal(codigo, sal);
    return lista[h % lista.length];
  }

  /* --------------------------------------------------------------------------
   * 2. PALETAS (5 pieles, 6 pelos, 8 camisetas, 4 pantalones)
   * ------------------------------------------------------------------------*/

  var TONOS_PIEL = [
    { tono: 'claro',     base: '#f7d9be' },
    { tono: 'medio',     base: '#eec096' },
    { tono: 'moreno',    base: '#cf9264' },
    { tono: 'oscuro',    base: '#9c6244' },
    { tono: 'muyOscuro', base: '#6b3f2a' }
  ];

  var COLORES_PELO = ['#2a2320', '#4a2f1d', '#7a5230', '#c8a15a', '#8e2f2f', '#4b4f6b'];
  var COLORES_CAMISETA = ['#e64b4b', '#3d7ee6', '#3fbf70', '#f2b13c', '#9b5de5', '#26b8c9', '#ef6ea8', '#f0f0f0'];
  var COLORES_PANTALON = ['#33456b', '#2f3542', '#5b4636', '#3f5f4a'];
  var COLORES_CALZADO = ['#2b2b2b', '#4a3a2a', '#1f2a38', '#5a2f2f'];
  var COLOR_OJOS = '#20242c';
  var COLOR_GAFAS = '#16181d';
  var COLOR_BRILLO = '#ffffff';

  // Colores fijos que usan las skins (gorros, cascos y disfraces).
  // Son letras libres del mapa: no chocan con H S E M C P B D W.
  var COLOR_SKIN = {
    A: '#3f6fd6', // azul
    G: '#4fae5a', // verde
    K: '#23262d', // negro
    R: '#e0433f', // rojo
    Y: '#f2c14e', // dorado
    V: '#8a5cd6', // violeta
    T: '#8a5a34', // marron
    N: '#e8863c', // naranja
    X: '#c9d1dc', // plata
    Z: '#f7f7fa'  // blanco
  };
  var MOLDES_CALZADO = COLORES_CALZADO; // alias legible

  /* --------------------------------------------------------------------------
   * 3. MAPAS DE PIXELES
   * ------------------------------------------------------------------------
   * Leyenda: H pelo | S piel | E ojo | M boca | C camiseta | P pantalon
   *          B calzado | . transparente
   * Silueta base (12x22). Filas 0-3 libres para el sombrero, el personaje
   * ocupa de la fila 4 a la 21 y los pies quedan en la ultima fila.
   * ----------------------------------------------------------------------*/

  var CUERPO = [
    '....HHHH....',
    '...HHHHHH...',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..HSEssESH..',   // E = ojo (la 's' se pinta como piel)
    '..HSSSSSSH..',
    '...SSMMSS...',   // M = boca
    '....SSSS....',   // cuello
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
    '.SCCCCCCCCS.',   // brazos (S = piel)
    '.SCCCCCCCCS.',
    '.SCCCCCCCCS.',
    '..PPPPPPPP..',
    '..PPPPPPPP..',
    '..PPP..PPP..',
    '..PPP..PPP..',
    '..BBB..BBB..'
  ];

  // Puntos (fila local dentro del mapa, columna) de ojos y boca.
  var OJOS = [[4, 4], [4, 7]];
  var BOCA = [[6, 5], [6, 6]];

  // Estilos de pelo: se pintan en la zona de la cabeza (filas 4-8).
  // Nota: en la fila 3 el pelo "tapa" la frente, como en el cuerpo base.
  var PELO = {
    corto: [
      '....HHHH....',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HSSSSSSH..'
    ],
    // pelo largo: la melena baja por los lados hasta los hombros
    largo: [
      '....HHHH....',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..'
    ],
    // pinchos: puntas triangulares arriba
    pinchos: [
      '...H..H..H..',
      '..HH.HHH.HH.',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HSSSSSSH..'
    ],
    // calvo: sin pelo
    calvo: [],
    // coleta: pelo corto + recogido trasero en columna 11
    coleta: [
      '....HHHH....',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HHHHHHHH..',
      '..HSSSSSSHH.',
      '...SSSSSSHH.',
      '....SSSS.HH.',
      '..CCCCCCCHH.'
    ]
  };

  // Gafas oscuras sobre los ojos.
  var GAFAS = [
    '..DDDDDDDD..',
    '..DD.DD.DD..'
  ];

  // Sombreros (filas 0-3, encima de la cabeza). D = color oscuro del sombrero.
  // Gorra con visera (niveles 3-4)
  var SOMBRERO_GORRA = [
    '....DDDD....',
    '...DDDDDD...',
    '..DDDDDDDDDD'
  ];

  // Auriculares de DJ (niveles 5-6): diadema + dos cascos.
  var SOMBRERO_AURICULARES = [
    '...DDDDDD...',
    '..DD....DD..',
    '..DD....DD..'
  ];

  // Gorro de lana (niveles 7-9): franja clara + pompon.
  var SOMBRERO_GORRO = [
    '.....DD.....',
    '...DDDDDD...',
    '..DDDDDDDD..',
    '..DDDDDDDD..'
  ];

  // Corona dorada (niveles 10-14).
  var SOMBRERO_CORONA = [
    '.W..WW..W...',
    '.WWWWWWWW...',
    '.WWWWWWWW...',
    '..DDDDDD....'
  ];

  // Halo brillante (nivel 15+), se dibuja por encima de la corona.
  var SOMBRERO_HALO = [
    '...WWWWWW...'
  ];

  /* --------------------------------------------------------------------------
   * 4. UTILIDADES DE COLOR Y LIENZO
   * ------------------------------------------------------------------------*/

  function aRgb(hex) {
    var s = String(hex || '').replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return { r: 200, g: 200, b: 200 };
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16)
    };
  }

  function limitar(v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return Math.round(v);
  }

  function aHex(rgb) {
    var s = ((1 << 24) + (limitar(rgb.r) << 16) + (limitar(rgb.g) << 8) + limitar(rgb.b)).toString(16);
    return '#' + s.slice(1);
  }

  // Oscurece (f < 1) o aclara (f > 1) un color.
  function matiz(hex, f) {
    var c = aRgb(hex);
    return aHex({ r: c.r * f, g: c.g * f, b: c.b * f });
  }

  // Crea un lienzo fuera de pantalla. Devuelve null si no hay DOM.
  function crearLienzo(ancho, alto) {
    if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') {
      return null;
    }
    var lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    return lienzo;
  }

  // Tabla de colores por letra del mapa.
  /* --------------------------------------------------------------------------
   * 5-bis. SKINS: disfraces que ELIGE CADA PERSONA con !skin
   * ------------------------------------------------------------------------
   * Cada skin puede cambiar:
   *   nombre    -> como se llama en el chat
   *   sombrero  -> mapa de hasta 4 filas en la cabeza (filas 0-3 del mapa)
   *   cara      -> mapa de 1-2 filas sobre la cara (empieza en la fila 4)
   *   piel      -> color de piel fijo (dragon verde, robot gris, fantasma blanco)
   *   camiseta  -> color de ropa fijo
   * Todos son disfraces genericos (pirata, mago, gato...). No hay personajes
   * con copyright: el dibujo se genera por codigo.
   * ------------------------------------------------------------------------*/
  var SKINS = {
    pirata: {
      nombre: 'Pirata', emoji: '🏴‍☠️',
      sombrero: [
        '...KKKKKK...',
        '..KZKKKKZK..',
        '.KKKKKKKKKK.',
        'KKKKKKKKKKKK'
      ]
    },
    astronauta: {
      nombre: 'Astronauta', emoji: '🚀',
      camiseta: '#dfe6ee',
      sombrero: [
        '..XXXXXXXX..',
        '.XXXXXXXXXX.',
        '.XXAAAAAAXX.',
        '.XXXXXXXXXX.'
      ]
    },
    mago: {
      nombre: 'Mago', emoji: '🧙',
      sombrero: [
        '.....YY.....',
        '....VVVV....',
        '...VVVVVV...',
        '..VVVVVVVV..'
      ]
    },
    vaquero: {
      nombre: 'Vaquero', emoji: '🤠',
      sombrero: [
        '...TTTTTT...',
        '..TTTTTTTT..',
        'TTTTTTTTTTTT',
        '..TT....TT..'
      ]
    },
    ninja: {
      nombre: 'Ninja', emoji: '🥷',
      // La banda va sobre la fila de los ojos, asi que hay que DEJAR LIBRES las
      // columnas 4 y 7 (los ojos): si no, el muñequito se queda sin cara.
      cara: [
        '.KRR.RR.RRK.',
        '..RRRRRRRR..'
      ],
      sombrero: [
        '..KKKKKKKK..',
        '.KKKKKKKKKK.',
        '.KKKKKKKKKK.'
      ]
    },
    caballero: {
      nombre: 'Caballero', emoji: '🛡️',
      sombrero: [
        '.....RR.....',
        '..XXXXXXX...',
        '.XXXXXXXXX..',
        '.XX.KK.XX...'
      ]
    },
    hada: {
      nombre: 'Hada', emoji: '🧚',
      sombrero: [
        '...W..W..W..',
        '..YY.YY.YY..',
        '.YYYYYYYYYY.'
      ]
    },
    dragon: {
      nombre: 'Dragon', emoji: '🐉',
      piel: '#6fbf5a',
      camiseta: '#2f7a3f',
      sombrero: [
        '.G........G.',
        'GG........GG',
        '.G........G.'
      ]
    },
    gato: {
      nombre: 'Gato', emoji: '🐱',
      sombrero: [
        '.H........H.',
        '.HH......HH.',
        '.HHH....HHH.'
      ]
    },
    robot: {
      nombre: 'Robot', emoji: '🤖',
      piel: '#c9d1dc',
      camiseta: '#8f9aa8',
      sombrero: [
        '.....R......',
        '.....X......',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.'
      ]
    },
    vampiro: {
      nombre: 'Vampiro', emoji: '🧛',
      camiseta: '#2a2a35',
      sombrero: [
        '.K........K.',
        'KK........KK',
        'KKK......KKK'
      ]
    },
    zombi: {
      nombre: 'Zombi', emoji: '🧟',
      piel: '#9fbf7a',
      sombrero: [
        '.GG..GG..GG.',
        'GGGG.GG.GGGG',
        '.GGGGGGGGGG.'
      ]
    },
    superheroe: {
      nombre: 'Superheroe', emoji: '🦸',
      camiseta: '#3f6fd6',
      // Antifaz con los huecos de los ojos en las columnas 4 y 7
      cara: [
        '.AAA.AA.AAA.'
      ],
      sombrero: [
        '..RRRRRRRR..',
        '.RRRRRRRRRR.'
      ]
    },
    princesa: {
      nombre: 'Princesa', emoji: '👑',
      camiseta: '#ef6ea8',
      sombrero: [
        '...Y..Y..Y..',
        '..YYYYYYYY..'
      ]
    },
    dj: {
      nombre: 'DJ', emoji: '🎧',
      sombrero: [
        '..KKKKKKKK..',
        '.KKKKKKKKKK.',
        'KX........XK'
      ]
    },
    fantasma: {
      nombre: 'Fantasma', emoji: '👻',
      piel: '#f7f7fa',
      camiseta: '#f7f7fa',
      sombrero: [
        '...ZZZZZZ...',
        '..ZZZZZZZZ..',
        '.ZZZZZZZZZZ.',
        '.ZZZZZZZZZZ.'
      ]
    }
  };

  // Lista de skins disponibles (para el catalogo y los comandos)
  function listarSkins() {
    var salida = [];
    for (var clave in SKINS) {
      if (Object.prototype.hasOwnProperty.call(SKINS, clave)) {
        salida.push({ id: clave, nombre: SKINS[clave].nombre, emoji: SKINS[clave].emoji || '' });
      }
    }
    return salida;
  }

  // Permite anadir skins desde otro archivo (js/skins.js).
  // Asi se pueden crear tantas como quieras sin tocar este archivo.
  function registrarSkins(extra) {
    if (!extra || typeof extra !== 'object') return 0;
    var puestas = 0;
    for (var clave in extra) {
      if (!Object.prototype.hasOwnProperty.call(extra, clave)) continue;
      var def = extra[clave];
      if (!def || typeof def !== 'object') continue;
      var id = String(clave).toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!id) continue;
      if (!def.nombre) def.nombre = id.charAt(0).toUpperCase() + id.slice(1);
      SKINS[id] = def;
      puestas += 1;
    }
    return puestas;
  }

  // Devuelve el nombre "bonito" de una skin o null si no existe
  function nombreSkin(id) {
    if (!id) return null;
    var s = SKINS[String(id).toLowerCase()];
    return s ? s.nombre : null;
  }

  // Aplica los colores fijos de la skin sobre los parametros del usuario
  function aplicarSkin(p, def) {
    if (!def) return p;
    var copia = {};
    for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) copia[k] = p[k]; }
    if (def.piel) copia.colorPiel = def.piel;
    if (def.camiseta) {
      copia.colorCamiseta = def.camiseta;
      copia.colorOscuro = matiz(def.camiseta, 0.42);
      copia.colorAura = matiz(def.camiseta, 1.25);
    }
    return copia;
  }

  function tablaColores(p) {
    var tbl = {
      '.': null,
      'H': p.colorPelo,
      'S': p.colorPiel,
      'E': COLOR_OJOS,
      'M': matiz(p.colorPiel, 0.58),          // boca: tono piel oscurecido
      'C': p.colorCamiseta,
      'P': p.colorPantalon,
      'B': p.calzado,
      'D': p.colorOscuro,                     // contorno / detalles oscuros
      'W': p.colorBrillo                      // dorado / blanco
    };
    tbl.s = p.colorPiel;                      // la 's' del mapa base es piel
    // Colores fijos de las skins (gorros, cascos, mascaras y disfraces)
    for (var clave in COLOR_SKIN) {
      if (Object.prototype.hasOwnProperty.call(COLOR_SKIN, clave)) tbl[clave] = COLOR_SKIN[clave];
    }
    return tbl;
  }

  // Pinta un mapa de cadenas sobre un contexto.
  function pintarMapa(ctx, mapa, tabla, fila0, col0) {
    for (var f = 0; f < mapa.length; f++) {
      var fila = mapa[f];
      for (var c = 0; c < fila.length; c++) {
        var color = tabla[fila[c]];
        if (!color) continue;                 // letra desconocida o transparente
        ctx.fillStyle = color;
        ctx.fillRect(col0 + c, fila0 + f, 1, 1);
      }
    }
  }

  function pintarPuntos(ctx, puntos, color) {
    ctx.fillStyle = color;
    for (var i = 0; i < puntos.length; i++) {
      ctx.fillRect(puntos[i][1], puntos[i][0], 1, 1);
    }
  }

  // Rellena un tramo horizontal dentro de una fila.
  function tramo(fila, colIni, colFin) {
    var out = [];
    for (var c = colIni; c <= colFin; c++) if (c >= 0 && c < fila.length) out.push(fila[c]);
    return out;
  }

  function ponerRango(fila, colIni, colFin, letra) {
    // Proteccion: si la fila no existe en el mapa no hace nada (nunca debe romper).
    if (!fila || typeof fila.length !== 'number') return;
    for (var c = colIni; c <= colFin; c++) {
      if (c >= 0 && c < fila.length) fila[c] = letra;
    }
  }

  // Mueve un tramo de una fila a otra posicion (sin "envolver" el lienzo).
  function desplazarTramo(fila, colIni, colFin, delta) {
    // Proteccion: si la fila no existe en el mapa no hace nada.
    if (!fila || typeof fila.length !== 'number') return fila;
    var trozo = tramo(fila, colIni, colFin);
    ponerRango(fila, colIni, colFin, '.');
    for (var i = 0; i < trozo.length; i++) {
      var c = colIni + delta + i;
      if (c >= 0 && c < fila.length) fila[c] = trozo[i];
    }
    return fila;
  }

  // Copia profunda de un mapa. Acepta tanto mapas de cadenas como mapas que ya
  // estan convertidos en arrays de caracteres (construirMapa devuelve arrays).
  function copiarMapa(mapa) {
    var out = [];
    for (var i = 0; i < mapa.length; i++) {
      var fila = mapa[i];
      if (typeof fila === 'string') out.push(fila.split(''));
      else {
        var copia = [];
        for (var c = 0; c < fila.length; c++) copia.push(fila[c]);
        out.push(copia);
      }
    }
    return out;
  }

  // Contorno oscuro automatico: marca en 'D' los pixeles transparentes que
  // tocan (en cruz) algun pixel opaco. Se calcula sobre el mapa, sin DOM.
  function anadirContorno(mapa) {
    var alto = mapa.length;
    var ancho = mapa[0].length;
    var marcas = [];
    for (var f = 0; f < alto; f++) {
      for (var c = 0; c < ancho; c++) {
        if (mapa[f][c] !== '.') continue;
        var toca = false;
        if (f > 0 && mapa[f - 1][c] !== '.') toca = true;
        if (!toca && f + 1 < alto && mapa[f + 1][c] !== '.') toca = true;
        if (!toca && c > 0 && mapa[f][c - 1] !== '.') toca = true;
        if (!toca && c + 1 < ancho && mapa[f][c + 1] !== '.') toca = true;
        if (toca) marcas.push([f, c]);
      }
    }
    for (var i = 0; i < marcas.length; i++) mapa[marcas[i][0]][marcas[i][1]] = 'D';
    return mapa;
  }

  /* --------------------------------------------------------------------------
   * 5. POSE COMPLETA (cuerpo + pelo + gafas + sombrero + contorno)
   * ------------------------------------------------------------------------*/

  // Devuelve el mapa final de 12x22 ya con contorno.
  function construirMapa(p, nivel, skin) {
    var mapa = copiarMapa(CUERPO);

    // La cara base no lleva ojos ni boca dibujados: se limpian y se pintan
    // al final para que el pelo no los tape.
    var filaOjos = mapa[4];
    filaOjos[4] = 'S';
    filaOjos[7] = 'S';
    var filaBoca = mapa[6];
    filaBoca[5] = 'S';
    filaBoca[6] = 'S';

    // --- Pelo: se dibuja SOLO en la cabeza (filas 4-8) ---
    var estilo = PELO[p.estiloPelo] || PELO.corto;
    for (var f = 0; f < estilo.length; f++) {
      // Los mapas de PELO ya vienen en coordenadas del cuerpo (su fila 0 es la
      // parte de arriba del pelo), asi que se pintan desde la fila 0 y no desde
      // la 4: si no, el pelo tapaba la cara y el torso.
      var destino = f;
      if (destino >= mapa.length) break;
      var fuente = estilo[f];
      for (var c = 0; c < fuente.length && c < ANCHO; c++) {
        if (fuente[c] === 'H') mapa[destino][c] = 'H';
      }
    }

    // --- Cara: ojos y boca ---
    for (var i = 0; i < OJOS.length; i++) mapa[OJOS[i][0]][OJOS[i][1]] = 'E';
    for (var j = 0; j < BOCA.length; j++) mapa[BOCA[j][0]][BOCA[j][1]] = 'M';

    // --- Gafas oscuras ---
    if (p.gafas) {
      for (var g = 0; g < GAFAS.length; g++) {
        var ff = 3 + g;
        for (var cc = 0; cc < GAFAS[g].length; cc++) {
          if (GAFAS[g][cc] === 'D') mapa[ff][cc] = 'D';
        }
      }
    }

    // --- Cara: mascara de la skin (antifaz, banda de ninja...), filas 4-5 ---
    if (skin && skin.cara) {
      for (var mc = 0; mc < skin.cara.length; mc++) {
        var filaM = 4 + mc;
        if (filaM >= mapa.length) break;
        for (var cm = 0; cm < skin.cara[mc].length && cm < ANCHO; cm++) {
          if (skin.cara[mc][cm] !== '.') mapa[filaM][cm] = skin.cara[mc][cm];
        }
      }
    }

    // --- Cuerpo extra de la skin: capas, alas, colas, rayas... (filas 8-17) ---
    // Se pinta encima del torso, asi que solo debe tocar las columnas de los
    // lados (0-1 y 10-11) o pintar detalles sobre la camiseta.
    if (skin && skin.cuerpo) {
      for (var fc = 0; fc < skin.cuerpo.length; fc++) {
        var filaC = 8 + fc;
        if (filaC >= mapa.length) break;
        for (var cc2 = 0; cc2 < skin.cuerpo[fc].length && cc2 < ANCHO; cc2++) {
          if (skin.cuerpo[fc][cc2] !== '.') mapa[filaC][cc2] = skin.cuerpo[fc][cc2];
        }
      }
    }

    // --- Sombrero (filas 0-3): si hay skin elegida manda la skin ---
    var sombrero = null;
    if (skin && skin.sombrero) {
      sombrero = skin.sombrero;                            // disfraz elegido con !skin
    } else if (nivel >= 10) sombrero = SOMBRERO_CORONA;    // 10-14 y 15+
    else if (nivel >= 7) sombrero = SOMBRERO_GORRO;        // 7-9
    else if (nivel >= 5) sombrero = SOMBRERO_AURICULARES;  // 5-6
    else if (nivel >= 3) sombrero = SOMBRERO_GORRA;        // 3-4
    // nivel 1-2: sin sombrero

    if (sombrero) {
      for (var s = 0; s < sombrero.length; s++) {
        if (s >= mapa.length) break;
        for (var cs = 0; cs < sombrero[s].length && cs < ANCHO; cs++) {
          if (sombrero[s][cs] !== '.') mapa[s][cs] = sombrero[s][cs];
        }
      }
    }
    // Halo brillante extra para el nivel 15+
    if (nivel >= 15) {
      for (var hc = 0; hc < SOMBRERO_HALO[0].length && hc < ANCHO; hc++) {
        if (SOMBRERO_HALO[0][hc] === 'W') mapa[0][hc] = 'W';
      }
    }

    return anadirContorno(mapa);
  }

  // Dibuja un mapa ya construido en un lienzo 12x22.
  function renderizar(mapa, p) {
    var lienzo = crearLienzo(ANCHO, ALTO);
    if (!lienzo) return null;
    var ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ANCHO, ALTO);
    // pintarMapa(ctx, mapa, tabla, fila0, col0): primero la FILA y luego la
    // COLUMNA. El mapa tiene 18 filas y el lienzo 22, asi que lo bajamos 4 filas
    // para que los pies queden en la ultima y el muñequito no flote.
    pintarMapa(ctx, mapa, tablaColores(p), ALTO - mapa.length, 0);
    return lienzo;
  }

  /* --------------------------------------------------------------------------
   * 6. POSES DE ANIMACION (reutilizan el mapa final, sin tocar cabeza/hombros)
   * ------------------------------------------------------------------------*/

  var FILAS_BRAZOS = [10, 11, 12];
  // El mapa del cuerpo tiene 18 filas: caderas 13-14, piernas 15-16, calzado 17.
  var FILAS_MUSLOS = [13, 14];
  var FILAS_PIERNAS = [15, 16];
  var FILAS_PIES = [17];

  // Repinta los brazos en una posicion concreta (para el braceo al andar).
  // El torso (columnas 1..10) se restaura a camiseta y luego se anaden los
  // brazos de piel; asi las esquinas nunca se quedan con el color equivocado.
  function colocarBrazos(mapa, izq, der) {
    for (var i = 0; i < FILAS_BRAZOS.length; i++) {
      var fila = mapa[FILAS_BRAZOS[i]];
      // 1) borra cualquier pixel de piel de los brazos y deja el torso limpio
      for (var c = 1; c <= 10; c++) fila[c] = 'C';
      // 2) coloca el brazo izquierdo (pantalla)
      if (izq[1] >= izq[0]) {
        fila[izq[0]] = 'S';
        fila[izq[1]] = 'S';
      }
      // 3) coloca el brazo derecho (pantalla)
      if (der[1] >= der[0]) {
        fila[der[0]] = 'S';
        fila[der[1]] = 'S';
      }
    }
  }

  // Poses de andar: 0 = base, 1 = paso A, 2 = base, 3 = paso B.
  var BRAZOS_QUIETO = { izq: [0, 1], der: [10, 11] };
  var BRAZOS_PASO_A = { izq: [1, 1], der: [10, 10] };
  var BRAZOS_PASO_B = { izq: [0, 1], der: [10, 10] };

  // Construye la lista de mapas de cada estado (siempre la misma estructura).
  function construirPoses(p, nivel, skin) {
    var base = construirMapa(p, nivel, skin);
    var poses = {
      quieto: [],
      andar: [],
      saltar: [],
      bailar: [],
      sentado: []
    };

    var copia;
    var i;

    // --- quieto: 2 fotogramas (respiracion: un pixel de brillo en la camiseta)
    poses.quieto.push(copiarMapa(base));
    copia = copiarMapa(base);
    copia[10][5] = 'W';
    poses.quieto.push(copia);

    // --- andar: 4 fotogramas, cabeza y hombros intactos
    // f0 y f2 = base; f1 adelanta la pierna izquierda; f3 la derecha.
    poses.andar.push(copiarMapa(base));

    copia = copiarMapa(base);
    colocarBrazos(copia, BRAZOS_PASO_A.izq, BRAZOS_PASO_A.der);
    for (i = 0; i < FILAS_MUSLOS.length; i++) {
      desplazarTramo(copia[FILAS_MUSLOS[i]], 2, 4, -1);
      desplazarTramo(copia[FILAS_MUSLOS[i]], 7, 9, 1);
    }
    for (i = 0; i < FILAS_PIERNAS.length; i++) {
      desplazarTramo(copia[FILAS_PIERNAS[i]], 2, 4, -2);
      desplazarTramo(copia[FILAS_PIERNAS[i]], 7, 9, 2);
    }
    for (i = 0; i < FILAS_PIES.length; i++) {
      desplazarTramo(copia[FILAS_PIES[i]], 2, 4, -2);
      desplazarTramo(copia[FILAS_PIES[i]], 7, 9, 1);
    }
    poses.andar.push(copia);

    poses.andar.push(copiarMapa(base));

    copia = copiarMapa(base);
    colocarBrazos(copia, BRAZOS_PASO_B.izq, BRAZOS_PASO_B.der);
    for (i = 0; i < FILAS_MUSLOS.length; i++) {
      desplazarTramo(copia[FILAS_MUSLOS[i]], 2, 4, 1);
      desplazarTramo(copia[FILAS_MUSLOS[i]], 7, 9, -1);
    }
    for (i = 0; i < FILAS_PIERNAS.length; i++) {
      desplazarTramo(copia[FILAS_PIERNAS[i]], 2, 4, 2);
      desplazarTramo(copia[FILAS_PIERNAS[i]], 7, 9, -2);
    }
    for (i = 0; i < FILAS_PIES.length; i++) {
      desplazarTramo(copia[FILAS_PIES[i]], 2, 4, 1);
      desplazarTramo(copia[FILAS_PIES[i]], 7, 9, -2);
    }
    poses.andar.push(copia);

    // --- saltar: 1 fotograma (piernas recogidas, pies hacia dentro)
    copia = copiarMapa(base);
    colocarBrazos(copia, [0, 0], [11, 11]);
    for (i = 0; i < FILAS_PIERNAS.length; i++) {
      desplazarTramo(copia[FILAS_PIERNAS[i]], 2, 4, 2);
      desplazarTramo(copia[FILAS_PIERNAS[i]], 7, 9, -2);
    }
    for (i = 0; i < FILAS_PIES.length; i++) {
      desplazarTramo(copia[FILAS_PIES[i]], 2, 4, 2);
      desplazarTramo(copia[FILAS_PIES[i]], 7, 9, -2);
    }
    poses.saltar.push(copia);

    // --- bailar: 2 fotogramas con los brazos levantados
    copia = copiarMapa(base);
    for (i = 0; i < FILAS_PIERNAS.length; i++) {
      desplazarTramo(copia[FILAS_PIERNAS[i]], 2, 4, -1);
      desplazarTramo(copia[FILAS_PIERNAS[i]], 7, 9, 1);
    }
    for (i = 0; i < FILAS_PIES.length; i++) {
      desplazarTramo(copia[FILAS_PIES[i]], 2, 4, -1);
      desplazarTramo(copia[FILAS_PIES[i]], 7, 9, 1);
    }
    // brazos arriba: dos filas de piel en las columnas 0 y 11
    colocarBrazos(copia, [0, 1], [10, 11]);
    copia[10][0] = 'S';
    copia[9][0] = 'S';
    copia[10][11] = 'S';
    copia[9][11] = 'S';
    poses.bailar.push(copia);

    copia = copiarMapa(base);
    for (i = 0; i < FILAS_PIERNAS.length; i++) {
      desplazarTramo(copia[FILAS_PIERNAS[i]], 2, 4, 1);
      desplazarTramo(copia[FILAS_PIERNAS[i]], 7, 9, -1);
    }
    for (i = 0; i < FILAS_PIES.length; i++) {
      desplazarTramo(copia[FILAS_PIES[i]], 2, 4, 1);
      desplazarTramo(copia[FILAS_PIES[i]], 7, 9, -1);
    }
    colocarBrazos(copia, [0, 1], [10, 11]);
    copia[10][0] = 'S';
    copia[9][0] = 'S';
    copia[10][11] = 'S';
    copia[9][11] = 'S';
    poses.bailar.push(copia);

    // --- sentado: 1 fotograma (piernas recogidas hacia delante) ---
    // El mapa del cuerpo tiene 18 filas, asi que las piernas se dibujan en las
    // filas 16 y 17 (las ultimas), no en las 18-21.
    copia = copiarMapa(base);
    ponerRango(copia[15], 0, 11, '.');
    ponerRango(copia[16], 0, 11, '.');
    ponerRango(copia[17], 0, 11, '.');
    // muslos hacia delante
    ponerRango(copia[16], 2, 9, 'P');
    // espinillas y calzado apoyados al frente
    ponerRango(copia[17], 3, 9, 'B');
    copia[17][3] = 'B';
    colocarBrazos(copia, [0, 1], [10, 11]);
    poses.sentado.push(copia);

    // --- parpadeo: 1 fotograma con los ojos cerrados (le da mucha vida) ---
    poses.parpadeo = [];
    copia = copiarMapa(base);
    for (i = 0; i < OJOS.length; i++) {
      if (copia[OJOS[i][0]]) copia[OJOS[i][0]][OJOS[i][1]] = 'S';
    }
    poses.parpadeo.push(copia);

    // Refresca el contorno de TODAS las poses por si al mover piernas o brazos
    // se ha quedado algun pixel opaco sin borde oscuro.
    var estados = ['quieto', 'andar', 'saltar', 'bailar', 'sentado', 'parpadeo'];
    for (var e = 0; e < estados.length; e++) {
      var lista = poses[estados[e]];
      for (var k = 0; k < lista.length; k++) anadirContorno(lista[k]);
    }

    return poses;
  }

  // Baja `cuantas` filas el bloque de pantalon y calzado (pose sentada).
  function bajarFilas(mapa, desde, cuantas) {
    var alto = mapa.length;
    // De abajo hacia arriba para no pisar datos.
    for (var f = alto - 1; f >= desde; f--) {
      var destino = f + cuantas;
      if (destino >= alto) continue;
      mapa[destino] = mapa[f];
      mapa[f] = rellenarVacio(ANCHO);
    }
    return mapa;
  }

  function rellenarVacio(ancho) {
    var fila = [];
    for (var i = 0; i < ancho; i++) fila.push('.');
    return fila;
  }

  /* --------------------------------------------------------------------------
   * 7. API PUBLICA
   * ------------------------------------------------------------------------*/

  // 1) Parametros visuales deterministas a partir del nombre.
  function parametros(usuario) {
    var codigo = codigoDeNombre(usuario);

    var piel = TONOS_PIEL[hashConSal(codigo, 'piel') % TONOS_PIEL.length];
    var colorPelo = elegir(COLORES_PELO, codigo, 'pelo');
    var colorCamiseta = elegir(COLORES_CAMISETA, codigo, 'camiseta');
    var colorPantalon = elegir(COLORES_PANTALON, codigo, 'pantalon');
    var calzado = elegir(MOLDES_CALZADO, codigo, 'calzado');

    // Estilos posibles: el "genero" solo cambia el pelo por defecto.
    var genero = (hashConSal(codigo, 'genero') % 2 === 0) ? 'a' : 'b';
    var estilos = ['corto', 'largo', 'pinchos', 'calvo', 'coleta'];
    var estiloPelo;
    if (genero === 'a') {
      // pelo por defecto 'a': nunca calvo (mas pelo corto/largo)
      estiloPelo = elegir(['corto', 'corto', 'largo', 'pinchos', 'coleta'], codigo, 'estiloA');
    } else {
      estiloPelo = elegir(estilos, codigo, 'estiloB');
    }
    if (estilos.indexOf(estiloPelo) === -1) estiloPelo = 'corto';
    if (estiloPelo === 'calvo' && genero === 'a') estiloPelo = 'corto';

    var gafas = (hashConSal(codigo, 'gafas') % 10) < 3;

    return {
      semilla: codigo,
      tonoPiel: piel.tono,
      colorPiel: piel.base,
      colorPelo: colorPelo,
      estiloPelo: estiloPelo,
      colorCamiseta: colorCamiseta,
      colorPantalon: colorPantalon,
      gafas: gafas,
      genero: genero,
      // Extras derivados (misma entrada -> mismo objeto, util para el contorno)
      calzado: calzado,
      colorOscuro: matiz(colorCamiseta, 0.42),
      colorBrillo: COLOR_BRILLO,
      colorAura: matiz(colorCamiseta, 1.25)
    };
  }

  // 2) Crea los fotogramas ya dibujados en lienzos fuera de pantalla.
  function crear(usuario, opciones) {
    var p = parametros(usuario);

    var nivel = 1;
    if (opciones && typeof opciones === 'object' && opciones.nivel !== undefined && opciones.nivel !== null) {
      var n = parseInt(opciones.nivel, 10);
      if (!isNaN(n)) nivel = n;
    }
    if (nivel < 1) nivel = 1;
    if (nivel > MAX_NIVEL) nivel = MAX_NIVEL;

    // Skin elegida por la persona (opcional)
    var skinId = null;
    if (opciones && typeof opciones === 'object' && opciones.skin) {
      var pedida = String(opciones.skin).toLowerCase();
      if (SKINS[pedida]) skinId = pedida;
    }
    var def = skinId ? SKINS[skinId] : null;
    var pp = aplicarSkin(p, def);

    var mapa = construirMapa(pp, nivel, def);
    var poses = construirPoses(pp, nivel, def);

    var fotogramas = {
      quieto: [],
      andar: [],
      saltar: [],
      bailar: [],
      sentado: [],
      parpadeo: []
    };
    var estados = ['quieto', 'andar', 'saltar', 'bailar', 'sentado', 'parpadeo'];
    for (var e = 0; e < estados.length; e++) {
      var lista = poses[estados[e]];
      for (var i = 0; i < lista.length; i++) {
        fotogramas[estados[e]].push(renderizar(lista[i], pp));
      }
    }

    return {
      ancho: ANCHO,
      alto: ALTO,
      color: pp.colorCamiseta,
      aura: nivel >= 10,
      nivel: nivel,
      skin: skinId,
      skinNombre: def ? def.nombre : null,
      parametros: pp,
      mapa: mapa,
      fotogramas: fotogramas
    };
  }

  // 3) Modo alternativo con emoji.
  var EMOJIS = ['🦊', '🐼', '🐸', '🐙', '🦉', '🐤', '🐢', '🦄', '🐝', '🐺', '🦁', '🐨', '🐧', '🦖', '🐳', '🦋'];
  var COLORES_EMOJI = ['#f2a33c', '#8e6bd6', '#3fbf70', '#e64b4b', '#26b8c9', '#ef6ea8', '#f2d43c', '#6f7bd6'];

  function crearEmoji(usuario) {
    var codigo = codigoDeNombre(usuario);
    return {
      emoji: EMOJIS[hashConSal(codigo, 'emoji') % EMOJIS.length],
      color: COLORES_EMOJI[hashConSal(codigo, 'colorEmoji') % COLORES_EMOJI.length]
    };
  }

  // 4) Pinta un fotograma escalado y sin suavizado.
  function pintar(ctx, lienzo, x, y, escala, opciones) {
    if (!ctx || !lienzo) return;
    var o = opciones || {};
    var esc = (typeof escala === 'number' && isFinite(escala) && escala > 0) ? escala : 1;
    var alpha = (typeof o.alpha === 'number' && isFinite(o.alpha)) ? o.alpha : 1;
    if (alpha <= 0) return;
    if (alpha > 1) alpha = 1;

    var anchoLienzo = lienzo.width || ANCHO;
    var altoLienzo = lienzo.height || ALTO;
    var anchoEsc = anchoLienzo * esc;
    var altoEsc = altoLienzo * esc;

    ctx.save();
    ctx.imageSmoothingEnabled = false;   // pixel-art nitido
    if (typeof ctx.webkitImageSmoothingEnabled === 'boolean') {
      ctx.webkitImageSmoothingEnabled = false;
    }
    if (typeof ctx.mozImageSmoothingEnabled === 'boolean') {
      ctx.mozImageSmoothingEnabled = false;
    }
    ctx.globalAlpha = alpha;

    // Sombra eliptica bajo los pies (antes de dibujar el muneco).
    if (o.sombra) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        x + anchoEsc / 2,
        y + altoEsc - esc / 2,
        anchoEsc * 0.46,
        Math.max(1, esc * 0.45),
        0, 0, Math.PI * 2
      );
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
      ctx.restore();
    }

    if (o.voltear) {
      ctx.translate(x + anchoEsc, y);
      ctx.scale(-1, 1);
      ctx.drawImage(lienzo, 0, 0, anchoLienzo, altoLienzo, 0, 0, anchoEsc, altoEsc);
    } else {
      ctx.drawImage(lienzo, 0, 0, anchoLienzo, altoLienzo, x, y, anchoEsc, altoEsc);
    }

    ctx.restore();
  }

  // 5) Render HD suave estilo Stream Avatars (vectorial, sin bloques).
  // Dibuja el avatar directamente en el ctx del overlay, con formas
  // redondeadas y sombreado. Mantiene los mismos colores por usuario,
  // niveles y skins, pero sin pixel-art.
  function redondeado(ctx, x, y, w, h, r) {
    try {
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    } catch (e) { /* navegadores viejos */ }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function colorSkinSombrero(def) {
    if (!def || !def.sombrero) return null;
    var cuenta = {};
    for (var i = 0; i < def.sombrero.length; i++) {
      var fila = def.sombrero[i] || '';
      for (var j = 0; j < fila.length; j++) {
        var ch = fila[j];
        if (ch === '.' || ch === 'D') continue;
        cuenta[ch] = (cuenta[ch] || 0) + 1;
      }
    }
    var mejor = null, mejorN = 0;
    for (var k in cuenta) { if (cuenta[k] > mejorN) { mejorN = cuenta[k]; mejor = k; } }
    if (mejor && COLOR_SKIN[mejor]) return COLOR_SKIN[mejor];
    if (def.camiseta && /^#/.test(def.camiseta)) return def.camiseta;
    return '#3f6fd6';
  }

  function dibujarHD(ctx, avatar, xCentro, yPies, escala, opts) {
    if (!ctx || !avatar) return;
    var o = opts || {};
    var esc = (typeof escala === 'number' && isFinite(escala) && escala > 0) ? escala : 4;
    var u = esc; // unidad base: a esc=4 el muñeco mide ~48x88 como antes
    var datos = (avatar.sprites && avatar.sprites.datos) || {};
    var pp = datos.parametros || parametros(avatar.usuario || 'x');
    var nivel = avatar.nivel || datos.nivel || 1;
    var skinId = avatar.skin || datos.skin || null;
    var def = null;
    try { def = skinId && SKINS ? SKINS[String(skinId).toLowerCase()] : null; } catch (e) { def = null; }
    var estado = o.estado || avatar.estado || 'quieto';
    var t = (typeof o.tiempo === 'number') ? o.tiempo : (avatar.animT || 0);
    var moviendose = Math.abs(avatar.vx || 0) > 0.12;
    var bailando = (estado === 'bailar');
    var sentado = (estado === 'sentado');
    var dormido = !!o.dormido;
    var parpadeo = !!o.parpadeo;
    var alpha = (typeof o.alpha === 'number') ? o.alpha : 1;

    var fase = t * 7;
    var balanceo = moviendose ? Math.sin(fase) : 0;
    var bote = 0;
    // Baile al ritmo de la música: por defecto 138 BPM (trance).
    // Se puede cambiar con ?bpm=128 en la URL del overlay.
    var bpm = (o.bpm && isFinite(o.bpm) && o.bpm > 40 && o.bpm < 220) ? o.bpm : 138;
    var pulso = t * (bpm / 60) * Math.PI; // un bote por golpe
    if (bailando) bote = Math.abs(Math.sin(pulso)) * -2.4 * u * 0.28;
    else if (moviendose) bote = Math.abs(Math.sin(fase)) * -0.5 * u * 0.28;
    if (!avatar.enSuelo && avatar.enSuelo !== undefined && estado !== 'sentado') bote += (avatar.vy || 0) * 0.02 * u;

    var agitado = (avatar.agitado || 0) > (o.reloj || 0);
    var temblor = agitado ? Math.sin((o.reloj || 0) * 45) * 0.6 * u * 0.28 : 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    try { ctx.imageSmoothingEnabled = true; } catch (e) {}
    ctx.translate(xCentro + temblor, yPies + bote);
    if (avatar.dir < 0) ctx.scale(-1, 1);

    var piel = pp.colorPiel || '#eec096';
    var pelo = pp.colorPelo || '#2a2320';
    var camiseta = pp.colorCamiseta || '#3d7ee6';
    var pantalon = pp.colorPantalon || '#33456b';
    var zapato = pp.calzado || '#2b2b2b';
    if (def && def.camiseta && /^#/.test(def.camiseta)) camiseta = def.camiseta;
    if (def && def.piel && /^#/.test(def.piel)) piel = def.piel;

    // Proporciones chibi (cabezón estilo arcade): cabeza grande con su propia
    // unidad (uH) y cuerpo pequeño. La altura total sigue siendo ~22u para
    // que colisiones, bocadillos y sombreros no se enteren del cambio.
    var uH = u * 1.23;
    var cyCabeza = -16.9 * u;

    // sombra suave bajo los pies
    ctx.save();
    ctx.globalAlpha = 0.25 * alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 1.2 * u, 4.0 * u, 1.0 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var mult = o.mult || 1;
    // física de dibujo: agachón al aterrizar, estirón al despegar,
    // respiración en parado e inclinación en las curvas (natural)
    var sx = 1, sy = 1;
    var ahoraDib = (typeof o.reloj === 'number') ? o.reloj : 0;
    if (avatar.aplastadoHasta && ahoraDib < avatar.aplastadoHasta) { sx = 1.12; sy = 0.86; }
    else if (avatar.estiradoHasta && ahoraDib < avatar.estiradoHasta && !avatar.enSuelo) { sx = 0.94; sy = 1.08; }
    else if (!moviendose && !bailando && estado === 'quieto') {
      var resp = 1 + 0.015 * Math.sin(t * 2.2);
      sx = 1 / Math.sqrt(resp); sy = resp;
    }
    ctx.scale(mult * sx, mult * sy);
    var lean = Math.max(-0.12, Math.min(0.12, (avatar.vx || 0) * 0.045)) * (avatar.enSuelo ? 1 : 0.5);
    if (lean) ctx.rotate(lean);

    if (sentado || dormido) {
      // ---- sentado: cuerpo compacto ----
      // piernas al frente
      ctx.fillStyle = pantalon;
      redondeado(ctx, -3.8 * u, -3.0 * u, 7.6 * u, 2.2 * u, 1.0 * u); ctx.fill();
      // zapatos
      ctx.fillStyle = zapato;
      redondeado(ctx, -3.6 * u, -1.4 * u, 3.0 * u, 1.4 * u, 0.6 * u); ctx.fill();
      redondeado(ctx, 0.6 * u, -1.4 * u, 3.0 * u, 1.4 * u, 0.6 * u); ctx.fill();
      // torso
      var g1 = ctx.createLinearGradient(0, -9 * u, 0, -2.5 * u);
      g1.addColorStop(0, camiseta); g1.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g1;
      redondeado(ctx, -3.2 * u, -8.8 * u, 6.4 * u, 6.2 * u, 2.2 * u); ctx.fill();
      // brazos apoyados
      ctx.fillStyle = piel;
      redondeado(ctx, -4.3 * u, -7.6 * u, 1.5 * u, 4.4 * u, 0.75 * u); ctx.fill();
      redondeado(ctx, 2.8 * u, -7.6 * u, 1.5 * u, 4.4 * u, 0.75 * u); ctx.fill();
      dibujarCabezaHD(ctx, uH, pp, pelo, piel, nivel, def, skinId, t, true, dormido, 0, -13.4 * u, (avatar.dir || 1));
    } else {
      // ---- de pie / andando / bailando ----
      // extras detrás del cuerpo: capa, alas, cola (propios de cada skin)
      if (skinId) extrasDetrasHD(ctx, u, String(skinId).toLowerCase(), bailando, t);
      var piernaIzq = balanceo * 1.1 * u * 0.28;
      var piernaDer = -balanceo * 1.1 * u * 0.28;
      // Pasos de baile al ritmo: laterales alternos + rebote (como en Stream Avatars)
      var ladoBaile = 0;
      if (bailando) {
        piernaIzq = Math.sin(pulso) * 1.6 * u * 0.28;
        piernaDer = -piernaIzq;
        ladoBaile = Math.sin(pulso * 0.5) * 1.1 * u * 0.28;
      }
      // piernas cortitas (chibi)
      ctx.fillStyle = pantalon;
      redondeado(ctx, -2.6 * u + piernaIzq * 0.3, -5.0 * u, 2.2 * u, 4.2 * u, 1.0 * u); ctx.fill();
      redondeado(ctx, 0.4 * u + piernaDer * 0.3, -5.0 * u, 2.2 * u, 4.2 * u, 1.0 * u); ctx.fill();
      // zapatos
      ctx.fillStyle = zapato;
      ctx.beginPath(); ctx.ellipse(-1.5 * u + piernaIzq * 0.4, -1.0 * u, 1.6 * u, 0.9 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1.5 * u + piernaDer * 0.4, -1.0 * u, 1.6 * u, 0.9 * u, 0, 0, Math.PI * 2); ctx.fill();
      // torso arcade: compacto, sombreado duro, contorno y cinturón
      ctx.fillStyle = camiseta;
      redondeado(ctx, -3.6 * u, -10.6 * u, 7.2 * u, 6.4 * u, 2.4 * u); ctx.fill();
      ctx.save();
      redondeado(ctx, -3.6 * u, -10.6 * u, 7.2 * u, 6.4 * u, 2.4 * u); ctx.clip();
      // sombra dura lateral
      ctx.fillStyle = 'rgba(10,8,25,0.30)';
      ctx.beginPath();
      ctx.moveTo(0.9 * u, -10.6 * u); ctx.lineTo(3.6 * u, -10.6 * u);
      ctx.lineTo(3.6 * u, -4.2 * u); ctx.lineTo(0.2 * u, -4.2 * u);
      ctx.closePath(); ctx.fill();
      // brillo volumétrico 3D en el pecho
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(-1.4 * u, -8.6 * u, 1.1 * u, 2.0 * u, 0.15, 0, Math.PI * 2); ctx.fill();
      // luz de filo
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(1, 0.35 * u);
      ctx.beginPath(); ctx.moveTo(-3.1 * u, -9.9 * u); ctx.lineTo(-3.3 * u, -5.0 * u); ctx.stroke();
      ctx.restore();
      // contorno
      ctx.strokeStyle = '#1a1d24'; ctx.lineWidth = Math.max(1.2, 0.4 * u);
      redondeado(ctx, -3.6 * u, -10.6 * u, 7.2 * u, 6.4 * u, 2.4 * u); ctx.stroke();
      // cinturón con hebilla
      ctx.fillStyle = '#1d1d24';
      redondeado(ctx, -3.6 * u, -6.8 * u, 7.2 * u, 1.5 * u, 0.6 * u); ctx.fill();
      ctx.fillStyle = '#f2c14e';
      redondeado(ctx, -0.8 * u, -6.6 * u, 1.6 * u, 1.1 * u, 0.3 * u); ctx.fill();
      // detalles del disfraz en el cuerpo
      (function () {
        var sk = skinId ? String(skinId).toLowerCase() : '';
        if (sk === 'bailarina') {
          ctx.fillStyle = 'rgba(247,247,250,0.95)';
          ctx.beginPath(); ctx.ellipse(0, -5.4 * u, 4.2 * u, 1.4 * u, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(242,163,192,0.9)';
          ctx.beginPath(); ctx.ellipse(0, -5.6 * u, 3.0 * u, 1.0 * u, 0, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'rapero') {
          ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = Math.max(1, 0.45 * u);
          ctx.beginPath(); ctx.arc(0, -10.0 * u, 1.8 * u, 0.4, Math.PI - 0.4); ctx.stroke();
          ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(0, -7.6 * u, 0.45 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'luchador') {
          ctx.fillStyle = '#f2c14e';
          redondeado(ctx, -3.4 * u, -6.7 * u, 6.8 * u, 1.1 * u, 0.55 * u); ctx.fill();
        } else if (sk === 'fontanero') {
          ctx.fillStyle = '#f2c14e';
          ctx.beginPath(); ctx.arc(-1.2 * u, -8.8 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(1.2 * u, -8.8 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'heroe') {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          redondeado(ctx, -1.0 * u, -10.0 * u, 0.8 * u, 2.6 * u, 0.4 * u); ctx.fill();
          redondeado(ctx, 0.2 * u, -10.0 * u, 0.8 * u, 2.6 * u, 0.4 * u); ctx.fill();
        } else if (sk === 'nieve') {
          ctx.fillStyle = '#23262d';
          [[0, -9.6], [0, -8.0], [0, -6.4]].forEach(function (p) {
            ctx.beginPath(); ctx.arc(p[0] * u, p[1] * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
          });
        } else if (sk === 'rosada') {
          ctx.fillStyle = '#e85a9e';
          ctx.beginPath(); ctx.arc(-0.6 * u, -8.8 * u, 0.7 * u, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(0.6 * u, -8.8 * u, 0.7 * u, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-1.2 * u, -8.4 * u); ctx.lineTo(1.2 * u, -8.4 * u); ctx.lineTo(0, -7.0 * u); ctx.closePath(); ctx.fill();
        } else if (sk === 'hielo') {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(0, -8.4 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, 0.3 * u);
          ctx.beginPath(); ctx.moveTo(-1.1 * u, -8.4 * u); ctx.lineTo(1.1 * u, -8.4 * u); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -9.5 * u); ctx.lineTo(0, -7.3 * u); ctx.stroke();
        } else if (sk === 'piloto' || sk === 'corredor') {
          ctx.fillStyle = '#f4f4f8';
          redondeado(ctx, -0.9 * u, -10.4 * u, 1.8 * u, 5.0 * u, 0.9 * u); ctx.fill();
        } else if (sk === 'pato') {
          // flotador amarillo en la cintura
          ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = Math.max(1.2, 1.0 * u);
          ctx.beginPath(); ctx.ellipse(0, -5.8 * u, 4.2 * u, 1.3 * u, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (sk === 'galleta') {
          ctx.fillStyle = '#c22f24';
          ctx.beginPath(); ctx.arc(-1.0 * u, -9.0 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#3f9e4d';
          ctx.beginPath(); ctx.arc(1.0 * u, -9.0 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f2c14e';
          ctx.beginPath(); ctx.arc(0, -7.4 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'portero') {
          ctx.fillStyle = 'rgba(238,241,246,0.95)';
          redondeado(ctx, -3.6 * u, -10.0 * u, 2.0 * u, 4.6 * u, 0.9 * u); ctx.fill();
          redondeado(ctx, 1.6 * u, -10.0 * u, 2.0 * u, 4.6 * u, 0.9 * u); ctx.fill();
        } else if (sk === 'guay') {
          ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = Math.max(1, 0.4 * u);
          ctx.beginPath(); ctx.arc(0, -9.8 * u, 1.8 * u, 0.4, Math.PI - 0.4); ctx.stroke();
        } else if (sk === 'bot') {
          ctx.fillStyle = '#26b8c9';
          redondeado(ctx, -1.2 * u, -9.2 * u, 2.4 * u, 1.4 * u, 0.6 * u); ctx.fill();
          ctx.fillStyle = '#e0433f';
          ctx.beginPath(); ctx.arc(0, -8.5 * u, 0.32 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'ciber') {
          ctx.strokeStyle = '#4fae5a'; ctx.lineWidth = Math.max(1, 0.35 * u);
          ctx.beginPath(); ctx.moveTo(-2.8 * u, -10.2 * u); ctx.lineTo(-2.8 * u, -5.2 * u); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(2.8 * u, -10.2 * u); ctx.lineTo(2.8 * u, -5.2 * u); ctx.stroke();
          ctx.fillStyle = '#4fae5a';
          ctx.beginPath(); ctx.arc(-2.8 * u, -7.6 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(2.8 * u, -7.6 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'neon') {
          ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = Math.max(1, 0.4 * u);
          ctx.beginPath(); ctx.moveTo(-3.4 * u, -10.2 * u); ctx.lineTo(-3.4 * u, -4.6 * u); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(3.4 * u, -10.2 * u); ctx.lineTo(3.4 * u, -4.6 * u); ctx.stroke();
          ctx.fillStyle = '#bff0ff';
          ctx.beginPath(); ctx.arc(0, -7.4 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'holo') {
          ctx.fillStyle = 'rgba(120,220,245,0.55)';
          ctx.fillRect(-4.4 * u, -9.4 * u, 0.7 * u, 0.7 * u);
          ctx.fillRect(3.9 * u, -6.8 * u, 0.7 * u, 0.7 * u);
          ctx.fillRect(-3.6 * u, -5.2 * u, 0.6 * u, 0.6 * u);
        } else if (sk === 'exo') {
          ctx.fillStyle = '#3d434e';
          redondeado(ctx, -4.4 * u, -10.4 * u, 2.4 * u, 3.4 * u, 1.0 * u); ctx.fill();
          redondeado(ctx, 2.0 * u, -10.4 * u, 2.4 * u, 3.4 * u, 1.0 * u); ctx.fill();
          ctx.fillStyle = '#e0433f';
          ctx.beginPath(); ctx.arc(0, -7.6 * u, 0.6 * u, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffb3ab';
          ctx.beginPath(); ctx.arc(-0.2 * u, -7.8 * u, 0.2 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'centinela') {
          ctx.fillStyle = '#e0433f';
          ctx.beginPath(); ctx.arc(0, -7.4 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
        } else if (sk === 'nova') {
          ctx.fillStyle = '#f2c14e';
          ctx.save(); ctx.translate(0, -7.4 * u);
          ctx.beginPath();
          for (var ni = 0; ni < 5; ni++) {
            var na = -Math.PI / 2 + ni * 2 * Math.PI / 5;
            var na2 = na + Math.PI / 5;
            ctx.lineTo(Math.cos(na) * 1.0 * u, Math.sin(na) * 1.0 * u);
            ctx.lineTo(Math.cos(na2) * 0.45 * u, Math.sin(na2) * 0.45 * u);
          }
          ctx.closePath(); ctx.fill(); ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath(); ctx.arc(-0.2 * u, -7.6 * u, 0.25 * u, 0, Math.PI * 2); ctx.fill();
        }
      })();
      // brazos (en el baile se levantan y alternan con el ritmo)
      var brazoIzq = moviendose ? balanceo * 0.9 : 0;
      var brazoDer = moviendose ? -balanceo * 0.9 : 0;
      var arriba = bailando ? -3.4 * u : 0;
      var abreBrazos = 0;
      if (bailando) {
        brazoIzq = Math.sin(pulso) * 1.6;
        brazoDer = -brazoIzq;
        abreBrazos = Math.abs(Math.cos(pulso * 0.5)) * 1.2 * u * 0.28;
      }
      ctx.fillStyle = piel;
      ctx.save(); ctx.translate(-3.9 * u - abreBrazos, -9.6 * u + arriba * 0.4); ctx.rotate(0.18 + brazoIzq * 0.12 + (bailando ? -0.5 : 0));
      redondeado(ctx, -0.8 * u, 0, 1.6 * u, 4.2 * u + (bailando ? 1.0 * u : 0), 0.8 * u); ctx.fill();
      ctx.fillStyle = '#1d1d24';
      redondeado(ctx, -0.9 * u, 0.1 * u, 1.8 * u, 1.2 * u, 0.6 * u); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(3.9 * u + abreBrazos, -9.6 * u + arriba * 0.4); ctx.rotate(-0.18 + brazoDer * 0.12 + (bailando ? 0.5 : 0));
      redondeado(ctx, -0.8 * u, 0, 1.6 * u, 4.2 * u + (bailando ? 1.0 * u : 0), 0.8 * u); ctx.fill();
      ctx.fillStyle = '#1d1d24';
      redondeado(ctx, -0.9 * u, 0.1 * u, 1.8 * u, 1.2 * u, 0.6 * u); ctx.fill();
      ctx.restore();
      // mangas
      ctx.fillStyle = camiseta;
      ctx.beginPath(); ctx.arc(-3.9 * u, -9.2 * u + arriba * 0.4, 1.05 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.9 * u, -9.2 * u + arriba * 0.4, 1.05 * u, 0, Math.PI * 2); ctx.fill();
      dibujarCabezaHD(ctx, uH, pp, pelo, piel, nivel, def, skinId, t, parpadeo, false, (bailando ? Math.sin(pulso * 0.5) * 0.12 : 0) + ladoBaile * 0.02, cyCabeza, (avatar.dir || 1));
    }
    ctx.restore();
  }

  function dibujarCabezaHD(ctx, u, pp, pelo, piel, nivel, def, skinId, t, parpadeo, dormido, inclinacion, cyCabeza, mirada) {
    var cy = (typeof cyCabeza === 'number' && isFinite(cyCabeza)) ? cyCabeza : -18.6 * u; // centro de la cabeza
    var mir = (typeof mirada === 'number' && isFinite(mirada)) ? Math.max(-1, Math.min(1, mirada)) * 0.35 * u : 0; // pupilas miran al andar
    ctx.save();
    ctx.translate(0, cy);
    if (inclinacion) ctx.rotate(inclinacion);
    // cuello
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    redondeado(ctx, -1.2 * u, 3.4 * u, 2.4 * u, 1.6 * u, 0.6 * u); ctx.fill();
    // cabeza estilo arcade/anime: mandíbula afilada y contorno marcado
    var R = 4.4 * u;
    ctx.fillStyle = piel;
    ctx.beginPath();
    ctx.arc(0, -0.4 * u, R, Math.PI * 0.98, Math.PI * 2.02);
    ctx.lineTo(1.9 * u, 3.4 * u);
    ctx.lineTo(0.9 * u, 4.9 * u);
    ctx.lineTo(-0.9 * u, 4.9 * u);
    ctx.lineTo(-1.9 * u, 3.4 * u);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    // volumen 3D: luz cenital suave sobre la piel
    var vg = ctx.createLinearGradient(0, -5 * u, 0, 5 * u);
    vg.addColorStop(0, 'rgba(255,255,255,0.30)');
    vg.addColorStop(0.45, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(20,8,30,0.18)');
    ctx.fillStyle = vg; ctx.fillRect(-5.5 * u, -5.5 * u, 11 * u, 11 * u);
    // sombreado duro lateral (cel shading, nada de degradados blandos)
    ctx.fillStyle = 'rgba(20,10,40,0.20)';
    ctx.beginPath();
    ctx.moveTo(1.2 * u, -4.8 * u); ctx.lineTo(4.8 * u, -4.8 * u);
    ctx.lineTo(4.8 * u, 5.2 * u); ctx.lineTo(2.2 * u, 5.2 * u);
    ctx.lineTo(1.4 * u, 2.0 * u); ctx.closePath(); ctx.fill();
    // brillo superior seco
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.ellipse(-1.8 * u, -2.6 * u, 1.7 * u, 1.0 * u, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // contorno marcado + filo de neón (estilo 3D futurista)
    ctx.strokeStyle = '#1a1d24'; ctx.lineWidth = Math.max(1.2, 0.4 * u);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(0, -0.4 * u, R, Math.PI * 0.98, Math.PI * 2.02);
    ctx.lineTo(1.9 * u, 3.4 * u);
    ctx.lineTo(0.9 * u, 4.9 * u);
    ctx.lineTo(-0.9 * u, 4.9 * u);
    ctx.lineTo(-1.9 * u, 3.4 * u);
    ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,220,255,0.5)'; ctx.lineWidth = Math.max(1, 0.28 * u);
    ctx.beginPath(); ctx.arc(0, -0.4 * u, R - 0.35 * u, Math.PI * 1.55, Math.PI * 1.95); ctx.stroke();
    // pelo según estilo
    ctx.fillStyle = pelo;
    var estilo = (pp && pp.estiloPelo) || 'corto';
    if (estilo === 'largo') {
      redondeado(ctx, -4.5 * u, -4.6 * u, 9 * u, 5.2 * u, 2.4 * u); ctx.fill();
      redondeado(ctx, -4.7 * u, -1.6 * u, 1.7 * u, 5.4 * u, 0.8 * u); ctx.fill();
      redondeado(ctx, 3 * u, -1.6 * u, 1.7 * u, 5.4 * u, 0.8 * u); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -1.2 * u, 4.1 * u, Math.PI, 0); ctx.fill();
    } else if (estilo === 'pinchos') {
      ctx.beginPath();
      ctx.moveTo(-4.3 * u, -1 * u);
      var px = [-4.3, -2.6, -1.2, 0.4, 1.8, 3.2, 4.3];
      for (var i = 0; i < px.length; i++) { ctx.lineTo((px[i] - 0.7) * u, -4.9 * u); ctx.lineTo((px[i] + 0.7) * u, -2.2 * u); }
      ctx.lineTo(4.3 * u, -1 * u); ctx.lineTo(4.3 * u, -2.6 * u); ctx.lineTo(-4.3 * u, -2.6 * u);
      ctx.closePath(); ctx.fill();
    } else if (estilo === 'coleta') {
      ctx.beginPath(); ctx.arc(0, -1.4 * u, 4.2 * u, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      redondeado(ctx, -4.4 * u, -4.2 * u, 8.8 * u, 2.6 * u, 1.3 * u); ctx.fill();
      ctx.beginPath(); ctx.arc(4.6 * u, 0.6 * u, 1.1 * u, 0, Math.PI * 2); ctx.fill();
      redondeado(ctx, 3.9 * u, -1.4 * u, 1.3 * u, 3.4 * u, 0.6 * u); ctx.fill();
    } else if (estilo === 'calvo') {
      ctx.beginPath(); ctx.arc(-2.2 * u, -2.6 * u, 2.4 * u, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(2.2 * u, -2.6 * u, 2.4 * u, Math.PI, 0); ctx.fill();
    } else {
      // corte con flequillo en picos (anime)
      ctx.beginPath(); ctx.arc(0, -1.1 * u, 4.35 * u, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4.35 * u, -2.6 * u);
      var picos = [-3.4, -2.4, -1.4, -0.4, 0.6, 1.6, 2.6, 3.4];
      for (var pi = 0; pi < picos.length; pi++) {
        ctx.lineTo((picos[pi] - 0.5) * u, -2.6 * u);
        ctx.lineTo(picos[pi] * u, -1.2 * u);
      }
      ctx.lineTo(4.35 * u, -2.6 * u);
      ctx.lineTo(4.35 * u, -4.4 * u); ctx.lineTo(-4.35 * u, -4.4 * u);
      ctx.closePath(); ctx.fill();
    }
    // ojos anime: grandes, con doble brillo y párpado grueso
    var cerrados = parpadeo || dormido;
    ctx.lineCap = 'round';
    if (cerrados) {
      ctx.strokeStyle = '#1a1d24'; ctx.lineWidth = Math.max(1.2, 0.4 * u);
      ctx.beginPath(); ctx.moveTo(-3 * u, 0.5 * u); ctx.lineTo(-0.8 * u, 0.7 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.8 * u, 0.7 * u); ctx.lineTo(3 * u, 0.5 * u); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-1.8 * u, 0.5 * u, 1.35 * u, 1.6 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1.8 * u, 0.5 * u, 1.35 * u, 1.6 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b3a55';
      ctx.beginPath(); ctx.ellipse(-1.7 * u + mir, 0.7 * u, 0.75 * u, 1 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1.9 * u + mir, 0.7 * u, 0.75 * u, 1 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10131a';
      ctx.beginPath(); ctx.arc(-1.7 * u + mir, 0.8 * u, 0.42 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(1.9 * u + mir, 0.8 * u, 0.42 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-1.9 * u + mir, 0.3 * u, 0.3 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(1.7 * u + mir, 0.3 * u, 0.3 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-1.45 * u + mir, 1.05 * u, 0.14 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2.15 * u + mir, 1.05 * u, 0.14 * u, 0, Math.PI * 2); ctx.fill();
      // párpado superior grueso
      ctx.strokeStyle = '#1a1d24'; ctx.lineWidth = Math.max(1.4, 0.5 * u);
      ctx.beginPath(); ctx.ellipse(-1.8 * u, 0.35 * u, 1.4 * u, 1.6 * u, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(1.8 * u, 0.35 * u, 1.4 * u, 1.6 * u, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    // cejas arcade: anguladas, decididas
    ctx.strokeStyle = 'rgba(20,16,12,0.9)'; ctx.lineWidth = Math.max(1.2, 0.42 * u);
    ctx.beginPath(); ctx.moveTo(-3.1 * u, -1.7 * u); ctx.lineTo(-0.9 * u, -1.1 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3.1 * u, -1.7 * u); ctx.lineTo(0.9 * u, -1.1 * u); ctx.stroke();
    // gafas
    if (pp && pp.gafas) {
      ctx.strokeStyle = '#16181d'; ctx.lineWidth = Math.max(1.2, 0.38 * u);
      redondeado(ctx, -3.5 * u, -1.3 * u, 3.1 * u, 2.9 * u, 0.8 * u); ctx.stroke();
      redondeado(ctx, 0.4 * u, -1.3 * u, 3.1 * u, 2.9 * u, 0.8 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.4 * u, 0.1 * u); ctx.lineTo(0.4 * u, 0.1 * u); ctx.stroke();
    }
    // boca: sonrisa de lado arcade
    ctx.strokeStyle = '#4a2020'; ctx.lineWidth = Math.max(1.1, 0.34 * u);
    if (dormido) { ctx.beginPath(); ctx.arc(0.3 * u, 2.4 * u, 0.5 * u, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-1.1 * u, 2.2 * u); ctx.quadraticCurveTo(0.2 * u, 2.9 * u, 1.5 * u, 1.9 * u); ctx.stroke(); }
    // accesorios por nivel
    if (nivel >= 10) {
      // corona dorada
      ctx.fillStyle = '#f2c14e';
      ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = Math.max(1, 0.22 * u);
      ctx.beginPath();
      ctx.moveTo(-3 * u, -4.4 * u); ctx.lineTo(-3 * u, -6.4 * u); ctx.lineTo(-1.5 * u, -5.2 * u);
      ctx.lineTo(0, -7 * u); ctx.lineTo(1.5 * u, -5.2 * u); ctx.lineTo(3 * u, -6.4 * u); ctx.lineTo(3 * u, -4.4 * u);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0433f';
      ctx.beginPath(); ctx.arc(0, -5.5 * u, 0.42 * u, 0, Math.PI * 2); ctx.fill();
    } else if (nivel >= 7) {
      // gorro de lana
      ctx.fillStyle = '#4b4f6b';
      redondeado(ctx, -3.6 * u, -6.6 * u, 7.2 * u, 2.8 * u, 1.3 * u); ctx.fill();
      ctx.fillStyle = '#f0f0f0';
      redondeado(ctx, -3.6 * u, -4.6 * u, 7.2 * u, 1 * u, 0.5 * u); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -6.9 * u, 1 * u, 0, Math.PI * 2); ctx.fill();
    } else if (nivel >= 5) {
      // auriculares DJ
      ctx.strokeStyle = '#23262d'; ctx.lineWidth = Math.max(1.2, 0.55 * u);
      ctx.beginPath(); ctx.arc(0, -1 * u, 4.7 * u, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = '#9b5de5';
      redondeado(ctx, -5.4 * u, -2.2 * u, 1.9 * u, 3.2 * u, 0.9 * u); ctx.fill();
      redondeado(ctx, 3.5 * u, -2.2 * u, 1.9 * u, 3.2 * u, 0.9 * u); ctx.fill();
    } else if (nivel >= 3) {
      // gorra
      ctx.fillStyle = '#e64b4b';
      ctx.beginPath(); ctx.arc(0, -2.6 * u, 4 * u, Math.PI, 0); ctx.fill();
      redondeado(ctx, 0.6 * u, -3.2 * u, 4.4 * u, 1 * u, 0.5 * u); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, -5.6 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
    }
    // skin = disfraz HD propio: cada skin tiene su sombrero, orejas,
    // máscara o accesorio dibujado en vectorial + insignia emoji.
    // Si la skin no tiene dibujo propio, usa su color como gorra.
    if (def || skinId) {
      dibujarSkinHD(ctx, u, skinId ? String(skinId).toLowerCase() : '', def, t, pelo, piel);
      if (def && def.emoji) {
        ctx.font = Math.round(2.6 * u) + 'px "Segoe UI Emoji", system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(def.emoji, 5.4 * u, -3.2 * u);
      }
    }
    ctx.restore();
  }

  // Capa / alas / cola detrás del cuerpo (se llama antes del torso).
  function extrasDetrasHD(ctx, u, skinId, bailando, t) {
    var aleteo = bailando ? Math.sin(t * 7) * 0.5 * u : Math.sin(t * 2) * 0.2 * u;
    ctx.save();
    if (skinId === 'hada' || skinId === 'abeja') {
      // alitas translúcidas
      ctx.fillStyle = skinId === 'abeja' ? 'rgba(180,220,255,0.75)' : 'rgba(230,180,255,0.7)';
      ctx.beginPath(); ctx.ellipse(-4.2 * u, -8.5 * u + aleteo * 0.3, 1.5 * u, 2.4 * u, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4.2 * u, -8.5 * u - aleteo * 0.3, 1.5 * u, 2.4 * u, 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (skinId === 'dragon' || skinId === 'dinosaurio') {
      // alitas de dragón / pinchos
      ctx.fillStyle = skinId === 'dragon' ? '#3f9e4d' : '#5a8e3c';
      ctx.beginPath(); ctx.moveTo(-3.0 * u, -9.5 * u); ctx.lineTo(-6.2 * u, -12 * u + aleteo); ctx.lineTo(-3.6 * u, -5.5 * u); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3.0 * u, -9.5 * u); ctx.lineTo(6.2 * u, -12 * u - aleteo); ctx.lineTo(3.6 * u, -5.5 * u); ctx.closePath(); ctx.fill();
      // cola
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.3 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(2.4 * u, -2.8 * u); ctx.quadraticCurveTo(5.4 * u, -2 * u, 6.0 * u, -4.8 * u + aleteo * 0.4); ctx.stroke();
    } else if (skinId === 'gato' || skinId === 'zorro') {
      // cola de gato/zorro
      ctx.strokeStyle = skinId === 'zorro' ? '#d97b2e' : (skinId === 'gato' ? '#888' : '#aaa');
      ctx.lineWidth = 1.4 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-2.4 * u, -2.8 * u); ctx.quadraticCurveTo(-5.6 * u, -2 * u, -5.2 * u, -5.8 * u + aleteo * 0.5); ctx.stroke();
    } else if (skinId === 'vampiro' || skinId === 'superheroe' || skinId === 'rey' || skinId === 'mago' || skinId === 'caballero') {
      // capa
      var colorCapa = skinId === 'rey' ? '#8e1f2f' : (skinId === 'superheroe' ? '#2050c8' : (skinId === 'mago' ? '#5b2d9e' : '#2a2a35'));
      var ondeo = bailando ? Math.sin(t * 7) * 0.7 * u : 0;
      ctx.fillStyle = colorCapa;
      ctx.beginPath();
      ctx.moveTo(-3.4 * u, -10.2 * u);
      ctx.quadraticCurveTo(-5.0 * u + ondeo, -6 * u, -3.8 * u + ondeo, -2.0 * u);
      ctx.lineTo(3.8 * u + ondeo, -2.0 * u);
      ctx.quadraticCurveTo(5.0 * u + ondeo, -6 * u, 3.4 * u, -10.2 * u);
      ctx.closePath(); ctx.fill();
    } else if (skinId === 'fantasma') {
      // sábana: cuerpo redondeado abajo
      ctx.fillStyle = 'rgba(245,245,250,0.95)';
      redondeado(ctx, -3.7 * u, -10.6 * u, 7.4 * u, 9.8 * u, 3.0 * u); ctx.fill();
    } else if (skinId === 'angel') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(-4.2 * u, -8.5 * u, 1.4 * u, 2.6 * u, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4.2 * u, -8.5 * u, 1.4 * u, 2.6 * u, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Sombreros, orejas, máscaras y caras especiales por skin (en la cabeza).
  function dibujarSkinHD(ctx, u, skinId, def, t, pelo, piel) {
    var cSom = colorSkinSombrero(def);
    ctx.save();
    ctx.lineWidth = Math.max(1, 0.24 * u);
    switch (skinId) {
      case 'pirata':
        ctx.fillStyle = '#1d1d24';
        redondeado(ctx, -4.6 * u, -5.6 * u, 9.2 * u, 2.2 * u, 1 * u); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-4.6 * u, -4.6 * u); ctx.lineTo(-2.6 * u, -7.6 * u); ctx.lineTo(2.6 * u, -7.6 * u); ctx.lineTo(4.6 * u, -4.6 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(0, -6 * u, 0.6 * u, 0, Math.PI * 2); ctx.fill();
        // barba + pendiente
        ctx.fillStyle = 'rgba(60,35,20,0.9)'; redondeado(ctx, -2.4 * u, 2.2 * u, 4.8 * u, 2.2 * u, 1 * u); ctx.fill();
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(-4.5 * u, 0.6 * u, 0.45 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'astronauta':
        ctx.fillStyle = 'rgba(200,230,255,0.35)';
        ctx.beginPath(); ctx.arc(0, -1 * u, 5.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c9d1dc'; ctx.lineWidth = 0.7 * u; ctx.stroke();
        ctx.fillStyle = '#e8edf3'; redondeado(ctx, -5.2 * u, 2.6 * u, 10.4 * u, 1.6 * u, 0.8 * u); ctx.fill();
        break;
      case 'mago':
        ctx.fillStyle = '#5b2d9e';
        ctx.beginPath(); ctx.moveTo(-3.8 * u, -3.6 * u); ctx.lineTo(0, -9.5 * u); ctx.lineTo(3.8 * u, -3.6 * u); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(-3.8 * u, -3.6 * u); ctx.lineTo(3.8 * u, -3.6 * u); ctx.stroke();
        ctx.fillStyle = '#f2c14e';
        [[-1.4, -5.2], [0.8, -6.4], [1.8, -4.6]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * u, p[1] * u, 0.35 * u, 0, Math.PI * 2); ctx.fill(); });
        break;
      case 'vaquero':
        ctx.fillStyle = '#7a5230';
        ctx.beginPath(); ctx.arc(0, -2.8 * u, 3.9 * u, Math.PI, 0); ctx.fill();
        redondeado(ctx, -5.2 * u, -3.4 * u, 10.4 * u, 1.2 * u, 0.6 * u); ctx.fill();
        ctx.fillStyle = '#3a2412'; redondeado(ctx, -3.9 * u, -4.4 * u, 7.8 * u, 1 * u, 0.5 * u); ctx.fill();
        break;
      case 'ninja':
        ctx.fillStyle = '#23262d';
        redondeado(ctx, -4.4 * u, -4.6 * u, 8.8 * u, 3.4 * u, 1.4 * u); ctx.fill();
        ctx.fillStyle = pielBanda(); redondeado(ctx, -4.4 * u, -1.2 * u, 8.8 * u, 1 * u, 0.5 * u); ctx.fill();
        function pielBanda() { return '#23262d'; }
        // solo se ven los ojos: banda sobre la frente
        ctx.strokeStyle = '#e0433f'; ctx.lineWidth = 0.5 * u;
        ctx.beginPath(); ctx.moveTo(-4.4 * u, -3.4 * u); ctx.lineTo(4.4 * u, -3.4 * u); ctx.stroke();
        break;
      case 'caballero':
        ctx.fillStyle = '#aeb9c6';
        ctx.beginPath(); ctx.arc(0, -2.4 * u, 4.3 * u, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.strokeStyle = '#5a636e'; ctx.stroke();
        ctx.fillStyle = '#e0433f';
        redondeado(ctx, -0.6 * u, -8.6 * u, 1.2 * u, 3 * u, 0.6 * u); ctx.fill();
        break;
      case 'hada':
        ctx.fillStyle = '#f2b13c';
        ctx.beginPath(); ctx.arc(-2.4 * u, -5.4 * u, 0.7 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -6 * u, 0.7 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2.4 * u, -5.4 * u, 0.7 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f2b13c'; ctx.beginPath(); ctx.arc(0, -3.4 * u, 4.1 * u, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        break;
      case 'dragon':
        ctx.fillStyle = '#2e7d3a';
        [[-2.8, -4.6, -0.5], [2.8, -4.6, 0.5]].forEach(function (c) {
          ctx.save(); ctx.translate(c[0] * u, c[1] * u); ctx.rotate(c[2]);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.9 * u, -2.2 * u); ctx.lineTo(0.9 * u, -0.6 * u); ctx.closePath(); ctx.fill();
          ctx.restore();
        });
        // hocico
        ctx.fillStyle = '#3f9e4d'; redondeado(ctx, -1.8 * u, 1.2 * u, 3.6 * u, 1.6 * u, 0.8 * u); ctx.fill();
        break;
      case 'gato':
        ctx.fillStyle = '#8a8f9e';
        [[-2.9, 0.5], [2.9, -0.5]].forEach(function (p) {
          ctx.save(); ctx.translate(p[0] * u, -4.4 * u); ctx.rotate(p[1] * 0.3);
          ctx.beginPath(); ctx.moveTo(-1.2 * u, 0.6 * u); ctx.lineTo(0, -2.2 * u); ctx.lineTo(1.2 * u, 0.6 * u); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f5a3b7';
          ctx.beginPath(); ctx.moveTo(-0.55 * u, 0.1 * u); ctx.lineTo(0, -1.1 * u); ctx.lineTo(0.55 * u, 0.1 * u); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#8a8f9e';
          ctx.restore();
        });
        // bigotes
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        [-1, 1].forEach(function (s) {
          ctx.beginPath(); ctx.moveTo(s * 1.6 * u, 1.6 * u); ctx.lineTo(s * 3.6 * u, 1.2 * u); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s * 1.6 * u, 2 * u); ctx.lineTo(s * 3.6 * u, 2.2 * u); ctx.stroke();
        });
        break;
      case 'robot':
        ctx.fillStyle = '#9aa4b2';
        redondeado(ctx, -4.2 * u, -5.2 * u, 8.4 * u, 2 * u, 0.8 * u); ctx.fill();
        ctx.strokeStyle = '#5a636e';
        ctx.beginPath(); ctx.moveTo(0, -5.2 * u); ctx.lineTo(0, -7 * u); ctx.stroke();
        ctx.fillStyle = '#e0433f'; ctx.beginPath(); ctx.arc(0, -7.3 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#26b8c9'; redondeado(ctx, -3.4 * u, 1.6 * u, 6.8 * u, 1 * u, 0.5 * u); ctx.fill();
        break;
      case 'vampiro':
        ctx.fillStyle = '#1d1d24';
        ctx.beginPath(); ctx.moveTo(-4.3 * u, -2 * u); ctx.lineTo(-2 * u, -4.8 * u); ctx.lineTo(0, -2.6 * u); ctx.lineTo(2 * u, -4.8 * u); ctx.lineTo(4.3 * u, -2 * u);
        ctx.lineTo(4.3 * u, -3.6 * u); ctx.lineTo(-4.3 * u, -3.6 * u); ctx.closePath(); ctx.fill();
        // colmillos
        ctx.fillStyle = '#fff';
        [[-0.7], [0.7]].forEach(function (p) { ctx.beginPath(); ctx.moveTo((p[0] - 0.3) * u, 1.9 * u); ctx.lineTo((p[0] + 0.3) * u, 1.9 * u); ctx.lineTo(p[0] * u, 2.8 * u); ctx.closePath(); ctx.fill(); });
        break;
      case 'zombi':
        ctx.fillStyle = '#7fae6a';
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, 4.4 * u, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#3d5a34';
        ctx.beginPath(); ctx.moveTo(-3 * u, -2.8 * u); ctx.lineTo(-1 * u, -1.8 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2.2 * u, 2.2 * u); ctx.lineTo(3.4 * u, 1.4 * u); ctx.stroke();
        break;
      case 'superheroe':
        ctx.fillStyle = '#2050c8';
        redondeado(ctx, -4.4 * u, -1.6 * u, 8.8 * u, 3 * u, 1.3 * u); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-1.7 * u, 0.1 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.7 * u, 0.1 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#10131a';
        ctx.beginPath(); ctx.arc(-1.7 * u, 0.2 * u, 0.25 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.7 * u, 0.2 * u, 0.25 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'princesa':
        ctx.fillStyle = '#f2c14e';
        ctx.strokeStyle = '#8a5a00';
        ctx.beginPath(); ctx.moveTo(-2.6 * u, -4.2 * u); ctx.lineTo(-2.6 * u, -6 * u); ctx.lineTo(-1.3 * u, -5 * u); ctx.lineTo(0, -6.6 * u); ctx.lineTo(1.3 * u, -5 * u); ctx.lineTo(2.6 * u, -6 * u); ctx.lineTo(2.6 * u, -4.2 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        // melena
        ctx.fillStyle = '#c8a15a';
        redondeado(ctx, -4.9 * u, -3.4 * u, 1.6 * u, 6.4 * u, 0.8 * u); ctx.fill();
        redondeado(ctx, 3.3 * u, -3.4 * u, 1.6 * u, 6.4 * u, 0.8 * u); ctx.fill();
        break;
      case 'dj':
        ctx.strokeStyle = '#23262d'; ctx.lineWidth = Math.max(1.2, 0.55 * u);
        ctx.beginPath(); ctx.arc(0, -1 * u, 4.7 * u, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = '#26b8c9';
        redondeado(ctx, -5.4 * u, -2.2 * u, 1.9 * u, 3.2 * u, 0.9 * u); ctx.fill();
        redondeado(ctx, 3.5 * u, -2.2 * u, 1.9 * u, 3.2 * u, 0.9 * u); ctx.fill();
        ctx.fillStyle = 'rgba(20,20,30,0.92)';
        redondeado(ctx, -3.5 * u, -1.3 * u, 3.1 * u, 2.9 * u, 1 * u); ctx.fill();
        redondeado(ctx, 0.4 * u, -1.3 * u, 3.1 * u, 2.9 * u, 1 * u); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, 0.3 * u);
        ctx.beginPath(); ctx.moveTo(-2.9 * u, -0.5 * u); ctx.lineTo(-1.4 * u, -0.5 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1 * u, -0.5 * u); ctx.lineTo(2.5 * u, -0.5 * u); ctx.stroke();
        break;
      case 'fantasma':
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-1.8 * u, 0.4 * u, 1.2 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.8 * u, 0.4 * u, 1.2 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#20242c';
        ctx.beginPath(); ctx.arc(-1.8 * u, 0.5 * u, 0.6 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.8 * u, 0.5 * u, 0.6 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bombero':
        ctx.fillStyle = '#c22f24';
        ctx.beginPath(); ctx.arc(0, -2.8 * u, 4.2 * u, Math.PI, 0); ctx.fill();
        redondeado(ctx, -5 * u, -3.4 * u, 10 * u, 1.1 * u, 0.55 * u); ctx.fill();
        ctx.fillStyle = '#f2c14e'; redondeado(ctx, -1.1 * u, -6.4 * u, 2.2 * u, 2.6 * u, 0.5 * u); ctx.fill();
        break;
      case 'chef':
        ctx.fillStyle = '#f4f4f8';
        redondeado(ctx, -3 * u, -7.6 * u, 6 * u, 4.4 * u, 1.8 * u); ctx.fill();
        ctx.strokeStyle = '#c9cfd8'; ctx.beginPath(); ctx.moveTo(-3 * u, -4.4 * u); ctx.lineTo(3 * u, -4.4 * u); ctx.stroke();
        break;
      case 'medico':
        ctx.strokeStyle = '#9aa4b2'; ctx.lineWidth = 0.5 * u;
        ctx.beginPath(); ctx.arc(0, -3.2 * u, 3.6 * u, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.fillStyle = '#c9d1dc'; ctx.beginPath(); ctx.arc(0, -5.8 * u, 0.9 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0433f'; redondeado(ctx, -0.5 * u, 0.6 * u, 1 * u, 2.6 * u, 0.4 * u); ctx.fill();
        redondeado(ctx, -1.1 * u, 1.3 * u, 2.2 * u, 1 * u, 0.4 * u); ctx.fill();
        break;
      case 'detective':
        ctx.fillStyle = '#5b4636';
        ctx.beginPath(); ctx.arc(0, -2.9 * u, 3.9 * u, Math.PI, 0); ctx.fill();
        redondeado(ctx, -4.8 * u, -3.5 * u, 9.6 * u, 1.1 * u, 0.55 * u); ctx.fill();
        ctx.fillStyle = '#2f3542';
        redondeado(ctx, -3.5 * u, -1.3 * u, 3.1 * u, 2.9 * u, 1 * u); ctx.fill();
        redondeado(ctx, 0.4 * u, -1.3 * u, 3.1 * u, 2.9 * u, 1 * u); ctx.fill();
        break;
      case 'payaso':
        ['#e0433f', '#f2b13c', '#3d7ee6'].forEach(function (c, i) {
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc((-3 + i * 3) * u, -4.6 * u, 1.15 * u, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = '#e0433f'; ctx.beginPath(); ctx.arc(0, 1 * u, 0.75 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'panda':
        ctx.fillStyle = '#23262d';
        ctx.beginPath(); ctx.arc(-3.2 * u, -3.8 * u, 1.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3.2 * u, -3.8 * u, 1.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-1.7 * u, 0.3 * u, 1.15 * u, 1.35 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(1.7 * u, 0.3 * u, 1.15 * u, 1.35 * u, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'abeja':
        ctx.strokeStyle = '#23262d'; ctx.lineWidth = 0.4 * u;
        ctx.beginPath(); ctx.moveTo(-1.4 * u, -4.6 * u); ctx.lineTo(-2.2 * u, -6.6 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1.4 * u, -4.6 * u); ctx.lineTo(2.2 * u, -6.6 * u); ctx.stroke();
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath(); ctx.arc(-2.2 * u, -6.8 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2.2 * u, -6.8 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#23262d'; redondeado(ctx, -3.9 * u, -3.4 * u, 7.8 * u, 0.9 * u, 0.45 * u); ctx.fill();
        break;
      case 'conejo':
        ctx.fillStyle = '#d8dce4';
        redondeado(ctx, -3.4 * u, -8.6 * u, 2.2 * u, 5 * u, 1.1 * u); ctx.fill();
        redondeado(ctx, 1.2 * u, -8.6 * u, 2.2 * u, 5 * u, 1.1 * u); ctx.fill();
        ctx.fillStyle = '#f5a3b7';
        redondeado(ctx, -2.9 * u, -7.6 * u, 1.2 * u, 3.2 * u, 0.6 * u); ctx.fill();
        redondeado(ctx, 1.7 * u, -7.6 * u, 1.2 * u, 3.2 * u, 0.6 * u); ctx.fill();
        break;
      case 'zorro':
        ctx.fillStyle = '#d97b2e';
        [[-2.9, 0.5], [2.9, -0.5]].forEach(function (p) {
          ctx.save(); ctx.translate(p[0] * u, -4.4 * u); ctx.rotate(p[1] * 0.35);
          ctx.beginPath(); ctx.moveTo(-1.3 * u, 0.8 * u); ctx.lineTo(0, -2.4 * u); ctx.lineTo(1.3 * u, 0.8 * u); ctx.closePath(); ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = '#f7e8d8'; redondeado(ctx, -1.6 * u, 1.4 * u, 3.2 * u, 1.4 * u, 0.7 * u); ctx.fill();
        ctx.fillStyle = '#23262d'; ctx.beginPath(); ctx.arc(0, 1.5 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'calavera':
        ctx.fillStyle = 'rgba(240,240,245,0.92)';
        ctx.beginPath(); ctx.arc(0, 0.2 * u, 4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#23262d';
        ctx.beginPath(); ctx.ellipse(-1.7 * u, 0.1 * u, 1 * u, 1.3 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(1.7 * u, 0.1 * u, 1 * u, 1.3 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.5 * u, 2.8 * u); ctx.lineTo(0.5 * u, 2.8 * u); ctx.strokeStyle = '#23262d'; ctx.stroke();
        break;
      case 'alien':
        ctx.fillStyle = '#7fd67f';
        ctx.beginPath(); ctx.ellipse(0, -0.6 * u, 4 * u, 4.8 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1d3a1d';
        ctx.beginPath(); ctx.ellipse(-1.7 * u, -0.4 * u, 1 * u, 1.5 * u, 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(1.7 * u, -0.4 * u, 1 * u, 1.5 * u, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1d3a1d';
        ctx.beginPath(); ctx.moveTo(-1.6 * u, -5 * u); ctx.lineTo(-2.4 * u, -6.4 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1.6 * u, -5 * u); ctx.lineTo(2.4 * u, -6.4 * u); ctx.stroke();
        break;
      case 'pinguino':
        ctx.fillStyle = '#2b3440';
        ctx.beginPath(); ctx.arc(0, -1.6 * u, 4.5 * u, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        ctx.fillStyle = '#f7b13c';
        ctx.beginPath(); ctx.moveTo(-0.7 * u, 1.1 * u); ctx.lineTo(0.7 * u, 1.1 * u); ctx.lineTo(0, 2 * u); ctx.closePath(); ctx.fill();
        break;
      case 'vikingo':
        ctx.fillStyle = '#8a8f9e';
        ctx.beginPath(); ctx.arc(0, -2.8 * u, 4 * u, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#f0ead8';
        [[-1, 1]].forEach(function () {});
        [-1, 1].forEach(function (s) {
          ctx.save(); ctx.translate(s * 4.1 * u, -3.6 * u); ctx.rotate(s * 0.5);
          ctx.fillStyle = '#f0ead8';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 1.6 * u, -1.2 * u, s * 0.9 * u, -2.8 * u); ctx.quadraticCurveTo(s * 0.2 * u, -1.4 * u, 0, 0); ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = 'rgba(150,90,40,0.9)'; redondeado(ctx, -2.6 * u, 2.2 * u, 5.2 * u, 2.2 * u, 1 * u); ctx.fill();
        break;
      case 'samurai':
        ctx.fillStyle = '#23262d';
        redondeado(ctx, -4.2 * u, -4 * u, 8.4 * u, 1.4 * u, 0.7 * u); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -5 * u, 1.1 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e0433f'; ctx.beginPath(); ctx.moveTo(-4.2 * u, -3.4 * u); ctx.lineTo(4.2 * u, -3.4 * u); ctx.stroke();
        break;
      case 'rockero':
        ctx.fillStyle = '#e0433f';
        redondeado(ctx, -1 * u, -7.6 * u, 2 * u, 4.4 * u, 1 * u); ctx.fill();
        ctx.fillStyle = '#23262d';
        redondeado(ctx, -3 * u, -0.7 * u, 2.6 * u, 1.9 * u, 0.9 * u); ctx.fill();
        redondeado(ctx, 0.4 * u, -0.7 * u, 2.6 * u, 1.9 * u, 0.9 * u); ctx.fill();
        break;
      case 'rey':
        ctx.fillStyle = '#f2c14e';
        ctx.strokeStyle = '#8a5a00';
        ctx.beginPath();
        ctx.moveTo(-3.2 * u, -4.2 * u); ctx.lineTo(-3.2 * u, -6.8 * u); ctx.lineTo(-1.6 * u, -5.4 * u);
        ctx.lineTo(0, -7.4 * u); ctx.lineTo(1.6 * u, -5.4 * u); ctx.lineTo(3.2 * u, -6.8 * u); ctx.lineTo(3.2 * u, -4.2 * u);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e0433f';
        [[-1.6, -5.6], [0, -6], [1.6, -5.6]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * u, p[1] * u, 0.35 * u, 0, Math.PI * 2); ctx.fill(); });
        break;
      case 'dinosaurio':
        ctx.fillStyle = '#5a8e3c';
        ctx.beginPath(); ctx.arc(0, -2.6 * u, 4.2 * u, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.fillStyle = '#f2e14e';
        [-2.2, -0.7, 0.8, 2.3].forEach(function (x) {
          ctx.beginPath(); ctx.moveTo((x - 0.5) * u, -5.6 * u); ctx.lineTo(x * u, -7 * u); ctx.lineTo((x + 0.5) * u, -5.6 * u); ctx.closePath(); ctx.fill();
        });
        break;
      case 'unicornio':
        ctx.fillStyle = '#f5a3d7';
        redondeado(ctx, -4.6 * u, -4.4 * u, 2 * u, 4.6 * u, 1 * u); ctx.fill();
        redondeado(ctx, 2.6 * u, -4.4 * u, 2 * u, 4.6 * u, 1 * u); ctx.fill();
        ctx.fillStyle = '#f2c14e';
        ctx.save(); ctx.translate(0, -5.4 * u); ctx.rotate(0.08);
        ctx.beginPath(); ctx.moveTo(-0.9 * u, 0); ctx.lineTo(0, -3.4 * u); ctx.lineTo(0.9 * u, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      case 'bailarina':
        // moño + tiara + tutú
        ctx.fillStyle = pelo;
        ctx.beginPath(); ctx.arc(0, -5.6 * u, 1.3 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath(); ctx.arc(-2.2 * u, -4.4 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -4.8 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2.2 * u, -4.4 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(0, -3.2 * u, 3.9 * u, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        break;
      case 'erizo':
        // púas azules + zapatillas rojas
        ctx.fillStyle = '#3f6fd6';
        for (var pe = -1; pe <= 1; pe++) {
          ctx.save(); ctx.translate(pe * 2.6 * u, -4.2 * u); ctx.rotate(pe * 0.5);
          ctx.beginPath(); ctx.moveTo(-1 * u, 0.6 * u); ctx.lineTo(0, -2.6 * u); ctx.lineTo(1 * u, 0.6 * u); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.beginPath(); ctx.arc(0, -2.6 * u, 4 * u, Math.PI, 0); ctx.fill();
        break;
      case 'fontanero':
        // gorra roja + bigote
        ctx.fillStyle = '#c22f24';
        ctx.beginPath(); ctx.arc(0, -2.8 * u, 4 * u, Math.PI, 0); ctx.fill();
        redondeado(ctx, -5 * u, -3.4 * u, 10 * u, 1.1 * u, 0.55 * u); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -5.4 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2412';
        redondeado(ctx, -2.2 * u, 1.5 * u, 4.4 * u, 1.1 * u, 0.55 * u); ctx.fill();
        break;
      case 'rapero':
        // gorra al revés + cadena de oro
        ctx.fillStyle = '#23262d';
        ctx.beginPath(); ctx.arc(0, -2.8 * u, 4 * u, Math.PI, 0); ctx.fill();
        redondeado(ctx, -5 * u, -4.6 * u, 3.4 * u, 1.1 * u, 0.55 * u); ctx.fill();
        ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = Math.max(1, 0.4 * u);
        ctx.beginPath(); ctx.arc(0, -3.6 * u, 2.2 * u, 0.3, Math.PI - 0.3); ctx.stroke();
        break;
      case 'luchador':
        // máscara con aberturas + cintas
        ctx.fillStyle = '#c22f4a';
        redondeado(ctx, -4.4 * u, -4.8 * u, 8.8 * u, 2.4 * u, 1.1 * u); ctx.fill();
        ctx.fillStyle = piel;
        redondeado(ctx, -3 * u, -1.4 * u, 2.4 * u, 2.2 * u, 1 * u); ctx.fill();
        redondeado(ctx, 0.6 * u, -1.4 * u, 2.4 * u, 2.2 * u, 1 * u); ctx.fill();
        ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = Math.max(1, 0.3 * u);
        ctx.beginPath(); ctx.moveTo(-4.4 * u, -3.8 * u); ctx.lineTo(4.4 * u, -3.8 * u); ctx.stroke();
        break;
      case 'heroe':
        // cinta roja de acción
        ctx.fillStyle = '#c22f24';
        redondeado(ctx, -4.3 * u, -4.2 * u, 8.6 * u, 1.5 * u, 0.7 * u); ctx.fill();
        ctx.save(); ctx.translate(4.3 * u, -3.6 * u); ctx.rotate(0.5);
        redondeado(ctx, 0, -0.5 * u, 2.4 * u, 1 * u, 0.5 * u); ctx.fill(); ctx.restore();
        break;
      case 'nieve':
        // ojos de carbón + nariz de zanahoria
        ctx.fillStyle = '#23262d';
        ctx.beginPath(); ctx.ellipse(-1.8 * u, 0.4 * u, 0.75 * u, 0.95 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(1.8 * u, 0.4 * u, 0.75 * u, 0.95 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8863c';
        ctx.beginPath(); ctx.moveTo(-0.7 * u, 1.3 * u); ctx.lineTo(0.7 * u, 1.3 * u); ctx.lineTo(0, 2.6 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#23262d';
        [[-1.6, 3.2], [-0.5, 3.6], [0.5, 3.6], [1.6, 3.2]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0] * u, p[1] * u, 0.22 * u, 0, Math.PI * 2); ctx.fill();
        });
        break;
      case 'rosada':
        // cresta rosa alta + pendientes
        ctx.fillStyle = '#ef6ea8';
        ctx.beginPath();
        ctx.moveTo(-2.6 * u, -3.4 * u);
        var cresta = [-2.2, -1.2, -0.2, 0.8, 1.8];
        for (var cr = 0; cr < cresta.length; cr++) {
          ctx.lineTo((cresta[cr] - 0.6) * u, -3.6 * u);
          ctx.lineTo(cresta[cr] * u, -7.2 * u);
          ctx.lineTo((cresta[cr] + 0.6) * u, -3.6 * u);
        }
        ctx.lineTo(2.6 * u, -3.4 * u);
        ctx.lineTo(2.6 * u, -2.2 * u); ctx.lineTo(-2.6 * u, -2.2 * u);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath(); ctx.arc(-4.3 * u, 0.8 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4.3 * u, 0.8 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'hielo':
        // tiara de hielo + brillo de escarcha
        ctx.fillStyle = 'rgba(180,230,245,0.95)';
        ctx.beginPath(); ctx.moveTo(-3.4 * u, -3.8 * u); ctx.lineTo(-2.4 * u, -6.2 * u); ctx.lineTo(-1.4 * u, -3.8 * u); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.9 * u, -3.8 * u); ctx.lineTo(0, -6.8 * u); ctx.lineTo(0.9 * u, -3.8 * u); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1.4 * u, -3.8 * u); ctx.lineTo(2.4 * u, -6.2 * u); ctx.lineTo(3.4 * u, -3.8 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-2.9 * u, 1.8 * u, 0.28 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2.9 * u, 1.8 * u, 0.28 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'piloto':
        // casco rosa con franja blanca
        ctx.fillStyle = '#e85a9e';
        ctx.beginPath(); ctx.arc(0, -2.2 * u, 4.3 * u, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.fillStyle = '#f4f4f8';
        redondeado(ctx, -0.9 * u, -6.4 * u, 1.8 * u, 3.4 * u, 0.9 * u); ctx.fill();
        ctx.fillStyle = '#23262d';
        redondeado(ctx, -4.3 * u, -2.6 * u, 1.4 * u, 3.4 * u, 0.7 * u); ctx.fill();
        redondeado(ctx, 2.9 * u, -2.6 * u, 1.4 * u, 3.4 * u, 0.7 * u); ctx.fill();
        break;
      case 'corredor':
        // casco azul con franja blanca
        ctx.fillStyle = '#2f6fd6';
        ctx.beginPath(); ctx.arc(0, -2.2 * u, 4.3 * u, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.fillStyle = '#f4f4f8';
        redondeado(ctx, -0.9 * u, -6.4 * u, 1.8 * u, 3.4 * u, 0.9 * u); ctx.fill();
        ctx.fillStyle = '#23262d';
        redondeado(ctx, -4.3 * u, -2.6 * u, 1.4 * u, 3.4 * u, 0.7 * u); ctx.fill();
        redondeado(ctx, 2.9 * u, -2.6 * u, 1.4 * u, 3.4 * u, 0.7 * u); ctx.fill();
        break;
      case 'pato':
        // capucha amarilla + pico
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath(); ctx.arc(0, -1.6 * u, 4.7 * u, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2.2 * u, 1.2 * u); ctx.lineTo(2.2 * u, 1.2 * u); ctx.lineTo(0, 2.8 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d97b2e';
        ctx.beginPath(); ctx.moveTo(-0.5 * u, 2.1 * u); ctx.lineTo(0.5 * u, 2.1 * u); ctx.lineTo(0, 2.5 * u); ctx.closePath(); ctx.fill();
        break;
      case 'galleta':
        // glasa blanca + sonrisa
        ctx.fillStyle = '#f7f7fa';
        ctx.beginPath(); ctx.arc(0, -2.6 * u, 4.1 * u, Math.PI, 0); ctx.fill();
        [[-2.6], [-0.9], [0.9], [2.6]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0] * u, -2.4 * u, 0.7 * u, 0, Math.PI); ctx.fill();
        });
        break;
      case 'portero':
        // máscara blanca con rejilla gris, ojos libres
        ctx.fillStyle = '#eef1f6';
        redondeado(ctx, -4.2 * u, -5 * u, 8.4 * u, 2 * u, 1 * u); ctx.fill();
        redondeado(ctx, -4.2 * u, 2.2 * u, 8.4 * u, 2.2 * u, 1 * u); ctx.fill();
        ctx.fillStyle = '#8a94a3';
        redondeado(ctx, -4.2 * u, -0.6 * u, 1.1 * u, 2.4 * u, 0.5 * u); ctx.fill();
        redondeado(ctx, 3.1 * u, -0.6 * u, 1.1 * u, 2.4 * u, 0.5 * u); ctx.fill();
        break;
      case 'guay':
        // tupé + gafas de sol
        ctx.fillStyle = '#4a2f1d';
        ctx.beginPath(); ctx.arc(-1 * u, -3.4 * u, 2.6 * u, Math.PI, 0); ctx.fill();
        redondeado(ctx, -4.4 * u, -4 * u, 8.8 * u, 1.6 * u, 0.8 * u); ctx.fill();
        ctx.fillStyle = '#101319';
        redondeado(ctx, -3.5 * u, -1.3 * u, 3.1 * u, 2.9 * u, 1.2 * u); ctx.fill();
        redondeado(ctx, 0.4 * u, -1.3 * u, 3.1 * u, 2.9 * u, 1.2 * u); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, 0.3 * u);
        ctx.beginPath(); ctx.moveTo(-2.9 * u, -0.5 * u); ctx.lineTo(-1.2 * u, -0.5 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1 * u, -0.5 * u); ctx.lineTo(2.7 * u, -0.5 * u); ctx.stroke();
        break;
      case 'bot':
        // casco metálico + antena con luz + respiradero
        ctx.fillStyle = '#9aa4b2';
        ctx.beginPath(); ctx.arc(0, -2.4 * u, 4.25 * u, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.strokeStyle = '#5a636e'; ctx.lineWidth = Math.max(1, 0.4 * u);
        ctx.beginPath(); ctx.moveTo(0, -6.4 * u); ctx.lineTo(0, -7.8 * u); ctx.stroke();
        ctx.fillStyle = '#e0433f'; ctx.beginPath(); ctx.arc(0, -8.1 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a636e';
        redondeado(ctx, -2.6 * u, 2.6 * u, 5.2 * u, 1 * u, 0.5 * u); ctx.fill();
        break;
      case 'ciber':
        // capucha + visor de neón con brillo
        ctx.fillStyle = '#16181d';
        ctx.beginPath(); ctx.arc(0, -2.0 * u, 4.5 * u, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        ctx.fillStyle = '#0d2818';
        redondeado(ctx, -3.8 * u, -1.6 * u, 7.6 * u, 2.8 * u, 1.3 * u); ctx.fill();
        ctx.fillStyle = '#4fae5a';
        redondeado(ctx, -3.2 * u, -0.7 * u, 6.4 * u, 0.7 * u, 0.35 * u); ctx.fill();
        ctx.fillStyle = '#bfffd0';
        redondeado(ctx, -2.2 * u, -0.7 * u, 2.0 * u, 0.7 * u, 0.35 * u); ctx.fill();
        ctx.strokeStyle = '#23262d'; ctx.lineWidth = Math.max(1, 0.5 * u);
        ctx.beginPath(); ctx.moveTo(2.6 * u, -5.6 * u); ctx.lineTo(3.4 * u, -7.4 * u); ctx.stroke();
        ctx.fillStyle = '#4fae5a'; ctx.beginPath(); ctx.arc(3.4 * u, -7.6 * u, 0.45 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'neon':
        // diadema de neón + puntos de luz
        ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = Math.max(1.2, 0.5 * u);
        ctx.beginPath(); ctx.arc(0, -1.8 * u, 4.3 * u, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, 0.25 * u);
        ctx.beginPath(); ctx.arc(0, -1.8 * u, 4.3 * u, Math.PI * 1.2, Math.PI * 1.6); ctx.stroke();
        ctx.fillStyle = '#4cc9f0';
        ctx.beginPath(); ctx.arc(-3.6 * u, 1.6 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3.6 * u, 1.6 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'holo':
        // líneas de escaneo + píxeles flotantes
        ctx.fillStyle = 'rgba(160,230,245,0.35)';
        [-2.2, -0.2, 1.8].forEach(function (yy) {
          redondeado(ctx, -4.2 * u, yy * u, 8.4 * u, 0.55 * u, 0.27 * u); ctx.fill();
        });
        ctx.fillStyle = 'rgba(120,220,245,0.8)';
        ctx.fillRect(-5.2 * u, -3.4 * u, 0.8 * u, 0.8 * u);
        ctx.fillRect(4.6 * u, -0.6 * u, 0.8 * u, 0.8 * u);
        ctx.fillRect(-4.8 * u, 2.2 * u, 0.7 * u, 0.7 * u);
        break;
      case 'exo':
        // visera pesada + barbilla acorazada
        ctx.fillStyle = '#5a636e';
        redondeado(ctx, -4.4 * u, -5.2 * u, 8.8 * u, 2.2 * u, 1 * u); ctx.fill();
        ctx.fillStyle = '#2b3440';
        redondeado(ctx, -3.4 * u, -4.6 * u, 6.8 * u, 1.2 * u, 0.6 * u); ctx.fill();
        ctx.fillStyle = '#e8863c';
        redondeado(ctx, -2.2 * u, 2.8 * u, 4.4 * u, 1.4 * u, 0.7 * u); ctx.fill();
        break;
      case 'centinela':
        // ojo ciclópeo rojo + aleta superior
        ctx.fillStyle = '#23262d';
        redondeado(ctx, -3.6 * u, -1.6 * u, 7.2 * u, 3.0 * u, 1.4 * u); ctx.fill();
        ctx.fillStyle = '#e0433f';
        ctx.beginPath(); ctx.ellipse(0, -0.1 * u, 1.5 * u, 0.9 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb3ab';
        ctx.beginPath(); ctx.arc(-0.4 * u, -0.3 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#23262d';
        ctx.beginPath(); ctx.moveTo(-0.9 * u, -4.6 * u); ctx.lineTo(0, -7.0 * u); ctx.lineTo(0.9 * u, -4.6 * u); ctx.closePath(); ctx.fill();
        break;
      case 'nova':
        // horquillas de estrella + brillo
        ctx.fillStyle = '#f2c14e';
        [[-3.2, -3.4], [3.2, -3.4]].forEach(function (p) {
          ctx.save(); ctx.translate(p[0] * u, p[1] * u);
          ctx.beginPath();
          for (var pi = 0; pi < 5; pi++) {
            var ang = -Math.PI / 2 + pi * 2 * Math.PI / 5;
            var ang2 = ang + Math.PI / 5;
            ctx.lineTo(Math.cos(ang) * 0.8 * u, Math.sin(ang) * 0.8 * u);
            ctx.lineTo(Math.cos(ang2) * 0.35 * u, Math.sin(ang2) * 0.35 * u);
          }
          ctx.closePath(); ctx.fill(); ctx.restore();
        });
        break;
      default:
        if (cSom) {
          ctx.fillStyle = cSom;
          ctx.beginPath(); ctx.arc(0, -2.8 * u, 4.05 * u, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
        }
        break;
    }
    ctx.restore();
  }

  raiz.SA_SPRITES = {
    ANCHO: ANCHO,
    ALTO: ALTO,
    nombreArchivo: NOMBRE_ARCHIVO,
    parametros: parametros,
    crear: crear,
    crearEmoji: crearEmoji,
    pintar: pintar,
    dibujarHD: dibujarHD,
    listarSkins: listarSkins,
    nombreSkin: nombreSkin,
    registrarSkins: registrarSkins,
    SKINS: SKINS
  };
})(typeof window !== 'undefined' ? window : this);

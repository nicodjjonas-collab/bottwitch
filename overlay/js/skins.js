/* ============================================================================
 * skins.js  —  Disfraces EXTRA para Stream Avatars (18 skins nuevas)
 * ----------------------------------------------------------------------------
 * - Script CLASICO (sin import/export). Se carga DESPUES de js/sprites.js.
 * - No toca el DOM: solo llena el catalogo con window.SA_SPRITES.registrarSkins.
 * - Todos son arquetipos genericos (un bombero, un chef, un dinosaurio...):
 *   nada con copyright, todo dibujado a mano pixel a pixel.
 *
 * COMO SE COLOCA CADA MAPA (12 columnas, columnas 0..11):
 *   sombrero -> filas 0-3  (pelo y parte alta de la cabeza)
 *   cara     -> filas 4-5  (los ojos van en la fila 4, columnas 4 y 7, y la boca
 *                           en la fila 6. Por eso los antifaces, hocicos y
 *                           barbas van en la FILA 5: asi el muneco conserva
 *                           los ojos y la boca y sigue siendo reconocible.)
 *   cuerpo   -> filas 8-17 (hombros..pies): capas, alas, colas y detalles de
 *                           ropa. Las columnas 1 y 10 de las filas 10-12 son
 *                           los BRAZOS, asi que ahi no conviene pintar.
 *
 * COLORES: A azul · G verde · K negro · R rojo · Y dorado · V violeta ·
 *          T marron · N naranja · X plata · Z blanco · W brillo · D contorno ·
 *          H pelo · S piel · C camiseta · P pantalon · B calzado · . nada
 * ==========================================================================*/
(function () {
  'use strict';

  if (!window.SA_SPRITES || typeof window.SA_SPRITES.registrarSkins !== 'function') return;

  window.SA_SPRITES.registrarSkins({

    /* ------------------------------------------------------------------ *
     * 1. BOMBERO: casco rojo con cresta y chaqueta con bandas reflectantes
     * ------------------------------------------------------------------ */
    bombero: {
      nombre: 'Bombero', emoji: '🚒',
      camiseta: '#b8352a',
      sombrero: [
        '.....RR.....',
        '..RRRRRRRR..',
        '.RRRRRRRRRR.',
        '.RRRYYYYRRR.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCYYCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..XXCCCCXX..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 2. CHEF: gorro alto blanco y chaqueta con botones
     * ------------------------------------------------------------------ */
    chef: {
      nombre: 'Chef', emoji: '👨‍🍳',
      camiseta: '#f2f2f6',
      sombrero: [
        '...ZZZZZZ...',
        '..ZZZZZZZZ..',
        '..ZZZZZZZZ..',
        '.ZZZZZZZZZZ.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCDCCDCCS.',
        '.SCCDCCDCCS.',
        '..CCDCCDCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 3. MEDICO: bata blanca, espejo en la frente, estetoscopio y cruz roja
     * ------------------------------------------------------------------ */
    medico: {
      nombre: 'Medico', emoji: '🩺',
      camiseta: '#f4f8fc',
      sombrero: [
        '..DDDDDDDD..',
        '.DDDDDDDDDD.',
        '.DDXXXXXXDD.',
        '.DDDDDDDDDD.'
      ],
      cuerpo: [
        '..CXCCCCXC..',
        '.CXCCCCCCXC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCRRRRCC..',
        '..CCCRRCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 4. DETECTIVE: gabardina de cuello alto, sombrero y gafas oscuras
     * ------------------------------------------------------------------ */
    detective: {
      nombre: 'Detective', emoji: '🕵️',
      camiseta: '#c9a06a',
      sombrero: [
        '...TTTTTT...',
        '..TTTTTTTT..',
        '.TTTTTTTTTT.',
        '..TT....TT..'
      ],
      cara: [
        '..KK.KK.KK..'
      ],
      cuerpo: [
        '.TCCCCCCCCT.',
        '.TCCCCCCCCT.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 5. PAYASO: gorro de lunares, peluca naranja, nariz roja y mofletes
     * ------------------------------------------------------------------ */
    payaso: {
      nombre: 'Payaso', emoji: '🤡',
      camiseta: '#e8d84a',
      sombrero: [
        '.....KK.....',
        '..RRRRRRRR..',
        '.RRZZRRZZRR.',
        '.RRRRRRRRRR.'
      ],
      cara: [
        '..R......R..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCRRRRCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..RRRRRRRR..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 6. PANDA: orejas redondas, manchas negras y camiseta negra
     * ------------------------------------------------------------------ */
    panda: {
      nombre: 'Panda', emoji: '🐼',
      piel: '#f7f7fa',
      camiseta: '#23262d',
      sombrero: [
        '.KK......KK.',
        'KKKK....KKKK',
        'KKKK....KKKK',
        '.KKK....KKK.'
      ],
      cara: [
        '.KZK.K..ZKZK'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.CCCCCCCCCC.',
        '.CCCCCCCCCC.',
        '.CCCCCCCCCC.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 7. ABEJA: antenas, franja negra en los ojos, rayas y alas a los lados
     * ------------------------------------------------------------------ */
    abeja: {
      nombre: 'Abeja', emoji: '🐝',
      piel: '#f2c14e',
      camiseta: '#f2c14e',
      sombrero: [
        '.K........K.',
        '..Y......Y..',
        '..YYYYYYYY..',
        '.YYYYYYYYYY.'
      ],
      cara: [
        '..KK.KK.KK..'
      ],
      cuerpo: [
        'XYYYYYYYYYYX',
        'XKKKKKKKKKKX',
        'XYYYYYYYYYYX',
        '.SKKKKKKKKS.',
        '.SYYYYYYYYS.',
        '..KKKKKKKK..',
        '..YYYYYYYY..',
        '..KKKKKKKK..',
        '..YYYYYYYY..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 8. CONEJO: orejas largas con interior rosa, dientes y colita blanca
     * ------------------------------------------------------------------ */
    conejo: {
      nombre: 'Conejo', emoji: '🐰',
      piel: '#f7f7fa',
      camiseta: '#e8e6f2',
      sombrero: [
        '...ZZ..ZZ...',
        '..ZRZ..ZRZ..',
        '..ZRZ..ZRZ..',
        '..ZZZ..ZZZ..'
      ],
      cara: [
        '.....RR.....'
      ],
      cuerpo: [
        '..CCCCCCCC.Z',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 9. ZORRO: orejas triangulares, hocico blanco y cola peluda
     * ------------------------------------------------------------------ */
    zorro: {
      nombre: 'Zorro', emoji: '🦊',
      piel: '#e8863c',
      camiseta: '#c1662c',
      sombrero: [
        '.N........N.',
        'NNN......NNN',
        'NNNN....NNNN',
        '.NNN....NNN.'
      ],
      cara: [
        '..ZZ..Z..ZZ.'   // mejillas y hocico blancos: libres las cols 4 y 7 (los ojos)
      ],
      cuerpo: [
        '..CCCCCCCCTT',
        '.CCCCCCCCCCT',
        '.SCCCCCCCCST',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 10. CALAVERA: craneo blanco, cuencas negras y tunica oscura
     * ------------------------------------------------------------------ */
    calavera: {
      nombre: 'Calavera', emoji: '💀',
      piel: '#f2f4f7',
      camiseta: '#3a3f4a',
      sombrero: [
        '..ZZZZZZZZ..',
        '.ZZZZZZZZZZ.',
        '.ZZZZZZZZZZ.',
        '.ZZZZZZZZZZ.'
      ],
      cara: [
        '..KK.KK.KK..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..KKKKKKKK..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 11. ALIEN: piel verde, ojos negros enormes y antenas
     * ------------------------------------------------------------------ */
    alien: {
      nombre: 'Alien', emoji: '👽',
      piel: '#7ad17a',
      camiseta: '#2f4f4a',
      sombrero: [
        '...G....G...',
        '..GG....GG..',
        '..GGGGGGGG..',
        '.GGGGGGGGGG.'
      ],
      cara: [
        '..KK.KK.KK..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 12. PINGUINO: cabeza negra, pico naranja, barriga blanca y patas
     * ------------------------------------------------------------------ */
    pinguino: {
      nombre: 'Pinguino', emoji: '🐧',
      piel: '#3a4a5a',
      camiseta: '#f7f7fa',
      sombrero: [
        '...KKKKKK...',
        '..KKKKKKKK..',
        '.KKKKKKKKKK.',
        '.KKKKKKKKKK.'
      ],
      cara: [
        '..NN.NN.NN..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.KCCCCCCCCK.',
        '.KCCCCCCCCK.',
        '.KCCCCCCCCK.',
        '..CCCCCCCC..',
        '..YYYYYYYY..',
        '..YYYYYYYY..',
        '..YYYYYYYY..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 13. VIKINGO: casco con cuernos de plata y barba dorada
     * ------------------------------------------------------------------ */
    vikingo: {
      nombre: 'Vikingo', emoji: '⚔️',
      camiseta: '#6b4a2f',
      sombrero: [
        'X..........X',
        '.X........X.',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.'
      ],
      cara: [
        '..YY.YY.YYYY'
      ],
      cuerpo: [
        '..YYYYYYYY..',
        '.SYYYYYYYYS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..YYYYYYYY..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 14. SAMURAI: casco con cuernos dorados y hombreras de samurai
     * ------------------------------------------------------------------ */
    samurai: {
      nombre: 'Samurai', emoji: '🎋',
      camiseta: '#4a5568',
      sombrero: [
        '.Y........Y.',
        '.YY......YY.',
        '..KKKKKKKK..',
        '.KKKKKKKKKK.'
      ],
      cuerpo: [
        '..RRRRRRRR..',
        '.KKKKKKKKKK.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..YYYYYYYY..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 15. ROCKERO: melena, gafas de sol y guitarra en las columnas 10-11
     * ------------------------------------------------------------------ */
    rockero: {
      nombre: 'Rockero', emoji: '🎸',
      camiseta: '#23262d',
      sombrero: [
        '...HHHHHH...',
        '..HHHHHHHH..',
        '.HHHHHHHHHH.',
        '.HHHHHHHHHH.'
      ],
      cara: [
        '..KK.WK.WK..'
      ],
      cuerpo: [
        '..CCCZZCCC..',
        '.CCCCZZCCCC.',
        '.SCCCZZCCCS.',
        '.SCCCZZCCCS.',
        '.SCCCZZCCCSK',
        '..CCCCCCCCKK',
        '..CCCCCCCCKK',
        '..CCCCCCCCKK',
        '..PPPPPPPPKK',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 16. REY: corona con joyas y capa roja con armino blanco
     * ------------------------------------------------------------------ */
    rey: {
      nombre: 'Rey', emoji: '👑',
      camiseta: '#a83232',
      sombrero: [
        '..Y..YY..Y..',
        '.YYYYYYYYYY.',
        '.YRYRYRYRYY.',
        '.YYYYYYYYYY.'
      ],
      cuerpo: [
        'R..CCCCCC..R',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR',
        'RZ.CCCCCC.ZR'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 17. DINOSAURIO: cresta de puas, hocico y panza clara
     * ------------------------------------------------------------------ */
    dinosaurio: {
      nombre: 'Dinosaurio', emoji: '🦖',
      piel: '#5fa84a',
      camiseta: '#3d7a34',
      sombrero: [
        '.....GG.....',
        '.G..GGG..G..',
        'GGGGGGGGGGGG',
        'GGGGGGGGGGGG'
      ],
      cara: [
        '............',
        '..YYYYYYYY..'   // hocico claro en la fila de debajo de los ojos
      ],
      cuerpo: [
        '..GGGGGGGG..',
        '.GGGGGGGGGG.',
        '.SGYYGGYYGS.',
        '.SGYYGGYYGS.',
        '.SGYYGGYYGS.',
        '..GGGGGGGG..',
        '..GGGGGGGG..',
        '..ZZZZZZZZ..',
        '..ZZZZZZZZ..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 18. UNICORNIO: cuerno dorado, crin rosa y cola rosa
     * ------------------------------------------------------------------ */
    unicornio: {
      nombre: 'Unicornio', emoji: '🦄',
      piel: '#f7f7fa',
      camiseta: '#e8e6f2',
      sombrero: [
        '......Y.....',
        '.....YYY....',
        '..WWWWWWWWWW',
        '.WWWWWWWWWW.'
      ],
      cara: [
        '..RR......RR'   // mejillas a los lados, con los ojos libres
      ],
      cuerpo: [
        '..CCCCCCCC.W',
        '.CCCCCCCCCCW',
        '..SCCCCCCCSW',
        '..SCCCCCCCSW',
        '..SCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 19. BAILARINA: moño, tiara y tutú rosa
     * ------------------------------------------------------------------ */
    bailarina: {
      nombre: 'Bailarina', emoji: '🩰',
      camiseta: '#f2a3c0',
      sombrero: [
        '.....TT.....',
        '....TTTT....',
        '..YYYYYYYY..',
        '.YYYYYYYYYY.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SZZZZZZZZS.',
        '..ZZZZZZZZ..',
        '..ZZZZZZZZ..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 20. ERIZO: el veloz azul (genérico, sin copyright) con zapatillas rojas
     * ------------------------------------------------------------------ */
    erizo: {
      nombre: 'Erizo', emoji: '🦔',
      camiseta: '#3f6fd6',
      sombrero: [
        '.A..AAAA..A.',
        'AAAAAAAAAAAA',
        'AAAAAAAAAAAA',
        'AAAAAAAAAAAA'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..RRR..RRR..',
        '..RRR..RRR..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 21. FONTANERO: gorra roja, bigote y mono azul (genérico)
     * ------------------------------------------------------------------ */
    fontanero: {
      nombre: 'Fontanero', emoji: '🧰',
      camiseta: '#2f6fd6',
      sombrero: [
        '............',
        '..RRRRRRRR..',
        '.RRRRRRRRRR.',
        '.RRRWRRRWRR.'
      ],
      cara: [
        '............',
        '..TTTTTTTT..'   // bigote en la fila de debajo de los ojos
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCYYCCYYCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPPPPPPP..',
        '..BBB..BBB..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 22. RAPERO: gorra al revés y cadena de oro (héroe de los 90)
     * ------------------------------------------------------------------ */
    rapero: {
      nombre: 'Rapero', emoji: '🎤',
      camiseta: '#3a3f4a',
      sombrero: [
        '............',
        '..KKKKKKKK..',
        '.KKKKYYYYKK.',
        '.KKKKKKKKKK.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCYCCCCYCC.',
        '.SCYYCCYYCS.',
        '.SCYCCCCYCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 23. LUCHADOR: máscara, cinturón de oro y capa (héroe de los 90)
     * ------------------------------------------------------------------ */
    luchador: {
      nombre: 'Luchador', emoji: '🤼',
      camiseta: '#c22f4a',
      sombrero: [
        '.....RR.....',
        '....RRRR....',
        '..RRRRRRRR..',
        '.RRRRRRRRRR.'
      ],
      cara: [
        '.RRR.RR.RRR.',   // máscara con los ojos libres (columnas 4 y 7)
        '..RRRRRRRR..'
      ],
      cuerpo: [
        'RR.CCCCCC.RR',
        'RR.CCCCCC.RR',
        'RRSCCCCCCSSR',
        'RRSCCCCCCSSR',
        'RRSCCCCCCSSR',
        '..CCYYYYCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 24. HÉROE: cinta de acción y muñequeras (héroe de los 90)
     * ------------------------------------------------------------------ */
    heroe: {
      nombre: 'Héroe', emoji: '⭐',
      camiseta: '#4a4f5a',
      sombrero: [
        '............',
        '............',
        '..RRRRRRRR..',
        '.RRRRRRRRRR.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.WCCCCCCCCW.',
        '.WCCCCCCCCW.',
        '.WCCCCCCCCW.',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 25. NIEVE: muñeco de nieve con nariz de zanahoria y botones de carbón
     * ------------------------------------------------------------------ */
    nieve: {
      nombre: 'Nieve', emoji: '⛄',
      piel: '#f4f6fb',
      camiseta: '#eef1f6',
      cara: [
        '............',
        '.....NN.....'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCKKCCCS.',
        '.SCCCKKCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 26. ROSADA: chica de cresta rosa (genérica)
     * ------------------------------------------------------------------ */
    rosada: {
      nombre: 'Rosada', emoji: '💖',
      camiseta: '#f2a3c0',
      sombrero: [
        '.....RR.....',
        '....RRRR....',
        '..RRRRRRRR..',
        '.RRRRRRRRRR.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 27. HIELO: reina de hielo genérica con tiara de copos
     * ------------------------------------------------------------------ */
    hielo: {
      nombre: 'Hielo', emoji: '❄️',
      camiseta: '#9fd4e8',
      sombrero: [
        '...W..W.....',
        '..WXWXXWX...',
        '.XXXXXXXXXX.',
        '............'
      ],
      cara: [
        'XX........XX'
      ],
      cuerpo: [
        '..CCXCCXCC..',
        '.CCCXCCXCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..ZZZZZZZZ..',
        '..ZZZZZZZZ..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 28. PILOTO: casco rosa de carreras con visor (genérica)
     * ------------------------------------------------------------------ */
    piloto: {
      nombre: 'Piloto', emoji: '🏎️',
      camiseta: '#e85a9e',
      sombrero: [
        '..VVVVVVVV..',
        '.VVVVVVVVVV.',
        '.VVVVVVVVVV.',
        '............'
      ],
      cara: [
        '.VVV.VV.VVV.',
        '..VVVVVVVV..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCZZZZCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 29. CORREDOR: casco azul de carreras con visor (genérica)
     * ------------------------------------------------------------------ */
    corredor: {
      nombre: 'Corredor', emoji: '🏁',
      camiseta: '#2f6fd6',
      sombrero: [
        '..AAAAAAAA..',
        '.AAAAAAAAAA.',
        '.AAAAAAAAAA.',
        '............'
      ],
      cara: [
        '.AAA.AA.AAA.',
        '..AAAAAAAA..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCZZZZCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 30. PATO: capucha amarilla y pico naranja (genérica)
     * ------------------------------------------------------------------ */
    pato: {
      nombre: 'Pato', emoji: '🦆',
      camiseta: '#f2c14e',
      sombrero: [
        '..YYYYYYYY..',
        '.YYYYYYYYYY.',
        '.YYYYYYYYYY.',
        '............'
      ],
      cara: [
        '............',
        '....NNNN....'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 31. GALLETA: de jengibre con glasa y botones de caramelo
     * ------------------------------------------------------------------ */
    galleta: {
      nombre: 'Galleta', emoji: '🍪',
      piel: '#b07a45',
      camiseta: '#8a5a34',
      sombrero: [
        '............',
        '............',
        '..WWWWWWWW..',
        '.WWWWWWWWWW.'
      ],
      cara: [
        '............',
        '..WWWWWWWW..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCWWCCCCC.',
        '.SCCCCCCCCS.',
        '.SCCWWCCCS.',
        '.SCCCCCCCCS.',
        '..CCCWWCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 32. PORTERO: máscara blanca de hockey genérica (sin sangre, sin copy)
     * ------------------------------------------------------------------ */
    portero: {
      nombre: 'Portero', emoji: '🥅',
      camiseta: '#dfe3ea',
      sombrero: [
        '..ZZZZZZZZ..',
        '.ZZZZZZZZZZ.',
        '.ZZZZZZZZZZ.',
        '............'
      ],
      cara: [
        '.ZZZ.ZZ.ZZZ.',
        '..ZZXZZXZZ..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCKKKKKKCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 33. GUAY: tupé, chupa de cuero y gafas de sol (solo en HD)
     * ------------------------------------------------------------------ */
    guay: {
      nombre: 'Guay', emoji: '😎',
      camiseta: '#2b2f38',
      sombrero: [
        '............',
        '...TTTTTT...',
        '..TTTTTTTT..',
        '.TTTTTTTTTT.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCZZZZZZCC.',
        '.SCZZZZZZCS.',
        '.SCZZZZZZCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 34. BOT: casco metálico con antena y paneles (genérico)
     * ------------------------------------------------------------------ */
    bot: {
      nombre: 'Bot', emoji: '🦾',
      camiseta: '#9aa4b2',
      sombrero: [
        '.....R......',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.',
        '.XXXXKXXXKX.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCXCCCCXCC.',
        '.SCXCCCCXCS.',
        '.SCXCCCCXCS.',
        '.SCCCCCCCCS.',
        '..CXCCCCXC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 35. CIBER: capucha negra con circuitos de neón (futurista)
     * ------------------------------------------------------------------ */
    ciber: {
      nombre: 'Ciber', emoji: '🌐',
      camiseta: '#23262d',
      sombrero: [
        '..KKKKKKKK..',
        '.KKKVVKKKKK.',
        '.KKKKKKKKKK.',
        '............'
      ],
      cara: [
        '............',
        '..VVVVVVVV..'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCVVVVVVCC.',
        '.SCVCCCCVCS.',
        '.SCVCCCCVCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 36. NEON: traje oscuro con tuberías de neón (futurista)
     * ------------------------------------------------------------------ */
    neon: {
      nombre: 'Neón', emoji: '💠',
      camiseta: '#1a1d24',
      sombrero: [
        '.....YY.....',
        '....YYYY....',
        '..KKKKKKKK..',
        '.KKKKKKKKKK.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCXXXXXXCC.',
        '.SCXCCCCXCS.',
        '.SCXCCCCXCS.',
        '.SCCCCCCCCS.',
        '..CXCCCCXC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 37. HOLO: holograma celeste con antena (futurista)
     * ------------------------------------------------------------------ */
    holo: {
      nombre: 'Holo', emoji: '🛸',
      camiseta: '#7fd4e8',
      sombrero: [
        '.....X......',
        '..XXXXXXXX..',
        '.XXXXXXXXXX.',
        '.XXXXXXXXXX.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.XXXXXXXXXX.',
        '.SXCCCCCCXS.',
        '.SXCCCCCCXS.',
        '.SCCCCCCCCS.',
        '..XXXXXXXX..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 38. EXO: exotraje acorazado con núcleo (futurista)
     * ------------------------------------------------------------------ */
    exo: {
      nombre: 'Exo', emoji: '🦿',
      camiseta: '#5a636e',
      sombrero: [
        '............',
        '..XXXXXXXX..',
        '.XXXKXXKXXX.',
        '.XXXXXXXXXX.'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CXXCCCCXXC.',
        '.SCXRCCRXCS.',
        '.SCXRCCRXCS.',
        '.SCCCCCCCCS.',
        '..CCCRRCCC..',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 39. CENTINELA: capucha con visor único (futurista, genérico)
     * ------------------------------------------------------------------ */
    centinela: {
      nombre: 'Centinela', emoji: '🛰️',
      camiseta: '#2b3440',
      sombrero: [
        '..KKKKKKKK..',
        '.KKKXXXXKKK.',
        '.KKKKKKKKKK.',
        '............'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCXXXXCCC.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    },

    /* ------------------------------------------------------------------ *
     * 40. NOVA: pelo de estrella y colgante brillante (futurista)
     * ------------------------------------------------------------------ */
    nova: {
      nombre: 'Nova', emoji: '🌟',
      camiseta: '#5b2d9e',
      sombrero: [
        '.....Y......',
        '..Y..Y...Y..',
        '.YYYYYYYYYY.',
        '............'
      ],
      cuerpo: [
        '..CCCCCCCC..',
        '.CCCCCCCCCC.',
        '.SCCYYYCCCS.',
        '.SCCYXXYCCS.',
        '.SCCCCCCCCS.',
        '..CCCCCCCC..',
        '..CCCCCCCC..',
        '..PPPPPPPP..',
        '..PPP..PPP..',
        '..BBB..BBB..'
      ]
    }

  });
})();

// =====================================================================
//  STREAM AVATARS - configuracion por defecto
//  Todos los valores se pueden cambiar aqui o desde la URL del overlay:
//     avatares.html?canal=jonasrdb&escala=5&max=20&demo=1
// =====================================================================

window.SA_CONFIG = {
  // ---- canal ----
  canal: 'jonasrdb',

  // ---- aspecto ----
  escala: 5,              // tamaño de los muñecos (4 = clásico, 5-6 = grandes estilo arcade)
  // ---- musica: el baile sigue este ritmo (trance ~138 BPM) ----
  bpm: 138,               // golpes por minuto del baile (!baila, !fiesta). URL: ?bpm=128
  maxAvatares: 22,        // maximo de muñequitos a la vez en pantalla
  modo: 'hd',             // 'hd' = muñequitos suaves estilo Stream Avatars | 'pixel' = retro con bloques | 'emoji' = emojis grandes
  suelo: 0.88,            // donde esta el suelo (0 arriba, 1 abajo)
  mostrarSuelo: true,     // dibujar una linea/plataforma de suelo
  mostrarHud: true,       // mostrar el estado de conexion arriba a la izquierda
  mostrarRanking: false,  // ranking de niveles en una esquina

  // ---- fisica ----
  gravedad: 0.65,
  velocidadMax: 1.6,
  salto: -8.5,
  rebote: 0.35,
  choque: 0.6,            // cuanto se empujan los muñequitos entre si
  fps: 30,                // 30 va sobrado y consume menos

  // ---- comportamiento ----
  probabilidadAndar: 0.012,   // por fotograma: ganas de moverse
  probabilidadSaltar: 0.004,  // por fotograma: ganas de saltar
  probabilidadBailar: 0.002,
  duracionBurbuja: 5000,      // ms que se ve el mensaje sobre la cabeza
  largoBurbuja: 42,           // caracteres maximos en la burbuja

  // ---- vida social: paseos y duelos automáticos ----
  paseoBailando: true,       // a veces andan bailando a la vez (comparsa)
  personalidades: true,      // cada nombre tiene su carácter: movidos, tranquilos, tímidos... (?personalidad=0 lo apaga)
  duelosAuto: true,          // al cruzarse con otro, lo reta a un duelo solo
  duelosAutoGlobalSegundos: 60,   // espera mínima entre duelos automáticos
  duelosAutoPorAvatarSegundos: 150, // cada muñeco no reta más de una vez cada X s

  // ---- vida de los avatares ----
  tiempoSentarse: 150,    // segundos sin hablar -> se sienta
  tiempoDespawn: 1200,    // segundos sin hablar -> desaparece (20 min)
  tiempoEntrada: 900,     // ms de animacion de entrada

  // ---- puntos y niveles ----
  xpPorMensaje: 8,
  xpPorMinutoEnCanal: 2,  // xp pasivo por estar presente
  xpMaximo: 100000,
  niveles: [0, 30, 90, 200, 380, 640, 1000, 1500, 2150, 3000, 4100, 5500, 7200, 9300, 12000, 15500, 20000, 26000, 34000, 45000],
  guardarProgreso: true,  // recuerda niveles en este navegador (localStorage)

  // ---- eventos ----
  efectos: true,
  maxParticulas: 260,
  colorConfeti: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'],
  avisoPrimeraVez: true,  // saludo especial a quien escribe por primera vez

  // ---- avatares personalizados ----
  // Si quieres que alguien tenga un emoji o una imagen concreta, ponlo aqui:
  //   personalizados: { jonasrdb: { emoji: '🎧' }, otro: { imagen: 'file:///C:/fotos/otro.png' } }
  personalizados: {},

  // ---- depuracion ----
  demo: false,            // true = muñequitos de mentira para probar sin estar en directo
  demoUsuarios: 10,
  catalogo: false,        // true = pone un muñequito de cada skin (para verlas todas)
  acciones: false,        // true = demo de los comandos (!baila, !dormir, !abrazar, !fiesta...)
  rapido: false,          // true = la demo de acciones las lanza todas de golpe (para capturas)
  test: false
};

// Se pueden sobrescribir desde la URL. Los nombres aceptan español e ingles.
window.SA_LEER_URL = function (cfg) {
  let params;
  try { params = new URLSearchParams(window.location.search); } catch { return cfg; }
  const num = (v, def) => (v === null || v === '' || isNaN(Number(v)) ? def : Number(v));
  const bool = (v, def) => (v === null || v === '' ? def : /^(1|si|sí|true|on)$/i.test(v));

  if (params.get('canal') || params.get('channel')) cfg.canal = (params.get('canal') || params.get('channel')).replace(/^#|^@/, '').toLowerCase();
  cfg.escala = num(params.get('escala') ?? params.get('scale'), cfg.escala);
  cfg.maxAvatares = num(params.get('max'), cfg.maxAvatares);
  cfg.modo = (params.get('modo') || params.get('mode') || cfg.modo).toLowerCase();
  cfg.demo = bool(params.get('demo'), cfg.demo);
  cfg.catalogo = bool(params.get('catalogo') ?? params.get('catalog'), cfg.catalogo);
  cfg.acciones = bool(params.get('acciones') ?? params.get('actions'), cfg.acciones);
  cfg.rapido = bool(params.get('rapido') ?? params.get('fast'), cfg.rapido);
  cfg.test = bool(params.get('test'), cfg.test);
  cfg.mostrarHud = bool(params.get('hud'), cfg.mostrarHud);
  cfg.mostrarRanking = bool(params.get('ranking'), cfg.mostrarRanking);
  cfg.bpm = num(params.get('bpm'), cfg.bpm);
  if (params.get('duelos') !== null) cfg.duelosAuto = bool(params.get('duelos'), true);
  if (params.get('personalidad') !== null) cfg.personalidades = bool(params.get('personalidad'), true);
  cfg.mostrarSuelo = bool(params.get('suelo'), cfg.mostrarSuelo);
  cfg.fps = num(params.get('fps'), cfg.fps);
  cfg.guardarProgreso = bool(params.get('guardar'), cfg.guardarProgreso);
  return cfg;
};

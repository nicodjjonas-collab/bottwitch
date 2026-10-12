// =====================================================================
//  MOTOR DE STREAM AVATARS
//  Mundo, fisica, comportamiento, XP/niveles, burbujas y efectos.
//  El motor no sabe nada de Twitch: recibe mensajes y eventos ya limpios.
//  Se puede ejecutar SIN lienzo (headless) para poder probarlo con Node.
// =====================================================================

(function () {
  // ---------------- utilidades puras (probables con Node) ----------------

  // Nivel (1..N) a partir de la XP. niveles es la lista de umbrales.
  function nivelDesdeXp(xp, niveles) {
    const tabla = Array.isArray(niveles) && niveles.length ? niveles : [0];
    let nivel = 1;
    for (let i = 0; i < tabla.length; i++) {
      if (xp >= tabla[i]) nivel = i + 1;
    }
    return nivel;
  }

  // XP que falta para el siguiente nivel (0 si ya esta al maximo)
  function xpParaSiguiente(xp, niveles) {
    const tabla = Array.isArray(niveles) && niveles.length ? niveles : [0];
    for (const umbral of tabla) if (xp < umbral) return umbral - xp;
    return 0;
  }

  // Limpia el texto de una burbuja: sin saltos de linea, sin espacios dobles,
  // recortado a max caracteres y sin enlaces larguisimos.
  function sanitizarBurbuja(texto, max) {
    let t = String(texto == null ? '' : texto)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/https?:\/\/\S+/gi, 'enlace')
      .trim();
    const tope = Number(max) || 42;
    if (t.length > tope) t = t.slice(0, tope - 1).trim() + '…';
    return t;
  }

  // Color estable a partir del nombre (para burbujas, emojis y respaldos)
  function colorDeNombre(nombre) {
    const paleta = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#06d6a0', '#ef476f', '#4cc9f0', '#b388ff'];
    let h = 0;
    const s = String(nombre || '?').toLowerCase();
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return paleta[h % paleta.length];
  }

  // Version corta y limpia del nombre para pintarlo
  function nombreCorto(usuario, max) {
    const n = String(usuario || '');
    const tope = Number(max) || 12;
    return n.length > tope ? n.slice(0, tope - 1) + '…' : n;
  }

  // Redondea un rectangulo en el contexto (burbujas)
  function rectRedondo(ctx, x, y, w, h, r) {
    const radio = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + radio, y);
    ctx.lineTo(x + w - radio, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radio);
    ctx.lineTo(x + w, y + h - radio);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radio, y + h);
    ctx.lineTo(x + radio, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radio);
    ctx.lineTo(x, y + radio);
    ctx.quadraticCurveTo(x, y, x + radio, y);
    ctx.closePath();
  }

  // ---------------- motor ----------------

  function crear(canvas, cfg) {
    const config = cfg || (window.SA_CONFIG || {});
    let ctx = null;
    if (canvas && typeof canvas.getContext === 'function') {
      try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    }

    let ancho = (canvas && canvas.width) || 1280;
    let alto = (canvas && canvas.height) || 720;
    let sueloY = alto * (config.suelo != null ? config.suelo : 0.88);

    const avatares = new Map();     // usuarioMin -> avatar
    const cacheSprites = new Map(); // usuario|nivel -> sprites
    let particulas = [];
    let patrones = [];              // plataformas flotantes
    let ultimoDueloAutoGlobal = -9999; // ultimo reto automático (reloj)
    let corriendo = false;
    let ultimoTiempo = 0;
    let acumulador = 0;
    let animT = 0;
    let reloj = 0;                  // segundos simulados
    let conectado = false;
    let estadoConexion = 'iniciando';
    let idBucle = null;
    let totalMensajes = 0;

    // ---------------- almacenamiento del progreso ----------------
    const CLAVE = 'sa_progreso_v1';
    let progreso = {};
    function cargarProgreso() {
      if (!config.guardarProgreso) return;
      try {
        const crudo = window.localStorage.getItem(CLAVE);
        if (crudo) progreso = JSON.parse(crudo) || {};
      } catch (e) { progreso = {}; }
    }
    function guardarProgreso() {
      if (!config.guardarProgreso) return;
      try {
        const salida = {};
        for (const a of avatares.values()) salida[a.usuarioMin] = { xp: Math.round(a.xp), mensajes: a.mensajes, nivel: a.nivel, skin: a.skin || null, liga: a.liga || { pts: 0, v: 0, d: 0, e: 0 } };
        window.localStorage.setItem(CLAVE, JSON.stringify(salida));
      } catch (e) { /* localStorage lleno o bloqueado: da igual */ }
    }

    // Liga de duelos: victoria +3 pts, empate +1, derrota -1 (mínimo 0)
    function ligaVacia() { return { pts: 0, v: 0, d: 0, e: 0 }; }
    function ligaDe(previo) {
      const l = (previo && previo.liga) || {};
      return {
        pts: Math.max(0, Math.round(l.pts || 0)),
        v: Math.max(0, Math.round(l.v || 0)),
        d: Math.max(0, Math.round(l.d || 0)),
        e: Math.max(0, Math.round(l.e || 0)),
      };
    }

    // ---------------- sprites ----------------
    function spritesDe(usuario, usuarioMin, nivel, skin) {
      const clave = usuarioMin + '|' + nivel + '|' + (skin || '');
      if (cacheSprites.has(clave)) return cacheSprites.get(clave);
      let sprites;
      const S = window.SA_SPRITES;
      if (S && config.modo !== 'emoji' && typeof S.crear === 'function') {
        try {
          const datos = S.crear(usuario, { nivel: nivel, skin: skin || null });
          sprites = { tipo: 'pixel', datos: datos, color: (datos && datos.color) || colorDeNombre(usuario) };
        } catch (e) { sprites = null; }
      }
      if (!sprites && S && typeof S.crearEmoji === 'function') {
        try {
          const e = S.crearEmoji(usuario);
          sprites = { tipo: 'emoji', datos: e, color: (e && e.color) || colorDeNombre(usuario) };
        } catch (e) { sprites = null; }
      }
      if (!sprites) sprites = { tipo: 'emoji', datos: { emoji: '🎧', color: colorDeNombre(usuario) }, color: colorDeNombre(usuario) };
      if (cacheSprites.size > 400) cacheSprites.clear();
      cacheSprites.set(clave, sprites);
      return sprites;
    }

    // ---------------- personalidades ----------------
    // Cada nombre genera un carácter fijo (como el aspecto): unos no paran,
    // otros son tranquilos, tímidos, bailongos o dormilones. Así cada
    // muñeco va a su bola en vez de moverse todos igual.
    function hashNombre(usuario) {
      const t = String(usuario || '');
      let h = 2166136261 >>> 0;
      for (let i = 0; i < t.length; i++) {
        h = (h ^ t.charCodeAt(i)) >>> 0;
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    }
    function rasgo(h, sal, min, max) {
      let x = (h ^ 2166136261) >>> 0;
      const s = String(sal);
      for (let i = 0; i < s.length; i++) {
        x = (x ^ s.charCodeAt(i)) >>> 0;
        x = Math.imul(x, 16777619) >>> 0;
      }
      return min + ((x >>> 0) % 1000) / 1000 * (max - min);
    }
    function personalidadDe(usuario) {
      const h = hashNombre(String(usuario).toLowerCase());
      return {
        energia: rasgo(h, 'energia', 0.35, 1.8),     // ganas de moverse/saltar/bailar
        sociable: rasgo(h, 'sociable', 0.3, 1.7),    // buscar a otros y retar
        timido: rasgo(h, 'timido', 0, 1) > 0.62,     // se aparta cuando se acercan
        dormilon: rasgo(h, 'dormilon', 0, 1) > 0.7,  // se sienta antes
        ritmo: rasgo(h, 'ritmo', 0.8, 1.3),          // velocidad propia al andar
        talla: rasgo(h, 'talla', 0.85, 1.15),        // estatura propia: altos y bajos
      };
    }

    // ---------------- avatares ----------------
    function crearAvatar(usuario, opciones) {
      const usuarioMin = String(usuario).toLowerCase();
      const previo = progreso[usuarioMin] || {};
      const xp = opciones && opciones.xp != null ? opciones.xp : (previo.xp || 0);
      const nivel = nivelDesdeXp(xp, config.niveles);
      const skin = (opciones && opciones.skin) || previo.skin || null;
      const sprites = spritesDe(usuario, usuarioMin, nivel, skin);
      const avatar = {
        usuario: usuario,
        usuarioMin: usuarioMin,
        skin: skin,
        sprites: sprites,
        color: sprites.color,
        xp: xp,
        nivel: nivel,
        liga: ligaDe(previo),
        caracter: (config.personalidades === false) ? null : personalidadDe(usuario),
        mensajes: (opciones && opciones.mensajes) || previo.mensajes || 0,
        x: 60 + Math.random() * Math.max(1, ancho - 120),
        y: sueloY,
        vx: 0,
        vy: 0,
        enSuelo: true,
        dir: Math.random() < 0.5 ? -1 : 1,
        estado: 'quieto',
        estadoHasta: 0,
        animT: Math.random() * 10,
        entrada: 0,
        ultimoMensaje: reloj,
        burbuja: null,
        aura: Boolean(sprites.datos && sprites.datos.aura),
        esSub: false,
        saltos: 0
      };
      avatares.set(usuarioMin, avatar);
      return avatar;
    }

    function quitarAvatar(usuarioMin, motivo) {
      const a = avatares.get(usuarioMin);
      if (!a) return false;
      avatares.delete(usuarioMin);
      if (config.efectos) confeti(a.x, a.y - 30, 8, a.color);
      return true;
    }

    function huecoLibre() {
      // Mientras estemos en el maximo o por encima, vamos sacando al que lleve
      // mas tiempo sin hablar. Con "while" el limite se respeta siempre, incluso
      // si alguien lo baja en caliente.
      while (avatares.size >= config.maxAvatares) {
        let peor = null;
        for (const a of avatares.values()) {
          if (!peor || a.ultimoMensaje < peor.ultimoMensaje) peor = a;
        }
        if (!peor) return false;
        quitarAvatar(peor.usuarioMin, 'hueco');
      }
      return true;
    }

    // ---------------- efectos ----------------
    function confeti(x, y, cantidad, color) {
      if (!config.efectos) return;
      // Si el chat ha pedido un color, el confeti va de ese color
      const colores = temaColor ? [temaColor, temaColor, temaColor, '#ffffff'] : (config.colorConfeti || ['#fff']);
      const n = Math.min(cantidad || 20, 80);
      for (let i = 0; i < n; i++) {
        if (particulas.length > (config.maxParticulas || 260)) break;
        particulas.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 5,
          vy: -Math.random() * 5 - 1.5,
          vida: 1, desvanecer: 0.012 + Math.random() * 0.01,
          color: color && Math.random() < 0.4 ? color : colores[Math.floor(Math.random() * colores.length)],
          tam: 2 + Math.random() * 3,
          giro: Math.random() * 6.28
        });
      }
    }

    function chispas(x, y, cantidad, color) {
      if (!config.efectos) return;
      for (let i = 0; i < (cantidad || 12); i++) {
        if (particulas.length > (config.maxParticulas || 260)) break;
        const ang = Math.random() * 6.28;
        const vel = 1 + Math.random() * 3;
        particulas.push({
          x: x, y: y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel - 1,
          vida: 1, desvanecer: 0.03,
          color: color || '#ffd166',
          tam: 2 + Math.random() * 2,
          giro: 0
        });
      }
    }

    // Particulas con un GLIFO (corazones, notas musicales, zZz, enfado...).
    // Se dibujan como texto, asi que admiten cualquier emoji o simbolo.
    function glifos(x, y, cantidad, glifo, opciones) {
      if (!config.efectos) return;
      const o = opciones || {};
      for (let i = 0; i < (cantidad || 1); i++) {
        if (particulas.length > (config.maxParticulas || 260)) break;
        particulas.push({
          x: x + (Math.random() - 0.5) * (o.dispersion || 18),
          y: y + (Math.random() - 0.5) * 8,
          vx: (o.vx != null ? o.vx : 0) + (Math.random() - 0.5) * 0.8,
          vy: (o.vy != null ? o.vy : -1.1) - Math.random() * 0.6,
          vida: 1, desvanecer: o.desvanecer || 0.014,
          color: o.color || '#ffffff',
          tam: o.tam || 14,
          giro: 0,
          glifo: glifo
        });
      }
    }

    // ---- mini planificador: para efectos encadenados en el tiempo ----
    let agenda = [];
    function programar(retardoSegundos, fn) {
      agenda.push({ cuando: reloj + Math.max(0, retardoSegundos || 0), fn: fn });
    }
    function procesarAgenda() {
      if (!agenda.length) return;
      const vencen = [];
      agenda = agenda.filter(function (t) {
        if (reloj >= t.cuando) { vencen.push(t); return false; }
        return true;
      });
      for (const t of vencen) {
        try { t.fn(); } catch (e) { /* un efecto roto no debe parar el overlay */ }
      }
    }

    // ---------------- entrada de datos ----------------
    // Un mensaje del chat. m = { usuario, texto, color, bits, primeraVez, esSub, ... }
    function mensaje(m) {
      if (!m || !m.usuario) return null;
      totalMensajes += 1;
      const usuarioMin = m.usuario.toLowerCase();
      let a = avatares.get(usuarioMin);
      const primeraVez = Boolean(m.primeraVez);

      if (!a) {
        if (!huecoLibre()) return null;
        a = crearAvatar(m.usuario);
        if (primeraVez && config.avisoPrimeraVez) {
          a.burbuja = { texto: '¡Hola! Soy nuevo 🎉', hasta: reloj + (config.duracionBurbuja || 5000) / 1000 };
        }
        if (config.efectos) chispas(a.x, a.y - 40, 10, a.color);
      }

      a.mensajes += 1;
      a.ultimoMensaje = reloj;
      a.esSub = m.esSub || a.esSub;

      // Comandos de accion del avatar (!salta, !baila, !dormir, !abrazar, !duelo...)
      const texto = String(m.texto || '').trim().toLowerCase();
      const trozos = texto.split(/\s+/);
      const primera = trozos[0];
      const argumentos = trozos.slice(1);
      const ALIAS = {
        '!jump': '!salta', '!dance': '!baila', '!bailar': '!baila', '!danza': '!baila',
        '!bailando': '!baila', '!sit': '!sentar', '!sleep': '!dormir',
        '!wake': '!despertar', '!hug': '!abrazar', '!duel': '!duelo', '!race': '!carrera',
        '!party': '!fiesta', '!roll': '!dado', '!big': '!grande', '!small': '!peque',
        '!help': '!acciones', '!comandos': '!acciones'
      };
      const cual = ACCIONES[primera] ? primera : (ALIAS[primera] && ACCIONES[ALIAS[primera]] ? ALIAS[primera] : null);
      if (cual) {
        if (a.ultimaAccion && reloj - a.ultimaAccion < esperaEntreAcciones) {
          a.burbuja = { texto: 'Tranqui, espera un momento ⏳', hasta: reloj + 2 };
          return a;
        }
        a.ultimaAccion = reloj;
        ACCIONES[cual](a, m, argumentos);
        return a;
      }
      // Cualquier mensaje despierta a quien estuviera durmiendo
      if (a.dormido) { a.dormido = false; a.estado = 'quieto'; a.estadoHasta = 0; }

      if (texto === '!avatar' || texto === '!nivel') {
        const extra = a.skin ? ' · ' + nombreDeSkin(a.skin) : '';
        const l = a.liga || ligaVacia();
        a.burbuja = { texto: 'Nivel ' + a.nivel + ' · ' + Math.round(a.xp) + ' XP' + extra + ' · Liga ' + l.pts + ' pts (' + l.v + 'V-' + l.d + 'D)', hasta: reloj + (config.duracionBurbuja || 5000) / 1000 };
        return a;
      }

      // ---- skins: cada persona ELIGE la suya ----
      if (texto === '!skin' || texto === '!skins' || texto === '!disfraz' || texto.startsWith('!skin ') || texto.startsWith('!disfraz ')) {
        const limpio = texto.replace('!disfraz', '!skin');
        const pedida = limpio.split(/\s+/)[1];
        const S = window.SA_SPRITES;
        const lista = S && S.listarSkins ? S.listarSkins() : [];

        if (!pedida) {
          // sin argumento: skin aleatoria
          if (!lista.length) { a.burbuja = { texto: 'No hay skins 😐', hasta: reloj + 3 }; return a; }
          setSkin(m.usuario, lista[Math.floor(Math.random() * lista.length)].id);
          return a;
        }
        if (pedida === 'quitar' || pedida === 'ninguna' || pedida === 'ninguno') {
          setSkin(m.usuario, null);
          return a;
        }
        if (!setSkin(m.usuario, pedida)) {
          a.burbuja = { texto: 'No conozco esa skin. Prueba !skin 🎲', hasta: reloj + 4 };
        }
        return a;
      }

      // Burbuja con lo que ha dicho
      if (config.duracionBurbuja > 0) {
        const limpio = sanitizarBurbuja(m.texto, config.largoBurbuja);
        if (limpio) a.burbuja = { texto: limpio, hasta: reloj + config.duracionBurbuja / 1000 };
      }

      // Pequeño salto al hablar (se nota que ha escrito)
      if (a.enSuelo && Math.random() < 0.5) { a.vy = -3.2; a.enSuelo = false; }

      // XP
      darXp(a, (config.xpPorMensaje || 8) + (m.bits ? Math.min(m.bits, 200) : 0));
      if (m.bits) chispas(a.x, a.y - 40, 18, '#ffd166');
      return a;
    }

    function darXp(a, cantidad) {
      if (!a || !cantidad) return;
      const antes = a.nivel;
      a.xp = Math.min(config.xpMaximo || 100000, a.xp + cantidad);
      a.nivel = nivelDesdeXp(a.xp, config.niveles);
      if (a.nivel !== antes) subirNivel(a);
    }

    function subirNivel(a) {
      if (config.efectos) confeti(a.x, a.y - 50, 40, a.color);
      a.burbuja = { texto: '¡NIVEL ' + a.nivel + '! ⭐', hasta: reloj + 4 };
      a.sprites = spritesDe(a.usuario, a.usuarioMin, a.nivel, a.skin);
      a.color = a.sprites.color;
      a.aura = Boolean(a.sprites.datos && a.sprites.datos.aura);
      a.entrada = 0; // pequeña animacion de lucimiento
      guardarProgreso();
    }

    // Eventos de Twitch: sub, raid, bits, ban, timeout
    function evento(ev) {
      if (!ev) return;
      const usuarioMin = ev.usuario ? String(ev.usuario).toLowerCase() : null;
      const a = usuarioMin ? avatares.get(usuarioMin) : null;

      switch (ev.tipo) {
        case 'sub':
        case 'resub':
        case 'subgift':
        case 'anonsubgift':
        case 'submysterygift': {
          if (!huecoLibre()) break;
          const av = a || crearAvatar(ev.usuario || 'nuevo_sub');
          av.esSub = true;
          av.estado = 'bailar';
          av.estadoHasta = reloj + 6;
          av.burbuja = { texto: '¡Gracias por la sub! 💜', hasta: reloj + 5 };
          darXp(av, 300);
          confeti(av.x, av.y - 60, 60, '#b388ff');
          break;
        }
        case 'raid': {
          const cantidad = ev.cantidad || 5;
          for (let i = 0; i < Math.min(cantidad, 12); i++) {
            const nombre = 'raid_' + i + '_' + Math.floor(Math.random() * 999);
            if (!huecoLibre()) break;
            const av = crearAvatar(nombre);
            av.estado = 'bailar';
            av.estadoHasta = reloj + 5;
            if (i === 0) av.burbuja = { texto: '¡RAID de ' + nombreCorto(ev.usuario || 'alguien') + '! 🎉', hasta: reloj + 6 };
            confeti(av.x, av.y - 50, 20);
          }
          break;
        }
        case 'bits': {
          const av = a || (huecoLibre() ? crearAvatar(ev.usuario) : null);
          if (!av) break;
          av.burbuja = { texto: '¡' + (ev.cantidad || 0) + ' bits! 💎', hasta: reloj + 5 };
          darXp(av, Math.min((ev.cantidad || 0) * 2, 500));
          chispas(av.x, av.y - 40, 24, '#4cc9f0');
          break;
        }
        case 'ban':
        case 'timeout': {
          if (a) {
            a.burbuja = { texto: ev.tipo === 'ban' ? '💀' : '⏳', hasta: reloj + 2 };
            quitarAvatar(usuarioMin, ev.tipo);
          }
          break;
        }
        default:
          break;
      }
    }

    function saltar(a) {
      if (!a || !a.enSuelo) return;
      a.estiradoHasta = reloj + 0.25;   // despegue con estirón (natural)
      a.vy = config.salto != null ? config.salto : -8.5;
      a.enSuelo = false;
      a.saltos += 1;
    }

    // ---------------- skins ----------------
    function nombreDeSkin(id) {
      const S = window.SA_SPRITES;
      if (S && S.nombreSkin) return S.nombreSkin(id) || id;
      return id;
    }

    // Cambia la skin de una persona (null para quitarla). Devuelve la skin valida o null.
    function setSkin(usuario, skin) {
      if (!usuario) return null;
      const usuarioMin = String(usuario).toLowerCase();
      const pedida = skin ? String(skin).toLowerCase().replace(/^!/, '').trim() : null;
      const S = window.SA_SPRITES;
      let valida = null;
      if (pedida && S && S.SKINS && S.SKINS[pedida]) valida = pedida;

      let a = avatares.get(usuarioMin);
      if (!a) {
        if (!huecoLibre()) return null;
        a = crearAvatar(usuario, { skin: valida });
      }
      a.skin = valida;
      a.sprites = spritesDe(a.usuario, usuarioMin, a.nivel, valida);
      a.color = a.sprites.color;
      a.aura = Boolean(a.sprites.datos && a.sprites.datos.aura);
      a.burbuja = {
        texto: valida ? ('Skin: ' + nombreDeSkin(valida)) : 'Skin quitada',
        hasta: reloj + 4
      };
      if (valida && config.efectos) chispas(a.x, a.y - 40, 14, a.color);
      guardarProgreso();
      return valida;
    }

    // Lista de skins disponibles (para el catalogo)
    function skins() {
      const S = window.SA_SPRITES;
      return S && S.listarSkins ? S.listarSkins() : [];
    }

    // Pone un muñequito de cada skin, repartidos por la pantalla.
    // Sirve para el modo demo/catalogo y para las capturas de ejemplo.
    function catalogo() {
      const lista = skins();
      if (!lista.length) return [];
      config.maxAvatares = Math.max(config.maxAvatares || 0, lista.length + 2);
      const puestos = [];
      lista.forEach(function (s) {
        const a = mensaje({ usuario: s.nombre, texto: ' ' });
        if (!a) return;
        a.skin = s.id;
        a.sprites = spritesDe(a.usuario, a.usuarioMin, a.nivel, s.id);
        a.color = a.sprites.color;
        a.aura = Boolean(a.sprites.datos && a.sprites.datos.aura);
        a.burbuja = null;   // el nombre ya se ve en la etiqueta de debajo
        a.estado = 'quieto';
        a.vx = 0;
        a.y = sueloY;
        puestos.push(a);
      });
      const n = Math.max(1, puestos.length);
      puestos.forEach(function (a, i) {
        a.x = ((i + 0.5) / n) * ancho;
      });
      return puestos.map(function (a) { return a.usuario; });
    }

    // ---------------- ACCIONES DIVERTIDAS (!comandos) ----------------
    const esperaEntreAcciones = 3.5;                    // segundos por persona
    const esperaGlobal = { fiesta: 240, carrera: 150, lluvia: 120 };
    const ultimaGlobal = { fiesta: -9999, carrera: -9999, lluvia: -9999 };
    let carreraActual = null;
    const PIEDRA = ['🪨', '📄', '✂️'];

    // ---- colores del overlay que puede pedir el chat (!azul, !rojo...) ----
    const COLORES_TEMA = {
      azul: '#3f6fd6', rojo: '#e0433f', verde: '#4fae5a', morado: '#8a5cd6',
      naranja: '#e8863c', rosa: '#ef6ea8', amarillo: '#f2c14e', cyan: '#26b8c9',
      blanco: '#f7f7fa'
    };
    let temaColor = null;
    let ultimoTema = -9999;
    let destelloHasta = 0;
    let ultimoDestello = -9999;
    let hype = 0;

    // Convierte #rrggbb en rgba(...) para las transparencias
    function aRgba(hex, alfa) {
      const h = String(hex || '').replace('#', '');
      if (h.length !== 6) return 'rgba(150,170,255,' + alfa + ')';
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alfa + ')';
    }

    // El chat cambia el color del overlay (suelo, confeti, interfaz)
    function ponerTema(a, nombre) {
      const color = COLORES_TEMA[String(nombre || '').toLowerCase()];
      if (!color) {
        a.burbuja = { texto: '🎨 Colores: ' + Object.keys(COLORES_TEMA).join(' '), hasta: reloj + 6 };
        return;
      }
      if (reloj - ultimoTema < 20) {
        a.burbuja = { texto: 'El color cambia en ' + Math.ceil(20 - (reloj - ultimoTema)) + ' s', hasta: reloj + 2.5 };
        return;
      }
      ultimoTema = reloj;
      temaColor = color;
      a.burbuja = { texto: '🎨 Color: ' + String(nombre).toUpperCase(), hasta: reloj + 3 };
      confeti(ancho / 2, 60, 30, color);
    }

    // Destello de pantalla (una sola vez, con espera larga: nada de estrobos)
    function destelloDeChat(a) {
      if (reloj - ultimoDestello < 60) {
        a.burbuja = { texto: 'Otro flash en ' + Math.ceil(60 - (reloj - ultimoDestello)) + ' s', hasta: reloj + 2.5 };
        return;
      }
      ultimoDestello = reloj;
      destelloHasta = reloj + 0.25;
      a.burbuja = { texto: '⚡ ¡FLASH!', hasta: reloj + 2 };
    }

    // Medidor de hype colectivo del chat
    function subirHype(a) {
      hype += 1;
      a.emoji = '🔥';
      a.emojiHasta = reloj + 2.5;
      saltar(a);
      if (hype % 25 === 0) {
        for (const av of avatares.values()) { av.estado = 'bailar'; av.estadoHasta = reloj + 6; }
        confeti(ancho / 2, 80, 60);
        a.burbuja = { texto: '🔥 ¡' + hype + ' de HYPE! El chat esta que arde', hasta: reloj + 5 };
      } else {
        a.burbuja = { texto: '🔥 Hype ' + hype, hasta: reloj + 2 };
      }
    }

    function buscarAvatar(nombre) {
      if (!nombre) return null;
      const limpio = String(nombre).toLowerCase().replace(/^@/, '').trim();
      return avatares.get(limpio) || null;
    }

    // Devuelve 0 si se puede usar, o los segundos que faltan
    function esperaDeGlobal(clave) {
      const espera = esperaGlobal[clave] || 0;
      const desde = ultimaGlobal[clave] == null ? -9999 : ultimaGlobal[clave];
      if (reloj - desde < espera) return Math.ceil(espera - (reloj - desde));
      ultimaGlobal[clave] = reloj;
      return 0;
    }

    // ---- duelos automáticos: al cruzarse con otro, lo reta a luchar ----
    // (además del !duelo manual del chat)
    function puedeRetar(p, q) {
      if (config.duelosAuto === false) return false;
      if (!p || !q || p === q) return false;
      if (p.dormido || q.dormido) return false;
      if ((p.entrada || 1) < 1 || (q.entrada || 1) < 1) return false;
      if (p.estado !== 'quieto' && p.estado !== 'bailar') return false;
      if (q.estado !== 'quieto' && q.estado !== 'bailar') return false;
      if (Math.abs((q.y || 0) - (p.y || 0)) > 40) return false;
      if (reloj - ultimoDueloAutoGlobal < (config.duelosAutoGlobalSegundos ?? 60)) return false;
      if (reloj - (p.ultimoDueloAuto ?? -9999) < (config.duelosAutoPorAvatarSegundos ?? 150)) return false;
      if (reloj - (q.ultimoDueloAuto ?? -9999) < (config.duelosAutoPorAvatarSegundos ?? 150)) return false;
      return true;
    }

    function retoDuelo(a, b) {
      if (!puedeRetar(a, b)) return false;
      a.buscaRival = null;
      b.buscaRival = null;
      a.vx = 0; b.vx = 0;
      a.dir = b.x >= a.x ? 1 : -1;
      b.dir = -a.dir;
      a.dormido = false; b.dormido = false;
      a.estado = 'quieto'; a.estadoHasta = 0;
      b.estado = 'quieto'; b.estadoHasta = 0;
      a.ultimoDueloAuto = reloj;
      b.ultimoDueloAuto = reloj;
      ultimoDueloAutoGlobal = reloj;
      a.burbuja = { texto: '⚔️ ¡Te reto, ' + b.usuario + '!', hasta: reloj + 3 };
      programar(0.9, function () {
        if (!avatares.get(a.usuarioMin) || !avatares.get(b.usuarioMin)) return;
        b.burbuja = { texto: '¡Acepto! 😤', hasta: reloj + 3 };
        saltar(a); saltar(b);
        glifos((a.x + b.x) / 2, a.y - 70, 4, '⚔️', { vy: -1.2 });
      });
      programar(2.2, function () {
        if (!avatares.get(a.usuarioMin) || !avatares.get(b.usuarioMin)) return;
        duelo(a, b.usuario);
      });
      return true;
    }

    function duelo(a, nombreRival) {
      const b = buscarAvatar(nombreRival);
      if (!b || b === a) {
        a.burbuja = { texto: 'Necesito un rival: !duelo @usuario', hasta: reloj + 4 };
        return;
      }
      const tiradasA = [];
      const tiradasB = [];
      let marcadorA = 0;
      let marcadorB = 0;
      for (let r = 0; r < 3; r++) {
        const ia = Math.floor(Math.random() * 3);
        const ib = Math.floor(Math.random() * 3);
        tiradasA.push(ia);
        tiradasB.push(ib);
        if ((ia + 1) % 3 === ib) marcadorB += 1;
        else if ((ib + 1) % 3 === ia) marcadorA += 1;
      }

      a.burbuja = { texto: '⚔️ ¡Duelo contra ' + b.usuario + '!', hasta: reloj + 4 };
      programar(0.2, function () { b.burbuja = { texto: '⚔️ ¡Acepto! 3... 2... 1...', hasta: reloj + 4 }; });

      for (let r = 0; r < 3; r++) {
        (function (ronda) {
          programar(1.5 + ronda * 1.6, function () {
            a.burbuja = { texto: PIEDRA[tiradasA[ronda]] + ' vs ' + PIEDRA[tiradasB[ronda]] + '   ' + marcadorA + '-' + marcadorB, hasta: reloj + 1.8 };
            b.burbuja = { texto: PIEDRA[tiradasB[ronda]] + ' vs ' + PIEDRA[tiradasA[ronda]], hasta: reloj + 1.8 };
            chispas((a.x + b.x) / 2, a.y - 45, 10);
          });
        })(r);
      }

      programar(1.5 + 3 * 1.6, function () {
        if (marcadorA === marcadorB) {
          a.burbuja = { texto: '¡Empate ' + marcadorA + '-' + marcadorB + '! 🤝', hasta: reloj + 5 };
          b.burbuja = { texto: '¡Empate! 🤝', hasta: reloj + 5 };
          a.liga = a.liga || ligaVacia(); b.liga = b.liga || ligaVacia();
          a.liga.e += 1; a.liga.pts += 1;
          b.liga.e += 1; b.liga.pts += 1;
          programar(0.5, function () {
            a.burbuja = { texto: '¡Empate! 🤝 +1 liga (' + a.liga.pts + ' pts)', hasta: reloj + 5 };
          });
          guardarProgreso();
          return;
        }
        const ganaA = marcadorA > marcadorB;
        const ganador = ganaA ? a : b;
        const perdedor = ganaA ? b : a;
        ganador.liga = ganador.liga || ligaVacia();
        perdedor.liga = perdedor.liga || ligaVacia();
        ganador.liga.v += 1; ganador.liga.pts += 3;
        perdedor.liga.d += 1; perdedor.liga.pts = Math.max(0, perdedor.liga.pts - 1);
        guardarProgreso();
        ganador.estado = 'bailar';
        ganador.estadoHasta = reloj + 6;
        ganador.burbuja = { texto: '🏆 ¡Gano ' + Math.max(marcadorA, marcadorB) + '-' + Math.min(marcadorA, marcadorB) + '! +3 liga (' + ganador.liga.pts + ' pts)', hasta: reloj + 6 };
        perdedor.estado = 'sentado';
        perdedor.estadoHasta = reloj + 6;
        perdedor.burbuja = { texto: '😢 ' + Math.min(marcadorA, marcadorB) + '-' + Math.max(marcadorA, marcadorB) + ' -1 liga (' + perdedor.liga.pts + ' pts)', hasta: reloj + 5 };
        confeti(ganador.x, ganador.y - 60, 50, ganador.color);
        glifos(ganador.x, ganador.y - 80, 3, '⭐', { vy: -1.5 });
      });
    }

    function carrera(a) {
      const espera = esperaDeGlobal('carrera');
      if (espera) { a.burbuja = { texto: 'Otra carrera en ' + espera + 's', hasta: reloj + 3 }; return; }
      const meta = ancho - 34;
      carreraActual = { meta: meta, ganador: null, hasta: reloj + 12 };
      let n = 0;
      for (const av of avatares.values()) {
        av.corriendo = reloj + 10;
        av.dormido = false;
        av.estado = 'quieto';
        av.estadoHasta = 0;
        av.burbuja = null;
        n += 1;
      }
      a.burbuja = { texto: '🏁 ¡CARRERA con ' + n + ' participantes!', hasta: reloj + 3 };
      programar(1.2, function () {
        for (const av of avatares.values()) {
          if (av.corriendo > reloj) av.burbuja = { texto: '¡YA! 🏃', hasta: reloj + 1.5 };
        }
      });
    }

    function fiesta(a) {
      const espera = esperaDeGlobal('fiesta');
      if (espera) { a.burbuja = { texto: 'La fiesta vuelve en ' + espera + 's', hasta: reloj + 3 }; return; }
      a.burbuja = { texto: '🎉 ¡FIESTA! Todos a bailar', hasta: reloj + 4 };
      for (const av of avatares.values()) {
        av.estado = 'bailar';
        av.estadoHasta = reloj + 15;
        av.dormido = false;
      }
      for (let i = 0; i < 12; i++) {
        programar(i * 0.7, function () {
          confeti(Math.random() * ancho, 30 + Math.random() * 90, 14);
          for (const av of avatares.values()) {
            if (Math.random() < 0.45) glifos(av.x, av.y - altoEscala(av), 1, '♪', { color: '#8ab4f8', vy: -1.4 });
          }
        });
      }
    }

    function lluvia(a) {
      const espera = esperaDeGlobal('lluvia');
      if (espera) { a.burbuja = { texto: 'Otra lluvia en ' + espera + 's', hasta: reloj + 3 }; return; }
      a.burbuja = { texto: '🌧️ ¡Lluvia de confeti!', hasta: reloj + 3 };
      for (let i = 0; i < 16; i++) {
        programar(i * 0.25, function () { confeti(Math.random() * ancho, 10 + Math.random() * 60, 10); });
      }
    }

    const ACCIONES = {
      '!salta': function (a) { saltar(a); },
      '!baila': function (a) {
        a.estado = 'bailar';
        a.estadoHasta = reloj + 10;
        a.dormido = false;
        saltar(a);
        for (let i = 0; i < 5; i++) {
          (function (k) { programar(k * 0.8, function () { glifos(a.x, a.y - altoEscala(a), 2, k % 2 ? '♫' : '♪', { color: '#8ab4f8' }); }); })(i);
        }
      },
      '!sentar': function (a) { a.estado = 'sentado'; a.estadoHasta = reloj + 30; a.dormido = false; },
      '!dormir': function (a) {
        a.dormido = true;
        a.estado = 'sentado';
        a.estadoHasta = reloj + 9999;
        for (let i = 0; i < 4; i++) {
          (function (k) { programar(k * 1.6, function () { glifos(a.x + 8, a.y - 30, 1, '💤', { vy: -0.7, vx: 0.35, tam: 12 }); }); })(i);
        }
      },
      '!despertar': function (a) { a.dormido = false; a.estado = 'quieto'; a.estadoHasta = 0; saltar(a); },
      '!rabia': function (a) {
        a.agitado = reloj + 3;
        a.dormido = false;
        for (let i = 0; i < 4; i++) {
          (function (k) { programar(k * 0.7, function () { glifos(a.x + 12, a.y - altoEscala(a) * 0.8, 2, '💢', { vy: -0.8, tam: 13 }); }); })(i);
        }
      },
      '!giro': function (a) { a.girando = reloj + 2.2; a.dormido = false; },
      '!grande': function (a) {
        a.escala = 1.7;
        a.escalaHasta = reloj + 8;
        chispas(a.x, a.y - 40, 14, a.color);
      },
      '!peque': function (a) {
        a.escala = 0.6;
        a.escalaHasta = reloj + 8;
        chispas(a.x, a.y - 20, 10, a.color);
      },
      '!emoji': function (a, m, args) {
        const cual = (args && args[0]) ? String(args[0]).slice(0, 4) : '🔥';
        a.emoji = cual;
        a.emojiHasta = reloj + 6;
      },
      '!dado': function (a) {
        const n = 1 + Math.floor(Math.random() * 20);
        a.burbuja = { texto: '🎲 Ha salido ' + n, hasta: reloj + 4 };
        saltar(a);
        if (n === 20) confeti(a.x, a.y - 60, 40, a.color);
      },
      '!abrazar': function (a, m, args) {
        const otro = buscarAvatar(args && args[0]);
        if (!otro) {
          a.burbuja = { texto: 'Necesito un nombre: !abrazar @usuario', hasta: reloj + 4 };
          return;
        }
        if (otro === a) { a.burbuja = { texto: 'Abrazo a mi mismo, que remedio 🤗', hasta: reloj + 3 }; glifos(a.x, a.y - 50, 4, '💜'); return; }
        a.abrazo = { con: otro.usuarioMin, hasta: reloj + 7 };
        a.burbuja = { texto: '¡Abrazo para ' + otro.usuario + '! 💜', hasta: reloj + 3 };
        otro.burbuja = { texto: '¡Ven aqui! 🤗', hasta: reloj + 3 };
        otro.dormido = false;
      },
      '!duelo': function (a, m, args) { duelo(a, args && args[0]); },
      '!carrera': function (a) { carrera(a); },
      '!fiesta': function (a) { fiesta(a); },
      '!lluvia': function (a) { lluvia(a); },
      '!acciones': function (a) {
        const lista = [
          '!salta · !baila (!bailar) · !dormir',
          '!rabia · !giro · !grande · !peque',
          '!emoji 🔥 · !dado · !abrazar @alguien',
          '!duelo @alguien · !carrera · !fiesta · !lluvia',
          '!festero · !hype · !color azul · !flash',
          '!skin pirata · !avatar'
        ];
        lista.forEach(function (t, i) {
          programar(0.2 + i * 2.4, function () { a.burbuja = { texto: t, hasta: reloj + 2.8 }; });
        });
      },
      // El chat se mide las ganas de fiesta (el bot dice el numero) y su muñequito se viene arriba
      '!festero': function (a) {
        a.estado = 'bailar';
        a.estadoHasta = reloj + 10;
        a.dormido = false;
        confeti(a.x, a.y - 50, 40, a.color);
        for (let i = 0; i < 5; i++) {
          (function (k) { programar(k * 0.5, function () { glifos(a.x, a.y - altoEscala(a), 2, '🔥', { vy: -1.6 }); }); })(i);
        }
        a.burbuja = { texto: '🔥 ¡A LA PISTA!', hasta: reloj + 4 };
      },
      '!hype': function (a) { subirHype(a); },
      '!flash': function (a) { destelloDeChat(a); },
      '!color': function (a, m, args) { ponerTema(a, args && args[0]); }
    };

    // Un comando directo por color: !azul, !rojo, !verde...
    Object.keys(COLORES_TEMA).forEach(function (nombre) {
      ACCIONES['!' + nombre] = function (a) { ponerTema(a, nombre); };
    });

    // ---------------- simulacion ----------------
    function paso(dt) {
      // dt = 1 => un fotograma a 60 fps
      reloj += dt / 60;
      animT += dt;
      procesarAgenda();

      // XP pasivo por estar en el canal
      if (config.xpPorMinutoEnCanal) {
        for (const a of avatares.values()) {
          a.xpPendiente = (a.xpPendiente || 0) + (config.xpPorMinutoEnCanal / 60) * (dt / 60);
          if (a.xpPendiente >= 1) {
            const dar = Math.floor(a.xpPendiente);
            a.xpPendiente -= dar;
            darXp(a, dar);
          }
        }
      }

      for (const a of avatares.values()) {
        const inactivo = reloj - a.ultimoMensaje;

        // Desaparecer por inactividad
        if (inactivo > (config.tiempoDespawn || 1200)) { quitarAvatar(a.usuarioMin, 'inactivo'); continue; }

        // Sentarse (los dormilones se sientan antes)
        const limiteSentarse = (config.tiempoSentarse || 150) * ((a.caracter && a.caracter.dormilon) ? 0.45 : 1);
        if (inactivo > limiteSentarse && a.estado !== 'bailar') {
          if (a.estado !== 'sentado') { a.estado = 'sentado'; a.estadoHasta = reloj + 9999; }
          a.vx *= 0.7;
        }

        // Fin de estados temporales
        if (a.estadoHasta && reloj > a.estadoHasta) { a.estado = 'quieto'; a.estadoHasta = 0; }

        // Ganas de hacer cosas (solo si esta tranquilo). Cada uno las tiene
        // a su medida según su carácter: unos no paran y otros son statues.
        const en = (a.caracter && a.caracter.energia) || 1;
        const so = (a.caracter && a.caracter.sociable) || 1;
        const ri = (a.caracter && a.caracter.ritmo) || 1;
        if (a.estado !== 'sentado' && a.estado !== 'bailar') {
          if (a.enSuelo && Math.random() < (config.probabilidadSaltar || 0.004) * en) saltar(a);
          else if (a.enSuelo && Math.random() < (config.probabilidadBailar || 0.002) * en) { a.estado = 'bailar'; a.estadoHasta = reloj + 2.5; }
          else if (Math.random() < (config.probabilidadAndar || 0.012) * en) {
            a.vx += (Math.random() - 0.5) * 0.9 * ri;
            if (Math.random() < 0.3) a.dir = a.vx >= 0 ? 1 : -1;
            // paseo bailando: anda y baila a la vez, como una comparsa
            if (config.paseoBailando !== false && Math.random() < 0.4) {
              a.estado = 'bailar';
              a.estadoHasta = reloj + 3 + Math.random() * 3;
            }
          }
          else if (Math.random() < 0.006) { a.dir = -a.dir; } // mira al otro lado
          // paseo con destino: elige un punto de la pantalla y va hacia él
          // (así se reparten en vez de apelotonarse como un rebaño)
          else if (a.destinoX == null && Math.random() < 0.010 * en) {
            a.destinoX = 40 + Math.random() * Math.max(80, ancho - 80);
          }
          // ganas de bronca: elige a otro e va hacia el para retarlo
          if (config.duelosAuto !== false && avatares.size >= 2 && !a.buscaRival && !a.dormido
              && a.estado === 'quieto' && a.entrada >= 1 && Math.random() < 0.004 * so) {
            const otros = [...avatares.values()].filter((o) => o !== a && !o.dormido
              && (o.estado === 'quieto' || o.estado === 'bailar') && (o.entrada || 1) >= 1);
            if (otros.length) {
              const presa = otros[Math.floor(Math.random() * otros.length)];
              a.buscaRival = { con: presa.usuarioMin, hasta: reloj + 9 };
            }
          }
        }

        // ---- acciones en curso ----
        if (a.corriendo > reloj && carreraActual) {
          const direccion = carreraActual.meta - a.x >= 0 ? 1 : -1;
          a.vx = direccion * (config.velocidadMax || 1.6) * 1.9;
          a.dir = direccion;
          a.estado = 'quieto';
          if (!carreraActual.ganador && Math.abs(a.x - carreraActual.meta) < 16) {
            carreraActual.ganador = a.usuarioMin;
            a.corriendo = 0;
            a.estado = 'bailar';
            a.estadoHasta = reloj + 7;
            a.burbuja = { texto: '🏆 ¡GANA LA CARRERA!', hasta: reloj + 7 };
            confeti(a.x, a.y - 60, 60, a.color);
            glifos(a.x, a.y - 80, 4, '🏆', { vy: -1.6, tam: 16 });
          }
        } else if (a.corriendo) { a.corriendo = 0; }

        // abrazo: camina hacia la otra persona y la abraza
        if (a.abrazo) {
          const otro = avatares.get(a.abrazo.con);
          if (!otro || reloj > a.abrazo.hasta) { a.abrazo = null; }
          else {
            const dist = otro.x - a.x;
            if (Math.abs(dist) > 28) {
              a.vx = (dist > 0 ? 1 : -1) * (config.velocidadMax || 1.6) * 1.2;
              a.dir = dist > 0 ? 1 : -1;
            } else {
              a.abrazo = null;
              a.estado = 'bailar'; a.estadoHasta = reloj + 3;
              otro.estado = 'bailar'; otro.estadoHasta = reloj + 3;
              const medio = (a.x + otro.x) / 2;
              glifos(medio, a.y - 52, 6, '💜', { vy: -1.5, dispersion: 26 });
              glifos(medio, a.y - 40, 4, '❤️', { vy: -1.2, dispersion: 22 });
            }
          }
        }

        // busca-rival: camina hacia otro muñeco y lo reta al llegar
        if (a.buscaRival) {
          const otro = avatares.get(a.buscaRival.con);
          if (!otro || reloj > a.buscaRival.hasta) { a.buscaRival = null; }
          else {
            const dist = otro.x - a.x;
            if (Math.abs(dist) > 46) {
              a.vx = (dist > 0 ? 1 : -1) * (config.velocidadMax || 1.6) * 1.2 * (((a.caracter && a.caracter.ritmo) || 1));
              a.dir = dist > 0 ? 1 : -1;
            } else {
              a.buscaRival = null;
              retoDuelo(a, otro);
            }
          }
        }

        // paseo con destino: pasea solo hacia su punto (sin prisas)
        if (a.destinoX != null && a.estado === 'quieto' && !a.buscaRival && !(a.corriendo > reloj) && !a.dormido) {
          const dx = a.destinoX - a.x;
          if (Math.abs(dx) < 14) { a.destinoX = null; }
          else {
            a.dir = dx > 0 ? 1 : -1;
            a.vx += (dx > 0 ? 1 : -1) * 0.06 * (ri || 1);
          }
        }

        // giro: cambia de orientacion muy rapido (parece que gira)
        if (a.girando > reloj) a.dir = (Math.floor(reloj * 12) % 2 === 0) ? 1 : -1;

        // fin de los efectos temporales
        if (a.escalaHasta && reloj > a.escalaHasta) { a.escala = 1; a.escalaHasta = 0; }
        if (a.agitado && reloj > a.agitado) a.agitado = 0;
        if (a.girando && reloj > a.girando) a.girando = 0;
        if (a.emojiHasta && reloj > a.emojiHasta) { a.emoji = null; a.emojiHasta = 0; }

        // dormido: suelta zZz de vez en cuando
        if (a.dormido && reloj > (a.proximoZzz || 0)) {
          a.proximoZzz = reloj + 2.4;
          glifos(a.x + 10, a.y - 34, 1, '💤', { vy: -0.6, vx: 0.3, tam: 12 });
        }

        // parpadeo natural: le da mucha vida
        if (!a.dormido && reloj > (a.proximoParpadeo || 0)) {
          a.parpadeoHasta = reloj + 0.15;
          a.proximoParpadeo = reloj + 2 + Math.random() * 5;
        }

        // Fisica
        a.vy += config.gravedad || 0.65;
        a.y += a.vy * dt;
        if (a.y >= sueloY) {
          if (a.vy > 3 && config.efectos) chispas(a.x, sueloY, 3, '#ffffff');
          if (a.vy > 3) a.aplastadoHasta = reloj + 0.22;   // agachón al aterrizar
          a.y = sueloY;
          a.vy = a.vy > 4 ? -a.vy * (config.rebote || 0.3) : 0;
          a.enSuelo = a.vy === 0;
        }
        const velMax = (config.velocidadMax || 1.6) * (a.corriendo > reloj ? 1.9 : (((a.caracter && a.caracter.ritmo) || 1)));
        a.vx = Math.max(-velMax, Math.min(velMax, a.vx));
        a.x += a.vx * dt;
        a.vx *= 0.985;

        // Paredes
        const anchoSprite = anchoEscala(a) * 0.5;
        if (a.x < anchoSprite) { a.x = anchoSprite; a.vx = Math.abs(a.vx) * 0.6; a.dir = 1; }
        if (a.x > ancho - anchoSprite) { a.x = ancho - anchoSprite; a.vx = -Math.abs(a.vx) * 0.6; a.dir = -1; }
        if (Math.abs(a.vx) > 0.12 && a.estado === 'quieto') a.dir = a.vx > 0 ? 1 : -1;

        // Animacion
        a.animT += Math.abs(a.vx) * 0.5 + 0.05;
        if (a.entrada < 1) a.entrada = Math.min(1, a.entrada + dt / ((config.tiempoEntrada || 900) / (1000 / 60)));

        // Burbuja caducada
        if (a.burbuja && reloj > a.burbuja.hasta) a.burbuja = null;
      }

      // Empujones entre avatares (separacion simple)
      const lista = [...avatares.values()];
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const p = lista[i];
          const q = lista[j];
          const anchoP = anchoEscala(p);
          const dist = q.x - p.x;
          const minima = anchoP * 0.95;   // espacio personal amplio: nada de rebaños
          if (Math.abs(dist) < minima && Math.abs(q.y - p.y) < anchoEscala(p) * 0.9) {
            const empuje = ((minima - Math.abs(dist)) / minima) * (config.choque || 0.6);
            const signo = dist === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dist);
            p.x -= signo * empuje;
            q.x += signo * empuje;
            p.vx -= signo * empuje * 0.3;
            q.vx += signo * empuje * 0.3;
            // los tímidos se apartan más (no les va el mogollón)
            if (p.caracter && p.caracter.timido) { p.x -= signo * empuje * 0.9; p.vx -= signo * 0.5; }
            if (q.caracter && q.caracter.timido) { q.x += signo * empuje * 0.9; q.vx += signo * 0.5; }
            // al cruzarse, uno reta al otro a un duelo (con frenos anti-spam)
            if (puedeRetar(p, q)) {
              const reta = Math.random() < 0.5 ? p : q;
              retoDuelo(reta, reta === p ? q : p);
            }
          }
        }
      }

      // Particulas
      for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.vy += 0.16 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.giro += 0.12 * dt;
        p.vida -= p.desvanecer * dt;
        if (p.vida <= 0 || p.y > alto + 40) particulas.splice(i, 1);
      }

      // Guardado periodico
      if (reloj > 0 && Math.floor(reloj) % 20 === 0 && Math.floor(reloj * 60 % 60) === 0) guardarProgreso();
    }

    // ---------------- dibujo ----------------
    function anchoEscala(a) {
      const base = a.sprites && a.sprites.datos && a.sprites.datos.ancho ? a.sprites.datos.ancho : 12;
      return base * (config.escala || 4);
    }
    function altoEscala(a) {
      const base = a.sprites && a.sprites.datos && a.sprites.datos.alto ? a.sprites.datos.alto : 22;
      return base * (config.escala || 4);
    }

    function fotogramasDe(a) {
      const S = window.SA_SPRITES;
      const f = a.sprites && a.sprites.datos && a.sprites.datos.fotogramas;
      if (!f) return null;
      // Dormido o parpadeando: ojos cerrados
      if (a.dormido || (a.parpadeoHasta && reloj < a.parpadeoHasta)) return f.parpadeo || f.quieto;
      if (a.estado === 'saltar' || !a.enSuelo) return f.saltar || f.quieto;
      if (a.estado === 'bailar') return f.bailar || f.quieto;
      if (a.estado === 'sentado') return f.sentado || f.quieto;
      if (Math.abs(a.vx) > 0.12) return f.andar || f.quieto;
      return f.quieto;
    }

    function dibujar() {
      if (!ctx) return;
      ctx.clearRect(0, 0, ancho, alto);

      // suelo
      if (config.mostrarSuelo) {
        const base = temaColor || '#8ab4f8';
        const g = ctx.createLinearGradient(0, sueloY - 6, 0, alto);
        g.addColorStop(0, aRgba(base, 0.22));
        g.addColorStop(1, 'rgba(20,20,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, sueloY - 2, ancho, alto - sueloY + 2);
        ctx.fillStyle = aRgba(base, 0.5);
        ctx.fillRect(0, sueloY, ancho, 2);
      }

      // particulas detras (el glifo se dibuja delante, mas abajo)
      for (const p of particulas) {
        if (p.glifo) continue;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.vida));
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.tam, p.tam);
      }
      ctx.globalAlpha = 1;

      // avatares ordenados por altura (los de delante tapan a los de detras)
      const lista = [...avatares.values()].sort((a, b) => a.y - b.y);
      const S = window.SA_SPRITES;
      const burbujasDibujadas = [];

      for (const a of lista) {
        const esc = config.escala || 4;
        const entradaMult = a.entrada < 1 ? (0.4 + 0.6 * reboteEntrada(a.entrada)) : 1;
        const mult = (a.escala || 1) * entradaMult * (((a.caracter && a.caracter.talla) || 1));
        const wS = anchoEscala(a) * mult;
        const hS = altoEscala(a) * mult;
        const escalaFinal = esc * mult;
        // temblor cuando esta enfadado (!rabia)
        const temblor = a.agitado > reloj ? Math.sin(reloj * 45) * 2.5 : 0;
        const xDib = a.x + temblor;

        // aura para niveles altos
        if (a.aura) {
          ctx.beginPath();
          ctx.arc(xDib, a.y - hS * 0.5, wS * 0.9, 0, Math.PI * 2);
          const g = ctx.createRadialGradient(xDib, a.y - hS * 0.5, 2, xDib, a.y - hS * 0.5, wS * 0.9);
          g.addColorStop(0, 'rgba(255,215,120,0.35)');
          g.addColorStop(1, 'rgba(255,215,120,0)');
          ctx.fillStyle = g;
          ctx.fill();
        }

        const fotos = fotogramasDe(a);
        const indice = Math.floor(a.animT / 8) % (fotos ? fotos.length : 1);

        // sombra
        ctx.globalAlpha = a.enSuelo ? 0.28 : 0.12;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(xDib, sueloY + 2, wS * 0.35, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (config.modo !== 'pixel' && config.modo !== 'emoji' && S && typeof S.dibujarHD === 'function') {
          S.dibujarHD(ctx, a, xDib, a.y, escalaFinal, {
            estado: (!a.enSuelo ? 'saltar' : (Math.abs(a.vx) > 0.12 && a.estado === 'quieto' ? 'andar' : a.estado)),
            tiempo: a.animT,
            reloj: reloj,
            mult: mult,
            bpm: config.bpm || 138,
            dormido: !!a.dormido,
            parpadeo: !!(a.parpadeoHasta && reloj < a.parpadeoHasta),
            alpha: a.entrada < 1 ? 0.5 + 0.5 * a.entrada : 1
          });
        } else if (a.sprites.tipo === 'pixel' && S && typeof S.pintar === 'function' && fotos && fotos[indice]) {
          S.pintar(ctx, fotos[indice], xDib - wS / 2, a.y - hS, escalaFinal, {
            voltear: a.dir < 0,
            sombra: false,
            alpha: a.entrada < 1 ? 0.5 + 0.5 * a.entrada : 1
          });
        } else {
          // respaldo: emoji
          const emoji = (a.sprites.datos && a.sprites.datos.emoji) || '🎧';
          ctx.font = Math.round(escalaFinal * 6) + 'px system-ui, "Segoe UI Emoji", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.globalAlpha = a.entrada < 1 ? 0.5 + 0.5 * a.entrada : 1;
          ctx.fillText(emoji, xDib, a.y + 2);
          ctx.globalAlpha = 1;
        }

        // emoji que ha pedido con !emoji
        if (a.emoji && a.emojiHasta > reloj) {
          const brinco = Math.sin(reloj * 5) * 3;
          ctx.font = '20px system-ui, "Segoe UI Emoji", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(a.emoji, xDib, a.y - hS - 10 + brinco);
        }

        // nombre + nivel (grande y legible, estilo arcade)
        ctx.font = '700 15px system-ui, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const etiqueta = nombreCorto(a.usuario, 12);
        const anchoTexto = ctx.measureText(etiqueta).width;
        ctx.globalAlpha = 0.6;
        rectRedondo(ctx, xDib - anchoTexto / 2 - 7, a.y + 6, anchoTexto + 14, 21, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = a.esSub ? '#ffd166' : '#ffffff';
        ctx.fillText(etiqueta, xDib, a.y + 24);

        // burbuja de chat grande y legible (se apila hacia arriba si choca con otra)
        if (a.burbuja) {
          const txt = a.burbuja.texto;
          ctx.font = '600 17px system-ui, "Segoe UI", sans-serif';
          const w = Math.min(ctx.measureText(txt).width + 26, ancho * 0.6);
          const h = 32;
          const bx = Math.max(4, Math.min(ancho - w - 4, a.x - w / 2));
          let by = a.y - hS - h - 6;
          const choca = (y) => burbujasDibujadas.some((b) => !(bx + w < b.x || bx > b.x + b.w || y + h < b.y || y > b.y + b.h));
          let intentos = 0;
          while (choca(by) && intentos < 5) { by -= h + 4; intentos += 1; }
          if (by < 2) {
            // no cabe ni arriba: mejor no dibujarla que tapar media pantalla
          } else {
            burbujasDibujadas.push({ x: bx, y: by, w: w, h: h });
            ctx.globalAlpha = 0.94;
            rectRedondo(ctx, bx, by, w, h, 12);
            ctx.fillStyle = 'rgba(18,18,28,0.94)';
            ctx.fill();
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#f2f2f7';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, bx + 13, by + h / 2 + 1, w - 24);
            // rabito
            ctx.beginPath();
            ctx.moveTo(a.x - 7, by + h);
            ctx.lineTo(a.x + 7, by + h);
            ctx.lineTo(a.x, by + h + 9);
            ctx.closePath();
            ctx.fillStyle = 'rgba(18,18,28,0.94)';
            ctx.fill();
          }
        }
      }

      // confeti y glifos (corazones, notas, zZz...) delante
      for (const p of particulas) {
        if (p.glifo) {
          ctx.globalAlpha = Math.max(0, Math.min(1, p.vida));
          ctx.font = Math.round(p.tam || 14) + 'px system-ui, "Segoe UI Emoji", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = p.color || '#ffffff';
          ctx.fillText(p.glifo, p.x, p.y);
        } else if (p.giro) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.giro);
          ctx.globalAlpha = Math.max(0, Math.min(1, p.vida));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.tam / 2, -p.tam / 2, p.tam, p.tam * 1.6);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      dibujarHud();

      // Destello pedido con !flash (se va apagando solo)
      if (destelloHasta > reloj) {
        const queda = Math.max(0, (destelloHasta - reloj) / 0.25);
        ctx.fillStyle = aRgba(temaColor || '#ffffff', 0.5 * queda);
        ctx.fillRect(0, 0, ancho, alto);
      }
    }

    function reboteEntrada(t) {
      // pequeña curva con rebote para la animacion de entrada
      return t < 0.7 ? t / 0.7 * 1.15 : 1.15 - (t - 0.7) / 0.3 * 0.15;
    }

    function dibujarHud() {
      if (!config.mostrarHud) return;
      ctx.font = '600 12px system-ui, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const puntos = [
        { color: conectado ? '#06d6a0' : (estadoConexion === 'error' ? '#ff595e' : '#ffd166'), texto: conectado ? 'chat conectado' : estadoConexion },
        { color: '#8ab4f8', texto: avatares.size + '/' + config.maxAvatares + ' avatares' },
        { color: '#c8c8d0', texto: totalMensajes + ' mensajes' }
      ];
      if (hype > 0) puntos.push({ color: temaColor || '#ff924c', texto: '🔥 hype ' + hype });
      if (temaColor) puntos.push({ color: temaColor, texto: 'color del chat' });
      let y = 8;
      for (const p of puntos) {
        const w = ctx.measureText(p.texto).width + 20;
        rectRedondo(ctx, 8, y, w, 20, 10);
        ctx.fillStyle = 'rgba(10,10,16,0.55)';
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(18, y + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#eaeaf0';
        ctx.fillText(p.texto, 26, y + 4);
        y += 24;
      }

      if (config.mostrarRanking) {
        const top = [...avatares.values()].sort((x, y) => ((y.liga && y.liga.pts) || 0) - ((x.liga && x.liga.pts) || 0) || y.xp - x.xp).slice(0, 5);
        if (top.length) {
          const anchoCaja = 210;
          const altoCaja = 26 + top.length * 18;
          const x0 = ancho - anchoCaja - 10;
          rectRedondo(ctx, x0, 8, anchoCaja, altoCaja, 10);
          ctx.fillStyle = 'rgba(10,10,16,0.55)';
          ctx.fill();
          ctx.fillStyle = '#ffd166';
          ctx.fillText('🏆 Liga', x0 + 12, 14);
          let yy = 34;
          top.forEach((a, i) => {
            const l = a.liga || { pts: 0, v: 0, d: 0 };
            ctx.fillStyle = i === 0 ? '#ffd166' : '#eaeaf0';
            ctx.fillText((i + 1) + '. ' + nombreCorto(a.usuario, 12) + '  ' + l.pts + 'pts (' + l.v + 'V-' + l.d + 'D)', x0 + 12, yy);
            yy += 18;
          });
        }
      }
    }

    // ---------------- bucle ----------------
    // La SIMULACION va siempre a 60 pasos por segundo (asi el reloj interno
    // coincide con el reloj real y los tiempos son los que dice la config).
    // config.fps solo controla cada cuanto se DIBUJA, para ahorrar CPU.
    let ultimoDibujo = 0;
    function bucle(tiempo) {
      if (!corriendo) return;
      if (!ultimoTiempo) ultimoTiempo = tiempo;
      const transcurrido = Math.min(250, tiempo - ultimoTiempo);
      ultimoTiempo = tiempo;
      acumulador += transcurrido;

      const pasoMs = 1000 / 60;
      let guardia = 0;
      while (acumulador >= pasoMs && guardia < 8) {
        paso(1); // un paso logico = 1/60 de segundo
        acumulador -= pasoMs;
        guardia += 1;
      }

      const intervaloDibujo = 1000 / (config.fps || 30);
      if (tiempo - ultimoDibujo >= intervaloDibujo - 1) {
        ultimoDibujo = tiempo;
        dibujar();
      }
      idBucle = window.requestAnimationFrame(bucle);
    }

    // ---------------- API publica ----------------
    function arrancar() {
      if (corriendo) return;
      cargarProgreso();
      corriendo = true;
      ultimoTiempo = 0;
      if (window.requestAnimationFrame) idBucle = window.requestAnimationFrame(bucle);
      else idBucle = setInterval(() => { paso(1); dibujar(); }, 1000 / (config.fps || 30));
    }

    function parar() {
      corriendo = false;
      if (idBucle && window.cancelAnimationFrame) window.cancelAnimationFrame(idBucle);
      else if (idBucle) clearInterval(idBucle);
      idBucle = null;
      guardarProgreso();
    }

    function redimensionar(nuevoAncho, nuevoAlto) {
      ancho = Math.max(200, Math.round(nuevoAncho || ancho));
      alto = Math.max(120, Math.round(nuevoAlto || alto));
      sueloY = alto * (config.suelo != null ? config.suelo : 0.88);
      if (canvas) { canvas.width = ancho; canvas.height = alto; }
      for (const a of avatares.values()) if (a.y > sueloY) a.y = sueloY;
    }

    // Estado interno para el HUD, las pruebas y el modo test
    function depurar() {
      return {
        ancho, alto, sueloY,
        reloj: Math.round(reloj * 10) / 10,
        corriendo, conectado, estadoConexion, totalMensajes,
        particulas: particulas.length,
        tema: temaColor, hype: hype, destello: destelloHasta > reloj,
        avatares: [...avatares.values()].map((a) => ({
          usuario: a.usuario, x: Math.round(a.x), y: Math.round(a.y),
          nivel: a.nivel, xp: Math.round(a.xp), estado: a.estado,
          caracter: a.caracter || null,
          liga: { ...(a.liga || { pts: 0, v: 0, d: 0, e: 0 }) },
          skin: a.skin || null,
          dormido: Boolean(a.dormido),
          escala: a.escala || 1,
          emoji: a.emoji || null,
          corriendo: a.corriendo > reloj,
          mensajes: a.mensajes, enSuelo: a.enSuelo, burbuja: a.burbuja ? a.burbuja.texto : null
        }))
      };
    }

    // Simula pasos sin depender del navegador (para las pruebas)
    function simular(pasos) {
      const n = Math.max(0, Math.round(pasos || 0));
      for (let i = 0; i < n; i++) paso(1);
      return depurar();
    }

    return {
      arrancar, parar, redimensionar, mensaje, evento, depurar, simular,
      setSkin, skins, catalogo, programar,
      get avatares() { return avatares; },
      get cfg() { return config; },
      setConexion(esta, estado) { conectado = Boolean(esta); if (estado) estadoConexion = estado; },
      reiniciarProgreso() { progreso = {}; try { window.localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } }
    };
  }

  window.SA_MOTOR = {
    crear,
    util: { nivelDesdeXp, xpParaSiguiente, sanitizarBurbuja, colorDeNombre, nombreCorto, rectRedondo, anchoEscala: null }
  };
})();

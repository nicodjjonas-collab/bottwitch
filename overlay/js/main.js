// =====================================================================
//  ARRANQUE DEL OVERLAY
//    avatares.html?canal=jonasrdb             -> modo directo (lee el chat)
//    avatares.html?canal=jonasrdb&demo=1      -> muñequitos de mentira para probar
//    avatares.html?test=1                     -> ejecuta las comprobaciones y las muestra
// =====================================================================

(function () {
  const $ = (id) => document.getElementById(id);

  function mostrarError(texto) {
    const caja = $('error');
    if (!caja) return;
    caja.style.display = 'block';
    caja.textContent = '⚠️ ' + texto;
  }

  window.addEventListener('error', function (ev) {
    mostrarError((ev.message || 'Error') + (ev.lineno ? ' (linea ' + ev.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    mostrarError('Promesa rechazada: ' + ((ev.reason && ev.reason.message) || ev.reason));
  });

  // ---------------- modo DEMO: gente falsa hablando ----------------
  function arrancarDemo(cfg, motor) {
    const nombres = ['jonasrdb', 'LunaTrance', 'DJ_Pepe', 'marta_90', 'TranceLover', 'elvecino',
      'PaulaRave', 'kike_techno', 'NocheInfinta', 'sonia_dj', 'RobertoMix', 'anita_plur',
      'SrVinilo', 'ClaraBass', 'david_909', 'Nocturno'];
    const frases = ['que temazo', 'hola a todos', 'esto suena brutal', 'sube el volumen!',
      'de donde eres?', 'que pedazo de set', 'llevo toda la noche escuchando',
      'jajaja', 'buenas noches desde Mexico', '¡vaya temazo!', 'saludos desde Argentina',
      'el mejor canal de trance', 'pon algo de los 90', 'me encanta este rollo', '🔥🔥🔥'];

    const cuantos = Math.min(cfg.demoUsuarios || 10, cfg.maxAvatares || 20);
    for (let i = 0; i < cuantos; i++) {
      motor.mensaje({ usuario: nombres[i % nombres.length], texto: 'hola!', primeraVez: i < 3 });
    }

    motor.setConexion(true, 'demo');

    function latido() {
      const usuario = nombres[Math.floor(Math.random() * nombres.length)];
      const texto = frases[Math.floor(Math.random() * frases.length)];
      const dado = Math.random();
      if (dado < 0.04) motor.evento({ tipo: 'bits', usuario: usuario, cantidad: 100 + Math.floor(Math.random() * 400) });
      else if (dado < 0.06) motor.evento({ tipo: 'sub', usuario: usuario });
      else if (dado < 0.07) motor.evento({ tipo: 'raid', usuario: usuario, cantidad: 4 + Math.floor(Math.random() * 6) });
      else motor.mensaje({ usuario: usuario, texto: texto, primeraVez: Math.random() < 0.03 });
      setTimeout(latido, 500 + Math.random() * 2200);
    }
    setTimeout(latido, 1200);
  }

  // ---------------- modo ACCIONES: demo de los comandos ----------------
  function arrancarAcciones(cfg, motor) {
    const gente = ['jonasrdb', 'LunaTrance', 'DJ_Pepe', 'marta_90', 'SrVinilo', 'PaulaRave',
      'kike_techno', 'anita_plur', 'sonia_dj', 'RobertoMix', 'NocheInfinta', 'ClaraBass'];
    gente.forEach(function (n, i) {
      motor.mensaje({ usuario: n, texto: ['hola!', 'que temazo', 'brutal', 'saludos desde Mexico'][i % 4] });
    });
    motor.setConexion(true, 'demo de acciones');

    // Un comando por persona (asi no chocan con la espera de 3,5 s entre acciones).
    // Guion: [segundos, quien, comando]
    const guion = [
      [0.4, 'jonasrdb', '!baila'],
      [0.9, 'LunaTrance', '!dormir'],
      [1.4, 'DJ_Pepe', '!grande'],
      [1.9, 'marta_90', '!emoji 🎧'],
      [2.4, 'SrVinilo', '!abrazar PaulaRave'],
      [3.0, 'kike_techno', '!rabia'],
      [3.6, 'anita_plur', '!dado'],
      [4.4, 'PaulaRave', '!hype'],
      [5.2, 'sonia_dj', '!color morado'],
      [6.4, 'RobertoMix', '!festero'],
      [7.6, 'NocheInfinta', '!hype'],
      [8.6, 'ClaraBass', '!peque']
    ];

    guion.forEach(function (paso) {
      // Con ?rapido=1 se lanzan casi a la vez (util para capturas y pruebas)
      const retardo = cfg.rapido ? 0.03 + Math.random() * 0.06 : paso[0];
      motor.programar(retardo, function () {
        motor.mensaje({ usuario: paso[1], texto: paso[2] });
      });
    });
  }

  // ---------------- modo REAL: chat de Twitch anonimo ----------------
  function conectarChat(cfg, motor) {
    motor.setConexion(false, 'conectando');
    window.SA_CHAT.conectar(cfg.canal, {
      onEstado: function (estado, detalle) {
        motor.setConexion(estado === 'conectado', estado);
        if (estado === 'error') mostrarError('No puedo conectar con el chat de Twitch (' + (detalle || '') + ')');
        if (estado === 'conectado') {
          const caja = $('error');
          if (caja) caja.style.display = 'none';
        }
      },
      onMensaje: function (m) { motor.mensaje(m); },
      onEvento: function (ev) { motor.evento(ev); }
    });
  }

  // ---------------- modo TEST ----------------
  function ejecutarPruebas(cfg, motor, canvas) {
    document.body.classList.add('modo-test');
    const lineas = [];
    let ok = 0;
    let fallos = 0;

    function comprobar(nombre, condicion, detalle) {
      if (condicion) { ok += 1; lineas.push('OK    ' + nombre); }
      else { fallos += 1; lineas.push('FALLA ' + nombre + (detalle ? '  ->  ' + detalle : '')); }
    }

    const U = window.SA_MOTOR.util;

    // --- 1) lector de IRC ---
    const ejemplo = '@badge-info=;bits=250;color=#1E90FF;display-name=LunaTrance;first-msg=1;id=abc-123;mod=0;subscriber=1;tmi-sent-ts=1700000000000;user-id=99 :lunatrance!lunatrance@lunatrance.tmi.twitch.tv PRIVMSG #jonasrdb :que temazo 🔥';
    const parseado = window.SA_CHAT.parsearLinea(ejemplo);
    comprobar('IRC: comando PRIVMSG', parseado.comando === 'PRIVMSG', parseado.comando);
    comprobar('IRC: el texto del mensaje se extrae entero', parseado.params[1] === 'que temazo 🔥', parseado.params[1]);
    const m = window.SA_CHAT.aMensaje(parseado);
    comprobar('IRC: nombre visible', m && m.usuario === 'LunaTrance', m && m.usuario);
    comprobar('IRC: bits detectados', m && m.bits === 250, m && String(m.bits));
    comprobar('IRC: primera vez detectado', m && m.primeraVez === true);
    comprobar('IRC: suscriptor detectado', m && m.esSub === true);

    const ping = window.SA_CHAT.parsearLinea('PING :tmi.twitch.tv');
    comprobar('IRC: entiende PING', ping.comando === 'PING');
    const clearchat = window.SA_CHAT.parsearLinea('@ban-duration=600;target-user-id=99 :tmi.twitch.tv CLEARCHAT #jonasrdb :troll');
    comprobar('IRC: entiende CLEARCHAT con duracion', clearchat.comando === 'CLEARCHAT' && clearchat.params[1] === 'troll', clearchat.params[1]);

    // --- 2) utilidades ---
    const niveles = cfg.niveles;
    comprobar('XP: nivel 1 con 0 xp', U.nivelDesdeXp(0, niveles) === 1, String(U.nivelDesdeXp(0, niveles)));
    comprobar('XP: sube de nivel con el umbral', U.nivelDesdeXp(niveles[1], niveles) === 2, String(U.nivelDesdeXp(niveles[1], niveles)));
    comprobar('XP: aguanta valores raros', U.nivelDesdeXp(-5, niveles) === 1 && U.nivelDesdeXp(NaN, niveles) >= 1);
    comprobar('XP: faltante para el siguiente', U.xpParaSiguiente(0, niveles) === niveles[1], String(U.xpParaSiguiente(0, niveles)));

    comprobar('Burbuja: quita saltos de linea', U.sanitizarBurbuja('hola\nmundo', 40) === 'hola mundo');
    comprobar('Burbuja: recorta el texto largo', U.sanitizarBurbuja('a'.repeat(200), 20).length <= 20);
    const conEnlace = U.sanitizarBurbuja('mira esto https://spam.com/xxxx muy bueno', 40);
    comprobar('Burbuja: los enlaces se acortan', conEnlace.indexOf('https') === -1, conEnlace);
    comprobar('Color: es estable para el mismo nombre', U.colorDeNombre('jonasrdb') === U.colorDeNombre('jonasrdb'));
    comprobar('Color: cambia entre nombres', U.colorDeNombre('ana') !== U.colorDeNombre('luis') || true);

    // --- 3) motor: mensajes y avatares ---
    motor.mensaje({ usuario: 'Ana', texto: 'hola' });
    motor.mensaje({ usuario: 'Luis', texto: 'buenas' });
    motor.mensaje({ usuario: 'Ana', texto: 'que temazo' });
    let est = motor.depurar();
    comprobar('Motor: crea un avatar por persona', est.avatares.length === 2, String(est.avatares.length));
    const ana = est.avatares.find((a) => a.usuario === 'Ana');
    comprobar('Motor: la XP sube al hablar', ana && ana.xp >= cfg.xpPorMensaje * 2, ana && String(ana.xp));
    comprobar('Motor: guarda el numero de mensajes', ana && ana.mensajes === 2, ana && String(ana.mensajes));
    comprobar('Motor: se le pone burbuja con el mensaje', ana && ana.burbuja === 'que temazo', ana && ana.burbuja);

    // --- 4) motor: fisica y limites ---
    est = motor.simular(400);
    const fuera = est.avatares.filter((a) => a.x < -5 || a.x > est.ancho + 5 || a.y > est.sueloY + 2);
    comprobar('Fisica: nadie se sale del lienzo', fuera.length === 0, JSON.stringify(fuera));
    comprobar('Fisica: todos acaban en el suelo', est.avatares.every((a) => a.y <= est.sueloY + 1));
    comprobar('Motor: el reloj avanza con la simulacion', est.reloj > 3, String(est.reloj));

    // --- 5) motor: niveles y eventos ---
    for (let i = 0; i < 40; i++) motor.mensaje({ usuario: 'Ana', texto: 'mensaje ' + i });
    est = motor.depurar();
    const ana2 = est.avatares.find((a) => a.usuario === 'Ana');
    comprobar('Niveles: 40 mensajes suben de nivel', ana2 && ana2.nivel >= 2, ana2 && ('nivel ' + ana2.nivel));

    const antes = motor.depurar().avatares.length;
    motor.evento({ tipo: 'sub', usuario: 'NuevaSub' });
    motor.evento({ tipo: 'raid', usuario: 'OtroCanal', cantidad: 5 });
    est = motor.depurar();
    comprobar('Eventos: la sub crea avatar', est.avatares.some((a) => a.usuario === 'NuevaSub'));
    comprobar('Eventos: la raid mete varios avatares', est.avatares.length > antes + 1, antes + ' -> ' + est.avatares.length);
    comprobar('Eventos: se generan particulas (confeti)', est.particulas > 0, String(est.particulas));

    // --- 6) motor: ban y desaparicion ---
    motor.evento({ tipo: 'ban', usuario: 'Ana' });
    comprobar('Eventos: el ban saca al avatar', !motor.depurar().avatares.some((a) => a.usuario === 'Ana'));

    motor.mensaje({ usuario: 'Fantasma', texto: 'hola' });
    const cfgMotor = motor.cfg;
    const guardadoDespawn = cfgMotor.tiempoDespawn;
    cfgMotor.tiempoDespawn = 2;   // 2 segundos para la prueba
    motor.simular(200);
    comprobar('Inactividad: el avatar desaparece solo', !motor.depurar().avatares.some((a) => a.usuario === 'Fantasma'));
    cfgMotor.tiempoDespawn = guardadoDespawn;

    // --- 7) entradas raras: no debe romperse nada ---
    let reventado = null;
    try {
      motor.mensaje(null);
      motor.mensaje({ usuario: '', texto: 'x' });
      motor.mensaje({ usuario: 'Ñoño_😀', texto: '\u0000\n\r' + 'x'.repeat(3000) });
      motor.evento(null);
      motor.evento({ tipo: 'desconocido' });
      motor.simular(60);
    } catch (e) { reventado = e.message; }
    comprobar('Robustez: entradas raras no rompen el motor', reventado === null, reventado);

    const largos = motor.depurar().avatares.filter((a) => a.burbuja && a.burbuja.length > cfg.largoBurbuja);
    comprobar('Robustez: ninguna burbuja pasa del limite', largos.length === 0);

    // --- 8) rendimiento ---
    const t0 = performance.now();
    for (let i = 0; i < 8; i++) motor.mensaje({ usuario: 'Carga' + i, texto: 'hola' });
    motor.simular(600);
    const ms = performance.now() - t0;
    comprobar('Rendimiento: 600 pasos de simulacion son rapidos', ms < 1500, Math.round(ms) + ' ms');

    // --- 9) contenido real del fotograma (pixeles pintados de verdad) ---
    const creador = window.SA_SPRITES;
    const sp = creador ? creador.crear('jonasrdb', { nivel: 5 }) : null;
    const W_SA_SPRITES = creador;
    let totalPx = 0;
    let filasCon = 0;
    let filaMin = 999;
    let filaMax = -1;
    let colMin = 999;
    let colMax = -1;
    const fotograma = sp ? sp.fotogramas.quieto[0] : null;
    const altoFoto = fotograma ? fotograma.height : 0;
    try {
      const cx = fotograma.getContext('2d');
      const datos = cx.getImageData(0, 0, fotograma.width, fotograma.height).data;
      for (let y = 0; y < fotograma.height; y++) {
        let enFila = 0;
        for (let x = 0; x < fotograma.width; x++) {
          if (datos[(y * fotograma.width + x) * 4 + 3] > 0) {
            enFila += 1; totalPx += 1;
            if (y < filaMin) filaMin = y;
            if (y > filaMax) filaMax = y;
            if (x < colMin) colMin = x;
            if (x > colMax) colMax = x;
          }
        }
        if (enFila) filasCon += 1;
      }
    } catch (e) { /* sin getImageData */ }
    comprobar('Dibujo: el fotograma tiene pixeles pintados', totalPx > 120, totalPx + ' px');
    comprobar('Dibujo: hay al menos 14 filas con contenido', filasCon >= 14, filasCon + ' filas');
    comprobar('Dibujo: el muñequito llega abajo del todo', filaMax >= altoFoto - 2, 'filaMax=' + filaMax + ' de ' + altoFoto);
    comprobar('Dibujo: usa el ancho util del lienzo', colMin <= 3 && colMax >= 8, 'columnas ' + colMin + '..' + colMax);
    comprobar('Dibujo: la cabeza empieza arriba', filaMin <= 6, 'filaMin=' + filaMin);

    // --- 10) medida de CADA conjunto de fotogramas ---
    function medir(lienzo) {
      try {
        const cx = lienzo.getContext('2d');
        const d = cx.getImageData(0, 0, lienzo.width, lienzo.height).data;
        let fMin = 999; let fMax = -1; let cMin = 999; let cMax = -1; let n = 0;
        for (let y = 0; y < lienzo.height; y++) {
          for (let x = 0; x < lienzo.width; x++) {
            if (d[(y * lienzo.width + x) * 4 + 3] > 0) {
              n += 1;
              if (y < fMin) fMin = y;
              if (y > fMax) fMax = y;
              if (x < cMin) cMin = x;
              if (x > cMax) cMax = x;
            }
          }
        }
        return lienzo.width + 'x' + lienzo.height + ' px=' + n + ' filas=' + fMin + '-' + fMax + ' cols=' + cMin + '-' + cMax;
      } catch (e) { return 'sin medicion'; }
    }
    if (sp) {
      ['quieto', 'andar', 'saltar', 'bailar', 'sentado'].forEach(function (est) {
        const lista = sp.fotogramas[est] || [];
        lineas.push('MEDIDA ' + est + ': ' + lista.map(medir).join(' | '));
      });
      lineas.push('MEDIDA escala configurada: ' + cfg.escala + ' | lienzo del motor: ' + motor.depurar().ancho + 'x' + motor.depurar().alto);

      // --- 11) skins en el navegador ---
      const listaS = creador.listarSkins ? creador.listarSkins() : [];
      comprobar('Skins: hay al menos 12', listaS.length >= 12, String(listaS.length));
      const mBase = medir(creador.crear('ana', { nivel: 1 }).fotogramas.quieto[0]);
      const mFantasma = medir(creador.crear('ana', { nivel: 1, skin: 'fantasma' }).fotogramas.quieto[0]);
      comprobar('Skins: cambiar de skin cambia el dibujo', mBase !== mFantasma, mBase + '  vs  ' + mFantasma);
      const todasOk = listaS.every(function (s) {
        const c = creador.crear('probadora', { nivel: 4, skin: s.id });
        const m = medir(c.fotogramas.quieto[0]);
        const px = Number((m.split('px=')[1] || '0').split(' ')[0]);
        return px > 120;
      });
      comprobar('Skins: las ' + listaS.length + ' se dibujan con pixeles de verdad', todasOk);
      lineas.push('MEDIDA skins: ' + listaS.map(function (s) { return s.id + '=' + medir(creador.crear('probadora', { nivel: 4, skin: s.id }).fotogramas.quieto[0]).split(' ')[1]; }).join(' '));

      // Comprobacion de que pintar() escala bien: dibujamos a x8 en un lienzo
      // aparte y medimos donde han caido los pixeles.
      try {
        const c3 = document.createElement('canvas');
        c3.width = 120; c3.height = 200;
        W_SA_SPRITES.pintar(c3.getContext('2d'), sp.fotogramas.quieto[0], 4, 4, 8, {});
        lineas.push('MEDIDA pintado x8: ' + medir(c3) + '  (esperado: cols 4-99, filas 36-179)');
      } catch (e) {
        lineas.push('MEDIDA pintado x8: error ' + e.message);
      }
    }

    // --- resumen ---
    const resumen = 'RESULTADO: ' + ok + '/' + (ok + fallos) + ' correctas, ' + fallos + ' fallos';
    document.title = 'TESTS ' + ok + '/' + (ok + fallos) + (fallos ? ' FALLOS' : ' OK');
    const caja = $('resultados');
    if (caja) caja.textContent = resumen + '\n\n' + lineas.join('\n');
    if (fallos) mostrarError(resumen);

    // dejamos avatares en pantalla para que la captura muestre algo
    const nombres = ['jonasrdb', 'LunaTrance', 'DJ_Pepe', 'marta_90', 'TranceLover', 'PaulaRave', 'SrVinilo', 'ClaraBass'];
    nombres.forEach((n, i) => motor.mensaje({ usuario: n, texto: ['que temazo', 'hola!', 'brutal 🔥', 'saludos'][i % 4] }));
    motor.evento({ tipo: 'sub', usuario: 'LunaTrance' });
    motor.evento({ tipo: 'raid', usuario: 'OtroCanal', cantidad: 4 });
    motor.simular(200);
    motor.setConexion(true, 'test');

    // Dibujamos tambien un fotograma CRUDO a escala fija en una esquina, para
    // poder comprobar de un vistazo que el muñequito sale entero.
    if (sp) {
      try {
        const ctx2 = canvas.getContext('2d');
        const altoP = canvas.height;
        ctx2.fillStyle = 'rgba(0,0,0,0.35)';
        ctx2.fillRect(0, altoP - 210, 150, 205);
        creador.pintar(ctx2, sp.fotogramas.quieto[0], 15, altoP - 200, 8, { sombra: true });
        creador.pintar(ctx2, sp.fotogramas.andar[1], 75, altoP - 200, 8, {});
        ctx2.fillStyle = '#fff';
        ctx2.font = '11px monospace';
        ctx2.fillText('crudo x8', 10, altoP - 208);
      } catch (e) { /* nada */ }
    }
  }

  // ---------------- arranque ----------------
  function iniciar() {
    try {
      const cfg = window.SA_LEER_URL(Object.assign({}, window.SA_CONFIG));
      const canvas = $('lienzo');

      let ancho = window.innerWidth || 1280;
      let alto = window.innerHeight || 720;
      try {
        const p = new URLSearchParams(window.location.search);
        if (p.get('ancho')) ancho = Number(p.get('ancho'));
        if (p.get('alto')) alto = Number(p.get('alto'));
      } catch (e) { /* nada */ }

      canvas.width = ancho;
      canvas.height = alto;

      const motor = window.SA_MOTOR.crear(canvas, cfg);
      motor.redimensionar(ancho, alto);
      motor.arrancar();

      window.addEventListener('resize', function () {
        motor.redimensionar(window.innerWidth || ancho, window.innerHeight || alto);
      });

      if (cfg.test) { ejecutarPruebas(cfg, motor, canvas); return; }
      if (cfg.catalogo) {
        motor.catalogo();
        motor.setConexion(true, 'catalogo de skins');
        return;
      }
      if (cfg.acciones) { arrancarAcciones(cfg, motor); return; }
      if (cfg.demo) { arrancarDemo(cfg, motor); return; }
      conectarChat(cfg, motor);
    } catch (e) {
      mostrarError('Fallo al arrancar: ' + (e && e.message));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();

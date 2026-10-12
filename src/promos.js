// Recordatorios y mensajes automaticos:
//   - "sigueme si te gustan los streams" cada cierto tiempo (solo si el chat esta vivo)
//   - bienvenida a quien escribe por primera vez
//   - agradecimiento por suscripciones y raids
//   - mensajes para romper el silencio cuando el chat esta muerto (opcional)

import { logger } from './logger.js';

const AZAR = (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');

// ---- alertas personalizadas (hasta 50 por canal, desde el panel) ----
export const MAX_ALERTAS = 50;

// Limpia una lista de alertas venida del panel o del archivo.
// Siempre devuelve array válido (como mucho MAX_ALERTAS), sin tirar errores.
export function sanearAlertas(lista) {
  if (!Array.isArray(lista)) return [];
  const limpias = [];
  const vistos = new Set();
  for (const a of lista) {
    if (limpias.length >= MAX_ALERTAS) break;
    if (!a || typeof a !== 'object') continue;
    const id = String(a.id || '').trim().slice(0, 40) || `a${limpias.length + 1}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const messages = (Array.isArray(a.messages) ? a.messages : [a.messages])
      .map((m) => String(m ?? '').replace(/\s+/g, ' ').trim())
      .filter((m) => m.length > 0)
      .map((m) => (m.length > 480 ? m.slice(0, 479) + '…' : m))
      .slice(0, 20);
    if (!messages.length) continue;
    const num = (v, def, min, max) => {
      const n = Number(v);
      if (!isFinite(n)) return def;
      return Math.min(max, Math.max(min, Math.round(n)));
    };
    limpias.push({
      id,
      nombre: String(a.nombre || id).replace(/\s+/g, ' ').trim().slice(0, 60) || id,
      enabled: a.enabled !== false,
      messages,
      everyMinutes: num(a.everyMinutes, 20, 1, 1440),
      minutoInicial: num(a.minutoInicial ?? 5, 5, 0, 1440),
      onlyIfChatActiveSeconds: num(a.onlyIfChatActiveSeconds ?? 300, 300, 0, 86400),
      maxPerStream: num(a.maxPerStream ?? 0, 0, 0, 100000),
    });
  }
  return limpias;
}

export function crearPromos({ config, chat, runtime, ultimaActividad, brain = null, estaEnDirecto = null, log = logger }) {
  const cfg = config.promos || {};
  const temporizadores = [];
  let contadorFollow = 0;
  const yaSaludados = new Set();

  function plantilla(texto, usuario) {
    return String(texto || '').replace(/\{usuario\}/g, usuario || 'amigo');
  }

  function activas() {
    return cfg.enabled !== false && runtime.promosActivas !== false;
  }

  // ---- recordatorio de follow ----
  function recordatorioFollow() {
    if (!activas() || cfg.followReminder?.enabled === false) return;
    const r = cfg.followReminder || {};
    if (r.maxPerStream && contadorFollow >= r.maxPerStream) return;

    // Solo si alguien ha escrito hace poco
    const ventana = (r.onlyIfChatActiveSeconds ?? 300) * 1000;
    const parado = Date.now() - (ultimaActividad?.() || 0);
    if (parado > ventana) {
      log.debug('Recordatorio de follow omitido: el chat esta parado.');
      return;
    }

    contadorFollow += 1;
    chat.say(plantilla(AZAR(r.messages), null));
    log.info(`Recordatorio de follow enviado (${contadorFollow}${r.maxPerStream ? `/${r.maxPerStream}` : ''}).`);
  }

  // ---- recordatorio del overlay de muñequitos (Stream Avatars) ----
  let contadorAvatares = 0;
  function recordatorioAvatares() {
    if (!activas() || cfg.recordatorioAvatares?.enabled === false) return;
    const r = cfg.recordatorioAvatares || {};
    if (r.maxPerStream && contadorAvatares >= r.maxPerStream) return;

    // Solo si alguien ha escrito hace poco
    const ventana = (r.onlyIfChatActiveSeconds ?? 300) * 1000;
    const parado = Date.now() - (ultimaActividad?.() || 0);
    if (parado > ventana) {
      log.debug('Recordatorio de avatares omitido: el chat esta parado.');
      return;
    }

    contadorAvatares += 1;
    chat.say(plantilla(AZAR(r.messages), null));
    log.info(`Recordatorio de avatares enviado (${contadorAvatares}${r.maxPerStream ? `/${r.maxPerStream}` : ''}).`);
  }

  // ---- recordatorio de juegos y comandos (lo que hay y como se usa) ----
  let contadorJuegos = 0;
  function recordatorioJuegos() {
    if (!activas() || cfg.recordatorioJuegos?.enabled === false) return;
    const r = cfg.recordatorioJuegos || {};
    if (r.maxPerStream && contadorJuegos >= r.maxPerStream) return;

    const ventana = (r.onlyIfChatActiveSeconds ?? 300) * 1000;
    if (Date.now() - (ultimaActividad?.() || 0) > ventana) {
      log.debug('Recordatorio de juegos omitido: el chat esta parado.');
      return;
    }

    contadorJuegos += 1;
    chat.say(plantilla(AZAR(r.messages), null));
    log.info(`Recordatorio de juegos enviado (${contadorJuegos}${r.maxPerStream ? `/${r.maxPerStream}` : ''}).`);
  }
  // ---- recordatorio de suscripción (para que el canal crezca) ----
  let contadorSubs = 0;
  function recordatorioSubs() {
    if (!activas() || cfg.recordatorioSubs?.enabled === false) return;
    const r = cfg.recordatorioSubs || {};
    if (r.maxPerStream && contadorSubs >= r.maxPerStream) return;

    const ventana = (r.onlyIfChatActiveSeconds ?? 300) * 1000;
    if (Date.now() - (ultimaActividad?.() || 0) > ventana) {
      log.debug('Recordatorio de suscripción omitido: el chat esta parado.');
      return;
    }

    contadorSubs += 1;
    chat.say(plantilla(AZAR(r.messages), null));
    log.info(`Recordatorio de suscripción enviado (${contadorSubs}${r.maxPerStream ? `/${r.maxPerStream}` : ''}).`);
  }

  // ---- alertas personalizadas: cada una habla sola cada X minutos ----
  const contadoresAlertas = new Map();   // id -> enviados en este directo
  let temporizadoresAlertas = [];        // para recargar sin reiniciar todo
  function dispararAlerta(al) {
    if (!activas() || !al || al.enabled === false) return false;
    const id = al.id;
    const hechos = contadoresAlertas.get(id) || 0;
    if (al.maxPerStream && hechos >= al.maxPerStream) return false;
    const ventana = (al.onlyIfChatActiveSeconds ?? 300) * 1000;
    if (Date.now() - (ultimaActividad?.() || 0) > ventana) {
      log.debug(`Alerta "${al.nombre || id}" omitida: el chat esta parado.`);
      return false;
    }
    const texto = plantilla(AZAR(al.messages), null);
    if (!texto) return false;
    contadoresAlertas.set(id, hechos + 1);
    chat.say(texto);
    log.info(`Alerta "${al.nombre || id}" enviada (${hechos + 1}${al.maxPerStream ? `/${al.maxPerStream}` : ''}).`);
    return true;
  }
  function programarAlerta(al) {
    const cada = (al.everyMinutes ?? 20) * 60 * 1000;
    const primero = (al.minutoInicial ?? 5) * 60 * 1000;
    const t0 = setTimeout(() => {
      dispararAlerta(al);
      const t1 = setInterval(() => dispararAlerta(al), cada);
      temporizadores.push(t1);
      temporizadoresAlertas.push(t1);
    }, primero);
    temporizadores.push(t0);
    temporizadoresAlertas.push(t0);
  }
  function listaAlertas() {
    return sanearAlertas(cfg.alertas);
  }
  function iniciarAlertas() {
    for (const al of listaAlertas()) programarAlerta(al);
    if (listaAlertas().length) log.info(`Alertas personalizadas: ${listaAlertas().length} programada(s).`);
  }
  // Relee la lista (tras guardar desde el panel) sin tocar el resto.
  // Devuelve cuántas quedan programadas.
  function recargarAlertas() {
    for (const t of temporizadoresAlertas) { try { clearInterval(t); clearTimeout(t); } catch {} }
    const fuera = new Set(temporizadoresAlertas);
    for (let i = temporizadores.length - 1; i >= 0; i--) {
      if (fuera.has(temporizadores[i])) temporizadores.splice(i, 1);
    }
    temporizadoresAlertas = [];
    const vivas = new Map();
    for (const al of listaAlertas()) {
      if (contadoresAlertas.has(al.id)) vivas.set(al.id, contadoresAlertas.get(al.id));
      programarAlerta(al);
    }
    contadoresAlertas.clear();
    for (const [k, v] of vivas) contadoresAlertas.set(k, v);
    return listaAlertas().length;
  }
  // Envío manual desde el botón Probar del panel: no gasta el cupo por directo.
  function dispararAlertaPorId(id) {
    const al = listaAlertas().find((x) => x.id === String(id));
    if (!al) return { ok: false, motivo: 'no existe' };
    const antes = contadoresAlertas.get(al.id) || 0;
    const forzado = { ...al, maxPerStream: 0, onlyIfChatActiveSeconds: 86400 };
    const ok = dispararAlerta(forzado);
    contadoresAlertas.set(al.id, antes);
    return { ok, id };
  }

  // ---- ambiente: anima el chat cuando lleva un rato callado ----
  // Con IA escribe un mensaje nuevo cada vez; si no hay IA, usa la lista de la config.
  let contadorAmbiente = 0;
  let ultimoAmbiente = 0;
  async function ambiente() {
    if (!activas() || cfg.idleChatter?.enabled === false) return null;
    const r = cfg.idleChatter || {};
    const ahora = Date.now();

    // Solo si de verdad esta parado
    if (ahora - (ultimaActividad?.() || 0) < (r.minutosSinHablar ?? 7) * 60000) return null;
    // Y con separacion minima entre mensajes de ambiente
    if (ahora - ultimoAmbiente < (r.minutosEntreMensajes ?? 10) * 60000) return null;
    if (r.maxPerStream && contadorAmbiente >= r.maxPerStream) return null;

    // Y solo mientras estas emitiendo: si no, gastaria cuota hablando a un chat vacio
    if (estaEnDirecto) {
      try {
        const enDirecto = await estaEnDirecto();
        if (enDirecto === false) {
          log.debug('Ambiente omitido: el canal no esta en directo.');
          return null;
        }
      } catch (e) {
        log.debug(`No pude saber si estas en directo (${e.message}); sigo adelante.`);
      }
    }

    let texto = null;
    let fuente = 'lista';
    if (r.usarIA !== false && brain && typeof brain.ambiente === 'function') {
      try {
        texto = await brain.ambiente();
        if (texto) fuente = 'IA';
      } catch (e) {
        log.warn(`No pude pedir el mensaje de ambiente a la IA: ${e.message}`);
      }
    }
    if (!texto) texto = plantilla(AZAR(r.messages), null);
    if (!texto) return null;

    contadorAmbiente += 1;
    ultimoAmbiente = ahora;
    chat.say(texto);
    log.info(`Mensaje de ambiente enviado (${fuente}, ${contadorAmbiente}${r.maxPerStream ? `/${r.maxPerStream}` : ''}).`);
    return texto;
  }

  // ---- bienvenida ----
  function bienvenida(usuario) {
    if (!activas() || cfg.welcomeFirstTime?.enabled === false) return;
    const clave = String(usuario).toLowerCase();
    if (yaSaludados.has(clave)) return;
    yaSaludados.add(clave);
    chat.say(plantilla(AZAR(cfg.welcomeFirstTime?.messages), usuario));
  }

  // ---- avisos de Twitch: subs, raids, regalos... ----
  function avisoUsuario(aviso) {
    if (!activas()) return;
    const quien = aviso.usuario || 'alguien';
    switch (aviso.tipo) {
      case 'sub':
      case 'resub':
      case 'subgift':
      case 'anonsubgift':
      case 'submysterygift':
        if (cfg.thanksSub?.enabled === false) return;
        chat.say(plantilla(AZAR(cfg.thanksSub?.messages), quien));
        break;
      case 'raid':
        if (cfg.thanksRaid?.enabled === false) return;
        chat.say(plantilla(AZAR(cfg.thanksRaid?.messages), quien));
        break;
      case 'bitsbadgetier':
        chat.say(`¡Gracias por los bits, ${quien}! 💎`);
        break;
      default:
        log.debug(`Aviso de Twitch sin plantilla: ${aviso.tipo}`);
    }
  }

  // ---- arranque / parada ----
  function iniciar() {
    if (!activas()) { log.info('Promociones desactivadas en la configuración.'); return; }

    const minFollow = cfg.followReminder?.everyMinutes ?? 20;
    if (cfg.followReminder?.enabled !== false) {
      // Primer recordatorio un poco después de empezar, no nada mas arrancar
      setTimeout(recordatorioFollow, 90 * 1000);
      temporizadores.push(setInterval(recordatorioFollow, minFollow * 60 * 1000));
      log.info(`Recordatorio de follow: cada ${minFollow} min (solo si el chat esta activo).`);
    }

    const minAvatares = cfg.recordatorioAvatares?.everyMinutes ?? 15;
    if (cfg.recordatorioAvatares?.enabled !== false) {
      const inicial = (cfg.recordatorioAvatares?.minutoInicial ?? 3) * 60 * 1000;
      setTimeout(recordatorioAvatares, inicial);
      temporizadores.push(setInterval(recordatorioAvatares, minAvatares * 60 * 1000));
      log.info(`Recordatorio de avatares: cada ${minAvatares} min (el primero en ${Math.round(inicial / 60000)} min).`);
    }

    // Ambiente del chat: mira cada pocos minutos si esta parado y lo anima
    if (cfg.idleChatter?.enabled) {
      const min = cfg.idleChatter.everyMinutes ?? 3;
      const mirar = () => { ambiente().catch((e) => log.warn(`Error en el mensaje de ambiente: ${e.message}`)); };
      setTimeout(mirar, 45 * 1000);
      temporizadores.push(setInterval(mirar, min * 60 * 1000));
      log.info(`Ambiente del chat: mira cada ${min} min (habla si hay ${cfg.idleChatter.minutosSinHablar ?? 7} min de silencio).`);
    }

    // Recordatorio de suscripción
    const minJuegos = cfg.recordatorioJuegos?.everyMinutes ?? 18;
    if (cfg.recordatorioJuegos?.enabled !== false) {
      const inicial = (cfg.recordatorioJuegos?.minutoInicial ?? 5) * 60 * 1000;
      setTimeout(recordatorioJuegos, inicial);
      temporizadores.push(setInterval(recordatorioJuegos, minJuegos * 60 * 1000));
      log.info(`Recordatorio de juegos: cada ${minJuegos} min (el primero en ${Math.round(inicial / 60000)} min).`);
    }
    const minSubs = cfg.recordatorioSubs?.everyMinutes ?? 30;
    if (cfg.recordatorioSubs?.enabled !== false) {
      const inicial = (cfg.recordatorioSubs?.minutoInicial ?? 8) * 60 * 1000;
      setTimeout(recordatorioSubs, inicial);
      temporizadores.push(setInterval(recordatorioSubs, minSubs * 60 * 1000));
      log.info(`Recordatorio de suscripción: cada ${minSubs} min (el primero en ${Math.round(inicial / 60000)} min).`);
    }

    // Alertas personalizadas del panel (hasta 50 por canal)
    iniciarAlertas();
  }

  function detener() {
    for (const t of temporizadores) clearInterval(t);
    temporizadores.length = 0;
  }

  return {
    iniciar,
    detener,
    bienvenida,
    avisoUsuario,
    recordatorioFollow,
    recordatorioAvatares,
    recordatorioSubs,
    recordatorioJuegos,
    ambiente,
    mensajeFollow: () => plantilla(AZAR(cfg.followReminder?.messages), null),
    get contadorFollow() { return contadorFollow; },
    get contadorAvatares() { return contadorAvatares; },
    get contadorSubs() { return contadorSubs; },
    get contadorAmbiente() { return contadorAmbiente; },
    listaAlertas,
    recargarAlertas,
    dispararAlerta,
    dispararAlertaPorId,
  };
}

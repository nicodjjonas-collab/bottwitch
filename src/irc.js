// Cliente de chat de Twitch sobre IRC + WebSocket.
// Usa el WebSocket nativo de Node (v22+), así que NO hace falta ninguna libreria.

import { logger } from './logger.js';

const URL_IRC = 'wss://irc-ws.chat.twitch.tv:443';

// Deshace el escapado de IRCv3 en los valores de las etiquetas (tags).
function desescapar(v) {
  return v.replace(/\\([srn\\:])/g, (_, c) => ({ s: ' ', r: '\r', n: '\n', '\\': '\\', ':': ';' }[c]));
}

// Convierte una linea cruda de IRC en un objeto.
export function parsearLinea(cruda) {
  const msg = { crudo: cruda, tags: {}, prefijo: null, comando: '', params: [] };
  let resto = cruda;

  if (resto.startsWith('@')) {
    const i = resto.indexOf(' ');
    const trozo = resto.slice(1, i);
    resto = resto.slice(i + 1);
    for (const par of trozo.split(';')) {
      const j = par.indexOf('=');
      if (j === -1) { msg.tags[par] = true; continue; }
      msg.tags[par.slice(0, j)] = desescapar(par.slice(j + 1));
    }
  }
  if (resto.startsWith(':')) {
    const i = resto.indexOf(' ');
    msg.prefijo = resto.slice(1, i);
    resto = resto.slice(i + 1);
  }
  let cola = null;
  const k = resto.indexOf(' :');
  if (k !== -1) { cola = resto.slice(k + 2); resto = resto.slice(0, k); }

  const partes = resto.split(' ').filter(Boolean);
  msg.comando = partes.shift() || '';
  msg.params = partes;
  if (cola !== null) msg.params.push(cola);
  return msg;
}

// Limpia el texto que vamos a enviar: nada de saltos de linea (evita inyeccion de comandos IRC).
export function limpiarSalida(texto, maxChars = 480) {
  let t = String(texto ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > maxChars) t = `${t.slice(0, maxChars - 1)}…`;
  return t;
}

// Convierte una linea PRIVMSG ya analizada en el mensaje que usa todo el bot.
// Esta fuera de la clase para poder probarla sin conectarse a Twitch.
export function mensajeDe(msg) {
  const t = msg.tags || {};
  const usuario = (t['display-name'] || msg.prefijo?.split('!')[0] || '').trim();
  return {
    usuario,
    usuarioMin: usuario.toLowerCase(),
    userId: t['user-id'] || null,
    texto: msg.params[msg.params.length - 1] || '',
    id: t.id || null,
    canal: (msg.params[0] || '').replace('#', ''),
    color: t.color || null,
    esMod: t.mod === '1',
    esBroadcaster: (t.badges || '').includes('broadcaster'),
    esSub: t.subscriber === '1',
    esVip: (t.badges || '').includes('vip') || t.vip === '1',
    primeraVez: t['first-msg'] === '1',
    badges: t.badges || '',
    bits: Number(t.bits || 0) || 0,
    cuando: Number(t['tmi-sent-ts'] || Date.now()),
  };
}

// Datos de un CLEARCHAT (ban o timeout).
// OJO: en CLEARCHAT los params son [canal, usuario], así que el usuario es params[1].
export function datosDeLimpieza(msg) {
  return { usuario: msg.params[1] || null, duración: msg.tags['ban-duration'] || null };
}

export class TwitchChat {
  constructor({ username, token, channel, chatConfig = {} }) {
    this.username = String(username || '').toLowerCase();
    this.token = String(token || '').startsWith('oauth:') ? token : `oauth:${token}`;
    this.channel = String(channel || '').toLowerCase();
    this.cfg = {
      maxMessageChars: chatConfig.maxMessageChars ?? 480,
      minMsBetweenMessages: chatConfig.minMsBetweenMessages ?? 1100,
      messagesPer30s: chatConfig.messagesPer30s ?? 18,
      reconnectMaxSeconds: chatConfig.reconnectMaxSeconds ?? 60,
      logRawMessages: chatConfig.logRawMessages ?? false,
    };
    this.ws = null;
    this.conectado = false;
    this.intentos = 0;
    this.detenido = false;
    this.manejadores = new Map();
    this.cola = [];
    this.ultimoEnvio = 0;
    this.marcasTiempo = [];
    this.temporizadorCola = null;
    this.debeSalir = false;
    this.ultimaLinea = 0;      // última línea recibida (vigilancia de conexión)
    this.vigilante = null;
  }

  // ---- eventos ----
  on(evento, fn) {
    if (!this.manejadores.has(evento)) this.manejadores.set(evento, []);
    this.manejadores.get(evento).push(fn);
    return this;
  }

  emitir(evento, datos) {
    for (const fn of this.manejadores.get(evento) || []) {
      try { fn(datos); } catch (e) { logger.error(`Error en el manejador '${evento}': ${e.stack || e.message}`); }
    }
  }

  // ---- conexión ----
  conectar() {
    if (this.detenido) return;
    logger.info(`Conectando al chat de Twitch como "${this.username}" al canal "#${this.channel}"...`);

    let ws;
    try {
      ws = new WebSocket(URL_IRC);
    } catch (e) {
      logger.error(`Tu version de Node no tiene WebSocket integrado (necesitas Node 22 o superior). Detalle: ${e.message}`);
      process.exit(1);
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.intentos = 0;
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
      ws.send(`PASS ${this.token}`);
      ws.send(`NICK ${this.username}`);
      logger.ok('Conexión abierta con el IRC de Twitch.');
    });

    ws.addEventListener('message', (ev) => {
      const texto = typeof ev.data === 'string' ? ev.data : String(ev.data);
      for (const linea of texto.split('\r\n')) {
        if (linea.trim()) this.procesarLinea(linea);
      }
    });

    ws.addEventListener('error', (ev) => {
      logger.warn(`Error en el WebSocket: ${ev.message || 'desconocido'}`);
    });

    ws.addEventListener('close', (ev) => {
      this.conectado = false;
      if (this.detenido || this.debeSalir) return;
      this.emitir('desconectado', { codigo: ev.code, motivo: ev.reason });
      this.reintentar();
    });

    // Vigilante: si Twitch deja de hablar (caída silenciosa de red/VPN/wifi),
    // el 'close' a veces no llega. Sin PING ni nada en 10 min, reconectamos.
    try { if (this.vigilante) clearInterval(this.vigilante); } catch { /* da igual */ }
    this.vigilante = setInterval(() => {
      if (this.detenido || this.debeSalir || !this.conectado) return;
      if (Date.now() - (this.ultimaLinea || 0) > 10 * 60 * 1000) {
        logger.warn('El chat lleva 10 min sin decir nada (ni siquiera PING). Reconectando...');
        try { this.ws?.close(); } catch { /* el close reintentará */ }
      }
    }, 60000);
    try { this.vigilante.unref?.(); } catch { /* da igual */ }
  }

  reintentar() {
    this.intentos += 1;
    const espera = Math.min(this.cfg.reconnectMaxSeconds, Math.round(1.5 ** this.intentos) + 2);
    logger.warn(`Chat desconectado. Reintento ${this.intentos} en ${espera} s...`);
    setTimeout(() => this.conectar(), espera * 1000);
  }

  autenticacionFallida() {
    this.debeSalir = true;
    logger.error('Twitch ha rechazado el token. Vuelve a generarlo con:  npm run auth');
    this.emitir('authfallida', {});
  }

  desconectar() {
    this.detenido = true;
    try { if (this.vigilante) clearInterval(this.vigilante); } catch { /* da igual */ }
    try { if (this.temporizadorCola) clearTimeout(this.temporizadorCola); } catch { /* da igual */ }
    try { this.ws?.close(); } catch { /* da igual */ }
  }

  // ---- procesado de lineas ----
  procesarLinea(linea) {
    this.ultimaLinea = Date.now();
    if (this.cfg.logRawMessages) logger.debug(`<- ${linea}`);
    const msg = parsearLinea(linea);

    switch (msg.comando) {
      case 'PING':
        try { this.ws?.send('PONG :tmi.twitch.tv'); } catch { /* da igual */ }
        return;

      case '001': // bienvenida: ya podemos entrar al canal
        this.conectado = true;
        this.ws?.send(`JOIN #${this.channel}`);
        logger.ok(`Conectado. Entrando a #${this.channel}...`);
        this.emitir('conectado', { canal: this.channel });
        return;

      case 'JOIN':
        if (msg.prefijo?.startsWith(`${this.username}!`)) {
          logger.ok(`Estoy dentro del chat de #${this.channel}.`);
          this.bombear();   // por si se acumuló cola durante el corte
        }
        return;

      case 'RECONNECT':
        logger.warn('Twitch pide reconectar. Cerrando y volviendo a entrar...');
        try { this.ws?.close(); } catch { /* da igual */ }
        return;

      case 'NOTICE': {
        const texto = msg.params[msg.params.length - 1] || '';
        if (/login authentication failed|improperly formatted auth|invalid oauth/i.test(texto)) {
          this.autenticacionFallida();
        } else if (/error|denied|banned/i.test(texto)) {
          logger.warn(`Aviso de Twitch: ${texto}`);
        }
        this.emitir('aviso', { texto });
        return;
      }

      case 'PRIVMSG': {
        const mensaje = mensajeDe(msg);
        // Los mensajes del propio bot no nos interesan
        if (mensaje.usuarioMin === this.username) return;
        this.emitir('mensaje', mensaje);
        return;
      }

      case 'USERNOTICE': {
        const t = msg.tags;
        this.emitir('avisoUsuario', {
          tipo: t['msg-id'] || 'desconocido',
          usuario: (t['display-name'] || t.login || '').trim() || null,
          texto: t['system-msg'] || '',
          meses: t['msg-param-cumulative-months'] || null,
          cantidad: t['msg-param-mass-gift-count'] || t['msg-param-viewerCount'] || null,
        });
        return;
      }

      case 'CLEARCHAT':
        this.emitir('limpieza', datosDeLimpieza(msg));
        return;

      default:
        return;
    }
  }

  // ---- envio de mensajes con control de ritmo ----
  say(texto) {
    const limpio = limpiarSalida(texto, this.cfg.maxMessageChars);
    if (!limpio) return;
    this.cola.push(limpio);
    if (this.cola.length > 30) this.cola.shift(); // si se acumula demasiado, tiramos lo viejo
    this.bombear();
  }

  bombear() {
    if (this.temporizadorCola || this.cola.length === 0) return;
    if (!this.listo) {
      // Sin conexión no se consume nada: los mensajes esperan en cola
      // (antes se perdían). Al volver, JOIN los bombea.
      this.temporizadorCola = setTimeout(() => { this.temporizadorCola = null; this.bombear(); }, 3000);
      return;
    }
    const ahora = Date.now();

    // Ventana deslizante: cuantos mensajes en los ultimos 30 s
    this.marcasTiempo = this.marcasTiempo.filter((t) => ahora - t < 30000);
    const faltaPorRitmo = this.marcasTiempo.length >= this.cfg.messagesPer30s;
    const faltaPorEspacio = ahora - this.ultimoEnvio < this.cfg.minMsBetweenMessages;

    if (faltaPorRitmo || faltaPorEspacio) {
      const espera = faltaPorRitmo
        ? (30000 - (ahora - this.marcasTiempo[0])) + 50
        : this.cfg.minMsBetweenMessages - (ahora - this.ultimoEnvio);
      this.temporizadorCola = setTimeout(() => { this.temporizadorCola = null; this.bombear(); }, Math.max(120, espera));
      return;
    }

    const texto = this.cola.shift();
    this.ultimoEnvio = ahora;
    this.marcasTiempo.push(ahora);
    try {
      this.ws?.send(`PRIVMSG #${this.channel} :${texto}`);
      logger.bot(texto);
    } catch (e) {
      // Si falla al enviar, el mensaje vuelve a la cola (no se pierde)
      this.cola.unshift(texto);
      logger.error(`No pude enviar el mensaje, lo reintento: ${e.message}`);
      this.temporizadorCola = setTimeout(() => { this.temporizadorCola = null; this.bombear(); }, 3000);
      return;
    }
    if (this.cola.length) this.bombear();
  }

  // Envia varios mensajes con una pausa entre ellos (para no saturar el chat)
  async sayMany(textos, pausaMs = 900) {
    for (const t of textos) {
      this.say(t);
      await new Promise((r) => setTimeout(r, pausaMs));
    }
  }

  get listo() { return this.conectado && this.ws?.readyState === 1; }
}

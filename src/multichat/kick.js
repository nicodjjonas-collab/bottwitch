// Kick (solo LECTURA): sin API publica fiable para enviar, asi que el chat
// de Kick se lee por su websocket interno (Pusher), igual que hacen los
// overlays. Si Kick lo cambia, esto deja de funcionar: se desactiva solo
// con aviso en el log, sin tumbar el bot.
// Responder a Kick NO esta soportado (Kick no ofrece forma oficial con
// solo usuario+clave publica); !rk lo dice claro en el chat.

export const PUSHER_URL = 'wss://ws-us2.pusher.com/app/32cbd69e4b950cf5b70d8?protocol=7&client=js&version=8.4.0&flash=false';

export function canalPusher(chatroomId) {
  return `chatrooms.${chatroomId}.v2`;
}

export function mensajeSuscripcion(chatroomId) {
  return JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: canalPusher(chatroomId) } });
}

export function mensajePong() {
  return JSON.stringify({ event: 'pusher:pong', data: '{}' });
}

// Resuelve el slug ("koko_deejay") a chatroom. Sin clave, publico.
export async function resolverSala(slug) {
  const limpio = String(slug || '').trim().replace(/^@/, '').toLowerCase();
  if (!limpio) throw new Error('Falta el canal de Kick');
  const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(limpio)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (r.status === 404) throw new Error(`El canal de Kick "${limpio}" no existe`);
  if (!r.ok) throw new Error(`Kick no responde (${r.status})`);
  const j = await r.json();
  const chatroomId = j?.chatroom?.id;
  if (!chatroomId) throw new Error('Ese canal no tiene sala de chat');
  return { slug: limpio, chatroomId, enVivo: Boolean(j?.livestream), titulo: j?.livestream?.session_title || '' };
}

// Limpia el texto: Kick mete emotes como [emote:123:Nombre].
export function limpiarKick(texto) {
  return String(texto ?? '')
    .replace(/\[emote:\d+:([^\]]+)\]/g, '$1')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarKick(ev) {
  const usuario = String(ev?.sender?.username || ev?.sender?.slug || 'alguien').trim() || 'alguien';
  return {
    red: 'kick',
    id: String(ev?.id || ''),
    usuario,
    usuarioMin: usuario.toLowerCase(),
    texto: limpiarKick(ev?.content),
  };
}

// Extrae el evento de chat de un mensaje crudo de Pusher (null si no es chat).
export function extraerChatPusher(crudo) {
  let msg;
  try { msg = JSON.parse(crudo); } catch { return null; }
  if (!msg || msg.event !== 'App\\Events\\ChatMessageEvent') return null;
  try {
    const ev = JSON.parse(msg.data);
    const n = normalizarKick(ev);
    return n.texto ? n : null;
  } catch { return null; }
}

export class KickChat {
  constructor({ slug, chatroomId, onMessage, log }) {
    this.slug = slug;
    this.chatroomId = chatroomId;
    this.onMessage = onMessage;
    this.log = log || null;
    this.ws = null;
    this.detenido = false;
    this.intentos = 0;
    this.vistosRecientes = [];
  }

  conectar() {
    if (this.detenido) return;
    const di = (m) => { try { this.log?.info(m); } catch {} };
    const ws = new WebSocket(PUSHER_URL);
    this.ws = ws;
    ws.onopen = () => { this.intentos = 0; };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.event === 'pusher:connection_established') {
        try { ws.send(mensajeSuscripcion(this.chatroomId)); } catch {}
        return;
      }
      if (msg.event === 'pusher:ping') {
        try { ws.send(mensajePong()); } catch {}
        return;
      }
      if (msg.event === 'pusher:error') {
        di(`Kick Pusher dice: ${JSON.stringify(msg.data).slice(0, 160)}`);
        return;
      }
      const n = extraerChatPusher(ev.data);
      if (n) {
        if (this.vistosRecientes.includes(n.id)) return;
        this.vistosRecientes.push(n.id);
        if (this.vistosRecientes.length > 500) this.vistosRecientes.splice(0, 250);
        try { this.onMessage?.(n); } catch {}
      }
    };
    const caido = () => {
      if (this.detenido) return;
      this.intentos += 1;
      const espera = Math.min(60000, 3000 * Math.pow(1.5, Math.min(this.intentos, 8)));
      di(`Kick desconectado, reintento en ${Math.round(espera / 1000)} s...`);
      setTimeout(() => { if (!this.detenido) this.conectar(); }, espera);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
    ws.onclose = caido;
  }

  detener() {
    this.detenido = true;
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }

  get listo() { return !this.detenido && this.ws?.readyState === 1; }
}

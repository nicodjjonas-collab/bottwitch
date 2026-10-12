// Puente multichat por canal: trae mensajes de YouTube y Kick al chat de
// Twitch, y deja responder a YouTube desde Twitch (!ryt).
// Cada red es independiente: si una falla, las demas siguen.

import { logger } from '../logger.js';
import { resolverDirecto, leerChat, enviarChat, refrescarYt, COSTE } from './youtube.js';
import { resolverSala, KickChat } from './kick.js';

export function formatearRelay(red, usuario, texto) {
  const etq = red === 'youtube' ? 'YT' : red === 'kick' ? 'Kick' : String(red);
  const t = `[${etq}] ${usuario}: ${texto}`.replace(/\s+/g, ' ').trim();
  return t.length > 400 ? `${t.slice(0, 399)}…` : t;
}

export function crearPuente({ canal, tag, config, chat, brain, youtube, guardarYoutube, log = logger }) {
  const cfg = (config && config.multichat) || {};
  const ytCfg = cfg.youtube || {};
  const kickCfg = cfg.kick || {};
  const ytEstado = { fase: 'apagado', detalle: '', titulo: '' };
  const kickEstado = { fase: 'apagado', detalle: '' };
  const ultimo = { youtube: null, kick: null };
  const vistosYt = [];
  let cuota = { dia: '', usadas: 0 };
  let temporizadores = [];
  let vueltaEnCurso = false;
  let vueltaN = 0;
  let kickChat = null;
  let videoIdFijo = (youtube && youtube.videoId) || ytCfg.videoId || '';
  let accessYt = '';
  let expiraYt = 0;

  const di = (m) => { try { log.info(`[${tag}] Puente: ${m}`); } catch {} };
  const advierte = (m) => { try { log.warn(`[${tag}] Puente: ${m}`); } catch {} };

  function hoyKey() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function gastar(u) {
    const hoy = hoyKey();
    if (cuota.dia !== hoy) cuota = { dia: hoy, usadas: 0 };
    const tope = ytCfg.topeCuotaDiaria ?? 8000;
    if (cuota.usadas + u > tope) return false;
    cuota.usadas += u;
    return true;
  }

  async function tokenYt() {
    if (accessYt && Date.now() < expiraYt - 60000) return accessYt;
    const rt = youtube?.refreshToken;
    if (!rt) throw new Error('sin autorizar (falta refreshToken)');
    const clientId = ytCfg.clientId || process.env.YT_CLIENT_ID || '';
    if (!clientId) throw new Error('falta YT_CLIENT_ID');
    const j = await refrescarYt({ clientId, refreshToken: rt });
    accessYt = j.access_token;
    expiraYt = Date.now() + (j.expires_in || 3600) * 1000;
    if (j.refresh_token && j.refresh_token !== rt) {
      try { await guardarYoutube?.({ refreshToken: j.refresh_token }); } catch {}
    }
    return accessYt;
  }

  function recibirExterno({ red, usuario, texto, id }) {
    if (!usuario || !texto) return;
    ultimo[red] = { usuario, texto: String(texto).slice(0, 200), cuando: Date.now() };
    try {
      brain?.registrar({ usuario: `[${red === 'youtube' ? 'YT' : 'Kick'}]${usuario}`, texto, deBot: false });
    } catch {}
    chat.say(formatearRelay(red, usuario, texto));
    di(`${red} ${usuario}: ${String(texto).slice(0, 80)}`);
  }

  async function vueltaYt() {
    if (vueltaEnCurso) return;
    vueltaEnCurso = true;
    try {
      const token = await tokenYt();
      vueltaN += 1;
      // Resolver directo cada ~60 s o si no hay chat activo
      if (!ytEstado.liveChatId || vueltaN % 6 === 0) {
        if (!gastar(COSTE.directo)) { ytEstado.fase = 'cuota'; ytEstado.detalle = 'tope diario de YouTube alcanzado'; return; }
        const d = await resolverDirecto({ token, videoIdPreferido: videoIdFijo });
        if (!d.enDirecto) {
          if (ytEstado.liveChatId) di('YouTube: se acabo el directo, pauso la lectura.');
          ytEstado.liveChatId = '';
          ytEstado.fase = 'sin-directo';
          ytEstado.detalle = videoIdFijo ? 'ese video no tiene chat en directo' : 'no hay directo ahora';
          return;
        }
        if (ytEstado.liveChatId !== d.liveChatId) {
          ytEstado.liveChatId = d.liveChatId;
          ytEstado.titulo = d.titulo || '';
          ytEstado.detalle = d.titulo || d.videoId;
          chat.say(`🔴 YouTube en directo: ${d.titulo || 'mira el chat'} (te leo aquí con [YT])`);
        }
        ytEstado.fase = 'directo';
      }
      if (!gastar(COSTE.lectura)) { ytEstado.fase = 'cuota'; return; }
      const pagina = await leerChat({ token, liveChatId: ytEstado.liveChatId, pageToken: ytEstado.pageToken || '' });
      ytEstado.pageToken = pagina.nextPageToken || ytEstado.pageToken;
      for (const m of pagina.mensajes) {
        if (!m.id || vistosYt.includes(m.id)) continue;
        vistosYt.push(m.id);
        if (vistosYt.length > 500) vistosYt.splice(0, 250);
        recibirExterno(m);
      }
    } catch (e) {
      ytEstado.fase = 'error';
      ytEstado.detalle = String(e.message || e).slice(0, 160);
      advierte(`YouTube: ${ytEstado.detalle}`);
    } finally {
      vueltaEnCurso = false;
    }
  }

  function arrancarKick() {
    const slug = String(kickCfg.canal || canal || '').replace(/^@/, '').toLowerCase();
    if (!slug) {
      kickEstado.fase = 'error';
      kickEstado.detalle = 'falta el canal de Kick';
      return;
    }
    (async () => {
      try {
        const sala = await resolverSala(slug);
        if (!sala || !sala.chatroomId) throw new Error('sin sala de chat');
        kickEstado.fase = 'directo';
        kickEstado.detalle = sala.enVivo ? `en directo: ${sala.titulo || slug}` : 'leyendo el chat';
        kickChat = new KickChat({
          slug, chatroomId: sala.chatroomId, log,
          onMessage: (m) => recibirExterno(m),
        });
        kickChat.conectar();
        di(`Kick conectado a #${slug}.`);
      } catch (e) {
        kickEstado.fase = 'error';
        kickEstado.detalle = String(e.message || e).slice(0, 160);
        advierte(`Kick: ${kickEstado.detalle} (reintento en 60 s)`);
        temporizadores.push(setTimeout(arrancarKick, 60000));
      }
    })();
  }

  // Responder desde Twitch: !ryt <texto> -> YouTube, !rk -> no soportado.
  async function responder(red, texto) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) return { ok: false, motivo: 'escribe algo' };
    if (red === 'youtube') {
      try {
        const token = await tokenYt();
        if (!ytEstado.liveChatId) {
          if (!gastar(COSTE.directo)) return { ok: false, motivo: 'tope diario de YouTube' };
          const d = await resolverDirecto({ token, videoIdPreferido: videoIdFijo });
          if (!d.enDirecto) return { ok: false, motivo: 'YouTube no esta en directo ahora' };
          ytEstado.liveChatId = d.liveChatId;
        }
        if (!gastar(COSTE.envio)) return { ok: false, motivo: 'tope diario de YouTube' };
        await enviarChat({ token, liveChatId: ytEstado.liveChatId, texto: limpio });
        return { ok: true, red: 'youtube' };
      } catch (e) {
        return { ok: false, motivo: String(e.message || e).slice(0, 160) };
      }
    }
    if (red === 'kick') {
      return { ok: false, motivo: 'Kick es de solo lectura: no hay forma oficial de responder (te leo, pero responde desde Kick)' };
    }
    return { ok: false, motivo: 'red desconocida' };
  }

  function fijarVideoYT(videoId) {
    videoIdFijo = String(videoId || '').trim();
    ytEstado.liveChatId = '';
    ytEstado.pageToken = '';
    try { guardarYoutube?.({ videoId: videoIdFijo }); } catch {}
    return videoIdFijo;
  }

  function estado() {
    return {
      youtube: { ...ytEstado, ultimo: ultimo.youtube, videoId: videoIdFijo || undefined, cuotaUsada: cuota.usadas },
      kick: { ...kickEstado, ultimo: ultimo.kick },
    };
  }

  return {
    // inyectar: entrada manual de mensajes externos (la usan los sockets
    // internos y las pruebas; no llamar desde el chat).
    inyectar: recibirExterno,
    iniciar() {
      if (ytCfg.enabled && youtube?.refreshToken) {
        ytEstado.fase = 'buscando';
        const cada = Math.min(30000, Math.max(5000, (ytCfg.intervaloSegundos ?? 10) * 1000));
        vueltaYt();
        temporizadores.push(setInterval(vueltaYt, cada));
        di('YouTube activado.');
      } else if (ytCfg.enabled) {
        ytEstado.fase = 'sin-autorizar';
        ytEstado.detalle = 'falta autorizar (AUTORIZAR-YT.cmd)';
      }
      if (kickCfg.enabled) {
        kickEstado.fase = 'buscando';
        arrancarKick();
      }
    },
    detener() {
      for (const t of temporizadores) { try { clearInterval(t); clearTimeout(t); } catch {} }
      temporizadores = [];
      try { kickChat?.detener(); } catch {}
      kickChat = null;
    },
    responder,
    fijarVideoYT,
    estado,
  };
}

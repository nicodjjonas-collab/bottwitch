// YouTube Live Chat para el multichat: OAuth (device flow, como Twitch),
// renovacion de token, deteccion del directo, lectura y envio.
// Todo con fetch nativo. Sin dependencias.
//
// Costes de cuota (YouTube Data API v3, tope diario 10.000):
//   resolver directo ~1 · leer chat ~5 · enviar mensaje ~50

export const COSTE = { directo: 1, lectura: 5, envio: 50 };
export const SCOPES_YT = 'https://www.googleapis.com/auth/youtube.force-ssl';

// ---- OAuth: flujo de codigo de dispositivo (igual que AUTORIZAR-BOT) ----
export async function pedirCodigoDispositivo({ clientId }) {
  const cuerpo = new URLSearchParams({ client_id: clientId, scope: SCOPES_YT });
  const r = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  });
  if (!r.ok) throw new Error(`Google rechazo la peticion (${r.status})`);
  const d = await r.json();
  // { device_code, user_code, verification_url, expires_in, interval }
  return d;
}

export async function esperarTokenDispositivo({ clientId, deviceCode, alAvisar }) {
  const limite = Date.now() + 30 * 60 * 1000;
  let espera = 5000;
  for (;;) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.access_token) return j;
    if (j.error === 'authorization_pending') { /* sigue esperando */ }
    else if (j.error === 'slow_down') espera += 2000;
    else if (j.error === 'access_denied') throw new Error('Has cancelado la autorizacion en Google.');
    else if (j.error === 'expired_token') throw new Error('El codigo ha caducado. Vuelve a intentarlo.');
    else throw new Error(`Error inesperado de Google: ${JSON.stringify(j).slice(0, 200)}`);
    alAvisar?.();
    if (Date.now() + espera > limite) throw new Error('Se acabo el tiempo esperando la autorizacion.');
    await new Promise((res) => setTimeout(res, espera));
  }
}

export async function refrescarYt({ clientId, refreshToken }) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`No pude renovar YouTube: ${j.error || r.status}`);
  return j; // {access_token, expires_in, ...} (a veces trae refresh_token nuevo)
}

function cabecerasGet(token) {
  return { Authorization: `Bearer ${token}` };
}

// ---- Directo: ¿hay live ahora? (videoId manual manda sobre autodeteccion) ----
export async function resolverDirecto({ token, videoIdPreferido = '' }) {
  const vid = String(videoIdPreferido || '').trim();
  if (vid) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${encodeURIComponent(vid)}`, { headers: cabecerasGet(token) });
    if (!r.ok) throw new Error(`YouTube videos.list (${r.status})`);
    const j = await r.json();
    const v = j.items?.[0];
    const chatId = v?.liveStreamingDetails?.activeLiveChatId || null;
    return {
      videoId: vid,
      titulo: v?.snippet?.title || '',
      liveChatId: chatId,
      enDirecto: Boolean(chatId),
    };
  }
  const r = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,contentDetails&mine=true&broadcastStatus=active&maxResults=1', { headers: cabecerasGet(token) });
  if (!r.ok) throw new Error(`YouTube liveBroadcasts (${r.status})`);
  const j = await r.json();
  const b = j.items?.[0];
  return {
    videoId: b?.id || '',
    titulo: b?.snippet?.title || '',
    liveChatId: b?.snippet?.liveChatId || null,
    enDirecto: Boolean(b?.snippet?.liveChatId),
  };
}

// ---- Leer mensajes nuevos del chat ----
export async function leerChat({ token, liveChatId, pageToken = '' }) {
  const u = new URL('https://www.googleapis.com/youtube/v3/liveChatMessages');
  u.searchParams.set('liveChatId', liveChatId);
  u.searchParams.set('part', 'snippet,authorDetails');
  u.searchParams.set('maxResults', '200');
  if (pageToken) u.searchParams.set('pageToken', pageToken);
  const r = await fetch(u, { headers: cabecerasGet(token) });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`YouTube liveChat (${r.status}): ${t.slice(0, 160)}`);
  }
  const j = await r.json();
  return {
    mensajes: (j.items || []).map(normalizarYt).filter((m) => m.texto),
    nextPageToken: j.nextPageToken || '',
    intervaloMs: j.pollingIntervalMillis || 10000,
  };
}

export function normalizarYt(item) {
  const sn = item?.snippet || {};
  const au = item?.authorDetails || {};
  const display = sn.displayMessage || sn.textMessageDetails?.messageText || '';
  return {
    red: 'youtube',
    id: String(item?.id || ''),
    usuario: String(au.displayName || 'alguien').trim() || 'alguien',
    usuarioMin: String(au.displayName || 'alguien').trim().toLowerCase(),
    texto: String(display || '').replace(/\s+/g, ' ').trim(),
  };
}

// ---- Enviar mensaje al chat de YouTube (gasta ~50 de cuota) ----
export async function enviarChat({ token, liveChatId, texto }) {
  const limpio = String(texto ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!limpio) throw new Error('Mensaje vacio');
  const r = await fetch('https://www.googleapis.com/youtube/v3/liveChatMessages?part=snippet', {
    method: 'POST',
    headers: { ...cabecerasGet(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippet: { liveChatId, type: 'textMessageEvent', textMessageDetails: { messageText: limpio } } }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`YouTube no acepto el mensaje (${r.status}): ${t.slice(0, 160)}`);
  }
  return true;
}

// =====================================================================
//  CANALES: el bot atiende varios canales de Twitch a la vez.
//  Cada canal tiene su cuenta de bot, sus tokens, sus puntos, sus juegos
//  y su overlay. La IA (cuota de Groq) se comparte entre todos.
//
//  De dónde salen:
//    1) config/canales.json  -> [{ channel, bot, clientId, token,
//                                 refreshToken, expiresAt, enabled, plan }]
//    2) si no existe, se usa el .env de siempre (un solo canal, plan full)
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

export function leerCanales(RAIZ) {
  // En la nube no hay archivos: la lista puede venir en la variable CANALES_JSON
  if (process.env.CANALES_JSON) {
    try {
      const lista = JSON.parse(process.env.CANALES_JSON);
      if (!Array.isArray(lista)) throw new Error('CANALES_JSON debe ser una lista');
      return lista
        .map((c) => ({
          channel: String(c.channel || '').toLowerCase().trim(),
          bot: String(c.bot || c.botUsername || '').toLowerCase().trim(),
          clientId: String(c.clientId || process.env.BOT_CLIENT_ID || '').trim(),
          token: String(c.token || '').trim(),
          refreshToken: String(c.refreshToken || '').trim(),
          expiresAt: Number(c.expiresAt || 0),
          enabled: c.enabled !== false,
          plan: c.plan || 'full',
          propio: c.propio === true,
          datos: null,
        }))
        .filter((c) => c.channel && c.token);
    } catch (e) {
      throw new Error(`CANALES_JSON no vale: ${e.message}`);
    }
  }
  const archivo = path.join(RAIZ, 'config', 'canales.json');
  if (fs.existsSync(archivo)) {
    try {
      const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
      if (!Array.isArray(lista)) throw new Error('canales.json debe ser una lista');
      return lista
        .map((c) => ({
          channel: String(c.channel || '').toLowerCase().trim(),
          bot: String(c.bot || c.botUsername || '').toLowerCase().trim(),
          clientId: String(c.clientId || '').trim(),
          token: String(c.token || '').trim(),
          refreshToken: String(c.refreshToken || '').trim(),
          expiresAt: Number(c.expiresAt || 0),
          enabled: c.enabled !== false,
          plan: c.plan || 'full',
          propio: c.propio === true,
          datos: c.datos || null,
        }))
        .filter((c) => c.channel);
    } catch (e) {
      throw new Error(`config/canales.json no vale: ${e.message}`);
    }
  }
  // Modo clásico: un canal desde .env (el tuyo, gratis y con todo)
  return [{
    channel: (process.env.CHANNEL || '').toLowerCase().trim(),
    bot: (process.env.BOT_USERNAME || '').toLowerCase().trim(),
    clientId: (process.env.BOT_CLIENT_ID || '').trim(),
    token: (process.env.BOT_TOKEN || '').trim(),
    refreshToken: (process.env.BOT_REFRESH_TOKEN || '').trim(),
    expiresAt: Number(process.env.BOT_TOKEN_EXPIRES_AT || 0),
    enabled: true,
    plan: 'full',
    propio: true,
    datos: null,
    origen: 'env',
  }];
}

// Guarda tokens renovados (solo modo canales.json; en modo .env se avisa).
export function guardarTokenCanal(RAIZ, channel, { token, refreshToken, expiresAt }) {
  const archivo = path.join(RAIZ, 'config', 'canales.json');
  if (!fs.existsSync(archivo)) return false;
  const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const c = lista.find((x) => String(x.channel || '').toLowerCase() === channel);
  if (!c) return false;
  if (token) c.token = token;
  if (refreshToken) c.refreshToken = refreshToken;
  if (expiresAt) c.expiresAt = expiresAt;
  fs.writeFileSync(archivo, JSON.stringify(lista, null, 2), 'utf8');
  return true;
}

// Ajustes por canal (lo que toca cada cliente en el panel).
// Se guardan en la entrada del canal y se aplican en caliente (casi todo).
export function guardarAjustes(RAIZ, channel, ajustes) {
  const archivo = path.join(RAIZ, 'config', 'canales.json');
  if (!fs.existsSync(archivo)) return null;
  const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const c = lista.find((x) => String(x.channel || '').toLowerCase() === String(channel).toLowerCase());
  if (!c) return null;
  c.ajustes = { ...(c.ajustes || {}), ...(ajustes || {}) };
  fs.writeFileSync(archivo, JSON.stringify(lista, null, 2), 'utf8');
  return c.ajustes;
}

// Fusión profunda solo de las ramas que el panel permite tocar.
const RAMAS = ['conversation', 'games', 'promos', 'songrequests', 'bpm', 'festero', 'economy', 'commands'];
export function fusionarAjustes(configBase, ajustes) {
  const cfg = JSON.parse(JSON.stringify(configBase));
  for (const rama of RAMAS) {
    if (ajustes && ajustes[rama] && typeof ajustes[rama] === 'object') {
      cfg[rama] = { ...(cfg[rama] || {}), ...ajustes[rama] };
    }
  }
  if (ajustes && typeof ajustes.prefix === 'string' && ajustes.prefix) cfg.prefix = ajustes.prefix;
  return cfg;
}
export function guardarCanal(RAIZ, entrada) {
  const dir = path.join(RAIZ, 'config');
  const archivo = path.join(dir, 'canales.json');
  fs.mkdirSync(dir, { recursive: true });
  let lista = [];
  if (fs.existsSync(archivo)) {
    try { lista = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { lista = []; }
  }
  const channel = String(entrada.channel || '').toLowerCase().trim();
  if (!channel) throw new Error('Falta el canal');
  const i = lista.findIndex((x) => String(x.channel || '').toLowerCase() === channel);
  const registro = {
    channel,
    bot: String(entrada.bot || '').toLowerCase().trim(),
    clientId: entrada.clientId || '',
    token: entrada.token || '',
    refreshToken: entrada.refreshToken || '',
    expiresAt: entrada.expiresAt || 0,
    enabled: entrada.enabled !== false,
    plan: entrada.plan || 'full',
    propio: entrada.propio === true,
  };
  if (i >= 0) lista[i] = { ...lista[i], ...registro };
  else lista.push(registro);
  fs.writeFileSync(archivo, JSON.stringify(lista, null, 2), 'utf8');
  return registro;
}

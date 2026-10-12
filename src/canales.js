// =====================================================================
//  CANALES: un solo bot (sesionesoldschool) atiende todos los canales.
//  Cada canal conserva sus puntos, sus juegos, su IA (contexto propio),
//  su moderación y su overlay. La IA (cuota de Groq) se comparte.
//  Las credenciales (bot + token) son COMPARTIDAS: salen de la entrada
//  `propio` de config/canales.json o, en su defecto, del .env.
//  Un canal solo necesita: { channel, enabled, plan }. Sin tokens por canal,
//  sin cuentas de bot por cliente, sin autorizar nada por cliente.
//  (Se siguen respetando tokens propios por canal si existen: modo legacy.)
//
//  De dónde salen:
//    1) config/canales.json  -> [{ channel, enabled, plan, propio,
//                                 ajustes?, (legacy: bot, clientId, token...) }]
//    2) si no existe, se usa el .env de siempre (un solo canal, plan full)
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

function leerEnvDirecto(RAIZ) {
  const archivo = path.join(RAIZ, '.env');
  const datos = {};
  if (!fs.existsSync(archivo)) return datos;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    if (!linea || linea.startsWith('#') || !linea.includes('=')) continue;
    const i = linea.indexOf('=');
    datos[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  // En la nube las credenciales pueden venir por entorno (Render, etc.)
  for (const k of ['BOT_USERNAME', 'BOT_CLIENT_ID', 'BOT_TOKEN', 'BOT_REFRESH_TOKEN', 'BOT_TOKEN_EXPIRES_AT', 'CHANNEL']) {
    if (process.env[k] && !datos[k]) datos[k] = String(process.env[k]).trim();
  }
  return datos;
}

// Credenciales del bot único: entrada `propio` o .env/entorno.
export function credencialesCompartidas(RAIZ) {
  const archivo = path.join(RAIZ, 'config', 'canales.json');
  if (fs.existsSync(archivo)) {
    try {
      const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
      const p = Array.isArray(lista) ? lista.find((x) => x.propio === true) : null;
      if (p && (p.token || '').trim()) {
        return {
          bot: String(p.bot || '').toLowerCase().trim(),
          clientId: String(p.clientId || '').trim(),
          token: String(p.token || '').trim(),
          refreshToken: String(p.refreshToken || '').trim(),
          expiresAt: Number(p.expiresAt || 0),
          origen: 'canales.json (propio)',
        };
      }
    } catch {}
  }
  const env = leerEnvDirecto(RAIZ);
  return {
    bot: String(env.BOT_USERNAME || '').toLowerCase().trim(),
    clientId: String(env.BOT_CLIENT_ID || '').trim(),
    token: String(env.BOT_TOKEN || '').trim(),
    refreshToken: String(env.BOT_REFRESH_TOKEN || '').trim(),
    expiresAt: Number(env.BOT_TOKEN_EXPIRES_AT || 0),
    origen: '.env',
  };
}

// Fuente de las credenciales compartidas: primero la entrada `propio`
// DE LA PROPIA LISTA (en Render no hay archivo local), si no, archivo/.env.
export function resolverFuente(lista, RAIZ) {
  const p = (lista || []).find((x) => x.propio === true && (x.token || '').trim());
  if (p) {
    return {
      bot: String(p.bot || '').toLowerCase().trim(),
      clientId: String(p.clientId || '').trim(),
      token: String(p.token || '').trim(),
      refreshToken: String(p.refreshToken || '').trim(),
      expiresAt: Number(p.expiresAt || 0),
      origen: `canal #${p.channel} (propio)`,
    };
  }
  return credencialesCompartidas(RAIZ);
}

function propagarCredenciales(lista, compartidas) {
  for (const c of lista) {
    const traeToken = Boolean((c.token || '').trim());
    c.tokenPropio = traeToken && !c.propio;
    if (!traeToken) {
      c.bot = compartidas.bot;
      c.clientId = compartidas.clientId;
      c.token = compartidas.token;
      c.refreshToken = compartidas.refreshToken;
      c.expiresAt = compartidas.expiresAt;
      c.heredado = true;
    }
  }
  return lista;
}

function normalizarEntrada(c) {
  return {
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
    ajustes: c.ajustes && typeof c.ajustes === 'object' ? c.ajustes : undefined,
  };
}

export function leerCanales(RAIZ) {
  // En la nube no hay archivos: la lista puede venir en la variable CANALES_JSON.
  // Las entradas sin token heredan las credenciales compartidas (no se filtran).
  if (process.env.CANALES_JSON) {
    try {
      const lista = JSON.parse(process.env.CANALES_JSON);
      if (!Array.isArray(lista)) throw new Error('CANALES_JSON debe ser una lista');
      const normal = lista.map(normalizarEntrada).filter((c) => c.channel);
      return propagarCredenciales(normal, resolverFuente(normal, RAIZ));
    } catch (e) {
      throw new Error(`CANALES_JSON no vale: ${e.message}`);
    }
  }
  const archivo = path.join(RAIZ, 'config', 'canales.json');
  if (fs.existsSync(archivo)) {
    try {
      const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
      if (!Array.isArray(lista)) throw new Error('canales.json debe ser una lista');
      const normal = lista.map(normalizarEntrada).filter((c) => c.channel);
      return propagarCredenciales(normal, resolverFuente(normal, RAIZ));
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

// Guarda el token renovado en la entrada `propio` (bot único compartido).
export function guardarTokenCompartido(RAIZ, { token, refreshToken, expiresAt }) {
  const archivo = path.join(RAIZ, 'config', 'canales.json');
  if (!fs.existsSync(archivo)) return false;
  const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const p = lista.find((x) => x.propio === true);
  if (!p) return false;
  if (token) p.token = token;
  if (refreshToken) p.refreshToken = refreshToken;
  if (expiresAt) p.expiresAt = expiresAt;
  fs.writeFileSync(archivo, JSON.stringify(lista, null, 2), 'utf8');
  return true;
}

// Alta de un canal de cliente: SOLO nombre + plan. Sin tokens, sin cuentas
// de bot, sin autorizar nada. El cliente solo tiene que poner al bot de mod:
//   /mod sesionesoldschool   (o el nombre que tenga el bot único)
export function altaCanal(RAIZ, { channel, plan = 'full' }) {
  const dir = path.join(RAIZ, 'config');
  const archivo = path.join(dir, 'canales.json');
  fs.mkdirSync(dir, { recursive: true });
  let lista = [];
  if (fs.existsSync(archivo)) {
    try { lista = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { lista = []; }
    if (!Array.isArray(lista)) lista = [];
  }
  channel = String(channel || '').toLowerCase().trim().replace(/^@/, '');
  if (!channel) throw new Error('Falta el canal');
  const i = lista.findIndex((x) => String(x.channel || '').toLowerCase() === channel);
  if (i >= 0) {
    lista[i].enabled = true;
    if (plan) lista[i].plan = String(plan).toLowerCase().trim() || lista[i].plan || 'full';
  } else {
    lista.push({ channel, enabled: true, plan: String(plan || 'full').toLowerCase().trim() || 'full' });
  }
  fs.writeFileSync(archivo, JSON.stringify(lista, null, 2), 'utf8');
  return lista.find((x) => String(x.channel || '').toLowerCase() === channel);
}

// Guarda tokens renovados en la entrada de UN canal (modo legacy con token propio).
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

// Ajustes guardados de un canal (para fusionar sin pisar ramas hermanas).
export function leerAjustes(RAIZ, channel) {
  try {
    const archivo = path.join(RAIZ, 'config', 'canales.json');
    if (!fs.existsSync(archivo)) return null;
    const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    const c = lista.find((x) => String(x.channel || '').toLowerCase() === String(channel).toLowerCase());
    return (c && c.ajustes && typeof c.ajustes === 'object') ? c.ajustes : null;
  } catch {
    return null;
  }
}

// YouTube de un canal (refreshToken + videoId fijo). Se fusiona con lo que
// haya, sin tocar el resto de la entrada. Los tokens solo los tocan scripts.
export function guardarYoutube(RAIZ, channel, obj) {
  const dir = path.join(RAIZ, 'config');
  const archivo = path.join(dir, 'canales.json');
  fs.mkdirSync(dir, { recursive: true });
  let lista = [];
  if (fs.existsSync(archivo)) {
    try { lista = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { lista = []; }
  }
  if (!Array.isArray(lista)) lista = [];
  const cual = String(channel || '').toLowerCase().trim().replace(/^@/, '');
  if (!cual) throw new Error('Falta el canal');
  let c = lista.find((x) => String(x.channel || '').toLowerCase() === cual);
  if (!c) {
    c = { channel: cual, enabled: true, plan: 'full' };
    lista.push(c);
  }
  c.youtube = { ...(c.youtube || {}) };
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    c.youtube[k] = v;
  }
  fs.writeFileSync(archivo, JSON.stringify(lista, null, 2), 'utf8');
  return c.youtube;
}

// Fusión profunda solo de las ramas que el panel permite tocar.
const RAMAS = ['conversation', 'games', 'promos', 'songrequests', 'bpm', 'festero', 'economy', 'commands', 'multichat'];
export function fusionarAjustes(configBase, ajustes) {
  const cfg = JSON.parse(JSON.stringify(configBase));
  for (const rama of RAMAS) {
    if (rama === 'multichat') continue; // se fusiona abajo con proteccion de tokens
    if (ajustes && ajustes[rama] && typeof ajustes[rama] === 'object') {
      cfg[rama] = { ...(cfg[rama] || {}), ...ajustes[rama] };
    }
  }
  if (ajustes && typeof ajustes.prefix === 'string' && ajustes.prefix) cfg.prefix = ajustes.prefix;
  // multichat: un nivel mas hondo y los tokens ni se miran
  // (solo los tocan AUTORIZAR-YT.cmd y el propio bot al renovar).
  if (ajustes && ajustes.multichat && typeof ajustes.multichat === 'object') {
    cfg.multichat = (cfg.multichat && typeof cfg.multichat === 'object') ? cfg.multichat : {};
    for (const sub of ['youtube', 'kick']) {
      const inc = ajustes.multichat[sub];
      if (inc && typeof inc === 'object') {
        const base = (cfg.multichat[sub] && typeof cfg.multichat[sub] === 'object') ? cfg.multichat[sub] : {};
        const mezcla = { ...base };
        for (const [k, v] of Object.entries(inc)) {
          if (/token|secret|clave/i.test(k)) continue;
          mezcla[k] = v;
        }
        cfg.multichat[sub] = mezcla;
      }
    }
    for (const [k, v] of Object.entries(ajustes.multichat)) {
      if (k !== 'youtube' && k !== 'kick') cfg.multichat[k] = v;
    }
  }
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

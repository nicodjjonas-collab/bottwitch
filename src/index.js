// Arranque del bot: lee la configuración, se conecta a Twitch y une todas las piezas.
//
//   npm start                 -> arranca normalmente
//   npm start -- --dry-run    -> comprueba la configuración y los juegos y sale
//   npm run auth              -> autoriza la cuenta del bot con Twitch

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';
import { validarToken, refrescarToken } from './auth.js';
import { crearLLM } from './brain/llm.js';
import { leerCanales, guardarTokenCanal } from './canales.js';
import { crearCanal } from './canal.js';
import { crearPuente } from './puente.js';
import { crearPanel } from './panel.js';
import { validarCanal } from './licencias.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const DRY_RUN = process.argv.includes('--dry-run');

function leerConfig() {
  const archivo = path.join(RAIZ, 'config.json');
  if (!fs.existsSync(archivo)) {
    logger.error('No encuentro config.json. ¿Esta el archivo en la carpeta del bot?');
    process.exit(1);
  }
  try {
    const crudo = fs.readFileSync(archivo, 'utf8');
    const json = JSON.parse(crudo);
    // Quitamos las claves de documentacion que empiezan por "_"
    const limpiar = (obj) => {
      if (Array.isArray(obj)) return obj;
      if (obj && typeof obj === 'object') {
        const salida = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k.startsWith('_')) continue;
          salida[k] = limpiar(v);
        }
        return salida;
      }
      return obj;
    };
    return limpiar(json);
  } catch (e) {
    logger.error(`config.json tiene un error de formato: ${e.message}`);
    process.exit(1);
  }
}

function bannerMulti(config, lista) {
  logger.linea();
  console.log('   BOT DE CHAT PARA TWITCH (multi-canal)');
  console.log('   conversacion + juegos + moderacion + recordatorios');
  logger.linea();
  for (const c of lista) {
    logger.info(`Canal #${c.channel} -> bot ${c.bot || '(por confirmar)'} · plan ${c.plan || 'full'}${c.propio ? ' (propio)' : ''}`);
  }
  logger.info(`Prefijo      : ${config.prefix}`);
  logger.info(`Conversacion : ${config.conversation.mode === 'llm' ? 'IA (LLM, cuota compartida)' : 'local (reglas)'} | responder a ~${Math.round((config.conversation.replyChance || 0) * 100)}% de los mensajes`);
  logger.info(`Moderacion   : ${config.moderation.enabled ? `${config.moderation.action} + escalado` : 'desactivada'}`);
  logger.linea();
}

async function principal() {
  const config = leerConfig();
  // Una sola IA para todos los canales (la cuota gratuita de Groq es por clave)
  const llm = crearLLM({ cfg: config.llm, log: logger });

  let lista;
  try {
    lista = leerCanales(RAIZ).filter((c) => c.enabled !== false);
  } catch (e) {
    logger.error(e.message);
    process.exit(1);
  }
  if (!lista.length) {
    logger.error('No hay canales activos. Autoriza uno con:  npm run auth -- --canal=tu_canal');
    process.exit(1);
  }
  bannerMulti(config, lista);

  const mundos = [];
  const exigir = config.comercial?.exigirLicencia === true;
  for (const c of lista) {
    const tag = `#${c.channel}`;
    // ---- licencia (solo frena si el modo comercial está activado) ----
    const lic = validarCanal(RAIZ, c, exigir);
    if (!lic.ok) {
      logger.error(`[${tag}] Parado: ${lic.motivo}. Vincula una licencia en el panel de admin.`);
      continue;
    }
    if (lic.plan && !c.propio) c.plan = lic.plan;
    if (!c.token && !DRY_RUN) {
      logger.error(`[${tag}] Falta el token. Autoriza con:  npm run auth -- --canal=${c.channel}`);
      continue;
    }
    // ---- validar / renovar token ----
    let info = null;
    if (!DRY_RUN) {
      info = await validarToken(c.token);
      if (!info && c.refreshToken && c.clientId) {
        logger.warn(`[${tag}] El token ya no vale. Intento renovarlo...`);
        try {
          const nuevos = await refrescarToken({ clientId: c.clientId, refreshToken: c.refreshToken });
          c.token = nuevos.access_token;
          c.refreshToken = nuevos.refresh_token || c.refreshToken;
          c.expiresAt = Date.now() + (nuevos.expires_in || 0) * 1000;
          const guardado = guardarTokenCanal(RAIZ, c.channel, { token: c.token, refreshToken: c.refreshToken, expiresAt: c.expiresAt });
          if (!guardado) logger.info(`[${tag}] Actualiza BOT_TOKEN en .env para que quede guardado.`);
          info = await validarToken(c.token);
          if (info) logger.ok(`[${tag}] Token renovado.`);
        } catch (e) {
          logger.error(`[${tag}] No pude renovar el token: ${e.message}`);
        }
      }
      if (!info) {
        logger.error(`[${tag}] Token no valido. Autoriza con:  npm run auth -- --canal=${c.channel}`);
        continue;
      }
      c.bot = (info.login || c.bot || '').toLowerCase();
      logger.ok(`[${tag}] Token valido. Bot: ${c.bot} (id ${info.user_id})`);
      if (info.scopes && !info.scopes.includes('moderator:manage:chat_messages')) {
        logger.warn(`[${tag}] Sin permiso para borrar mensajes. Re-autoriza con: npm run auth -- --canal=${c.channel}`);
      }
    } else {
      c.bot = c.bot || 'bot_de_prueba';
    }

    try {
      const mundo = await crearCanal({ channelCfg: { ...c, botId: info?.user_id || null }, config, RAIZ, llm, dryRun: DRY_RUN });
      mundo.chat.on('authfallida', async () => {
        const cc = mundo.cfg;
        if (!cc.refreshToken || !cc.clientId) {
          logger.error(`[${mundo.tag}] Sin refresh token. Autoriza con: npm run auth -- --canal=${mundo.canal}`);
          return;
        }
        try {
          const nuevos = await refrescarToken({ clientId: cc.clientId, refreshToken: cc.refreshToken });
          cc.token = nuevos.access_token;
          guardarTokenCanal(RAIZ, mundo.canal, { token: cc.token });
          mundo.chat.token = cc.token.startsWith('oauth:') ? cc.token : `oauth:${cc.token}`;
          logger.ok(`[${mundo.tag}] Token renovado; reconecto en 3 s...`);
          setTimeout(() => mundo.chat.conectar(), 3000);
        } catch (e) {
          logger.error(`[${mundo.tag}] No pude renovar: ${e.message}. Autoriza con: npm run auth -- --canal=${mundo.canal}`);
        }
      });
      mundos.push(mundo);
    } catch (e) {
      logger.error(`[${tag}] No pude montar el canal: ${e.stack || e.message}`);
    }
  }

  if (!mundos.length) {
    logger.error('Ningún canal arrancó. Revisa los tokens con npm run auth.');
    process.exit(1);
  }

  if (DRY_RUN) {
    logger.linea();
    logger.ok('Comprobacion terminada sin conectarse a Twitch.');
    for (const m of mundos) {
      logger.info(`[${m.tag}] Juegos: ${m.totalJuegos} · Cerebro: ${m.brain.modo === 'llm' ? 'IA' : 'local'} · Plan: ${m.plan}`);
    }
    try { for (const m of mundos) { m.guardar(); } } catch {}
    process.exit(0);
  }

  // ---- puente entre PCs (solo si hay PUENTE_CARPETA) ----
  const puente = crearPuente({ mundos, carpeta: (process.env.PUENTE_CARPETA || '').trim(), log: logger });

  // ---- latido de los juegos (todos los canales) ----
  const latido = setInterval(() => {
    for (const m of mundos) m.tick();
  }, 5000);

  const guardado = setInterval(() => { for (const m of mundos) m.guardar(); }, 120000);

  // ---- cierre ordenado ----
  const cerrar = (motivo) => {
    logger.warn(`Cerrando el bot (${motivo})...`);
    clearInterval(latido);
    clearInterval(guardado);
    try { puente?.detener(); } catch {}
    try { panel.detener(); } catch {}
    for (const m of mundos) {
      try { m.cerrar(); } catch (e) { logger.error(`[${m.tag}] al cerrar: ${e.message}`); }
    }
    setTimeout(() => process.exit(0), 600);
  };
  process.on('SIGINT', () => cerrar('Ctrl+C'));
  process.on('SIGTERM', () => cerrar('cierre del sistema'));
  process.on('unhandledRejection', (e) => logger.error(`Promesa rechazada sin capturar: ${e?.stack || e}`));
  process.on('uncaughtException', (e) => logger.error(`Excepcion no capturada: ${e?.stack || e}`));

  // ---- panel web (cada dueño configura su canal) ----
  const panel = crearPanel({ config, mundos, RAIZ, cerrar });

  // ---- a por ello ----
  if (puente) puente.iniciar();
  panel.iniciar();
  for (const m of mundos) m.chat.conectar();
  logger.ok(`En marcha en ${mundos.length} canal(es).`);
}

principal().catch((e) => {
  logger.error(`Fallo al arrancar: ${e.stack || e.message}`);
  process.exit(1);
});

// =====================================================================
//  Un canal = un mundo aislado: su chat, sus puntos, sus juegos, su IA
//  (contexto propio), sus promos, su moderación y sus datos para OBS.
// =====================================================================

import path from 'node:path';
import { logger } from './logger.js';
import { TwitchChat } from './irc.js';
import { crearHelix } from './helix.js';
import { Store } from './store.js';
import { crearModerador } from './moderation.js';
import { Brain } from './brain/index.js';
import { GameManager } from './games/index.js';
import { crearComandos } from './commands.js';
import { crearPromos } from './promos.js';
import { crearDatosOBS } from './obs.js';
import { crearPipeline } from './pipeline.js';
import { fusionarAjustes } from './canales.js';

export async function crearCanal({ channelCfg, config: configGlobal, RAIZ, llm, dryRun = false }) {
  const canal = channelCfg.channel;
  const datosId = canal.replace(/[^a-z0-9_]/g, '_');
  const tag = `#${canal}`;
  // Config propia del canal: base global + lo que toca el dueño en el panel
  const config = fusionarAjustes(configGlobal, channelCfg.ajustes);

  const helix = crearHelix({ clientId: channelCfg.clientId, token: channelCfg.token });

  let broadcasterId = null;
  let botId = channelCfg.botId || null;
  if (!dryRun) {
    const bc = await helix.usuario(canal).catch(() => null);
    broadcasterId = bc?.id || null;
    if (!broadcasterId) logger.warn(`[${tag}] No pude obtener el id del canal; borrar/sancionar puede fallar.`);
  }

  const chat = new TwitchChat({
    username: channelCfg.bot,
    token: channelCfg.token,
    channel: canal,
    chatConfig: config.chat,
  });

  const store = new Store({
    file: path.join(RAIZ, 'src', 'data', `stats-${datosId}.json`),
    debounceMs: config.advanced?.storeSaveDebounceMs ?? 4000,
  });

  const moderador = crearModerador({
    cfg: config.moderation,
    store,
    helix,
    broadcasterId,
    botId,
    decir: (t) => chat.say(t),
    log: logger,
  });

  const brain = new Brain({
    cfg: { ...config.conversation },
    llmCfg: config.llm,
    llm,
    memoryFile: path.join(RAIZ, 'src', 'data', `memoria-${datosId}.json`),
    store,
    moderador: moderador.mod,
    log: logger,
  });
  brain.nombreBot = channelCfg.bot;
  brain.prefijo = config.prefix;

  const juegos = new GameManager({
    cfg: config.games,
    configCompleto: config,
    store,
    chat,
    canal,
    log: logger,
    esModInterno: (u) => false,
  });
  const totalJuegos = await juegos.cargar();

  const runtime = {
    get modoIA() { return brain.cfg.mode; },
    set modoIA(v) { brain.cfg.mode = v; },
    promosActivas: true,
    juegosActivos: config.games.enabled !== false,
    mensajeFollow: () => '',
    plan: channelCfg.plan || 'full',
    propio: channelCfg.propio === true,
  };

  let ultimaActividad = 0;
  const promos = crearPromos({
    config,
    chat,
    runtime,
    ultimaActividad: () => ultimaActividad,
    brain,
    estaEnDirecto: () => helix.estaEnDirecto(canal),
    log: logger,
  });
  runtime.mensajeFollow = promos.mensajeFollow;

  const comandos = crearComandos({
    cfg: config,
    config,
    store,
    brain,
    juegos,
    moderador,
    chat,
    helix,
    runtime,
    ids: { broadcasterId, botId },
  });

  // Carpeta de datos para OBS: la tuya sigue siendo C:\OBS-Media\datos;
  // los demás canales usan datos-<canal> (en la nube, dentro del proyecto).
  // En Linux (Render) no existe C:\ : ahí todo va a datos-<canal>.
  const carpetaDatos = channelCfg.datos
    || (channelCfg.propio && (config.advanced?.datosOBS || (process.platform === 'win32' ? 'C:\\OBS-Media\\datos' : path.join(RAIZ, 'datos', datosId))))
    || path.join(RAIZ, 'datos', datosId);
  const datosOBS = crearDatosOBS({ store, juegos, config, canal, carpeta: carpetaDatos, log: logger });
  datosOBS.iniciar();

  const pipeline = crearPipeline({ config, store, chat, brain, juegos, moderador, comandos, promos, log: logger });

  chat.on('conectado', () => {
    logger.linea();
    logger.ok(`Bot en marcha en ${tag} (plan ${runtime.plan}${runtime.propio ? ', propio: gratis con todo' : ''}).`);
    logger.linea();
    promos.iniciar();
  });
  chat.on('mensaje', (mensaje) => {
    ultimaActividad = Date.now();
    logger.chat(`${tag} ${mensaje.usuario}`, mensaje.texto);
    pipeline.procesarMensaje(mensaje);
  });
  chat.on('avisoUsuario', (aviso) => {
    logger.info(`[${tag}] Evento: ${aviso.tipo} ${aviso.usuario || ''}`);
    promos.avisoUsuario(aviso);
  });

  return {
    canal,
    tag,
    cfg: channelCfg,
    get config() { return config; },
    plan: runtime.plan,
    propio: runtime.propio,
    chat,
    brain,
    juegos,
    moderador,
    totalJuegos,
    // Aplica ajustes del panel en caliente (casi todo; plan/ids piden reinicio)
    aplicarAjustes(nuevos) {
      const antes = JSON.stringify({ m: brain.cfg.mode, r: brain.cfg.replyChance });
      const f = fusionarAjustes(config, nuevos || {});
      // conversación (vive al momento)
      brain.cfg.enabled = f.conversation.enabled !== false;
      brain.cfg.mode = f.conversation.mode || brain.cfg.mode;
      if (isFinite(Number(f.conversation.replyChance))) brain.cfg.replyChance = Number(f.conversation.replyChance);
      // promos (se leen vivas del mismo objeto)
      Object.assign(config.promos, f.promos || {});
      // juegos on/off vive; la lista de desactivados pide reinicio
      const juegosAntes = JSON.stringify(config.games.disabled || []);
      runtime.juegosActivos = f.games.enabled !== false;
      Object.assign(config.games, f.games || {});
      Object.assign(config.songrequests || {}, f.songrequests || {});
      if (f.prefix) { config.prefix = f.prefix; try { brain.prefijo = f.prefix; } catch {} }
      const despues = JSON.stringify({ m: brain.cfg.mode, r: brain.cfg.replyChance });
      const reinicio = JSON.stringify(f.games?.disabled || []) !== juegosAntes;
      return { ok: true, cambio: antes !== despues, reinicioNecesario: reinicio };
    },
    fijarBotId(id) { botId = id || botId; },
    tick() { try { juegos.tick(); } catch (e) { logger.error(`[${tag}] latido: ${e.message}`); } },
    guardar() { try { store.guardar(true); } catch {} try { brain.guardarMemoria(); } catch {} },
    cerrar() {
      promos.detener();
      try { chat.say('Me voy a descansar un rato 👋'); } catch {}
      brain.cerrar();
      datosOBS.detener();
      store.cerrar();
      chat.desconectar();
    },
    iniciarDatos() { datosOBS.iniciar(); },
  };
}

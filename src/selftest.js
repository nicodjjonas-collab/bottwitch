// AUTOTEST: comprueba que todo funciona SIN conectarse a Twitch.
// Ejecuta:  npm test
//
// Simula un chat con mensajes normales, tacos, comandos y partidas de juegos,
// y verifica que el bot responde como debe.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { parsearLinea, mensajeDe, datosDeLimpieza } from './irc.js';
import { Brain } from './brain/index.js';
import { GameManager } from './games/index.js';
import { crearModerador } from './moderation.js';
import { crearComandos } from './commands.js';
import { crearPromos, sanearAlertas, MAX_ALERTAS } from './promos.js';
import { crearPipeline } from './pipeline.js';
import { crearLLM } from './brain/llm.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');

const C = { v: '\x1b[32m', r: '\x1b[31m', a: '\x1b[33m', g: '\x1b[90m', x: '\x1b[0m', b: '\x1b[36m' };
let fallos = 0;
let pruebas = 0;

function comprobar(nombre, condicion, detalle = '') {
  pruebas += 1;
  if (condicion) {
    console.log(`  ${C.v}OK  ${C.x} ${nombre}`);
  } else {
    fallos += 1;
    console.log(`  ${C.r}FALLA${C.x} ${nombre} ${detalle ? `${C.g}(${detalle})${C.x}` : ''}`);
  }
}

function leerConfig() {
  const limpiar = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === 'object') {
      const salida = {};
      for (const [k, v] of Object.entries(obj)) { if (!k.startsWith('_')) salida[k] = limpiar(v); }
      return salida;
    }
    return obj;
  };
  return limpiar(JSON.parse(fs.readFileSync(path.join(RAIZ, 'config.json'), 'utf8')));
}

// Chat falso: en vez de hablar por Twitch, guarda lo que diria
function chatFalso() {
  const dichos = [];
  return {
    dichos,
    say: (t) => { if (t) dichos.push(String(t)); },
    sayMany: async (arr) => { for (const t of arr || []) if (t) dichos.push(String(t)); },
    on: () => {},
    conectar: () => {},
    desconectar: () => {},
    sayManySync: (arr) => { for (const t of arr || []) if (t) dichos.push(String(t)); },
    último: () => dichos[dichos.length - 1] || '',
    limpiar: () => { dichos.length = 0; },
    todo: () => dichos.join(' | '),
  };
}

async function principal() {
  console.log(`\n${C.b}===== AUTOTEST DEL BOT =====${C.x}\n`);

  const config = leerConfig();
  const chat = chatFalso();

  // Almacen temporal para no tocar los datos reales
  const archivoPrueba = path.join(RAIZ, 'src', 'data', 'autotest.json');
  if (fs.existsSync(archivoPrueba)) fs.unlinkSync(archivoPrueba);
  const store = new Store({ file: archivoPrueba, debounceMs: 10 });

  // ---- 1) moderacion ----
  console.log(`${C.b}1) Moderacion de palabras ofensivas${C.x}`);
  const moderador = crearModerador({
    cfg: config.moderation, store, helix: { borrarMensaje: async () => ({ ok: false }), sancionar: async () => ({ ok: false }), usuario: async () => null },
    broadcasterId: '1', botId: '2', decir: (t) => chat.say(t),
  });
  const casos = [
    ['hola que tal, buena música', false],
    ['esto es una mierda', true],
    ['eres un puto genio', true],
    ['P U T A', true],
    ['p.u.t.a madre', true],
    ['p u t a', true],
    ['menudo gilipollas', true],
    ['la computadora esta rota', false],
    ['hay una disputa en el chat', false],
    ['me gusta la reputacion del canal', false],
    ['BUENASSSS', false],
    ['mierdaaa', true],
    ['eres un retrasado', true],
    ['viva el trance', false],
  ];
  for (const [texto, esperado] of casos) {
    const r = moderador.analizar(texto);
    comprobar(`"${texto}" -> ${r.ofensivo ? 'ofensivo' : 'limpio'}`, r.ofensivo === esperado, `detecto: ${r.encontradas.join(',')}`);
  }

  // ---- 2) juegos ----
  console.log(`\n${C.b}2) Carga de juegos${C.x}`);
  const juegos = new GameManager({ cfg: config.games, configCompleto: config, store, chat, canal: 'prueba', esModInterno: () => false });
  const total = await juegos.cargar();
  comprobar('Se cargan juegos', total >= 6, `cargados: ${total}`);
  for (const id of ['ahorcado', 'tresenraya', 'trivia']) {
    comprobar(`Existe el juego "${id}"`, Boolean(juegos.buscar(id)));
  }

  // ---- 3) arranque de una partida real ----
  console.log(`\n${C.b}3) Partida de prueba${C.x}`);
  const primerJuego = juegos.listar()[0];
  if (primerJuego) {
    chat.limpiar();
    const r = juegos.arrancar(primerJuego.id, { usuario: 'tester', usuarioMin: 'tester' }, []);
    comprobar(`Arranca "${primerJuego.id}"`, r.ok, r.motivo || '');
    comprobar('El juego ha saludado por el chat', chat.dichos.length > 0, `${chat.dichos.length} mensaje(s)`);
    // Le mandamos basura y un par de mensajes para ver que no explota
    let reventado = false;
    try {
      juegos.manejarMensaje({ usuario: 'tester', usuarioMin: 'tester', texto: 'a' });
      juegos.manejarMensaje({ usuario: 'otro', usuarioMin: 'otro', texto: '!entrar' });
      juegos.manejarMensaje({ usuario: 'otro', usuarioMin: 'otro', texto: '5' });
      for (let i = 0; i < 5; i++) juegos.tick();
    } catch (e) { reventado = true; console.log(`     ${C.r}${e.message}${C.x}`); }
    comprobar('Aguanta mensajes y latidos sin reventar', !reventado);
    juegos.cancelar('fin de la prueba');
    comprobar('La partida se cancela', juegos.estado().activa === false);
  }

  // ---- 4) cerebro ----
  console.log(`\n${C.b}4) Cerebro (modo local)${C.x}`);
  const brain = new Brain({ cfg: { ...config.conversation, mode: 'local' }, llmCfg: config.llm, memoryFile: archivoPrueba, store, moderador: moderador.mod });
  brain.nombreBot = 'botprueba';
  brain.prefijo = '!';

  // 4a) El motor de plantillas SIEMPRE responde a estas frases (es determinista).
  const frases = ['hola bot', 'que temazo', 'me encanta el trance', 'que canción es esta?', 'jajaja', 'gracias!'];
  let conRespuesta = 0;
  for (const m of frases) {
    brain.registrar({ usuario: 'tester', texto: m });
    const salida = brain.local.responder({ texto: m, usuario: 'tester', contexto: brain.contexto.slice(-4) });
    if (salida) {
      conRespuesta += 1;
      console.log(`     ${C.g}tester: ${m}  ->  bot: ${salida}${C.x}`);
    }
  }
  comprobar('El motor local responde a las frases con intencion', conRespuesta === frases.length, `${conRespuesta}/${frases.length}`);

  // 4b) La capa que decide SI hablar es aleatoria a proposito (replyChance),
  //     así que para probarla forzamos que siempre quiera responder.
  const brainForzado = new Brain({
    cfg: { ...config.conversation, mode: 'local', replyChance: 1, replyToQuestions: true, minDelayMs: 0, maxDelayMs: 0 },
    llmCfg: config.llm, memoryFile: archivoPrueba, store, moderador: moderador.mod,
  });
  brainForzado.nombreBot = 'botprueba';
  brainForzado.prefijo = '!';
  brainForzado.registrar({ usuario: 'tester', texto: 'hola bot' });
  const decidido = await brainForzado.pensar({ usuario: 'tester', texto: 'hola bot', esMod: false, esBroadcaster: false });
  comprobar('Decide hablar cuando le toca', decidido !== null, decidido ? `"${decidido.texto}"` : 'no respondio');
  comprobar('No responde a sus propios comandos', (await brainForzado.pensar({ usuario: 't', texto: '!puntos' })) === null);

  // 4c) Datos en vivo: el detector es puro (sin red) y el fetch nunca revienta.
  const { detectarVivo, datoEnVivo } = await import('./brain/vivo.js');
  const casosVivo = [
    ['qué hora es?', 'hora', null],
    ['qué tiempo hace en Sevilla?', 'clima', 'sevilla'],
    ['cuánto está el bitcoin?', 'cripto', 'bitcoin'],
    ['a cuánto está el dólar?', 'divisa', 'USD'],
    ['cómo va el ibex?', 'bolsa', 'ibex'],
    ['cuánto vale santander?', 'bolsa', 'santander'],
    ['alguna noticia del madrid?', 'noticia', null],
    ['hola que tal todo bien?', null, null],
  ];
  let vivosOk = 0;
  for (const [texto, tipo, pista] of casosVivo) {
    const d = detectarVivo(texto);
    const bien = tipo === null ? d === null : (d && d.tipo === tipo && (pista === null || JSON.stringify(d).toLowerCase().includes(String(pista).toLowerCase())));
    if (bien) vivosOk += 1;
    else console.log(`     ${C.r}detector: "${texto}" -> ${JSON.stringify(d)}${C.x}`);
  }
  comprobar('El detector de preguntas en vivo acierta', vivosOk === casosVivo.length, `${vivosOk}/${casosVivo.length}`);
  comprobar('Sin pregunta viva no hay fetch', (await datoEnVivo('hola que tal todo bien?')) === null);
  const horaViva = await datoEnVivo('qué hora es?');
  comprobar('La hora sale sin internet', typeof horaViva === 'string' && horaViva.length > 10, (horaViva || '').slice(0, 60));

  // ---- 5) comandos ----
  console.log(`\n${C.b}5) Comandos${C.x}`);
  const runtime = {
    get modoIA() { return brain.cfg.mode; }, set modoIA(v) { brain.cfg.mode = v; },
    promosActivas: true, juegosActivos: true, mensajeFollow: () => 'sigueme!',
  };
  const promos = crearPromos({ config, chat, runtime, ultimaActividad: () => Date.now() });
  const comandos = crearComandos({
    cfg: config, config, store, brain, juegos, moderador, chat,
    helix: { usuario: async () => null }, runtime, ids: {},
  });
  const pipeline = crearPipeline({ config, store, chat, brain, juegos, moderador, comandos, promos });

  const pruebasComandos = [
    ['!ayuda', true],
    ['!juegos', true],
    ['!puntos', true],
    ['!top', true],
    ['!estado', true],
    ['!seguir', true],
    ['!bot', true],
    ['!inventado', false],
  ];
  for (const [texto, esperado] of pruebasComandos) {
    chat.limpiar();
    const r = await comandos.manejar({ usuario: 'tester', usuarioMin: 'tester', texto, esMod: false, esBroadcaster: false });
    comprobar(`Comando "${texto}" atendido=${r}`, r === esperado);
    if (esperado) comprobar(`   ...y responde algo`, chat.dichos.length > 0, chat.último().slice(0, 60));
  }

  // Comandos de moderador siendo mod
  chat.limpiar();
  await comandos.manejar({ usuario: 'mod', usuarioMin: 'mod', texto: '!prohibir churro', esMod: true, esBroadcaster: false });
  comprobar('!prohibir anade la palabra', moderador.mod.analizar('vaya churro').ofensivo);

  // ---- 6) tuberia completa ----
  console.log(`\n${C.b}6) Tuberia completa (mensaje real simulado)${C.x}`);
  chat.limpiar();
  const r1 = await pipeline.procesarMensaje({ usuario: 'pepe', usuarioMin: 'pepe', texto: 'hola a todos!', esMod: false, esBroadcaster: false, id: 'x1', userId: '9' });
  comprobar('Mensaje normal pasa por la tuberia', r1.motivo !== 'error', r1.motivo);

  chat.limpiar();
  const r2 = await pipeline.procesarMensaje({ usuario: 'troll', usuarioMin: 'troll', texto: 'eres un puto tonto', esMod: false, esBroadcaster: false, id: 'x2', userId: '10' });
  comprobar('Mensaje ofensivo se corta en moderacion', r2.motivo === 'moderacion', r2.motivo);
  comprobar('Se avisa al usuario en el chat', chat.dichos.length > 0, chat.último().slice(0, 70));
  comprobar('Se le suma un aviso', store.getWarnings('troll') >= 1, `avisos: ${store.getWarnings('troll')}`);

  chat.limpiar();
  const r3 = await pipeline.procesarMensaje({ usuario: 'pepe', usuarioMin: 'pepe', texto: '!puntos', esMod: false, esBroadcaster: false, id: 'x3', userId: '9' });
  comprobar('Un comando se atiende', r3.motivo === 'comando', r3.motivo);

  // ---- 7) almacen ----
  console.log(`\n${C.b}7) Almacen de datos${C.x}`);
  store.addPoints('pepe', 25);
  comprobar('Los puntos se suman', store.getPoints('pepe') === 25, `tiene ${store.getPoints('pepe')}`);
  store.guardar(true);
  comprobar('El archivo de datos se escribe', fs.existsSync(archivoPrueba));
  const releido = new Store({ file: archivoPrueba, debounceMs: 10 });
  comprobar('Los datos se recuperan al reiniciar', releido.getPoints('pepe') === 25);
  comprobar('El ranking ordena bien', releido.top(3).length > 0);

  // ---- 8) comandos nuevos: festero, música y bpm ----
  console.log(`\n${C.b}8) Comandos nuevos (festero, peticiones, bpm, 8ball, so)${C.x}`);
  const mandar = (texto, opciones = {}) => comandos.manejar({
    usuario: opciones.usuario || 'ana',
    usuarioMin: (opciones.usuario || 'ana').toLowerCase(),
    texto,
    esMod: Boolean(opciones.mod),
    esBroadcaster: Boolean(opciones.broadcaster),
  });

  chat.limpiar();
  await mandar('!festero');
  comprobar('!festero responde con un porcentaje', /% de ganas de fiesta/.test(chat.último()), chat.último().slice(0, 70));
  comprobar('!festero pinta la barra', /█|░/.test(chat.último()));
  chat.limpiar();
  await mandar('!festero @luis', { usuario: 'pepe' });
  comprobar('!festero @usuario mide a ese usuario', /@luis/.test(chat.último()), chat.último().slice(0, 70));

  chat.limpiar();
  await mandar('!sr Cafe del Mar');
  comprobar('!sr anade a la cola', /Apuntado/.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!sr Otra cosa');
  comprobar('!sr respeta la espera por persona', /espera/.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!sr http://spam.com/x', { usuario: 'luis' });
  comprobar('!sr rechaza enlaces', /sin enlaces/.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!cola', { usuario: 'luis' });
  comprobar('!cola muestra la peticion', /Cafe del Mar/.test(chat.último()), chat.último().slice(0, 80));
  chat.limpiar();
  await mandar('!siguiente', { usuario: 'mod', mod: true });
  comprobar('!siguiente (mod) saca de la cola', /Siguiente/.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!siguiente', { usuario: 'pepe' });
  comprobar('!siguiente sin ser mod avisa', /moderador|streamer/.test(chat.último()), chat.último().slice(0, 70));

  chat.limpiar();
  await mandar('!bpmreal 128', { usuario: 'jonasrdb', broadcaster: true });
  comprobar('!bpmreal anota el BPM', /BPM anotado/.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!bpm 126');
  comprobar('!bpm anota la apuesta', /Anotado/.test(chat.último()), chat.último().slice(0, 70));
  await mandar('!bpm 140', { usuario: 'luis' });
  chat.limpiar();
  await mandar('!bpmfin', { usuario: 'jonasrdb', broadcaster: true });
  const resumenBpm = chat.dichos.join(' | ');
  comprobar('!bpmfin revela el BPM real', /Eran 128 BPM/.test(resumenBpm), resumenBpm.slice(0, 80));
  comprobar('!bpmfin da el punto al mas cercano', /ana/.test(resumenBpm), resumenBpm.slice(0, 80));

  chat.limpiar();
  await mandar('!8ball gano el finde?');
  comprobar('!8ball responde algo', chat.dichos.length > 0, chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!so @luis');
  comprobar('!so hace shoutout', /Seguid a luis/.test(chat.último()), chat.último().slice(0, 70));

  // ---- 9) recordatorio de los comandos del overlay de muñequitos ----
  console.log(`\n${C.b}9) Recordatorio de Stream Avatars (cada 15 min)${C.x}`);
  const cfgAvatares = config.promos?.recordatorioAvatares || {};
  comprobar('Esta configurado cada 15 minutos', cfgAvatares.everyMinutes === 15, String(cfgAvatares.everyMinutes));
  comprobar('Tiene mensajes que recordar', Array.isArray(cfgAvatares.messages) && cfgAvatares.messages.length >= 3, `${(cfgAvatares.messages || []).length} mensajes`);
  comprobar('Limita cuantas veces sale por directo', cfgAvatares.maxPerStream > 0, String(cfgAvatares.maxPerStream));

  const contadorAntes = promos.contadorAvatares;
  chat.limpiar();
  promos.recordatorioAvatares();
  comprobar('El recordatorio manda un mensaje', chat.dichos.length === 1, `${chat.dichos.length} mensaje(s)`);
  const dicho = chat.último();
  comprobar('Menciona comandos del overlay', /!(skin|baila|abraza|duelo|carrera|fiesta|avatar|acciones|festero|hype|color)/i.test(dicho), dicho.slice(0, 80));
  comprobar('El contador sube', promos.contadorAvatares === contadorAntes + 1, `${contadorAntes} -> ${promos.contadorAvatares}`);
  comprobar('Todos los mensajes configurados son validos para el chat', (cfgAvatares.messages || []).every((m) => m.length > 10 && m.length < 480));

  // el aviso de que las promos están apagadas debe funcionar
  runtime.promosActivas = false;
  chat.limpiar();
  promos.recordatorioAvatares();
  comprobar('Con !promos off no dice nada', chat.dichos.length === 0, `${chat.dichos.length} mensaje(s)`);
  runtime.promosActivas = true;

  // ---- 9b) alertas personalizadas (hasta 50, desde el panel) ----
  console.log(`\n${C.b}9b) Alertas personalizadas${C.x}`);
  comprobar('Tope de 50 alertas', MAX_ALERTAS === 50, String(MAX_ALERTAS));
  const muchas = Array.from({ length: 55 }, (_, i) => ({ id: `a${i}`, messages: [`m${i}`] }));
  comprobar('Se recortan a 50', sanearAlertas(muchas).length === 50, `${sanearAlertas(muchas).length}`);
  comprobar('Sin lista no hay alertas', sanearAlertas(null).length === 0 && sanearAlertas('hola').length === 0);
  const sucias = [
    { id: 'ok', nombre: '  Redes  ', messages: ['  hola chat  '] },
    null, 'texto', 42,
    { id: 'vacia', messages: [] }, { id: 'blancos', messages: ['   '] },
    { id: 'dup', messages: ['uno'] }, { id: 'dup', messages: ['dos'] },
    { id: 'larga', messages: ['x'.repeat(500)] },
    { id: 'tiempos', messages: ['t'], everyMinutes: 0, minutoInicial: -3, maxPerStream: -1, onlyIfChatActiveSeconds: 999999 },
    { id: 'apagada', messages: ['z'], enabled: false },
  ];
  const limpias = sanearAlertas(sucias);
  comprobar('Se queda lo válido y se tira la basura', limpias.length === 5, limpias.map((a) => a.id).join(','));
  const ok1 = limpias.find((a) => a.id === 'ok');
  comprobar('Recorta espacios del nombre y mensajes', ok1.nombre === 'Redes' && ok1.messages[0] === 'hola chat');
  comprobar('Sin id duplicados', limpias.filter((a) => a.id === 'dup').length === 1);
  const larga = limpias.find((a) => a.id === 'larga');
  comprobar('Mensajes capados a 480 caracteres', larga.messages[0].length === 480 && larga.messages[0].endsWith('…'));
  const tiempos = limpias.find((a) => a.id === 'tiempos');
  comprobar('Tiempos acotados', tiempos.everyMinutes === 1 && tiempos.minutoInicial === 0 && tiempos.maxPerStream === 0 && tiempos.onlyIfChatActiveSeconds === 86400, JSON.stringify({ cada: tiempos.everyMinutes, ini: tiempos.minutoInicial, tope: tiempos.maxPerStream }));
  comprobar('Valores por defecto sanos', ok1.everyMinutes === 20 && ok1.minutoInicial === 5 && ok1.maxPerStream === 0 && ok1.enabled === true);

  const chatAl = chatFalso();
  const cfgAl = { promos: { alertas: [{ id: 't1', nombre: 'Test', messages: ['aviso!'], everyMinutes: 20, minutoInicial: 5, onlyIfChatActiveSeconds: 300, maxPerStream: 1 }] } };
  const pAl = crearPromos({ config: cfgAl, chat: chatAl, runtime: { promosActivas: true }, ultimaActividad: () => Date.now() });
  comprobar('Dispara la alerta', pAl.dispararAlerta({ id: 't1', nombre: 'Test', messages: ['aviso!'], everyMinutes: 20, onlyIfChatActiveSeconds: 300 }) === true && chatAl.último() === 'aviso!');
  comprobar('Respeta el tope por directo', pAl.dispararAlerta({ id: 't1', nombre: 'Test', messages: ['aviso!'], maxPerStream: 1 }) === false && chatAl.dichos.length === 1, `${chatAl.dichos.length} mensaje(s)`);
  comprobar('Probar no gasta el cupo', pAl.dispararAlertaPorId('t1').ok === true && pAl.dispararAlertaPorId('t1').ok === true);
  comprobar('Desactivada no habla', pAl.dispararAlerta({ id: 't2', messages: ['x'], enabled: false }) === false);
  comprobar('Id desconocido avisa', pAl.dispararAlertaPorId('xxx').ok === false);
  const chatParado = chatFalso();
  const pParado = crearPromos({ config: cfgAl, chat: chatParado, runtime: { promosActivas: true }, ultimaActividad: () => 0 });
  comprobar('Con chat parado no habla', pParado.dispararAlerta({ id: 't1', messages: ['aviso!'], onlyIfChatActiveSeconds: 300 }) === false && chatParado.dichos.length === 0);
  const chatOff = chatFalso();
  const pOff = crearPromos({ config: cfgAl, chat: chatOff, runtime: { promosActivas: false }, ultimaActividad: () => Date.now() });
  comprobar('Con promos apagadas no habla', pOff.dispararAlerta({ id: 't1', messages: ['aviso!'] }) === false);
  comprobar('Lista lo programado', pAl.listaAlertas().length === 1 && pAl.listaAlertas()[0].id === 't1');
  cfgAl.promos.alertas.push({ id: 't2', messages: ['segunda'] });
  comprobar('Recargar reprograma en caliente', pAl.recargarAlertas() === 2, `${pAl.recargarAlertas()} (llamada extra no duplica envíos)`);
  const pVacia = crearPromos({ config: { promos: {} }, chat: chatFalso(), runtime: { promosActivas: true }, ultimaActividad: () => Date.now() });
  pVacia.iniciar();
  pVacia.detener();
  comprobar('Sin alertas arranca y para sin romperse', true);

  // ---- 10) lector de IRC (esto es lo que habla con Twitch) ----
  console.log(`\n${C.b}10) Lector de IRC de Twitch${C.x}`);
  const lineaPrueba = '@bits=250;color=#1E90FF;display-name=LunaTrance;first-msg=1;id=abc-123;mod=0;subscriber=1;tmi-sent-ts=1700000000000;user-id=99 :lunatrance!lunatrance@lunatrance.tmi.twitch.tv PRIVMSG #jonasrdb :que temazo 🔥';
  const parseada = parsearLinea(lineaPrueba);
  comprobar('IRC: extrae el comando PRIVMSG', parseada.comando === 'PRIVMSG', parseada.comando);
  comprobar('IRC: el texto llega entero', parseada.params[1] === 'que temazo 🔥', parseada.params[1]);
  comprobar('IRC: guarda la linea cruda', parseada.crudo === lineaPrueba);
  const mensaje = mensajeDe(parseada);
  comprobar('IRC: nombre visible correcto', mensaje && mensaje.usuario === 'LunaTrance', mensaje && mensaje.usuario);
  comprobar('IRC: detecta los bits', mensaje && mensaje.bits === 250, mensaje && String(mensaje.bits));
  comprobar('IRC: detecta primera vez y suscriptor', mensaje && mensaje.primeraVez === true && mensaje.esSub === true);
  comprobar('IRC: entiende PING', parsearLinea('PING :tmi.twitch.tv').comando === 'PING');
  const limpieza = parsearLinea('@ban-duration=600;target-user-id=99 :tmi.twitch.tv CLEARCHAT #jonasrdb :troll');
  comprobar('IRC: entiende CLEARCHAT con duración', limpieza.comando === 'CLEARCHAT', limpieza.comando);
  const quienFue = datosDeLimpieza(limpieza);
  comprobar('IRC: el sancionado es el usuario correcto (no undefined)', quienFue.usuario === 'troll', String(quienFue.usuario));
  comprobar('IRC: lee la duración del timeout', quienFue.duración === '600', String(quienFue.duración));

  // los bits tienen que dar puntos de verdad
  const cheer = mensajeDe(parsearLinea('@bits=100;display-name=Ana :ana!ana@ana.tmi.twitch.tv PRIVMSG #jonasrdb :toma bits'));
  const puntosAntesBits = store.getPoints('Ana');
  await pipeline.procesarMensaje({ ...cheer, esMod: false, esBroadcaster: false });
  comprobar('Los bits dan puntos (1 por bit)', store.getPoints('Ana') === puntosAntesBits + 100, `${puntosAntesBits} -> ${store.getPoints('Ana')}`);
  comprobar('Los bits quedan registrados en las estadisticas', store.getStat('Ana', 'bits_dados') >= 100, String(store.getStat('Ana', 'bits_dados')));
  const megacheer = mensajeDe(parsearLinea('@bits=99999;display-name=Luis :luis!luis@luis PRIVMSG #jonasrdb :toma todo'));
  const antesMega = store.getPoints('Luis');
  await pipeline.procesarMensaje({ ...megacheer, esMod: false, esBroadcaster: false });
  comprobar('Un cheer enorme no rompe la economia (tope 500)', store.getPoints('Luis') === antesMega + 500, `${antesMega} -> ${store.getPoints('Luis')}`);
  const usuarioNotice = parsearLinea('@msg-id=raid;msg-param-viewerCount=8;display-name=OtroCanal :tmi.twitch.tv USERNOTICE #jonasrdb');
  comprobar('IRC: entiende USERNOTICE de raid', usuarioNotice.tags['msg-id'] === 'raid' && usuarioNotice.tags['msg-param-viewerCount'] === '8');
  let revientaParser = null;
  try {
    ['', 'PING', ':', '@', '@a=b', ':nick!n@h', 'NOTICE * :hola', '@a=b;c=d :x!x@x PRIVMSG #c :\u0000\n'].forEach((l) => parsearLinea(l));
  } catch (e) { revientaParser = e.message; }
  comprobar('IRC: lineas raras no rompen el parser', revientaParser === null, revientaParser);

  // ---- 11) cerebro con IA (con un proveedor simulado, sin gastar cuota) ----
  console.log(`\n${C.b}11) Cerebro IA (proveedor simulado)${C.x}`);
  const logMudo = { ok() {}, info() {}, warn() {}, error() {}, debug() {}, linea() {} };
  process.env.LLM_API_KEY = 'clave-de-prueba';
  const llamadas = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    const cuerpo = JSON.parse(opciones.body);
    llamadas.push({ url, modelo: cuerpo.model, mensajes: cuerpo.messages, temperatura: cuerpo.temperature });
    if (cuerpo.model === 'modelo-que-falla') {
      return { ok: false, status: 429, text: async () => 'rate limit reached' };
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '  "Hola Ana: que temazo!"  ' } }] }) };
  };

  const llmPrueba = crearLLM({
    cfg: {
      provider: 'prueba',
      baseUrl: 'https://ejemplo.test/v1',
      model: 'modelo-que-falla',
      models: ['modelo-bueno'],
      systemPrompt: 'Eres un bot de prueba.',
      promptAmbiente: 'Anima el chat.',
      maxPeticionesPorDia: 50,
    },
    logger: logMudo,
  });
  comprobar('IA: con clave se considera configurada', llmPrueba.configurado === true);
  const resp = await llmPrueba.responder({ contexto: [{ usuario: 'Ana', texto: 'que temazo', deBot: false }], mensaje: 'hola', usuario: 'Ana' });
  comprobar('IA: responde y limpia comillas y espacios', resp === 'Hola Ana: que temazo!', String(resp));
  comprobar('IA: si el primer modelo da 429, usa el de reserva', llamadas.some((l) => l.modelo === 'modelo-bueno'), llamadas.map((l) => l.modelo).join(' -> '));
  comprobar('IA: manda el system prompt primero', llamadas[0].mensajes[0].role === 'system', llamadas[0].mensajes[0].role);
  comprobar('IA: manda el historial de la conversacion', llamadas[1].mensajes.some((m) => String(m.content).includes('Ana: hola')), 'ok');

  const amb = await llmPrueba.ambiente({ contexto: [{ usuario: 'Ana', texto: 'que temazo', deBot: false }] });
  comprobar('IA: escribe el mensaje de ambiente', typeof amb === 'string' && amb.length > 0, String(amb));
  comprobar('IA: el ambiente usa su propio prompt', llamadas.some((l) => String(l.mensajes[0].content).includes('Anima el chat')), 'ok');
  comprobar('IA: el ambiente sube la temperatura (mas variedad)', llamadas.some((l) => l.temperatura > 1), 'ok');

  const llmCorto = crearLLM({ cfg: { provider: 'x', baseUrl: 'https://ejemplo.test/v1', model: 'modelo-bueno', maxPeticionesPorDia: 2 }, logger: logMudo });
  await llmCorto.responder({ contexto: [], mensaje: 'a', usuario: 'A' });
  await llmCorto.responder({ contexto: [], mensaje: 'b', usuario: 'B' });
  const gastadas = llmCorto.presupuesto.usadas;
  const sinPresupuesto = await llmCorto.responder({ contexto: [], mensaje: 'c', usuario: 'C' });
  comprobar('IA: respeta el tope de peticiones del dia', gastadas === 2 && sinPresupuesto === null, `usadas=${gastadas}, respuesta=${sinPresupuesto}`);
  globalThis.fetch = fetchOriginal;

  // ---- 12) el bot anima el chat y pide suscripciones ----
  console.log(`\n${C.b}12) Ambiente del chat y suscripciones${C.x}`);
  const cfgAmbiente = config.promos?.idleChatter || {};
  comprobar('El ambiente esta activado', cfgAmbiente.enabled === true);
  comprobar('Usa la IA para escribir el mensaje', cfgAmbiente.usarIA === true);
  comprobar('Tiene mensajes de reserva por si no hay IA', Array.isArray(cfgAmbiente.messages) && cfgAmbiente.messages.length >= 3, `${(cfgAmbiente.messages || []).length}`);
  comprobar('Solo habla tras un silencio largo', cfgAmbiente.minutosSinHablar >= 5, String(cfgAmbiente.minutosSinHablar));
  comprobar('No repite ambiente muy seguido', cfgAmbiente.minutosEntreMensajes >= 5, String(cfgAmbiente.minutosEntreMensajes));

  const cfgSubs = config.promos?.recordatorioSubs || {};
  comprobar('El recordatorio de suscripción esta activado', cfgSubs.enabled === true);
  comprobar('Pide suscripciones cada 30 min', cfgSubs.everyMinutes === 30, String(cfgSubs.everyMinutes));
  comprobar('Sin pasarse: maximo por directo', cfgSubs.maxPerStream <= 6, String(cfgSubs.maxPerStream));
  comprobar('Los mensajes de sub son validos', (cfgSubs.messages || []).every((m) => m.length > 10 && m.length < 480));

  // ambiente real: con el chat parado NO habla, y con el chat vivo pero en silencio SI
  const promosAmbiente = crearPromos({
    config,
    chat,
    runtime: { promosActivas: true },
    ultimaActividad: () => Date.now() - 60 * 1000,   // el chat lleva 1 minuto callado
    brain: { ambiente: async () => '¿Que tal la noche? Contadme algo 🎶' },
    log: logMudo,
  });
  chat.limpiar();
  const noHabla = await promosAmbiente.ambiente();
  comprobar('Con el chat reciente NO manda mensaje de ambiente', noHabla === null, String(noHabla));

  const promosParado = crearPromos({
    config,
    chat,
    runtime: { promosActivas: true },
    ultimaActividad: () => Date.now() - 30 * 60 * 1000,   // 30 minutos sin hablar
    brain: { ambiente: async () => '¿Que tal la noche? Contadme algo 🎶' },
    log: logMudo,
  });
  chat.limpiar();
  const siHabla = await promosParado.ambiente();
  comprobar('Con el chat parado SI anima la conversacion', siHabla === '¿Que tal la noche? Contadme algo 🎶', String(siHabla));
  comprobar('El mensaje de ambiente se envia al chat', chat.último() === siHabla, chat.último());
  const seguido = await promosParado.ambiente();
  comprobar('No repite dos mensajes de ambiente seguidos', seguido === null, String(seguido));

  chat.limpiar();
  promosAmbiente.recordatorioSubs();                      // este mock tiene el chat vivo
  comprobar('El recordatorio de sub pide suscribirse', /suscrib|suscrip|apoy|crecer/i.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  promosParado.recordatorioSubs();                        // este tiene el chat parado
  comprobar('Con el chat parado NO pide subs (no habla solo)', chat.dichos.length === 0, `${chat.dichos.length} mensaje(s)`);

  // solo anima el chat si estas emitiendo de verdad
  const promosOffline = crearPromos({
    config,
    chat,
    runtime: { promosActivas: true },
    ultimaActividad: () => Date.now() - 30 * 60 * 1000,
    brain: { ambiente: async () => 'esto no deberia salir' },
    estaEnDirecto: async () => false,
    log: logMudo,
  });
  chat.limpiar();
  const enOff = await promosOffline.ambiente();
  comprobar('Sin estar en directo NO anima el chat (no gasta cuota)', enOff === null, String(enOff));

  const promosOnline = crearPromos({
    config,
    chat,
    runtime: { promosActivas: true },
    ultimaActividad: () => Date.now() - 30 * 60 * 1000,
    brain: { ambiente: async () => 'esto si sale' },
    estaEnDirecto: async () => true,
    log: logMudo,
  });
  chat.limpiar();
  const enOn = await promosOnline.ambiente();
  comprobar('En directo SI anima el chat', enOn === 'esto si sale', String(enOn));

  const promosDuda = crearPromos({
    config,
    chat,
    runtime: { promosActivas: true },
    ultimaActividad: () => Date.now() - 30 * 60 * 1000,
    brain: { ambiente: async () => 'sigo si no lo se' },
    estaEnDirecto: async () => { throw new Error('Twitch no responde'); },
    log: logMudo,
  });
  chat.limpiar();
  const enDuda = await promosDuda.ambiente();
  comprobar('Si no se puede saber, sigue adelante (no se bloquea)', enDuda === 'sigo si no lo se', String(enDuda));

  // ---- 13) recordatorio de juegos y comandos ----
  console.log(`\n${C.b}13) Recordatorio de juegos y comandos${C.x}`);
  const cfgJuegos = config.promos?.recordatorioJuegos || {};
  comprobar('El recordatorio de juegos esta activado', cfgJuegos.enabled === true);
  comprobar('Sale cada 18 minutos', cfgJuegos.everyMinutes === 18, String(cfgJuegos.everyMinutes));
  comprobar('Tiene mensajes suficientes', Array.isArray(cfgJuegos.messages) && cfgJuegos.messages.length >= 5, `${(cfgJuegos.messages || []).length}`);
  comprobar('Los mensajes son validos para el chat', (cfgJuegos.messages || []).every((m) => m.length > 10 && m.length < 480));
  chat.limpiar();
  promos.recordatorioJuegos();
  comprobar('Envia el mensaje de juegos', chat.dichos.length === 1, `${chat.dichos.length} mensaje(s)`);
  comprobar('Menciona juegos y comandos', /!(juegos|trivia|ahorcado|ruleta|tema|musicquiz|skin|acciones|subasta|bingo|festero|hype|color|sorteo|dados)/i.test(chat.último()), chat.último().slice(0, 70));

  // ---- 14) multichat YouTube + Kick (sin red) ----
  console.log(`\n${C.b}14) Multichat YouTube + Kick${C.x}`);
  const { normalizarYt } = await import('./multichat/youtube.js');
  const { normalizarKick, limpiarKick, extraerChatPusher, canalPusher, mensajeSuscripcion } = await import('./multichat/kick.js');
  const { crearPuente, formatearRelay } = await import('./multichat/puente.js');
  const { manejarMultichat } = await import('./multichat/comandos.js');
  const { fusionarAjustes, guardarYoutube } = await import('./canales.js');

  const ytItem = { id: 'yt1', snippet: { displayMessage: 'buen set!  ' }, authorDetails: { displayName: 'Luna' } };
  const ytN = normalizarYt(ytItem);
  comprobar('Normaliza mensaje de YouTube', ytN.red === 'youtube' && ytN.usuario === 'Luna' && ytN.texto === 'buen set!', JSON.stringify(ytN));
  comprobar('Limpia emotes de Kick', limpiarKick('[emote:123:Hola] mundo [emote:9:X]') === 'Hola mundo X');
  const kickN = normalizarKick({ id: 'k1', content: 'temazo!!', sender: { username: 'Koke' } });
  comprobar('Normaliza mensaje de Kick', kickN.red === 'kick' && kickN.usuario === 'Koke' && kickN.texto === 'temazo!!');
  const rawPusher = JSON.stringify({ event: 'App\\Events\\ChatMessageEvent', data: JSON.stringify({ id: 'k2', content: 'hola', sender: { username: 'Ana' } }), channel: 'chatrooms.1.v2' });
  const ext = extraerChatPusher(rawPusher);
  comprobar('Extrae chat de Pusher', ext && ext.usuario === 'Ana' && ext.texto === 'hola');
  comprobar('Basura de Pusher se ignora', extraerChatPusher('no-json{{{') === null && extraerChatPusher(JSON.stringify({ event: 'pusher:ping', data: '{}' })) === null);
  comprobar('Canal Pusher bien formado', canalPusher(123) === 'chatrooms.123.v2');
  comprobar('Suscripcion Pusher bien formada', (() => { try { const s = JSON.parse(mensajeSuscripcion(123)); return s.event === 'pusher:subscribe' && s.data.channel === 'chatrooms.123.v2'; } catch { return false; } })());
  comprobar('Formato de relay YT', formatearRelay('youtube', 'Luna', 'hola!') === '[YT] Luna: hola!');
  comprobar('Formato de relay Kick', formatearRelay('kick', 'Koke', 'temazo') === '[Kick] Koke: temazo');
  comprobar('Relay largo se corta', formatearRelay('youtube', 'Luna', 'x'.repeat(500)).length <= 401);

  const chatMc = chatFalso();
  const vistos = [];
  const puente = crearPuente({
    canal: 'prueba', tag: '#prueba',
    config: { multichat: { youtube: { enabled: false }, kick: { enabled: false } } },
    chat: chatMc,
    brain: { registrar: (m) => vistos.push(m) },
    youtube: null, guardarYoutube: async () => {},
  });
  const est0 = puente.estado();
  comprobar('Apagado sin configurar', est0.youtube.fase === 'apagado' && est0.kick.fase === 'apagado');
  puente.inyectar({ red: 'youtube', usuario: 'Luna', texto: 'hola desde YT', id: 'y1' });
  comprobar('Relay de YouTube llega a Twitch', chatMc.último() === '[YT] Luna: hola desde YT', chatMc.último().slice(0, 60));
  comprobar('Relay entra en contexto de la IA', vistos.length === 1 && vistos[0].texto === 'hola desde YT');
  comprobar('Ultimo de YouTube tracked', puente.estado().youtube.ultimo?.usuario === 'Luna');
  const rk = await puente.responder('kick', 'hola');
  comprobar('Responder a Kick dice la verdad', rk.ok === false && /solo lectura/i.test(rk.motivo), rk.motivo);
  const rNo = await puente.responder('youtube', '   ');
  comprobar('Respuesta vacia se rechaza', rNo.ok === false);
  const rSinAuth = await puente.responder('youtube', 'hola');
  comprobar('Sin autorizar no envia', rSinAuth.ok === false, rSinAuth.motivo);
  comprobar('fijarVideoYT guarda y limpia', puente.fijarVideoYT('abc123') === 'abc123' && puente.fijarVideoYT('') === '');
  puente.detener();
  comprobar('Detener no revienta', true);

  const fusion = fusionarAjustes(
    { multichat: { youtube: { refreshToken: 'SECRETO', enabled: false } } },
    { multichat: { youtube: { enabled: true } } }
  );
  comprobar('El panel no pisa tokens', fusion.multichat.youtube.refreshToken === 'SECRETO' && fusion.multichat.youtube.enabled === true);
  const fusionMal = fusionarAjustes(
    { multichat: { youtube: { refreshToken: 'SECRETO' } } },
    { multichat: { youtube: { refreshToken: 'HACK', enabled: true } } }
  );
  comprobar('Tokens maliciosos del panel se ignoran', fusionMal.multichat.youtube.refreshToken === 'SECRETO');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test-'));
  const g1 = guardarYoutube(tmpDir, 'Prueba', { refreshToken: 'R1' });
  comprobar('guardaYoutube crea entrada', g1.refreshToken === 'R1');
  const g2 = guardarYoutube(tmpDir, 'prueba', { videoId: 'vid1' });
  comprobar('guardaYoutube fusiona sin borrar', g2.refreshToken === 'R1' && g2.videoId === 'vid1');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  chat.limpiar();
  await mandar('!multichat');
  comprobar('!multichat informa (sin puente activo)', /no esta activo|Multichat/i.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!rk hola');
  comprobar('!rk es honesto', /solo lectura/i.test(chat.último()), chat.último().slice(0, 70));
  chat.limpiar();
  await mandar('!ryt hola');
  comprobar('!ryt sin puente avisa', /no esta activo/i.test(chat.último()), chat.último().slice(0, 70));
  const chatRt = chatFalso();
  const puentesFake = {
    estado: () => ({ youtube: { fase: 'directo', detalle: '', ultimo: { usuario: 'Luna' } }, kick: { fase: 'apagado', detalle: '' } }),
    responder: async () => ({ ok: true }),
    fijarVideoYT: () => '',
  };
  const baseMsg = { usuario: 'ana', usuarioMin: 'ana', texto: '', esMod: false, esBroadcaster: false };
  const { manejarMultichat: mm } = await import('./multichat/comandos.js');
  await mm('ryt', ['hola'], { mensaje: { ...baseMsg, texto: '!ryt hola' }, esMod: false, chat: chatRt, runtime: { puentes: puentesFake } });
  comprobar('!ryt sin mod avisa', /moderador|streamer/i.test(chatRt.último()), chatRt.último().slice(0, 70));
  chatRt.limpiar();
  await mm('ryt', ['hola'], { mensaje: { ...baseMsg, texto: '!ryt hola' }, esMod: true, chat: chatRt, runtime: { puentes: puentesFake } });
  await new Promise((r) => setTimeout(r, 50));
  comprobar('!ryt siendo mod envia', /Enviado a YouTube/i.test(chatRt.último()), chatRt.último().slice(0, 70));
  chatRt.limpiar();
  await mm('ryt', [], { mensaje: { ...baseMsg, texto: '!ryt' }, esMod: true, chat: chatRt, runtime: { puentes: puentesFake } });
  comprobar('!ryt sin texto muestra uso', /Uso: !ryt/i.test(chatRt.último()), chatRt.último().slice(0, 70));
  chat.limpiar();
  await mandar('!ytvideo', { mod: true });
  comprobar('!ytvideo sin puente avisa', /no esta activo/i.test(chat.último()), chat.último().slice(0, 70));
  // ---- limpieza ----
  try { fs.unlinkSync(archivoPrueba); } catch { /* da igual */ }

  // ---- resumen ----
  console.log(`\n${C.b}===== RESULTADO =====${C.x}`);
  console.log(`  Pruebas: ${pruebas}   ${C.v}Correctas: ${pruebas - fallos}${C.x}   ${fallos ? C.r : C.g}Fallos: ${fallos}${C.x}`);
  if (fallos === 0) console.log(`\n  ${C.v}Todo correcto. El bot esta listo para conectarse a Twitch.${C.x}\n`);
  else console.log(`\n  ${C.a}Revisa los fallos de arriba.${C.x}\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

principal().catch((e) => {
  console.error(`\n${C.r}El autotest se ha roto: ${e.stack || e.message}${C.x}\n`);
  process.exit(1);
});

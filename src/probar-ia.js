// Comprueba que el cerebro con IA esta bien configurado.
// Hace DOS peticiones de verdad al proveedor (una de conversacion y otra del
// mensaje de ambiente) y te dice exactamente que falla si algo va mal.
//
// Uso:  PROBAR-IA.cmd   (o  node --env-file-if-exists=.env src/probar-ia.js)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearLLM } from './brain/llm.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = '\x1b[32m';
const R = '\x1b[31m';
const A = '\x1b[33m';
const C = '\x1b[36m';
const X = '\x1b[0m';

function leerConfig() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'config.json'), 'utf8'));
}

const log = {
  ok: (m) => console.log(`  ${V}ok${X}    ${m}`),
  warn: (m) => console.log(`  ${A}aviso${X} ${m}`),
  error: (m) => console.log(`  ${R}error${X} ${m}`),
  info: (m) => console.log(`  ${C}info${X}  ${m}`),
  debug: () => {},
  linea: () => console.log('  ' + '-'.repeat(60)),
};

console.log('');
console.log('  ============================================================');
console.log('   COMPROBAR LA IA DEL BOT');
console.log('  ============================================================');
console.log('');

let config;
try {
  config = leerConfig();
} catch (e) {
  log.error(`No pude leer config.json: ${e.message}`);
  process.exit(1);
}

const cfgLLM = config.llm || {};
const clave = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const modo = config.conversation?.mode || 'local';

log.info(`Modo de conversacion : ${modo === 'llm' ? 'IA (LLM)' : 'local (plantillas)'}`);
log.info(`Proveedor            : ${cfgLLM.provider}`);
log.info(`Modelo               : ${cfgLLM.model}`);
if (Array.isArray(cfgLLM.models) && cfgLLM.models.length > 1) {
  log.info(`De reserva           : ${cfgLLM.models.slice(1).join(', ')}`);
}
log.info(`Clave                : ${clave ? `${clave.slice(0, 6)}...${clave.slice(-4)} (${clave.length} caracteres)` : 'NO HAY CLAVE'}`);
console.log('');

if (!clave) {
  console.log(`  ${A}Falta la clave en C:\\TwitchBot\\.env${X}`);
  console.log('');
  console.log('     Abre el archivo .env con el Bloc de notas y deja esta linea así:');
  console.log('');
  console.log(`        ${C}LLM_API_KEY=gsk_tu_clave_aqui${X}`);
  console.log('');
  console.log('     Sacas la clave gratis (no pide tarjeta) en:');
  console.log(`        ${C}https://console.groq.com/keys${X}`);
  console.log('');
  log.warn('Mientras no haya clave, el bot sigue funcionando con el cerebro local (plantillas).');
  console.log('');
  process.exit(1);
}

const llm = crearLLM({ cfg: cfgLLM, logger: log });

if (!llm.configurado) {
  log.error(`La IA no esta lista: ${llm.estado.motivo}`);
  process.exit(1);
}

log.linea();
log.info('Probando una conversacion de verdad...');
const t0 = Date.now();
const respuesta = await llm.responder({
  contexto: [{ usuario: 'LunaTrance', texto: 'que temazo estas poniendo', deBot: false }],
  mensaje: 'hola! tu que tal, de donde nos ves?',
  usuario: 'LunaTrance',
});
const ms = Date.now() - t0;

if (!respuesta) {
  log.error('La IA no ha respondido. Motivo: ' + (llm.estado.ultimoError || 'desconocido'));
  if (/401|403|invalid|unauthorized/i.test(llm.estado.ultimoError || '')) {
    console.log('');
    log.warn('Eso tiene pinta de clave mal copiada o revocada. Vuelve a crearla en console.groq.com/keys');
  }
  if (/404/i.test(llm.estado.ultimoError || '')) {
    console.log('');
    log.warn('Eso suele ser un modelo que ya no existe. Avisame y te pongo el que toque.');
  }
  if (/429/i.test(llm.estado.ultimoError || '')) {
    console.log('');
    log.warn('Has llegado al limite de peticiones. Espera un minuto, o revisa tu cuota en console.groq.com');
  }
  process.exit(1);
}

log.ok(`Respuesta en ${ms} ms usando "${llm.estado.modeloUsado}":`);
console.log('');
console.log(`     ${C}${respuesta}${X}`);
console.log('');

log.info('Probando el mensaje para animar el chat parado...');
const ambiente = await llm.ambiente({ contexto: [{ usuario: 'Pepe', texto: 'buenas', deBot: false }] });
if (ambiente) {
  log.ok('Mensaje de ambiente:');
  console.log('');
  console.log(`     ${C}${ambiente}${X}`);
} else {
  log.warn('No pude generar el mensaje de ambiente (usara la lista de config.json).');
}

console.log('');
log.linea();
const p = llm.presupuesto;
log.info(`Peticiones usadas hoy: ${p.usadas} de ${p.tope}   ·   errores: ${llm.estado.errores}`);
console.log('');
console.log(`  ${V}La IA funciona.${X} Reinicia el bot (ARRANCAR-BOT.cmd) para que la use.`);
console.log('');

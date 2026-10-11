// Registro de actividad por consola, con colores y niveles.
// Además guarda todo en logs/bot-AAAA-MM-DD.log (sin colores) para poder
// revisar después qué pasó en un directo.
// Uso: import { logger } from './logger.js'; logger.info('hola');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_LOGS = path.join(AQUI, '..', 'logs');

function archivoHoy() {
  const d = new Date();
  const f = (n) => String(n).padStart(2, '0');
  return `bot-${d.getFullYear()}-${f(d.getMonth() + 1)}-${f(d.getDate())}.log`;
}

function aArchivo(linea) {
  try {
    fs.mkdirSync(DIR_LOGS, { recursive: true });
    fs.appendFileSync(path.join(DIR_LOGS, archivoHoy()), `${String(linea).replace(/\x1b\[[0-9;]*m/g, '')}\n`);
  } catch { /* si no se puede escribir, la consola sigue funcionando */ }
}

const NIVELES = { debug: 10, info: 20, warn: 30, error: 40 };
const nivelActual = NIVELES[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? NIVELES.info;

const C = {
  reset: '\x1b[0m', gris: '\x1b[90m', cian: '\x1b[36m',
  verde: '\x1b[32m', amarillo: '\x1b[33m', rojo: '\x1b[31m', magenta: '\x1b[35m',
};

function hora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function escribir(nivel, color, etiqueta, args) {
  if (NIVELES[nivel] < nivelActual) return;
  const prefijo = `${C.gris}${hora()}${C.reset} ${color}${etiqueta.padEnd(5)}${C.reset}`;
  const salida = nivel === 'error' ? console.error : console.log;
  salida(prefijo, ...args);
  aArchivo(`${hora()} ${etiqueta.padEnd(5)} ${args.map((a) => { try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); } }).join(' ')}`);
}

export const logger = {
  debug: (...a) => escribir('debug', C.gris, 'debug', a),
  info: (...a) => escribir('info', C.cian, 'info', a),
  ok: (...a) => escribir('info', C.verde, 'ok', a),
  warn: (...a) => escribir('warn', C.amarillo, 'warn', a),
  error: (...a) => escribir('error', C.rojo, 'error', a),
  chat: (usuario, texto) => {
    if (NIVELES.debug < nivelActual) return;
    console.log(`${C.gris}${hora()}${C.reset} ${C.magenta}chat ${C.reset}${C.cian}${usuario}${C.reset}: ${texto}`);
  },
  bot: (texto) => {
    console.log(`${C.gris}${hora()}${C.reset} ${C.verde}bot  ${C.reset}${texto}`);
    aArchivo(`${hora()} bot   ${texto}`);
  },
  linea: () => {
    console.log(`${C.gris}${'─'.repeat(58)}${C.reset}`);
    aArchivo('─'.repeat(58));
  },
};

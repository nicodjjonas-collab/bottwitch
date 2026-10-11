// TEST DE JUGABILIDAD: juega partidas reales contra cada juego y comprueba:
//   1) que arranca y saluda
//   2) que responde a las jugadas
//   3) que NO sigue hablando después de terminar o cancelarse (temporizadores sueltos)
// Ejecuta:  node src/testjuegos.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { GameManager } from './games/index.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const C = { v: '\x1b[32m', r: '\x1b[31m', a: '\x1b[33m', g: '\x1b[90m', x: '\x1b[0m', b: '\x1b[36m', m: '\x1b[35m' };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function leerConfig() {
  const limpiar = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === 'object') {
      const s = {};
      for (const [k, v] of Object.entries(obj)) { if (!k.startsWith('_')) s[k] = limpiar(v); }
      return s;
    }
    return obj;
  };
  return limpiar(JSON.parse(fs.readFileSync(path.join(RAIZ, 'config.json'), 'utf8')));
}

const chat = {
  dichos: [],
  say(t) { if (t) this.dichos.push(String(t)); },
  async sayMany(arr) { for (const t of arr || []) if (t) this.dichos.push(String(t)); },
  sacar() { return this.dichos.splice(0); },
};

const config = leerConfig();
const archivoPrueba = path.join(RAIZ, 'src', 'data', 'testjuegos.json');
if (fs.existsSync(archivoPrueba)) fs.unlinkSync(archivoPrueba);
const store = new Store({ file: archivoPrueba, debounceMs: 10 });
const juegos = new GameManager({ cfg: config.games, configCompleto: config, store, chat, canal: 'prueba', esModInterno: () => false });

const resultados = [];
let problemas = 0;

function volcar(etiqueta = '') {
  for (const t of chat.sacar()) console.log(`  ${C.v}bot${C.x}: ${String(t).slice(0, 155)}${etiqueta}`);
}

async function jugar(id, guion, { args = [], pausa = 0, ticks = 1, esperarSilencio = 6500 } = {}) {
  console.log(`\n${C.b}${'='.repeat(64)}${C.x}`);
  console.log(`${C.b}  ${id.toUpperCase()}${args.length ? `  (argumentos: ${args.join(' ')})` : ''}${C.x}`);
  console.log(`${C.b}${'='.repeat(64)}${C.x}`);
  chat.sacar();
  juegos.ultimoUso.clear(); // sin enfriamiento entre pruebas

  const res = { id, respuestas: 0, arrancó: false, termino: false, rezagado: false };

  const inicio = juegos.arrancar(id, { usuario: 'tester', usuarioMin: 'tester' }, args);
  if (!inicio.ok) {
    console.log(`  ${C.r}NO ARRANCA: ${inicio.motivo}${C.x}`);
    problemas += 1;
    res.error = inicio.motivo;
    resultados.push(res);
    return res;
  }
  res.arrancó = true;
  await dormir(20);
  const saludo = chat.sacar();
  res.respuestas += saludo.length;
  for (const t of saludo) console.log(`  ${C.v}bot${C.x}: ${String(t).slice(0, 155)}`);

  for (const [usuario, texto] of guion) {
    console.log(`  ${C.m}${usuario}${C.x}: ${texto}`);
    juegos.manejarMensaje({ usuario, usuarioMin: usuario.toLowerCase(), texto });
    await dormir(20);
    const salida = chat.sacar();
    res.respuestas += salida.length;
    for (const t of salida) console.log(`  ${C.v}bot${C.x}: ${String(t).slice(0, 155)}`);
    if (pausa) await dormir(pausa);
    for (let i = 0; i < ticks; i++) { juegos.tick(); await dormir(15); }
    volcar();
  }

  // cerramos la partida si sigue viva
  const est = juegos.estado();
  if (est.activa) {
    juegos.cancelar('fin del test');
    await dormir(20);
    volcar();
    console.log(`  ${C.g}-> cancelada por el test${C.x}`);
  } else {
    res.termino = true;
    console.log(`  ${C.g}-> la partida termino sola${C.x}`);
  }

  // ---- lo importante: ¿sigue hablando después? ----
  if (esperarSilencio) {
    await dormir(esperarSilencio);
    for (let i = 0; i < 3; i++) { juegos.tick(); await dormir(30); }
    const rezagados = chat.sacar();
    if (rezagados.length) {
      res.rezagado = true;
      problemas += 1;
      console.log(`  ${C.r}¡SIGUE HABLANDO DESPUES DE TERMINAR!${C.x}`);
      for (const t of rezagados) console.log(`  ${C.r}bot (fantasma)${C.x}: ${String(t).slice(0, 140)}`);
    } else {
      console.log(`  ${C.v}OK: se ha callado correctamente${C.x}`);
    }
  }

  if (res.respuestas <= 1) {
    problemas += 1;
    console.log(`  ${C.a}Aviso: muy pocas respuestas (${res.respuestas}); puede que no reaccione a las jugadas.${C.x}`);
  }

  resultados.push(res);
  return res;
}

async function principal() {
  console.log(`\n${C.b}##### TEST DE JUGABILIDAD DEL BOT #####${C.x}`);
  await juegos.cargar();

  // 1) AHORCADO: pista + palabra inventada + todas las letras
  const abecedario = 'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => ['tester', l]);
  await jugar('ahorcado', [['tester', '!pista'], ['tester', 'pista'], ['tester', 'zzzz'], ...abecedario]);

  // 2) TRES EN RAYA: entra un rival y se juega
  await jugar('tresenraya', [
    ['rival', '!entrar'],
    ['tester', '1'], ['rival', '5'], ['tester', '2'], ['rival', '8'], ['tester', '3'],
    ['rival', '9'],
  ]);

  // 3) TRIVIA: las 4 opciones y el temporizador
  await jugar('trivia', [
    ['ana', 'a'], ['ana', 'b'], ['luis', 'c'], ['luis', 'd'],
  ], { args: ['2'], pausa: 150, ticks: 3 });

  // 4) ANAGRAMA
  await jugar('anagrama', [
    ['ana', '!pista'], ['ana', 'zzzz'], ['luis', 'trance'],
  ], { args: ['2'], pausa: 150, ticks: 3 });

  // 5) PIEDRA PAPEL TIJERA
  await jugar('ppt', [
    ['ana', 'piedra'], ['ana', 'papel'], ['ana', 'tijera'], ['ana', 'tijeras'],
    ['ana', 'piedra'], ['ana', 'papel'], ['ana', 'piedra'], ['ana', 'papel'],
  ]);

  // 6) DADOS (modo normal y modo dado de 20)
  await jugar('dados', [['ana', '!dados'], ['luis', '!dados']]);
  await jugar('dados', [['ana', '!dados'], ['luis', '!dados']], { args: ['20'] });

  // 7) ADIVINA EL NUMERO: comprobamos que da pistas de mas alto / mas bajo
  await jugar('adivina', [
    ['ana', '1'], ['luis', '50'], ['ana', '25'], ['luis', '12'], ['ana', '6'], ['luis', '3'],
  ], { args: ['50'] });

  // 8) SORTEO
  await jugar('sorteo', [
    ['ana', '!entro'], ['luis', '!entro'], ['pepe', '!entro'], ['ana', '!entro'],
  ], { args: ['3'], pausa: 1500, ticks: 2 });

  // 9) PLANTILLA (escribe el doble)
  await jugar('plantilla', [['ana', '999'], ['luis', '1'], ['ana', '2'], ['luis', '3']]);

  // ---- resumen ----
  console.log(`\n${C.b}${'='.repeat(64)}${C.x}`);
  console.log(`${C.b}  RESUMEN${C.x}`);
  console.log(`${C.b}${'='.repeat(64)}${C.x}`);
  console.log('  juego          arranca  responde  termina  se calla');
  for (const r of resultados) {
    const si = (v) => (v ? `${C.v}  SI    ${C.x}` : `${C.r}  NO    ${C.x}`);
    console.log(`  ${r.id.padEnd(14)} ${si(r.arrancó)} ${String(r.respuestas).padStart(3)} msj  ${si(r.termino)} ${si(!r.rezagado)}`);
  }
  console.log('');
  console.log(problemas === 0
    ? `  ${C.v}TODOS LOS JUEGOS CORRECTOS${C.x}\n`
    : `  ${C.a}${problemas} problema(s) detectado(s)${C.x}\n`);

  try { fs.unlinkSync(archivoPrueba); } catch { /* da igual */ }
  process.exit(problemas === 0 ? 0 : 1);
}

principal().catch((e) => {
  console.error(`\n${C.r}El test se ha roto: ${e.stack || e.message}${C.x}\n`);
  process.exit(1);
});

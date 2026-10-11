// =====================================================================
//  TEST DE JUGABILIDAD DE LOS JUEGOS NUEVOS
//  Juega una partida real contra cada uno y comprueba:
//    1) que arranca y saluda
//    2) que reacciona a las jugadas
//    3) que se calla cuando se cancela (que no se queden timers sueltos)
//
//  Uso:  node src/testjuegos2.js
// =====================================================================

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
  último() { return this.dichos[this.dichos.length - 1] || ''; },
};

const log = { ok() {}, info() {}, warn() {}, error() {}, debug() {}, linea() {} };
const config = leerConfig();
const archivoPrueba = path.join(RAIZ, 'src', 'data', 'testjuegos2.json');

// Cada juego: como arrancarlo y que jugadas probar
const PARTIDAS = [
  {
    id: 'tema',
    args: ['Cafe', 'del', 'Mar'],
    guion: [['ana', 'no lo se'], ['luis', 'cafe del mar']],
    pistas: [/adivina el tema/i, /adivinado/i],
    debeResponder: true,
  },
  {
    id: 'frase',
    args: ['perfecta', '|', 'La', 'noche', 'fue', '___'],
    guion: [['ana', 'bonita'], ['luis', 'perfecta']],
    pistas: [/completa la frase/i, /lo tiene/i],
    debeResponder: true,
  },
  {
    id: 'decada',
    args: ['90'],
    guion: [['ana', '90s'], ['luis', '80s'], ['mod', 'fin']],
    pistas: [/adivina la década/i, /era de los 90/i],
    debeResponder: true,
  },
  {
    id: 'anyo',
    args: ['1998'],
    guion: [['ana', '1995'], ['luis', '2000'], ['mod', 'fin']],
    pistas: [/adivina el a/i, /era \*\*1998\*\*/i],
    debeResponder: true,
  },
  {
    id: 'musicquiz',
    args: ['2'],
    espera: 3400,   // el juego pregunta a los 3 s
    guion: [['mod', 'saltar']],
    pistas: [/trivia musical/i, /pregunta saltada/i],
    debeResponder: true,
  },
  {
    id: 'ruleta',
    args: ['10'],
    guion: [['ana', 'girar']],
    pistas: [/ruleta/i, /apuesta/i],
    debeResponder: true,
  },
  {
    id: 'subasta',
    args: ['El', 'próximo', 'tema'],
    guion: [['ana', '50'], ['luis', '120'], ['mod', 'cerrar']],
    pistas: [/subasta/i, /puja|cerrada/i],
    debeResponder: true,
  },
  {
    id: 'bingo',
    args: [],
    guion: [['ana', 'carton'], ['luis', 'carton']],
    pistas: [/bingo/i, /carton/i],
    debeResponder: true,
  },
];

async function principal() {
  console.log(`\n${C.b}===== JUGABILIDAD DE LOS JUEGOS NUEVOS =====${C.x}\n`);
  try { fs.unlinkSync(archivoPrueba); } catch (e) { /* no existia */ }

  const store = new Store({ file: archivoPrueba, debounceMs: 10 });
  store.addPoints('ana', 500);
  store.addPoints('luis', 500);

  const juegos = new GameManager({
    cfg: config.games,
    configCompleto: config,
    store,
    chat,
    canal: 'prueba',
    log,
    esModInterno: (u) => String(u).toLowerCase() === 'mod',
  });
  const cargados = await juegos.cargar();
  console.log(`  Juegos cargados: ${cargados}\n`);

  let problemas = 0;
  const resumen = [];

  for (const p of PARTIDAS) {
    console.log(`${C.b}${'='.repeat(64)}${C.x}`);
    console.log(`${C.b}  ${p.id.toUpperCase()}${C.x}`);
    console.log(`${C.b}${'='.repeat(64)}${C.x}`);
    chat.sacar();

    const res = { id: p.id, arranca: false, responde: 0, seCalla: true, error: null };

    // 1) arrancar
    try {
      const inicio = juegos.arrancar(p.id, { usuario: 'tester', usuarioMin: 'tester' }, p.args || []);
      await dormir(p.espera || 40);   // algunos juegos saludan con retraso
      const saludo = chat.sacar();
      res.arranca = Boolean(inicio && inicio.ok);
      if (!res.arranca) console.log(`  ${C.r}NO arranco: ${inicio && inicio.motivo}${C.x}`);
      for (const t of saludo) console.log(`  ${C.v}bot${C.x}: ${String(t).slice(0, 150)}`);
    } catch (e) {
      res.error = e.message;
      problemas += 1;
      console.log(`  ${C.r}ERROR al arrancar: ${e.message}${C.x}`);
      resumen.push(res);
      continue;
    }

    // 2) jugadas
    let dijoAlgo = false;
    try {
      for (const [usuario, texto] of p.guion) {
        console.log(`  ${C.m}${usuario}${C.x}: ${texto}`);
        juegos.manejarMensaje({ usuario, usuarioMin: usuario.toLowerCase(), texto });
        await dormir(25);
        juegos.tick();
        await dormir(25);
        const salida = chat.sacar();
        res.responde += salida.length;
        if (salida.length) dijoAlgo = true;
        for (const t of salida) console.log(`  ${C.v}bot${C.x}: ${String(t).slice(0, 150)}`);
      }
    } catch (e) {
      res.error = e.message;
      console.log(`  ${C.r}ERROR jugando: ${e.message}${C.x}`);
    }

    // 3) cancelar y verificar que se calla
    try {
      juegos.cancelar('fin del test');
      await dormir(30);
      chat.sacar();
      for (let i = 0; i < 3; i++) { juegos.tick(); await dormir(20); }
      await dormir(300);
      const tardios = chat.sacar();
      res.seCalla = tardios.length === 0;
      if (tardios.length) {
        console.log(`  ${C.a}AVISO: sigue hablando después de cancelar:${C.x}`);
        tardios.forEach((t) => console.log(`     ${String(t).slice(0, 120)}`));
      }
    } catch (e) {
      res.error = e.message;
    }

    const okTodo = res.arranca && dijoAlgo && res.seCalla && !res.error;
    if (!okTodo) problemas += 1;
    console.log(`  -> ${okTodo ? C.v + 'OK' : C.r + 'REVISAR'}${C.x}  (arranca=${res.arranca ? 'SI' : 'NO'}, respuestas=${res.responde}, se calla=${res.seCalla ? 'SI' : 'NO'})`);
    resumen.push(res);
  }

  console.log(`\n${C.b}===== RESUMEN =====${C.x}`);
  console.log('  juego        arranca  responde  se calla');
  for (const r of resumen) {
    console.log(`  ${r.id.padEnd(12)} ${(r.arranca ? 'SI' : 'NO').padEnd(8)} ${String(r.responde).padEnd(9)} ${r.seCalla ? 'SI' : 'NO'}`);
  }
  console.log('');
  if (problemas === 0) console.log(`  ${C.v}TODOS LOS JUEGOS NUEVOS CORRECTOS${C.x}\n`);
  else console.log(`  ${C.a}${problemas} juego(s) con algo que revisar${C.x}\n`);

  try { fs.unlinkSync(archivoPrueba); } catch (e) { /* da igual */ }
  process.exit(problemas === 0 ? 0 : 1);
}

principal().catch((e) => {
  console.error(`\n${C.r}El test se ha roto: ${e.stack || e.message}${C.x}\n`);
  process.exit(1);
});

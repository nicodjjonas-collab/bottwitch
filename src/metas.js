// =====================================================================
//  METAS EN PANTALLA (follows y subs)
//  El streamer pone la meta con:   !meta follows 200
//  Suma cuando llega gente nueva:  !suma follows 3   /   !suma subs 1
//  El chat la ve con:              !meta
//
//  Escribe en C:\OBS-Media\datos:
//      meta-follows.txt   -> "🎯 META FOLLOWERS  128 / 200 (64%)" + barra
//      meta-subs.txt      -> "⭐ META SUBS  12 / 30 (40%)" + barra
//  En OBS: Fuente de texto -> "Leer de archivo" -> elige el .txt.
//  (Texto, no navegador: gasta muchisima menos CPU en tu i3.)
//
//  Los numeros se guardan en src/data/metas.json y sobreviven al reinicio.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

const CARPETA = 'C:\\OBS-Media\\datos';
const JSON_METAS = path.join('src', 'data', 'metas.json');

function asegurar() {
  try { fs.mkdirSync(CARPETA, { recursive: true }); } catch (e) { /* ya existe */ }
  try { fs.mkdirSync(path.dirname(JSON_METAS), { recursive: true }); } catch (e) { /* ya existe */ }
}

function cargar() {
  asegurar();
  try {
    const m = JSON.parse(fs.readFileSync(JSON_METAS, 'utf8'));
    return {
      follows: { actual: m?.follows?.actual ?? 0, objetivo: m?.follows?.objetivo ?? 200 },
      subs: { actual: m?.subs?.actual ?? 0, objetivo: m?.subs?.objetivo ?? 30 },
    };
  } catch (e) {
    return { follows: { actual: 0, objetivo: 200 }, subs: { actual: 0, objetivo: 30 } };
  }
}

function guardar(m) {
  asegurar();
  try { fs.writeFileSync(JSON_METAS, JSON.stringify(m, null, 2), 'utf8'); } catch (e) { /* da igual */ }
}

function barra(pct) {
  const llenos = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return '█'.repeat(llenos) + '░'.repeat(10 - llenos);
}

function pintar() {
  const m = cargar();
  asegurar();
  const pf = m.follows.objetivo > 0 ? Math.min(100, Math.round((m.follows.actual / m.follows.objetivo) * 100)) : 0;
  const ps = m.subs.objetivo > 0 ? Math.min(100, Math.round((m.subs.actual / m.subs.objetivo) * 100)) : 0;
  try {
    fs.writeFileSync(path.join(CARPETA, 'meta-follows.txt'), `🎯 META FOLLOWERS  ${m.follows.actual} / ${m.follows.objetivo} (${pf}%)\n${barra(pf)}`, 'utf8');
    fs.writeFileSync(path.join(CARPETA, 'meta-subs.txt'), `⭐ META SUBS  ${m.subs.actual} / ${m.subs.objetivo} (${ps}%)\n${barra(ps)}`, 'utf8');
  } catch (e) { /* da igual */ }
  return m;
}

function normalizarTipo(t) {
  t = String(t || '').toLowerCase();
  if (/^(follow|follows|follower|followers|seguidor|seguidores|followers?)$/.test(t)) return 'follows';
  if (/^(sub|subs|suscriptor|suscriptores|suscripcion|suscripciones)$/.test(t)) return 'subs';
  return null;
}

// ---------------------------------------------------------------------
//  Lo llama commands.js. Devuelve true si atendio el comando.
// ---------------------------------------------------------------------
export function manejarMetas(cmd, args, { mensaje, esMod, chat }) {
  const P = '!';
  const deQuien = mensaje?.usuario || 'alguien';

  if (cmd === 'meta') {
    const tipo = normalizarTipo(args[0]);
    const m = pintar();
    if (!args.length || !tipo) {
      chat.say(`🎯 Follows: ${m.follows.actual}/${m.follows.objetivo} · ⭐ Subs: ${m.subs.actual}/${m.subs.objetivo} — ¡ayudad a llegar! 💜`);
      return true;
    }
    // !meta follows 200 -> fija objetivo (solo streamer/mods)
    const nuevo = Number(args[1]);
    if (args[1] === undefined) {
      const t = m[tipo];
      const pct = t.objetivo > 0 ? Math.min(100, Math.round((t.actual / t.objetivo) * 100)) : 0;
      chat.say(`${tipo === 'follows' ? '🎯 Follows' : '⭐ Subs'}: ${t.actual}/${t.objetivo} (${pct}%) ${barra(pct)}`);
      return true;
    }
    if (!esMod) { chat.say(`@${deQuien} la meta la pone el streamer 😉`); return true; }
    if (!isFinite(nuevo) || nuevo <= 0 || nuevo > 1000000) { chat.say(`Uso: ${P}meta ${tipo} <numero>  (ej: ${P}meta follows 200)`); return true; }
    m[tipo].objetivo = Math.floor(nuevo);
    guardar(m); pintar();
    chat.say(`Meta actualizada: ${tipo === 'follows' ? '🎯 Follows' : '⭐ Subs'} ${m[tipo].actual}/${m[tipo].objetivo} ¡a por ella! 🔥`);
    return true;
  }

  if (cmd === 'suma' || cmd === 'sumar' || cmd === 'add') {
    if (!esMod) { chat.say(`@${deQuien} eso lo lleva el streamer o un moderador 😉`); return true; }
    const tipo = normalizarTipo(args[0]);
    const n = args[1] === undefined ? 1 : Number(args[1]);
    if (!tipo) { chat.say(`Uso: ${P}suma follows|subs [numero]  (ej: ${P}suma follows 3)`); return true; }
    if (!isFinite(n)) { chat.say(`Uso: ${P}suma ${tipo} [numero]`); return true; }
    const m = cargar();
    m[tipo].actual = Math.max(0, m[tipo].actual + Math.floor(n));
    guardar(m); pintar();
    const t = m[tipo];
    const pct = t.objetivo > 0 ? Math.min(100, Math.round((t.actual / t.objetivo) * 100)) : 0;
    if (t.actual >= t.objetivo && t.objetivo > 0) {
      chat.say(`🎉 ¡META CONSEGUIDA! ${tipo === 'follows' ? '🎯 Follows' : '⭐ Subs'}: ${t.actual}/${t.objetivo} ¡GRACIAS A TODOS! 🎉`);
    } else {
      chat.say(`${tipo === 'follows' ? '🎯' : '⭐'} ${t.actual}/${t.objetivo} (${pct}%) ${barra(pct)} ¡falta poco! 💜`);
    }
    return true;
  }

  return false;
}

export function pintarMetas() { return pintar(); }

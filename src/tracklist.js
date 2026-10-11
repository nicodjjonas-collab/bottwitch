// =====================================================================
//  TRACKLIST AUTOMATICO PARA YOUTUBE  (+ "AHORA SUENA" en pantalla)
//
//  El streamer (o un mod) anota cada tema con:
//      !track Artista - Titulo
//
//  Y el bot escribe DOS archivos:
//      C:\OBS-Media\datos\tracklist.txt  -> la lista con los minutos, para
//                                          pegar en la descripcion de YouTube
//      C:\OBS-Media\datos\track_actual.txt -> solo el tema que suena ahora,
//                                          para una Fuente de texto en OBS
//
//  Comandos:
//      !track <Artista - Titulo>   anota el tema
//      !track                      recuerda cual suena ahora
//      !track nuevo                empieza una lista nueva (al abrir el directo)
//      !tracklist                  cuantos temas llevas y los ultimos 3
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

const CARPETA = 'C:\\OBS-Media\\datos';
const LISTA = path.join(CARPETA, 'tracklist.txt');
const ACTUAL = path.join(CARPETA, 'track_actual.txt');

// Minutos y segundos desde que arranco el bot = lo que llevas de directo
const INICIO = Date.now();

function marca() {
  const s = Math.max(0, Math.floor((Date.now() - INICIO) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

function asegurar() {
  try { fs.mkdirSync(CARPETA, { recursive: true }); } catch (e) { /* ya existe */ }
}

function leerLista() {
  try { return fs.readFileSync(LISTA, 'utf8'); } catch (e) { return ''; }
}

// Anota un tema en la lista y actualiza el "ahora suena"
export function anotarTema(texto) {
  asegurar();
  const linea = `${marca()}  ${texto}`;
  try {
    let contenido = leerLista();
    if (!contenido.trim()) {
      contenido = `TRACKLIST - sesion del ${new Date().toLocaleDateString('es-ES')}\n\n`;
    }
    fs.writeFileSync(LISTA, contenido + linea + '\n', 'utf8');
    fs.writeFileSync(ACTUAL, `🎵 AHORA SUENA\n${texto}`, 'utf8');
    return linea;
  } catch (e) {
    return null;
  }
}

export function temaActual() {
  try {
    const t = fs.readFileSync(ACTUAL, 'utf8');
    const partes = t.split('\n');
    return partes.length > 1 ? partes.slice(1).join(' ').trim() : null;
  } catch (e) {
    return null;
  }
}

export function limpiarLista() {
  asegurar();
  try {
    fs.writeFileSync(LISTA, `TRACKLIST - sesion del ${new Date().toLocaleDateString('es-ES')}\n\n`, 'utf8');
    fs.writeFileSync(ACTUAL, '🎵 AHORA SUENA\n(esperando el primer tema)', 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

export function cuantosTemas() {
  const contenido = leerLista();
  if (!contenido) return 0;
  return contenido.split('\n').filter((l) => /^\d\d:\d\d:\d\d\s/.test(l)).length;
}

export function ultimosTemas(n = 3) {
  const contenido = leerLista();
  if (!contenido) return [];
  return contenido.split('\n').filter((l) => /^\d\d:\d\d:\d\d\s/.test(l)).slice(-n);
}

// ---------------------------------------------------------------------
//  Este es el que llama commands.js
// ---------------------------------------------------------------------
export function manejarTrack(cmd, args, { mensaje, esMod, chat, canal }) {
  const P = '!';
  const deQuien = mensaje?.usuario || 'alguien';

  if (cmd === 'tracklist') {
    const n = cuantosTemas();
    if (!n) {
      chat.say(`📝 Todavia no hay ningun tema anotado. El streamer los apunta con ${P}track <Artista - Titulo>`);
      return true;
    }
    chat.say(`📝 Llevamos ${n} tema(s) apuntados. Los ultimos: ${ultimosTemas(3).join(' · ')}`);
    return true;
  }

  // A partir de aqui, solo el streamer o un moderador
  if (!esMod) {
    chat.say(`@${deQuien} la lista de temas la lleva el streamer 😉`);
    return true;
  }

  const texto = (args || []).join(' ').trim();

  if (/^(nuevo|nueva|reset|limpiar|empezar)$/i.test(texto)) {
    limpiarLista();
    chat.say('📝 Lista de temas nueva. ¡Que empiece el set! 🎧');
    return true;
  }

  if (!texto) {
    const actual = temaActual();
    chat.say(actual ? `🎵 Ahora suena: ${actual}` : `Todavia no hay tema anotado. Usa ${P}track Artista - Titulo`);
    return true;
  }

  const linea = anotarTema(texto);
  if (linea) {
    chat.say(`🎵 Anotado (${cuantosTemas()}): ${texto}`);
  } else {
    chat.say('No he podido escribir la lista de temas en el disco.');
  }
  return true;
}

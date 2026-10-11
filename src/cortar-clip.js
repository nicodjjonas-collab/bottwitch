// =====================================================================
//  CORTADOR DE CLIPS VERTICALES (TikTok / Shorts / Reels)
//  Uso:
//    node src/cortar-clip.js <video> <inicio> [segundos] [texto]
//    CORTAR-CLIP.cmd <video> <inicio> [segundos] [texto]
//
//  Ejemplos:
//    node src/cortar-clip.js set.mp4 01:23:45 45
//    node src/cortar-clip.js set.mp4 01:23:45 45 "el drop brutal"
//    node src/cortar-clip.js set.mp4 83:45 60
//
//  <inicio> admite HH:MM:SS, MM:SS o segundos.
//  Saca un MP4 vertical 1080x1920: el video centrado y recortado,
//  fondo desenfocado del propio video + tu marca arriba y abajo.
//  Necesita ffmpeg en el PATH (ya lo tienes instalado).
// =====================================================================

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MARCA_ARRIBA = 'JONASRDB · TRANCE';
const MARCA_ABAJO = 'twitch.tv/jonasrdb';

function aSegundos(t) {
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const p = String(t).split(':').map(Number);
  if (p.some((n) => !isFinite(n))) return NaN;
  let s = 0;
  for (const n of p) s = s * 60 + n;
  return s;
}

function hhmmss(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function escaparDrawtext(t) {
  return String(t).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

const FUENTES = [
  'C\\:/Windows/Fonts/arialbd.ttf',
  'C\\:/Windows/Fonts/arial.ttf',
];

function hayFuente() {
  for (const f of FUENTES) {
    try {
      const real = f.replace(/^C\\:\//, 'C:/').replace(/\\/g, '/');
      fs.accessSync(real, fs.constants.R_OK);
      return f;
    } catch (e) { /* probar la siguiente */ }
  }
  return null;
}

function main() {
  const [video, inicioArg, segsArg, ...resto] = process.argv.slice(2);
  if (!video || !inicioArg) {
    console.log('Uso: node src/cortar-clip.js <video> <inicio> [segundos] [texto]');
    console.log('     <inicio> = HH:MM:SS, MM:SS o segundos. Ejemplo: 01:23:45');
    console.log('     [segundos] = duracion del clip (por defecto 45, maximo 60 para Shorts)');
    console.log('');
    console.log('Truco: durante el directo marca momentos con !clip <texto> en el chat,');
    console.log('y al terminar usa esas marcas de C:\\OBS-Media\\datos\\clips-marcas.txt');
    process.exit(1);
  }
  if (!fs.existsSync(video)) {
    console.error(`No encuentro el video: ${video}`);
    process.exit(1);
  }
  const inicio = aSegundos(inicioArg);
  const duracion = Math.min(60, Math.max(5, segsArg ? Number(segsArg) : 45));
  if (!isFinite(inicio) || inicio < 0) { console.error(`Inicio no valido: ${inicioArg}`); process.exit(1); }
  if (!isFinite(duracion)) { console.error(`Duracion no valida: ${segsArg}`); process.exit(1); }

  const texto = resto.join(' ').trim().slice(0, 60);
  const base = path.basename(video, path.extname(video));
  const salida = `clip-vertical-${base}-${inicioArg.replace(/:/g, '-')}-${duracion}s.mp4`;

  // Fondo: el mismo video estirado a 1080x1920 y desenfocado.
  // Centro: el video recortado a 9:16 (crop=ih*9/16) y escalado a 1080x1350.
  // Marcas: arriba el nombre, abajo el canal (+ texto del momento si lo diste).
  const fuente = hayFuente();
  // OJO: en Windows el fontfile con unidad (C:) tiene que ir ENTRE COMILLAS
  // simples dentro del filtro: fontfile='C\:/Windows/...'. Sin comillas,
  // ffmpeg parte el valor en el ":" y falla con "No option name near...".
  const ff = fuente ? `'${fuente}'` : null;
  const filtros = [
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40[fondo]',
    '[0:v]crop=ih*9/16:ih,scale=1080:1350[centro]',
    '[fondo][centro]overlay=(W-w)/2:(H-h)/2:shortest=1[base]',
  ];
  let video_map = '[base]';
  if (ff) {
    filtros.push(
      `[base]drawtext=fontfile=${ff}:text='${escaparDrawtext(MARCA_ARRIBA)}':fontsize=44:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=80[conmarca]`,
      `[conmarca]drawtext=fontfile=${ff}:text='${escaparDrawtext(texto || MARCA_ABAJO)}':fontsize=${texto ? 52 : 44}:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=h-220[contodo]`,
      `[contodo]drawtext=fontfile=${ff}:text='${escaparDrawtext('twitch.tv/jonasrdb')}':fontsize=40:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=h-140[v]`
    );
    video_map = '[v]';
  }

  const args = [
    '-ss', String(inicio),
    '-i', video,
    '-t', String(duracion),
    '-filter_complex', filtros.join(';'),
    '-map', video_map,
    '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-y', salida,
  ];
  console.log(`Cortando ${duracion}s desde ${hhmmss(inicio)} de ${video}...`);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.error) {
    console.error('No pude arrancar ffmpeg. ¿Sigue instalado? (winget install Gyan.FFmpeg)');
    process.exit(1);
  }
  if (r.status !== 0) { console.error('ffmpeg dio error.'); process.exit(r.status); }
  const tam = (fs.statSync(salida).size / 1048576).toFixed(1);
  console.log(`Listo: ${salida} (${tam} MB, vertical 1080x1920 con tu marca). A Shorts/TikTok/IG 🎬`);
}

main();

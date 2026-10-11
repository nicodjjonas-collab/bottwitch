// =====================================================================
//  DIRECTO: marcas de clips + horario
//
//  !clip <texto>   -> guarda la marca con los minutos del directo en
//                     C:\OBS-Media\datos\clips-marcas.txt para cortarla
//                     despues con CORTAR-CLIP.cmd (vertical 1080x1920).
//                     Lo puede usar todo el mundo: el chat marca los
//                     momentazos y el streamer los convierte en Shorts.
//  !horario        -> dice los dias y la hora de los directos.
//  (los dias/hora se cambian en config.json -> "horario")
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

const CARPETA = 'C:\\OBS-Media\\datos';
const MARCAS = path.join(CARPETA, 'clips-marcas.txt');

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

export function manejarDirecto(cmd, args, { mensaje, chat, config }) {
  const P = config?.prefix || '!';

  if (cmd === 'clip' || cmd === 'clips' || cmd === 'momentazo') {
    const texto = (args || []).join(' ').trim().slice(0, 80) || 'momento del directo';
    asegurar();
    try {
      let contenido = '';
      try { contenido = fs.readFileSync(MARCAS, 'utf8'); } catch (e) { /* nuevo */ }
      if (!contenido.trim()) {
        contenido = `MARCAS DE CLIPS - sesion del ${new Date().toLocaleDateString('es-ES')}\n# Cortalos con:  CORTAR-CLIP.cmd <video-del-directo> <marca> [segundos] [texto]\n\n`;
      }
      fs.writeFileSync(MARCAS, `${contenido}${marca()}  @${mensaje?.usuario || '?'}  ${texto}\n`, 'utf8');
    } catch (e) {
      chat.say('No he podido apuntar la marca en el disco.');
      return true;
    }
    chat.say(`✂️ Marca apuntada (${marca()}): ${texto} — la convierto en Short después 🎬`);
    return true;
  }

  if (cmd === 'horario' || cmd === 'horarios' || cmd === 'cuando') {
    const h = config?.horario || {};
    const dias = Array.isArray(h.dias) ? h.dias.join(' y ') : (h.dias || 'viernes y sábado');
    const hora = h.hora || '22:00';
    const extra = h.texto ? ` ${h.texto}` : '';
    chat.say(`🗓️ Directos: ${dias} a las ${hora} (hora española).${extra} ¡Activa la campanita 🔔!`);
    return true;
  }

  return false;
}

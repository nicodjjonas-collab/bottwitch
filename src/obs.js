// =====================================================================
//  DATOS EN VIVO PARA OBS
//
//  El bot escribe archivos de texto y OBS los lee y actualiza solo.
//  Ventaja grande: una fuente de TEXTO en OBS gasta muchisima menos CPU
//  que una fuente de navegador. En un i3 eso se nota.
//
//  Archivos que genera (en C:\OBS-Media\datos):
//     ranking.txt   -> el top 5 de puntos
//     juego.txt     -> que juego hay en marcha y como se juega
//     directo.txt   -> cuanto llevas en directo
//     último.txt    -> el último ganador (si se sabe)
//
//  En OBS: Fuente de texto -> marca "Leer de archivo" -> elige el .txt
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

export function crearDatosOBS({ store, juegos, config, canal, carpeta, log }) {
  const destino = carpeta || 'C:\\OBS-Media\\datos';
  const inicio = Date.now();
  let temporizador = null;
  let ultimoGanador = '';

  try {
    fs.mkdirSync(destino, { recursive: true });
  } catch (e) {
    if (log) log.warn(`No pude crear la carpeta de datos para OBS (${destino}): ${e.message}`);
  }

  function escribir(nombre, texto) {
    try {
      fs.writeFileSync(path.join(destino, nombre), String(texto || ''), 'utf8');
      return true;
    } catch (e) {
      if (log) log.warn(`No pude escribir ${nombre}: ${e.message}`);
      return false;
    }
  }

  // "1h 24m" o "37m"
  function duración(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  // El almacen puede devolver los usuarios con distintos nombres de campo:
  // lo miramos con cuidado para no depender de uno concreto.
  function nombreDe(u) {
    return u?.nombre || u?.usuario || u?.name || u?.user || u?.[0] || '?';
  }
  function puntosDe(u) {
    return u?.puntos ?? u?.points ?? u?.valor ?? u?.[1] ?? 0;
  }

  function actualizar() {
    try {
      // ---- ranking ----
      let top = [];
      try { top = store.top(5) || []; } catch (e) { top = []; }
      const lineas = top.slice(0, 5).map((u, i) => {
        const medalla = ['🥇', '🥈', '🥉', '4.', '5.'][i] || `${i + 1}.`;
        return `${medalla}  ${nombreDe(u)}   ${puntosDe(u)} pts`;
      });
      escribir('ranking.txt', lineas.length
        ? lineas.join('\n')
        : 'Aun no hay puntos.\n¡Juega con !trivia o !musicquiz!');

      // ---- juego en curso ----
      let est = null;
      try { est = juegos.estado(); } catch (e) { est = null; }
      if (est && est.activa) {
        const nombre = est.juego?.name || est.juego?.id || 'juego';
        const comando = est.juego?.id ? `!${est.juego.id}` : '!juegos';
        escribir('juego.txt', `🎮 EN MARCHA: ${nombre}\nPara jugar: ${comando}`);
      } else {
        escribir('juego.txt', '🎮 No hay juego en marcha\nEscribe !juegos para verlos todos');
      }

      // ---- tiempo en directo ----
      escribir('directo.txt', `🔴 En directo: ${duración(Date.now() - inicio)}`);

      // ---- último ganador (lo rellena el bot si lo detecta) ----
      if (ultimoGanador) escribir('último.txt', `🏆 Último ganador: ${ultimoGanador}`);
    } catch (e) {
      if (log) log.warn(`Error actualizando los datos de OBS: ${e.message}`);
    }
  }

  return {
    carpeta: destino,
    actualizar,
    // Lo puede llamar cualquier parte del bot para anunciar un ganador
    ganador(nombre) {
      if (!nombre) return;
      ultimoGanador = String(nombre);
      actualizar();
    },
    iniciar() {
      actualizar();
      temporizador = setInterval(actualizar, 20000);   // cada 20 segundos
      if (log) log.info(`Datos para OBS activos en ${destino} (se actualizan cada 20 s).`);
    },
    detener() {
      if (temporizador) clearInterval(temporizador);
      temporizador = null;
    },
  };
}

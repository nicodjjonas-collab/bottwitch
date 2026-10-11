// =====================================================================
//  PUENTE ENTRE PCs (el "buzón"): comunica el bot 24/7 con el otro PC
//  a través de una carpeta compartida de Windows.
//
//  Carpeta (variable de entorno PUENTE_CARPETA):
//    - En el PC 24/7:  PUENTE_CARPETA=C:\BotCompartido  (no hace falta)
//    - En el otro PC:   PUENTE_CARPETA=\\NICOLAS\BotCompartido
//  Sin esa variable, el puente queda apagado y no molesta.
//
//  Archivos:
//    estado.json   <- el bot escribe cada 20 s: canales, conexión, uptime
//    ordenes.json  <- el otro lado deja pedidos; el bot los ejecuta:
//                     {tipo:'decir', canal, texto}  -> habla en el chat
//                     {tipo:'ping'}                 -> responde pong
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';

const INICIO = Date.now();

function leerJson(archivo, defecto) {
  try {
    const t = fs.readFileSync(archivo, 'utf8');
    return JSON.parse(t);
  } catch { return defecto; }
}

function escribirJson(archivo, datos) {
  try {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    const tmp = `${archivo}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(datos, null, 2), 'utf8');
    fs.renameSync(tmp, archivo);
    return true;
  } catch { return false; }
}

export function crearPuente({ mundos, carpeta, log }) {
  if (!carpeta) return null;
  const ARCH_ESTADO = path.join(carpeta, 'estado.json');
  const ARCH_ORDENES = path.join(carpeta, 'ordenes.json');
  let temporizadores = [];

  function escribirEstado() {
    const estado = {
      actualizado: new Date().toISOString(),
      uptimeSeg: Math.floor((Date.now() - INICIO) / 1000),
      canales: (mundos || []).map((m) => ({
        canal: m.canal,
        plan: m.plan,
        conectado: Boolean(m.chat?.conectado),
      })),
    };
    escribirJson(ARCH_ESTADO, estado);
  }

  async function atenderOrdenes() {
    const doc = leerJson(ARCH_ORDENES, null);
    if (!doc || !Array.isArray(doc.pendientes) || !doc.pendientes.length) return;
    if (!Array.isArray(doc.historial)) doc.historial = [];
    for (const o of doc.pendientes) {
      const res = { id: o.id || null, tipo: o.tipo || '?', ok: false, detalle: '', cuando: new Date().toISOString() };
      try {
        if (o.tipo === 'decir') {
          const m = (mundos || []).find((x) => x.canal === String(o.canal || '').toLowerCase()) || mundos[0];
          if (!m) throw new Error('no hay canales');
          m.chat.say(String(o.texto || ''));
          res.ok = true; res.detalle = `dicho en #${m.canal}`;
        } else if (o.tipo === 'ping') {
          res.ok = true; res.detalle = 'pong';
        } else {
          res.detalle = `orden desconocida (prueba: decir, ping)`;
        }
      } catch (e) { res.detalle = e.message; }
      doc.historial.push(res);
      if (doc.historial.length > 50) doc.historial = doc.historial.slice(-50);
    }
    doc.pendientes = [];
    escribirJson(ARCH_ORDENES, doc);
    if (log) log.info(`Puente: ${doc.historial.length} orden(es) atendidas.`);
  }

  return {
    carpeta,
    iniciar() {
      escribirEstado();
      temporizadores.push(setInterval(escribirEstado, 20000));
      temporizadores.push(setInterval(() => { atenderOrdenes().catch(() => {}); }, 10000));
      if (log) log.ok(`Puente entre PCs activo en ${carpeta}`);
    },
    detener() {
      for (const t of temporizadores) { try { clearInterval(t); } catch {} }
      temporizadores = [];
    },
    escribirEstado,
    atenderOrdenes,
  };
}

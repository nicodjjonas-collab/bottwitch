// Envía un archivo por LocalSend a otro PC de la red (protocolo v2).
// Uso: node src/localsend-enviar.mjs <archivo> <ip>
// En el otro PC debe estar LocalSend abierto (y aceptar o tener guardado rápido).
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [archivo, ip] = process.argv.slice(2);
if (!archivo || !ip || !fs.existsSync(archivo)) {
  console.log('Uso: node src/localsend-enviar.mjs <archivo> <ip>');
  process.exit(1);
}

function peticion(metodo, ruta, cuerpo, cabeceras = {}) {
  return new Promise((resolve, reject) => {
    const datos = cuerpo ? Buffer.from(cuerpo) : null;
    const req = https.request({
      host: ip, port: 53317, path: ruta, method: metodo,
      timeout: 15000, rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/json', ...(datos ? { 'Content-Length': datos.length } : {}), ...cabeceras },
    }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ codigo: res.statusCode, cuerpo: b }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    if (datos) req.write(datos);
    req.end();
  });
}

function subir(ruta, archivoLocal, cabeceras = {}) {
  return new Promise((resolve, reject) => {
    const tam = fs.statSync(archivoLocal).size;
    const req = https.request({
      host: ip, port: 53317, path: ruta, method: 'POST',
      timeout: 120000, rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': tam, ...cabeceras },
    }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ codigo: res.statusCode, cuerpo: b }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    fs.createReadStream(archivoLocal).pipe(req);
  });
}

const buf = fs.readFileSync(archivo);
const sha = crypto.createHash('sha256').update(buf).digest('hex');
const nombre = path.basename(archivo);
const idFichero = 'zip-' + Date.now().toString(36);
const huella = crypto.randomBytes(32).toString('hex').toUpperCase();

const cuerpo = JSON.stringify({
  info: { alias: 'TwitchBot-PC', version: '2.1', deviceModel: 'PC', deviceType: 'desktop', fingerprint: huella, download: false },
  files: { [idFichero]: { id: idFichero, fileName: nombre, size: buf.length, fileType: 'application/zip', sha256: sha } },
});

console.log(`Pidiendo envío a ${ip} (${nombre}, ${(buf.length / 1024).toFixed(0)} KB)...`);
let sesion = null;
for (let i = 0; i < 12; i++) {
  try {
    const r = await peticion('POST', '/api/localsend/v2/prepare-upload', cuerpo);
    if (r.codigo === 200 || r.codigo === 201) {
      const j = JSON.parse(r.cuerpo);
      sesion = { id: j.sessionId, token: j.files?.[idFichero] };
      if (sesion.id && sesion.token) break;
    } else {
      console.log(`  respuesta ${r.codigo}, reintento...`);
    }
  } catch (e) { console.log(`  ${e.message}, reintento...`); }
  if (!sesion?.id) await new Promise((r) => setTimeout(r, 5000));
}
if (!sesion?.id) {
  console.log('SIN RESPUESTA: abre LocalSend en el otro PC y vuelve a intentarlo.');
  process.exit(1);
}
console.log(`Sesión ${sesion.id}. Subiendo... (si pide aceptar, pulsa en el otro PC)`);
for (let i = 0; i < 12; i++) {
  try {
    const r = await subir(`/api/localsend/v2/upload?sessionId=${encodeURIComponent(sesion.id)}&fileId=${encodeURIComponent(idFichero)}&token=${encodeURIComponent(sesion.token)}`, archivo);
    if (r.codigo === 200 || r.codigo === 201 || r.codigo === 204) {
      console.log('ENVIADO. Revisa LocalSend en el otro PC.');
      process.exit(0);
    }
    console.log(`  subida: ${r.codigo}, reintento...`);
  } catch (e) { console.log(`  ${e.message}, reintento...`); }
  await new Promise((r) => setTimeout(r, 5000));
}
console.log('No se pudo completar: acepta en el otro PC y repite el comando.');
process.exit(1);

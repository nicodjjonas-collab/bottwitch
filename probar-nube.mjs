// Simula Render: RAIZ vacío (sin canales.json ni .env) + CANALES_JSON.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leerCanales, resolverFuente } from './src/canales.js';

const RAIZ = fs.mkdtempSync(path.join(os.tmpdir(), 'nube-'));
process.env.CANALES_JSON = JSON.stringify([
  { channel: 'jonasrdb', bot: 'sesionesoldschool', clientId: 'x', token: 'TOK', refreshToken: 'R', plan: 'full', propio: true },
  { channel: 'kokodeejay', plan: 'full' },
]);
const l = leerCanales(RAIZ);
console.log('koko hereda token:', l.find((x) => x.channel === 'kokodeejay').token === 'TOK' ? 'OK' : 'FALLO');
const c = resolverFuente(l, RAIZ);
console.log('fuente es propio:', c.token === 'TOK' && c.bot === 'sesionesoldschool' ? 'OK' : `FALLO (${c.origen})`);

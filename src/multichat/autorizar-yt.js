// Autoriza YouTube para UN canal: device flow de Google (como AUTORIZAR-BOT).
// Uso:  node src/multichat/autorizar-yt.js --canal=jonasrdb
// Necesitas: un proyecto en Google Cloud con "YouTube Data API v3" activada
// y un cliente OAuth tipo "App de escritorio". Te pide su Client ID.
//
// Guarda el refreshToken en la entrada del canal (canales.json -> youtube).
// El token de acceso se renueva solo; nunca se guarda en disco.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as entrada, stdout as salida } from 'node:process';
import { fileURLToPath } from 'node:url';
import { pedirCodigoDispositivo, esperarTokenDispositivo } from './youtube.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');

function leerArgs() {
  return Object.fromEntries(
    process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
      const [k, ...r] = a.slice(2).split('=');
      return [k, r.join('=')];
    })
  );
}

async function principal() {
  const args = leerArgs();
  const canal = String(args.canal || args.channel || '').toLowerCase().trim().replace(/^@/, '');
  if (!canal) {
    console.log('Uso:  node src/multichat/autorizar-yt.js --canal=jonasrdb');
    process.exit(1);
  }
  let clientId = String(process.env.YT_CLIENT_ID || '').trim();
  if (!clientId) {
    const rl = readline.createInterface({ input: entrada, output: salida });
    clientId = (await rl.question('Pega el Client ID de Google (OAuth escritorio): ')).trim();
    rl.close();
    if (!clientId) {
      console.log('Sin Client ID no puedo seguir. Mira LEEME-MULTICHAT.md paso 1.');
      process.exit(1);
    }
  }

  console.log('\nPidiendo codigo a Google...\n');
  const cod = await pedirCodigoDispositivo({ clientId });
  console.log('=====================================================');
  console.log('  1) Abre en el navegador:  https://www.google.com/device');
  console.log(`  2) Escribe este codigo:   ${cod.user_code}`);
  console.log('  3) Entra con la cuenta de YouTube DEL CANAL que emite');
  console.log('  (tienes unos minutos)');
  console.log('=====================================================\n');

  const tok = await esperarTokenDispositivo({
    clientId,
    deviceCode: cod.device_code,
    alAvisar: () => process.stdout.write('.'),
  });
  console.log('\n\nAutorizado en Google ✅');

  if (!tok.refresh_token) {
    console.log('OJO: Google no dio refresh_token (pasa si ya autorizaste antes esta app).');
    console.log('Ve a https://myaccount.google.com/permissions, quita el acceso, y repite.');
    process.exit(1);
  }

  const { guardarYoutube } = await import('../canales.js');
  guardarYoutube(RAIZ, canal, { refreshToken: tok.refresh_token });
  console.log(`Guardado para #${canal}. Activa youtube en su config y reinicia el bot.`);
  console.log('Comprueba con !multichat en su chat de Twitch.');
}

principal().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});

// Autorizacion con Twitch mediante el flujo de "codigo de dispositivo".
// No necesitas secreto de cliente ni montar ninguna web: solo entrar en
// twitch.tv/activate y teclear un codigo.
//
// Uso:   npm run auth
//
// Genera/actualiza el archivo .env con BOT_TOKEN, BOT_REFRESH_TOKEN y su caducidad.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as entrada, stdout as salida } from 'node:process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ARCHIVO_ENV = path.join(RAIZ, '.env');

const PERMISOS = [
  'chat:read',
  'chat:edit',
  'moderator:manage:chat_messages',
  'moderator:manage:banned_users',
];

function leerEnv() {
  if (!fs.existsSync(ARCHIVO_ENV)) return {};
  const datos = {};
  for (const linea of fs.readFileSync(ARCHIVO_ENV, 'utf8').split(/\r?\n/)) {
    if (!linea || linea.startsWith('#') || !linea.includes('=')) continue;
    const i = linea.indexOf('=');
    datos[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return datos;
}

function escribirEnv(actualizaciones) {
  let lineas = fs.existsSync(ARCHIVO_ENV)
    ? fs.readFileSync(ARCHIVO_ENV, 'utf8').split(/\r?\n/)
    : fs.readFileSync(path.join(RAIZ, '.env.example'), 'utf8').split(/\r?\n/);

  for (const [clave, valor] of Object.entries(actualizaciones)) {
    const i = lineas.findIndex((l) => l.startsWith(`${clave}=`));
    if (i >= 0) lineas[i] = `${clave}=${valor}`;
    else lineas.push(`${clave}=${valor}`);
  }
  fs.writeFileSync(ARCHIVO_ENV, lineas.join('\n'), 'utf8');
  console.log(`\n  Guardado en: ${ARCHIVO_ENV}`);
}

export async function pedirTokenDispositivo({ clientId, alAvisar } = {}) {
  const permisos = PERMISOS.join(' ');
  const url = `https://id.twitch.tv/oauth2/device?client_id=${encodeURIComponent(clientId)}&scopes=${encodeURIComponent(permisos)}`;

  const resp = await fetch(url, { method: 'POST' });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Twitch rechazo la peticion (${resp.status}). ${t.slice(0, 300)}`);
  }
  const datos = await resp.json();
  const { device_code, user_code, verification_uri, interval = 5, expires_in = 1800 } = datos;

  alAvisar?.({ user_code, verification_uri, expires_in });

  const limite = Date.now() + expires_in * 1000;
  let espera = Math.max(3, interval) * 1000;

  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, espera));
    const cuerpo = new URLSearchParams({
      client_id: clientId,
      scopes: permisos,
      device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    const r = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
    });
    const json = await r.json().catch(() => ({}));

    if (r.ok && json.access_token) return json;
    if (json.message === 'authorization_pending') continue;
    if (json.message === 'slow_down') { espera += 2000; continue; }
    if (json.message === 'expired_token') throw new Error('El codigo ha caducado. Vuelve a intentarlo.');
    if (json.message === 'access_denied') throw new Error('Has cancelado la autorizacion en Twitch.');
    throw new Error(`Error inesperado de Twitch: ${JSON.stringify(json).slice(0, 300)}`);
  }
  throw new Error('Se acabo el tiempo esperando la autorizacion.');
}

export async function refrescarToken({ clientId, refreshToken, clientSecret = '' }) {
  const cuerpo = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  // Las apps Confidencial exigen el secret para renovar; las Public no.
  if (clientSecret) cuerpo.set('client_secret', clientSecret);
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.access_token) {
    throw new Error(`No pude renovar el token: ${json.message || r.status}`);
  }
  return json;
}

export async function validarToken(token) {
  try {
    const r = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${String(token).replace(/^oauth:/, '')}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ----------------- ejecucion directa:  npm run auth -----------------
// Opciones:  npm run auth -- --canal=otro_canal --bot=cuenta_bot --plan=full
// Sin --canal, guarda en .env como siempre (tu canal).
// Nuevo:     npm run auth -- --alta=nuevocanal [--plan=full]
//   Da de alta un canal de cliente SIN pedirle nada: usa el bot único
//   compartido. El cliente solo tiene que ponerlo de moderador en su chat.
async function principal() {
  console.log('\n=====================================================');
  console.log('   AUTORIZAR EL BOT CON TWITCH');
  console.log('=====================================================\n');

  const args = Object.fromEntries(
    process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
      const [k, ...r] = a.slice(2).split('=');
      return [k, r.join('=')];
    })
  );
  const canalArg = String(args.canal || args.channel || '').toLowerCase().trim() || null;
  const botArg = String(args.bot || '').toLowerCase().trim() || null;
  const planArg = String(args.plan || 'full').toLowerCase().trim() || 'full';
  const altaArg = String(args.alta || '').toLowerCase().trim().replace(/^@/, '') || null;

  if (altaArg) {
    // Alta rápida de cliente: sin códigos, sin cuentas, sin autorizar.
    const { altaCanal, credencialesCompartidas } = await import('./canales.js');
    const reg = altaCanal(RAIZ, { channel: altaArg, plan: planArg });
    const comp = credencialesCompartidas(RAIZ);
    const nombreBot = comp.bot || '(bot aún sin autorizar: ejecuta npm run auth)';
    console.log(`\n  Canal #${reg.channel} dado de alta (plan ${reg.plan}).`);
    console.log('  El cliente NO tiene que autorizar nada. Solo esto en su chat:');
    console.log(`    /mod ${nombreBot}`);
    console.log('  Luego comprueba con !ayuda en su chat. Reinicia el bot para que entre.\n');
    return;
  }

  const env = leerEnv();
  const rl = readline.createInterface({ input: entrada, output: salida });

  let clientId = process.env.BOT_CLIENT_ID || env.BOT_CLIENT_ID || '';
  if (!clientId) {
    console.log('Necesitas el "Client ID" de una aplicacion de Twitch (es gratis y tarda 1 minuto).');
    console.log('  1) Entra en  https://dev.twitch.tv/console/apps');
    console.log('  2) Pulsa "Register Your Application"');
    console.log('  3) Nombre: el que quieras.  OAuth Redirect URL:  http://localhost');
    console.log('     Categoria: Chat Bot      Tipo de cliente: Publico (Confidential = No)');
    console.log('  4) Copia el "Client ID" y pegalo aquí.\n');
    clientId = (await rl.question('  Client ID: ')).trim();
  }
  if (!clientId) { console.error('\n  Sin Client ID no puedo continuar.'); process.exit(1); }
  escribirEnv({ BOT_CLIENT_ID: clientId });

  console.log('\n  IMPORTANTE: cuando Twitch te pida iniciar sesión, entra con la cuenta');
  console.log('  que quieras usar como BOT (si usas tu cuenta principal, el bot hablara');
  console.log('  como tu).\n');

  const datos = await pedirTokenDispositivo({
    clientId,
    alAvisar: ({ user_code, verification_uri, expires_in }) => {
      console.log('-----------------------------------------------------');
      console.log('  1) Abre en el navegador:  ' + verification_uri);
      console.log('  2) Escribe este codigo:   ' + user_code);
      console.log(`  (tienes ${Math.round(expires_in / 60)} minutos)`);
      console.log('-----------------------------------------------------\n');
    },
  });

  const caduca = Date.now() + (datos.expires_in || 0) * 1000;
  const credenciales = {
    BOT_TOKEN: datos.access_token,
    BOT_REFRESH_TOKEN: datos.refresh_token || '',
    BOT_TOKEN_EXPIRES_AT: String(caduca),
  };

  const info = await validarToken(datos.access_token);
  const login = info?.login || null;

  if (canalArg) {
    // Modo multi-canal: guarda en config/canales.json.
    // Tu canal (el del .env) queda marcado como propio: gratis con todo.
    const { guardarCanal } = await import('./canales.js');
    const esPropio = canalArg === String(env.CHANNEL || '').toLowerCase().trim();
    guardarCanal(RAIZ, {
      channel: canalArg,
      bot: botArg || login || env.BOT_USERNAME || '',
      clientId,
      token: datos.access_token,
      refreshToken: datos.refresh_token || '',
      expiresAt: caduca,
      plan: planArg,
      propio: esPropio,
    });
    console.log(`\n  Canal #${canalArg} guardado en config/canales.json (plan ${planArg}).`);
    console.log('  Desde ahora el bot usa ese archivo; el .env queda como reserva.');
  } else {
    escribirEnv(credenciales);
  }
  if (info) {
    console.log(`\n  Autorizado como: ${info.login}  (id ${info.user_id})`);
    console.log(`  Permisos: ${(info.scopes || []).join(', ')}`);
    if (canalArg) {
      if (info.login) console.log(`  El bot hablará como "${info.login}" en #${canalArg}.`);
    } else {
      if (!env.CHANNEL) console.log('\n  OJO: rellena CHANNEL en el archivo .env con tu canal de Twitch.');
      if (info.login && env.BOT_USERNAME && info.login !== env.BOT_USERNAME) {
        console.log(`  Aviso: en .env BOT_USERNAME pone "${env.BOT_USERNAME}" pero el token es de "${info.login}".`);
        escribirEnv({ BOT_USERNAME: info.login });
        console.log('  Lo he corregido automaticamente.');
      }
    }
  }
  console.log('\n  Listo. Arranca el bot con:  npm start   (o doble clic en arrancar-bot.cmd)\n');
  rl.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  principal().catch((e) => {
    console.error(`\n  ERROR: ${e.message}\n`);
    process.exit(1);
  });
}

// =====================================================================
//  PANEL WEB del bot (estilo StreamElements, sin dependencias).
//  Cada dueño configura SU canal desde el navegador: IA, juegos, promos,
//  música... y ve el estado. Los cambios se aplican EN CALIENTE.
//  Arranque: junto al bot si config.panel.enabled (puerto 8099).
//  Login con Twitch: opcional. Sin TWITCH_CLIENT_SECRET el panel abre en
//  modo local (para gestionarlo tú). Con secret, pide login y cada uno
//  solo ve su canal.
// =====================================================================

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '1.0.0';
const NOMBRE = 'BotDJ';   // nombre comercial (cámbialo aquí y sale en toda la web)

function leerCuerpo(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 200000) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); }
    });
  });
}

export function crearPanel({ config, mundos, RAIZ, cerrar }) {
  const sesiones = new Map(); // token -> {login, id}
  const secret = (process.env.TWITCH_CLIENT_SECRET || '').trim();
  const clientId = (process.env.BOT_CLIENT_ID || '').trim();
  // En la nube Render inyecta PORT (hay que escuchar en 0.0.0.0); en casa, localhost.
  const puerto = Number(process.env.PORT || config.panel?.port || 8099);
  const maquina = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

  function canalesVisibles(login) {
    if (!secret) return mundos;                       // modo local: todo
    if (!login) return [];
    const propios = mundos.filter((m) => m.canal === String(login).toLowerCase());
    return propios.length ? propios : [];
  }

  function sesionDe(req) {
    const m = (req.headers.cookie || '').match(/(?:^|;\s*)sesion=([a-f0-9]+)/);
    if (!m) return null;
    return sesiones.get(m[1]) || null;
  }

  function esAdmin(req) {
    if (!secret) return true;   // modo local: eres tú
    const s = sesionDe(req);
    if (!s) return false;
    const propio = mundos.find((m) => m.propio);
    return propio ? s.login === propio.canal : false;
  }

  function estadoCanales() {
    return mundos.map((m) => ({
      canal: m.canal,
      plan: m.plan,
      propio: m.propio,
      conectado: Boolean(m.chat?.conectado),
      modoIA: m.brain?.modo || '?',
      ia: m.brain?.cfg?.mode || '?',
      replyChance: m.brain?.cfg?.replyChance ?? null,
      conversacion: m.brain?.cfg?.enabled !== false,
      juegos: m.totalJuegos,
      ajustes: (m.cfg?.ajustes) || {},
      version: VERSION,
    }));
  }

  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const ruta = url.pathname;

      const enviar = (codigo, tipo, texto) => {
        res.writeHead(codigo, { 'Content-Type': tipo + '; charset=utf-8' });
        res.end(texto);
      };
      const json = (obj, codigo = 200) => enviar(codigo, 'application/json', JSON.stringify(obj));

      // ---------- login con Twitch (opcional) ----------
      if (ruta === '/auth/twitch') {
        if (!secret || !clientId) {
          return enviar(200, 'text/html', '<h1>Panel local</h1><p>Aquí no hay login: pon TWITCH_CLIENT_SECRET en el .env y reinicia para pedir login con Twitch. <a href="/">Volver</a></p>');
        }
        const redir = `http://localhost:${puerto}/auth/callback`;
        const u = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redir)}&response_type=code&scope=user:read:email`;
        res.writeHead(302, { Location: u });
        return res.end();
      }
      if (ruta === '/auth/callback') {
        const code = url.searchParams.get('code');
        if (!code || !secret) return enviar(400, 'text/plain', 'Falta el código.');
        const cuerpo = new URLSearchParams({ client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code', redirect_uri: `http://localhost:${puerto}/auth/callback` });
        const r = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo }).then((x) => x.json()).catch(() => ({}));
        if (!r.access_token) return enviar(400, 'text/plain', 'Twitch no dio token.');
        const yo = await fetch('https://api.twitch.tv/helix/users', { headers: { Authorization: `Bearer ${r.access_token}`, 'Client-Id': clientId } }).then((x) => x.json()).catch(() => ({}));
        const login = (yo?.data?.[0]?.login || '').toLowerCase();
        if (!login) return enviar(400, 'text/plain', 'No pude saber quién eres.');
        const tok = crypto.randomBytes(16).toString('hex');
        sesiones.set(tok, { login, id: yo.data[0].id });
        res.writeHead(302, { Location: '/', 'Set-Cookie': `sesion=${tok}; Path=/; HttpOnly; SameSite=Lax` });
        return res.end();
      }
      if (ruta === '/api/yo') {
        const s = sesionDe(req);
        return json({ login: s?.login || null, modoLocal: !secret, admin: esAdmin(req) });
      }

      // ---------- API ----------
      const yo = sesionDe(req);
      const login = secret ? yo?.login || null : null;
      if (secret && ruta !== '/' && !ruta.startsWith('/api/yo') && !login && (ruta.startsWith('/api/') )) {
        return json({ error: 'login' }, 401);
      }
      if (ruta === '/api/estado') {
        return json({ canales: estadoCanales(), version: VERSION, modoLocal: !secret });
      }
      if (ruta === '/api/ajustes' && req.method === 'POST') {
        const datos = await leerCuerpo(req);
        const canal = String(datos.canal || '').toLowerCase();
        const m = canalesVisibles(login).find((x) => x.canal === canal);
        if (!m) return json({ error: 'canal no disponible' }, 403);
        const { guardarAjustes } = await import('./canales.js');
        const resto = { ...datos };
        delete resto.canal;
        guardarAjustes(RAIZ, canal, resto);
        const r = m.aplicarAjustes(resto);
        return json({ ok: true, ...r });
      }
      if (ruta === '/api/reiniciar' && req.method === 'POST') {
        const datos = await leerCuerpo(req).catch(() => ({}));
        void datos;
        json({ ok: true, nota: 'Reiniciando (con PM2 vuelve solo)' });
        setTimeout(() => { try { cerrar('panel'); } catch {} setTimeout(() => process.exit(0), 1500); }, 300);
        return;
      }

      // ---------- admin: licencias y canales ----------
      if (ruta === '/api/licencias' && req.method === 'GET') {
        if (!esAdmin(req)) return json({ error: 'admin' }, 403);
        const { listarLicencias } = await import('./licencias.js');
        return json({ licencias: listarLicencias(RAIZ) });
      }
      if (ruta === '/api/licencias/crear' && req.method === 'POST') {
        if (!esAdmin(req)) return json({ error: 'admin' }, 403);
        const datos = await leerCuerpo(req);
        const { crearLicencia } = await import('./licencias.js');
        const reg = crearLicencia(RAIZ, { plan: datos.plan || 'basico', canal: datos.canal || null, dias: Number(datos.dias ?? 30), nota: datos.nota || '' });
        return json({ ok: true, licencia: reg });
      }
      if (ruta === '/api/licencias/vincular' && req.method === 'POST') {
        if (!esAdmin(req)) return json({ error: 'admin' }, 403);
        const datos = await leerCuerpo(req);
        const { vincularLicencia } = await import('./licencias.js');
        const reg = vincularLicencia(RAIZ, datos.key, datos.canal);
        return reg ? json({ ok: true, licencia: reg }) : json({ error: 'clave no existe' }, 404);
      }
      if (ruta === '/api/licencias/revocar' && req.method === 'POST') {
        if (!esAdmin(req)) return json({ error: 'admin' }, 403);
        const datos = await leerCuerpo(req);
        const { revocarLicencia } = await import('./licencias.js');
        return json({ ok: revocarLicencia(RAIZ, datos.key) });
      }
      if (ruta === '/api/canales' && req.method === 'GET') {
        if (!esAdmin(req)) return json({ error: 'admin' }, 403);
        return json({
          canales: mundos.map((m) => ({ canal: m.canal, plan: m.plan, propio: m.propio, conectado: Boolean(m.chat?.conectado) })),
          exigir: config.comercial?.exigirLicencia === true,
        });
      }
      // Copia de puntos/memorias (por si el hosting borra archivos al dormir)
      if (ruta === '/api/backup' && req.method === 'GET') {
        if (!esAdmin(req)) return json({ error: 'admin' }, 403);
        const datos = {};
        try {
          const dir = path.join(RAIZ, 'src', 'data');
          for (const f of fs.readdirSync(dir)) {
            if (!/\.json$/.test(f)) continue;
            try { datos[f] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch {}
          }
        } catch {}
        return json({ fecha: new Date().toISOString(), datos });
      }

      // ---------- páginas ----------
      if (ruta === '/panel') {
        return enviar(200, 'text/html', PAGINA);
      }
      if (ruta === '/admin') {
        if (!esAdmin(req)) {
          res.writeHead(302, { Location: secret ? '/auth/twitch' : '/panel' });
          return res.end();
        }
        return enviar(200, 'text/html', ADMIN);
      }

      // ---------- portada pública ----------
      if (ruta === '/' || ruta === '/index.html') {
        return enviar(200, 'text/html', PORTADA);
      }
      return enviar(404, 'text/plain', 'No existe.');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error: ' + e.message);
    }
  });

  return {
    iniciar() {
      if (config.panel?.enabled === false) return;
      servidor.listen(puerto, maquina, () => {
        console.log(`Panel del bot en http://${maquina === '0.0.0.0' ? 'tu-dominio' : maquina}:${puerto} ${secret ? '(con login Twitch)' : '(modo local, sin login)'}`);
      });
    },
    detener() { try { servidor.close(); } catch {} },
  };
}

const PAGINA = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel del bot</title>
<style>
body{font-family:system-ui;background:#14141f;color:#eee;margin:0;padding:20px}
h1{font-size:22px}.card{background:#1e1e2c;border:1px solid #333;border-radius:12px;padding:16px;margin:12px 0;max-width:640px}
.enc{color:#8ab4f8}.on{color:#4ade80}.off{color:#f87171}
label{display:flex;justify-content:space-between;align-items:center;margin:8px 0;gap:12px}
button{background:#8ab4f8;border:0;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer}
button.ghost{background:#333;color:#eee}
input[type=range]{width:140px}
small{color:#999}
#arriba{display:flex;justify-content:space-between;align-items:center;max-width:640px}
</style></head><body>
<div id="arriba"><h1>🤖 Mi panel <small id="ver"></small></h1><div><span id="yo"></span> <button class="ghost" onclick="location.href='/auth/twitch'" id="btnLogin">Entrar con Twitch</button> <button class="ghost" onclick="location.href='/'">Web</button></div></div>
<div id="lista">Cargando...</div>
<script>
async function api(ruta, datos){
  const o = datos ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)} : {};
  const r = await fetch(ruta, o);
  if (r.status === 401) { location.href = '/auth/twitch'; throw 0; }
  return r.json();
}
function fila(titulo, ayuda, control, canal, clave){
  return '<label><span>'+titulo+'<br><small>'+ayuda+'</small></span><span data-c="'+canal+'" data-k="'+clave+'">'+control+'</span></label>';
}
function chk(v){ return '<input type="checkbox" class="t" '+(v?'checked':'')+'>'; }
async function cargar(){
  const yo = await api('/api/yo');
  document.getElementById('yo').textContent = yo.login ? '@'+yo.login : (yo.modoLocal ? 'modo local' : '');
  document.getElementById('btnLogin').style.display = yo.modoLocal || yo.login ? 'none' : '';
  const e = await api('/api/estado');
  document.getElementById('ver').textContent = 'v'+e.version;
  const d = document.getElementById('lista');
  if (!e.canales.length) { d.innerHTML = '<div class=card>Sin canales. <small>Inicia sesión con tu cuenta de Twitch.</small></div>'; return; }
  d.innerHTML = e.canales.map((c) => {
    const a = c.ajustes || {};
    const conv = a.conversation || {}, gam = a.games || {}, pro = a.promos || {}, mus = a.songrequests || {};
    return '<div class=card data-canal="'+c.canal+'">'
      + '<b class=enc>#'+c.canal+'</b> · plan '+c.plan
      + ' · <span class="'+(c.conectado?'on':'off')+'">'+(c.conectado?'● conectado':'○ parado')+'</span>'
      + ' · IA: '+c.modoIA
      + fila('Conversación','El bot habla en el chat',chk(c.conversacion),'x','conversation.enabled')
      + fila('Modo IA','IA de verdad o respuestas por reglas',c.ia==='llm'
          ? '<select class=t><option value=llm>IA</option><option value=local>Local</option></select>'
          : '<select class=t><option value=local>Local</option><option value=llm>IA</option></select>','x','conversation.mode')
      + fila('Responder a','% de mensajes a los que contesta','<input type=range min=10 max=100 value="'+Math.round((c.replyChance??0.6)*100)+'" class=t> <b class=v>'+Math.round((c.replyChance??0.6)*100)+'%</b>','x','conversation.replyChance')
      + fila('Juegos','17 juegos del chat',chk(gam.enabled!==false),'x','games.enabled')
      + fila('Música (!sr, !bpm)','Peticiones y apuestas',chk(mus.enabled!==false),'x','songrequests.enabled')
      + fila('Recordatorios','Follow, avatares, juegos, subs',chk((pro.enabled!==false)),'x','promos.enabled')
      + '<button onclick="guardar(this)">Guardar</button> <small class=msg></small></div>';
  }).join('')
  + '<div class=card><b>Bot</b><br><small>Guardar aplica al momento (casi todo). Para actualizar versión o planes: botón y PM2 lo levanta solo.</small><br><br><button class=ghost onclick="reiniciar()">Reiniciar bot</button> <small class=msg2></small></div>';
  d.querySelectorAll('input[type=range]').forEach((r) => {
    r.oninput = () => { r.parentElement.querySelector('.v').textContent = r.value + '%'; };
  });
}
async function guardar(btn){
  const card = btn.closest('.card');
  const canal = card.dataset.canal;
  const aj = { conversation: {}, games: {}, promos: {}, songrequests: {} };
  card.querySelectorAll('[data-k]').forEach((s) => {
    const [rama, clave] = s.dataset.k.split('.');
    const inp = s.querySelector('.t');
    let v;
    if (inp.type === 'checkbox') v = inp.checked;
    else if (inp.tagName === 'SELECT') v = inp.value;
    else v = Number(inp.value) / 100;
    aj[rama][clave] = v;
  });
  const r = await api('/api/ajustes', { canal, ...aj });
  card.querySelector('.msg').textContent = r.ok ? ('Guardado ✅' + (r.reinicioNecesario ? ' (parte pide reinicio)' : '')) : ('Error: ' + (r.error || ''));
  setTimeout(cargar, 1200);
}
async function reiniciar(){
  if (!confirm('¿Reiniciar el bot? (vuelve solo)')) return;
  await api('/api/reiniciar', {});
  document.querySelector('.msg2').textContent = 'Reiniciando... recarga en 10 s.';
}
cargar();
</script></body></html>`;

const PORTADA = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${NOMBRE} — El bot de Twitch para DJs</title>
<style>
body{font-family:system-ui;background:#101018;color:#eee;margin:0}
.hero{text-align:center;padding:64px 20px;background:linear-gradient(160deg,#1b1035,#0e2a4a)}
.hero h1{font-size:44px;margin:0}.hero h1 span{color:#8ab4f8}
.hero p{color:#bbb;max-width:560px;margin:16px auto}
.btn{display:inline-block;background:#8ab4f8;color:#111;border-radius:10px;padding:12px 28px;font-weight:800;text-decoration:none;margin:6px}
.btn.ghost{background:transparent;color:#8ab4f8;border:2px solid #8ab4f8}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;max-width:960px;margin:32px auto;padding:0 20px}
.card{background:#1a1a28;border:1px solid #333;border-radius:12px;padding:18px}
.card b{color:#8ab4f8}.precio{font-size:32px;font-weight:800}.centro{text-align:center;padding:20px 20px 60px;color:#999}
code{background:#222;padding:2px 8px;border-radius:6px}
</style></head><body>
<div class="hero">
<h1>🤖 ${NOMBRE} <span>para DJs</span></h1>
<p>Tu chat habla, juega, pide temas y tiene sus muñequitos en pantalla. Tú a pinchar: del resto se encarga el bot, 24/7.</p>
<a class="btn" href="/panel">Entrar a mi panel</a>
<a class="btn ghost" href="#planes">Ver planes</a>
</div>
<div class="grid">
<div class="card"><b>🗣️ Conversa de verdad</b><br>IA que sigue el hilo, anima el chat parado y rompe el hielo.</div>
<div class="card"><b>🎮 17 juegos</b><br>Trivias musicales, bingo, ruleta, subasta de temas, duelos...</div>
<div class="card"><b>🎧 Música participativa</b><br><code>!sr</code> para pedir temas, <code>!cola</code>, apuestas de BPM con <code>!bpm</code>.</div>
<div class="card"><b>🎭 56 skins HD</b><br>Avatares estilo arcade que bailan, suben de nivel y luchan en la liga.</div>
<div class="card"><b>🚫 Moderación auto</b><br>257 palabras, escalado de avisos, comandos para mods.</div>
<div class="card"><b>⚙️ Tú lo configuras</b><br>Desde tu panel: IA, juegos, promos y recordatorios, al momento.</div>
</div>
<div class="centro" id="planes">
<h2>Planes</h2>
<div class="grid">
<div class="card"><b>BÁSICO</b><div class="precio">Gratis</div>Chat + juegos + moderación.<br><br><a class="btn" href="/panel">Empezar</a></div>
<div class="card"><b>FULL</b><div class="precio">Gratis<small> lanzamiento</small></div>Todo + IA conversacional + overlay + liga.<br><br><a class="btn" href="/panel">Empezar</a></div>
</div>
<p><small>De momento todo gratis. Si hay demanda, habrá planes de pago (avisaremos).</small></p>
</div>
</body></html>`;

const ADMIN = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — ${NOMBRE}</title>
<style>
body{font-family:system-ui;background:#14141f;color:#eee;margin:0;padding:20px}
.card{background:#1e1e2c;border:1px solid #333;border-radius:12px;padding:16px;margin:12px 0;max-width:720px}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{border-bottom:1px solid #333;padding:6px;text-align:left}
button{background:#8ab4f8;border:0;border-radius:8px;padding:6px 14px;font-weight:700;cursor:pointer;margin:2px}
button.ghost{background:#333;color:#eee}
input,select{background:#111;color:#eee;border:1px solid #444;border-radius:6px;padding:6px;margin:2px}
code{background:#222;padding:2px 8px;border-radius:6px}
a{color:#8ab4f8}
</style></head><body>
<h1>🔧 Admin <small><a href="/">web</a> · <a href="/panel">panel</a></small></h1>
<div class="card"><h3>Canales</h3><div id="canales">...</div></div>
<div class="card"><h3>Crear licencia</h3>
Plan <select id="plan"><option value="basico">basico</option><option value="full">full</option></select>
Días <input id="dias" type="number" value="30" style="width:70px"> (0 = sin caducidad)
Canal <input id="canal" placeholder="opcional, se vincula luego">
Nota <input id="nota" placeholder="Ko-fi de...">
<button onclick="crear()">Crear</button> <span id="nueva"></span></div>
<div class="card"><h3>Licencias</h3><div id="lics">...</div></div>
<script>
async function api(r,m){ const o=m?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(m)}:{}; const r2=await fetch(r,o); return r2.json(); }
async function cargar(){
  const c = await api('/api/canales');
  document.getElementById('canales').innerHTML = '<table><tr><th>Canal</th><th>Plan</th><th>Estado</th></tr>' +
    c.canales.map((x) => '<tr><td>#'+x.canal+(x.propio?' ⭐':'')+'</td><td>'+x.plan+'</td><td>'+(x.conectado?'●':'○')+'</td></tr>').join('') + '</table>'
    + '<small>Licencias exigidas: '+(c.exigir?'SÍ':'no (modo abierto)')+'</small>';
  const l = await api('/api/licencias');
  document.getElementById('lics').innerHTML = '<table><tr><th>Clave</th><th>Plan</th><th>Canal</th><th>Caduca</th><th></th></tr>' +
    l.licencias.map((x) => '<tr><td><code>'+x.key+'</code></td><td>'+x.plan+'</td><td>'+(x.canal||'-')+'</td><td>'+(x.expira?new Date(x.expira).toLocaleDateString():'nunca')+(x.activa?'':' (off)')+'</td><td>'
      + '<button onclick="vinc(\''+x.key+'\')">vincular</button> <button class=ghost onclick="rev(\''+x.key+'\')">off</button></td></tr>').join('') + '</table>';
}
async function crear(){
  const r = await api('/api/licencias/crear', { plan: document.getElementById('plan').value, dias: Number(document.getElementById('dias').value), canal: document.getElementById('canal').value || null, nota: document.getElementById('nota').value });
  document.getElementById('nueva').innerHTML = r.ok ? ('Clave: <code>'+r.licencia.key+'</code>') : 'Error';
  cargar();
}
async function vinc(k){ const c = prompt('¿A qué canal vinculo '+k+'?'); if(!c) return; await api('/api/licencias/vincular', { key: k, canal: c }); cargar(); }
async function rev(k){ if(!confirm('¿Desactivar '+k+'?')) return; await api('/api/licencias/revocar', { key: k }); cargar(); }
cargar();
</script></body></html>`;

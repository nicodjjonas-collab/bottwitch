// Prueba del panel sin Twitch: mundos falsos, puerto de prueba.
import { crearPanel } from './src/panel.js';

const mundos = [{
  canal: 'canalprueba',
  plan: 'basico',
  propio: false,
  cfg: {},
  chat: { conectado: true },
  brain: { modo: 'local', cfg: { mode: 'local', enabled: true, replyChance: 0.6 } },
  totalJuegos: 17,
  aplicarAjustes(a) { Object.assign(this.cfg, a); return { ok: true, reinicioNecesario: false }; },
}];
const panel = crearPanel({
  config: { panel: { enabled: true, port: 18099 } },
  mundos, RAIZ: '.', cerrar: () => {},
});
panel.iniciar();
await new Promise((r) => setTimeout(r, 400));
const base = 'http://127.0.0.1:18099';
const estado = await fetch(`${base}/api/estado`).then((r) => r.json());
console.log('estado:', estado.canales.length === 1 && estado.canales[0].canal === 'canalprueba' ? 'OK' : 'MAL');
const yo = await fetch(`${base}/api/yo`).then((r) => r.json());
console.log('modo local sin login:', yo.modoLocal === true ? 'OK' : 'MAL');
const g = await fetch(`${base}/api/ajustes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal: 'canalprueba', conversation: { mode: 'llm' } }) }).then((r) => r.json());
console.log('guardar:', g.ok ? 'OK' : 'MAL ' + JSON.stringify(g));
const raiz = await fetch(`${base}/`).then((r) => r.text());
console.log('portada:', raiz.includes('BotDJ') && raiz.includes('Planes') ? 'OK' : 'MAL');
const dash = await fetch(`${base}/panel`).then((r) => r.text());
console.log('panel:', dash.includes('Mi panel') ? 'OK' : 'MAL');
const adm = await fetch(`${base}/admin`).then((r) => r.text());
console.log('admin (local):', adm.includes('Crear licencia') ? 'OK' : 'MAL');
panel.detener();
await new Promise((r) => setTimeout(r, 300));
process.exit(0);

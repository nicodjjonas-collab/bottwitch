// Prueba del panel sin Twitch: mundos falsos, puerto de prueba.
import { crearPanel } from './src/panel.js';

const mundos = [{
  canal: 'canalprueba',
  plan: 'basico',
  propio: false,
  cfg: { ajustes: { promos: { alertas: [{ id: 'a1', nombre: 'Redes', enabled: true, everyMinutes: 15, minutoInicial: 2, onlyIfChatActiveSeconds: 60, maxPerStream: 3, messages: ['hola', 'adios'] }] } } },
  chat: { conectado: true },
  brain: { modo: 'local', cfg: { mode: 'local', enabled: true, replyChance: 0.6 } },
  totalJuegos: 17,
  promos: {
    dispararAlertaPorId: (id) => (id === 'a1' ? { ok: true, id } : { ok: false, motivo: 'no existe' }),
  },
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
const al = estado.canales[0].alertas || [];
console.log('estado trae alertas completas:', al.length === 1 && al[0].id === 'a1' && al[0].minutoInicial === 2 && al[0].maxPerStream === 3 && al[0].messages.length === 2 ? 'OK' : 'MAL ' + JSON.stringify(al));
const yo = await fetch(`${base}/api/yo`).then((r) => r.json());
console.log('modo local sin login:', yo.modoLocal === true ? 'OK' : 'MAL');
const g = await fetch(`${base}/api/ajustes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal: 'canalprueba', conversation: { mode: 'llm' } }) }).then((r) => r.json());
console.log('guardar:', g.ok ? 'OK' : 'MAL ' + JSON.stringify(g));
const gAl = await fetch(`${base}/api/ajustes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal: 'canalprueba', promos: { alertas: [{ id: 'n1', nombre: 'Nueva', messages: ['ey'] }] } }) }).then((r) => r.json());
console.log('guardar alertas:', gAl.ok ? 'OK' : 'MAL ' + JSON.stringify(gAl));
const pOk = await fetch(`${base}/api/alertas/probar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal: 'canalprueba', id: 'a1' }) }).then((r) => r.json());
console.log('probar alerta:', pOk.ok ? 'OK' : 'MAL ' + JSON.stringify(pOk));
const pNo = await fetch(`${base}/api/alertas/probar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal: 'canalprueba', id: 'zzz' }) }).then((r) => r.json());
console.log('probar inexistente:', !pNo.ok ? 'OK' : 'MAL ' + JSON.stringify(pNo));
const pOtro = await fetch(`${base}/api/alertas/probar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal: 'otro', id: 'a1' }) }).then((r) => r.json());
console.log('probar otro canal:', !pOtro.ok ? 'OK' : 'MAL ' + JSON.stringify(pOtro));
const raiz = await fetch(`${base}/`).then((r) => r.text());
console.log('portada:', raiz.includes('BotDJ') && raiz.includes('Planes') ? 'OK' : 'MAL');
const dash = await fetch(`${base}/panel`).then((r) => r.text());
console.log('panel:', dash.includes('Mi panel') ? 'OK' : 'MAL');
const adm = await fetch(`${base}/admin`).then((r) => r.text());
console.log('admin (local):', adm.includes('Crear licencia') ? 'OK' : 'MAL');
panel.detener();
await new Promise((r) => setTimeout(r, 300));
process.exit(0);

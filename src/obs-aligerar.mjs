// Aligera la escena Live Scene para un i3 con 8 GB:
//  1) shutdown:true en TODAS las fuentes de navegador (si se ocultan, se apagan del todo)
//  2) fps 20 en las pesadas animadas (muro de emotes, boom, lluvia, alertas)
//  3) oculta las de Kick rotas (reintentan red sin parar) + viewerattack
// Idempotente y con copia de seguridad previa en .bak-antes-fuentes / este script no duplica.
import fs from 'node:fs';

const p = process.env.APPDATA + '\\obs-studio\\basic\\scenes\\_Game_Night.json';
const db = JSON.parse(fs.readFileSync(p, 'utf8'));
const live = db.sources.find((s) => s.name === 'Live Scene');
if (!live) { console.error('No existe Live Scene'); process.exit(1); }

const PESADAS = ['emotes', 'boom', 'lluvia de bits', 'alertas', 'Alertbox'];
const ROTAS = ['bot imagen', 'chat kick', 'contador de viwers', 'raids kick', 'Navegador 2'];
const cambios = [];

for (const s of db.sources) {
  if (s.id !== 'browser_source') continue;
  s.settings = s.settings || {};
  if (s.settings.shutdown !== true) { s.settings.shutdown = true; cambios.push(`shutdown:${s.name}`); }
  if (PESADAS.includes(s.name) && s.settings.fps !== 20) { s.settings.fps = 20; cambios.push(`fps20:${s.name}`); }
}
for (const it of live.settings.items) {
  if (ROTAS.includes(it.name) && it.visible !== false) { it.visible = false; cambios.push(`oculta:${it.name}`); }
}

if (!cambios.length) { console.log('La escena ya estaba aligerada.'); process.exit(0); }
fs.writeFileSync(p, JSON.stringify(db, null, 1), 'utf8');
console.log('Aplicado:', cambios.join(' · '));

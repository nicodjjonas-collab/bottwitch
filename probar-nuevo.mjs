// Prueba funcional de !meta !suma !clip !horario !track (sin Twitch).
import fs from 'node:fs';
import { crearComandos } from './src/commands.js';

const dichos = [];
const chat = {
  say: async (t) => { dichos.push(t); return true; },
  sayMany: async (arr) => { dichos.push(...arr); return true; },
};
const store = {
  puntos: new Map(),
  getPoints: (u) => store.puntos.get(String(u).toLowerCase()) || 0,
  getWarnings: () => 0,
  resetWarnings: () => {},
  top: () => [],
  resumen: () => ({ puntosTotales: 0 }),
};
const juegos = {
  listar: () => [{ id: 'trivia' }],
  ayudaJuegos: () => ['!trivia'],
  buscar: () => null,
  estado: () => ({ juegos: 1, activa: false }),
};
const brain = { estado: () => ({ modo: 'local', ia: {} }) };
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const comandos = crearComandos({
  cfg: config, config, store, brain, juegos,
  moderador: { mod: { prohibidas: [], blanca: new Set(), cargar: () => {} } },
  chat, helix: {}, runtime: { juegosActivos: true }, ids: {},
});
const mod = { usuario: 'jonasrdb', usuarioMin: 'jonasrdb', texto: '', esMod: true, esBroadcaster: true };
const fan = { usuario: 'luna', usuarioMin: 'luna', texto: '', esMod: false, esBroadcaster: false };
async function cmd(como, texto) {
  dichos.length = 0;
  const m = { ...como, texto };
  const r = await comandos.manejar(m);
  return { atendido: r, dijo: dichos.join(' | ') };
}
console.log('1 meta:', JSON.stringify(await cmd(mod, '!meta')));
console.log('2 meta follows 200:', JSON.stringify(await cmd(mod, '!meta follows 200')));
console.log('3 suma follows 5:', JSON.stringify(await cmd(mod, '!suma follows 5')));
console.log('4 fan suma (debe negar):', JSON.stringify(await cmd(fan, '!suma follows 5')));
console.log('5 fan meta:', JSON.stringify(await cmd(fan, '!meta')));
console.log('6 clip:', JSON.stringify(await cmd(fan, '!clip el drop brutal')));
console.log('7 horario:', JSON.stringify(await cmd(fan, '!horario')));
console.log('8 track:', JSON.stringify(await cmd(mod, '!track Artista - Tema')));
console.log('9 tracklist:', JSON.stringify(await cmd(fan, '!tracklist')));
console.log('10 ayuda:', JSON.stringify(await cmd(fan, '!ayuda')));
console.log('--- meta-follows.txt ---');
console.log(fs.readFileSync('C:\\OBS-Media\\datos\\meta-follows.txt', 'utf8'));
console.log('--- meta-subs.txt ---');
console.log(fs.readFileSync('C:\\OBS-Media\\datos\\meta-subs.txt', 'utf8'));
console.log('--- clips-marcas.txt ---');
console.log(fs.readFileSync('C:\\OBS-Media\\datos\\clips-marcas.txt', 'utf8'));
// limpieza de la prueba (deja las metas de ejemplo)
fs.rmSync('src/data/metas.json', { force: true });
try { comandos && null; } catch {}

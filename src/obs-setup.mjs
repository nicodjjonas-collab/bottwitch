// Añade a la escena "Live Scene": Meta Follows, Meta Subs (texto)
// y Horario (navegador). Idempotente: si ya existen, no duplica.
import fs from 'node:fs';
import crypto from 'node:crypto';

const p = process.env.APPDATA + '\\obs-studio\\basic\\scenes\\_Game_Night.json';
const db = JSON.parse(fs.readFileSync(p, 'utf8'));
const live = db.sources.find((s) => s.name === 'Live Scene');
if (!live) { console.error('No existe la escena Live Scene'); process.exit(1); }

const baseTexto = db.sources.find((s) => s.name === 'Ranking');
const baseNavegador = db.sources.find((s) => s.name === 'Evotars');
if (!baseTexto || !baseNavegador) { console.error('Faltan fuentes base'); process.exit(1); }

let maxId = 0;
for (const s of db.sources) {
  for (const it of (s.settings && s.settings.items) || []) {
    if (typeof it.id === 'number' && it.id > maxId) maxId = it.id;
  }
}

function clonarItem(modelo, name, uuid) {
  const it = JSON.parse(JSON.stringify(modelo));
  it.name = name;
  it.source_uuid = uuid;
  it.id = ++maxId;
  it.locked = false; // las nuevas se pueden mover a mano
  return it;
}

function existeFuente(name) { return db.sources.some((s) => s.name === name); }
function enEscena(name) { return live.settings.items.some((i) => i.name === name); }

const nuevas = [];
// ---- 1. Meta Follows (texto) ----
if (!existeFuente('Meta Follows')) {
  const s = JSON.parse(JSON.stringify(baseTexto));
  s.name = 'Meta Follows';
  s.uuid = crypto.randomUUID();
  s.settings = { ...s.settings, file: 'C:\\OBS-Media\\datos\\meta-follows.txt', text: '' };
  s.settings.font = { ...s.settings.font, size: 30 };
  db.sources.push(s);
  nuevas.push('fuente Meta Follows');
}
if (!enEscena('Meta Follows')) {
  const src = db.sources.find((s) => s.name === 'Meta Follows');
  const itemRanking = live.settings.items.find((i) => i.name === 'Ranking');
  live.settings.items.push(clonarItem(itemRanking, 'Meta Follows', src.uuid));
  nuevas.push('item Meta Follows');
}
// ---- 2. Meta Subs (texto) ----
if (!existeFuente('Meta Subs')) {
  const s = JSON.parse(JSON.stringify(baseTexto));
  s.name = 'Meta Subs';
  s.uuid = crypto.randomUUID();
  s.settings = { ...s.settings, file: 'C:\\OBS-Media\\datos\\meta-subs.txt', text: '' };
  s.settings.font = { ...s.settings.font, size: 30 };
  db.sources.push(s);
  nuevas.push('fuente Meta Subs');
}
if (!enEscena('Meta Subs')) {
  const src = db.sources.find((s) => s.name === 'Meta Subs');
  const itemRanking = live.settings.items.find((i) => i.name === 'Ranking');
  live.settings.items.push(clonarItem(itemRanking, 'Meta Subs', src.uuid));
  nuevas.push('item Meta Subs');
}
// ---- 3. Horario (navegador) ----
const URL_HORARIO = 'file:///C:/StreamAvatars/horario.html?dias=viernes,sabado&hora=22:00';
if (!existeFuente('Horario')) {
  const s = JSON.parse(JSON.stringify(baseNavegador));
  s.name = 'Horario';
  s.uuid = crypto.randomUUID();
  s.settings = { ...s.settings, url: URL_HORARIO, width: 1920, height: 1080 };
  db.sources.push(s);
  nuevas.push('fuente Horario');
}
if (!enEscena('Horario')) {
  const src = db.sources.find((s) => s.name === 'Horario');
  const itemEvo = live.settings.items.find((i) => i.name === 'Evotars');
  live.settings.items.push(clonarItem(itemEvo, 'Horario', src.uuid));
  nuevas.push('item Horario');
}

if (!nuevas.length) { console.log('Todo ya estaba en la escena. Nada que hacer.'); process.exit(0); }
fs.writeFileSync(p, JSON.stringify(db, null, 1), 'utf8');
console.log('Añadido a Live Scene:', nuevas.join(' · '));
console.log('Escena guardada. Abre OBS para verlo (las metas aparecen al arrancar el bot).');

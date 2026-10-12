// Prueba multi-canal: IA compartida, cerebros y ajustes independientes,
// y overlay servido por el panel. Sin Twitch (dryRun + tmp).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearCanal } from './src/canal.js';
import { crearLLM } from './src/brain/llm.js';
import { crearPanel } from './src/panel.js';

let fallos = 0;
const ok = (nombre, cond, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre} ${extra}`);
  if (!cond) fallos += 1;
};

const RAIZ = fs.mkdtempSync(path.join(os.tmpdir(), 'botdj-'));
// Limpia restos de ejecuciones anteriores (al inicio: sin temporizadores vivos)
try {
  for (const e of fs.readdirSync(os.tmpdir())) {
    if (e.startsWith('botdj-') && path.join(os.tmpdir(), e) !== RAIZ) {
      fs.rmSync(path.join(os.tmpdir(), e), { recursive: true, force: true });
    }
  }
} catch {}
const config = JSON.parse(fs.readFileSync('C:/TwitchBot/config.json', 'utf8'));
const llm = crearLLM({ cfg: config.llm });
const base = (channel, ajustes) => ({
  channel, bot: 'sesionesoldschool', clientId: 'x', token: '', plan: 'full',
  ajustes,
});

const A = await crearCanal({ channelCfg: base('testa', { conversation: { replyChance: 0.5 } }), config, RAIZ, llm, dryRun: true });
const B = await crearCanal({ channelCfg: base('testb', { conversation: { replyChance: 0.9 } }), config, RAIZ, llm, dryRun: true });

ok('cerebros independientes', A.brain !== B.brain);
ok('IA (llm) compartida', A.brain.llm === B.brain.llm);
ok('memorias separadas', A.brain.memoryFile !== B.brain.memoryFile, `${A.brain.memoryFile} vs ${B.brain.memoryFile}`);
ok('ajuste inicial por canal', A.brain.cfg.replyChance === 0.5 && B.brain.cfg.replyChance === 0.9);
ok('stores separados', A.brain.store !== B.brain.store);

A.aplicarAjustes({ conversation: { mode: 'local' } });
ok('ajuste en caliente solo afecta a su canal', A.brain.cfg.mode === 'local' && B.brain.cfg.mode !== 'local');

// Overlay servido por el panel
const panel = crearPanel({ config: { ...config, panel: { enabled: true, port: 18098 } }, mundos: [], RAIZ: 'C:/TwitchBot', cerrar: () => {} });
panel.iniciar();
await new Promise((r) => setTimeout(r, 500));
const ieno = await fetch('http://127.0.0.1:18098/overlay/avatares.html').then((r) => ({ ok: r.ok, t: r.headers.get('content-type') }));
ok('overlay avatares.html 200 html', ieno.ok && (ieno.t || '').includes('text/html'), ieno.t);
const js = await fetch('http://127.0.0.1:18098/overlay/js/engine.js').then((r) => ({ ok: r.ok, t: r.headers.get('content-type') }));
ok('overlay js con MIME correcto', js.ok && (js.t || '').includes('javascript'), js.t);
const trav = await fetch('http://127.0.0.1:18098/overlay/../src/index.js').then((r) => r.status);
ok('anti-traversal bloquea ../', trav === 403 || trav === 404, `status ${trav}`);
const noext = await fetch('http://127.0.0.1:18098/overlay/x.exe').then((r) => r.status);
ok('extensiones raras bloqueadas', noext === 403, `status ${noext}`);
panel.detener();

console.log(fallos === 0 ? 'MULTICANAL OK' : `MULTICANAL FALLA (${fallos})`);
const codigo = fallos === 0 ? 0 : 1;
setTimeout(() => process.exit(codigo), 800);

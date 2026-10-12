// Enrutador de comandos: todo lo que empieza por el prefijo (!) pasa por aqui.
// Devuelve true si el mensaje era un comando nuestro (y por tanto ya esta atendido).

import { logger } from './logger.js';
import { manejarTrack } from './tracklist.js';
import { manejarMetas, pintarMetas } from './metas.js';
import { manejarDirecto } from './directo.js';
import { manejarMultichat } from './multichat/comandos.js';

export function crearComandos({ cfg, config, store, brain, juegos, moderador, chat, helix, runtime, ids }) {
  const P = config.prefix || '!';
  const canal = (process.env.CHANNEL || config.canal || '').toLowerCase();
  // Pinta los archivos de metas para OBS al arrancar (por si cambiaron a mano)
  try { pintarMetas(); } catch (e) { /* da igual */ }
  const alias = (lista) => (lista || []).map((a) => String(a).toLowerCase());

  const CMD = {
    ayuda: alias(config.commands?.help).concat('ayuda', 'help', 'comandos'),
    juegos: alias(config.commands?.games).concat('juegos', 'games', 'jugar'),
    puntos: alias(config.commands?.points).concat('puntos', 'points', 'monedas'),
    top: alias(config.commands?.top).concat('top', 'ranking', 'clasificacion'),
    estado: alias(config.commands?.status).concat('estado', 'status'),
    cancelar: alias(config.commands?.cancelGame).concat('cancelar', 'parar', 'stop'),
    seguir: alias(config.commands?.follow).concat('seguir', 'follow'),
    bot: alias(config.commands?.bot).concat('bot', 'info'),
  };

  const es = (cmd, grupo) => grupo.includes(cmd);
  let usuarioIdCache = new Map();

  const lineas = (arr) => arr.filter(Boolean);

  // ---- esperas por persona para los comandos de diversion ----
  const ultimoUso = new Map();
  function enEspera(clave, segundos) {
    const ahora = Date.now();
    const ultimo = ultimoUso.get(clave) || 0;
    const falta = segundos * 1000 - (ahora - ultimo);
    if (falta > 0) return Math.ceil(falta / 1000);
    ultimoUso.set(clave, ahora);
    if (ultimoUso.size > 800) ultimoUso.clear();
    return 0;
  }

  // ---- festerometro: el mismo resultado durante 10 minutos, luego cambia ----
  const FRASES_FIESTA = [
    [90, '🔥 ¡¡A LA PISTA!!'],
    [70, '🎉 Esta que se sale'],
    [50, '😏 Va cogiendo ganas'],
    [30, '😐 Necesita un par de temas'],
    [0, '😴 Esta dormido'],
  ];
  function festeroDe(nombre, store) {
    const bloque = Math.floor(Date.now() / (10 * 60 * 1000));
    const texto = String(nombre).toLowerCase() + '|' + bloque;
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h * 33) ^ texto.charCodeAt(i)) >>> 0;
    let pct = 25 + (h % 71);
    if (store) {
      const activo = Math.min(5, Math.floor((store.getPoints(nombre) || 0) / 50));
      pct = Math.min(100, pct + activo);
    }
    return pct;
  }
  function barraFiesta(pct) {
    const llenos = Math.max(1, Math.min(10, Math.round(pct / 10)));
    return '█'.repeat(llenos) + '░'.repeat(10 - llenos);
  }
  const fraseFestera = (pct) => (FRASES_FIESTA.find((f) => pct >= f[0]) || [0, '🎧'])[1];

  const RESPUESTAS_8BALL = [
    'Si, sin duda 🎱', 'Ni de broma', 'Puede ser...', 'Pregunta otra vez, que estaba pinchando',
    'Todo apunta a que si', 'Yo diria que no', 'Cuenta con ello', 'Mejor no te lo digo 😅',
    'Claramente si', 'Ni harto de vinilo', 'Los astros dicen que si', 'Eso ni el Shazam lo sabe',
  ];

  return {
    // Devuelve true si el mensaje era un comando atendido
    async manejar(mensaje) {
      const texto = mensaje.texto.trim();
      if (!texto.startsWith(P)) return false;
      const sinPrefijo = texto.slice(P.length).trim();
      if (!sinPrefijo) return false;

      const partes = sinPrefijo.split(/\s+/);
      const cmd = partes[0].toLowerCase();
      const args = partes.slice(1);
      const esMod = mensaje.esMod || mensaje.esBroadcaster;

      // ---------- AYUDA ----------
      if (es(cmd, CMD.ayuda)) {
        await chat.sayMany(lineas([
          `Comandos: ${P}juegos · ${P}puntos · ${P}top · ${P}estado · ${P}seguir · ${P}bot`,
          `Juegos: ${juegos.listar().map((j) => `${P}${j.id}`).join(' ')}`,
          `Música: ${P}sr <cancion> · ${P}cola · ${P}bpm <n> · ${P}festero · ${P}8ball · ${P}so @alguien`,
          `Directo: ${P}meta (las metas) · ${P}clip <texto> (marca un Short) · ${P}horario · ${P}tracklist`,
          `También puedes hablarme normal, leo el chat 😉`,
        ]));
        return true;
      }

      // ---------- LISTA DE JUEGOS ----------
      if (es(cmd, CMD.juegos)) {
        const lista = juegos.ayudaJuegos();
        await chat.sayMany([
          '🎮 Juegos disponibles:',
          ...lista.slice(0, 6),
          lista.length > 6 ? `...y alguno mas. Detalles con ${P}ayuda` : `${P}ayuda para el resto de comandos`,
        ]);
        return true;
      }

      // ---------- PUNTOS ----------
      if (es(cmd, CMD.puntos)) {
        const quien = (args[0] || mensaje.usuario).replace(/^@/, '');
        const puntos = store.getPoints(quien);
        const avisos = store.getWarnings(quien);
        chat.say(`${quien} tiene ${puntos} puntos${avisos ? ` y ${avisos} aviso(s) de moderacion` : ''} 🪙`);
        return true;
      }

      // ---------- CLASIFICACION ----------
      if (es(cmd, CMD.top)) {
        const top = store.top(5);
        if (!top.length) { chat.say('Todavia no hay nadie en el ranking. ¡Jugad una partida! 🎮'); return true; }
        chat.say(`🏆 Ranking: ${top.map((t, i) => `${i + 1}. ${t.usuario} (${t.puntos})`).join(' · ')}`);
        return true;
      }

      // ---------- ESTADO ----------
      if (es(cmd, CMD.estado)) {
        const j = juegos.estado();
        const b = brain.estado();
        chat.say(`Modo conversacion: ${b.modo === 'llm' ? 'IA' : 'local'} · Juegos: ${j.juegos} · Partida: ${j.activa ? `${j.juego} (${j.estado || 'en curso'})` : 'ninguna'} · Puntos en juego: ${store.resumen().puntosTotales}`);
        return true;
      }

      // ---------- CANCELAR PARTIDA ----------
      if (es(cmd, CMD.cancelar)) {
        const s = juegos.estado();
        if (!s.activa) { chat.say('No hay ninguna partida en marcha 🤷'); return true; }
        const puede = esMod || s.iniciadaPor?.toLowerCase() === mensaje.usuarioMin;
        if (!puede) { chat.say(`Solo ${s.iniciadaPor} o un moderador pueden cancelar la partida de ${s.juego}.`); return true; }
        juegos.cancelar('cancelada a mano');
        chat.say(`Partida de ${s.juego} cancelada. ¡Otra vez será! 🎮`);
        return true;
      }

      // ---------- RECORDATORIO DE FOLLOW ----------
      if (es(cmd, CMD.seguir)) {
        chat.say(runtime.mensajeFollow());
        return true;
      }

      // ---------- INFO DEL BOT ----------
      if (es(cmd, CMD.bot)) {
        const b = brain.estado();
        chat.say(`Soy el bot del canal: leo el chat, juego con vosotros y vigilo el lenguaje. Conversacion: ${b.modo === 'llm' ? 'IA' : 'por reglas'}. ${b.ia?.peticiones ? `Consultas a la IA: ${b.ia.peticiones}` : ''}`);
        return true;
      }

      // ---------- COMANDOS SOLO DE MODERADOR ----------
      if (cmd === 'prohibir' || cmd === 'permitir' || cmd === 'listamod' || cmd === 'avisos' || cmd === 'resetavisos') {
        if (!esMod) { chat.say(`@${mensaje.usuario} ese comando es solo para moderadores.`); return true; }
      }

      if (cmd === 'prohibir') {
        const palabra = args.join(' ').trim();
        if (!palabra) { chat.say(`Uso: ${P}prohibir <palabra>`); return true; }
        if (!config.moderation.extraWords.includes(palabra.toLowerCase())) config.moderation.extraWords.push(palabra.toLowerCase());
        moderador.mod.cargar();
        chat.say(`Anadida a la lista de palabras prohibidas: "${palabra}" 🚫`);
        return true;
      }

      if (cmd === 'permitir') {
        const palabra = args.join(' ').trim();
        if (!palabra) { chat.say(`Uso: ${P}permitir <palabra>`); return true; }
        if (!config.moderation.whitelist.includes(palabra.toLowerCase())) config.moderation.whitelist.push(palabra.toLowerCase());
        moderador.mod.cargar();
        chat.say(`"${palabra}" ya no se marcara como ofensiva ✅`);
        return true;
      }

      if (cmd === 'listamod') {
        const n = moderador.mod.prohibidas.length;
        chat.say(`Lista de moderacion: ${n} palabras prohibidas, ${moderador.mod.blanca.size} permitidas. Se editan en src/moderation/*.txt`);
        return true;
      }

      if (cmd === 'avisos') {
        const quien = (args[0] || '').replace(/^@/, '');
        if (!quien) { chat.say(`Uso: ${P}avisos <usuario>`); return true; }
        chat.say(`${quien} acumula ${store.getWarnings(quien)} aviso(s) de moderacion.`);
        return true;
      }

      if (cmd === 'resetavisos') {
        const quien = (args[0] || '').replace(/^@/, '');
        if (!quien) { chat.say(`Uso: ${P}resetavisos <usuario>`); return true; }
        store.resetWarnings(quien);
        chat.say(`Avisos de ${quien} puestos a cero ✅`);
        return true;
      }

      // ---------- AJUSTES EN CALIENTE (solo el streamer) ----------
      if (['ia', 'conversacion', 'promos', 'juegoson'].includes(cmd)) {
        if (!mensaje.esBroadcaster) { chat.say(`@${mensaje.usuario} ese ajuste solo lo puede tocar el streamer.`); return true; }
        const valor = (args[0] || '').toLowerCase();
        const on = valor === 'on' || valor === 'si' || valor === '1';
        const off = valor === 'off' || valor === 'no' || valor === '0';

        if (cmd === 'ia') {
          if (!on && !off) { chat.say(`Uso: ${P}ia on|off  (ahora: ${runtime.modoIA})`); return true; }
          runtime.modoIA = on ? 'llm' : 'local';
          chat.say(`Conversacion cambiada a modo ${on ? 'IA' : 'local'} 🤖`);
          return true;
        }
        if (cmd === 'conversacion') {
          if (!on && !off) { chat.say(`Uso: ${P}conversacion on|off  (ahora: ${brain.cfg.enabled ? 'on' : 'off'})`); return true; }
          brain.cfg.enabled = on;
          chat.say(`El bot ${on ? 'vuelve a hablar' : 'se queda callado'} en el chat 🤐`);
          return true;
        }
        if (cmd === 'promos') {
          if (!on && !off) { chat.say(`Uso: ${P}promos on|off  (ahora: ${runtime.promosActivas ? 'on' : 'off'})`); return true; }
          runtime.promosActivas = on;
          chat.say(`Recordatorios de follow ${on ? 'activados' : 'desactivados'} 💜`);
          return true;
        }
        if (cmd === 'juegoson') {
          if (!on && !off) { chat.say(`Uso: ${P}juegoson on|off  (ahora: ${runtime.juegosActivos ? 'on' : 'off'})`); return true; }
          runtime.juegosActivos = on;
          juegos.cfg.enabled = on;
          chat.say(`Los juegos quedan ${on ? 'activados' : 'desactivados'} 🎮`);
          return true;
        }
      }

      // ---------- FESTEROMETRO ----------
      if (config.festero?.enabled !== false && (cmd === 'festero' || cmd === 'festerometro')) {
        const espera = enEspera('festero:' + mensaje.usuarioMin, config.festero?.esperaSegundos ?? 12);
        if (espera) { chat.say(`@${mensaje.usuario} espera ${espera} s para volver a medirte 😄`); return true; }
        const quien = (args[0] || mensaje.usuario).replace(/^@/, '');
        const pct = festeroDe(quien, config.festero?.bonoPorActividad === false ? null : store);
        chat.say(`${fraseFestera(pct)} @${quien} tiene un ${pct}% de ganas de fiesta ${barraFiesta(pct)}`);
        return true;
      }

      // ---------- PETICIONES DE MUSICA (cola) ----------
      if (config.songrequests?.enabled !== false && ['sr', 'songrequest', 'peticion', 'pedir'].includes(cmd)) {
        const cancion = args.join(' ').trim();
        if (!cancion) { chat.say(`Pide un tema con ${P}sr <cancion>. La cola se ve con ${P}cola 🎵`); return true; }
        if (!config.songrequests?.permitirEnlaces && /https?:\/\/|www\./i.test(cancion)) {
          chat.say(`@${mensaje.usuario} sin enlaces, solo el nombre del tema 🎵`);
          return true;
        }
        const espera = enEspera('sr:' + mensaje.usuarioMin, config.songrequests?.esperaSegundos ?? 90);
        if (espera) { chat.say(`@${mensaje.usuario} ya has pedido hace poco, espera ${espera} s ⏳`); return true; }
        const tope = config.songrequests?.max ?? 20;
        const cola = store.getGlobal('colaSr', []);
        if (cola.length >= tope) { chat.say(`La cola esta llena (${tope}). Prueba mas tarde 🎧`); return true; }
        const limpia = cancion.slice(0, config.songrequests?.largoMaximo ?? 70);
        cola.push({ usuario: mensaje.usuario, cancion: limpia, cuando: Date.now() });
        store.setGlobal('colaSr', cola);
        chat.say(`🎵 Apuntado (#${cola.length}): "${limpia}" pedido por ${mensaje.usuario}`);
        return true;
      }

      if (cmd === 'cola' || cmd === 'queue' || cmd === 'peticiones') {
        const cola = store.getGlobal('colaSr', []);
        if (!cola.length) { chat.say(`La cola está vacía. Pide tu tema con ${P}sr <cancion> 🎵`); return true; }
        const primeras = cola.slice(0, 5).map((c, i) => `${i + 1}. ${c.cancion} (${c.usuario})`).join(' · ');
        chat.say(`🎵 Cola (${cola.length}): ${primeras}${cola.length > 5 ? ' …' : ''}`);
        return true;
      }

      if (cmd === 'siguiente' || cmd === 'next' || cmd === 'ponla') {
        if (!esMod) { chat.say(`@${mensaje.usuario} eso lo lleva el streamer o un moderador 😉`); return true; }
        const cola = store.getGlobal('colaSr', []);
        if (!cola.length) { chat.say('No hay nada en la cola 🎵'); return true; }
        const siguiente = cola.shift();
        store.setGlobal('colaSr', cola);
        chat.say(`▶️ Siguiente: "${siguiente.cancion}" (la pidio ${siguiente.usuario}). Quedan ${cola.length} en cola.`);
        return true;
      }

      if (cmd === 'limpiarcola' || cmd === 'vaciarcola') {
        if (!esMod) { chat.say(`@${mensaje.usuario} eso es solo para moderadores.`); return true; }
        store.setGlobal('colaSr', []);
        chat.say('🧹 Cola de peticiones vaciada.');
        return true;
      }

      // ---------- JUEGO DE BPM ----------
      if (config.bpm?.enabled !== false && (cmd === 'bpmreal' || cmd === 'bpmobjetivo')) {
        if (!esMod) { chat.say(`@${mensaje.usuario} eso lo fija el streamer 🎚️`); return true; }
        const n = parseInt(args[0], 10);
        const min = config.bpm?.min ?? 60;
        const max = config.bpm?.max ?? 200;
        if (!Number.isFinite(n) || n < min || n > max) { chat.say(`Uso: ${P}bpmreal <${min}-${max}>`); return true; }
        store.setGlobal('bpmReal', { valor: n, cuando: Date.now() });
        store.setGlobal('bpmApuestas', {});
        if (config.bpm?.borrarMensaje !== false && moderador.borrar) moderador.borrar(mensaje);
        chat.say(`🎚️ BPM anotado. Decid vuestro numero con ${P}bpm <n> y lo revelo con ${P}bpmfin`);
        return true;
      }

      if (config.bpm?.enabled !== false && cmd === 'bpm') {
        const min = config.bpm?.min ?? 60;
        const max = config.bpm?.max ?? 200;
        const real = store.getGlobal('bpmReal', null);
        if (!real) { chat.say(`Todavía no hay ronda de BPM: el streamer la abre con ${P}bpmreal <n> 🎚️`); return true; }
        const n = parseInt(args[0], 10);
        if (!Number.isFinite(n) || n < min || n > max) { chat.say(`@${mensaje.usuario} dime un numero entre ${min} y ${max} 🎚️`); return true; }
        const apuestas = store.getGlobal('bpmApuestas', {});
        const ya = apuestas[mensaje.usuarioMin];
        apuestas[mensaje.usuarioMin] = { nombre: mensaje.usuario, valor: n };
        store.setGlobal('bpmApuestas', apuestas);
        chat.say(ya
          ? `@${mensaje.usuario} cambias tu numero a ${n} 😏`
          : '🎯 Anotado. Cuando salga el resultado vemos quién se acerca.');
        return true;
      }

      if (config.bpm?.enabled !== false && (cmd === 'bpmfin' || cmd === 'bpmresolver')) {
        if (!esMod) { chat.say(`@${mensaje.usuario} eso lo resuelve el streamer 🎚️`); return true; }
        const real = store.getGlobal('bpmReal', null);
        const apuestas = store.getGlobal('bpmApuestas', {});
        const lista = Object.values(apuestas);
        if (!real || !lista.length) { chat.say('No hay ronda de BPM activa o nadie ha apostado 🎚️'); return true; }
        lista.forEach((a) => { a.distancia = Math.abs(a.valor - real.valor); });
        lista.sort((a, b) => a.distancia - b.distancia);
        const ganador = lista[0];
        const puntos = config.bpm?.puntosGanador ?? 25;
        const cerca = config.bpm?.puntosCerca ?? 8;
        store.addPoints(ganador.nombre, puntos);
        store.addStat(ganador.nombre, 'bpm_ganados', 1);
        if (lista[1] && lista[1].distancia <= 3) store.addPoints(lista[1].nombre, cerca);
        chat.say(`🎚️ ¡Eran ${real.valor} BPM! Gana ${ganador.nombre} diciendo ${ganador.valor} (se fue por ${ganador.distancia}) y se lleva ${puntos} puntos 🏆`);
        if (lista.length > 1) chat.say(`Otros: ${lista.slice(1, 4).map((a) => `${a.nombre} (${a.valor})`).join(' · ')}`);
        store.setGlobal('bpmReal', null);
        store.setGlobal('bpmApuestas', {});
        return true;
      }

      // ---------- BOLA 8 ----------
      if (cmd === '8ball' || cmd === 'bola8') {
        const espera = enEspera('8ball:' + mensaje.usuarioMin, 20);
        if (espera) return true;
        const pregunta = args.join(' ').trim();
        chat.say(`${mensaje.usuario}${pregunta ? ` pregunta "${pregunta.slice(0, 55)}"` : ' pregunta'} → ${RESPUESTAS_8BALL[Math.floor(Math.random() * RESPUESTAS_8BALL.length)]}`);
        return true;
      }

      // ---------- SHOUTOUT ----------
      if (cmd === 'so' || cmd === 'shoutout') {
        const quien = (args[0] || '').replace(/^@/, '');
        if (!quien) { chat.say(`Uso: ${P}so @usuario`); return true; }
        const puntos = store.getPoints(quien);
        chat.say(`📣 ¡Seguid a ${quien}, que se lo merece! 💜${puntos ? ` (por aqui lleva ${puntos} puntos)` : ''}`);
        return true;
      }

      // ---------- TRACKLIST PARA YOUTUBE (arreglado: faltaba el import) ----------
      if (cmd === 'track' || cmd === 'tracklist') {
        if (manejarTrack(cmd, args, { mensaje, esMod, chat, canal })) return true;
      }
      // ---------- METAS EN PANTALLA ----------
      if (cmd === 'meta' || cmd === 'suma' || cmd === 'sumar' || cmd === 'add') {
        if (manejarMetas(cmd, args, { mensaje, esMod, chat })) return true;
      }
      // ---------- CLIPS + HORARIO ----------
      if (cmd === 'clip' || cmd === 'clips' || cmd === 'momentazo' || cmd === 'horario' || cmd === 'horarios' || cmd === 'cuando') {
        if (manejarDirecto(cmd, args, { mensaje, chat, config })) return true;
      }
      // ---------- MULTICHAT (YouTube + Kick) ----------
      if (manejarMultichat(cmd, args, { mensaje, esMod, chat, runtime })) return true;
      // ---------- ARRANCAR UN JUEGO ----------
      const juego = juegos.buscar(cmd);
      if (juego) {
        if (!runtime.juegosActivos) { chat.say('Los juegos están desactivados ahora mismo 😴'); return true; }
        const r = juegos.arrancar(cmd, mensaje, args);
        if (r.ok) return true; // el propio juego ya ha saludado
        if (r.motivo === 'ocupado') { chat.say(`Ahora mismo esta en marcha ${r.juego}. Espera a que acabe 🎮`); return true; }
        if (r.motivo === 'enfriamiento') { chat.say(`Espera ${r.faltan} s antes de volver a jugar a ${r.juego?.name || 'eso'} ⏳`); return true; }
        if (r.motivo === 'desactivado') { chat.say('Ese juego esta desactivado.'); return true; }
        chat.say('No he podido empezar ese juego 😅');
        return true;
      }

      return false; // no era un comando nuestro
    },
  };
}

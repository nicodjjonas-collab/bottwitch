// Comandos del multichat (se llaman desde commands.js).
// Devuelve true si el mensaje era un comando nuestro.

export function manejarMultichat(cmd, args, { mensaje, esMod, chat, runtime }) {
  const puentes = runtime?.puentes;
  const c = String(cmd || '').toLowerCase();

  // ---------- ESTADO ----------
  if (c === 'multichat' || c === 'puente' || c === 'multistream') {
    if (!puentes) { chat.say('El multichat no esta activo en este canal.'); return true; }
    const e = puentes.estado();
    const yt = e.youtube.fase === 'directo' ? `YouTube: en directo${e.youtube.titulo ? ` (${e.youtube.titulo.slice(0, 40)})` : ''}`
      : `YouTube: ${e.youtube.fase}${e.youtube.detalle ? ` (${e.youtube.detalle.slice(0, 60)})` : ''}`;
    const kk = `Kick: ${e.kick.fase}${e.kick.detalle ? ` (${e.kick.detalle.slice(0, 60)})` : ''}`;
    chat.say(`🌉 Multichat · ${yt} · ${kk}`);
    return true;
  }

  // ---------- RESPONDER A YOUTUBE (gasta cuota: solo mods) ----------
  if (c === 'ryt' || c === 'responderyt' || c === 'responder-youtube') {
    if (!puentes) { chat.say('El multichat no esta activo en este canal.'); return true; }
    if (!esMod) { chat.say(`@${mensaje.usuario} responder a YouTube lo lleva el streamer o un moderador 😉`); return true; }
    const texto = (args || []).join(' ').trim();
    if (!texto) {
      const u = puentes.estado().youtube.ultimo?.usuario;
      chat.say(u ? `Uso: !ryt <mensaje> (responde en el chat de YouTube, lo vera ${u})` : 'Uso: !ryt <mensaje> (aun no ha escrito nadie de YouTube)');
      return true;
    }
    puentes.responder('youtube', texto).then((r) => {
      const u = puentes.estado().youtube.ultimo?.usuario || 'YouTube';
      chat.say(r.ok ? `📤 Enviado a YouTube (para ${u}) ✅` : `No pude enviarlo a YouTube: ${r.motivo}`);
    }).catch((e) => {
      chat.say(`No pude enviarlo a YouTube: ${String(e.message || e).slice(0, 120)}`);
    });
    return true;
  }

  // ---------- RESPONDER A KICK (no soportado: solo lectura) ----------
  if (c === 'rk' || c === 'responderkick' || c === 'responder-kick') {
    chat.say('Kick es de solo lectura: te leo desde alli, pero responde desde Kick 🙏');
    return true;
  }

  // ---------- FIJAR VIDEO DE YOUTUBE (streamer/mods) ----------
  if (c === 'ytvideo') {
    if (!puentes) { chat.say('El multichat no esta activo en este canal.'); return true; }
    if (!esMod) { chat.say(`@${mensaje.usuario} eso lo lleva el streamer o un moderador 😉`); return true; }
    const id = (args[0] || '').trim();
    if (!id) {
      const actual = puentes.estado().youtube.videoId || '(autodetectado)';
      chat.say(`Video de YouTube actual: ${actual}. Uso: !ytvideo <id> o !ytvideo off`);
      return true;
    }
    if (/^(off|auto|ninguno)$/i.test(id)) {
      puentes.fijarVideoYT('');
      chat.say('Vale, vuelvo a detectar tu directo de YouTube solo 🔍');
    } else {
      puentes.fijarVideoYT(id);
      chat.say(`Apuntado al video ${id} de YouTube 🎯`);
    }
    return true;
  }

  return false;
}

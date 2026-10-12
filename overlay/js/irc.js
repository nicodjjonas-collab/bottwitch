// =====================================================================
//  Lector de chat de Twitch SIN cuenta y SIN token.
//  Se conecta al IRC por WebSocket con un usuario anonimo ("justinfan..."),
//  que Twitch permite solo para LEER. Asi el overlay funciona sin logins.
// =====================================================================

(function () {
  const URL_IRC = 'wss://irc-ws.chat.twitch.tv:443';

  // Deshace el escapado de IRCv3 en los valores de las etiquetas (tags).
  function desescapar(v) {
    return String(v).replace(/\\([srn\\:])/g, (_, c) => ({ s: ' ', r: '\r', n: '\n', '\\': '\\', ':': ';' }[c]));
  }

  // Convierte una linea cruda de IRC en un objeto. Funcion pura: se puede probar.
  function parsearLinea(cruda) {
    const msg = { crudo: cruda, tags: {}, prefijo: null, comando: '', params: [] };
    let resto = String(cruda);

    if (resto.startsWith('@')) {
      const i = resto.indexOf(' ');
      const trozo = resto.slice(1, i);
      resto = resto.slice(i + 1);
      for (const par of trozo.split(';')) {
        const j = par.indexOf('=');
        if (j === -1) { msg.tags[par] = true; continue; }
        msg.tags[par.slice(0, j)] = desescapar(par.slice(j + 1));
      }
    }
    if (resto.startsWith(':')) {
      const i = resto.indexOf(' ');
      msg.prefijo = resto.slice(1, i);
      resto = resto.slice(i + 1);
    }
    let cola = null;
    const k = resto.indexOf(' :');
    if (k !== -1) { cola = resto.slice(k + 2); resto = resto.slice(0, k); }

    const partes = resto.split(' ').filter(Boolean);
    msg.comando = partes.shift() || '';
    msg.params = partes;
    if (cola !== null) msg.params.push(cola);
    return msg;
  }

  // Convierte un PRIVMSG en el objeto que usa el motor.
  function aMensaje(msg) {
    const t = msg.tags || {};
    const usuario = String(t['display-name'] || (msg.prefijo || '').split('!')[0] || '').trim();
    if (!usuario) return null;
    return {
      usuario,
      usuarioMin: usuario.toLowerCase(),
      texto: msg.params[msg.params.length - 1] || '',
      id: t.id || null,
      color: t.color || null,
      esMod: t.mod === '1',
      esSub: t.subscriber === '1',
      esVip: (t.badges || '').indexOf('vip') !== -1,
      esBroadcaster: (t.badges || '').indexOf('broadcaster') !== -1,
      primeraVez: t['first-msg'] === '1',
      bits: Number(t.bits || 0),
      badges: t.badges || '',
      cuando: Number(t['tmi-sent-ts'] || Date.now())
    };
  }

  window.SA_CHAT = {
    parsearLinea,
    aMensaje,

    // manejadores: { onMensaje, onEvento, onEstado }
    //   onEstado(estado, detalle)  ->  'conectando' | 'conectado' | 'error' | 'reconectando'
    //   onEvento({ tipo, usuario, texto, ... })  ->  'sub' | 'resub' | 'subgift' | 'raid' | 'bits' | 'ban' | 'timeout'
    conectar(canal, manejadores) {
      const h = manejadores || {};
      const aviso = (estado, detalle) => { try { h.onEstado && h.onEstado(estado, detalle); } catch (e) { /* nada */ } };
      const nick = 'justinfan' + Math.floor(10000 + Math.random() * 80000);
      let ws = null;
      let intentos = 0;
      let cerrado = false;
      let temporizador = null;

      function abrir() {
        if (cerrado) return;
        aviso(intentos === 0 ? 'conectando' : 'reconectando');
        try {
          ws = new WebSocket(URL_IRC);
        } catch (e) {
          aviso('error', 'Tu navegador no soporta WebSocket');
          return;
        }

        ws.onopen = function () {
          intentos = 0;
          ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
          ws.send('NICK ' + nick);
          ws.send('JOIN #' + canal);
        };

        ws.onmessage = function (ev) {
          const lineas = String(ev.data).split('\r\n');
          for (const linea of lineas) {
            if (!linea) continue;
            const msg = parsearLinea(linea);
            switch (msg.comando) {
              case 'PING':
                try { ws.send('PONG :tmi.twitch.tv'); } catch (e) { /* nada */ }
                break;
              case '001':
                aviso('conectado', '#' + canal);
                break;
              case 'JOIN':
                aviso('conectado', '#' + canal);
                break;
              case 'PRIVMSG': {
                const m = aMensaje(msg);
                if (!m) break;
                if (m.bits > 0 && h.onEvento) h.onEvento({ tipo: 'bits', usuario: m.usuario, cantidad: m.bits, texto: m.texto });
                if (h.onMensaje) h.onMensaje(m);
                break;
              }
              case 'USERNOTICE': {
                if (!h.onEvento) break;
                const t = msg.tags || {};
                const tipoBruto = t['msg-id'] || '';
                let tipo = tipoBruto;
                if (tipoBruto === 'sub' || tipoBruto === 'resub' || tipoBruto === 'subgift' || tipoBruto === 'anonsubgift' || tipoBruto === 'submysterygift') tipo = tipoBruto;
                else if (tipoBruto === 'raid') tipo = 'raid';
                else tipo = 'otro';
                h.onEvento({
                  tipo,
                  usuario: String(t['display-name'] || t.login || '').trim() || null,
                  texto: t['system-msg'] || '',
                  meses: Number(t['msg-param-cumulative-months'] || 0),
                  cantidad: Number(t['msg-param-mass-gift-count'] || t['msg-param-viewerCount'] || 0)
                });
                break;
              }
              case 'CLEARCHAT': {
                if (!h.onEvento) break;
                // OJO: en IRC los parametros son [canal, usuario]. El usuario
                // viene en params[1], no en params[2] (aqui estaba el fallo:
                // los baneos nunca se detectaban).
                const quien = msg.params[1];
                if (!quien) break; // sin usuario = limpieza total del chat
                h.onEvento({
                  tipo: msg.tags && msg.tags['ban-duration'] ? 'timeout' : 'ban',
                  usuario: quien,
                  segundos: Number((msg.tags && msg.tags['ban-duration']) || 0)
                });
                break;
              }
              case 'RECONNECT':
                try { ws.close(); } catch (e) { /* nada */ }
                break;
              default:
                break;
            }
          }
        };

        ws.onerror = function () { aviso('error', 'No pude conectar con el chat de Twitch'); };

        ws.onclose = function () {
          if (cerrado) return;
          intentos += 1;
          const espera = Math.min(45, Math.round(Math.pow(1.6, intentos)) + 2);
          aviso('reconectando', 'reintento en ' + espera + 's');
          temporizador = setTimeout(abrir, espera * 1000);
        };
      }

      abrir();

      return {
        cerrar() { cerrado = true; clearTimeout(temporizador); try { ws && ws.close(); } catch (e) { /* nada */ } },
        get nick() { return nick; },
        get abierto() { return ws && ws.readyState === 1; }
      };
    }
  };
})();

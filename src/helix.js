// Acciones de moderacion usando la API Helix de Twitch (la forma oficial y soportada).
// Borrar mensajes y sancionar usuarios requiere que la cuenta del bot sea MODERADORA del canal
// y que el token tenga los permisos:
//    moderator:manage:chat_messages   (borrar mensajes)
//    moderator:manage:banned_users    (timeout / ban)

import { logger } from './logger.js';

export function crearHelix({ clientId, token }) {
  const limpioToken = String(token || '').replace(/^oauth:/, '');
  const listo = Boolean(clientId && limpioToken);
  // Cache de "esta en directo": no hace falta preguntar a Twitch cada vez
  let cacheDirecto = { login: null, cuando: 0, valor: null };

  async function llamar(ruta, opciones = {}) {
    if (!listo) return { ok: false, error: 'Helix sin clientId o token' };
    const url = ruta.startsWith('http') ? ruta : `https://api.twitch.tv/helix/${ruta}`;
    try {
      const resp = await fetch(url, {
        ...opciones,
        headers: {
          'Client-Id': clientId,
          Authorization: `Bearer ${limpioToken}`,
          'Content-Type': 'application/json',
          ...(opciones.headers || {}),
        },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.status === 204) return { ok: true, datos: null };
      const cuerpo = await resp.json().catch(() => null);
      if (!resp.ok) {
        logger.warn(`Helix ${opciones.method || 'GET'} ${ruta} -> ${resp.status} ${cuerpo?.message || ''}`);
        return { ok: false, error: cuerpo?.message || `HTTP ${resp.status}`, estado: resp.status };
      }
      return { ok: true, datos: cuerpo };
    } catch (e) {
      logger.warn(`Fallo llamando a Helix (${ruta}): ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  return {
    listo,
    llamar,

    // Devuelve { id, login, display_name } o null
    async usuario(login) {
      const r = await llamar(`users?login=${encodeURIComponent(String(login).toLowerCase())}`);
      return r.ok && r.datos?.data?.length ? r.datos.data[0] : null;
    },

    // Borra un mensaje concreto del chat
    async borrarMensaje(broadcasterId, moderatorId, messageId) {
      if (!messageId) return { ok: false, error: 'sin id de mensaje' };
      return llamar(
        `moderation/chat?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}&message_id=${encodeURIComponent(messageId)}`,
        { method: 'DELETE' },
      );
    },

    // Sanciona (timeout) a un usuario. duration en segundos.
    async sancionar(broadcasterId, moderatorId, userId, duración, motivo = '') {
      if (!userId) return { ok: false, error: 'sin id de usuario' };
      const cuerpo = { data: { user_id: String(userId), reason: String(motivo).slice(0, 500) } };
      if (duración && duración > 0) cuerpo.data.duration = Number(duración);
      return llamar(`moderation/banned?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}`, {
        method: 'POST',
        body: JSON.stringify(cuerpo),
      });
    },

    // Ban permanente
    async banear(broadcasterId, moderatorId, userId, motivo = '') {
      return this.sancionar(broadcasterId, moderatorId, userId, null, motivo);
    },

    // Permite comprobar de forma sencilla si el token sigue siendo valido
    async validarToken() {
      const r = await llamar('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${limpioToken}` },
      });
      return r.ok ? r.datos : null;
    },

    // ¿El canal esta emitiendo ahora mismo?
    // Endpoint publico: no necesita permisos extra. Devuelve true/false, o null
    // si no se puede saber (así nunca bloqueamos nada por un fallo de red).
    async estaEnDirecto(login) {
      if (!listo || !login) return null;
      const ahora = Date.now();
      if (cacheDirecto.login === login && ahora - cacheDirecto.cuando < 120000) return cacheDirecto.valor;

      const r = await llamar(`streams?user_login=${encodeURIComponent(String(login).toLowerCase())}`);
      if (!r.ok) return null;
      const valor = Array.isArray(r.datos?.data) && r.datos.data.length > 0;
      cacheDirecto = { login, cuando: ahora, valor };
      return valor;
    },
  };
}

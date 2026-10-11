// Cerebro con IA (LLM) para conversacion de verdad, siguiendo el contexto.
// Funciona con cualquier proveedor compatible con la API de OpenAI:
//   Groq, OpenAI, DeepSeek, OpenRouter, Gemini (endpoint compatible) y Ollama (local).
// Toda la conversacion se manda con el historial reciente para que "siga el hilo".

import { logger } from '../logger.js';

export function crearLLM({ cfg, logger: log = logger }) {
  const preset = cfg.presets?.[cfg.provider] || {};
  const baseUrl = (cfg.baseUrl || preset.baseUrl || '').replace(/\/+$/, '');
  const model = cfg.model || preset.model || '';
  const clave = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const esLocal = /127\.0\.0\.1|localhost/.test(baseUrl);

  const configurado = Boolean(baseUrl && model && (clave || esLocal));
  const estado = {
    activo: configurado,
    motivo: configurado ? 'listo' : (!baseUrl ? 'falta baseUrl' : !model ? 'falta model' : 'falta LLM_API_KEY en .env'),
    peticiones: 0,
    errores: 0,
    ultimoError: null,
    modeloUsado: null,
    presupuestoAgotado: false,
  };

  // Cadena de modelos: si el primero se satura (429) o falla, se prueba el siguiente.
  // Groq da cuota separada a cada modelo, asi que sirve de red de seguridad.
  const modelos = [];
  for (const m of [model, ...(Array.isArray(cfg.models) ? cfg.models : [])]) {
    if (m && !modelos.includes(m)) modelos.push(m);
  }

  // Presupuesto diario para no agotar la capa gratuita a mitad de directo
  let presupuesto = { dia: new Date().toISOString().slice(0, 10), usadas: 0 };
  function hayPresupuesto() {
    const hoy = new Date().toISOString().slice(0, 10);
    if (presupuesto.dia !== hoy) presupuesto = { dia: hoy, usadas: 0 };
    const tope = cfg.maxPeticionesPorDia ?? 800;
    if (presupuesto.usadas >= tope) {
      if (!estado.presupuestoAgotado) {
        estado.presupuestoAgotado = true;
        log.warn(`La IA ha llegado al tope de ${tope} peticiones de hoy. Sigo con el cerebro local hasta manana.`);
      }
      return false;
    }
    return true;
  }

  if (configurado) {
    log.ok(`Cerebro IA configurado: ${cfg.provider} / ${modelos.join(' -> ')}`);
  } else {
    log.warn(`Cerebro IA NO configurado (${estado.motivo}). Se usara el modo local.`);
  }

  // Una llamada al proveedor. Devuelve { ok, texto } o { ok:false, reintentar }
  async function pedir(modelo, mensajes, { maxTokens, temperature } = {}) {
    const cuerpo = {
      model: modelo,
      messages: mensajes,
      temperature: temperature ?? cfg.temperature ?? 0.85,
      max_tokens: maxTokens ?? cfg.maxTokens ?? 140,
      stream: false,
    };
    // Los modelos de razonamiento (gpt-oss) se gastan parte de los tokens
    // pensando; con "low" piensan menos y responden mas rápido y barato.
    if (cfg.reasoningEffort) cuerpo.reasoning_effort = cfg.reasoningEffort;
    try {
      estado.peticiones += 1;
      presupuesto.usadas += 1;
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clave ? { Authorization: `Bearer ${clave}` } : {}),
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 15000),
      });

      if (!resp.ok) {
        const detalle = await resp.text().catch(() => '');
        estado.errores += 1;
        estado.ultimoError = `HTTP ${resp.status}: ${detalle.slice(0, 180)}`;
        // 429 (limite) y 5xx merecen probar el siguiente modelo; 4xx no
        const reintentar = resp.status === 429 || resp.status >= 500;
        log.warn(`La IA fallo con ${modelo} (${estado.ultimoError}).${reintentar ? ' Pruebo otro modelo.' : ''}`);
        return { ok: false, reintentar };
      }

      const json = await resp.json();
      const bruto = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || '';
      // Quitamos espacios, comillas y prefijos tipo "Bot:" antes de nada, porque
      // los modelos suelen envolver la respuesta en comillas
      const texto = String(bruto)
        .trim()
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/^\s*(bot|asistente|assistant)\s*:\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!texto) {
        const razon = json?.choices?.[0]?.finish_reason || 'sin contenido';
        const penso = Boolean(json?.choices?.[0]?.message?.reasoning);
        estado.errores += 1;
        estado.ultimoError = `respuesta vacia (${razon})${penso ? ' - el modelo gasto los tokens razonando' : ''}`;
        log.warn(`La IA devolvio una respuesta vacia (${razon}).${penso ? ' Es un modelo de razonamiento: sube maxTokens.' : ''}`);
        return { ok: false, reintentar: true };
      }
      estado.modeloUsado = modelo;
      return { ok: true, texto };
    } catch (e) {
      estado.errores += 1;
      estado.ultimoError = e.name === 'TimeoutError' ? 'tiempo de espera agotado' : e.message;
      log.warn(`La IA no respondio (${estado.ultimoError}).${/timeout/i.test(e.name || '') ? ' Pruebo otro modelo.' : ''}`);
      return { ok: false, reintentar: e.name === 'TimeoutError' || e.name === 'AbortError' };
    }
  }

  // Prueba los modelos en orden hasta que uno conteste
  async function completar(mensajes, opciones) {
    if (!configurado || !hayPresupuesto()) return null;
    for (const modelo of modelos) {
      const r = await pedir(modelo, mensajes, opciones);
      if (r.ok) return r.texto;
      if (!r.reintentar) break;
    }
    return null;
  }

  async function responder({ contexto, mensaje, usuario, extra }) {
    if (!configurado) return null;

    // Historial reciente en formato de conversacion (hilos largos: hasta 25)
    const historial = (contexto || [])
      .slice(-25)
      .map((m) => ({
        role: m.deBot ? 'assistant' : 'user',
        content: m.deBot ? m.texto : `${m.usuario}: ${m.texto}`,
      }));

    const sistema = [
      cfg.systemPrompt || 'Eres un bot de chat de Twitch. Responde en espanol, corto y con gracia.',
      extra ? `Contexto adicional: ${extra}` : '',
      'Responde SOLO con el mensaje de chat, sin comillas ni prefijos. Maximo 200 caracteres.',
    ].filter(Boolean).join(' ');

    // Si el ultimo mensaje del historial ya es el actual, no lo repetimos
    const ultimo = historial[historial.length - 1];
    if (!ultimo || ultimo.content !== `${usuario}: ${mensaje}`) {
      historial.push({ role: 'user', content: `${usuario}: ${mensaje}` });
    }

    return completar([{ role: 'system', content: sistema }, ...historial]);
  }

  // Mensaje para animar un chat parado (lo pide el modulo de promociones)
  async function ambiente({ contexto } = {}) {
    if (!configurado) return null;
    const sistema = [
      cfg.promptAmbiente || 'Escribe un mensaje corto para animar un chat de Twitch que esta callado.',
      'Responde SOLO con el mensaje de chat, sin comillas ni prefijos. Maximo 160 caracteres.',
    ].join(' ');

    const historial = (contexto || [])
      .slice(-6)
      .filter((m) => m && m.texto)
      .map((m) => ({ role: m.deBot ? 'assistant' : 'user', content: m.deBot ? m.texto : `${m.usuario}: ${m.texto}` }));

    return completar([
      { role: 'system', content: sistema },
      ...historial,
      { role: 'user', content: 'Escribe ahora el mensaje para animar el chat.' },
    ], { maxTokens: Math.max(cfg.maxTokens ?? 400, 250), temperature: cfg.temperatureAmbiente ?? 1.05 });
  }

  return {
    responder,
    ambiente,
    estado,
    configurado,
    get presupuesto() { return { ...presupuesto, tope: cfg.maxPeticionesPorDia ?? 800 }; },
  };
}

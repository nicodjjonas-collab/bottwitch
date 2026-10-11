// =====================================================================
//  LICENCIAS: quién puede usar el bot en la nube.
//  - Tu canal y kokodeejay: gratis (propio / licencia free sin caducar).
//  - Clientes de pago: licencia con plan + caducidad, vinculada a su canal.
//  - Sin exigirLicencia (config.comercial), todo funciona como antes.
//  Archivo: config/licencias.json  [{key, plan, canal, expira, activa, nota}]
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function archivo(RAIZ) { return path.join(RAIZ, 'config', 'licencias.json'); }

function leer(RAIZ) {
  try {
    const l = JSON.parse(fs.readFileSync(archivo(RAIZ), 'utf8'));
    return Array.isArray(l) ? l : [];
  } catch { return []; }
}

function escribir(RAIZ, lista) {
  fs.mkdirSync(path.dirname(archivo(RAIZ)), { recursive: true });
  fs.writeFileSync(archivo(RAIZ), JSON.stringify(lista, null, 2), 'utf8');
}

export function crearLicencia(RAIZ, { plan = 'basico', canal = null, dias = 30, nota = '' }) {
  const lista = leer(RAIZ);
  const key = `BOTDJ-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const reg = {
    key,
    plan,
    canal: canal ? String(canal).toLowerCase() : null,
    expira: dias > 0 ? Date.now() + dias * 86400000 : 0,  // 0 = sin caducidad
    activa: true,
    nota,
    creada: new Date().toISOString().slice(0, 10),
  };
  lista.push(reg);
  escribir(RAIZ, lista);
  return reg;
}

export function listarLicencias(RAIZ) { return leer(RAIZ); }

export function revocarLicencia(RAIZ, key) {
  const lista = leer(RAIZ);
  const l = lista.find((x) => x.key === key);
  if (!l) return false;
  l.activa = false;
  escribir(RAIZ, lista);
  return true;
}

export function vincularLicencia(RAIZ, key, canal) {
  const lista = leer(RAIZ);
  const l = lista.find((x) => x.key === key);
  if (!l) return null;
  l.canal = String(canal).toLowerCase();
  escribir(RAIZ, lista);
  return l;
}

// ¿Puede este canal estar en marcha? Devuelve {ok, plan, motivo}
export function validarCanal(RAIZ, channelCfg, exigir) {
  if (channelCfg.propio) return { ok: true, plan: channelCfg.plan || 'full', motivo: 'propio' };
  if (!exigir) return { ok: true, plan: channelCfg.plan || 'full', motivo: 'sin exigir' };
  const lista = leer(RAIZ);
  const l = lista.find((x) => x.activa && x.canal && x.canal === channelCfg.channel);
  if (!l) return { ok: false, plan: null, motivo: 'sin licencia vinculada' };
  if (l.expira && Date.now() > l.expira) return { ok: false, plan: null, motivo: 'licencia caducada' };
  return { ok: true, plan: l.plan || channelCfg.plan || 'full', motivo: 'licencia ' + l.key };
}

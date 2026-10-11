// Almacen de datos en JSON: puntos, avisos y estadisticas de cada usuario.
// Guarda en disco con retardo (debounce) y escritura atomica para no corromper el archivo.

import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

function vacio() {
  return { version: 1, creado: new Date().toISOString(), usuarios: {}, global: {} };
}

export class Store {
  constructor({ file, debounceMs = 4000 } = {}) {
    this.file = file;
    this.debounceMs = debounceMs;
    this.timer = null;
    this.sucio = false;
    this.data = vacio();
    this.cargar();
  }

  cargar() {
    try {
      if (fs.existsSync(this.file)) {
        const crudo = fs.readFileSync(this.file, 'utf8');
        const json = JSON.parse(crudo);
        if (json && typeof json === 'object' && json.usuarios) {
          this.data = json;
          const n = Object.keys(json.usuarios).length;
          logger.info(`Datos cargados: ${n} usuario(s) conocidos.`);
        }
      } else {
        logger.info('No habia datos previos; empiezo de cero.');
      }
    } catch (e) {
      logger.warn(`No pude leer ${this.file} (${e.message}). Empiezo de cero y guardo una copia rota.`);
      try { fs.copyFileSync(this.file, `${this.file}.roto`); } catch { /* da igual */ }
      this.data = vacio();
    }
  }

  guardar(forzar = false) {
    if (!forzar) {
      this.sucio = true;
      if (this.timer) return;
      this.timer = setTimeout(() => { this.timer = null; this.guardar(true); }, this.debounceMs);
      return;
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
      this.sucio = false;
    } catch (e) {
      logger.error(`No pude guardar los datos: ${e.message}`);
    }
  }

  usuario(nombre) {
    const clave = String(nombre || '').toLowerCase();
    if (!this.data.usuarios[clave]) {
      this.data.usuarios[clave] = {
        puntos: 0, avisos: 0, mensajes: 0, stats: {},
        primeraVez: new Date().toISOString(), ultimaVez: null, nombreVisible: nombre,
      };
    }
    const u = this.data.usuarios[clave];
    if (nombre) u.nombreVisible = nombre;
    return u;
  }

  // ---- puntos ----
  getPoints(nombre) { return this.usuario(nombre).puntos; }

  addPoints(nombre, cantidad) {
    const u = this.usuario(nombre);
    u.puntos = Math.max(0, u.puntos + Number(cantidad || 0));
    this.guardar();
    return u.puntos;
  }

  // ---- estadisticas libres ----
  addStat(nombre, clave, cantidad = 1) {
    const u = this.usuario(nombre);
    u.stats[clave] = (u.stats[clave] || 0) + Number(cantidad);
    this.guardar();
    return u.stats[clave];
  }

  getStat(nombre, clave) { return this.usuario(nombre).stats[clave] || 0; }

  // ---- valores globales del canal (cola de peticiones, bpm, hype...) ----
  getGlobal(clave, porDefecto = null) {
    if (!this.data.global) this.data.global = {};
    const v = this.data.global[clave];
    return v === undefined ? porDefecto : v;
  }

  setGlobal(clave, valor) {
    if (!this.data.global) this.data.global = {};
    this.data.global[clave] = valor;
    this.guardar();
    return valor;
  }

  // ---- avisos de moderacion ----
  warn(nombre) {
    const u = this.usuario(nombre);
    u.avisos += 1;
    u.ultimoAviso = new Date().toISOString();
    this.guardar();
    return u.avisos;
  }

  getWarnings(nombre) { return this.usuario(nombre).avisos; }

  resetWarnings(nombre) {
    const u = this.usuario(nombre);
    u.avisos = 0;
    this.guardar();
  }

  // ---- actividad ----
  markSeen(nombre) {
    const u = this.usuario(nombre);
    const primeraVez = u.mensajes === 0;
    u.mensajes += 1;
    u.ultimaVez = new Date().toISOString();
    this.guardar();
    return { primeraVez, mensajes: u.mensajes };
  }

  // ---- clasificacion ----
  top(cantidad = 5) {
    return Object.entries(this.data.usuarios)
      .map(([clave, u]) => ({ usuario: u.nombreVisible || clave, puntos: u.puntos, mensajes: u.mensajes, avisos: u.avisos }))
      .sort((a, b) => b.puntos - a.puntos || b.mensajes - a.mensajes)
      .slice(0, cantidad);
  }

  resumen() {
    const usuarios = Object.values(this.data.usuarios);
    return {
      usuarios: usuarios.length,
      puntosTotales: usuarios.reduce((s, u) => s + u.puntos, 0),
      mensajesTotales: usuarios.reduce((s, u) => s + u.mensajes, 0),
    };
  }

  cerrar() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.guardar(true);
  }
}

// Pequeño ayudante para ficheros JSON sueltos (memoria de conversacion, etc.)
export function leerJson(file, porDefecto = null) {
  try {
    if (!fs.existsSync(file)) return porDefecto;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return porDefecto; }
}

export function escribirJson(file, datos) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(datos, null, 2), 'utf8');
    fs.renameSync(`${file}.tmp`, file);
    return true;
  } catch (e) {
    logger.warn(`No pude escribir ${file}: ${e.message}`);
    return false;
  }
}

// =====================================================================
//  DATOS EN VIVO para la IA: hora, clima, cripto, divisas, bolsa y titulares.
//  Todo con APIs gratuitas SIN clave. Si algo falla o tarda, devuelve null
//  y la IA responde con lo que sabe: el chat NUNCA se bloquea por esto.
//  La IA está en modo libre: opina de todo (actualidad, política, finanzas...)
//  con las únicas líneas rojas de insultos/odio, datos personales, contenido
//  sexual y delitos (más el filtro de moderación, que sigue activo).
// =====================================================================

const TIMEOUT = 3500;

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function getTexto(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

const fmtEUR = (n, dec = 2) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: dec }).format(n);
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n)}%`;

const CLIMA_TXT = {
  0: 'despejado', 1: 'casi despejado', 2: 'algo nublado', 3: 'cubierto',
  45: 'con niebla', 48: 'con niebla y escarcha', 51: 'con llovizna',
  53: 'con llovizna', 55: 'con llovizna fuerte', 61: 'lloviendo',
  63: 'lloviendo', 65: 'lloviendo fuerte', 71: 'nevando', 73: 'nevando',
  75: 'nevando fuerte', 80: 'con chubascos', 81: 'con chubascos', 82: 'con chubascos fuertes',
  95: 'con tormenta', 96: 'con tormenta y granizo', 99: 'con tormenta y granizo',
};

const CRIPTO = {
  bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum',
  solana: 'solana', sol: 'solana', ripple: 'ripple', xrp: 'ripple',
  dogecoin: 'dogecoin', doge: 'dogecoin', cardano: 'cardano', ada: 'cardano',
  litecoin: 'litecoin', ltc: 'litecoin', avalanche: 'avalanche', avax: 'avalanche',
  chainlink: 'chainlink', link: 'chainlink', polygon: 'polygon', matic: 'polygon',
  tether: 'tether', usdt: 'tether',
};
const CRIPTO_NOMBRE = { bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana', ripple: 'XRP', dogecoin: 'Dogecoin', cardano: 'Cardano', litecoin: 'Litecoin', avalanche: 'Avalanche', chainlink: 'Chainlink', polygon: 'Polygon', tether: 'Tether' };

const DIVISAS = {
  'dolar': 'USD', 'dólar': 'USD', 'dolares': 'USD', 'dólares': 'USD', '$': 'USD', usd: 'USD',
  euro: 'EUR', euros: 'EUR', '€': 'EUR', eur: 'EUR',
  libra: 'GBP', libras: 'GBP', gbp: 'GBP', yen: 'JPY', yenes: 'JPY', jpy: 'JPY',
  franco: 'CHF', francos: 'CHF', chf: 'CHF', real: 'BRL', reales: 'BRL', brl: 'BRL',
};

const BOLSA = {
  ibex: '^IBEX', 'ibex 35': '^IBEX', nasdaq: '^NDQ', sp500: '^SPX', 's&p': '^SPX', 's&p 500': '^SPX',
  dow: '^DJI', 'dow jones': '^DJI', oro: 'GC=F', petroleo: 'BZ=F', 'petróleo': 'BZ=F', brent: 'BZ=F',
  santander: 'SAN.MC', telefonica: 'TEF.MC', 'telefónica': 'TEF.MC', bbva: 'BBVA.MC', iberdrola: 'IBE.MC',
  apple: 'AAPL.US', tesla: 'TSLA.US', nvidia: 'NVDA.US', microsoft: 'MSFT.US', amazon: 'AMZN.US', google: 'GOOGL.US', meta: 'META.US',
};

// Detecta si el mensaje pide algo que hay que mirar en vivo (puro, sin red).
export function detectarVivo(texto) {
  const t = ` ${(texto || '').toLowerCase()} `;
  if (/(qu[eé] hora es|qu[eé] d[ií]a es|en qu[eé] d[ií]a estamos|qu[eé] fecha)/.test(t)) {
    return { tipo: 'hora' };
  }
  const climaM = t.match(/(clima|tiempo|temperatura|llueve|llover[aá]|lluvia|fr[ií]o|calor|grados|paraguas)/);
  if (climaM) {
    const enM = t.match(/en ([a-záéíóúñü][a-záéíóúñü\s-]{1,30}?)(?:\?|$| hoy| ma[ñn]ana| este| el)/);
    const ciudad = enM ? enM[1].trim().replace(/\s+(hoy|ahora|all[ií])$/, '') : null;
    return { tipo: 'clima', ciudad };
  }
  for (const [k, id] of Object.entries(CRIPTO)) {
    if (new RegExp(`\\b${k.replace('$', '\\$')}\\b`).test(t) && /(precio|cu[aá]nto|cotiza|vale|est[aá]|sube|baja)/.test(t)) {
      return { tipo: 'cripto', id, nombre: CRIPTO_NOMBRE[id] || id };
    }
  }
  const mon1 = Object.keys(DIVISAS).find((k) => new RegExp(`(^|\\W)${k.replace('$', '\\$').replace('€', '€')}(\\W|$)`).test(t));
  if (mon1 && /(cu[aá]nto|cambio|cotiza|vale|precio|est[aá]|cambio)/.test(t)) {
    return { tipo: 'divisa', de: DIVISAS[mon1] };
  }
  for (const k of Object.keys(BOLSA).sort((a, b) => b.length - a.length)) {
    if (t.includes(k) && /(cu[aá]nto|cotiza|bolsa|vale|est[aá]|\bva\b|\bvan\b|puntos|sube|baja|cierre)/.test(t)) {
      return { tipo: 'bolsa', ticker: BOLSA[k], nombre: k };
    }
  }
  const tickM = t.match(/\$([a-z]{1,5})\b/);
  if (tickM && /(cu[aá]nto|cotiza|vale|\bva\b|acci[oó]n)/.test(t)) {
    return { tipo: 'bolsa', ticker: `${tickM[1].toUpperCase()}.US`, nombre: tickM[1].toUpperCase() };
  }
  if (/(noticia|noticias|última hora|ultima hora|titular|qu[eé] pas[oó]|ha pasado|qui[eé]n gan[oó]|resultado)/.test(t)) {
    const q = texto.replace(/[?!¡¿]/g, '').trim().slice(0, 80);
    return { tipo: 'noticia', q };
  }
  return null;
}

async function datoHora() {
  const f = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return `En España ahora mismo es ${f.format(new Date())} (hora peninsular).`;
}

async function datoClima(ciudad) {
  const lugar = ciudad || 'Madrid';
  const g = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(lugar)}&count=1&language=es&format=json`);
  const sitio = g?.results?.[0];
  if (!sitio) return null;
  const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${sitio.latitude}&longitude=${sitio.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
  const c = w?.current;
  if (!c) return null;
  const cielo = CLIMA_TXT[c.weather_code] ?? 'estable';
  return `En ${sitio.name} ahora: ${Math.round(c.temperature_2m)}°C ${cielo} (sensación ${Math.round(c.apparent_temperature)}°C), humedad ${c.relative_humidity_2m}%, viento ${Math.round(c.wind_speed_10m)} km/h.`;
}

async function datoCripto(id, nombre) {
  const j = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=eur,usd&include_24hr_change=true`);
  const p = j?.[id];
  if (!p?.eur) return null;
  return `${nombre}: ${fmtEUR(p.eur)} € (${fmtEUR(p.usd, 0)} $, ${fmtPct(p.eur_24h_change || 0)} hoy).`;
}

async function datoDivisa(de) {
  // Caso general: X -> EUR y vuelta
  const j1 = await getJson(`https://api.frankfurter.app/latest?from=${de}&to=EUR`).catch(() => null);
  const j2 = await getJson(`https://api.frankfurter.app/latest?from=EUR&to=${de}`).catch(() => null);
  const partes = [];
  if (j1?.rates?.EUR) partes.push(`1 ${de} = ${fmtEUR(j1.rates.EUR, 4)} €`);
  if (j2?.rates?.[de]) partes.push(`1 € = ${fmtEUR(j2.rates[de], de === 'JPY' ? 2 : 4)} ${de}`);
  return partes.length ? `${partes.join('. ')}.` : null;
}

async function datoBolsa(ticker, nombre) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const m = j?.chart?.result?.[0]?.meta;
  const precio = Number(m?.regularMarketPrice);
  const previo = Number(m?.chartPreviousClose ?? m?.previousClose);
  if (!isFinite(precio) || precio <= 0) return null;
  const cambio = isFinite(previo) && previo > 0 ? ((precio - previo) / previo) * 100 : 0;
  const esIndice = ticker.startsWith('^') || ticker.endsWith('=F');
  return `${nombre}${esIndice ? ' (índice)' : ` (${ticker})`}: ${fmtEUR(precio)}${esIndice && !ticker.endsWith('=F') ? ' puntos' : ''} (${fmtPct(cambio)} hoy).`;
}

async function datoNoticia(q) {
  const j = await getJson(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&lang=es-es`);
  const txt = (j?.AbstractText || '').trim();
  if (txt) return `Te cuento lo que encuentro ahora mismo: ${txt.slice(0, 220)}`;
  const rel = j?.RelatedTopics?.[0];
  const t2 = (rel?.Text || '').trim();
  if (t2) return `Esto encuentro ahora mismo: ${t2.slice(0, 220)}`;
  return null;
}

// Entrada principal: devuelve texto listo para la IA, o null.
export async function datoEnVivo(texto) {
  let pet;
  try { pet = detectarVivo(texto); } catch { return null; }
  if (!pet) return null;
  try {
    const carrera = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), TIMEOUT))]);
    switch (pet.tipo) {
      case 'hora': return await datoHora();
      case 'clima': return await carrera(datoClima(pet.ciudad));
      case 'cripto': return await carrera(datoCripto(pet.id, pet.nombre));
      case 'divisa': return await carrera(datoDivisa(pet.de));
      case 'bolsa': return await carrera(datoBolsa(pet.ticker, pet.nombre));
      case 'noticia': return await carrera(datoNoticia(pet.q));
      default: return null;
    }
  } catch { return null; }
}

// Sonda LocalSend: busca receptores en la red local (sin enviar nada).
// Uso: node src/localsend-sonda.mjs [ip1 ip2 ...]
import https from 'node:https';

function getInfo(ip) {
  return new Promise((resolve) => {
    const req = https.get({
      host: ip, port: 53317, path: '/api/localsend/v2/info',
      timeout: 4000, rejectUnauthorized: false,
    }, (res) => {
      let cuerpo = '';
      res.on('data', (d) => { cuerpo += d; });
      res.on('end', () => {
        try {
          const j = JSON.parse(cuerpo);
          resolve({ ip, ok: true, alias: j.alias, modelo: j.deviceModel, tipo: j.deviceType });
        } catch { resolve({ ip, ok: false }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ip, ok: false }); });
    req.on('error', () => resolve({ ip, ok: false }));
  });
}

const ips = process.argv.slice(2);
const lista = ips.length ? ips : ['192.168.18.9', '192.168.18.91'];
for (const ip of lista) {
  const r = await getInfo(ip);
  console.log(r.ok ? `SI: ${r.ip} = "${r.alias}" (${r.modelo || ''} ${r.tipo || ''})` : `no: ${r.ip}`);
}

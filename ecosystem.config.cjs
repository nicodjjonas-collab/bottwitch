// PM2: mantiene el bot 24/7 (lo reinicia solo si falla o si se reinicia el servidor).
// Uso en el servidor:
//   npm install -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup   (seguir lo que diga el comando)
// Ver estado:  pm2 status | pm2 logs twitchbot
module.exports = {
  apps: [{
    name: 'twitchbot',
    script: 'npm',
    args: 'start',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 20,
    min_uptime: '30s',
    max_memory_restart: '500M',
    time: true,
  }],
};

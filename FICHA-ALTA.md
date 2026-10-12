# 📋 Alta de un canal (un bot para todos: sesionesoldschool)

## Lo único que necesito del streamer
- [ ] **Canal de Twitch** (sin @): _______________
- [ ] **Plan**: basico / full
- [ ] Que ponga al bot de mod en su chat: `/mod sesionesoldschool`
      (sin esto habla y juega igual, pero no puede borrar ni sancionar)

## Alta (lo hago yo, 1 min, sin pedirle nada más)
1. `node src/auth.js --alta=CANAL --plan=full`
2. Reinicio el bot (lee los canales al arrancar; en el PC 24/7 con PM2: `pm2 restart twitchbot`).
3. Compruebo `!ayuda` en su chat.
4. Le paso su link del overlay (nada que instalar):
   `https://TU-BOT/overlay/avatares.html?canal=CANAL` → en OBS: fuente de navegador.
   Más `!skin` y el link de su panel para los parámetros.

## Precios (ejemplo, a definir)
- Básico: chat + juegos + moderación.
- Full: + IA conversacional + promos + overlay + liga.
- Tu canal (jonasrdb) y kokodeejay: **gratis**.

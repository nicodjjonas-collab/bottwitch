# ☁️ Servidor real GRATIS (Render + vigilancia) — sin tarjeta

> Cómo funciona: Render te deja un servicio gratis (750 h/mes = cubre el mes
> entero para UN bot). Se duerme a los 15 min sin visitas: lo mantenemos
> despierto con un vigilante gratis que lo llama cada 5 min.

## 1. Sube el bot a GitHub (privado vale)

```powershell
cd C:\TwitchBot
git init; git add src config.json package.json .node-version render.yaml ecosystem.config.cjs
git commit -m "BotDJ"
# crea el repo privado en github.com/new y:
git remote add origin https://github.com/TU_USUARIO/botdj.git
git push -u origin main
```

⚠️ Revisa que NO subes `.env`, `config/canales.json` ni `src/data`
(ponlos en `.gitignore`, ya viene preparado; los tokens van en variables).

## 2. Crea el servicio en Render (5 min, sin tarjeta)

1. Entra en **https://render.com** (regístrate con GitHub).
2. *New → Blueprint* → elige tu repo `botdj` (lee `render.yaml` solo).
3. Rellena las variables:
   - `LLM_API_KEY` → tu clave `gsk_...` de Groq.
   - `CANALES_JSON` → la lista de canales, ej:
     `[{"channel":"jonasrdb","bot":"sesionesoldschool","clientId":"...","token":"...","refreshToken":"...","plan":"full","propio":true}]`
     (saca los valores de tu `config/canales.json`; el token empieza por dentro, sin `oauth:`).
   - `TWITCH_CLIENT_SECRET` → (opcional, para login en el panel).
4. *Deploy*. Te da una URL: `https://botdj.onrender.com`.

## 3. Que no se duerma (UptimeRobot, gratis)

1. Regístrate en **https://uptimerobot.com** (gratis).
2. *Add New Monitor* → tipo HTTP(s), URL `https://botdj.onrender.com/api/estado`, cada **5 minutos**.
3. Activa el aviso por email/Telegram: si cae, te enteras.

## 4. Enlaza tu app de Twitch

En https://dev.twitch.tv/console/apps añade a URLs de redirección:
`https://botdj.onrender.com/auth/callback` (más la de localhost que ya tenías).

## 5. Copia de seguridad (los puntos)

Render **borra archivos** en cada despliegue: los puntos vivirían en RAM de disco.
- Descarga copia cuando quieras: como admin, abre
  `https://botdj.onrender.com/api/backup` y guárdalo.
- Si algún día hay 10+ canales con liga seria, toca base de datos
  (Supabase gratis) — lo montamos entonces, no antes.

## Límites honestos

- 1 servicio gratis = 750 h/mes: da para el bot 24/7. El segundo servicio ya paga.
- Arranque en frío tras despliegue: ~1 min.
- Si Render cambiara lo gratis, el plan B sigue siendo tu PC 24/7 (ya funciona).

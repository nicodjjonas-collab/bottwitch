# 🌐 Publicar la web BotDJ (portada + panel + admin)

La web va DENTRO del bot (mismo Node, sin nada más): al arrancar abre
`http://localhost:8099` con la portada pública, `/panel` (cada dueño) y
`/admin` (tú: canales y licencias).

## Probarla en casa (ya funciona)

Abre `http://localhost:8099` con el bot en marcha. Sin `TWITCH_CLIENT_SECRET`
abre en modo local (sin login): ves todo.

## Enseñarla fuera de casa (para vender)

1. En tu router, redirige el puerto **8099** al PC 24/7 (busca "port forwarding"
   + tu modelo de router; es un cambio de 2 minutos).
2. (Opcional pero recomendado) IP fija: ponle IP manual al PC 24/7 o usa
   **DuckDNS** (gratis) para tener `tubot.duckdns.org` en vez de números.
3. En tu app de https://dev.twitch.tv/console/apps añade estas URLs de
   redirección (una por línea):
   - `http://localhost:8099/auth/callback` (para ti)
   - `http://TU_IP_O_DOMINIO:8099/auth/callback` (para clientes)
4. En el `.env` del servidor pon `TWITCH_CLIENT_SECRET=...` (lo verás en la
   consola de Twitch al cambiar la app a tipo Confidencial) y reinicia.
5. Desde entonces cada dueño entra con su Twitch y **solo ve su canal**.

## Cobrar (fase 1: manual, fase 2: automático)

- Pon tu enlace de Ko-fi en `config.json` → `comercial.kofi`.
- El cliente paga → tú creas su licencia en `/admin` (plan + días) → le das
  de alta el canal con `node src/auth.js --canal=X` → listo.
- Cuando haya volumen: pon `comercial.exigirLicencia` en `true` y los canales
  sin licencia vinculada **no arrancan** (el tuyo y kokodeejay siguen gratis).
- Stripe automático queda para la fase 2 (pide empresa/cuenta bancaria).

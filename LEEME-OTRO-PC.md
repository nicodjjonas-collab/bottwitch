# 🖥️ Bot 24/7 en el otro PC (dedicado)

> IMPORTANTE: el bot solo puede estar encendido en UN PC a la vez. Si lo
> enciendes aquí, **apágalo en el otro** (misma cuenta = Twitch tira una
> de las dos conexiones).

## En el PC nuevo

1. Instala **Node.js 22 o superior** desde https://nodejs.org (LTS).
2. Descomprime `TwitchBot-para-otro-PC.zip` en `C:\TwitchBot`
   (que quede `C:\TwitchBot\src`, `C:\TwitchBot\config`...).
3. Doble clic en **`ARRANCAR-24-7.cmd`**. Verás `Bot en marcha en #jonasrdb`.
4. Escribe `!ayuda` en tu chat de Twitch para comprobar.
5. **Apaga el bot del PC viejo** (cierra su ventana) para que no se peleen.

## Auto-arranque (que vuelva solo tras reiniciar)

Abre una terminal **como administrador** (clic derecho → Ejecutar como
administrador) y pega:

```powershell
schtasks /create /tn "TwitchBot 24-7" /tr "C:\TwitchBot\ARRANCAR-24-7.cmd" /sc onlogon /f
```

Desde entonces arranca solo al iniciar sesión. Deja ese PC siempre
encendido (sin suspender: *Configuración → Sistema → Energía → Suspender:
Nunca* con corriente).

## Notas

- No hay que autorizar de nuevo: el ZIP ya lleva `config/canales.json`
  con tus canales. Si el token del bot caduca, se renueva solo; si pide
  autorizar, ejecuta `AUTORIZAR-BOT.cmd` (una sola vez, con sesionesoldschool).
- Los puntos y la memoria viajan en `src/data/` si los copias también
  (no vienen en el ZIP; si los quieres, copia esa carpeta a mano).
- Para actualizar: repite el ZIP y descomprime encima (no pisa `src/data`).

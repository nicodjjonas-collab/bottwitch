# 🌉 Multichat: YouTube + Kick en tu chat de Twitch

## Lo honesto primero: qué funciona y qué no

| | YouTube | Kick |
|---|---|---|
| Leer su chat en Twitch | ✅ API oficial | ✅ (vía interna, puede romperse si Kick cambia) |
| Responder desde Twitch | ✅ `!ryt <texto>` | ❌ No hay forma oficial con solo usuario+clave |
| Configurar | Hay que crear proyecto en Google (10 min, gratis) | Solo activar y poner el canal |

Si Kick cambia su web, su puente se apaga solo con aviso y lo demás sigue.

## Paso 1 — Proyecto en Google (una vez, gratis)

1. Entra en https://console.cloud.google.com → crea un proyecto (ej: `bot-twitch`).
2. **APIs y servicios → Biblioteca** → busca **YouTube Data API v3** → Habilitar.
3. **Pantalla de consentimiento OAuth** → tipo **Externo** → rellena nombre y email → en **Usuarios de prueba** añade tu cuenta de Google/YouTube → Guardar.
4. **Credenciales → Crear credenciales → ID de cliente OAuth** → tipo **App de escritorio** → copia el **Client ID**.

> OJO Google: en modo prueba, la autorización caduca cada 7 días (repite el
> paso 2 cuando avise). Para no repetirlo hay que publicar y verificar la app
> (pide revisión de Google; solo compensa con muchos clientes).

## Paso 2 — Autorizar (una vez por canal)

Doble clic en **`AUTORIZAR-YT.cmd jonasrdb`** (cambia el nombre por tu canal):

1. Pega el **Client ID** de Google (o pon `YT_CLIENT_ID=` en el `.env` y no pregunta).
2. Te da un **código**: ábrelo en https://www.google.com/device con la cuenta
   **del canal de YouTube que emite** (¡no con otra!).
3. Listo: se guarda solo. Comprueba con `!multichat` en Twitch.

## Paso 3 — Activar por canal

En `config.json` → `multichat` (o por canal desde el futuro panel):
- `youtube.enabled: true` (+ `videoId` solo si falla la autodetección del directo)
- `kick.enabled: true` (+ `canal` solo si tu Kick se llama distinto que tu Twitch)

Reinicia el bot. Sin directo en YT/Kick, los puentes esperan solos.

## Comandos (en el chat de Twitch)

| Comando | Quién | Qué hace |
|---|---|---|
| `!multichat` | Todos | Estado: YouTube en directo/sin directo, Kick conectado, cuota usada |
| `!ryt <texto>` | Mods | Responde en el chat de YouTube (gasta ~50 de cuota) |
| `!rk <texto>` | Todos | Explica que Kick es de solo lectura |
| `!ytvideo <id>` / `!ytvideo off` | Mods | Fija el video de YT (o vuelve a autodetectar) |

En Twitch verás `[YT] Luna: hola!` y `[Kick] Koke: temazo`. La IA los tiene
en cuenta para seguir la conversación, pero no les da puntos ni bienvenidas
(no son usuarios de Twitch).

## Cuota de YouTube (gratis: 10.000/día)

Leer gasta ~5 cada 10 s (≈ 3.000/día por canal en directo), enviar ~50 por
respuesta. El bot lleva la cuenta y se planta en `topeCuotaDiaria` (8000)
antes del límite. Estado con `!multichat`.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `sin autorizar (falta refreshToken)` | Ejecuta `AUTORIZAR-YT.cmd tu_canal` |
| `Google no dio refresh_token` | Quita el acceso en myaccount.google.com/permissions y repite |
| `el código ha caducado` | Pide otro (cambian cada pocos minutos) |
| `Kick: el canal no existe` | Revisa el slug (`kick.canal` en config) |
| `Kick: ... (reintento)` | Kick cambió algo o se cayó; reintenta solo 60 s. Si dura días, avísame |
| Bot lento en Twitch | Los puentes van aparte; si YT/Kick fallan no frenan el chat |

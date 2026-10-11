# 🤖 Bot de chat para Twitch — jonasrdb

Bot para tu canal: **conversa**, **juega**, **recuerda seguir el canal** y **modera el lenguaje**.
Hecho a medida, en español, y **sin instalar nada**: cero dependencias externas.

```
Carpeta:  C:\TwitchBot
Arrancar: doble clic en ARRANCAR-BOT.cmd
```

---

## Índice

1. [Qué hace](#qué-hace)
2. [Puesta en marcha en 3 pasos](#puesta-en-marcha-en-3-pasos)
3. [Comandos del chat](#comandos-del-chat)
4. [Los juegos](#los-juegos)
5. [Moderación de palabras ofensivas](#moderación-de-palabras-ofensivas)
6. [La conversación (y cómo activar la IA)](#la-conversación-y-cómo-activar-la-ia)
7. [Recordatorios automáticos](#recordatorios-automáticos)
8. [Puntos y ranking](#puntos-y-ranking)
9. [Añadir tus propios juegos](#añadir-tus-propios-juegos)
10. [Problemas frecuentes](#problemas-frecuentes)
11. [Notas para tu PC](#notas-para-tu-pc)

---

## Qué hace

| Bloque | Qué hace exactamente |
|---|---|
| 🗣️ **Conversación** | Lee todos los mensajes, recuerda los últimos 14 para seguir el hilo, y contesta con retardo y cadencia humana. Dos motores: **local** (reglas + temas musicales, gratis, sin internet) o **IA** (Groq/OpenAI/DeepSeek/Ollama). |
| 🎮 **Juegos** | 8 juegos jugables desde el chat + 1 plantilla para que añadas los tuyos. Uno a la vez, con tiempos, enfriamientos, inactividad y puntos. |
| 💜 **Recordatorios** | "Sígueme si te gustan los streams" cada X minutos **solo si el chat está vivo**, bienvenida a quien escribe por primera vez, gracias por subs y raids. |
| 🚫 **Moderación** | 257 palabras prohibidas (español + inglés), detecta `P4TA`, `p.u.t.a`, `puuuta`, borra el mensaje, sanciona con escalado por avisos y no se equivoca con "computadora". |

---

## Puesta en marcha en 3 pasos

### Paso 1 — Crear la aplicación en Twitch (1 minuto, solo una vez)

1. Entra en **https://dev.twitch.tv/console/apps** e inicia sesión.
2. Pulsa **Register Your Application**.
3. Rellena:
   - **Name**: `Bot de jonasrdb` (lo que quieras)
   - **OAuth Redirect URLs**: `http://localhost`
   - **Category**: `Chat Bot`
   - **Client Type**: `Public` (importante: **no** Confidential)
4. Pulsa **Create** y copia el **Client ID** (una cadena de letras y números).

> El Client ID no es un secreto, se puede compartir. Lo que nunca debes compartir es el token.

### Paso 2 — Autorizar el bot con Twitch

Doble clic en **`AUTORIZAR-BOT.cmd`**.

1. Te pedirá el **Client ID**: pégalo y pulsa Enter.
2. Te dará un **código** tipo `ABCD-1234` y te dirá que abras **https://www.twitch.tv/activate**.
3. **Muy importante:** inicia sesión con **la cuenta que quieras usar como bot**.
   - Si usas una cuenta aparte → el bot hablará con ese nombre.
   - Si usas tu cuenta principal → el bot hablará como tú.
4. Pega el código, acepta los permisos y listo. El programa guarda todo en el archivo `.env`.

> **Varios canales:** el bot atiende todos los de `config/canales.json` a la vez,
> cada uno con sus puntos, juegos y overlay (`?canal=`). Tu canal va con plan
> `full` y `propio` (gratis con todo). Añade otro con:
> `node src/auth.js --canal=otro_canal --plan=basico`
> (con su cuenta de bot). Ver `LEEME-NUBE.md` para el 24/7 en la nube.
>
> ## 🖥️ Web BotDJ (portada + panel + admin)
>
> Al arrancar, el bot abre la web en **http://localhost:8099**: portada
> pública con planes, `/panel` (cada dueño: IA, juegos, música, promos —
> **Guardar se aplica al momento**) y `/admin` (tú: canales y licencias).
> Con `TWITCH_CLIENT_SECRET` pide login con Twitch y cada uno solo ve su
> canal. Licencias: créalas en admin y vincúlalas; con
> `comercial.exigirLicencia` en `true`, sin licencia no arranca
> (tu canal y kokodeejay, gratis siempre). Ver `LEEME-WEB.md`.

### Paso 3 — Arrancar

Doble clic en **`ARRANCAR-BOT.cmd`** y déjalo abierto mientras emites.

Escribe `!ayuda` en tu propio chat para ver que responde.

**Si usas una cuenta de bot aparte**, dale permisos de moderador: en tu chat escribe
```
/mod nombre_de_tu_bot
```
Sin eso, el bot podrá avisar de las palabras ofensivas pero **no borrar mensajes ni sancionar**.

### Probar sin conectar a nada

Doble clic en **`PROBAR-BOT.cmd`** → ejecuta 49 comprobaciones internas y no toca Twitch.

---

## Comandos del chat

| Comando | Qué hace | Quién |
|---|---|---|
| `!ayuda` | Lista de comandos y juegos | Todos |
| `!juegos` | Todos los juegos con su descripción | Todos |
| **`!festero`** o `!festero @alguien` | **Medidor de ganas de fiesta** con barra (`🔥 ¡¡A LA PISTA!! @ana tiene un 90% de ganas de fiesta █████████░`) | Todos |
| **`!sr <canción>`** | **Pide un tema** para la cola (con espera por persona y sin enlaces) | Todos |
| `!cola` | Ver la cola de peticiones | Todos |
| **`!bpm <n>`** | **Apostar los BPM** del tema que está sonando | Todos |
| `!8ball <pregunta>` | La bola 8 responde | Todos |
| `!so @alguien` | Shoutout para ese canal | Todos |
| `!siguiente` | Saca el siguiente tema de la cola | Mods |
| `!limpiarcola` | Vacía la cola de peticiones | Mods |
| `!bpmreal <n>` | Fija el BPM real (el bot **borra tu mensaje** para que el chat no lo vea) | Streamer |
| `!bpmfin` | Revela el BPM y reparte los puntos al que más se acercó | Streamer |
| `!ahorcado`, `!trivia`, etc. | Empieza ese juego | Todos |
| `!puntos` o `!puntos @alguien` | Cuántos puntos tienes | Todos |
| `!top` | Ranking del canal | Todos |
| `!estado` | Estado del bot y de la partida en curso | Todos |
| `!seguir` | Pide el follow a quien lo escriba | Todos |
| `!bot` | Informa de qué es el bot y en qué modo está | Todos |
| `!cancelar` | Cancela la partida (solo quien la lanzó o un mod) | Todos |
| `!prohibir <palabra>` | Añade una palabra a la lista negra al momento | Mods |
| `!permitir <palabra>` | Saca una palabra de la lista negra | Mods |
| `!listamod` | Cuántas palabras hay en la lista | Mods |
| `!avisos <usuario>` | Avisos acumulados de alguien | Mods |
| `!resetavisos <usuario>` | Pone sus avisos a cero | Mods |
| `!ia on` / `!ia off` | Cambia entre IA y modo local | Streamer |
| `!conversacion on` / `off` | El bot habla o se calla | Streamer |
| `!promos on` / `off` | Activa o corta los recordatorios | Streamer |
| `!juegoson on` / `off` | Activa o corta los juegos | Streamer |
| **`!meta`** o **`!meta follows`** | Ver las metas de follows/subs | Todos |
| **`!meta follows 200`** | Fijar la meta de follows (igual con `subs`) | Mods |
| **`!suma follows 3`** / **`!suma subs 1`** | Sumar a la meta (avisa y celebra al llegar) | Mods |
| **`!clip <texto>`** | Marcar un momentazo para hacerlo Short después | Todos |
| **`!horario`** | Días y hora de los directos | Todos |
| **`!track Artista - Título`** / **`!tracklist`** | Anotar temas y ver la lista (para YouTube) | Mods / Todos |

El prefijo es `!` y se cambia en `config.json` (`prefix`).

---

## 🎬 Clips verticales (Shorts/TikTok)

Durante el directo, cualquiera marca momentazos con `!clip <texto>` (el chat marca, tú conviertes). Las marcas con sus minutos quedan en `C:\OBS-Media\datos\clips-marcas.txt`. Después:

```
CORTAR-CLIP.cmd video-del-directo.mp4 01:23:45 45 "el drop brutal"
```

Saca un MP4 **vertical 1080x1920** con fondo desenfocado y tu marca (`JONASRDB · TRANCE` + `twitch.tv/jonasrdb`), listo para Shorts/TikTok/IG. Doble clic en `CORTAR-CLIP.cmd` sin nada para ver la ayuda.

## 🎯 Metas en pantalla

```
!meta follows 200   (el streamer fija la meta, igual con subs)
!suma follows 3     (suma cuando llegue gente, celebra al llegar)
!meta               (el chat ve cómo va)
```

En OBS: **Fuente de texto → Leer de archivo** → `C:\OBS-Media\datos\meta-follows.txt` (y `meta-subs.txt`). Texto, no navegador: gasta poquísima CPU.

## 🗓️ Panel de horario en pantalla

En OBS: **Fuente → Navegador** con URL `file:///C:/StreamAvatars/horario.html?dias=viernes,sabado&hora=22:00`, 1920x1080. Muestra los días, la hora y la **cuenta atrás** (o 🔴 EN DIRECTO en horario). Los días/hora salen de `config.json` → `horario` para el `!horario` del chat.

---

## 🎧 Lo que hacen los canales de DJ (y ya tienes)

Miré las listas de comandos públicas de canales de DJ en Twitch, como la de
[DJ Xenmium](https://www.lumiastream.com/u/DJ%20Xenmium/commands), y estas son las ideas que más se
repiten. Te he montado las que se pueden hacer sin depender de servicios de pago:

| Lo que hacen los DJ | Cómo lo tienes aquí |
|---|---|
| **Peticiones de música** (`!songrequest`, `!queue`) | `!sr <canción>` + `!cola` + `!siguiente`, con espera por persona, tope de cola y sin enlaces. Se guarda en disco: la cola sobrevive al reinicio |
| **Colas de espectadores** (`!joinq`, `!qpos`) | El `!sorteo` del overlay hace de cola de participantes y elige ganador |
| **Economía y puntos** (`!points`, `!top`) | `!puntos`, `!top`, y puntos por jugar, por bits y por acertar los BPM |
| **Minijuegos** (`!roulette`, `!slots`, `!duel`, `!8ball`, `!bingo`) | 8 juegos en el overlay (`!ahorcado`, `!trivia`, `!duelo`…) + `!8ball` y `!dado` |
| **Votaciones** (`!vote`) | `!festero` mide el ánimo del chat; el overlay tiene `!hype` (medidor colectivo) |
| **Cambiar las luces y los colores** (`!blue`, `!flash`, `!rgb`) | **`!color azul`** (o `!azul`, `!rojo`, `!verde`, `!morado`…) cambia el suelo, el confeti y la interfaz del overlay, y **`!flash`** da un destello. Es la marca de la casa de los DJ |
| **Sorteos** (`!raffle`) | `!sorteo` en el overlay, con ganador aleatorio y estadística |
| **Utilidades** (`!watchtime`, `!chatstats`, `!so`) | `!so @alguien` para dar bola a otros canales |

**Ideas para tu directo, ya montadas:**

- **Ronda de BPM**: tú escribes `!bpmreal 128` (el bot **borra tu mensaje** para que nadie vea la
  respuesta), el chat apuesta con `!bpm 126`, y revelas con `!bpmfin`. El que más se acerca se lleva
  25 puntos. Es un juego que **solo funciona en un canal de música**: el chat tiene que escuchar.
- **Cambio de luces**: cuando el set cambie de rollo, pide `!color rojo` y todo el overlay se pone en
  rojo. Si algún día pones tiras LED, quedaría de escándalo.
- **Peticiones**: `!sr` con la cola a la vista hace que el chat participe en el tracklist.
- **Festerómetro**: úsalo de broma cuando el chat esté dormido — *"a ver quién tiene más ganas de fiesta"*.

**Ojo con la música y Twitch:** desde 2024 existe el [Programa de DJ de Twitch](https://legal.twitch.com/es-ES/legal/dj-program-terms/)
con reglas propias sobre qué música se puede pinchar en directo. Merece la pena leerlo antes de montar
sesiones largas, porque es lo único de esta lista que te puede dar un problema real.

---

## 🧠 La IA: que converse como una persona (gratis, 2 minutos)

El bot funciona de dos maneras:

| | Modo local (lo que hay ahora) | **Con IA** |
|---|---|---|
| Conversa | Con plantillas y reglas | **De verdad, siguiendo el hilo** |
| Anima el chat parado | De una lista fija | **Escribe un mensaje nuevo cada vez** |
| Coste | 0 | 0 (capa gratuita de Groq) |

**Para activarla (solo una vez):**

1. Entra en **https://console.groq.com/keys** y crea la cuenta (no pide tarjeta)
2. Pulsa **Create API Key**, ponle un nombre y copia la clave (empieza por `gsk_`)
3. Pégala en `C:\TwitchBot\.env` en la línea `LLM_API_KEY=`
4. Doble clic en **`PROBAR-IA.cmd`**: hace dos peticiones de verdad y te dice si funciona (o qué falla exactamente)
5. Reinicia el bot con **`ARRANCAR-BOT.cmd`**

**Lo que ya te dejé configurado:**

- Modelo **`openai/gpt-oss-120b`** — ojo, porque `llama-3.3-70b-versatile` **ya está retirado en Groq** — con **`openai/gpt-oss-20b` de reserva**: si el primero da error 429 (límite) o falla, el bot cambia solo al segundo, que tiene cuota aparte.
- **Tope de 800 peticiones al día** (la capa gratuita da 1.000). Si se agota, el bot sigue con el cerebro local sin quedarse mudo.
- Responde a ~**55 %** de los mensajes, máximo **6 por minuto**, y **no repite con la misma persona antes de 25 segundos** — así no parece un loro.
- **Ambiente**: si el chat lleva **7 minutos** callado, escribe un mensaje nuevo para animar la conversación. Mira cada 3 minutos si está parado, deja 10 minutos entre mensajes y máximo 14 por directo.
- **Suscripciones**: recuerda que se puede suscribir cada **30 minutos** (máximo 5 veces por directo) y **solo si el chat está vivo**.
- El bot **filtra sus propias respuestas** con la lista de palabras prohibidas: si la IA suelta algo fuera de tono, el mensaje no sale.

---

## Los juegos

| Juego | Cómo se juega |
|---|---|
| `!ahorcado` | El bot da una pista y una palabra oculta. Escribe letras sueltas o la palabra completa. 6 fallos. `!pista` da ayuda extra (máx. 3). |
| `!tresenraya` | Tú empiezas con ❌. Otro entra con `!entrar` (30 s); si no entra nadie, juega el bot. Casillas **1-9** (o `a1`-`c3`). |
| `!trivia` | Preguntas de música electrónica con 4 opciones. El primero que acierte se lleva los puntos. `!trivia 5` = 5 rondas. |
| `!anagrama` | Letras desordenadas: escribe la palabra original. `!pista` para ayuda. `!anagrama 3` = 3 rondas. |
| `!ppt` | Piedra, papel o tijera contra el bot, al mejor de 3. Escribe `piedra`, `papel` o `tijera`. |
| `!dados` | Tira 2 dados contra el bot, o `!dados 20` para un dado de 20 caras. |
| `!adivina` | El bot piensa un número del 1 al 100 y te dice "más alto" o "más bajo". `!adivina 50` = del 1 al 50. |
| `!sorteo` | Los espectadores escriben `!entro` durante 60 s (o `!sorteo 30` = 30 s) y el bot elige ganador al azar. |
| `!plantilla` | El juego de ejemplo: escribe el doble del número que dice. Sirve de plantilla para crear los tuyos. |

**Detalles útiles:**
- Solo hay **una partida a la vez** (`oneGameAtATime` en `config.json`).
- Si nadie interactúa **3 minutos**, la partida se cancela sola.
- Hay **45 segundos de enfriamiento** entre partidas del mismo juego.
- Los ganadores se llevan **10 puntos** y quien empieza **2** (configurable en `games.points`).

---

## Moderación de palabras ofensivas

### Cómo decide

1. **Normaliza** el mensaje: quita tildes, cambia `4`→`a`, `0`→`o`, `3`→`e`… y colapsa letras repetidas.
2. Busca cada palabra de la lista como **palabra completa**, así `computadora` **no** activa `puta`.
3. Detecta **evasiones con letras separadas**: `p u t a`, `p.u.t.a`, `p-u-t-a`.
4. Respeta la **lista blanca** (palabras normales que contienen tacos por casualidad).
5. Aplica la sanción según los **avisos acumulados** de ese usuario.

### Dónde se editan las listas

| Archivo | Contenido |
|---|---|
| `src\moderation\palabras-es.txt` | 180 palabras en español |
| `src\moderation\palabras-en.txt` | 92 palabras en inglés |
| `src\moderation\palabras-custom.txt` | **Tu archivo** (créalo y añade una palabra por línea) |

- Una palabra o expresión por línea. Las líneas que empiezan por `#` se ignoran.
- Se admiten expresiones de varias palabras: `hijo de puta`.
- **Para añadir en caliente** sin editar archivos: `!prohibir <palabra>` en tu chat (siendo mod).
- Si alguna palabra te da falsos positivos, quítala del archivo o añádela a `whitelist` en `config.json`.

### Sanciones y escalado (`config.json` → `moderation`)

```json
"action": "delete",          // primera vez: warn | delete | timeout | ban
"timeoutSeconds": 300,
"deleteMessage": true,       // borra el mensaje (necesita mod)
"escalation": [
  { "warnings": 2, "action": "timeout", "seconds": 60 },
  { "warnings": 3, "action": "timeout", "seconds": 600 },
  { "warnings": 5, "action": "ban" }
]
```

- `ignoreMods` / `ignoreBroadcaster` / `ignoreVips`: por defecto los mods y tú **no** estáis vigilados.
- Los avisos **se acumulan para siempre**. Si quieres perdonar a alguien: `!resetavisos <usuario>`.

> Para borrar mensajes y sancionar, la cuenta del bot **tiene que ser moderadora** del canal.

---

## La conversación (y cómo activar la IA)

### Modo local (por defecto, gratis)

Motor de reglas con 16 intenciones (saludos, despedidas, preguntas, elogios, follows, risas,
producción musical, equipo, temas de conversación…) y 15 temas del canal. No necesita internet
ni claves, y **no inventa**: si no sabe qué decir, se calla.

### Modo IA (conversación de verdad)

Detecta el contexto real y responde a cualquier cosa. Necesitas una clave de API:

1. Elige proveedor y crea una clave:
   | Proveedor | Dónde | Coste |
   |---|---|---|
   | **Groq** (recomendado) | https://console.groq.com/keys | Plan gratuito, muy rápido |
   | DeepSeek | https://platform.deepseek.com/api_keys | Muy barato (céntimos) |
   | OpenAI | https://platform.openai.com/api-keys | De pago |
   | OpenRouter | https://openrouter.ai/keys | Tiene modelos gratis |
   | Ollama | Se instala en tu PC | Gratis, pero **pesado** (no lo uses mientras emites) |
2. Abre `C:\TwitchBot\.env` y pon la clave:
   ```
   LLM_API_KEY=tu_clave_aqui
   ```
3. En `config.json` cambia:
   ```json
   "conversation": { "mode": "llm" },
   "llm": { "provider": "groq" }
   ```
   (los datos de `baseUrl` y `model` se cogen solos del preset del proveedor)
4. Arranca el bot. Verás `Cerebro IA configurado: groq / llama-3.3-70b-versatile`.

También puedes cambiarlo **en caliente** desde el chat: `!ia on` / `!ia off`.

> Si la IA falla o tarda, el bot **cae automáticamente al modo local** para esa respuesta.
> Antes de enviar nada, el bot **filtra su propia respuesta** con la lista de palabras prohibidas.

### Que no parezca un robot (`config.json` → `conversation`)

| Ajuste | Para qué |
|---|---|
| `replyChance` | 0.35 = contesta al 35 % de los mensajes. Súbelo si quieres un bot charlatán |
| `minDelayMs` / `maxDelayMs` | Retardo aleatorio antes de escribir (1,2-4,2 s) |
| `maxRepliesPerMinute` | Tope de respuestas por minuto (6) |
| `onlyWhenChatActive` | Si nadie escribe en 2 minutos, se calla |
| `contextMessages` | Cuántos mensajes recuerda para seguir el hilo (14) |
| `llm.systemPrompt` | **Aquí defines su personalidad.** Es lo primero que deberías personalizar |

---

## Recordatorios automáticos

Están en `config.json` → `promos`. Hay **dos recordatorios periódicos** y ambos funcionan igual:

```json
"followReminder": {
  "enabled": true,
  "everyMinutes": 20,
  "onlyIfChatActiveSeconds": 300,
  "maxPerStream": 6,
  "messages": [ "Si te esta gustando el directo, dale a seguir 💜 ...", ... ]
},

"recordatorioAvatares": {
  "enabled": true,
  "everyMinutes": 15,
  "minutoInicial": 3,
  "onlyIfChatActiveSeconds": 300,
  "maxPerStream": 8,
  "messages": [ "🎮 Tu muñequito del overlay: elige disfraz con !skin ...", ... ]
}
```

| | Recordatorio de **follow** | Recordatorio de **muñequitos** |
|---|---|---|
| Cada | 20 minutos | **15 minutos** |
| El primero sale a los | 90 segundos | 3 minutos |
| Máximo por directo | 6 veces | 8 veces |
| Qué dice | Que sigas el canal 💜 | Que existe el overlay y qué comandos tiene 🎮 |

- Los dos **solo hablan si alguien ha escrito en los últimos 5 minutos** (nada de hablar solo).
- **Añade tus propios mensajes** a la lista: cuanto más variados, mejor. Se eligen al azar.
- Se apagan en caliente con `!promos off` (y se encienden con `!promos on`).
- Mensajes de bienvenida, subs y raids: `welcomeFirstTime`, `thanksSub`, `thanksRaid`.

---

## Puntos y ranking

- Se guardan en `src\data\stats.json` (se guarda solo cada pocos segundos).
- Se ganan jugando: `!puntos`, `!top` para verlos.
- Ajusta los premios en `config.json` → `games.points`.
- Si quieres empezar de cero: borra `src\data\stats.json`.

---

## Añadir tus propios juegos

1. Copia `src\games\_plantilla.js` a `src\games\mijuego.js`.
2. Cambia `id`, `name`, `aliases` y `help`.
3. Escribe la lógica dentro de `create(api, args)`. Tienes disponible:
   `api.say`, `api.sayMany`, `api.pick`, `api.random`, `api.store`, `api.normalize`, `api.user`,
   `api.channel`, `api.config`, `api.logger`, `api.isMod`, `api.seconds`.
4. Devuelve `{ onMessage, onTick, status, finished }` y pon `finished = true` cuando acabe.
5. Reinicia el bot. Aparecerá solo en `!juegos`. **No hay que tocar nada más.**

---

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Falta BOT_TOKEN en el archivo .env` | No has autorizado. Ejecuta `AUTORIZAR-BOT.cmd` |
| `El token de Twitch no es valido o ha caducado` | Vuelve a ejecutar `AUTORIZAR-BOT.cmd` (dura ~60 días) |
| `Twitch ha rechazado el token` | El token es de otra cuenta o lo has revocado: vuelve a autorizar |
| El bot conecta pero no habla | Escribe `!ayuda`. Si responde a comandos pero no conversa, sube `replyChance` |
| No borra mensajes ni sanciona | La cuenta del bot no es moderadora → `/mod nombrebot` en tu chat |
| La IA no responde | Falta `LLM_API_KEY` en `.env` o `conversation.mode` no es `"llm"` |
| Responde a todo y molesta | Baja `replyChance`, sube `minDelayMs`, baja `maxRepliesPerMinute` |
| Marca palabras inocentes | Añádelas a `moderation.whitelist` en `config.json` |
| Se corta solo | Mira la ventana: si dice "Reintento", es tu conexión. Se reconecta solo |

---

## Notas para tu PC

- **Consumo:** unos 60-90 MB de RAM y muy poca CPU. En tu i3 se nota poco, pero **arráncalo después de `OBS-Modo-Directo-ACTIVAR.cmd`** para no competir con OBS.
- **Puede vivir en el otro PC:** copia la carpeta `C:\TwitchBot` entera (incluido `.env`) y ejecuta allí `ARRANCAR-BOT.cmd`. El bot no necesita estar en el mismo ordenador que OBS.
- **Mientras emites**, deja la ventana del bot abierta (o minimizada). Si la cierras, el bot se apaga.
- **Buenas prácticas en Twitch:** los bots deben identificarse si se les pregunta (el bot lo hace con `!bot`) y no conviene que inunden el chat. Los límites de `chat.messagesPer30s` y `maxRepliesPerMinute` ya lo controlan.
- **Copia de seguridad:** todo lo importante está en `config.json`, `.env` y `src\moderation\*.txt`. Con eso reconstruyes el bot en cualquier sitio.

---

Hecho para el canal de **jonasrdb** 🎧 — trance, juegos y buen rollo en el chat.

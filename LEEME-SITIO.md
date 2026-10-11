# 🌐 Publicar BotDJ gratis (GitHub Pages + Releases)

La portada (`sitio/index.html`) es 100% estática: se aloja gratis, sin tarjeta.

## 1. La web (5 min, lo haces tú)

1. Crea cuenta en **https://github.com** (gratis, sin tarjeta).
2. Crea un repositorio público, ej: `botdj` (sin README).
3. Sube `sitio/index.html` (botón *Add file → Upload files*).
4. Ve a *Settings → Pages* → *Deploy from a branch* → rama `main`, carpeta `/ (root)` → *Save*.
5. Tu web queda en `https://TU_USUARIO.github.io/botdj/` (tarda 1-2 min).

## 2. El instalador para descargar (gratis, hasta 2 GB)

1. En el mismo repo: *Releases → Draft a new release* → tag `v1.0.0`.
2. Arrastra `TwitchBot-Setup-1.0.0.exe` como adjunto → *Publish*.
3. Copia su link y pégalo en `sitio/index.html` donde pone `#`
   (hay dos: botón de arriba y botón de Descargar), sube el cambio.
4. Cada versión nueva: repite el proceso y avisa a tus usuarios en el directo o Discord.

## 3. El panel y el bot (esto NO va a GitHub Pages)

El panel (`/panel`, `/admin`) necesita el bot encendido: vive en tu PC 24/7
(`http://localhost:8099`). Cuando quieras enseñarlo fuera, sigue
`LEEME-WEB.md` (puerto + DuckDNS). La portada enlaza al panel local de cada
uno: cada streamer gestiona el suyo.

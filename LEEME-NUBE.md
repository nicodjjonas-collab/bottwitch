# ☁️ Subir el bot a la nube gratis (24/7) — Oracle Always Free

> Tu canal va en el lote **gratis con todo** (plan `full`, `propio`). Los demás
> canales se cobran aparte (eso lo haremos con la web). La nube no necesita
> abrir ningún puerto: el bot solo sale hacia Twitch y Groq.

## Paso 1 — Crear la cuenta (10 min, lo haces tú)

1. Entra en **https://www.oracle.com/cloud/free** y crea la cuenta (*Always Free*).
2. Te pide tarjeta para verificar la identidad: **no cobra nada** en recursos
   Always Free, pero pon una con límite por si acaso y activa el aviso de gasto.
3. Entra en la consola → **Instances → Create instance**:
   - Imagen: **Ubuntu 24.04**
   - Shape: **Ampere ARM** (4 OCPU, 24 GB van sobrados) o la AMD pequeña.
   - **Guarda el archivo .key** que te da (lo necesitas para entrar por SSH).
   - Discarga la IP pública y apúntala.

## Paso 2 — Preparar la máquina (pega esto por SSH)

```bash
# Node 22 + PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Carpeta del bot
mkdir -p ~/twitchbot && cd ~/twitchbot
```

## Paso 3 — Subir el bot (desde tu PC)

```powershell
# En PowerShell, desde C:\TwitchBot (sin node_modules: pesa y no hace falta)
scp -i C:\ruta\a\tu-clave.key -r src config package.json package-lock.json .env.example LEEME-NUBE.md ecosystem.config.cjs ubuntu@TU_IP:~/twitchbot/
ssh -i C:\ruta\a\tu-clave.key ubuntu@TU_IP
```

```bash
# Ya dentro del servidor:
cd ~/twitchbot
npm install --omit=dev
cp .env.example .env
nano .env   # pega tu LLM_API_KEY (la de Groq, empieza por gsk_)
```

## Paso 4 — Autorizar el bot (una sola vez) y dar de alta canales

```bash
node src/auth.js --canal=jonasrdb
# Te da un código: abre twitch.tv/activate con la cuenta sesionesoldschool.
# Los canales de clientes NO se autorizan: se dan de alta sin pedirles nada:
#   node src/auth.js --alta=otro --plan=basico
# y el cliente solo pone  /mod sesionesoldschool  en su chat.
node --env-file-if-exists=.env src/index.js --dry-run   # comprobar sin conectar
```

## Paso 5 — Arrancar 24/7

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # ejecuta EXACTAMENTE lo que te diga (lleva sudo)
```

Comandos útiles: `pm2 status` · `pm2 logs twitchbot` · `pm2 restart twitchbot`.

## Actualizar el bot

```powershell
# Desde tu PC: vuelve a copiar src y config (los datos de puntos NO se tocan,
# viven en src/data/ del servidor; hazles copia de vez en cuando).
scp -i C:\ruta\a\tu-clave.key -r src config ubuntu@TU_IP:~/twitchbot/
ssh -i C:\ruta\a\tu-clave.key ubuntu@TU_IP "cd ~/twitchbot && pm2 restart twitchbot"
```

## Coste realista

- Máquina Always Free + tráfico normal: **0 €**.
- Si un día hay 20 canales con chat a tope, siguen cabiendo (cada canal gasta
  unos 60-90 MB). La cuota de Groq (1.000/día gratis) se reparte entre todos:
  con más de ~5 canales activos conviene subir el tope o pasar a DeepSeek
  (muy barato) — lo vemos cuando llegue.

@echo off
title Bot de Twitch - EN MARCHA
cd /d C:\TwitchBot
if not exist .env (
  echo.
  echo  Todavia no has autorizado el bot.
  echo  Ejecuta primero:  AUTORIZAR-BOT.cmd
  echo.
  pause
  exit /b 1
)
echo.
echo  Arrancando el bot... (deja esta ventana abierta mientras emites)
echo  Para pararlo: pulsa Ctrl+C o cierra la ventana.
echo.
node --env-file-if-exists=.env src\index.js
echo.
echo  El bot se ha detenido.
pause

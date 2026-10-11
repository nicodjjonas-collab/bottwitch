@echo off
title Bot de Twitch - COMPROBAR LA IA
cd /d C:\TwitchBot
echo.
echo  Comprobando la IA del bot...
echo  (hace 2 peticiones de verdad al proveedor: una de conversacion y otra
echo   del mensaje que anima el chat cuando esta parado)
echo.
node --env-file-if-exists=.env src\probar-ia.js
echo.
pause

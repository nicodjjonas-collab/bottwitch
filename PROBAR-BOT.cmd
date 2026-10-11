@echo off
title Bot de Twitch - Prueba interna
cd /d C:\TwitchBot
echo.
echo  Ejecutando el autotest (no se conecta a Twitch, no gasta nada)...
echo.
node src\selftest.js
echo.
pause

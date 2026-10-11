@echo off
title Empaquetar bot para el otro PC
cd /d C:\TwitchBot
echo.
echo  Empaquetando el bot (con tus canales y claves) en el Escritorio...
echo  NO compartas ese ZIP: lleva tus tokens de Twitch.
echo.
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); Compress-Archive -Path 'C:\TwitchBot\src','C:\TwitchBot\config','C:\TwitchBot\package.json','C:\TwitchBot\.env','C:\TwitchBot\.env.example','C:\TwitchBot\ARRANCAR-24-7.cmd','C:\TwitchBot\ARRANCAR-BOT.cmd','C:\TwitchBot\AUTORIZAR-BOT.cmd','C:\TwitchBot\ecosystem.config.cjs','C:\TwitchBot\LEEME-OTRO-PC.md' -DestinationPath (Join-Path $d 'TwitchBot-para-otro-PC.zip') -Force"
echo.
echo  Listo en tu Escritorio: TwitchBot-para-otro-PC.zip
echo  Llévalo al otro PC (USB o carpeta compartida) y sigue LEEME-OTRO-PC.md
echo.
pause

@echo off
title Autorizar YouTube para el multichat
cd /d C:\TwitchBot
if "%~1"=="" (
  echo.
  echo  Uso:  AUTORIZAR-YT.cmd jonasrdb
  echo  (necesitas el Client ID de Google: mira LEEME-MULTICHAT.md paso 1)
  echo.
  pause
  exit /b 1
)
node --env-file-if-exists=.env src\multichat\autorizar-yt.js --canal=%~1
echo.
pause

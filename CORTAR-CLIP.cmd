@echo off
title Cortar clip vertical - jonasrdb
cd /d C:\TwitchBot
if "%~1"=="" (
  echo.
  echo  Uso: CORTAR-CLIP.cmd ^<video^> ^<inicio^> [segundos] [texto]
  echo.
  echo  Ejemplos:
  echo    CORTAR-CLIP.cmd set.mp4 01:23:45 45
  echo    CORTAR-CLIP.cmd set.mp4 01:23:45 45 "el drop brutal"
  echo.
  echo  Truco: durante el directo marca momentos con !clip ^<texto^> en el chat.
  echo  Las marcas con sus minutos quedan en C:\OBS-Media\datos\clips-marcas.txt
  echo.
  pause
  exit /b 1
)
node src\cortar-clip.js %*
echo.
pause

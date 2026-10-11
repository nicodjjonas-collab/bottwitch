@echo off
title Bot de Twitch 24/7
cd /d C:\TwitchBot
node --env-file-if-exists=.env src\index.js

#!/bin/bash

# Alle Umgebungsvariablen in /etc/environment schreiben
printenv > /etc/environment

# Spezifische Rechte setzen
chmod 644 /etc/environment

# Verzeichnisberechtigungen sicherstellen
chown -R nginx:nginx /usr/share/nginx/html

# Cron-Service starten
service cron start

# Python-Logs in stdout umleiten
exec 1>/proc/1/fd/1 2>/proc/1/fd/2

# Nginx im Vordergrund starten
exec nginx -g 'daemon off;'
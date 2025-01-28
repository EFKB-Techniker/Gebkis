#!/bin/bash

# Alle Umgebungsvariablen in /etc/environment schreiben
printenv > /etc/environment

# Spezifische Rechte setzen
chmod 644 /etc/environment

# Cron-Service starten
service cron start

# Nginx im Vordergrund starten
nginx -g 'daemon off;'
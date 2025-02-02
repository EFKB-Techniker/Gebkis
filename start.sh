#!/bin/bash

# Stelle sicher, dass das Log-Verzeichnis existiert
mkdir -p /usr/share/nginx/html/logs

# Cron neu starten und initial Script ausführen
service cron restart
/opt/venv/bin/python3 /workspace/fetch_data.py &

# Nginx im Vordergrund starten
nginx -g 'daemon off;'

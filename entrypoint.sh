#!/bin/bash

# Umgebungsvariablen in die cron-Environment-Datei schreiben
env | grep -E "CLIENT_|TENANT_|SITE_|DRIVE_|ITEM_|IMAGE_|GEBKIS_" > /etc/environment

# Cron-Service starten
service cron start

# Nginx im Vordergrund starten
nginx -g 'daemon off;'
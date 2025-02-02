#!/bin/bash

# Debug-Ausgabe für Umgebungsvariablen
echo "[Entrypoint] Environment-Variablen Status:"
for var in CLIENT_ID CLIENT_SECRET TENANT_ID SITE_ID DRIVE_ID ITEM_ID IMAGE_FOLDER_ID GEBKIS_DIR GEBKIS_IMG_DIR; do
    if [ -n "${!var}" ]; then
        echo "[Entrypoint] $var ist gesetzt"
    else
        echo "[Entrypoint] WARNUNG: $var ist nicht gesetzt"
    fi
done

# Environment-Variablen für Cron exportieren
printenv | grep -E "^(CLIENT_|TENANT_|SITE_|DRIVE_|ITEM_|IMAGE_|GEBKIS_|PYTHON)" > /etc/environment
chmod 644 /etc/environment

# Verzeichnisberechtigungen
chown -R nginx:nginx /usr/share/nginx/html

# Services starten
service cron restart
exec nginx -g 'daemon off;'
#!/bin/sh

# Laden der Umgebungsvariablen aus der .env Datei
export $(grep -v '^#' /usr/src/app/.env | xargs)

# Rclone Befehl zum Herunterladen der Datei von SharePoint
rclone copy "remote:${SHAREPOINT_SITE_URL}${SHAREPOINT_FILE_PATH}" /usr/src/app/data

# Cron Job einrichten
echo "0 0 * * * /usr/src/app/sync_script.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/sync-cron
chmod 0644 /etc/cron.d/sync-cron
crontab /etc/cron.d/sync-cron
cron -f
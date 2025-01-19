#!/bin/sh

# Setze Hauptarbeitsverzeichnis
cd /workspaces/Gebkis || exit 1

# NPM Abhängigkeiten installieren
echo "Installiere NPM Abhängigkeiten..."
npm install || exit 1

# Wechsel ins JS-Verzeichnis
cd /workspaces/Gebkis/app/js || exit 1

# Führe Synchronisation aus, falls vorhanden
echo "Starte Synchronisation..."
if [ -f "sync.js" ]; then
    node sync.js || exit 1
fi

# Starte Cron-Daemon für geplante Tasks
echo "Starte Cron-Daemon..."
crond || echo "Warnung: Cron-Daemon konnte nicht gestartet werden"

# Starte Hauptanwendung
echo "Starte Hauptanwendung..."
if [ -f "server.js" ]; then
    node server.js || exit 1
else
    echo "Fehler: server.js nicht gefunden"
    exit 1
fi
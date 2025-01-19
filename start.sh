#!/bin/sh

# Setze Hauptarbeitsverzeichnis
cd /workspaces/Gebkis || exit 1

# NPM Abhängigkeiten installieren
echo "Installiere NPM Abhängigkeiten..."
npm install || exit 1

# Wechsel ins JS-Verzeichnis
cd /workspaces/Gebkis/app/js || exit 1

# Führe Synchronisation aus
echo "Starte Synchronisation..."
node sync.js

# Starte Cron-Daemon für geplante Tasks
echo "Starte Cron-Daemon..."
crond || echo "Warnung: Cron-Daemon konnte nicht gestartet werden"

# Starte Hauptanwendung
echo "Starte Hauptanwendung..."
node script.js

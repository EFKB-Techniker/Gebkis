#!/bin/sh
# Initial sync
cd /app/js && node sync.js

# Start cron daemon
crond

# Start web server
node /app/js/server.js
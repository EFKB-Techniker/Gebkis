FROM node:16-alpine

WORKDIR /app

# System-Tools
RUN apk add --no-cache dcron

# Node.js Abhängigkeiten
COPY package*.json ./
RUN npm install

# App-Dateien
COPY app /app

# Cron Job einrichten
RUN echo "*/5 * * * * cd /app/js && node sync.js >> /var/log/cron.log 2>&1" >> /etc/crontabs/root
# Cron Job einrichten (24h Intervall um Mitternacht)
RUN echo "0 0 * * * cd /app/js && node sync.js >> /var/log/cron.log 2>&1" >> /etc/crontabs/root

# Start-Script
COPY start.sh /
RUN chmod +x /start.sh

# Development mode: don't start the application
CMD ["tail", "-f", "/dev/null"]

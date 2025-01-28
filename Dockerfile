FROM python:3.9-slim

RUN apt-get update && apt-get install -y \
    cron \
    nginx \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip

# Zeitzone setzen
ENV TZ=Europe/Berlin
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Python Abhängigkeiten aktualisieren
RUN /opt/venv/bin/pip install pytz

COPY requirements.txt /workspace/requirements.txt
RUN /opt/venv/bin/pip install -r /workspace/requirements.txt

# Nginx-Benutzer erstellen und Verzeichnisse vorbereiten
RUN groupadd -r nginx \
    && useradd -r -g nginx nginx \
    && mkdir -p /usr/share/nginx/html/{data,images,logs} \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

# Logs in stdout/stderr umleiten
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log \
    && ln -sf /dev/stdout /var/log/cron.log

COPY fetch_data.py /workspace/fetch_data.py

# Cronjob einrichten
COPY cronjob /etc/cron.d/app-cron
RUN chmod 0644 /etc/cron.d/app-cron
RUN crontab /etc/cron.d/app-cron

# Stelle sicher, dass das Log-Verzeichnis existiert und Berechtigungen hat
RUN touch /var/log/cron.log && chmod 666 /var/log/cron.log

COPY app /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# Startskript und Entrypoint
COPY start.sh /start.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /start.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

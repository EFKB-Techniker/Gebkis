FROM python:3.9-slim

RUN apt-get update && apt-get install -y \
    cron \
    nginx \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip

COPY requirements.txt /workspace/requirements.txt
RUN /opt/venv/bin/pip install -r /workspace/requirements.txt

COPY .env /workspace/.env

COPY fetch_data.py /workspace/fetch_data.py

COPY cronjob /etc/cron.d/mycron
RUN chmod 0644 /etc/cron.d/mycron \
    && crontab /etc/cron.d/mycron

COPY app /usr/share/nginx/html/app
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# Startskript hinzufügen
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]

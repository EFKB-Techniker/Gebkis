FROM python:3.9-slim

RUN apt-get update && apt-get install -y \
    cron \
    nginx \
    python3-pip \
    python3-venv \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip

# Adds the virtualenv to the PATH environment variable
# So python can be called directly eg. python fetch_data.py
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /workspace/requirements.txt
RUN /opt/venv/bin/pip install -r /workspace/requirements.txt

# COPY .env /workspace/.env

COPY fetch_data.py /workspace/fetch_data.py

COPY cronjob /etc/cron.d/mycron
RUN chmod 0644 /etc/cron.d/mycron \
    && crontab /etc/cron.d/mycron

COPY nginx.conf /etc/nginx/nginx.conf

# Copy Frontend-Files to Nginx HTML directory
COPY gebkis-frontend /workspace/gebkis-frontend
COPY gebkis-frontend /usr/share/nginx/html/gebkis-frontend2
EXPOSE 80

# Startskript hinzufügen
COPY start.sh /start.sh
RUN dos2unix /start.sh && chmod +x /start.sh

CMD ["/start.sh"]

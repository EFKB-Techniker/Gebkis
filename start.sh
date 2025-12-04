#!/bin/bash

# Export environment variables to a file for cron jobs
# otherwise cron won't have access to them
printenv | sed 's/^\([^=]*\)=\(.*\)$/export \1="\2"/g' > /project_env.sh
chmod +x /project_env.sh

# Forward nginx logs to docker logs
ln -sf /dev/stdout /var/log/nginx/access.log
ln -sf /dev/stderr /var/log/nginx/error.log

# Run the script immediately on startup
echo "Starting initial data fetch..."
. /project_env.sh
/opt/venv/bin/python3 /workspace/fetch_data.py 2>&1 | tee -a /workspace/logs/cron.log

echo "Starting NGINX..."
# Start nginx
nginx

echo "Starting cron..."
# Start cron in foreground
cron -f

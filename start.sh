#!/bin/bash

# ----------------------------------------------------------------------
# Gebkis Web Container Startup Script
# ----------------------------------------------------------------------

echo "----------------------------------------------------------------------"
echo "Starting Gebkis Web Container"
echo "----------------------------------------------------------------------"
echo "Date: $(date)"
echo "Configuration:"
echo "Log Directory:     ${LOG_DIR}"
echo "Excel Directory:   ${GEBKIS_DIR}"
echo "Image Directory:   ${GEBKIS_IMG_DIR}"
echo "Excel File Path:   ${EXCEL_FILE_PATH}"
echo "Image Folder Path: ${IMAGE_FOLDER_PATH}"
echo "----------------------------------------------------------------------"

# Export environment variables to a file for cron jobs
printenv | sed 's/^\([^=]*\)=\(.*\)$/export \1="\2"/g' > /project_env.sh
chmod +x /project_env.sh

# Display Cron Schedule
echo "Cron Schedule:"
cat /etc/cron.d/mycron | grep -v "^#" | grep -v "^$"
echo "----------------------------------------------------------------------"

# Forward nginx logs to docker logs
ln -sf /dev/stdout /var/log/nginx/access.log
ln -sf /dev/stderr /var/log/nginx/error.log

# Run the script immediately on startup
echo "Running initial data fetch..."
. /project_env.sh
# Split output so that it goes to both cron.log and stdout
/opt/venv/bin/python3 /workspace/fetch_data.py 2>&1 | tee -a ${LOG_DIR}/cron.log

echo "----------------------------------------------------------------------"
echo "Initial fetch complete."
echo "Starting NGINX..."
# Start nginx
nginx

echo "Starting Cron Job (Foreground - Keep Container Running)..."
echo "----------------------------------------------------------------------"
# Start cron in foreground
cron -f

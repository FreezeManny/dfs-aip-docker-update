#!/bin/bash
# Start the cron service
service cron start
echo "Started cron service, AIP updates will run daily at midnight"

#Run initial update if AUTO_UPDATE_ON_START is true
if [ "$AUTO_UPDATE_ON_START" = "true" ]; then
    echo "Running initial AIP update..."
    python3 /app/update_aip.py
fi

# Create log file if it doesn't exist
touch /var/log/cron.log

# Follow the log file to keep container running
tail -f /var/log/cron.log
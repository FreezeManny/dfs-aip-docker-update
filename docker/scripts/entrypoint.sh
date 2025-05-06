#!/bin/bash
# Start the cron service
service cron start
echo "Started cron service, AIP updates will run daily at midnight"
echo "Current AIP_SECTIONS: $AIP_SECTIONS"

# Run initial update if AUTO_UPDATE_ON_START is true
#if [ "$AUTO_UPDATE_ON_START" = "true" ]; then
#    echo "Running initial AIP update..."
#    /app/update_aip.sh
#fi

# Create log file if it doesn't exist
touch /var/log/cron.log

# Follow the log file to keep container running
tail -f /var/log/cron.log
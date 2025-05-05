#!/bin/bash
echo "[$(date)] Starting AIP update process"
cd /app

# Read config.json
CONFIG_FILE="/app/config.json"

# Create run log file
RUN_LOG_FILE="/app/output/aip-run-log.txt"
echo "[$(date)] Script execution started" >> "$RUN_LOG_FILE"

# Check if aip.py has correct shebang and fix if needed
if grep -q "^#\!/bin/env" aip.py; then
    echo "Fixing shebang in aip.py"
    sed -i '1s|^#\!/bin/env|#!/usr/bin/env|' aip.py
fi

# Ensure script is executable
chmod +x aip.py

# Create a function to handle failures
failed() {
    local profile="$1"
    local last_airac_file="$2"
    # Reset last_airac_date to nothing on failure
    : > "$last_airac_file"
    echo "[$(date)] Script execution failed for profile $profile" >> "$RUN_LOG_FILE"
    echo "----------------------------------------" >> "$RUN_LOG_FILE"
}

# Get the number of profiles
PROFILE_COUNT=$(jq '.profiles | length' "$CONFIG_FILE")

echo "Found $PROFILE_COUNT profiles in config file"
echo "[$(date)] Found $PROFILE_COUNT profiles in config file" >> "$RUN_LOG_FILE"

# Process each profile
for ((i=0; i<$PROFILE_COUNT; i++)); do
    # Extract profile info
    PROFILE_NAME=$(jq -r ".profiles[$i].name" "$CONFIG_FILE")
    FLIGHT_RULE=$(jq -r ".profiles[$i].flight_rule" "$CONFIG_FILE" | tr '[:upper:]' '[:lower:]')
    AIP_SECTIONS=$(jq -r ".profiles[$i].filters | join(\",\")" "$CONFIG_FILE")
    CLEANED_SECTIONS=$(echo "$AIP_SECTIONS" | tr -d '"')

    echo "=== Processing profile: $PROFILE_NAME ==="
    echo "[$(date)] Processing profile: $PROFILE_NAME" >> "$RUN_LOG_FILE"
    
    # Create a file to store the last processed AIRAC date for this profile
    LAST_AIRAC_FILE="/root/.cache/last_airac_date_${PROFILE_NAME}.txt"
    mkdir -p "$(dirname "$LAST_AIRAC_FILE")"
    touch "$LAST_AIRAC_FILE"
    
    # Get the last processed AIRAC date
    LAST_AIRAC_DATE=$(cat "$LAST_AIRAC_FILE")
    
    # Fetch the latest TOC
    echo "Fetching latest AIP table of contents for $PROFILE_NAME..."
    python3 ./aip.py toc fetch --$FLIGHT_RULE
    
    # Get the current AIRAC date from the list (most recent one)
    CURRENT_AIRAC_DATE=$(python3 ./aip.py toc list --$FLIGHT_RULE | head -n 1 | awk '{print $2}')
    echo "[$PROFILE_NAME] Current AIRAC date: $CURRENT_AIRAC_DATE"
    echo "[$PROFILE_NAME] Previous AIRAC date: $LAST_AIRAC_DATE"
    
    # Check if there's a new AIRAC cycle or force update
    if [ "$CURRENT_AIRAC_DATE" != "$LAST_AIRAC_DATE" ]; then
        echo "[$PROFILE_NAME] New AIRAC cycle detected ($CURRENT_AIRAC_DATE). Updating..."
        echo "[$(date)] [$PROFILE_NAME] New AIRAC cycle detected ($CURRENT_AIRAC_DATE). Updating..." >> "$RUN_LOG_FILE"
        
        if [ -n "$AIP_SECTIONS" ]; then
            echo "[$PROFILE_NAME] Downloading sections: $CLEANED_SECTIONS"
            
            
            # Generate change log if we have a previous AIRAC to compare with
            if [ -n "$LAST_AIRAC_DATE" ]; then
                echo "[$PROFILE_NAME] Generating change log between $LAST_AIRAC_DATE and $CURRENT_AIRAC_DATE"
                DIFF_LOG_FILE="/app/output/aip-${PROFILE_NAME}-changes-${LAST_AIRAC_DATE}-to-${CURRENT_AIRAC_DATE}.txt"
                if ! python3 ./aip.py page diff --$FLIGHT_RULE -b "$LAST_AIRAC_DATE" -a "$CURRENT_AIRAC_DATE" -f "$AIP_SECTIONS" > "$DIFF_LOG_FILE" 2>> "$RUN_LOG_FILE"; then
                    echo "[$PROFILE_NAME] Error during page diff. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
                    failed "$PROFILE_NAME" "$LAST_AIRAC_FILE"
                    continue
                else
                    echo "[$PROFILE_NAME] Change log generated at $DIFF_LOG_FILE"
                fi
            fi
            
            # Generate PDF summary with proper output path
            echo "[$PROFILE_NAME] Generating PDF summary"
            OUTPUT_FILE="/app/output/${PROFILE_NAME}-${CURRENT_AIRAC_DATE}.pdf"
            if ! python3 ./aip.py pdf --output "$OUTPUT_FILE" summary --$FLIGHT_RULE -f "$CLEANED_SECTIONS" 2>> "$RUN_LOG_FILE"; then
                echo "[$PROFILE_NAME] Error during PDF generation. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
                failed "$PROFILE_NAME" "$LAST_AIRAC_FILE"
                continue
            else
                echo "[$PROFILE_NAME] PDF generated at $OUTPUT_FILE"
            fi
        else
            echo "[$PROFILE_NAME] No AIP_SECTIONS specified. Skipping page fetch and PDF generation."
        fi
        
        # Update the last processed AIRAC date
        echo "$CURRENT_AIRAC_DATE" > "$LAST_AIRAC_FILE"
        echo "[$PROFILE_NAME] Updated last processed AIRAC date to $CURRENT_AIRAC_DATE"
        echo "[$(date)] [$PROFILE_NAME] Updated AIRAC from $LAST_AIRAC_DATE to $CURRENT_AIRAC_DATE" >> "$RUN_LOG_FILE"
    else
        echo "[$PROFILE_NAME] No new AIRAC cycle detected. Current cycle ($CURRENT_AIRAC_DATE) already processed."
        echo "[$(date)] [$PROFILE_NAME] No new AIRAC cycle detected. Current cycle ($CURRENT_AIRAC_DATE) already processed." >> "$RUN_LOG_FILE"
    fi
    
    echo "=== Completed profile: $PROFILE_NAME ==="
    echo "[$(date)] Completed profile: $PROFILE_NAME" >> "$RUN_LOG_FILE"
    echo ""
done

echo "[$(date)] AIP update process completed for all profiles"
echo "[$(date)] Script execution completed" >> "$RUN_LOG_FILE"
echo "----------------------------------------" >> "$RUN_LOG_FILE"
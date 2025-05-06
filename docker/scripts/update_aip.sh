#!/bin/bash
echo "[$(date)] Starting AIP update process"
cd /app

# Read config.json
CONFIG_FILE="/app/config.json"

# Create run log file
RUN_LOG_FILE="/app/output/aip-run-log.txt"
echo "[$(date)] Script execution started" >> "$RUN_LOG_FILE"

# Create a hash of the config file to detect changes
CONFIG_HASH_DIR="/root/.cache"
mkdir -p "$CONFIG_HASH_DIR"
CONFIG_HASH_FILE="$CONFIG_HASH_DIR/config_hash.txt"
CURRENT_CONFIG_HASH=$(md5sum "$CONFIG_FILE" | awk '{print $1}')
PREVIOUS_CONFIG_HASH=""
if [ -f "$CONFIG_HASH_FILE" ]; then
    PREVIOUS_CONFIG_HASH=$(cat "$CONFIG_HASH_FILE")
fi
CONFIG_CHANGED=false
if [ "$CURRENT_CONFIG_HASH" != "$PREVIOUS_CONFIG_HASH" ]; then
    CONFIG_CHANGED=true
    echo "Configuration has changed since last run. Will force updates."
    echo "[$(date)] Configuration changed. Forcing updates." >> "$RUN_LOG_FILE"
fi

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
    
    # Get the filters for command-line arguments and conditional checks
    AIP_SECTIONS=$(jq -r ".profiles[$i].filters | join(\" \")" "$CONFIG_FILE")
    
    # Format filters for eval command
    FILTER_COUNT=$(jq -r ".profiles[$i].filters | length" "$CONFIG_FILE")
    FILTER_ARGS=""
    for ((j=0; j<$FILTER_COUNT; j++)); do
        FILTER=$(jq -r ".profiles[$i].filters[$j]" "$CONFIG_FILE")
        FILTER_ARGS="$FILTER_ARGS \"$FILTER\""
    done
    
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
    
    # Check if there's a new AIRAC cycle or configuration changed
    if [ "$CURRENT_AIRAC_DATE" != "$LAST_AIRAC_DATE" ] || [ "$CONFIG_CHANGED" = true ]; then
        # Different log message based on what triggered the update
        if [ "$CONFIG_CHANGED" = true ] && [ "$CURRENT_AIRAC_DATE" = "$LAST_AIRAC_DATE" ]; then
            echo "[$PROFILE_NAME] Configuration changed. Forcing update..."
            echo "[$(date)] [$PROFILE_NAME] Configuration changed. Forcing update..." >> "$RUN_LOG_FILE"
        else
            echo "[$PROFILE_NAME] New AIRAC cycle detected ($CURRENT_AIRAC_DATE). Updating..."
            echo "[$(date)] [$PROFILE_NAME] New AIRAC cycle detected ($CURRENT_AIRAC_DATE). Updating..." >> "$RUN_LOG_FILE"
        fi
        
        if [ -n "$AIP_SECTIONS" ]; then
            echo "[$PROFILE_NAME] Downloading sections: $AIP_SECTIONS"
            
            # Generate change log if we have a previous AIRAC to compare with
            #if [ -n "$LAST_AIRAC_DATE" ]; then
            #    echo "[$PROFILE_NAME] Downloading and Generating PDF summary"
            #    OUTPUT_FILE="/app/output/${PROFILE_NAME}_${CURRENT_AIRAC_DATE}.pdf"
            #    # Use eval to properly expand the filter arguments
            #    if ! eval "python3 ./aip.py pdf --output \"$OUTPUT_FILE\" summary --$FLIGHT_RULE -f $FILTER_ARGS 2>> \"$RUN_LOG_FILE\""; then
            #        echo "[$PROFILE_NAME] Error during PDF generation. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
            #        failed "$PROFILE_NAME" "$LAST_AIRAC_FILE"
            #        continue
            #    else
            #        echo "[$PROFILE_NAME] PDF generated at $OUTPUT_FILE"
            #    fi
            #fi
            
            # Generate PDF summary with proper output path
            echo "[$PROFILE_NAME] Downloading and Generating PDF summary"
            OUTPUT_FILE="/app/output/${PROFILE_NAME}-${CURRENT_AIRAC_DATE}.pdf"
            # Use the same eval approach here
            if ! eval "python3 ./aip.py pdf --output \"$OUTPUT_FILE\" summary --$FLIGHT_RULE -f $FILTER_ARGS 2>> \"$RUN_LOG_FILE\""; then
                echo "[$PROFILE_NAME] Error during PDF generation. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
                failed "$PROFILE_NAME" "$LAST_AIRAC_FILE"
                continue
            else
                echo "[$PROFILE_NAME] PDF generated at $OUTPUT_FILE"
                # Convert the generated PDF to make it OCR searchable
                echo "[$PROFILE_NAME] Generating OCR PDF"
                OCR_OUTPUT_FILE="/app/output/${PROFILE_NAME}-${CURRENT_AIRAC_DATE}_ocr.pdf"
                if ! ocrmypdf "$OUTPUT_FILE" "$OCR_OUTPUT_FILE" 2>> "$RUN_LOG_FILE"; then
                    echo "[$PROFILE_NAME] Error during OCR conversion. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
                    failed "$PROFILE_NAME" "$LAST_AIRAC_FILE"
                    continue
                else
                    echo "[$PROFILE_NAME] OCR conversion completed. Output at $OCR_OUTPUT_FILE"
                fi
            fi
        else
            echo "[$PROFILE_NAME] No AIP_SECTIONS specified. Skipping page fetch and PDF generation."
        fi
        
        # Update the last processed AIRAC date
        echo "$CURRENT_AIRAC_DATE" > "$LAST_AIRAC_FILE"
        echo "[$PROFILE_NAME] Updated last processed AIRAC date to $CURRENT_AIRAC_DATE"
        echo "[$(date)] [$PROFILE_NAME] Updated AIRAC from $LAST_AIRAC_DATE to $CURRENT_AIRAC_DATE" >> "$RUN_LOG_FILE"
    else
        echo "[$PROFILE_NAME] No new AIRAC cycle detected and no configuration changes. Current cycle ($CURRENT_AIRAC_DATE) already processed."
        echo "[$(date)] [$PROFILE_NAME] No new AIRAC cycle detected and no configuration changes. Current cycle ($CURRENT_AIRAC_DATE) already processed." >> "$RUN_LOG_FILE"
    fi
    
    echo "=== Completed profile: $PROFILE_NAME ==="
    echo "[$(date)] Completed profile: $PROFILE_NAME" >> "$RUN_LOG_FILE"
    echo ""
done

# Save the current config hash after successful processing
echo "$CURRENT_CONFIG_HASH" > "$CONFIG_HASH_FILE"
echo "[$(date)] Saved current configuration state" >> "$RUN_LOG_FILE"

echo "[$(date)] AIP update process completed for all profiles"
echo "[$(date)] Script execution completed" >> "$RUN_LOG_FILE"
echo "----------------------------------------" >> "$RUN_LOG_FILE"
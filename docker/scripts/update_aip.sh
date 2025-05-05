#!/bin/bash
echo "[$(date)] Starting AIP update process"
cd /app

CLEANED_SECTIONS=$(echo "$AIP_SECTIONS" | tr -d '"')


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

# Create a file to store the last processed AIRAC date
LAST_AIRAC_FILE="/root/.cache/last_airac_date.txt"
mkdir -p "$(dirname "$LAST_AIRAC_FILE")"
touch "$LAST_AIRAC_FILE"

# Get the last processed AIRAC date
LAST_AIRAC_DATE=$(cat "$LAST_AIRAC_FILE")

# Create a function to handle failures
failed() {
    # Reset last_airac_date to nothing on failure
    : > "$LAST_AIRAC_FILE"
    echo "[$(date)] Script execution failed" >> "$RUN_LOG_FILE"
    echo "----------------------------------------" >> "$RUN_LOG_FILE"
    exit 1
}

# Fetch the latest TOC
echo "Fetching latest AIP table of contents..."

if [ "$FLIGHT_RULE" = "IFR" ]; then
    python3 ./aip.py toc fetch --ifr
    RULE_FLAG="--ifr"
elif [ "$FLIGHT_RULE" = "VFR" ]; then
    RULE_FLAG="--vfr"
else
    echo "Invalid FLIGHT_RULE specified. Defaulting to VFR."
    RULE_FLAG="--vfr"
fi
python3 ./aip.py toc fetch $RULE_FLAG

# Get the current AIRAC date from the list (most recent one)
CURRENT_AIRAC_DATE=$(python3 ./aip.py toc list $RULE_FLAG | head -n 1 | awk '{print $2}')
echo "Current AIRAC date: $CURRENT_AIRAC_DATE"
echo "Previous AIRAC date: $LAST_AIRAC_DATE"

# Check if there's a new AIRAC cycle or force update
if [ "$CURRENT_AIRAC_DATE" != "$LAST_AIRAC_DATE" ]; then
    echo "New AIRAC cycle detected ($CURRENT_AIRAC_DATE). Updating..."
    echo "[$(date)] New AIRAC cycle detected ($CURRENT_AIRAC_DATE). Updating..." >> "$RUN_LOG_FILE"
    
        if [ -n "$AIP_SECTIONS" ]; then
        echo "Downloading sections: $CLEANED_SECTIONS"
        
        # Use the sections for page fetch - handle sections with proper quoting
        if ! python3 ./aip.py page fetch $RULE_FLAG -f "$CLEANED_SECTIONS" 2>> "$RUN_LOG_FILE"; then
            echo "Error during page fetch. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
            failed
        fi

        # Generate change log if we have a previous AIRAC to compare with
        if [ -n "$LAST_AIRAC_DATE" ]; then
            echo "Generating change log between $LAST_AIRAC_DATE and $CURRENT_AIRAC_DATE"
            DIFF_LOG_FILE="/app/output/aip-changes-${LAST_AIRAC_DATE}-to-${CURRENT_AIRAC_DATE}.txt"
            if ! python3 ./aip.py page diff $RULE_FLAG -b "$LAST_AIRAC_DATE" -a "$CURRENT_AIRAC_DATE" -f "$AIP_SECTIONS" > "$DIFF_LOG_FILE" 2>> "$RUN_LOG_FILE"; then
                echo "Error during page diff. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
                failed
            else
                echo "Change log generated at $DIFF_LOG_FILE"
            fi
        fi
        
        # Generate PDF summary with proper output path
        echo "Generating PDF summary"
        OUTPUT_FILE="/app/output/aip-summary-${CURRENT_AIRAC_DATE}.pdf"
        # Note: Corrected the --output argument to use the variable
        if ! python3 ./aip.py pdf --output "$OUTPUT_FILE" summary $RULE_FLAG -f "$CLEANED_SECTIONS" 2>> "$RUN_LOG_FILE"; then
            echo "Error during PDF generation. Check $RUN_LOG_FILE for details." | tee -a "$RUN_LOG_FILE"
            failed
        else
            echo "PDF generated at $OUTPUT_FILE"
        fi
    else
        echo "No AIP_SECTIONS specified. Skipping page fetch and PDF generation."
    fi
    
    # Update the last processed AIRAC date
    echo "$CURRENT_AIRAC_DATE" > "$LAST_AIRAC_FILE"
    echo "Updated last processed AIRAC date to $CURRENT_AIRAC_DATE"
    echo "[$(date)] Updated AIRAC from $LAST_AIRAC_DATE to $CURRENT_AIRAC_DATE" >> "$RUN_LOG_FILE"
else
    echo "No new AIRAC cycle detected. Current cycle ($CURRENT_AIRAC_DATE) already processed."
    echo "[$(date)] No new AIRAC cycle detected. Current cycle ($CURRENT_AIRAC_DATE) already processed." >> "$RUN_LOG_FILE"
fi

echo "[$(date)] AIP update process completed"
echo "[$(date)] Script execution completed" >> "$RUN_LOG_FILE"
echo "----------------------------------------" >> "$RUN_LOG_FILE"
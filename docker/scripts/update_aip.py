#!/usr/bin/env python3
# filepath: /mnt/c/Users/manue/Documents/personalDocuments/Code/Python/dfs-aip-docker-update/docker/scripts/update_aip.py
import os
import json
import hashlib
import subprocess
import datetime
import re
import sys
import ocrmypdf

root_directory = "/app/"  # Keep this definition as is

def log(message, log_file=None):
    """Log message to console and optionally to a file"""
    timestamp = datetime.datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
    formatted_message = f"{timestamp} {message}"
    print(formatted_message)
    if log_file:
        with open(log_file, "a") as f:
            f.write(f"{formatted_message}\n")

def run_command(command, log_file=None, capture_output=False):
    """Run a shell command and optionally log output"""
    try:
        if capture_output:
            result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
            return result.stdout.strip()
        else:
            result = subprocess.run(command, shell=True, check=True, text=True)
            return True
    except subprocess.CalledProcessError as e:
        error_msg = f"Command failed: {command}, Error: {str(e)}"
        log(error_msg, log_file)
        return None

def failed(profile, last_airac_file, run_log_file):
    """Handle failures"""
    with open(last_airac_file, "w") as f:
        f.write("")
    log(f"Script execution failed for profile {profile}", run_log_file)
    log("----------------------------------------", run_log_file)

def main():
    # Start the AIP update process
    log("Starting AIP update process")
    os.chdir(root_directory.rstrip("/"))

    # Read config.json
    config_file = os.path.join(root_directory, "config.json")
    run_log_file = os.path.join(root_directory, "output/aip-run-log.txt")
    log("Script execution started", run_log_file)

    # Create a hash of the config file to detect changes
    config_hash_dir = "/root/.cache"
    os.makedirs(config_hash_dir, exist_ok=True)
    config_hash_file = os.path.join(config_hash_dir, "config_hash.txt")
    
    # Calculate current config hash
    with open(config_file, "rb") as f:
        current_config_hash = hashlib.md5(f.read()).hexdigest()
    
    # Get previous hash if it exists
    previous_config_hash = ""
    if os.path.exists(config_hash_file):
        with open(config_hash_file, "r") as f:
            previous_config_hash = f.read().strip()
    
    config_changed = current_config_hash != previous_config_hash
    if config_changed:
        log("Configuration changed. Forcing updates.", run_log_file)

    # Check if aip.py has correct shebang and fix if needed
    aip_path = os.path.join(root_directory, "basic-aip/aip.py")
    with open(aip_path, "r") as f:
        content = f.read()
    
    if re.search(r"^#\!/bin/env", content):
        log("Fixing shebang in aip.py")
        content = re.sub(r"^#\!/bin/env", "#!/usr/bin/env", content)
        with open(aip_path, "w") as f:
            f.write(content)

    # Ensure script is executable
    os.chmod(aip_path, os.stat(aip_path).st_mode | 0o111)

    # Load the config file
    with open(config_file, "r") as f:
        config = json.load(f)
    
    profile_count = len(config["profiles"])
    log(f"Found {profile_count} profiles in config file", run_log_file)

    # Process each profile
    for i in range(profile_count):
        profile_data = config["profiles"][i]
        profile_name = profile_data["name"]
        flight_rule = profile_data["flight_rule"].lower()
        aip_sections = profile_data["filters"]
        
        log(f"=== Processing profile: {profile_name} ===", run_log_file)
        
        # Create a file to store the last processed AIRAC date for this profile
        last_airac_file = f"/root/.cache/last_airac_date_{profile_name}.txt"
        os.makedirs(os.path.dirname(last_airac_file), exist_ok=True)
        
        # Get the last processed AIRAC date
        last_airac_date = ""
        if os.path.exists(last_airac_file):
            with open(last_airac_file, "r") as f:
                last_airac_date = f.read().strip()
        
        # Fetch the latest TOC
        log(f"Fetching latest AIP table of contents for {profile_name}...")
        run_command(f"python3 {aip_path} toc fetch --{flight_rule}", run_log_file)
        
        # Get the current AIRAC date from the list (most recent one)
        current_airac_date = run_command(f"python3 {aip_path} toc list --{flight_rule} | head -n 1 | awk '{{print $2}}'", 
                                        run_log_file, capture_output=True)
        
        log(f"[{profile_name}] Current AIRAC date: {current_airac_date}, Previous AIRAC date: {last_airac_date}", run_log_file)
        
        # Check if there's a new AIRAC cycle or configuration changed
        if current_airac_date != last_airac_date or config_changed:
            # Different log message based on what triggered the update
            if config_changed and current_airac_date == last_airac_date:
                log(f"[{profile_name}] Configuration changed. Forcing update...", run_log_file)
            else:
                log(f"[{profile_name}] New AIRAC cycle detected ({current_airac_date}). Updating...", run_log_file)
            
            if aip_sections:
                log(f"[{profile_name}] Downloading sections: {' '.join(aip_sections)}", run_log_file)
                
                # Generate PDF summary with proper output path
                log(f"[{profile_name}] Downloading and Generating PDF summary", run_log_file)
                output_file = os.path.join(root_directory, f"output/{profile_name}-{current_airac_date}.pdf")
                
                # Prepare the filter arguments
                filter_args = " ".join([f'"{f}"' for f in aip_sections])
                command = f'python3 {aip_path} pdf --output "{output_file}" summary --{flight_rule} -f {filter_args}'
                
                if not run_command(command, run_log_file):
                    log(f"[{profile_name}] Error during PDF generation. Check {run_log_file} for details.", run_log_file)
                    failed(profile_name, last_airac_file, run_log_file)
                    continue
                else:
                    log(f"[{profile_name}] PDF generated at {output_file}")
                    # Convert the generated PDF to make it OCR searchable
                    log(f"[{profile_name}] Generating OCR PDF")
                    ocr_output_file = os.path.join(root_directory, f"output/{profile_name}-{current_airac_date}_ocr.pdf")
                    try:
                        # The quiet option suppresses progress messages
                        ocrmypdf.ocr(output_file, ocr_output_file, quiet=True)
                        log(f"[{profile_name}] OCR conversion completed. Output at {ocr_output_file}")
                    except Exception as e:
                        log(f"[{profile_name}] Error during OCR conversion: {str(e)}", run_log_file)
                        failed(profile_name, last_airac_file, run_log_file)
                        continue
            else:
                log(f"[{profile_name}] No AIP_SECTIONS specified. Skipping page fetch and PDF generation.")
            
            # Update the last processed AIRAC date
            with open(last_airac_file, "w") as f:
                f.write(current_airac_date)
            log(f"[{profile_name}] Updated AIRAC from {last_airac_date} to {current_airac_date}", run_log_file)
        else:
            log(f"[{profile_name}] No new AIRAC cycle detected and no configuration changes. Current cycle ({current_airac_date}) already processed.", run_log_file)
        
        log(f"=== Completed profile: {profile_name} ===", run_log_file)
        log("")

    # Save the current config hash after successful processing
    with open(config_hash_file, "w") as f:
        f.write(current_config_hash)
    log("Saved current configuration state", run_log_file)
    
    log("AIP update process completed for all profiles")
    log("Script execution completed", run_log_file)
    log("----------------------------------------", run_log_file)

if __name__ == "__main__":
    main()
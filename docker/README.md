# DFS-AIP Docker Component

This directory contains the Docker containerization of the DFS-AIP automated downloader system. The Docker component provides a scheduled, automated service for downloading and processing German aeronautical information publication (AIP) data.

## Overview

The Docker component creates a containerized service that:
- Automatically downloads AIP data from the DFS (Deutsche Flugsicherung) servers
- Processes and generates PDF summaries based on configured profiles
- Runs on a scheduled basis (default: daily at midnight)
- Provides OCR-searchable PDF outputs
- Maintains persistent cache and configuration data

## Architecture

### Container Structure
- **Base Image**: Debian Bookworm Slim
- **Runtime**: Python 3 with required dependencies
- **Scheduler**: Cron for automated execution
- **OCR Processing**: ocrmypdf for searchable PDF generation
- **Storage**: Persistent volumes for cache and output data

### Key Components

```
docker/
├── Dockerfile              # Container image definition
├── docker-compose.yaml     # Service orchestration
├── config.json            # AIP profiles configuration
├── README.md              # This documentation
├── cache/                 # Persistent cache directory
├── output/                # Generated PDF output directory
└── scripts/               # Container scripts
    ├── update_aip.py      # Main update logic
    ├── entrypoint.sh      # Container startup script
    └── requirements.txt   # Python dependencies
```

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Sufficient disk space for AIP data (several GB recommended)

### Basic Usage

1. **Start the service:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f
   ```

3. **Stop the service:**
   ```bash
   docker-compose down
   ```

## Configuration

### Environment Variables

Configure the container behavior through environment variables in `docker-compose.yaml`:

- **`AUTO_UPDATE_ON_START`** (default: `true`)
  - Set to `"true"` to run an immediate update when the container starts
  - Set to `"false"` to only run scheduled updates

- **`CRON_SCHEDULE`** (default: `"0 0 * * *"`)
  - Cron expression for scheduled updates
  - Default runs daily at midnight
  - Examples:
    - `"0 6 * * *"` - Daily at 6:00 AM
    - `"0 */12 * * *"` - Every 12 hours
    - `"0 8 * * 1"` - Weekly on Monday at 8:00 AM

### AIP Profiles Configuration

Edit `config.json` to define which AIP sections to download:

```json
{
    "profiles": [
        {
            "name": "Airports",
            "flight_rule": "vfr",
            "filters": ["AD"],
            "additional_params": ""
        },
        {
            "name": "General",
            "flight_rule": "vfr", 
            "filters": ["GEN"],
            "additional_params": ""
        }
    ]
}
```

**Profile Parameters:**
- **`name`**: Profile identifier (used in output filenames)
- **`flight_rule`**: Either `"vfr"` or `"ifr"`
- **`filters`**: Array of AIP section codes (e.g., `["AD"]`, `["GEN"]`, `["ENR"]`)
- **`additional_params`**: Additional parameters for the AIP script

### Available AIP Section Filters
- **`AD`**: Aerodromes (airports)
- **`GEN`**: General information
- **`ENR`**: En-route information
- **`...`**: Other AIP sections as supported by the base script

## Output Files

The container generates the following outputs in the `output/` directory:

### PDF Files
- **`{ProfileName}-{AIRAC-Date}.pdf`**: Standard PDF with AIP data
- **`{ProfileName}-{AIRAC-Date}_ocr.pdf`**: OCR-processed, searchable PDF

### Log Files
- **`aip-run-log.txt`**: Detailed execution logs with timestamps

### Example Output
```
output/
├── aip-run-log.txt
├── Airports-2025-05-01.pdf
├── Airports-2025-05-01_ocr.pdf
├── General-2025-05-01.pdf
└── General-2025-05-01_ocr.pdf
```

## Persistent Storage

### Cache Directory (`cache/`)
Contains cached data to avoid unnecessary re-downloads:
- **`config_hash.txt`**: Configuration change detection
- **`last_airac_date_{ProfileName}.txt`**: AIRAC cycle tracking
- **`dfs-aip/`**: Cached AIP data and PDFs

### Output Directory (`output/`)
Contains generated PDF files and logs.

**Important**: Both directories are mounted as Docker volumes to persist data between container restarts.

## Update Behavior

The system intelligently handles updates:

1. **AIRAC Cycle Detection**: Automatically detects new AIRAC cycles
2. **Configuration Changes**: Forces updates when `config.json` is modified
3. **Incremental Updates**: Only downloads new or changed data
4. **Cache Management**: Maintains local cache to minimize server load

### Update Triggers
- New AIRAC cycle published by DFS
- Configuration file (`config.json`) changes
- Manual execution of the update script

## Monitoring and Troubleshooting

### View Container Logs
```bash
# Follow live logs
docker-compose logs -f dfs-aip

# View specific number of log lines
docker-compose logs --tail 100 dfs-aip
```

### Check Update Status
```bash
# View last execution log
docker-compose exec dfs-aip cat /app/output/aip-run-log.txt

# Check cron status
docker-compose exec dfs-aip service cron status
```

### Manual Update Execution
```bash
# Run update immediately
docker-compose exec dfs-aip python3 /app/update_aip.py
```

### Common Issues

**Container won't start:**
- Check Docker and Docker Compose installation
- Verify sufficient disk space
- Check `docker-compose logs` for error messages

**No PDF output:**
- Verify `config.json` syntax and profile configuration
- Check container logs for download errors
- Ensure internet connectivity for DFS servers

**Updates not running:**
- Verify cron service is running: `docker-compose exec dfs-aip service cron status`
- Check cron schedule format in environment variables
- Review container logs for execution errors

## Advanced Usage

### Custom Cron Schedule
```yaml
environment:
  - CRON_SCHEDULE=0 6,18 * * *  # Twice daily at 6 AM and 6 PM
```

### Multiple Profiles
```json
{
    "profiles": [
        {
            "name": "Airports-VFR",
            "flight_rule": "vfr",
            "filters": ["AD"],
            "additional_params": ""
        },
        {
            "name": "Airports-IFR", 
            "flight_rule": "ifr",
            "filters": ["AD"],
            "additional_params": ""
        },
        {
            "name": "Complete-VFR",
            "flight_rule": "vfr",
            "filters": ["GEN", "AD", "ENR"],
            "additional_params": ""
        }
    ]
}
```

### Resource Limits
Add resource constraints in `docker-compose.yaml`:
```yaml
services:
  dfs-aip:
    # ... existing configuration ...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          memory: 512M
```

## Integration

### With External Systems
- Mount additional volumes for integration with other tools
- Use the generated PDFs in flight planning software
- Archive outputs to cloud storage services

### Backup Strategy
```bash
# Backup cache and output data
tar -czf aip-backup-$(date +%Y%m%d).tar.gz docker/cache/ docker/output/
```

## Support and Maintenance

### Updates and Maintenance
- Monitor DFS-AIP website changes that might break the scraper
- Keep Docker images updated for security patches
- Regular backup of cache and output directories

### Contributing
This component is part of the larger DFS-AIP project. For issues or improvements:
1. Check existing issues in the repository
2. Test changes in a development environment
3. Submit pull requests with clear descriptions

## Legal and Compliance

- **Data Source**: German AIP data from https://aip.dfs.de/
- **Usage**: Respect DFS terms of service and avoid excessive server load
- **Caching**: Implemented to minimize server requests and comply with usage guidelines
- **Personal Use**: Designed for personal aviation use; commercial use may require additional permissions

---

*This Docker component automates the process described in the main project documentation. For detailed information about the underlying AIP processing logic, see the [basic/README.md](../basic/README.md) documentation.*
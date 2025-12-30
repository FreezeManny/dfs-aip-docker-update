
# dfs-aip (Docker)

Lightweight Docker image and docker-compose setup to run the DFS AIP (Aeronautical Information Publication) update workflow.
Important: this container is currently built and tested for DFS BasicVFR only (VFR). Other AIP types or providers are untested and may not work.

## What this does

- Periodically fetches the DFS AIP table-of-contents (TOC).
- Downloads selected sections and generates a combined PDF summary for each configured profile.
- Produces an OCR-searchable PDF using ocrmypdf and tesseract.
- Stores outputs under the `output/` directory and keeps small run-state data in `cache/`.

## Directory contents
- `config.json` – Profiles and filters the update script will use (mapped into the container at `/app/config.json`).
- `output/` – Host-mounted folder for generated PDFs and run logs.
- `cache/` – Host-mounted folder used for small state files (last processed AIRAC dates, config hash).

## Configuration (`config.json`)

The container reads `/app/config.json` to know which profiles to process. The file structure is:

```json
{
	"profiles": [
		{
			"name": "GEN",
			"flight_rule": "vfr",
			"filters": ["GEN"],
			"additional_params": ""
		},
		{
			"name": "Airport Charts",
			"flight_rule": "vfr",
			"filters": ["AD"],
			"additional_params": ""
		}
	]
}
```

- `name` – A friendly name for the profile used when writing outputs and tracking state.
- `flight_rule` – The flight rule to fetch (currently VFR-only for DFS BasicVFR testing).
- `filters` – A list of section codes used by the `aip` tool to select which pages/sections to download.
- `additional_params` – Reserved for extra CLI args.

Notes:
- The updater stores the last processed AIRAC per-profile in `cache/last_airac_date_<PROFILE>.txt` and a config hash in the cache to detect config changes.
- If you change `config.json`, the script will force an update on the next run.

## Environment variables (docker-compose / docker run)

- `AUTO_UPDATE_ON_START` (default: `false`) – If set to `true`, the container will run the update once immediately after startup.
- `CRON_SCHEDULE` (default: `0 0 * * *`) – Cron schedule for periodic runs (default: daily at midnight). The `Dockerfile` writes this into `/etc/cron.d/aip-update`.

## How to run

Using docker-compose (recommended for local usage):

```bash
# Build and start the service (creates containers and volumes as configured)
docker-compose -f docker/docker-compose.yaml up --build -d

# View logs
docker-compose -f docker/docker-compose.yaml logs -f dfs-aip

# Run a manual update inside the running container
docker-compose -f docker/docker-compose.yaml exec dfs-aip /app/update_aip.sh
```


Adjust paths if you run the commands from a different working directory.

## Outputs and logs

- Generated PDFs and OCRed PDFs are written to the host-mounted `output/` directory. Filenames follow the pattern `<PROFILE>-<AIRAC>.pdf` and `<PROFILE>-<AIRAC>_ocr.pdf`.
- A per-run log is appended to `/app/output/aip-run-log.txt` inside the container (and visible on host as `docker/output/aip-run-log.txt`).
- Cron logs are written to `/var/log/cron.log` inside the container and tailed by the entrypoint to keep the container alive.

## Limitations & Notes

- Supported/ tested provider: DFS BasicVFR only. The workflow and filters have been validated for DFS BasicVFR (VFR) content. 
- The image includes OCR (ocrmypdf + tesseract). OCR can be CPU and time intensive depending on PDF size.
- The container uses host networking (`network_mode: host`) in the provided `docker-compose.yaml`. If you change this, ensure the `aip` tool still has network access to fetch DFS resources.

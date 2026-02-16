# DFS AIP Web Interface

A simple web-based interface for the DFS AIP (Aeronautical Information Publication) updater.

## Features

- **Profile Management**: Create and delete AIP download profiles
- **Automatic Updates**: Schedule nightly updates at a configurable time
- **Update Control**: Trigger updates manually for all or individual profiles
- **Run History**: View update history with status and detailed logs
- **Document Downloads**: Browse and download generated PDFs (with OCR)

## Quick Start

### Using Docker Compose (Recommended)

```bash
cd docker-webinterface

# Build and start both containers
docker-compose up --build -d

# View logs
docker-compose logs -f

# Access the web interface
open http://localhost:8080
```

### Development Mode

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173 (proxies /api to localhost:8000)
```

## Configuration

### Environment Variables (Backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_UPDATE_ENABLED` | `false` | Enable automatic nightly updates |
| `AUTO_UPDATE_HOUR` | `2` | Hour for automatic updates (0-23, 24-hour format) |
| `AUTO_UPDATE_MINUTE` | `0` | Minute for automatic updates (0-59) |


### Profile Configuration

Profiles are stored in `/app/data/profiles.json`:

```json
[
  {
    "name": "Airports",
    "flight_rule": "vfr",
    "filters": [
      "AD"
    ],
    "enabled": true
  },
  {
    "name": "GEN",
    "flight_rule": "vfr",
    "filters": [
      "GEN"
    ],
    "enabled": true
  }
]
```

## Notes

- OCR processing is included (using ocrmypdf + tesseract) and runs automatically after PDF generation
- Currently tested with DFS BasicVFR (VFR) only
- The backend container requires network access to fetch DFS resources
- Frontend container proxies `/api/*` requests to the backend via internal Docker network

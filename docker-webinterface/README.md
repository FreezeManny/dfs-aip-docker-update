# DFS AIP Web Interface

A simple web-based interface for the DFS AIP (Aeronautical Information Publication) updater.

## Features

- **Profile Management**: Create and delete AIP download profiles
- **Update Control**: Trigger updates manually for all or individual profiles
- **History**: View update history with status and file sizes
- **Document Downloads**: Browse and download generated PDFs

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Tailwind CSS + Nginx
- **Backend**: FastAPI + SQLAlchemy (SQLite)
- **Container**: Docker with docker-compose

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
| `CONFIG_FILE` | `/app/data/config.json` | Path to the configuration file |
| `OUTPUT_DIR` | `/app/data/output` | Directory for generated PDFs |
| `CACHE_DIR` | `/app/data/cache` | Directory for AIP cache |

### Profile Configuration

Profiles are stored in `config.json`:

```json
{
    "profiles": [
        {
            "name": "Airport Charts",
            "flight_rule": "vfr",
            "filters": ["AD"],
            "additional_params": ""
        },
        {
            "name": "General Info",
            "flight_rule": "vfr",
            "filters": ["GEN"],
            "additional_params": ""
        }
    ]
}
```

### Available Filters

| Filter | Description |
|--------|-------------|
| `GEN` | General Information |
| `ENR` | En-Route |
| `AD` | Aerodrome Charts |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get current configuration |
| POST | `/api/config` | Save configuration |
| POST | `/api/config/profile` | Add a new profile |
| DELETE | `/api/config/profile/{name}` | Delete a profile |
| POST | `/api/update/run` | Trigger an update |
| GET | `/api/update/status` | Get update status |
| GET | `/api/logs` | Get historical logs |
| GET | `/api/logs/stream` | SSE stream for live logs |
| GET | `/api/documents` | List available documents |
| GET | `/api/documents/{filename}` | Download a document |
| DELETE | `/api/documents/{filename}` | Delete a document |
| GET | `/api/airac` | Get available AIRAC cycles |

## Directory Structure

```
docker-webinterface/
├── backend/
│   ├── Dockerfile        # Backend container
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── Dockerfile        # Frontend container (Nginx)
│   ├── nginx.conf        # Nginx configuration
│   ├── src/
│   │   ├── App.vue
│   │   ├── api.ts        # API client
│   │   └── components/
│   │       ├── ProfileSettings.vue
│   │       ├── LogViewer.vue
│   │       ├── DocumentList.vue
│   │       └── StatusBar.vue
│   ├── package.json
│   └── vite.config.ts
├── data/                 # Mounted volume (shared)
│   ├── config.json
│   ├── output/           # Generated PDFs
│   └── cache/            # AIP cache
├── docker-compose.yaml
└── README.md
```

## Screenshots

The web interface includes three main tabs:

1. **Settings**: Configure AIP download profiles
2. **Logs**: View real-time and historical logs
3. **Documents**: Browse and download generated PDFs

## Notes

- OCR processing is included (using ocrmypdf + tesseract) and runs automatically after PDF generation
- Currently tested with DFS BasicVFR (VFR) only
- The backend container requires network access to fetch DFS resources
- Frontend container proxies `/api/*` requests to the backend via internal Docker network

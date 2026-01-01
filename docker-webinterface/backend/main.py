"""
DFS AIP Updater - Single-file FastAPI Backend
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from collections import deque

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ============== Config ==============

OUTPUT_DIR = Path("/app/output")
CACHE_DIR = Path("/app/cache")
DATA_DIR = Path("/app/data")
PROFILES_FILE = DATA_DIR / "profiles.json"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ============== App ==============

app = FastAPI(title="DFS AIP Updater", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_update_running = False
_progress_queue: deque = deque(maxlen=1000)  # Keep last 1000 messages


def _log_progress(profile: str, stage: str, message: str = "", status: str = "info"):
    """Log progress message with profile context"""
    msg = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "profile": profile,
        "stage": stage,
        "message": message,
        "status": status,  # "info", "warning", "error", "success"
    }
    _progress_queue.append(json.dumps(msg))
    logger.info(f"[{profile}] {stage}: {message}")


# ============== Models ==============

class ProfileData(BaseModel):
    name: str
    flight_rule: str = "vfr"
    filters: list[str] = []
    enabled: bool = True


# ============== Profile Storage ==============

def _load_profiles() -> list[dict]:
    if not PROFILES_FILE.exists():
        return []
    return json.loads(PROFILES_FILE.read_text())


def _save_profiles(profiles: list[dict]) -> None:
    PROFILES_FILE.write_text(json.dumps(profiles, indent=2))


def _sanitize(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name)


# ============== Profile Endpoints ==============

@app.get("/api/profiles")
def list_profiles():
    return {"profiles": sorted(_load_profiles(), key=lambda x: x["name"])}


@app.post("/api/profiles")
def create_profile(data: ProfileData):
    profiles = _load_profiles()
    if any(p["name"] == data.name for p in profiles):
        raise HTTPException(400, f"Profile '{data.name}' already exists")
    
    profiles.append(data.model_dump())
    _save_profiles(profiles)
    (OUTPUT_DIR / _sanitize(data.name)).mkdir(parents=True, exist_ok=True)
    return {"status": "ok"}


@app.put("/api/profiles/{name}")
def update_profile(name: str, data: ProfileData):
    profiles = _load_profiles()
    for i, p in enumerate(profiles):
        if p["name"] == name:
            profiles[i] = data.model_dump()
            _save_profiles(profiles)
            return {"status": "ok"}
    raise HTTPException(404, "Profile not found")


@app.delete("/api/profiles/{name}")
def delete_profile(name: str):
    profiles = _load_profiles()
    new_profiles = [p for p in profiles if p["name"] != name]
    if len(new_profiles) == len(profiles):
        raise HTTPException(404, "Profile not found")
    _save_profiles(new_profiles)
    return {"status": "ok"}


# ============== Update ==============

@app.get("/api/update/progress")
async def get_update_progress():
    """Server-Sent Events endpoint for real-time progress"""
    async def event_generator():
        # Send all existing messages
        for msg in _progress_queue:
            yield f"data: {msg}\n\n"
        
        # Keep connection open and send new messages as they arrive
        last_index = len(_progress_queue)
        while _update_running or last_index < len(_progress_queue):
            if last_index < len(_progress_queue):
                msg = _progress_queue[last_index]
                yield f"data: {msg}\n\n"
                last_index += 1
            else:
                await asyncio.sleep(0.1)
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


async def run_update(profile_name: str | None = None):
    global _update_running
    _update_running = True
    _progress_queue.clear()
    _log_progress("", "system", "Starting update process", "info")

    try:
        profiles = [p for p in _load_profiles() if p.get("enabled", True)]
        if profile_name:
            profiles = [p for p in profiles if p["name"] == profile_name]

        _log_progress("", "system", f"Found {len(profiles)} profile(s) to process", "info")

        for profile in profiles:
            profile_name_str = profile['name']
            try:
                _log_progress(profile_name_str, "init", "Starting profile processing", "info")
                profile_dir = OUTPUT_DIR / _sanitize(profile["name"])
                profile_dir.mkdir(parents=True, exist_ok=True)
                cache_path = str(CACHE_DIR / "dfs-aip")

                # Fetch TOC
                _log_progress(profile_name_str, "toc_fetch", f"Fetching TOC ({profile['flight_rule'].upper()})", "info")
                proc = await asyncio.create_subprocess_exec(
                    "python3", "/app/aip.py", "--cache", cache_path,
                    "toc", "fetch", f"--{profile['flight_rule']}",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await proc.communicate()
                if proc.returncode != 0:
                    _log_progress(profile_name_str, "toc_fetch", f"Failed: {stderr.decode()[:200]}", "error")
                    continue
                _log_progress(profile_name_str, "toc_fetch", "TOC fetched successfully", "success")

                # Get AIRAC date
                proc = await asyncio.create_subprocess_exec(
                    "python3", "/app/aip.py", "--cache", cache_path,
                    "toc", "list", f"--{profile['flight_rule']}",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await proc.communicate()

                lines = stdout.decode().strip().split('\n')
                if not lines or not lines[0].strip():
                    _log_progress(profile_name_str, "init", "No AIRAC cycles found", "warning")
                    continue

                airac_date = lines[0].split()[1]
                profile_sanitized = _sanitize(profile['name'])
                output_path = profile_dir / f"{profile_sanitized}_{airac_date}.pdf"
                ocr_output_path = profile_dir / f"{profile_sanitized}_{airac_date}_ocr.pdf"
                _log_progress(profile_name_str, "init", f"AIRAC date: {airac_date}", "info")
                
                # Check if we need to generate PDF
                if output_path.exists():
                    _log_progress(profile_name_str, "pdf_gen", "PDF already exists", "info")
                else:
                    # Generate PDF
                    _log_progress(profile_name_str, "pdf_gen", "Generating PDF", "info")
                    filter_args = [arg for f in profile.get("filters", []) for arg in ["-f", f]]
                    proc = await asyncio.create_subprocess_exec(
                        "python3", "-u", "/app/aip.py", "--cache", cache_path,
                        "pdf", "--output", str(output_path),
                        "summary", f"--{profile['flight_rule']}", *filter_args,
                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                    )
                    
                    # Stream stdout to show page downloads
                    page_count = 0
                    while True:
                        line = await proc.stdout.readline()
                        if not line:
                            break
                        page_name = line.decode().strip()
                        if page_name:
                            page_count += 1
                            _log_progress(profile_name_str, "pdf_gen", f"Downloaded page {page_count}: {page_name}", "info")
                    
                    await proc.wait()
                    stderr = await proc.stderr.read()

                    if proc.returncode == 0:
                        size_mb = output_path.stat().st_size / (1024 * 1024)
                        _log_progress(profile_name_str, "pdf_gen", f"PDF complete ({size_mb:.1f} MB)", "success")
                    else:
                        _log_progress(profile_name_str, "pdf_gen", f"Failed: {stderr.decode()[:200]}", "error")
                        continue

                # Check if we need to generate OCR version
                if not ocr_output_path.exists():
                    # Generate OCR version
                    _log_progress(profile_name_str, "ocr", "Generating searchable OCR PDF", "info")
                    proc = await asyncio.create_subprocess_exec(
                        "ocrmypdf", str(output_path), str(ocr_output_path),
                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                    )
                    stdout, stderr = await proc.communicate()
                    if proc.returncode == 0:
                        ocr_size_mb = ocr_output_path.stat().st_size / (1024 * 1024)
                        _log_progress(profile_name_str, "ocr", f"OCR complete ({ocr_size_mb:.1f} MB)", "success")
                    else:
                        _log_progress(profile_name_str, "ocr", f"Failed: {stderr.decode()[:200]}", "error")
                else:
                    _log_progress(profile_name_str, "ocr", "OCR PDF already exists", "success")
                
                _log_progress(profile_name_str, "complete", "Profile processing complete", "success")

            except Exception as e:
                _log_progress(profile_name_str, "error", f"Exception: {str(e)[:200]}", "error")
    finally:
        _update_running = False
        _log_progress("", "system", "Update process finished", "info")


@app.post("/api/update/run")
async def trigger_update(background_tasks: BackgroundTasks, profile: str | None = None):
    if _update_running:
        raise HTTPException(409, "Update already running")
    background_tasks.add_task(run_update, profile)
    return {"status": "ok"}


# ============== Documents ==============

@app.get("/api/documents")
def list_documents():
    documents = []
    for profile_dir in OUTPUT_DIR.iterdir():
        if profile_dir.is_dir():
            for f in profile_dir.glob("*.pdf"):
                stat = f.stat()
                is_ocr = f.stem.endswith("_ocr")
                stem = f.stem.replace("_ocr", "") if is_ocr else f.stem
                # Extract airac_date from "ProfileName_YYYY-MM-DD" format
                parts = stem.split("_", 1)  # Split on first underscore
                airac_date = parts[1] if len(parts) > 1 else stem
                documents.append({
                    "name": f.name,
                    "profile": profile_dir.name,
                    "airac_date": airac_date,
                    "path": str(f.relative_to(OUTPUT_DIR)),
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                    "is_ocr": is_ocr,
                })
    return {"documents": sorted(documents, key=lambda x: x["modified"], reverse=True)}


@app.get("/api/documents/{profile}/{filename}")
def download_document(profile: str, filename: str):
    file_path = OUTPUT_DIR / profile / filename
    if not file_path.exists():
        raise HTTPException(404, "Document not found")
    return FileResponse(file_path, media_type="application/pdf", filename=filename)


@app.delete("/api/documents/{profile}/{filename}")
def delete_document(profile: str, filename: str):
    file_path = OUTPUT_DIR / profile / filename
    if not file_path.exists():
        raise HTTPException(404, "Document not found")
    file_path.unlink()
    return {"status": "ok"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

import secrets
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import config, engines

app = FastAPI(title="Caption Studio AI service", version="0.1.0", docs_url=None, redoc_url=None)
pool = ThreadPoolExecutor(max_workers=1)  # one CPU-bound transcription at a time
jobs: dict[str, dict] = {}
lock = threading.Lock()


def auth(x_internal_token: str = Header(default="")):
    if config.TOKEN and not secrets.compare_digest(x_internal_token, config.TOKEN):
        raise HTTPException(401, "invalid token")


def confined(path: str) -> Path:
    """Only files inside STORAGE_ROOT may be read (blocks path traversal and symlink escapes)."""
    p = Path(path).resolve()
    try:
        p.relative_to(config.STORAGE_ROOT)
    except ValueError:
        raise HTTPException(400, "path is outside the storage root")
    if not p.is_file():
        raise HTTPException(404, "file not found")
    return p


class TranscribeIn(BaseModel):
    path: str
    language: Optional[str] = Field(default=None, pattern=r"^[a-z]{2,3}$")
    engine: Literal["auto", "faster-whisper", "pocketsphinx"] = "auto"
    model: Optional[str] = Field(default=None, pattern=r"^[\w.\-/]{1,80}$")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/v1/engines", dependencies=[Depends(auth)])
def list_engines():
    return engines.describe()


def _run(job_id: str, req: TranscribeIn, path: Path):
    def progress(p: float, stage: str):
        with lock:
            jobs[job_id].update(progress=round(p, 3), stage=stage, status="running")

    try:
        res = engines.run(path, req.engine, req.language, req.model, progress)
        with lock:
            jobs[job_id].update(status="done", progress=1.0, stage="done", result=asdict(res))
    except Exception as e:  # report to the client instead of dying silently
        with lock:
            jobs[job_id].update(status="failed", error=f"{type(e).__name__}: {str(e)[:400]}", stage="failed")


@app.post("/v1/jobs/transcribe", dependencies=[Depends(auth)])
def start_transcribe(req: TranscribeIn):
    path = confined(req.path)
    job_id = uuid.uuid4().hex[:16]
    with lock:
        jobs[job_id] = {"id": job_id, "status": "queued", "progress": 0.0, "stage": "queued", "error": None, "result": None}
    pool.submit(_run, job_id, req, path)
    return {"id": job_id}


@app.get("/v1/jobs/{job_id}", dependencies=[Depends(auth)])
def get_job(job_id: str):
    with lock:
        j = jobs.get(job_id)
    if not j:
        raise HTTPException(404, "unknown job")
    return j

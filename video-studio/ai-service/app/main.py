import secrets
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import config, engines, vision

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


class SegmentIn(BaseModel):
    path: str
    out_dir: str
    fps: float = Field(default=30, ge=1, le=60)


class TrackIn(BaseModel):
    path: str
    fps: float = Field(default=30, ge=1, le=60)
    start_ms: int = Field(default=0, ge=0)
    end_ms: Optional[int] = Field(default=None, ge=0)
    roi: dict


def confined_dir(path: str) -> Path:
    p = Path(path).resolve()
    try:
        p.relative_to(config.STORAGE_ROOT)
    except ValueError:
        raise HTTPException(400, "path is outside the storage root")
    return p


def _submit(kind: str, fn):
    job_id = uuid.uuid4().hex[:16]
    with lock:
        jobs[job_id] = {"id": job_id, "status": "queued", "progress": 0.0, "stage": "queued", "error": None, "result": None}

    def progress(p: float, stage: str):
        with lock:
            jobs[job_id].update(progress=round(p, 3), stage=stage, status="running")

    def work():
        try:
            res = fn(progress)
            with lock:
                jobs[job_id].update(status="done", progress=1.0, stage="done", result=res)
        except Exception as e:
            with lock:
                jobs[job_id].update(status="failed", error=f"{type(e).__name__}: {str(e)[:400]}", stage="failed")

    pool.submit(work)
    return {"id": job_id}


@app.post("/v1/jobs/segment", dependencies=[Depends(auth)])
def start_segment(req: SegmentIn):
    src = confined(req.path)
    out = confined_dir(req.out_dir)
    return _submit("segment", lambda progress: vision.segment_video(src, out, req.fps, progress))


@app.post("/v1/jobs/track", dependencies=[Depends(auth)])
def start_track(req: TrackIn):
    src = confined(req.path)
    r = req.roi
    if not all(k in r and isinstance(r[k], (int, float)) for k in ("x", "y", "w", "h")) or r["w"] <= 0.01 or r["h"] <= 0.01 or not (0 <= r["x"] < 1 and 0 <= r["y"] < 1):
        raise HTTPException(422, "roi must be normalized {x,y,w,h} with a region of at least 1% of the frame")
    return _submit("track", lambda progress: vision.track_region(src, r, req.start_ms, req.fps, progress, req.end_ms))


class FacesIn(BaseModel):
    path: str
    sample_fps: float = Field(default=10, ge=1, le=30)
    max_ms: Optional[int] = Field(default=None, ge=0)


@app.post("/v1/jobs/faces", dependencies=[Depends(auth)])
def start_faces(req: FacesIn):
    from . import faces
    src = confined(req.path)
    return _submit("faces", lambda progress: faces.analyse_faces(src, progress, req.sample_fps, max_ms=req.max_ms))

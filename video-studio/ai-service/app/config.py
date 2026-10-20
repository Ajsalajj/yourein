import os
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
# Media paths handed to the service must live under this directory (the Next.js app's data/projects).
STORAGE_ROOT = Path(os.environ.get("STORAGE_ROOT", HERE.parent / "data" / "projects")).resolve()
TOKEN = os.environ.get("AI_SERVICE_TOKEN", "")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
WHISPER_CACHE = os.environ.get("WHISPER_CACHE", str(HERE / "models"))
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "auto")
WHISPER_COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
FFMPEG = os.environ.get("FFMPEG_PATH", "ffmpeg")

import subprocess
import tempfile
import wave
from contextlib import contextmanager
from pathlib import Path

from .config import FFMPEG


@contextmanager
def decoded_wav(src: Path):
    """Decode any media file to 16 kHz mono PCM WAV in a temp dir (removed afterwards)."""
    with tempfile.TemporaryDirectory(prefix="ai-asr-") as tmp:
        out = Path(tmp) / "audio.wav"
        r = subprocess.run(
            [FFMPEG, "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(out)],
            capture_output=True, text=True, timeout=3600,
        )
        if r.returncode != 0 or not out.exists():
            raise RuntimeError(f"ffmpeg could not decode audio: {r.stderr.strip()[:300]}")
        yield out


def wav_duration_ms(path: Path) -> int:
    with wave.open(str(path), "rb") as w:
        return int(w.getnframes() / w.getframerate() * 1000)

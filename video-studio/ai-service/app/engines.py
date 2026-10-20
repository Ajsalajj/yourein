"""Speech-to-text engines. Each reports honestly whether it can run *here*."""
from __future__ import annotations

import importlib.util
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from . import config
from .audio import decoded_wav, wav_duration_ms

Progress = Callable[[float, str], None]

SPACE_SEPARATED_NOTE = "Word timestamps come from Whisper's cross-attention alignment; accuracy varies by language and audio quality."


@dataclass
class Word:
    text: str
    startMs: int
    endMs: int
    confidence: float
    timingSource: str  # "asr" | "interpolated"


@dataclass
class Result:
    engine: str
    model: str
    language: str
    languageProbability: Optional[float]
    wordTimestampsNative: bool
    durationMs: int
    warnings: list[str] = field(default_factory=list)
    words: list[Word] = field(default_factory=list)


def _has(mod: str) -> bool:
    return importlib.util.find_spec(mod) is not None


# ───────────────────────── faster-whisper ─────────────────────────
_fw_model = None
_fw_key = None


def fw_model_cached(model: str) -> bool:
    try:
        from faster_whisper.utils import download_model

        download_model(model, local_files_only=True, cache_dir=config.WHISPER_CACHE)
        return True
    except Exception:
        return False


def _load_fw(model: str):
    global _fw_model, _fw_key
    key = (model, config.WHISPER_DEVICE, config.WHISPER_COMPUTE)
    if _fw_model is None or _fw_key != key:
        from faster_whisper import WhisperModel

        _fw_model = WhisperModel(model, device=config.WHISPER_DEVICE, compute_type=config.WHISPER_COMPUTE, download_root=config.WHISPER_CACHE)
        _fw_key = key
    return _fw_model


def _interpolate(text: str, start: float, end: float, conf: float) -> list[Word]:
    toks = text.split()
    if not toks:
        return []
    weights = [max(1, len(t)) for t in toks]
    total = sum(weights)
    span = max(end - start, 0.05 * len(toks))
    t = start
    out = []
    for tok, wt in zip(toks, weights):
        d = span * wt / total
        out.append(Word(tok, int(t * 1000), int((t + d) * 1000), conf, "interpolated"))
        t += d
    return out


def transcribe_faster_whisper(path: Path, language: Optional[str], model: Optional[str], progress: Progress) -> Result:
    name = model or config.WHISPER_MODEL
    progress(0.02, f"loading model '{name}'")
    wm = _load_fw(name)
    with decoded_wav(path) as wav:
        dur_ms = wav_duration_ms(wav)
        progress(0.08, "transcribing")
        segments, info = wm.transcribe(str(wav), language=language, word_timestamps=True, vad_filter=True, beam_size=5, condition_on_previous_text=False)
        words: list[Word] = []
        warnings: list[str] = []
        interpolated = 0
        for seg in segments:
            progress(min(0.97, 0.08 + 0.89 * (seg.end * 1000 / max(dur_ms, 1))), "transcribing")
            if seg.words:
                for w in seg.words:
                    txt = w.word.strip()
                    if txt:
                        words.append(Word(txt, int(w.start * 1000), int(w.end * 1000), float(w.probability), "asr"))
            else:
                ws = _interpolate(seg.text.strip(), seg.start, seg.end, float(max(0.0, min(1.0, 1 + (seg.avg_logprob or -0.5))))) 
                interpolated += len(ws)
                words.extend(ws)
        if interpolated:
            warnings.append(f"{interpolated} words had no native timestamps and were spread evenly across their segment (timingSource='interpolated'). Check them in the timing editor.")
        warnings.append(SPACE_SEPARATED_NOTE)
        return Result("faster-whisper", name, info.language, float(info.language_probability), True, dur_ms, warnings, words)


# ───────────────────────── pocketsphinx (offline English) ─────────────────────────
_NOISE = re.compile(r"^(<.*>|\[.*\]|\+\+.*\+\+)$")


def transcribe_pocketsphinx(path: Path, language: Optional[str], progress: Progress) -> Result:
    if language not in (None, "en"):
        raise RuntimeError("The pocketsphinx engine only supports English")
    from pocketsphinx import Decoder

    progress(0.02, "loading model")
    dec = Decoder(loglevel="FATAL")
    with decoded_wav(path) as wav:
        dur_ms = wav_duration_ms(wav)
        with open(wav, "rb") as f:
            raw = f.read()[44:]
        step = 16000 * 2 * 10  # 10 s chunks keep progress responsive
        dec.start_utt()
        for i in range(0, len(raw), step):
            dec.process_raw(raw[i : i + step], no_search=False, full_utt=False)
            progress(0.05 + 0.9 * min(1.0, (i + step) / max(len(raw), 1)), "transcribing")
        dec.end_utt()
        words: list[Word] = []
        for s in dec.seg():
            w = re.sub(r"\(\d+\)$", "", s.word)
            if _NOISE.match(w) or not w:
                continue
            words.append(Word(w, s.start_frame * 10, max(s.end_frame * 10 + 10, s.start_frame * 10 + 40), 0.5, "asr"))
    warnings = [
        "Engine 'pocketsphinx' is a small offline English recogniser. Expect many wrong words - review and correct the captions.",
        "This engine does not provide meaningful confidence scores; every word is reported as 0.5.",
    ]
    return Result("pocketsphinx", "en-us (bundled)", "en", None, True, dur_ms, warnings, words)


# ───────────────────────── registry ─────────────────────────
def describe() -> dict:
    fw_ok = _has("faster_whisper")
    ps_ok = _has("pocketsphinx")
    engines = [
        {
            "id": "faster-whisper",
            "available": fw_ok,
            "languages": "auto",
            "modelReady": fw_model_cached(config.WHISPER_MODEL) if fw_ok else False,
            "note": (f"Whisper '{config.WHISPER_MODEL}' - auto language detection, word timestamps. "
                     + ("Model is cached locally." if fw_ok and fw_model_cached(config.WHISPER_MODEL) else "Model weights are NOT cached yet; they are downloaded from Hugging Face on first use (needs internet)."))
            if fw_ok else "Package faster-whisper is not installed.",
        },
        {"id": "pocketsphinx", "available": ps_ok, "languages": ["en"], "modelReady": ps_ok, "note": "Offline English only, low accuracy, works without any download."},
    ]
    default = "faster-whisper" if engines[0]["available"] and engines[0]["modelReady"] else ("pocketsphinx" if ps_ok else None)
    return {"engines": engines, "defaultEngine": default}


def run(path: Path, engine: str, language: Optional[str], model: Optional[str], progress: Progress) -> Result:
    info = describe()
    by_id = {e["id"]: e for e in info["engines"]}
    warnings: list[str] = []
    if engine == "auto":
        fw = by_id["faster-whisper"]
        if fw["available"] and fw["modelReady"]:
            engine = "faster-whisper"
        elif fw["available"]:
            # Not cached: try to download; fall back only if that fails.
            try:
                return transcribe_faster_whisper(path, language, model, progress)
            except Exception as e:  # network / model errors
                if language in (None, "en") and by_id["pocketsphinx"]["available"]:
                    warnings.append(f"Whisper could not start ({type(e).__name__}: {str(e)[:160]}); used the offline English fallback instead.")
                    engine = "pocketsphinx"
                else:
                    raise RuntimeError(f"Whisper model is unavailable ({str(e)[:200]}) and no offline engine supports language '{language}'. Download the model once with internet access or set WHISPER_CACHE.")
        elif by_id["pocketsphinx"]["available"]:
            engine = "pocketsphinx"
        else:
            raise RuntimeError("No speech engine is installed")
    if engine == "faster-whisper":
        return transcribe_faster_whisper(path, language, model, progress)
    res = transcribe_pocketsphinx(path, language, progress)
    res.warnings = warnings + res.warnings
    return res

"""The faster-whisper adapter, exercised with a stub model (real weights cannot be downloaded in CI/offline).
This verifies OUR conversion logic - word mapping, progress, interpolation fallback - not Whisper's accuracy."""
import subprocess
from types import SimpleNamespace as NS

import pytest

from app import engines


@pytest.fixture()
def wav(tmp_path):
    f = tmp_path / "a.wav"
    subprocess.run(["espeak-ng", "-w", str(f), "hello world from a stub"], check=True)
    return f


class StubModel:
    def transcribe(self, path, **kw):
        assert kw["word_timestamps"] is True and kw["vad_filter"] is True
        segs = [
            NS(start=0.0, end=1.0, text=" hello world", avg_logprob=-0.2, words=[NS(word=" hello", start=0.0, end=0.4, probability=0.9), NS(word=" world", start=0.5, end=1.0, probability=0.8)]),
            # a segment with no word timestamps -> must be interpolated and flagged
            NS(start=1.2, end=2.2, text=" നമസ്കാരം കേരളം", avg_logprob=-0.4, words=None),
        ]
        return iter(segs), NS(language="ml", language_probability=0.93)


def test_conversion_and_interpolation(wav, monkeypatch):
    monkeypatch.setattr(engines, "_load_fw", lambda name: StubModel())
    seen = []
    r = engines.transcribe_faster_whisper(wav, None, "tiny", lambda p, s: seen.append(p))
    assert r.engine == "faster-whisper" and r.language == "ml" and abs(r.languageProbability - 0.93) < 1e-9
    assert [w.text for w in r.words] == ["hello", "world", "നമസ്കാരം", "കേരളം"]
    assert [w.timingSource for w in r.words] == ["asr", "asr", "interpolated", "interpolated"]
    assert r.words[0].startMs == 0 and r.words[1].endMs == 1000
    assert 1200 <= r.words[2].startMs < r.words[3].startMs <= 2200
    assert any("spread evenly" in w for w in r.warnings)
    assert seen == sorted(seen) and seen[-1] <= 0.97


def test_auto_falls_back_to_pocketsphinx_when_whisper_cannot_load(wav, monkeypatch):
    def boom(*a, **k):
        raise OSError("no network")
    monkeypatch.setattr(engines, "fw_model_cached", lambda m: False)
    monkeypatch.setattr(engines, "_load_fw", boom)
    r = engines.run(wav, "auto", None, None, lambda p, s: None)
    assert r.engine == "pocketsphinx"
    assert any("could not start" in w for w in r.warnings)


def test_auto_refuses_non_english_without_whisper(wav, monkeypatch):
    monkeypatch.setattr(engines, "fw_model_cached", lambda m: False)
    monkeypatch.setattr(engines, "_load_fw", lambda n: (_ for _ in ()).throw(OSError("no network")))
    with pytest.raises(RuntimeError, match="no offline engine supports language 'ml'"):
        engines.run(wav, "auto", "ml", None, lambda p, s: None)

import subprocess, time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


@pytest.fixture()
def speech(tmp_path, monkeypatch):
    root = tmp_path / "projects"
    (root / "p1").mkdir(parents=True)
    monkeypatch.setattr(config, "STORAGE_ROOT", root.resolve())
    wav = root / "p1" / "s.wav"
    subprocess.run(["espeak-ng", "-s", "130", "-w", str(wav), "hello everyone welcome to the channel"], check=True)
    return wav


def test_rejects_path_outside_storage(speech):
    r = client.post("/v1/jobs/transcribe", json={"path": "/etc/passwd"})
    assert r.status_code == 400


def test_rejects_traversal(speech):
    r = client.post("/v1/jobs/transcribe", json={"path": str(speech.parent / ".." / ".." / "x")})
    assert r.status_code in (400, 404)


def test_engines_reports_state():
    r = client.get("/v1/engines").json()
    assert {e["id"] for e in r["engines"]} == {"faster-whisper", "pocketsphinx"}


def test_pocketsphinx_end_to_end(speech):
    r = client.post("/v1/jobs/transcribe", json={"path": str(speech), "engine": "pocketsphinx"})
    jid = r.json()["id"]
    for _ in range(120):
        j = client.get(f"/v1/jobs/{jid}").json()
        if j["status"] in ("done", "failed"):
            break
        time.sleep(0.5)
    assert j["status"] == "done", j
    words = j["result"]["words"]
    assert words and all(w["endMs"] > w["startMs"] for w in words)
    assert all(a["startMs"] <= b["startMs"] for a, b in zip(words, words[1:]))


def test_pocketsphinx_rejects_other_languages(speech):
    jid = client.post("/v1/jobs/transcribe", json={"path": str(speech), "engine": "pocketsphinx", "language": "ml"}).json()["id"]
    time.sleep(1.5)
    assert client.get(f"/v1/jobs/{jid}").json()["status"] == "failed"

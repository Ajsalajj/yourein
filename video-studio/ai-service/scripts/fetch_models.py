"""Fetch the Apache-2.0 MediaPipe selfie-segmentation model (and face detector) from the official PyPI wheel.

Hugging Face / Google storage are not needed: older `mediapipe` wheels bundle the .tflite files inside the package.
Usage: .venv/bin/python scripts/fetch_models.py
"""
import subprocess, sys, tempfile, zipfile
from pathlib import Path

WANT = {
    "mediapipe/modules/selfie_segmentation/selfie_segmentation.tflite": "selfie_segmentation.tflite",
    "mediapipe/modules/face_detection/face_detection_short_range.tflite": "face_detection_short_range.tflite",
}
OUT = Path(__file__).resolve().parent.parent / "models"
OUT.mkdir(exist_ok=True)
if all((OUT / v).exists() for v in WANT.values()):
    print("models already present"); sys.exit(0)
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run([sys.executable, "-m", "pip", "download", "mediapipe==0.10.14", "--no-deps", "--only-binary=:all:", "--python-version", "3.12", "--platform", "manylinux2014_x86_64", "-d", tmp, "-q"], check=True)
    whl = next(Path(tmp).glob("mediapipe-*.whl"))
    with zipfile.ZipFile(whl) as z:
        for src, name in WANT.items():
            (OUT / name).write_bytes(z.read(src)); print("wrote", OUT / name)

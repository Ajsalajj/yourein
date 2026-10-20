#!/usr/bin/env bash
# Person test clip for segmentation/tracking: public-domain NASA astronaut portrait (bundled in scikit-image),
# composited over a blurred copy of itself and given a slow pan/zoom so the subject really moves in frame.
# Output: data/samples/person.mp4 (720x1280, 30 fps, 12 s, with synthetic narration)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=data/samples; mkdir -p "$OUT"
PY=ai-service/.venv/bin/python
$PY - <<'PYEOF'
from skimage import data
from PIL import Image, ImageFilter
im = Image.fromarray(data.astronaut())                      # 512x512, public domain (NASA)
bg = im.resize((1280, 1280), Image.LANCZOS).crop((280, 0, 1000, 1280)).filter(ImageFilter.GaussianBlur(28))
fg = im.resize((720, 720), Image.LANCZOS)
bg.paste(fg, (0, 330)); bg.save("data/samples/person_still.png")
PYEOF
espeak-ng -v en-us -s 140 -w "$OUT/person.wav" "Meet the explorer. Titles can sit behind her, and labels can follow her patch as the camera moves."
ffmpeg -v error -y -loop 1 -framerate 30 -i "$OUT/person_still.png" -i "$OUT/person.wav" \
  -vf "scale=1440:2560,zoompan=z='1.0+0.0006*on':x='(iw-iw/zoom)/2+60*sin(on/60)':y='(ih-ih/zoom)/2+40*cos(on/75)':d=1:s=720x1280:fps=30,format=yuv420p" \
  -t 12 -c:v libx264 -crf 20 -c:a aac -shortest "$OUT/person.mp4"
ffprobe -v error -show_entries stream=codec_name,width,height,duration -of csv=p=0 "$OUT/person.mp4"

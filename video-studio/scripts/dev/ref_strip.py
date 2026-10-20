"""Native-frame filmstrip of a window (analysis only). usage: ref_strip.py video out.png t0 t1 [crop x0 y0 x1 y1 (fractions)] [cols]"""
import sys, cv2, numpy as np
from PIL import Image, ImageDraw
v, out, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
c = [float(x) for x in sys.argv[5:9]] if len(sys.argv) >= 9 else [0, 0, 1, 1]
cols = int(sys.argv[9]) if len(sys.argv) > 9 else 6
cap = cv2.VideoCapture(v); fps = cap.get(cv2.CAP_PROP_FPS)
cap.set(cv2.CAP_PROP_POS_MSEC, t0 * 1000)
tiles = []
while True:
    ok, f = cap.read(); t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000 - 1 / fps
    if not ok or t > t1: break
    H, W = f.shape[:2]
    f = f[int(c[1]*H):int(c[3]*H), int(c[0]*W):int(c[2]*W)]
    tiles.append((t, f))
tw = 280; th = int(tw * tiles[0][1].shape[0] / tiles[0][1].shape[1])
rows = (len(tiles) + cols - 1) // cols
img = Image.new("RGB", (tw*cols, th*rows))
d = ImageDraw.Draw(img)
for k, (t, f) in enumerate(tiles):
    x, y = (k % cols) * tw, (k // cols) * th
    img.paste(Image.fromarray(cv2.cvtColor(cv2.resize(f, (tw, th)), cv2.COLOR_BGR2RGB)), (x, y))
    d.rectangle((x, y, x+66, y+12), fill=(0,0,0)); d.text((x+2, y+1), f"{t:.3f}s", fill=(255,255,0))
img.save(out); print(len(tiles), "frames", img.size)

"""Contact sheets of a reference video. usage: ref_sheets.py video.mp4 outdir step_sec [cols rows] [start end]"""
import subprocess, sys, os, math
from PIL import Image, ImageDraw
v, out, step = sys.argv[1], sys.argv[2], float(sys.argv[3])
cols, rows = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (6, 4)
t0 = float(sys.argv[6]) if len(sys.argv) > 6 else 0
dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",v],capture_output=True,text=True).stdout)
t1 = float(sys.argv[7]) if len(sys.argv) > 7 else dur
os.makedirs(out, exist_ok=True)
times = [t0 + i*step for i in range(int((t1-t0)/step)+1) if t0+i*step < dur]
W, H = 288, 512
per = cols*rows
for s in range(math.ceil(len(times)/per)):
    img = Image.new("RGB",(W*cols,H*rows),(0,0,0)); d = ImageDraw.Draw(img)
    for k,t in enumerate(times[s*per:(s+1)*per]):
        f = os.path.join(out,"_f.png")
        subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{t:.3f}","-i",v,"-frames:v","1","-vf",f"scale={W}:{H}",f],check=True)
        x,y = (k%cols)*W,(k//cols)*H
        img.paste(Image.open(f).convert("RGB"),(x,y)); d.rectangle((x,y,x+54,y+12),fill=(0,0,0)); d.text((x+2,y+1),f"{t:.1f}s",fill=(255,255,0))
    img.save(os.path.join(out,f"sheet_{s+1}.png"))
print(len(times),"frames ->",math.ceil(len(times)/per),"sheets")

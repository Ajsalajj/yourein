"""Contact sheet: one row per template, columns = frames. usage: sheet.py <dir> <out.png> [ids...]"""
import sys, glob, os
from PIL import Image, ImageDraw
d, out, *ids = sys.argv[1:]
ids = ids or sorted({os.path.basename(p).rsplit('_',1)[0] for p in glob.glob(d+'/*_0.png')})
rows=[]
for i in ids:
    fs=sorted(glob.glob(f'{d}/{i}_*.png'))
    if fs: rows.append((i,[Image.open(f).convert('RGB') for f in fs]))
w,h=rows[0][1][0].size
sheet=Image.new('RGB',(w*4,h*len(rows)),(20,20,20))
dr=ImageDraw.Draw(sheet)
for r,(i,ims) in enumerate(rows):
    for c,im in enumerate(ims[:4]): sheet.paste(im,(c*w,r*h))
    dr.text((6,r*h+4),i,fill=(255,255,255))
sheet.save(out)
print(sheet.size)

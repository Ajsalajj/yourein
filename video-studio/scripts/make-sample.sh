#!/usr/bin/env bash
# Generates a deterministic demo clip (no copyrighted material): animated gradient + moving "subject" disc,
# with synthetic speech from espeak-ng. Output: data/samples/demo.mp4 (+ demo.txt with the spoken script).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=data/samples
mkdir -p "$OUT"
SCRIPT="Hello everyone and welcome to the channel. Today we are going to learn how to edit videos quickly. Animated captions make every word stand out. Thanks for watching."
echo "$SCRIPT" > "$OUT/demo.txt"
espeak-ng -v en-us -s 135 -g 4 -w "$OUT/demo.wav" "$SCRIPT"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/demo.wav")
ffmpeg -v error -y \
  -f lavfi -i "gradients=s=720x1280:d=${DUR}:speed=0.04:c0=0x1d2b64:c1=0xf8cdda:c2=0x0f2027:c3=0x2c5364:nb_colors=4:rate=30" \
  -f lavfi -i "color=c=0xffffff00:s=720x1280:d=${DUR}:r=30,format=rgba,geq=lum='p(X,Y)':a='if(lt(hypot(X-(360+160*sin(T*1.3)),Y-(640+60*cos(T*0.9))),150),255,0)':cb=128:cr=128" \
  -i "$OUT/demo.wav" \
  -filter_complex "[1:v]format=rgba,colorchannelmixer=rr=0:gg=0:bb=0:ar=0:ag=0:ab=0:aa=0.6[disc];[0:v][disc]overlay=0:0,drawtext=text='DEMO CLIP':fontcolor=white@0.5:fontsize=40:x=(w-text_w)/2:y=90[v]" \
  -map "[v]" -map 2:a -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -shortest "$OUT/demo.mp4"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of csv=p=0 "$OUT/demo.mp4"

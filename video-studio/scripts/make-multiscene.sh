#!/usr/bin/env bash
# Generates data/samples/multiscene.mp4: 12 s, 1080x1920, 30 fps, four visually very different 3 s scenes with a tone per scene.
# (Original synthetic footage made by ffmpeg lavfi sources; used to test transitions and B-roll on real decoded video.)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=data/samples/multiscene.mp4
mkdir -p data/samples
S=1080x1920
ffmpeg -y -v error \
 -f lavfi -i "testsrc2=s=$S:r=30:d=3" \
 -f lavfi -i "gradients=s=$S:r=30:d=3:c0=0xff3b30:c1=0x0a84ff:c2=0xffd60a:c3=0x30d158:speed=0.02" \
 -t 3 -f lavfi -i "mandelbrot=s=270x480:r=30:start_scale=2.5:end_scale=0.4:maxiter=160,scale=1080:1920:flags=bicubic" \
 -f lavfi -i "smptebars=s=$S:r=30:d=3" \
 -f lavfi -i "sine=frequency=220:duration=3" -f lavfi -i "sine=frequency=330:duration=3" -f lavfi -i "sine=frequency=440:duration=3" -f lavfi -i "sine=frequency=550:duration=3" \
 -filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0,format=yuv420p[v];[4:a][5:a][6:a][7:a]concat=n=4:v=0:a=1[a]" \
 -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 128k "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"

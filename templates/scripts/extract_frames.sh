#!/usr/bin/env bash
# Cut the reference section and extract every frame as reference/frames/f_NNNN.jpg (f_0001 = the first frame), at
# half width, then CHECK the count: it must equal duration x fps. A stream-copy cut (-c copy) keeps extra frames at the
# edges and once gave 1053 frames for 1050, so this re-encodes. If the first two frames are identical, check the source
# itself (ffmpeg -i src -frames:v 2) before assuming a numbering offset: a repeated first frame can be in the source.
# usage: tools/extract_frames.sh <source.mp4> <seconds> [start seconds]
set -e; cd "$(dirname "$0")/.."
SRC="${1:?source video}"; DUR="${2:?seconds}"; SS="${3:-0}"
mkdir -p reference/frames
ffmpeg -v error -y -ss "$SS" -i "$SRC" -t "$DUR" -c:v libx264 -crf 12 -pix_fmt yuv420p -c:a aac reference/source_cut.mp4
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 reference/source_cut.mp4)
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 reference/source_cut.mp4)
rm -f reference/frames/f_*.jpg
ffmpeg -v error -i reference/source_cut.mp4 -vf "scale=$((W / 2)):-2" -fps_mode passthrough -q:v 3 reference/frames/f_%04d.jpg
N=$(ls reference/frames | wc -l)
EXP=$(python -I -c "from fractions import Fraction as F; print(round(float(F('$FPS')) * $DUR))")
echo "fps $FPS, frames $N, expected $EXP"
[ "$N" -eq "$EXP" ] || echo "WARNING: frame count $N != $EXP: fix the cut before measuring (numbering would shift)"

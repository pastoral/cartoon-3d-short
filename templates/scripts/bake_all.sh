#!/usr/bin/env bash
# Bake every frame (0 .. N-1) with retries: bake.mjs skips existing PNGs, so a run that dies on a Chrome hang
# (protocol timeout, usually the machine sleeping) just resumes. Then encode assets/world3d.mp4.
# usage: tools/bake_all.sh <frames total>      env: PORT, MAXSUB, SCALE, FPS as for bake.mjs; PUPPETEER_DIR, CHROME (optional)
set -e; cd "$(dirname "$0")/.."
N="${1:?frames total, e.g. 1050}"
PDIR="${PUPPETEER_DIR:--}"   # - = engine/node_modules/puppeteer-core
CHROME="${CHROME:--}"        # - = the standard Chrome install
mkdir -p out/bake
for i in 1 2 3 4 5 6; do
  n=$(ls out/bake | wc -l); [ "$n" -ge "$N" ] && break
  timeout 3000 node tools/bake.mjs "$PDIR" "$CHROME" 0 $((N - 1)) >> out/bake.log 2>&1 || echo "bake run $i stopped, retrying" >> out/bake.log
done
n=$(ls out/bake | wc -l); [ "$n" -ge "$N" ] || { echo "only $n/$N frames baked, see out/bake.log"; exit 1; }
ffmpeg -v error -y -framerate "${FPS:-30}" -i out/bake/f_%04d.png -c:v libx264 -crf 10 -preset medium -pix_fmt yuv420p assets/world3d.mp4
echo "baked $N frames -> assets/world3d.mp4"

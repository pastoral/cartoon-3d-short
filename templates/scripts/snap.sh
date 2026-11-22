#!/usr/bin/env bash
# usage: tools/snap.sh <name> <times comma-separated>  -> out/look/<name>.jpg side-by-side sheet
set -e
cd "$(dirname "$0")/.."
(cd engine && npm run build --silent)
log=$(npx -y hyperframes@0.9.77 snapshot --at "$2" 2>&1)
dir=$(ls -td .hyperframes/artifacts/snapshots/*/ | head -1)
mkdir -p out/look
python tools/sbs.py "$dir" "out/look/$1.jpg" ${3:-360}

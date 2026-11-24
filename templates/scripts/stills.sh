#!/usr/bin/env bash
# usage: tools/stills.sh <name> <frames comma-separated, 1-based>  -> out/look/<name>.jpg (reference | ours pairs)
# GPU stills straight from the engine (seconds each): the main look-match loop. Reference frames are
# reference/frames/f_NNNN.jpg (any size; ours is resized to match). env: PORT, MAXSUB (6 for speed), COLS (4)
set -e; cd "$(dirname "$0")/.."
(cd engine && npm run build --silent)   # harmless for a bake that is running: its page already loaded world.js
rm -rf out/stills && mkdir -p out/stills out/look
BAKE_OUT=out/stills FRAMES="$2" MAXSUB=${MAXSUB:-6} node tools/bake.mjs - - > out/stills/log.txt 2>&1 || { tail -20 out/stills/log.txt; exit 1; }
grep "\[page" out/stills/log.txt | grep -v 404 | head -5 || true
python -I - "$1" "${COLS:-4}" <<'PY'
import sys, glob, os, cv2, numpy as np
rows = []
for p in sorted(glob.glob("out/stills/f_*.png")):
    f = int(os.path.basename(p)[2:6]); r = cv2.imread(f"reference/frames/f_{f:04d}.jpg")
    o = cv2.imread(p)
    if r is None: r = np.zeros_like(o)
    o = cv2.resize(o, (r.shape[1], r.shape[0]))
    pair = np.hstack([r, np.full((r.shape[0], 4, 3), 30, np.uint8), o]); cv2.putText(pair, f"f{f} ref|ours", (6, 22), 0, 0.7, (255, 255, 255), 2); rows.append(pair)
cols = int(sys.argv[2])
while len(rows) % cols: rows.append(np.zeros_like(rows[0]))
g = np.vstack([np.hstack(rows[i:i + cols]) for i in range(0, len(rows), cols)])
cv2.imwrite(f"out/look/{sys.argv[1]}.jpg", g, [cv2.IMWRITE_JPEG_QUALITY, 85])
PY
echo out/look/$1.jpg

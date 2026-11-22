#!/usr/bin/env bash
# usage: tools/stills.sh <name> <frames comma-separated>  -> out/look/<name>.jpg (reference | ours, from GPU stills)
set -e; cd "$(dirname "$0")/.."
(cd engine && npm run build --silent)
rm -rf out/stills && mkdir -p out/stills
BAKE_OUT=out/stills FRAMES="$2" node tools/bake.mjs "$LOCALAPPDATA/npm-cache/_npx/110f701c48e68d66/node_modules/puppeteer-core" "C:/Program Files/Google/Chrome/Application/chrome.exe" > /dev/null
python - "$1" <<'PY'
import sys, glob, os, cv2, numpy as np
rows = []
for p in sorted(glob.glob("out/stills/f_*.png")):
    f = int(os.path.basename(p)[2:5]); r = cv2.imread(f"reference/frames/f_{min(f,360):03d}.jpg"); o = cv2.resize(cv2.imread(p), (540, 960))
    pair = np.hstack([r, np.full((960, 6, 3), 30, np.uint8), o]); cv2.putText(pair, f"f{f} ref|ours", (8, 30), 0, 0.8, (255, 255, 255), 2); rows.append(pair)
cols = 3
while len(rows) % cols: rows.append(np.zeros_like(rows[0]))
g = np.vstack([np.hstack(rows[i:i + cols]) for i in range(0, len(rows), cols)])
cv2.imwrite(f"out/look/{sys.argv[1]}.jpg", cv2.resize(g, (g.shape[1] // 2, g.shape[0] // 2)), [cv2.IMWRITE_JPEG_QUALITY, 85])
PY

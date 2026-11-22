"""Side-by-side sheet: reference frame | our snapshot for each time. Usage: python sbs.py <snapdir> <out.jpg> [width]"""
import sys, os, re, glob, subprocess
import cv2, numpy as np
snap, out = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 360
h = w * 16 // 9
rows = []
for p in sorted(glob.glob(os.path.join(snap, "frame-*-at-*.png"))):
    t = float(re.search(r"at-([\d.]+)s", p).group(1))
    f = int(round(t * 30)) + 1
    ref = os.path.join(os.path.dirname(__file__), "..", "reference", "frames", f"f_{min(f,360):03d}.jpg")
    a = cv2.resize(cv2.imread(ref), (w, h)); b = cv2.resize(cv2.imread(p), (w, h))
    pair = np.hstack([a, np.full((h, 6, 3), 30, np.uint8), b])
    cv2.putText(pair, f"t={t:.2f} f{f}  ref | ours", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 3)
    cv2.putText(pair, f"t={t:.2f} f{f}  ref | ours", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
    rows.append(pair)
cols = 3
while len(rows) % cols: rows.append(np.zeros_like(rows[0]))
grid = np.vstack([np.hstack([r for r in rows[i:i + cols]] if False else [np.hstack([rows[j], np.full((h, 14, 3), 0, np.uint8)]) for j in range(i, i + cols)]) for i in range(0, len(rows), cols)])
cv2.imwrite(out, grid, [cv2.IMWRITE_JPEG_QUALITY, 88])
print(out, grid.shape)

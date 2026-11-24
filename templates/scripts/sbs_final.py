"""Reference | ours sheet at key frames, both grabbed from the mp4s (use it on the RENDER, not the bake, so captions
and overlays are included). Frame N = video index N-1.
Usage: python -I tools/sbs_final.py reference.mp4 ours.mp4 out.jpg 1,40,60,...  [cols=4] [tile width=360]"""
import sys, subprocess, numpy as np, cv2

ref, ours, out, fl = sys.argv[1], sys.argv[2], sys.argv[3], [int(x) for x in sys.argv[4].split(",")]
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 4
tw = int(sys.argv[6]) if len(sys.argv) > 6 else 360


def grab(v, f, w, h):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", v, "-vf", f"select=eq(n\\,{f - 1}),scale={w}:{h}", "-fps_mode", "passthrough",
                          "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).copy()


probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", ref], capture_output=True, text=True).stdout
W, H = map(int, probe.strip().split(","))
th = round(tw * H / W)
tiles = []
for f in fl:
    p = np.hstack([grab(ref, f, tw, th), np.full((th, 4, 3), 255, np.uint8), grab(ours, f, tw, th)])
    for c, t in [((0, 0, 0), 4), ((255, 255, 255), 1)]:
        cv2.putText(p, f"f{f}  reference | remake", (8, 24), 0, 0.6, c, t)
    tiles.append(np.pad(p, ((6, 6), (6, 6), (0, 0)), constant_values=30))
while len(tiles) % cols:
    tiles.append(np.full_like(tiles[0], 30))
cv2.imwrite(out, np.vstack([np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 88])
print(out)

# HyperFrames project skeleton (bake + composite)

```
index.html                    root 1080x1920 @30, 12 s: world3d host, overlays host, captions host, original-audio <audio>
compositions/world3d.html     the baked three.js layer as a muted <video src="assets/world3d.mp4">  (renders in ~2 min)
compositions/world3d-live.html  the same engine live (seeks world.js on hf-seek). Editable in preview, but ~40 s/frame headless
compositions/captions.html    one timed div per caption at measured switch frames (Montserrat 800, stroke + shadow)
compositions/overlays.html    thought bubble / padlock / reticle: GSAP set() per frame with measured pop sequences, inner movers
engine/                       use templates/remake/engine (generic remake engine, see its README); this folder's package.json/tsconfig/debug.html are the older pirates setup
```

To adapt:
1. Change the root size to the reference's native size (`data-width`/`data-height`, the viewport meta, html/body css) and `data-duration`, and point the audio `src` at the remade clip's own audio (only with permission).
2. Regenerate the caption divs from your switch-frame table: `templates/scripts/captions_from_table.py`.
3. Reposition the overlays.

Render with `npx hyperframes render -o out/x.mp4 --quality delivery -w 2`, after `npx hyperframes check` and with the preview stopped.

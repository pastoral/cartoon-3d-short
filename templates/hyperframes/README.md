# HyperFrames project skeleton (bake + composite)

```
index.html                    root 1080x1920 @30, 12 s: world3d host, overlays host, captions host, original-audio <audio>
compositions/world3d.html     the baked three.js layer as a muted <video src="assets/world3d.mp4">  (renders in ~2 min)
compositions/world3d-live.html  the same engine live (seeks world.js on hf-seek). Editable in preview, but ~40 s/frame headless
compositions/captions.html    one timed div per caption at measured switch frames (Montserrat 800, stroke + shadow)
compositions/overlays.html    thought bubble / padlock / reticle: GSAP set() per frame with measured pop sequences, inner movers
engine/                       package.json (esbuild build), tsconfig, debug.html (cache-busted). Put src from templates/pirates (author's PC only, not published) or your own world built on templates/bridge
```

To adapt:
1. Change the root `data-duration` and the audio `src` (the example used the remade clip's own audio, with permission).
2. Regenerate the caption divs from your switch-frame table (a short Python loop is in the pirates project history).
3. Reposition the overlays.

Render with `npx hyperframes render -o out/x.mp4 --quality delivery -w 2`, after `npx hyperframes check` and with the preview stopped.

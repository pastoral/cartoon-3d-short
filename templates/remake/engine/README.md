# Remake engine (three.js, baked for HyperFrames)

A generic runtime for shot-for-shot remakes in this style: any number of shots and sets, any output size. It was
extracted from a 35 s, 1050-frame, 720x1280 remake (Nov 2026). The example content here (a street set, a bean
character, a coin, a heart, two shots) is original and only shows the API. Replace `cast.ts`, `sets.ts` and `shots.ts`
with your remake's.

## Setup
```
cp -r <skill>/templates/remake/engine <project>/engine
cd <project>/engine && bash setup.sh <skill>/templates/bridge   # copies the shared look modules, npm install
npm run build && npm run check                                  # -> ../assets/js/world.js
```
Serve the project on its own port (`python -m http.server 8766`) and open `engine/debug.html?t=SECONDS` to check a frame.
`tools/stills.sh` and `tools/bake_all.sh` (from `templates/scripts`) drive the same page.

## Files
| File | Owns |
|---|---|
| `story.ts` | Output config (`OUT_W`, `OUT_H`, `FPS`, `DURATION`), `LOOKS` (sky stops, sun, two-tone light, card shading, fog, grade per time of day), the `Shot` type, `camAt` (eased keys, fov animated too), `layersAt` (crossfades with measured `fade` curves) |
| `shots.ts` | YOUR shot list. Example: dolly + zoom push-in, measured ease-out crossfade, houses flying away, a heart pop on the overlay |
| `sets.ts` | YOUR set registry: `{ origin, build(root, sky) -> { root, update(shot, f, look) } }`. Sets sit far apart. Example: a street |
| `cast.ts` | YOUR 2D cast: `CAST[key] = { w, h, footY, rimY?, draw(pen, opts) }`. 1000 design units = 2.1 m |
| `world.ts` | Card pool (camera-facing planes, texture density from projected size, LRU cache), sun/look per frame, set switching |
| `main.ts` | Renderer + composer (RenderPass, lens, ink, tone, grade, unsharp) at 2x supersample, sub-frame motion blur, `blurAt` / `dimAt` / `overlay` in display space, `hf-seek` + `window.__hf.buildReady`, debug handles on `window.__remake` (= `__pirates` for bake.mjs) |
| `kit.ts` | Generic set pieces: plaster houses, cobbles, trees, field tiles, flyers (`flyUp`) |
| `sky.ts`, `mats.ts`, `sharpen.ts` | Sky dome + cloud cards; cached two-tone materials; unsharp mask |
| shade, ink, cardshade, grade, lensblur, paint, toon | Copied in from `templates/bridge` by `setup.sh` |

## Shot fields
`set`, `a`/`b` (first/last frame, f1 = first frame), `look`/`lookAt(f)`, `keys` (or `camFn`), `cast(f)` (world cards,
`anchor: "rim"` for people standing in containers), `overlay(f)` (screen px at OUT_W x OUT_H, for anything whose SCREEN
path was measured), `props(f)` (set state), `fade(f)` / `fadeIn`, `dimAt(f)` (multiply, top/bottom), `blurAt(f)`,
`shutterAt(f)` / `extraBlurPx(f)` (whips), `dof(f)` (thin-lens; verify it works before relying on it).

## Gotchas built in (keep them)
- Cards get a blank map at construction: a material compiled without one never shows a texture later.
- The card plane translates by `anchorY - h/2` (design y runs down); the opposite sign buries every character.
- Rolling a card pivots on its anchor: spin round props inside the drawing (`opts.t`) instead.
- Too few motion-blur sub-frames show as stepped ghost copies: raise `MAXSUB` for fast whips.

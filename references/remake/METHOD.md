# Remake mode: rebuild an existing cartoon clip shot-for-shot in this style

Proven on the pirates-vs-cruise opening (knox_clip1 0–12 s, Nov 2026). The worked example, with numbers, reports and gridded key frames, is in `../knox_example/` on the author's PC (not published: third-party frames).

**Only with the owner's permission, stated by the person. The result stays private.** For original shorts the "never copy shots or characters" rule still applies.

## 0. Project
- HyperFrames project: `npx hyperframes init <dir> --video <clip> --keep-original --skip-transcribe --skip-skills`.
- `npx hyperframes reverse start` needs HyperFrames Pro. On Free, do the same steps by hand (below).
- Copy into the project:
  - `templates/hyperframes/*`;
  - `templates/pirates/src` → `engine/src` if you have it (it isn't in the public repo), or the `templates/bridge` look modules for a new world;
  - `templates/scripts/{sbs.py,stills.sh,snap.sh,bake.mjs,short_qa.py}` → `tools/`;
  - `templates/remake/*` → `tools/`.
- In `engine/`, run `npm i three@0.169.0 postprocessing@6.36.4 esbuild@0.24.0 @types/three@0.169.0 typescript@5.6.3`.

## 1. Measure (numbers, not adjectives)
1. `npx hyperframes measure cuts <clip>` for hard cuts. Everything else is a camera move.
2. Extract every frame of the section to `reference/frames/`, plus 6 fps sheets. Write `reference/CONTEXT.md` from `CONTEXT_template.md`.
3. Launch **three measurement agents in parallel** (`AGENT_BRIEFS.md`):
   - (a) cuts, camera, motion;
   - (b) colour, grade, lighting;
   - (c) depth, textures, characters, outlines, captions.

   Sub-agents can't write files in this harness, so save each report yourself to `reference/reports/`.
4. Make gridded key frames (60 px grid, labels every 240 px) at every cut, at each camera-move key, and at overlay pops.

## 2. Solve cameras and layout (don't eyeball)
1. Mark anchors per key frame in `tools/layout_keys.json`:
   - `pts`: character head centre / feet against crew members;
   - `fixed`: known 3D props such as poles and rail posts;
   - `horizon`;
   - `lines`: ship waterlines as world lines;
   - `rays`: back-projections onto planes, used to place props.
2. `python tools/fit_layout.py` fits camera position, yaw, pitch and roll **together with** crew x/z/scale (weak priors). Target: anchor error < 2 % of frame height.
   - Plain solvePnP on characters alone puts the horizon ~100 px off, because the reference composites flat cards over 3D ships.
   - Within one shot, lock the crew: refit later keys with `prior: 50`.
   - `head_h()` in the script must match `pirateGeo()` in `pirates.ts`.
3. `python tools/emit_cams.py` writes `CAMS` / `ROLL` into `engine/src/story.ts`, joining solved keys with measured eases.
   - For a truck/pan with a measured velocity profile, integrate it and emit **one key per frame**. 4-frame linear keys show as velocity steps.
4. Derive ship size and depth from on-screen heights against the solved horizon. For example, liner B's freeboard 10 → 7 m came from the chase frame's hull height: 350 px against the reference's 250 px.

## 3. Build and look-match loop
- `tools/stills.sh <name> <frames>` renders frames with GPU Chrome in ~1–5 s each, against the reference (`out/look/<name>.jpg`). Use it for 3D looks.
- `tools/snap.sh <name> <times>` gives HyperFrames snapshots including captions and overlays. It's slower.
- Fix one thing per round. Keep `tools/apply_roundN.py` edit scripts with assertions: a stale search string aborts the whole script instead of half-applying.
- Check full-res crops for sharpness. Motion-blur ghosts mean a camera *step* between keys, not a blur bug.

## 4. Overlays and captions (HyperFrames, frame-exact)
- **Captions:** one timed div per word or phrase at the measured switch frames (caption agent), hard switches, measured font, stroke and shadow.
- **Pops** (bubble, lock, reticle): GSAP `tl.set()` per frame with the measured scale sequence. Wrap moving ones in an inner mover div and tween its x/y along the measured screen path.

## 5. Bake, composite, render, QA
1. Serve the project folder: `python -m http.server 8765`.
2. Run `node tools/bake.mjs <puppeteer-core dir> <chrome.exe>` → `out/bake/f_###.png`. It is incremental: delete frames to re-bake only a range.
3. `ffmpeg -framerate 30 -i out/bake/f_%03d.png -c:v libx264 -crf 10 -preset slow -pix_fmt yuv420p assets/world3d.mp4`
4. `npx hyperframes render -o out/<name>.mp4 --quality delivery -w 2`. This took ~2 min for 12 s; stop `hyperframes preview` first.
5. `python tools/short_qa.py out/<name>.mp4 out/qa tools/shots.json`, then `sbs.py` on frames extracted from the **render**.

## 6. Verify
- Run a fresh Opus verifier (max effort) on the render with `AGENT_BRIEFS.md` § Verifier. It scores 11 areas out of 10 and lists the top differences.
- A new verifier can score lower than the last one (5.6 after 6.1) because it measures differently. Before chasing new items, check its list for **regressions you introduced**.
- Record scores and open items in `REPORT.md`.

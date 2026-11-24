# Remake mode: rebuild an existing cartoon clip shot-for-shot in this style

Proven on the pirates-vs-cruise opening (knox_clip1 0–12 s, Nov 2026) and on a 35 s, 1050-frame, 720x1280 remake (25+ framings, two sets, night and day, Nov 2026; verifier 6.1/10 after one fix round). The worked example, with numbers, reports and gridded key frames, is in `../knox_example/` on the author's PC (not published: third-party frames).

**Only with the owner's permission, stated by the person. The result stays private.** For original shorts the "never copy shots or characters" rule still applies.

## 0. Project
- HyperFrames project: `npx hyperframes init <dir> --video <clip> --keep-original --skip-transcribe --skip-skills`.
- `npx hyperframes reverse start` needs HyperFrames Pro. On Free, do the same steps by hand (below).
- Make the HyperFrames root the **reference's native size and fps** (e.g. 720x1280 @30), so every measured px applies 1:1.
- Copy into the project:
  - `templates/hyperframes/*`;
  - `templates/remake/engine` → `engine/`, then `cd engine && bash setup.sh <skill>/templates/bridge` (look modules + npm install, including puppeteer-core);
  - `templates/scripts/{extract_frames.sh,stills.sh,sbs_final.py,captions_from_table.py,bake.mjs,bake_all.sh,short_qa.py}` → `tools/`;
  - `templates/remake/*.py` → `tools/`.
- Set `OUT_W`, `OUT_H`, `FPS`, `DURATION` in `engine/src/story.ts`. Pick a free port for this project's server (`PORT`).

## 1. Measure (numbers, not adjectives)
1. `npx hyperframes measure cuts <clip>` for hard cuts. Everything else is a camera move.
2. Extract every frame with `tools/extract_frames.sh <clip> <seconds>` (`reference/frames/f_NNNN.jpg`, f_0001 = first frame) and **check the count equals seconds x fps**; make 4-6 fps sheets. Write `reference/CONTEXT.md` from `CONTEXT_template.md` with your own beat list from the sheets, so the agents know what they are looking at.
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

5. **Lenses from motion.** Before placing cameras, turn the motion report into lenses:
   - a push given as a global scale (x2.5, up to 11 %/f) is a zoom: animate fov with the dolly;
   - a whip pan between neighbours gives the close-up lens (px travelled / their spacing in metres): the second remake's close-ups were ~20° (950 px between heads 0.9 m apart).
6. **When fit_layout is too slow for the shot count** (25+ framings), iterate stills by eye against gridded frames, but log it in REPORT.md: framing then scores ~5-6. Still solve the anchor-rich shots.

## 3. Build and look-match loop
- Engine (`templates/remake/engine`): one `Shot` per shot with `a`/`b` frames, `keys` (camera, fov animated), `cast` (world cards), `overlay` (screen-space cards at measured px), `props` (set state such as flyers), `fade` (measured crossfade alpha), `dimAt`/`blurAt` (display-space dim and blur), `shutterAt`/`extraBlurPx` (whips).
- `tools/stills.sh <name> <frames>` renders frames with GPU Chrome in ~1–5 s each, against the reference (`out/look/<name>.jpg`). Use it for 3D looks.
- `tools/snap.sh <name> <times>` gives HyperFrames snapshots including captions and overlays. It's slower.
- Fix one thing per round. Keep `tools/apply_roundN.py` edit scripts with assertions: a stale search string aborts the whole script instead of half-applying. Never append `//` comments to a replaced code line (it comments out the rest of the line); use `/* */`.
- Nothing pops into view (QA flags it): reveal objects from behind/inside something that leaves first.
- Check full-res crops for sharpness. Motion-blur ghosts mean a camera *step* between keys, not a blur bug.

## 4. Overlays and captions (HyperFrames, frame-exact)
- **Captions:** one timed div per word or phrase at the measured switch frames (caption agent), hard switches, measured font, stroke and shadow.
- **Captions:** `python -I tools/captions_from_table.py captions.txt compositions/captions.html --w <W> --h <H> --duration <s> --font <family> --size <px> --stroke <px> --baseline <px>` (table lines `start_frame|text[|baseline]`).
- **Pops** (bubble, lock, reticle): GSAP `tl.set()` per frame with the measured scale sequence. Wrap moving ones in an inner mover div and tween its x/y along the measured screen path.
- **Anything with a measured screen path** (giant hands, a dropped coin with bounce and roll, a walk-in, a bulb/heart pop): the engine's `overlay` with the per-frame px table (`tab()` in shots.ts). It is baked with the 3D layer, so it gets the same motion blur, dim and crossfade.

## 5. Bake, composite, render, QA
1. Serve the project folder on its own port: `python -m http.server 8766` (tools read `PORT`).
2. Keep the machine awake, then `tools/bake_all.sh <frames>` → `out/bake/f_NNNN.png` (retries after a Chrome hang) and `assets/world3d.mp4`. It is incremental: delete frames to re-bake only a range. ~1-4 s/frame on an Intel HD 520 with `MAXSUB=12`.
3. `npx hyperframes render -o out/<name>.mp4 --quality delivery -w 2`. ~2 min for 12 s, ~5 min for 35 s; stop `hyperframes preview` first. If it fails in the audio mix, re-run it (a sleeping machine stalls ffmpeg).
4. `python -I tools/short_qa.py out/<name>.mp4 out/qa tools/shots.json` (list planned fast moves in `planned` so they aren't flagged), then `python -I tools/sbs_final.py reference/source_cut.mp4 out/<name>.mp4 out/compare.jpg <frames>` on the **render**.

## 6. Verify
- Run a fresh Opus verifier (max effort) on the render with `AGENT_BRIEFS.md` § Verifier. It scores 11 areas out of 10 and lists the top differences.
- A new verifier can score lower than the last one (5.6 after 6.1) because it measures differently; two verifiers gave the same 6.1 total while the per-area scores moved by +-1.5. Before chasing new items, check its list for **regressions you introduced** (the second remake's verifier caught two: a disabled coop and a sunken tumbleweed).
- Verify its claims before acting on them: a reported whole-timeline one-frame offset was a repeated first frame in the source (check with a frame-diff cross-correlation of render vs reference: lag 0).
- Run it on the final render. Cap its tool calls and forbid background scripts (AGENT_BRIEFS.md).
- Record scores and open items in `REPORT.md`.

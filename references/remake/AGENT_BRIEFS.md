# Agent briefs that worked (pirates remake, Nov 2026)

Replace `<PROJECT>` and `<SCRATCH>`. Every agent reads `reference/CONTEXT.md` first. Agents may not edit project files and return their report as their final message; save it yourself to `reference/reports/`.

## (a) Cuts, camera moves, motion (general-purpose)
> You are a measurement analyst. Read <PROJECT>\reference\CONTEXT.md first. Topic: CUTS, CAMERA MOVES and MOTION for the reference 0–N s. Write scripts in <SCRATCH>\meas_cam\ (python cv2/numpy, ffmpeg). Do not edit project files. Measure per frame where useful:
> 1. Every hard cut, crossfade (start/end frame, blend curve), whip (frames of motion blur, direction).
> 2. Camera move segments: frame range, type (push, pan, tilt, whip, roll, rack), px/f translation at 1080x1920 via phase correlation or ECC on downscaled grey frames, %/f scale, roll deg, and the ease shape (ramp lengths, peak frame).
> 3. Motion-blur length in px during whips.
> 4. Character motion: bob amplitude/period, frames when expressions switch, arm moves, overlay pops (scale per frame, overshoot %).
> 5. A complete SHOT TABLE (first/last frame, content, transition in/out) and per-frame SCREEN PATHS (px) of every moving prop or overlay (hands, drops, walk-ins, pops): they go straight onto the engine's `overlay`.
> Final message: numeric report ≤ 600 words, a table of segments plus overlay timings. No adjectives without numbers.

## (b) Colour, grade, lighting (general-purpose)
> … Topic: COLOURS, GRADE and LIGHTING. Use full-res frames. For representative frames per beat:
> 1. Colours (dominant k-means hex) of sky top/horizon, sea near/far/crests, hulls lit vs shade, windows, stripes, skin, costume, flag, ink.
> 2. Grade: CIELAB median L*, Y p5/p50/p95, C* p50/p90, mean a*/b*, non-ink p5, corner/centre luma (vignette), grain std, glow halos.
> 3. Lighting: sun direction from cast shadows, lit/shade luma ratio, shadow hue, character tint day vs golden, rim light.
> 4. Any time-of-day transition: frames, and whether it is a crossfade or a sweep (fit a·A + (1−a)·B per frame).
> Final message: numeric report ≤ 400 words, tables, hex codes, ratios.

## (c) Depth, textures, characters, outlines, captions (general-purpose)
> … 1. Depth: background blur radius per beat (erf edge fits σ px on known-sharp edges), focus plane, fog/haze.
> 2. Textures: flat vs painted (32 px patch std), panel lines, water marks (shape, size, coverage), clouds.
> 3. Characters: head-heights tall, head w/h, eye size/spacing ÷ head width, pupils, mouth, limb width ÷ head width, hands, feet, outline width and colour, costume patterns, sidekick size.
> 4. World outlines: ink width near vs far, colour, which edges get lines.
> 5. Captions: font guess, cap and x-height, baseline y, fill, stroke, shadow, and the exact frame each caption appears/disappears (difference the caption band) with its text.
> Final message: numeric report ≤ 500 words, tables.

## Verifier (Opus, effort max: the person asked for it)
> You are a strict visual verifier for a licensed shot-for-shot remake of <clip, section>. Compare OUR render to the REFERENCE. Do not edit any project files. Files: side-by-side sheet (pairs = reference | ours), our mp4, the reference mp4, full-res stills, gridded reference key frames, reference\reports\*.md. Scripts only in <SCRATCH>\verifyN\.
> Keep it efficient: at most ~35 tool calls, no scripts left running in the background, short printed output, images as compact sheets. Use frame numbering f1 = first frame (video index 0).
> Score out of 10: sharpness, framing & positioning, characters, colour day, colour golden/night, lighting, ink/outlines, textures, depth/blur, motion & timing (check named frame ranges frame by frame), overlays & captions. Then the top 6–8 remaining differences, each with frame and a measurable description. Final message ≤ 300 words, first line = overall score.

If a verifier stalls (waiting on its own background work), message it to report now with what it has.

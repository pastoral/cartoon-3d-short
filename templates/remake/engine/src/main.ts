// HyperFrames runtime of the remake engine: one WebGL renderer + postprocessing composer
// (RenderPass -> [thin-lens blur] -> ink -> tone + grade -> unsharp) at 2x supersample, box-downscaled into a visible
// 2D canvas. Each frame is a pure function of t (hf-seek). Crossfades render both shots and mix them (measured alpha
// curves via shot.fade); whips get motion blur by averaging sub-frames over the shutter; per shot there is an optional
// display-space blur (blurAt), dim (dimAt) and screen-space overlays (overlay) drawn from cast.ts.
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect } from "./grade";
import { SharpenEffect } from "./sharpen";
import { SHOTS, Shot, camAt, layersAt, FPS, DURATION, LOOKS, Cam, Ov, OUT_W, OUT_H } from "./story";
import { CAST } from "./cast";
import { Pen } from "./toon";

declare global { interface Window { __hf?: { buildReady?: Record<string, Promise<unknown>> }; __pirates?: unknown; __remake?: unknown } }

const host = document.getElementById("world3d-host") ?? document.body;
const out = document.createElement("canvas");
const q = new URLSearchParams(location.search);
const opts = { ink: q.get("ink") !== "0", lens: q.get("lens") !== "0", grade: q.get("grade") !== "0", blur: q.get("mblur") !== "0",
  scale: Number(q.get("scale") ?? host.getAttribute("data-scale") ?? 1), maxSub: Number(q.get("maxsub") ?? 14),
  ss: Number(q.get("ss") ?? 2), sharpen: q.get("sharpen") !== "0" };
const W = Math.round(OUT_W * opts.scale), H = Math.round(OUT_H * opts.scale);
const W2 = Math.round(W * opts.ss), H2 = Math.round(H * opts.ss);
out.width = W; out.height = H; out.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
host.appendChild(out);
const mk2d = (c: HTMLCanvasElement) => { const g = c.getContext("2d")!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; return g; };
const o2 = mk2d(out);
const mkCanvas = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return mk2d(c); };
const a2 = mkCanvas(), tmp = mkCanvas();

const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1); renderer.setSize(W2, H2, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 4000);
const world = new World();
scene.add(world.root);

const composer = new EffectComposer(renderer, { multisampling: opts.ss > 1 ? 0 : 4, frameBufferType: THREE.HalfFloatType });
// world ink (character cards are NOINK and carry their own outline); widths are px at 1080x1920 and scale with height
const ink = new InkPass(scene, cam, { color: "#34302f", widthNear: 7.0, widthFar: 3.5, distNear: 6, distFar: 90 });
const lens = new LensBlur({ maxCoC: 30, nearScale: 1.0 }); // NOTE: showed no effect standalone once; verify, else use blurAt
const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
const grade = new GradeEffect(Object.values(LOOKS)[0].grade, 1);
composer.addPass(new RenderPass(scene, cam));
const lensPre = new EffectPass(cam, lens.pre), lensMain = new EffectPass(cam, lens.main);
if (opts.lens) { composer.addPass(lensPre); composer.addPass(lensMain); }
if (opts.ink) composer.addPass(ink);
composer.addPass(new EffectPass(cam, tone, ...(opts.grade ? [grade] : [])));
if (opts.sharpen) composer.addPass(new EffectPass(cam, new SharpenEffect({ amount: 0.6, radius: 1.0 })));
composer.setSize(W2, H2);

const fwd = new THREE.Vector3(), fp = new THREE.Vector3();
const renderShot = (s: Shot, f: number) => {
  const c = camAt(s, f);
  const { focus } = world.update(s, f, c, cam);
  noInkFallback(world.root);
  const d = s.dof ? s.dof(f) : { cInf: 0 };
  cam.getWorldDirection(fwd); fp.copy(focus);
  lens.focus = d.focus ?? Math.max(0.3, fp.sub(cam.position).dot(fwd));
  lens.cInf = d.cInf;
  lensPre.enabled = lensMain.enabled = d.cInf > 0.25;
  grade.set(LOOKS[s.lookAt ? s.lookAt(f) : s.look].grade);
  composer.render();
};

const probe = (c: Cam) => {
  const p = new THREE.PerspectiveCamera(c.fov, OUT_W / OUT_H, 0.1, 5000);
  p.position.set(...c.pos); p.up.set(0, 1, 0); p.lookAt(...c.look); p.rotateZ((c.roll * Math.PI) / 180); p.updateMatrixWorld();
  return p;
};
/** screen motion (px at OUT_W x OUT_H) of probe points 6 m out between f and f + df: drives the sub-frame count */
const motionPx = (s: Shot, f: number, df: number) => {
  const a = probe(camAt(s, f)), b = probe(camAt(s, f + df));
  let m = 0;
  for (const [x, y] of [[0, 0], [-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    const w = new THREE.Vector3(x, y, 0.5).unproject(a).sub(a.position).normalize().multiplyScalar(6).add(a.position);
    const sp = w.clone().project(b);
    m = Math.max(m, Math.hypot(((sp.x - x) * OUT_W) / 2, ((sp.y - y) * OUT_H) / 2));
  }
  return m;
};

// ---- screen-space overlays: cached card canvases ----
const ovCache = new Map<string, HTMLCanvasElement>();
const ovCanvas = (key: string, o: Ov["opts"], hpx: number) => {
  const def = CAST[key]; const k = Math.max(0.1, Math.ceil((hpx / def.h) * 20) / 20);
  const ck = `${key}|${o?.expr ?? ""}|${o?.pose ?? ""}|${o?.mirror ? 1 : 0}|${o?.t === undefined ? "" : Math.round(o.t * 8)}@${k}`;
  let c = ovCache.get(ck);
  if (!c) {
    if (ovCache.size > 80) ovCache.clear();
    c = document.createElement("canvas"); c.width = Math.max(2, Math.round(def.w * k)); c.height = Math.max(2, Math.round(def.h * k));
    const g = c.getContext("2d")!; g.setTransform(k, 0, 0, k, 0, 0); def.draw(new Pen(g), o ?? {}); ovCache.set(ck, c);
  }
  return c;
};
const drawOverlays = (s: Shot, f: number, ctx: CanvasRenderingContext2D) => {
  if (!s.overlay) return;
  const sx = W / OUT_W;
  for (const ov of s.overlay(f)) {
    const def = CAST[ov.key]; if (!def) continue;
    const h = ov.h * sx, w = (h * def.w) / def.h, c = ovCanvas(ov.key, ov.opts, h);
    const ay = ov.anchor === "top" ? 0 : ov.anchor === "foot" ? (def.footY / def.h) * h : h / 2;
    ctx.save(); ctx.globalAlpha = ov.alpha ?? 1; ctx.translate(ov.x * sx, ov.y * sx); if (ov.roll) ctx.rotate(ov.roll);
    ctx.drawImage(c, -w / 2, -ay, w, h); ctx.restore();
  }
};

/** render shot s at frame f (fractional ok) with motion blur, blur, dim and overlays into ctx */
const layer = (s: Shot, f: number, ctx: CanvasRenderingContext2D) => {
  const sh = s.shutterAt ? s.shutterAt(f) : 0.5;
  const px = opts.blur ? Math.max(motionPx(s, f - sh / 2, sh), s.extraBlurPx ? s.extraBlurPx(f) : 0) : 0;
  const n = Math.max(1, Math.min(opts.maxSub, Math.ceil(px / 6))); // too few sub-frames shows as stepped ghost copies
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < n; i++) {
    renderShot(s, n === 1 ? f : f + sh * ((i + 0.5) / n - 0.5));
    ctx.globalAlpha = 1 / (i + 1);
    ctx.drawImage(renderer.domElement, 0, 0, W, H);
  }
  ctx.globalAlpha = 1;
  const sigma = (s.blurAt ? s.blurAt(f) : 0) * (W / OUT_W);
  if (sigma > 0.25) {
    tmp.globalCompositeOperation = "copy"; tmp.filter = "none"; tmp.drawImage(ctx.canvas, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = "copy"; ctx.filter = `blur(${sigma.toFixed(2)}px)`; ctx.drawImage(tmp.canvas, 0, 0); ctx.restore();
  }
  const dm = s.dimAt ? s.dimAt(f) : null;
  if (dm && (dm[0] < 0.999 || dm[1] < 0.999)) {
    const gr = ctx.createLinearGradient(0, 0, 0, H), c = (v: number) => `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`;
    gr.addColorStop(0, c(dm[0])); gr.addColorStop(1, c(dm[1]));
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  drawOverlays(s, f, ctx);
};

const renderAt = (t: number) => {
  const f = Math.min(t * FPS + 1, DURATION * FPS);
  const L = layersAt(f);
  o2.globalAlpha = 1; o2.clearRect(0, 0, W, H);
  for (const l of L) {
    if (L.length === 1) { layer(l.shot, f, o2); continue; }
    a2.clearRect(0, 0, W, H);
    layer(l.shot, f, a2);
    o2.globalAlpha = l.alpha; o2.drawImage(a2.canvas, 0, 0); o2.globalAlpha = 1;
  }
};

// debug handles (bake.mjs calls window.__pirates.renderAt; __remake is the same object)
window.__pirates = window.__remake = { renderAt, opts, world, scene, cam, camAt, motionPx, lens, composer, SHOTS, CAST, Pen };
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
const ready = (async () => {
  for (const s of SHOTS) world.update(s, s.a, camAt(s, s.a), cam);
  await renderer.compileAsync(scene, cam);
  renderAt(0);
})();
window.__hf.buildReady["world3d"] = ready;
window.addEventListener("hf-seek", (e: Event) => {
  const d = (e as CustomEvent).detail as { time: number; waitUntil?: (p: Promise<unknown>) => void };
  const p = ready.then(() => renderAt(d.time));
  d.waitUntil?.(p);
});

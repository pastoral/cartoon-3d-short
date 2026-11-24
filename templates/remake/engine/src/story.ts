// Timeline core of the remake engine: output config, light "looks", the Shot type, camera interpolation and
// crossfade layering. Shots are pure functions of the (fractional) frame number f, with frame N = time (N-1)/FPS
// (f1 = first frame). Check the reference's frame numbering before trusting it: extract with -vsync passthrough and
// make sure the frame count equals duration x fps (a repeated first frame in the SOURCE is not an offset).
import type { GradeParams } from "./grade";
import type { CharOpts } from "./cast";
import { SHOT_LIST } from "./shots";

// ---------------- output (match the reference) ----------------
export const OUT_W = 720, OUT_H = 1280; // e.g. 1080 x 1920 for a full-HD vertical source
export const FPS = 30;
export const DURATION = 6;              // seconds (frames = DURATION * FPS)

export type V3 = [number, number, number];
export type C3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov: number; roll: number };

// ---------------- looks: sky, light, grade per time of day ----------------
// All sky colours are ON-SCREEN targets (sky.ts pre-inverts the tone map). lit/shade/lift are linear multipliers for
// shade.ts twoTone. charGrad/bodyGrad give cards a soft shade on the side away from the sun (0 = flat).
export type Look = {
  sky: { c: string[]; e: number[] }; clouds: boolean; fog?: [string, number, number];
  sunAz: number; sunEl: number;          // degrees; az from the set's -z axis (+ = toward +x), el above the horizon
  lit: C3; shade: C3; lift: C3; sat: number; charTint: C3; charGrad?: number; bodyGrad?: number;
  emissive?: string;                     // optional add-on for set materials that ask for it (e.g. night tint)
  grade: GradeParams;
};
const G = (ky: number[], sat: C3, vig: [number, number], tintS: [number, number] = [0, 0], tintM: [number, number] = [0, 0], tintH: [number, number] = [0, 0]): GradeParams => ({ ky, sat, vig, tintS, tintM, tintH });
export const LOOKS: Record<string, Look> = {
  day: { sky: { c: ["#cfe1f2", "#a3cbef", "#68a9e6", "#4592dc", "#2f7fd6"], e: [0, 3, 10, 25, 55] }, clouds: true, sunAz: 140, sunEl: 36,
    lit: [1.55, 1.5, 1.36], shade: [0.55, 0.56, 0.68], lift: [0.03, 0.04, 0.08], sat: 1.05, charTint: [1, 1, 1], charGrad: 0.05, bodyGrad: 0.1,
    grade: G([0, 0.11, 0.3, 0.61, 0.85, 0.95, 1], [1, 1.1, 1], [0.3, 0.4]) },
  night: { sky: { c: ["#2b3466", "#1a2659", "#101d5c", "#0b1953", "#061144"], e: [0, 3, 10, 25, 55] }, clouds: false, sunAz: 180, sunEl: 35,
    lit: [0.62, 0.52, 0.62], shade: [0.36, 0.32, 0.5], lift: [0.03, 0.03, 0.08], sat: 0.45, charTint: [0.95, 0.82, 0.85], emissive: "#1a0c16",
    grade: G([0, 0.09, 0.25, 0.52, 0.78, 0.92, 1], [0.75, 0.8, 0.85], [0.5, 0.3], [0.04, 0.05], [0.02, 0.04], [0, 0.02]) },
};

// ---------------- shots ----------------
/** a 2D card in the world: cast.ts drawing on a camera-facing plane anchored at `anchor` (foot by default) */
export type CastE = { key: string; opts?: CharOpts; pos: V3; scale?: number; anchor?: "foot" | "rim"; yaw?: number; roll?: number; screen?: boolean; shadow?: boolean; order?: number };
/** a screen-space overlay (px at OUT_W x OUT_H): use for anything whose SCREEN path was measured (hands, pops, drops) */
export type Ov = { key: string; opts?: CharOpts; x: number; y: number; h: number; anchor?: "top" | "center" | "foot"; alpha?: number; roll?: number };
export type Key = { f: number; pos: V3; look: V3; fov: number; roll?: number; ease?: "glide" | "in" | "out" | "linear" | "hold" };
export type Shot = {
  id: string; set: string; a: number; b: number; look: string; lookAt?: (f: number) => string;
  keys: Key[]; camFn?: (f: number) => Cam;
  cast?: (f: number) => CastE[]; overlay?: (f: number) => Ov[];
  props?: (f: number) => Record<string, unknown>;          // free-form state for the set's update() (flyers, props ...)
  dof?: (f: number) => { cInf: number; focus?: number };    // thin-lens blur (verify it works in your composer!)
  blurAt?: (f: number) => number;                            // whole-frame display-space blur sigma (px at OUT_W)
  dimAt?: (f: number) => [number, number];                   // display-space multiply, frame top / bottom
  shutterAt?: (f: number) => number; extraBlurPx?: (f: number) => number; shadowR?: number;
  fadeIn?: number;                                           // linear crossfade length (frames) at the start
  fade?: (f: number) => number;                              // measured alpha curve of the incoming shot (overrides fadeIn)
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const EASE = { glide, linear: clamp01, in: (u: number) => clamp01(u) ** 2.2, out: (u: number) => 1 - (1 - clamp01(u)) ** 2.2, hold: () => 0 };
const L3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** camera at frame f: keys interpolate with the ease of the key being approached (fov too, so pushes can zoom) */
export const camAt = (s: Shot, f: number): Cam => {
  if (s.camFn) return s.camFn(f);
  const K = s.keys;
  if (f <= K[0].f) return { pos: K[0].pos, look: K[0].look, fov: K[0].fov, roll: K[0].roll ?? 0 };
  for (let i = 1; i < K.length; i++) {
    if (f <= K[i].f) {
      const a = K[i - 1], b = K[i], u = EASE[b.ease ?? "glide"]((f - a.f) / (b.f - a.f));
      return { pos: L3(a.pos, b.pos, u), look: L3(a.look, b.look, u), fov: a.fov + (b.fov - a.fov) * u, roll: (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * u };
    }
  }
  const z = K[K.length - 1];
  return { pos: z.pos, look: z.look, fov: z.fov, roll: z.roll ?? 0 };
};

export const SHOTS: Shot[] = SHOT_LIST;
/** shots visible at frame f with their alpha: two overlapping shots = crossfade (the later one fades in on top) */
export const layersAt = (f: number): { shot: Shot; alpha: number }[] => {
  const on = SHOTS.filter((s) => f >= s.a && f < s.b + 1);
  if (on.length <= 1) return on.map((shot) => ({ shot, alpha: 1 }));
  on.sort((x, y) => x.a - y.a);
  const top = on[on.length - 1];
  const a = top.fade ? clamp01(top.fade(f)) : top.fadeIn ? clamp01((f - top.a) / top.fadeIn) : 1;
  return a >= 1 ? [{ shot: top, alpha: 1 }] : [{ shot: on[on.length - 2], alpha: 1 }, { shot: top, alpha: a }];
};

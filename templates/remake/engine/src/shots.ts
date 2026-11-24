// EXAMPLE shot list (6 s). Replace with your remake's shots, built from the measurement reports:
//   - frame ranges and transitions from the cuts report (a, b; crossfade = overlapping ranges + a measured `fade` curve)
//   - camera keys from solved key frames (tools/fit_layout.py) joined with the measured eases; a push that the report
//     gives as a global scale (x2.5 at %/f) is usually a ZOOM: animate fov with the dolly. Derive close-up lenses from
//     the measured whip-pan travel between neighbours (950 px between heads 0.9 m apart = a ~20 deg lens).
//   - anything whose SCREEN path was measured (hands, drops, pops, walk-ins) goes on `overlay` at those px values
//   - every hold creeps; nothing pops into view (QA flags visibility pops)
import type { Shot, CastE, V3, Key, Ov } from "./story";
import { CAST } from "./cast";

const SU = 0.0021;
const sc = (key: string, m: number) => m / ((CAST[key]?.h ?? 1000) * SU); // card scale for a card m metres tall
const K = (f: number, pos: V3, look: V3, fov: number, ease?: Key["ease"], roll = 0): Key => ({ f, pos, look, fov, ease, roll });
const blinkAt = (f: number, period = 47, ph = 0) => (((f + ph) % period) < 4 ? 1 : 0);
const cl = (u: number) => Math.max(0, Math.min(1, u));
/** piecewise-linear lookup of a measured per-frame table [[f, v], ...] */
export const tab = (pts: [number, number][], f: number) => {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (f <= pts[i][0]) { const [f0, v0] = pts[i - 1], [f1, v1] = pts[i]; return v0 + (v1 - v0) * cl((f - f0) / (f1 - f0)); }
  return pts[pts.length - 1][1];
};

const HERO: V3 = [-1.5, 0, -12];
// shot 1, f1-100: low street view, dolly + zoom push-in (fov 50 -> 30) on the hero
const intro: Shot = {
  id: "intro", set: "street", a: 1, b: 100, look: "day",
  keys: [K(1, [1.2, 1.1, 2], [-1.2, 1.6, -12], 50), K(80, [0.2, 1.3, -4], [-1.4, 1.5, -12], 30, "glide"), K(100, [0.18, 1.3, -4.2], [-1.4, 1.5, -12], 30, "linear")],
  cast: (f) => [{ key: "beanBlue", opts: { expr: f < 70 ? "neutral" : "smile", pose: f > 85 ? "wave" : "stand", blink: blinkAt(f) }, pos: HERO, scale: sc("beanBlue", 1.9) }],
};
// shot 2, f91-180: crossfade in (measured ease-out curve), the houses fly away, a heart pops on screen
const take: Shot = {
  id: "take", set: "street", a: 91, b: 180, look: "day",
  fade: (f) => [0.17, 0.34, 0.49, 0.59, 0.67, 0.72, 0.78, 0.83, 0.87, 0.92, 0.97, 1][Math.max(0, Math.min(11, Math.floor(f - 91)))],
  keys: [K(91, [6, 1.6, -12.5], [-1.5, 2.4, -12], 45), K(180, [6.6, 1.6, -12.6], [-1.5, 2.6, -12], 45, "linear")],
  props: (f) => ({ take: cl((f - 110) / 50) }),
  cast: (f): CastE[] => [
    { key: "beanGreen", opts: { expr: f < 120 ? "neutral" : "shock", blink: blinkAt(f, 41) }, pos: HERO, scale: sc("beanGreen", 1.9) },
    ...(f > 150 ? [{ key: "coin", pos: [HERO[0] + 0.6, 0.02 + Math.max(0, 1.6 - (f - 150) * 0.12), HERO[2] + 0.4] as V3, scale: sc("coin", 0.25), shadow: false }] : []),
  ],
  overlay: (f): Ov[] => (f >= 160 && f < 176 ? [{ key: "heart", x: 200, y: 320 - (f - 160) * 7, h: tab([[160, 50], [166, 100], [176, 96]], f), anchor: "center" }] : []),
};

export const SHOT_LIST: Shot[] = [intro, take];

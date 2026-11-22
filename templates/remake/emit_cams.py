"""Turn tools/fit.json into the CAMS / ROLL tables of engine/src/story.ts (measured eases between solved keys)."""
import json, math, numpy as np, re, os
HERE = os.path.dirname(os.path.abspath(__file__)); F = json.load(open(os.path.join(HERE, "fit.json")))
P = lambda k: np.array(F[k]["pos"]); L = lambda k: np.array(F[k]["look"])
def tilt(pos, look, deg, yaw=0.0):
    d = look - pos; n = np.linalg.norm(d); d /= n
    el = math.asin(d[1]) + math.radians(deg); az = math.atan2(d[0], -d[2]) + math.radians(yaw)
    return pos + n * np.array([math.cos(el) * math.sin(az), math.sin(el), -math.cos(el) * math.cos(az)])
def push(pos, look, k):  # move toward look by fraction k of the 10 m look distance... along view, metres
    d = look - pos; d /= np.linalg.norm(d); return pos + d * k, look + d * k
r = lambda v: "[" + ", ".join(f"{x:.3f}" for x in v) + "]"
keys = {}
a1p, a1l, a60p, a60l = P("A1"), L("A1"), P("A60"), L("A60")
keys["A"] = [(1, a1p, a1l, 52, None), (59, a60p, a60l, 39.7, "push"), (61, a60p, tilt(a60p, a60l, 0.4), 39.7, "linear"), (67, a60p, tilt(a60p, a60l, 7), 39.7, "in"),
             (75, a60p, tilt(a60p, a60l, 38), 39.7, "linear"), (88, a60p, tilt(a60p, a60l, 52), 39.7, "out")]
bp, bl = P("B108"), L("B108")
b138p, b138l = push(bp, tilt(bp, bl, 0, -3.7), 1.3)
rp, rl = P("B160"), L("B160"); ring = np.array([3.7, 7.55, -30.2])
r197 = ring + (rp - ring) * 0.877
mp0, ml0 = P("B237"), L("B237"); head = np.array([-2.2, 0.62 + 666 * 0.0021, -28.75])
# verifier: face 25 % too large and 55-81 px low; push x1.43 from f214 -> back off 1.25x, aim ~68 px lower
mp = head + (mp0 - head) * 1.05; ml = ml0 + (mp - mp0)
d = np.linalg.norm(head - mp); ml = ml - np.array([0, 8 / 2376 * np.linalg.norm(ml - mp), 0])
m214 = head + (mp - head) * 1.43
hi = bp + np.array([0, 42.0, 0]); d0 = bl - bp; d0[1] = 0; d0 = d0 / np.linalg.norm(d0)
lv = lambda p, deg: p + 10 * np.array([d0[0] * math.cos(math.radians(deg)), math.sin(math.radians(deg)), d0[2] * math.cos(math.radians(deg))])
keys["B"] = [(76, hi, lv(hi, 10), 50, None), (81, hi - np.array([0, 1.0, 0]), lv(hi - np.array([0, 1.0, 0]), 8), 50, "linear"), (108, bp, bl, 50, "glide"),
             (138, b138p, b138l, 50, "linear"), (147, b138p, tilt(b138p, b138l, 5, 38), 50, "in"), (148, rp, tilt(rp, rl, 4, -32), 46, "linear"), (159, rp, rl, 46, "out"), (197, r197, rl + (r197 - rp), 46, "linear"),
             (213, m214, tilt(m214, ml + (m214 - mp), 0, -3.4), 44, "glide"), (237, mp, ml, 44, "out"),
             (256, mp + np.array([0.12, 0, 0]), ml + np.array([0.3, 0, 0]), 44, "linear")]
cp, cl, ep, el_ = P("C300"), L("C300"), P("C360_40"), L("C360_40")
mix = lambda a, b, t: a + (b - a) * t
# measured truck: content velocity ramps 0.1 -> 6.7 px/f over f258-296, ~6 px/f to f320, eases to 0 at f357.
# s(f) = normalised cumulative displacement; the path passes C300 at s(300) and C360 at s = 1 (no kicks).
vel = lambda f: 0.0 if f < 258 else (0.1 + 6.6 * (f - 258) / 38 if f < 296 else (6.2 if f < 320 else (6.2 * (1 - ((f - 320) / 37)) ** 1.6 if f < 357 else 0.0)))
cum = np.cumsum([vel(f) for f in range(245, 361)]); S = lambda f: cum[f - 245] / cum[-1]
s3 = S(300); p0 = cp - (ep - cp) * s3 / (1 - s3); l0 = cl - (el_ - cl) * s3 / (1 - s3)
def pose(f):
    s = S(f)
    if s <= s3: u = s / s3; return mix(p0, cp, u), mix(l0, cl, u), 51.5 + (49 - 51.5) * u
    u = (s - s3) / (1 - s3); return mix(cp, ep, u), mix(cl, el_, u), 49 + (40 - 49) * u
keys["C"] = [(245, *pose(245), None)] + [(f, *pose(f), "linear") for f in range(258, 361)]
lines = ["export const CAMS: Record<SetId, Key[]> = {"]
for s in "ABC":
    lines.append(f"  {s}: [")
    for f, p, l, fov, e in keys[s]:
        lines.append(f"    {{ t: F({f}), pos: {r(p)}, look: {r(l)}, fov: {fov}{', ease: \"' + e + '\"' if e else ''} }},")
    lines.append("  ],")
lines.append("};")
roll = {"A": [(1, F["A1"]["roll"]), (60, F["A60"]["roll"]), (88, F["A60"]["roll"])],
        "B": [(76, 1.6), (84, 1.6), (92, 1.6), (99.5, -8.7), (105, 0), (108, F["B108"]["roll"]), (138, F["B108"]["roll"]), (159, F["B160"]["roll"]),
              (200, F["B160"]["roll"]), (207, -20), (214, F["B237"]["roll"]), (241, F["B237"]["roll"]), (256, -6)],
        "C": [(245, F["C300"]["roll"]), (300, F["C300"]["roll"]), (360, F["C360_40"]["roll"])]}
lines.append("/** roll in degrees (solved per key, measured swings in between), smooth between keys */")
lines.append("export const ROLL: Record<SetId, [number, number][]> = {")
for s in "ABC": lines.append(f"  {s}: [" + ", ".join(f"[F({f}), {v}]" for f, v in roll[s]) + "],")
lines.append("};")
src = os.path.join(HERE, "..", "engine", "src", "story.ts"); t = open(src, encoding="utf8").read()
a = t.index("export const CAMS"); b = t.index("const rollAt")
t = t[:a] + "\n".join(lines) + "\n" + t[b:]
open(src, "w", encoding="utf8").write(t)
print("\n".join(lines))

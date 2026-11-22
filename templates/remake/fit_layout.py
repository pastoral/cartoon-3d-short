"""Layout fit (small bundle adjustment) for each key frame of the remake.

The reference composites flat characters over 3D ships, so no single camera fits pirates + horizon + ships exactly
(plain solvePnP on the pirates put the horizon 100 px off). This fits, per key frame, the camera (x, y, z, yaw, pitch,
roll at the measured fov) TOGETHER with the pirates' positions / scales, against:
  pt      : a pirate point (head centre / feet) -> reference px
  horizon : the sea horizon must pass through (u, v)
  line    : a world line (point p, direction d), e.g. a ship waterline, must pass through (u, v)
  ray     : (after the fit) back-project (u, v) onto a plane -> 3D, to place props (flags, ladders, ships)
Weak priors keep every free parameter near the hand layout. Output: tools/fit.json + a report with errors in % of H.
Camera conventions are three.js: camera looks along -z, yaw about +y, then pitch about x, then roll about the view axis.
"""
import json, math, os
import numpy as np
from scipy.optimize import least_squares

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1920
SU = 0.0021

def head_h(T, s):  # head-centre height above the soles (m) for a pirate card of build T, scale s (pirates.ts)
    hip = 975 - 338 * T; body_top = hip - 243; hcy = body_top - 85   # pirates.ts pirateGeo
    return (975 - hcy) * SU * s

def rot(yaw, pitch, roll):
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    Rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]])
    return Ry @ Rx @ Rz  # camera-to-world

def project(cam, P, f):
    R = rot(*cam[3:6]); c = (P - cam[:3]) @ R  # world -> camera
    return np.stack([W / 2 + f * c[..., 0] / -c[..., 2], H / 2 - f * c[..., 1] / -c[..., 2]], -1), c[..., 2]

def fit(key, k):
    f = (H / 2) / math.tan(math.radians(k["fov"]) / 2)
    crew = k["crew"]  # name -> [x, foot_y, z, s, T]
    names = list(crew)
    x0 = np.array(k["cam0"] + sum(([0.0, 0.0, 0.0] for _ in names), []), float)  # cam (6) + per pirate dx, dz, ds
    def unpack(x):
        cam = x[:6]; pir = {}
        for i, n in enumerate(names):
            bx, fy, bz, s, T = crew[n]; dx, dz, ds = x[6 + 3 * i: 9 + 3 * i]
            pir[n] = (bx + dx, fy, bz + dz, s * (1 + ds), T)
        return cam, pir
    def pt3(pir, n, what):
        x, fy, z, s, T = pir[n]
        return np.array([x, fy + (head_h(T, s) if what == "head" else 0.0), z])
    def resid(x):
        cam, pir = unpack(x); r = []
        for u, v, n, what in k.get("pts", []):
            p, _ = project(cam, pt3(pir, n, what)[None], f); r += list((p[0] - [u, v]) / H * 100)
        for u, v, X, Y, Z in k.get("fixed", []):
            p, _ = project(cam, np.array([[X, Y, Z]], float), f); r += list((p[0] - [u, v]) / H * 100)
        for u, v in k.get("horizon", []):
            R = rot(*cam[3:6]); fwd = -R[:, 2]; d = np.array([fwd[0], 0, fwd[2]]); d /= np.linalg.norm(d)
            side = np.cross(d, [0, 1, 0]); far = cam[:3] + d * 1e5
            a, _ = project(cam, np.array([far + side * 2e4, far - side * 2e4]), f)
            # distance of (u, v) from the projected horizon line
            n_ = np.array([a[1][1] - a[0][1], a[0][0] - a[1][0]]); n_ /= np.linalg.norm(n_)
            r.append(2.0 * ((np.array([u, v]) - a[0]) @ n_) / H * 100)
        for u, v, p0, d in k.get("lines", []):
            p0, d = np.array(p0, float), np.array(d, float)
            a, _ = project(cam, np.array([p0 - d * 30, p0 + d * 30]), f)
            n_ = np.array([a[1][1] - a[0][1], a[0][0] - a[1][0]]); n_ /= np.linalg.norm(n_)
            r.append(((np.array([u, v]) - a[0]) @ n_) / H * 100)
        prior = k.get("prior", 0.4)
        r += list(prior * x[6:])                              # pirates stay near the hand layout
        r += list(k.get("camw", 0.05) * (x[:3] - np.array(k["cam0"][:3])))   # camera position prior
        return np.array(r)
    sol = least_squares(resid, x0, method="lm" if len(resid(x0)) >= len(x0) else "trf")
    cam, pir = unpack(sol.x)
    R = rot(*cam[3:6]); fwd = -R[:, 2]; up = R[:, 1]
    look = cam[:3] + fwd * 10
    wy = np.array([0, 1.0, 0]); u0 = wy - fwd * (wy @ fwd); u0 /= np.linalg.norm(u0)
    roll = math.degrees(math.atan2(np.cross(u0, up) @ fwd, u0 @ up))
    errs = {}
    for u, v, n, what in k.get("pts", []):
        p, _ = project(cam, pt3(pir, n, what)[None], f); errs[f"{n}_{what}"] = round(float(np.hypot(*(p[0] - [u, v])) / H * 100), 2)
    for u, v, X, Y, Z in k.get("fixed", []):
        p, _ = project(cam, np.array([[X, Y, Z]], float), f); errs[f"fixed_{X}_{Y}_{Z}"] = round(float(np.hypot(*(p[0] - [u, v])) / H * 100), 2)
    rays = {}
    for u, v, ax, val, name in k.get("rays", []):
        d = R @ np.array([(u - W / 2) / f, -(v - H / 2) / f, -1.0]); i = "xyz".index(ax)
        t = (val - cam[i]) / d[i]; rays[name] = [round(float(c), 3) for c in cam[:3] + d * t] + ([] if t > 0 else ["BEHIND"])
    hor = None
    if True:
        d = np.array([fwd[0], 0, fwd[2]]); d /= np.linalg.norm(d)
        p, _ = project(cam, (cam[:3] + d * 1e5)[None], f); hor = round(float(p[0][1]), 1)
    out = {"set": k["set"], "frame": k["frame"], "fov": k["fov"], "pos": [round(float(v), 3) for v in cam[:3]],
           "look": [round(float(v), 3) for v in look], "roll": round(roll, 2), "horizon_v_at_centre": hor,
           "crew": {n: [round(float(v), 3) for v in pir[n][:4]] for n in names}, "err_pct": errs, "rays": rays}
    print(f"{key:5s} pos {out['pos']} look {out['look']} roll {out['roll']} hor {hor}  max pt err {max(errs.values()) if errs else 0:.2f}%")
    print(f"      crew {out['crew']}")
    for n, p in rays.items(): print(f"      ray {n}: {p}")
    return out

if __name__ == "__main__":
    K = json.load(open(os.path.join(HERE, "layout_keys.json")))
    res = {key: fit(key, k) for key, k in K.items()}
    json.dump(res, open(os.path.join(HERE, "fit.json"), "w"), indent=1)

"""Anchor-solved cameras for the remake (look-match round 2).

anchors.json: { "<key>": { "set": "A", "frame": 60, "fov": 39.7,
                           "pts":  [[u, v, x, y, z, "name"], ...],      # reference px (1080x1920) <-> set-local metres
                           "rays": [[u, v, "y"|"z"|"x", value, "name"], ...] } }  # back-project onto a plane
For each key: OpenCV solvePnP (fixed intrinsics from the vertical fov) -> camera position, a look point 10 m ahead and
the roll (deg) in three.js conventions (camera.lookAt(look); camera.rotateZ(roll)). Prints the reprojection error per
anchor in % of frame height and the 3D points of the rays. Writes tools/solved.json.
"""
import json, math, sys, os
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(HERE, "anchors.json")))
W, H = 1080, 1920
out = {}
for key, k in A.items():
    f = (H / 2) / math.tan(math.radians(k["fov"]) / 2)
    K = np.array([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]], float)
    P = np.array([p[2:5] for p in k["pts"]], float)
    # three.js y-up world -> OpenCV is just the same world; the camera convention differs (handled below)
    uv = np.array([p[0:2] for p in k["pts"]], float)
    ok, rv, tv = cv2.solvePnP(P, uv, K, None, flags=cv2.SOLVEPNP_SQPNP if len(P) >= 3 else cv2.SOLVEPNP_ITERATIVE)
    ok, rv, tv = cv2.solvePnP(P, uv, K, None, rv, tv, useExtrinsicGuess=True, flags=cv2.SOLVEPNP_ITERATIVE)
    R, _ = cv2.Rodrigues(rv)
    C = (-R.T @ tv).ravel()                    # camera centre (world)
    fwd = R.T @ np.array([0, 0, 1.0])          # OpenCV camera looks along +z
    up = R.T @ np.array([0, -1.0, 0])          # OpenCV image y points down
    look = C + fwd * 10
    # three.js lookAt keeps world-up: default up = component of world Y orthogonal to fwd; roll = angle to `up`
    wy = np.array([0, 1.0, 0]); u0 = wy - fwd * (wy @ fwd); u0 /= np.linalg.norm(u0)
    roll = math.degrees(math.atan2(np.cross(u0, up) @ fwd, u0 @ up))
    proj, _ = cv2.projectPoints(P, rv, tv, K, None)
    err = np.linalg.norm(proj.reshape(-1, 2) - uv, axis=1) / H * 100
    res = {"set": k["set"], "frame": k["frame"], "fov": k["fov"], "pos": [round(v, 3) for v in C], "look": [round(v, 3) for v in look],
           "roll": round(roll, 2), "err_pct": {p[5]: round(e, 2) for p, e in zip(k["pts"], err)}, "rays": {}}
    for u, v, ax, val, name in k.get("rays", []):
        d = R.T @ np.linalg.inv(K) @ np.array([u, v, 1.0])
        i = {"x": 0, "y": 1, "z": 2}[ax]
        t = (val - C[i]) / d[i]
        res["rays"][name] = [round(c, 3) for c in (C + d * t)]
    out[key] = res
    print(f"{key:6s} pos {res['pos']} look {res['look']} roll {res['roll']}  max err {max(err):.2f}%  {res['err_pct']}")
    for n, p in res["rays"].items(): print(f"        ray {n}: {p}")
json.dump(out, open(os.path.join(HERE, "solved.json"), "w"), indent=1)

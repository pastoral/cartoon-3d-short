// Generic set-building kit: plaster box houses with painted facades and a hipped tile roof, a cobbled floor with metre
// UVs, round trees, a field tile, and "flyers" (any object that can lift off and tumble away into the sky).
// Recolour the STY palette from your reference's measured hex values.
import * as THREE from "three";
import { lam } from "./mats";
import { facadeHD, roofHD, cobbleHD, rep, rng, ctex } from "./paint";

export const STY = [
  { wall: "#f1dfb0", shutter: "#b8243a" },
  { wall: "#efd49c", shutter: "#b8243a" },
  { wall: "#f4e4bd", shutter: "#1f7d78" },
  { wall: "#9aa6bd", shutter: "#1f7d78" },
  { wall: "#e8c27a", shutter: "#b8243a" },
];
export const ROOFS = ["#e0763c", "#d9653a", "#e88a48"];

/** box house w x d x h metres (front = +z face): facade texture on all sides, cornice, low hipped roof */
export const house = (w: number, d: number, h: number, si: number) => {
  const g = new THREE.Group(), st = STY[si % STY.length];
  const front = lam(`kf${si}_${w}_${h}`, () => ({ map: facadeHD(`kf${si}_${w}_${h}`, w, h, { ...st, door: true }) }));
  const side = lam(`ks${si}_${d}_${h}`, () => ({ map: facadeHD(`ks${si}_${d}_${h}`, d, h, st) }));
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, lam("roofTop" + si, () => ({ color: ROOFS[si % 3] })), side, front, front]);
  box.position.y = h / 2; box.castShadow = box.receiveShadow = true; g.add(box);
  const cor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), lam("cornice", () => ({ color: "#f5ecd6" })));
  cor.position.y = h - 0.1; cor.castShadow = true; g.add(cor);
  const rh = Math.min(w, d) * 0.28;
  const rg = new THREE.CylinderGeometry(0.3, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
  rg.scale(w + 0.6, rh, d + 0.6); rg.translate(0, h + rh / 2 + 0.05, 0);
  const roof = new THREE.Mesh(rg, lam("roof" + si, () => ({ map: rep(roofHD(ROOFS[si % 3]), 2, 2) })));
  roof.castShadow = roof.receiveShadow = true; g.add(roof);
  return g;
};

/** cobbles on a w x d plane (cobbleHD tile = 8 m) */
export const cobbleFloor = (w: number, d: number, key = "cob") => {
  const t = rep(cobbleHD(), w / 8, d / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), lam(key + w + "_" + d, () => ({ map: t })));
  m.receiveShadow = true; return m;
};

/** round cartoon tree, s = scale (about 2.5 m tall at s = 1) */
export const tree = (s = 1, seed = 1) => {
  const g = new THREE.Group(), r = rng(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.4 * s, 8), lam("trunk", () => ({ color: "#7a4e2a" })));
  trunk.position.y = 0.7 * s; trunk.castShadow = true; g.add(trunk);
  const leaf = lam("leaf", () => ({ color: "#4fae3a" }));
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry((0.55 + r() * 0.3) * s, 1), leaf);
    b.position.set((r() - 0.5) * 0.9 * s, (1.7 + r() * 0.8) * s, (r() - 0.5) * 0.9 * s); b.castShadow = true; g.add(b);
  }
  return g;
};

/** striped crop-field tile (a box, so it can fly with a visible thickness) */
export const fieldTile = (size: number, col: string, seed: number) => {
  const t = ctex(`field${seed}${col}`, 256, 256, (g) => {
    const r = rng(seed); g.fillStyle = col; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(60,90,20,0.25)"; g.lineWidth = 3;
    const n = 8 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) { const y = ((i + 0.5) * 256) / n; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, 0.3, size), lam("field" + col + seed, () => ({ map: t })));
  m.castShadow = m.receiveShadow = true; return m;
};

// ---------------- flyers ----------------
/** something that can be "taken away": lift (metres at the end of the move), delay 0..1 staggers the start */
export type Flyer = { obj: THREE.Object3D; home: THREE.Vector3; homeRot: THREE.Euler; seed: number; delay: number; lift: number };
export const flyer = (obj: THREE.Object3D, seed: number, delay = 0, lift = 260): Flyer =>
  ({ obj, home: obj.position.clone(), homeRot: obj.rotation.clone(), seed, delay, lift });
/** pose a flyer: u = 0 at home .. 1 gone (cubic ease-in, drift and tumble). Objects that must be revealed later should
 *  start hidden INSIDE something that lifts first (a house), not pop into view: QA flags a visibility pop. */
export const flyUp = (f: Flyer, u: number) => {
  const k = Math.max(0, Math.min(1, (u - f.delay * 0.3) / 0.7)), e = k * k * k;
  f.obj.position.set(f.home.x + (f.seed - 0.5) * 20 * e, f.home.y + f.lift * e, f.home.z + (f.seed - 0.3) * 10 * e);
  f.obj.rotation.set(f.homeRot.x + e * (f.seed - 0.5) * 2, f.homeRot.y + e * f.seed * 1.5, f.homeRot.z + e * (0.5 - f.seed) * 1.2);
  f.obj.visible = e < 0.999;
};

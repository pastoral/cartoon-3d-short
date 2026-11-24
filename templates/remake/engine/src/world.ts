// The world: a registry of sets (sets.ts), each built far apart under one sky dome, plus a pool of 2D character /
// prop cards (cast.ts drawings on camera-facing planes, texture density from the projected size, LRU cache).
// Per frame the active shot poses the camera, the look (sun, two-tone light, fog, sky), the set (its update hook gets
// the shot's props) and every card.
import * as THREE from "three";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { CARD_K, cardShade } from "./cardshade";
import { Pen } from "./toon";
import { Sky } from "./sky";
import { CAST, CharOpts } from "./cast";
import { SETS, SetState } from "./sets";
import { Shot, LOOKS, Cam, CastE, OUT_H } from "./story";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const SU = 0.0021; // metres per card design unit (1000 units = 2.1 m)

const texCache = new Map<string, THREE.CanvasTexture>();
const cardTex = (key: string, w: number, h: number, k: number, draw: (p: Pen) => void) => {
  let t = texCache.get(key);
  if (t) { texCache.delete(key); texCache.set(key, t); } // LRU refresh
  if (!t) {
    while (texCache.size >= 60) { const [k0, t0] = texCache.entries().next().value!; texCache.delete(k0); if (k0 === "blank") { texCache.set(k0, t0); continue; } t0.dispose(); }
    const cv = document.createElement("canvas"); cv.width = Math.max(2, Math.round(w * k)); cv.height = Math.max(2, Math.round(h * k));
    const g = cv.getContext("2d")!; g.setTransform(k, 0, 0, k, 0, 0); draw(new Pen(g));
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    texCache.set(key, t);
  }
  return t;
};

class Card {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; geoKey = "";
  constructor(parent: THREE.Object3D) {
    // GOTCHA: give the material a map from the start. A material compiled without one never picks a map up later
    // (three only recompiles on needsUpdate) and every card renders invisible.
    const blank = cardTex("blank", 2, 2, 1, () => {});
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = true; this.mesh.layers.set(NOINK); this.mesh.renderOrder = 1;
    parent.add(this.mesh);
  }
  /** card plane w x h design units with design y = anchorY at the local origin (design y runs DOWN: translate by
   *  anchorY - h/2; the opposite sign puts every character underground). Rolling the mesh pivots on this anchor, so
   *  spin round props (a tumbleweed) inside the drawing instead. */
  shape(w: number, h: number, anchorY: number) {
    const k = `${w}|${h}|${anchorY}`;
    if (k === this.geoKey) return;
    this.geoKey = k; this.mesh.geometry.dispose();
    const g = new THREE.PlaneGeometry(w * SU, h * SU); g.translate(0, (anchorY - h / 2) * SU, 0);
    this.mesh.geometry = g;
  }
  set(t: THREE.Texture) { this.mat.map = t; this.dmat.map = t; }
}

export class World {
  root = new THREE.Group();
  sky = new Sky();
  sun = new THREE.DirectionalLight(0xffffff, 3);
  sets: Record<string, SetState & { origin: THREE.Vector3 }> = {};
  cards: Card[] = [];
  constructor() {
    this.root.add(this.sky.root);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    this.root.add(this.sun, this.sun.target);
    for (const [id, def] of Object.entries(SETS)) {
      const r = new THREE.Group(); r.position.set(...def.origin); this.root.add(r);
      this.sets[id] = { ...def.build(r, this.sky), origin: V(...def.origin) };
    }
    for (let i = 0; i < 60; i++) this.cards.push(new Card(this.root));
  }

  private cardPx(p: THREE.Vector3, cam: THREE.PerspectiveCamera, h: number) {
    const d = Math.max(0.3, cam.position.distanceTo(p));
    return (h / (2 * d * Math.tan((cam.fov * Math.PI) / 360))) * OUT_H * 2; // texels on the 2x supersampled buffer
  }

  update(shot: Shot, f: number, c: Cam, cam: THREE.PerspectiveCamera) {
    const S = this.sets[shot.set], o = S.origin, L = LOOKS[shot.lookAt ? shot.lookAt(f) : shot.look];
    for (const k of Object.keys(this.sets)) this.sets[k].root.visible = k === shot.set;
    cam.position.set(o.x + c.pos[0], o.y + c.pos[1], o.z + c.pos[2]);
    cam.up.set(0, 1, 0); cam.lookAt(o.x + c.look[0], o.y + c.look[1], o.z + c.look[2]);
    cam.rotateZ(THREE.MathUtils.degToRad(c.roll));
    cam.fov = c.fov; cam.near = 0.1; cam.far = 4000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // sun: azimuth from the set's -z axis, elevation; frozen per look (camera-independent so shadows don't swim)
    const az = THREE.MathUtils.degToRad(L.sunAz), el = THREE.MathUtils.degToRad(L.sunEl);
    const sunDir = V(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    const focus = V(o.x + c.look[0], o.y + c.look[1], o.z + c.look[2]);
    const R = THREE.MathUtils.clamp(cam.position.distanceTo(focus) * 1.4 + 8, 10, shot.shadowR ?? 120);
    this.sun.position.copy(focus).addScaledVector(sunDir, 600); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 100; sc.far = 1200; sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02 * (R / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = 0; TONE.uSideK.value = 0.97; TONE.uTerm.value = 0.02; TONE.uSat.value = L.sat; TONE.uBounce.value.set(0, 0, 0);
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = 0.95; CHAR.uGrad.value = L.charGrad ?? 0; CHAR.uBodyGrad.value = L.bodyGrad ?? 0; CHAR.uSideTint.value.set(1, 1, 1);
    const scene = this.root.parent as THREE.Scene | null;
    if (scene) scene.fog = L.fog ? new THREE.Fog(untone(L.fog[0]), L.fog[1], L.fog[2]) : null;
    this.sky.set(L.sky, L.clouds, cam);
    S.update?.(shot, f, L);
    // cards
    const list: CastE[] = shot.cast ? shot.cast(f) : [];
    this.cards.forEach((cd) => (cd.mesh.visible = false));
    list.forEach((e, i) => {
      const cd = this.cards[i], def = CAST[e.key];
      if (!cd || !def) return;
      const opts: CharOpts = e.opts ?? {};
      cd.shape(def.w, def.h, e.anchor === "rim" && def.rimY !== undefined ? def.rimY : def.footY);
      const wp = V(o.x + e.pos[0], o.y + e.pos[1], o.z + e.pos[2]);
      const k = Math.min(4, Math.max(0.25, Math.ceil(this.cardPx(wp, cam, def.h * SU * (e.scale ?? 1)) / def.h / 0.25) * 0.25));
      const key = `${e.key}|${opts.expr ?? ""}|${opts.pose ?? ""}|${(opts.blink ?? 0) > 0.5 ? 1 : 0}|${opts.mirror ? 1 : 0}|${opts.t === undefined ? "" : Math.round(opts.t * 8)}@${k}`;
      cd.set(cardTex(key, def.w, def.h, k, (p) => def.draw(p, opts)));
      cd.mesh.visible = true;
      cd.mesh.position.copy(wp);
      if (e.screen) cd.mesh.quaternion.copy(cam.quaternion);
      else cd.mesh.rotation.set(0, Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z) + (e.yaw ?? 0), 0);
      if (e.roll) cd.mesh.rotateZ(e.roll);
      cd.mesh.scale.set(e.scale ?? 1, e.scale ?? 1, 1);
      cd.mesh.castShadow = e.shadow !== false;
      cd.mesh.renderOrder = 1 + (e.order ?? 0);
    });
    return { focus };
  }
}

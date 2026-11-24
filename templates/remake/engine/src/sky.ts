// Sky dome (5 stops by elevation, on-screen colours pre-inverted through the tone map) and flat cloud cards.
// Both are NOINK. The dome follows the camera.
import * as THREE from "three";
import { untone } from "./shade";
import { NOINK } from "./ink";
import { cloudHD, CLOUD_DAY } from "./paint";

const SKY_V = "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_F = `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
  vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
  c = mix(c, c2, smoothstep(e.x, e.y, el));
  c = mix(c, c3, smoothstep(e.y, e.z, el));
  c = mix(c, c4, smoothstep(e.z, e.w, el));
  gl_FragColor = vec4(c, 1.0); }`;

export class Sky {
  root = new THREE.Group();
  dome: THREE.Mesh; mat: THREE.ShaderMaterial;
  clouds: THREE.Mesh[] = [];
  constructor() {
    const U = () => ({ value: new THREE.Color() });
    this.mat = new THREE.ShaderMaterial({ uniforms: { c0: U(), c1: U(), c2: U(), c3: U(), c4: U(), e: { value: new THREE.Vector4() } },
      vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), this.mat);
    this.dome.renderOrder = -1; this.dome.frustumCulled = false; this.dome.layers.set(NOINK);
    this.root.add(this.dome);
  }
  /** a cloud card at a world position, w metres wide (turns to face the camera every frame) */
  cloud(seed: number, x: number, y: number, z: number, w: number) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: cloudHD(seed, CLOUD_DAY), transparent: true, depthWrite: false, fog: false }));
    m.position.set(x, y, z); m.layers.set(NOINK); m.renderOrder = -0.5;
    this.root.add(m); this.clouds.push(m);
    return m;
  }
  set(sky: { c: string[]; e: number[] }, showClouds: boolean, cam: THREE.Camera) {
    const u = this.mat.uniforms;
    sky.c.forEach((h, i) => untone(h, u["c" + i].value));
    const e = sky.e.map((d) => THREE.MathUtils.degToRad(d));
    u.e.value.set(e[1], e[2], e[3], e[4]);
    this.dome.position.copy(cam.position);
    for (const c of this.clouds) { c.visible = showClouds; c.lookAt(cam.position.x, c.position.y, cam.position.z); }
  }
}

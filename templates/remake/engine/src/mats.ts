// Cached two-tone Lambert materials for set geometry (shade.ts twoTone). One material per key.
import * as THREE from "three";
import { twoTone } from "./shade";

const mats = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (key: string, p: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(p())); mats.set(key, m); }
  return m;
};
/** every cached material (e.g. to set a per-look emissive tint) */
export const allMats = () => [...mats.values()];

// EXAMPLE set registry. Each set is built once at its own origin (sets sit kilometres apart so their sun shadows and
// fog never overlap) and may have an update hook called every frame with the active shot, frame and look.
// Replace with your remake's sets: one per place/time in the reference, matched on gridded key frames.
import * as THREE from "three";
import type { Shot, Look, V3 } from "./story";
import type { Sky } from "./sky";
import { house, cobbleFloor, tree, flyer, flyUp, Flyer } from "./kit";
import { allMats } from "./mats";

export type SetState = { root: THREE.Group; update?: (shot: Shot, f: number, look: Look) => void };
export type SetDef = { origin: V3; build: (root: THREE.Group, sky: Sky) => SetState };

/** a street along -z between two rows of houses (fronts at x = +-7); houses can "fly away" via shot.props(f).take */
const street: SetDef = {
  origin: [0, 0, 0],
  build: (root, sky) => {
    const cob = cobbleFloor(28, 200); cob.position.set(0, 0, -80); root.add(cob);
    const flyers: Flyer[] = [];
    let seed = 1;
    for (const side of [-1, 1]) {
      let z = 10, i = 0;
      while (z > -150) {
        const w = 7 + ((seed * 37) % 25) / 10, d = 10, h = 9.6;
        const hs = house(w, d, h, i + (side > 0 ? 2 : 0));
        hs.position.set(side * (7 + d / 2), 0, z - w / 2); hs.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        root.add(hs); flyers.push(flyer(hs, (seed * 0.618) % 1, ((seed * 0.37) % 1) * 0.6));
        z -= w + 0.02; i++; seed++;
      }
    }
    const tr = tree(1.6, 3); tr.position.set(0, 0, -160); root.add(tr);
    for (const [s, x, y, z, w] of [[1, -160, 120, -520, 220], [2, 120, 160, -600, 260], [3, 330, 110, -560, 200]]) sky.cloud(s, x, y, z, w);
    return {
      root,
      update: (shot, f, look) => {
        const take = (shot.props?.(f).take as number | undefined) ?? 0;
        for (const fl of flyers) flyUp(fl, take);
        for (const m of allMats()) m.emissive.set(look.emissive ?? "#000000");
      },
    };
  },
};

export const SETS: Record<string, SetDef> = { street };

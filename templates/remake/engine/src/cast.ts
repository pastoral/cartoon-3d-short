// EXAMPLE cast: every 2D character and flat prop as a Canvas2D drawing (Pen API from toon.ts). Replace with your
// remake's cast, drawn to the measured proportions (head w/h, eye size/spacing / head width, limb width, outline
// width / head width, hex colours). Keep this interface exactly: world.ts and main.ts depend on it.
//   w x h  design units per card (1000 units = 2.1 m, SU in world.ts); footY = design y that sits on the ground;
//   rimY   (optional) design y that sits on a container rim (people standing in barrels, boxes ...), used with
//          anchor: "rim"; draw the body down below it, the 3D container hides the rest.
// Build a preview sheet of every key x pose x expr and compare it to reference crops before using a drawing.
import { Pen } from "./toon";

export type CharOpts = { expr?: string; pose?: string; blink?: number; mirror?: boolean; t?: number };
export type CharDef = { w: number; h: number; footY: number; rimY?: number; draw: (p: Pen, o: CharOpts) => void };

type P2 = [number, number];
const INK = "#1c1016";
const path = (p: Pen, pts: P2[], close: boolean) => { const g = p.g; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
const fillStroke = (p: Pen, pts: P2[], fill: string, ol: number) => { const g = p.g; path(p, pts, true); g.fillStyle = fill; g.fill(); g.lineWidth = ol; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); };
const ell = (cx: number, cy: number, rx: number, ry: number, n = 56): P2[] => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)] as P2);
const line = (p: Pen, pts: P2[], w: number, col = INK) => { const g = p.g; g.lineCap = g.lineJoin = "round"; path(p, pts, false); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
const dot = (p: Pen, x: number, y: number, r: number, col = INK) => { const g = p.g; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); };
const mirrored = (p: Pen, w: number, m: boolean | undefined, f: () => void) => { const g = p.g; g.save(); if (m) { g.translate(w, 0); g.scale(-1, 1); } f(); g.restore(); };

/** bean-head stick figure, ~3.5 head-heights. exprs: neutral | smile | shock; poses: stand | wave; o.t drives a walk bob */
const bean = (coat: string, cap: string): CharDef => ({
  w: 600, h: 1000, footY: 975,
  draw: (p, o) => mirrored(p, 600, o.mirror, () => {
    const cx = 300, HW = 230, HH = 214, bob = Math.sin((o.t ?? 0) * Math.PI * 2) * 8, hy = 250 + bob, ol = 0.05 * HW;
    for (const s of [-1, 1]) line(p, [[cx + s * 40, 700 + bob], [cx + s * 46, 960]], 14);            // legs
    for (const s of [-1, 1]) dot(p, cx + s * 50, 966, 22);                                             // feet
    const wave = o.pose === "wave";
    line(p, [[cx - 95, 470 + bob], [cx - 160, 620 + bob]], 12);                                        // arms
    line(p, [[cx + 95, 470 + bob], wave ? [cx + 170, 330 + bob] : [cx + 160, 620 + bob]], 12);
    dot(p, cx - 160, 620 + bob, 16); dot(p, cx + (wave ? 170 : 160), (wave ? 330 : 620) + bob, 16);
    fillStroke(p, ell(cx, 560 + bob, 115, 175), coat, ol);                                              // bean body
    fillStroke(p, ell(cx, hy, HW / 2, HH / 2), "#f7e1c9", ol);                                          // head
    const g = p.g; g.save(); path(p, ell(cx, hy, HW / 2, HH / 2), true); g.clip();                      // cap
    g.fillStyle = cap; g.fillRect(cx - HW, hy - HH / 2, 2 * HW, HH * 0.4); g.restore();
    path(p, ell(cx, hy, HW / 2, HH / 2), true); g.lineWidth = ol; g.strokeStyle = INK; g.stroke();
    const ex = 0.13 * HW, ey = hy - 4, shut = (o.blink ?? 0) > 0.5;                                     // eyes
    for (const s of [-1, 1]) {
      if (shut) line(p, [[cx + s * ex - 14, ey], [cx + s * ex + 14, ey]], 6);
      else if (o.expr === "shock") { fillStroke(p, ell(cx + s * ex, ey, 24, 24), "#ffffff", 5); dot(p, cx + s * ex, ey, 7); }
      else dot(p, cx + s * ex, ey, 10);
    }
    if (o.expr === "smile") line(p, [[cx - 34, hy + 42], [cx, hy + 58], [cx + 34, hy + 42]], 7);          // mouth
    else if (o.expr === "shock") fillStroke(p, ell(cx, hy + 52, 16, 22), "#5a0118", 5);
    else line(p, [[cx - 24, hy + 50], [cx + 24, hy + 50]], 7);
  }),
});

export const CAST: Record<string, CharDef> = {
  beanBlue: bean("#3b6fb6", "#2a3f6e"),
  beanGreen: bean("#2f7d4f", "#7a9255"),
  coin: { w: 200, h: 200, footY: 200, draw: (p) => { fillStroke(p, ell(100, 100, 90, 90), "#f7d64f", 8); fillStroke(p, ell(100, 100, 62, 62), "#efc12e", 5); } },
  heart: { w: 220, h: 200, footY: 195, draw: (p) => {
    const pts: P2[] = [];
    for (let i = 0; i <= 64; i++) { const t = (i / 64) * Math.PI * 2; pts.push([110 + 16 * Math.sin(t) ** 3 * 6, 92 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 6]); }
    fillStroke(p, pts, "#f5233d", 9);
  } },
};

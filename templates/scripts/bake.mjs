// Bake the three.js layer to a PNG sequence with a GPU Chrome (HyperFrames' headless capture ran ~40 s/frame on a
// laptop; a GPU page renders a frame in ~1-5 s). Incremental: existing PNGs are skipped (delete a range to re-bake it).
// Usage: node tools/bake.mjs [puppeteer-core dir|-] [chrome exe|-] [from] [to]   (0-based frame indices, inclusive)
//        '-' = defaults: engine/node_modules/puppeteer-core (a devDependency of templates/remake/engine) and the
//        standard Chrome install. Don't point at the npx cache: it gets cleaned and its hash changes.
// Env:   PORT (default 8766: give every project its OWN port, a stale server on a shared port silently serves another
//        project's world), BAKE_OUT (out/bake), FRAMES (1-based list, forces re-render), SCALE (1), MAXSUB (24), FPS (30)
// Needs the project served: python -m http.server $PORT in the project folder. For long bakes use tools/bake_all.sh
// (retries after a hang) and keep the machine awake: a sleeping laptop stalls Chrome (protocol timeout).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const [, , pdirArg = "-", chromeArg = "-", from = "0", to = "359"] = process.argv;
const pdir = pdirArg === "-" ? path.resolve("engine/node_modules/puppeteer-core") : path.resolve(pdirArg);
const chrome = chromeArg === "-" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : chromeArg;
const PORT = process.env.PORT || 8766, FPS = Number(process.env.FPS || 30);
const entry = createRequire(import.meta.url).resolve(pdir); // the package main, whatever its version's layout
const mod = await import(pathToFileURL(entry).href), puppeteer = mod.default ?? mod;
const outDir = path.resolve(process.env.BAKE_OUT || "out/bake");
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chrome, headless: false, protocolTimeout: 600000,
  args: ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--window-size=800,1400", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[page]", m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${PORT}/engine/debug.html?scale=${process.env.SCALE || 1}&maxsub=${process.env.MAXSUB || 24}&t=0`, { waitUntil: "load" });
await page.waitForFunction(() => document.title === "ready", { timeout: 600000 });
const t0 = Date.now();
const list = process.env.FRAMES ? process.env.FRAMES.split(",").map((x) => Number(x) - 1) : Array.from({ length: Number(to) - Number(from) + 1 }, (_, i) => Number(from) + i);
for (const f of list) {
  const file = path.join(outDir, `f_${String(f + 1).padStart(4, "0")}.png`);
  if (fs.existsSync(file) && !process.env.FRAMES) continue;
  const b64 = await page.evaluate(async (t) => {
    window.__pirates.renderAt(t);
    const c = document.querySelector("#world3d-host canvas");
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, f / FPS);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  if (f % 10 === 0) console.log(`frame ${f + 1} done, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
console.log("baked", from, "..", to);

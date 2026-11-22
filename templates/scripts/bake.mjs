// Bake the three.js layer to a PNG sequence with a GPU Chrome (HyperFrames' headless capture ran ~40 s/frame on this
// machine; a GPU page renders a frame in 1-6 s). Usage: node tools/bake.mjs <puppeteer-core dir> <chrome exe> [from] [to]
// Needs the project served at http://127.0.0.1:8765 (python -m http.server 8765 in the project folder).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [, , pdir, chrome, from = "0", to = "359"] = process.argv;
const puppeteer = (await import(pathToFileURL(path.join(pdir, "lib/puppeteer/puppeteer-core.js")).href)).default;
const outDir = path.resolve(process.env.BAKE_OUT || "out/bake");
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chrome, headless: false,
  args: ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--window-size=700,1100", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
  protocolTimeout: 600000,
});
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[page]", m.text()); });
await page.goto("http://127.0.0.1:8765/engine/debug.html?scale=1&maxsub=24&t=0", { waitUntil: "load" });
await page.waitForFunction(() => document.title === "ready", { timeout: 600000 });
const t0 = Date.now();
const list = process.env.FRAMES ? process.env.FRAMES.split(",").map((x) => Number(x) - 1) : Array.from({ length: Number(to) - Number(from) + 1 }, (_, i) => Number(from) + i);
for (const f of list) {
  const file = path.join(outDir, `f_${String(f + 1).padStart(3, "0")}.png`);
  if (fs.existsSync(file) && !process.env.FRAMES) continue;
  const b64 = await page.evaluate(async (t) => {
    window.__pirates.renderAt(t);
    const c = document.querySelector("#world3d-host canvas");
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, f / 30);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  if (f % 10 === 0) console.log(`frame ${f + 1} done, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
console.log("baked", from, "..", to);

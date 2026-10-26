// TT-5 offline tracer: committed team logos → white-on-transparent outline PNGs for the Tuesday neon tiles,
// plus green and red contact sheets for TJ. Run from anywhere: `node tasks/artifacts/tuesday-trends-2026-10-26/tt5/trace-logo-outlines.mjs`.
// Reads each logo from the committed tree (`git show HEAD:web/public/teamLogos/X.png`), never the working tree, so
// a locally modified logo (OTT.png) cannot leak in. Writes web/public/teamLogos/outline/X.png and tt5/contact-sheet-*.png.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const sharp = createRequire(resolve(repo, "web/package.json"))("sharp");
export const TEAMS = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"];
const SIZE = 256, BLUR = 0.9, THRESHOLD = 0.22, STROKE = 3;
const GREEN = "#00ff99", RED = "#ff6b6b";

/** Edge strength from alpha and premultiplied colour (Sobel), thresholded, thinned to a skeleton, then given a stroke. */
async function trace(png) {
  const { data } = await sharp(png).resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(BLUR).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = SIZE * SIZE, ch = [0, 1, 2, 3].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) { const a = data[i * 4 + 3] / 255; ch[3][i] = a; for (let c = 0; c < 3; c++) ch[c][i] = (data[i * 4 + c] / 255) * a; }
  const edge = new Uint8Array(n);
  for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
    let best = 0;
    for (const plane of ch) {
      const p = (dx, dy) => plane[(y + dy) * SIZE + x + dx];
      const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
      const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
      best = Math.max(best, Math.hypot(gx, gy) / 4);
    }
    edge[y * SIZE + x] = best > THRESHOLD ? 1 : 0;
  }
  thin(edge);
  // Stroke: disc dilation, so a 256 px outline stays visible when drawn at 40–60 px.
  const out = new Uint8Array(n);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (edge[y * SIZE + x])
    for (let dy = -STROKE; dy <= STROKE; dy++) for (let dx = -STROKE; dx <= STROKE; dx++) {
      const yy = y + dy, xx = x + dx;
      if (dx * dx + dy * dy <= STROKE * STROKE + 1 && yy >= 0 && yy < SIZE && xx >= 0 && xx < SIZE) out[yy * SIZE + xx] = 255;
    }
  const rgba = Buffer.alloc(n * 4, 255);
  for (let i = 0; i < n; i++) rgba[i * 4 + 3] = out[i];
  const coverage = out.reduce((total, value) => total + (value ? 1 : 0), 0) / n;
  return { png: await sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } }).blur(0.6).png().toBuffer(), coverage };
}

/** Zhang–Suen thinning in place (1 = foreground). */
function thin(img) {
  const at = (x, y) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : img[y * SIZE + x]);
  for (let changed = true; changed;) {
    changed = false;
    for (const step of [0, 1]) {
      const clear = [];
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (!img[y * SIZE + x]) continue;
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
        const b = p.reduce((a, v) => a + v, 0), t = p.reduce((a, v, i) => a + (v === 0 && p[(i + 1) % 8] === 1 ? 1 : 0), 0);
        if (b < 2 || b > 6 || t !== 1) continue;
        if (step === 0 ? p[0] * p[2] * p[4] === 0 && p[2] * p[4] * p[6] === 0 : p[0] * p[2] * p[6] === 0 && p[0] * p[4] * p[6] === 0) clear.push(y * SIZE + x);
      }
      for (const i of clear) img[i] = 0;
      if (clear.length) changed = true;
    }
  }
}

async function tint(outline, color, size) {
  const { r, g, b } = { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) };
  const alpha = await sharp(outline).resize(size, size).extractChannel(3).toBuffer();
  const solid = await sharp({ create: { width: size, height: size, channels: 3, background: { r, g, b } } }).png().toBuffer();
  const tinted = await sharp(solid).joinChannel(alpha).png().toBuffer();
  const glow = await sharp(tinted).blur(3).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: glow }, { input: tinted }]).png().toBuffer();
}

async function sheet(outlines, originals, color, file) {
  const cell = 150, cols = 8, rows = 4, width = cols * cell, height = rows * cell + 50;
  const layers = [{ input: Buffer.from(`<svg width="${width}" height="50"><text x="16" y="34" font-family="Helvetica" font-size="22" font-weight="700" fill="${color}">FHFH Tuesday neon outlines (${color === GREEN ? "green, rise" : "red, fall"}) · traced offline from committed logos · original top-left</text></svg>`), top: 0, left: 0 }];
  for (const [i, team] of TEAMS.entries()) {
    const left = (i % cols) * cell, top = 50 + Math.floor(i / cols) * cell;
    layers.push({ input: await sharp(originals[team]).resize(34, 34, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top: top + 6, left: left + 6 });
    layers.push({ input: await tint(outlines[team], color, 108), top: top + 16, left: left + 21 });
    layers.push({ input: Buffer.from(`<svg width="${cell}" height="22"><text x="${cell / 2}" y="16" text-anchor="middle" font-family="Helvetica" font-size="15" font-weight="700" fill="#d8dde3">${team}</text></svg>`), top: top + 126, left });
  }
  await sharp({ create: { width, height, channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } }).composite(layers).png().toFile(file);
}

// Never inherit a GIT_DIR/GIT_WORK_TREE that points elsewhere (no-gitdir rule): git reads this checkout only.
const gitEnv = { ...process.env };
delete gitEnv.GIT_DIR; delete gitEnv.GIT_WORK_TREE;
const outDir = resolve(repo, "web/public/teamLogos/outline");
mkdirSync(outDir, { recursive: true });
const outlines = {}, originals = {}, report = {};
for (const team of TEAMS) {
  originals[team] = execFileSync("git", ["show", `HEAD:web/public/teamLogos/${team}.png`], { cwd: repo, maxBuffer: 64 << 20, env: gitEnv });
  const { png, coverage } = await trace(originals[team]);
  outlines[team] = png;
  writeFileSync(resolve(outDir, `${team}.png`), png);
  report[team] = Number(coverage.toFixed(4));
}
await sheet(outlines, originals, GREEN, resolve(here, "contact-sheet-green.png"));
await sheet(outlines, originals, RED, resolve(here, "contact-sheet-red.png"));
writeFileSync(resolve(here, "outline-coverage.json"), `${JSON.stringify({ size: SIZE, blur: BLUR, threshold: THRESHOLD, stroke: STROKE, coverage: report }, null, 2)}\n`);
console.log(`traced ${TEAMS.length} logos`);

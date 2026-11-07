// TT-7 tracer v2: cleaner neon outlines for the big tile art. Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt7/trace-logo-outlines-v2.mjs`.
// Changes from v1 (tt5/trace-logo-outlines.mjs): trace at 768 px and downsample to 384 px; the alpha silhouette
// contour is always kept, but interior colour edges are kept only when strong AND part of a long connected stroke,
// so wordmark letters and fine detail no longer clump; the stroke is thinner relative to the output.
// Reads each logo from the committed tree (git show HEAD:…, GIT_DIR stripped). Writes web/public/teamLogos/outline/X.png,
// tt7/contact-sheet-v2-{green,red}.png (at the real tile size) and tt7/before-after-*.png for the four former fallbacks.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const sharp = createRequire(resolve(repo, "web/package.json"))("sharp");
const TEAMS = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"];
const FORMER_FALLBACK = ["NYR", "NYI", "WSH", "DET"];
const TRACE = 768, OUT = 384, BLUR = 1.4, ALPHA_T = 0.2, COLOR_T = 0.3, MIN_STROKE = Math.round(TRACE * 0.06), STROKE = 3;
const GREEN = "#00ff99", RED = "#ff6b6b";
const gitEnv = { ...process.env };
delete gitEnv.GIT_DIR; delete gitEnv.GIT_WORK_TREE;

function sobel(plane, size, x, y) {
  const p = (dx, dy) => plane[(y + dy) * size + x + dx];
  const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
  const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
  return Math.hypot(gx, gy) / 4;
}

/** Zhang–Suen thinning in place (1 = foreground). */
function thin(img, size) {
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : img[y * size + x]);
  for (let changed = true; changed;) {
    changed = false;
    for (const step of [0, 1]) {
      const clear = [];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (!img[y * size + x]) continue;
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
        const b = p.reduce((a, v) => a + v, 0), t = p.reduce((a, v, i) => a + (v === 0 && p[(i + 1) % 8] === 1 ? 1 : 0), 0);
        if (b < 2 || b > 6 || t !== 1) continue;
        if (step === 0 ? p[0] * p[2] * p[4] === 0 && p[2] * p[4] * p[6] === 0 : p[0] * p[2] * p[6] === 0 && p[0] * p[4] * p[6] === 0) clear.push(y * size + x);
      }
      for (const i of clear) img[i] = 0;
      if (clear.length) changed = true;
    }
  }
}

/** Drop 8-connected components smaller than `min` pixels (short interior strokes: letters, speckle). */
function keepLong(img, size, min) {
  const seen = new Uint8Array(size * size);
  for (let i = 0; i < img.length; i++) {
    if (!img[i] || seen[i]) continue;
    const stack = [i], comp = [];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(), x = j % size, y = (j - x) / size;
      comp.push(j);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, k = yy * size + xx;
        if (xx >= 0 && yy >= 0 && xx < size && yy < size && img[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    if (comp.length < min) for (const j of comp) img[j] = 0;
  }
}

async function trace(png) {
  const { data } = await sharp(png).resize(TRACE, TRACE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(BLUR).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = TRACE * TRACE, alpha = new Float32Array(n), rgb = [0, 1, 2].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) { const a = data[i * 4 + 3] / 255; alpha[i] = a; for (let c = 0; c < 3; c++) rgb[c][i] = (data[i * 4 + c] / 255) * a; }
  const silhouette = new Uint8Array(n), interior = new Uint8Array(n);
  for (let y = 1; y < TRACE - 1; y++) for (let x = 1; x < TRACE - 1; x++) {
    const i = y * TRACE + x;
    if (sobel(alpha, TRACE, x, y) > ALPHA_T) silhouette[i] = 1;
    else if (alpha[i] > 0.9 && Math.max(...rgb.map(plane => sobel(plane, TRACE, x, y))) > COLOR_T) interior[i] = 1;
  }
  thin(silhouette, TRACE); thin(interior, TRACE);
  keepLong(interior, TRACE, MIN_STROKE);
  const lines = new Uint8Array(n);
  for (let i = 0; i < n; i++) lines[i] = silhouette[i] | interior[i];
  const stroked = new Uint8Array(n);
  for (let y = 0; y < TRACE; y++) for (let x = 0; x < TRACE; x++) if (lines[y * TRACE + x])
    for (let dy = -STROKE; dy <= STROKE; dy++) for (let dx = -STROKE; dx <= STROKE; dx++) {
      const yy = y + dy, xx = x + dx;
      if (dx * dx + dy * dy <= STROKE * STROKE + 1 && yy >= 0 && yy < TRACE && xx >= 0 && xx < TRACE) stroked[yy * TRACE + xx] = 255;
    }
  const rgba = Buffer.alloc(n * 4, 255);
  for (let i = 0; i < n; i++) rgba[i * 4 + 3] = stroked[i];
  const out = await sharp(rgba, { raw: { width: TRACE, height: TRACE, channels: 4 } }).resize(OUT, OUT).png().toBuffer();
  return { png: out, coverage: stroked.reduce((t, v) => t + (v ? 1 : 0), 0) / n };
}

/** The tile's neon treatment at a given size: tinted strokes and a light halo (matches the CSS drop-shadow). */
async function neon(outline, color, size) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const alpha = await sharp(outline).resize(size, size).extractChannel(3).toBuffer();
  const tinted = await sharp({ create: { width: size, height: size, channels: 3, background: { r, g, b } } }).joinChannel(alpha).png().toBuffer();
  const halo = await sharp(tinted).blur(1.6).ensureAlpha().linear([1, 1, 1, 0.55], [0, 0, 0, 0]).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: halo }, { input: tinted }]).png().toBuffer();
}
const label = (text, width, color = "#d8dde3", sizePx = 14) => Buffer.from(`<svg width="${width}" height="22"><text x="${width / 2}" y="16" text-anchor="middle" font-family="Helvetica" font-size="${sizePx}" font-weight="700" fill="${color}">${text}</text></svg>`);

async function sheet(outlines, originals, color, file, tile) {
  const cell = tile + 30, cols = 8, rows = 4, width = cols * cell, height = rows * (cell + 16) + 50;
  const layers = [{ input: Buffer.from(`<svg width="${width}" height="50"><text x="16" y="34" font-family="Helvetica" font-size="22" font-weight="700" fill="${color}">Tuesday neon outlines v2 at tile size (${tile} px) · ${color === GREEN ? "green, rise" : "red, fall"} · original top-left</text></svg>`), top: 0, left: 0 }];
  for (const [i, team] of TEAMS.entries()) {
    const left = (i % cols) * cell, top = 50 + Math.floor(i / cols) * (cell + 16);
    layers.push({ input: await sharp(originals[team]).resize(28, 28, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top: top + 2, left: left + 2 });
    layers.push({ input: await neon(outlines[team], color, tile), top: top + 12, left: left + 15 });
    layers.push({ input: label(team, cell), top: top + tile + 18, left });
  }
  await sharp({ create: { width, height, channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } }).composite(layers).png().toFile(file);
}

const outDir = resolve(repo, "web/public/teamLogos/outline");
mkdirSync(outDir, { recursive: true });
const before = Object.fromEntries(FORMER_FALLBACK.map(team => [team, readFileSync(resolve(outDir, `${team}.png`))]));
const outlines = {}, originals = {}, coverage = {};
for (const team of TEAMS) {
  originals[team] = execFileSync("git", ["show", `HEAD:web/public/teamLogos/${team}.png`], { cwd: repo, maxBuffer: 64 << 20, env: gitEnv });
  const { png, coverage: share } = await trace(originals[team]);
  outlines[team] = png;
  writeFileSync(resolve(outDir, `${team}.png`), png);
  coverage[team] = Number(share.toFixed(4));
}
const TILE = 120;
await sheet(outlines, originals, GREEN, resolve(here, "contact-sheet-v2-green.png"), TILE);
await sheet(outlines, originals, RED, resolve(here, "contact-sheet-v2-red.png"), TILE);
// Before/after for the four former fallbacks: original | v1 outline | v2 outline, at tile size, green.
const crop = 150, layers = [];
for (const [i, team] of FORMER_FALLBACK.entries()) {
  const top = i * (crop + 30);
  layers.push({ input: await sharp(originals[team]).resize(TILE, TILE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top: top + 15, left: 15 });
  layers.push({ input: await neon(before[team], GREEN, TILE), top: top + 15, left: crop + 15 });
  layers.push({ input: await neon(outlines[team], GREEN, TILE), top: top + 15, left: 2 * crop + 15 });
  layers.push({ input: label(`${team}: original · v1 trace (TT-5) · v2 trace (TT-7)`, 3 * crop), top: top + crop, left: 0 });
}
await sharp({ create: { width: 3 * crop, height: FORMER_FALLBACK.length * (crop + 30), channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } }).composite(layers).png().toFile(resolve(here, "before-after-former-fallbacks.png"));
writeFileSync(resolve(here, "outline-v2-params.json"), `${JSON.stringify({ trace: TRACE, out: OUT, blur: BLUR, alphaThreshold: ALPHA_T, colorThreshold: COLOR_T, minInteriorStrokePx: MIN_STROKE, strokeRadiusPx: STROKE, coverage }, null, 2)}\n`);
console.log(`traced ${TEAMS.length} logos (v2)`);

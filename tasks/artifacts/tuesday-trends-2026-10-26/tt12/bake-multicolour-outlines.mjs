// TT-12 offline bake: multi-colour neon outlines for NEON_MULTICOLOUR teams. Run:
// `node tasks/artifacts/tuesday-trends-2026-10-26/tt12/bake-multicolour-outlines.mjs`.
// Same trace as TT-7 v2 (silhouette always, interior edges only when strong and part of a long stroke), then each
// outline segment takes the colour of the logo region it borders: the original's opaque pixels are quantized to the
// logo's own palette (k-means on flat pixels), and each skeleton pixel takes, from the regions within a few pixels, the
// most colourful one (neutral borders give way to the team colour beside them; ties go to the smaller region). Every palette colour
// is lifted to the TT-11 contrast floor. Writes web/public/teamLogos/outline/color/X.png and tt12/palettes.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { here, neonLib, original, repo, sharp } from "./neon-lib.mjs";

const TRACE = 768, OUT = 384, BLUR = 1.4, ALPHA_T = 0.2, COLOR_T = 0.3, MIN_STROKE = Math.round(TRACE * 0.06), STROKE = 3, WINDOW = 6, MIN_VOTES = 4;

function sobel(plane, size, x, y) {
  const p = (dx, dy) => plane[(y + dy) * size + x + dx];
  const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
  const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
  return Math.hypot(gx, gy) / 4;
}
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
const raw = async (png, blur) => (await sharp(png).resize(TRACE, TRACE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(blur || undefined).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;

/** The v2 skeleton (silhouette + long interior strokes), before the stroke is applied. */
async function skeleton(png) {
  const data = await raw(png, BLUR), n = TRACE * TRACE, alpha = new Float32Array(n), rgb = [0, 1, 2].map(() => new Float32Array(n));
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
  return lines;
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
/**
 * Flat pixels: opaque and level with their 4 neighbours. Anti-aliased blends between two regions are not flat, so they
 * never form a palette colour of their own or vote for one.
 */
function flatMask(data) {
  const flat = new Uint8Array(TRACE * TRACE);
  for (let y = 1; y < TRACE - 1; y++) for (let x = 1; x < TRACE - 1; x++) {
    const i = y * TRACE + x;
    if (data[i * 4 + 3] <= 235) continue;
    flat[i] = [i - 1, i + 1, i - TRACE, i + TRACE].every(j => data[j * 4 + 3] > 235 && [0, 1, 2].every(c => Math.abs(data[j * 4 + c] - data[i * 4 + c]) < 20)) ? 1 : 0;
  }
  return flat;
}
/** k-means (farthest-point seeds) on flat pixels, close clusters merged, specks (< 2%) dropped. */
function palette(data, flat) {
  const px = [];
  for (let i = 0; i < flat.length; i++) if (flat[i]) px.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  const sample = px.filter((_, i) => i % 3 === 0);
  let centers = [sample[0]];
  while (centers.length < 6) centers.push(sample.reduce((best, p) => Math.min(...centers.map(c => dist2(c, p))) > Math.min(...centers.map(c => dist2(c, best))) ? p : best, sample[0]));
  for (let it = 0; it < 15; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of sample) { const k = centers.reduce((b, c, j) => dist2(c, p) < dist2(centers[b], p) ? j : b, 0); sums[k][0] += p[0]; sums[k][1] += p[1]; sums[k][2] += p[2]; sums[k][3]++; }
    centers = sums.map((s, j) => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[j]);
  }
  const merged = [];
  for (const c of centers) if (!merged.some(m => dist2(m, c) < 48 ** 2)) merged.push(c);
  const counts = merged.map(() => 0);
  for (const p of px) counts[merged.reduce((b, c, j) => dist2(c, p) < dist2(merged[b], p) ? j : b, 0)]++;
  return merged.map((c, j) => ({ rgb: c.map(Math.round), share: counts[j] / px.length })).filter(c => c.share >= 0.02);
}
const chroma = c => Math.max(...c) - Math.min(...c);
const toHex = c => `#${c.map(v => v.toString(16).padStart(2, "0")).join("")}`;

async function bake(team) {
  const png = original(team), lines = await skeleton(png), data = await raw(png, 0), flat = flatMask(data), pal = palette(data, flat), n = TRACE * TRACE;
  const neon = pal.map(c => neonLib.withNeonFloor(toHex(c.rgb))), neonRgb = neon.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  const index = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (flat[i]) { const p = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]; index[i] = pal.reduce((b, c, j) => dist2(c.rgb, p) < dist2(pal[b].rgb, p) ? j : b, 0); }
  const colorOf = new Int8Array(n).fill(-1), used = pal.map(() => 0);
  for (let i = 0; i < n; i++) if (lines[i]) {
    const x = i % TRACE, y = (i - x) / TRACE, votes = pal.map(() => 0);
    for (let dy = -WINDOW; dy <= WINDOW; dy++) for (let dx = -WINDOW; dx <= WINDOW; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < TRACE && yy < TRACE && index[yy * TRACE + xx] >= 0) votes[index[yy * TRACE + xx]]++;
    }
    const present = votes.map((v, j) => [v, j]).filter(([v]) => v >= MIN_VOTES);
    // The most colourful region wins (white/black/grey borders give way to the team colour beside them); among equally
    // neutral regions, the smaller one, so details keep their colour.
    const rank = j => [chroma(pal[j].rgb), -pal[j].share];
    const better = (b, c) => { const [x, y] = [rank(c[1]), rank(b[1])]; return x[0] > y[0] + 24 || (Math.abs(x[0] - y[0]) <= 24 && x[1] > y[1]) ? c : b; };
    const pick = present.length ? present.reduce(better)[1] : votes.reduce((b, v, j) => v > votes[b] ? j : b, 0);
    colorOf[i] = pick; used[pick]++;
  }
  const rgba = Buffer.alloc(n * 4, 0);
  for (let y = 0; y < TRACE; y++) for (let x = 0; x < TRACE; x++) {
    const k = colorOf[y * TRACE + x];
    if (k < 0) continue;
    for (let dy = -STROKE; dy <= STROKE; dy++) for (let dx = -STROKE; dx <= STROKE; dx++) {
      const yy = y + dy, xx = x + dx, o = (yy * TRACE + xx) * 4;
      if (dx * dx + dy * dy > STROKE * STROKE + 1 || yy < 0 || yy >= TRACE || xx < 0 || xx >= TRACE || rgba[o + 3]) continue;
      // Two-tone lines: a stroke pixel over a flat region takes that region's colour, so an edge between red and white
      // is red on the red side and white on the white side; off the logo or over a blend it takes the skeleton's pick.
      const own = index[yy * TRACE + xx], c = neonRgb[own >= 0 ? own : k];
      rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
    }
  }
  const out = await sharp(rgba, { raw: { width: TRACE, height: TRACE, channels: 4 } }).resize(OUT, OUT).png().toBuffer();
  const strokePx = used.reduce((a, b) => a + b, 0);
  // outlineShare: share of skeleton picks (the colour off the logo and on blends); flat pixels under the stroke keep their own.
  return { out, palette: pal.map((c, j) => ({ original: toHex(c.rgb), neon: neon[j], logoShare: Number(c.share.toFixed(3)), outlineShare: Number((used[j] / strokePx).toFixed(3)) })) };
}

const outDir = resolve(repo, "web/public/teamLogos/outline/color");
mkdirSync(outDir, { recursive: true });
const report = {};
for (const team of [...neonLib.NEON_MULTICOLOUR]) {
  const { out, palette: pal } = await bake(team);
  writeFileSync(resolve(outDir, `${team}.png`), out);
  report[team] = pal;
  console.log(team, pal.map(p => `${p.original}->${p.neon} logo ${p.logoShare} outline ${p.outlineShare}`).join(" | "));
}
writeFileSync(resolve(here, "palettes.json"), `${JSON.stringify({ trace: TRACE, out: OUT, window: WINDOW, minVotes: MIN_VOTES, teams: report }, null, 2)}\n`);

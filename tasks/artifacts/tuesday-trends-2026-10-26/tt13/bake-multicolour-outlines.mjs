// TT-13 offline bake (supersedes tt12/bake-multicolour-outlines.mjs): the TT-12 multi-colour bake for all 32 teams plus
// TJ's per-team parameters (PARAMS below). Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt13/bake-multicolour-outlines.mjs`.
// Same trace as TT-7 v2 (silhouette always, interior edges only when strong and part of a long stroke), then each
// outline segment takes the colour of the logo region it borders: the original's opaque pixels are quantized to the
// logo's own palette (k-means on flat pixels), and each skeleton pixel takes, from the regions within a few pixels, the
// most colourful one (neutral borders give way to the team colour beside them; ties go to the smaller region). Every palette colour
// is lifted to the TT-11 contrast floor (or a team's own, higher floor). Writes web/public/teamLogos/outline/color/X.png and
// tt13/palettes.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEAMS, neonLib, original, repo, sharp } from "../tt12/neon-lib.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * TT-12 add-on (TJ): palette colours swapped before the floor. DAL's neon-green field (secondaryColor #44D62C) reads
 * abrasive, so any logo colour near it becomes the jersey green (teamsInfo DAL.jersey #006847).
 */
const REMAP = { DAL: [{ near: [0x44, 0xd6, 0x2c], within: 90, to: "#006847" }] };
const TRACE = 768, OUT = 384, BLUR = 1.4, ALPHA_T = 0.2, COLOR_T = 0.3, MIN_STROKE = Math.round(TRACE * 0.06), STROKE = 3, WINDOW = 6, MIN_VOTES = 4;
/**
 * TT-13 per-team parameters (TJ's notes on the TT-12 sheet). Defaults are the TT-12 values above; floors still apply.
 * - stroke: line radius at 768 px (default 3). Thicker: CAR, CBJ, CGY, EDM, BUF; NYR slightly.
 * - floor: minimum contrast on the card (default 4.5:1). Brighter: BUF, COL, DAL.
 * - colorT / minStroke: interior-edge threshold and shortest kept interior stroke (share of 768). VGK keeps its forehead
 *   ridge and cheek details; WPG keeps its ring and jet edges; COL keeps the A's triangle cutout (TJ, after TT-13).
 * - minShare: smallest palette region kept (default 2%). SEA keeps its small red eye.
 * - only: every palette colour becomes one colour (`stroke` = the team's tuned single colour) except those near `keep`.
 *   SEA: the single team colour with its red highlight at the top of the S.
 * - pick: how a skeleton pixel chooses among the regions it borders. "chroma" (default, TT-12): the most colourful.
 *   "inner": the region nearer the logo's centre, so each ring or shape is outlined in its own colour (WPG: silver
 *   outline, blue outer circle, white circle, red leaf, grey jet). "interior": silhouette by chroma, interior edges in
 *   `interiorColor` (TOR: blue outer outline, white text).
 * - twoTone: false draws a whole line in its pick instead of splitting it by the region under each side.
 */
const PARAMS = {
  CAR: { stroke: 5.5 }, CBJ: { stroke: 5.5 }, CGY: { stroke: 5.5 }, EDM: { stroke: 5.5 }, NYR: { stroke: 4.25 },
  BUF: { stroke: 5, floor: 5.5 }, COL: { stroke: 4.5, floor: 8, colorT: 0.12, minStroke: 0.015 }, DAL: { stroke: 4, floor: 8 },
  VGK: { colorT: 0.12, minStroke: 0.015 },
  SEA: { minShare: 0.002, only: { keep: [[0xc8, 0x10, 0x2e]], within: 110, to: "stroke" } },
  TOR: { pick: "interior", interiorColor: "#ffffff", twoTone: false },
  // WPG: the silver|navy ring edge and the jet's edges over the leaf are softer than the default threshold, so they were
  // never traced; a lower threshold and shorter kept strokes bring them in.
  WPG: { pick: "inner", twoTone: false, colorT: 0.12, minStroke: 0.015 },
};

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
async function skeleton(png, { colorT = COLOR_T, minStroke = MIN_STROKE / TRACE } = {}) {
  const data = await raw(png, BLUR), n = TRACE * TRACE, alpha = new Float32Array(n), rgb = [0, 1, 2].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) { const a = data[i * 4 + 3] / 255; alpha[i] = a; for (let c = 0; c < 3; c++) rgb[c][i] = (data[i * 4 + c] / 255) * a; }
  const silhouette = new Uint8Array(n), interior = new Uint8Array(n);
  for (let y = 1; y < TRACE - 1; y++) for (let x = 1; x < TRACE - 1; x++) {
    const i = y * TRACE + x;
    if (sobel(alpha, TRACE, x, y) > ALPHA_T) silhouette[i] = 1;
    else if (alpha[i] > 0.9 && Math.max(...rgb.map(plane => sobel(plane, TRACE, x, y))) > colorT) interior[i] = 1;
  }
  thin(silhouette, TRACE); thin(interior, TRACE);
  keepLong(interior, TRACE, Math.round(TRACE * minStroke));
  const lines = new Uint8Array(n);
  for (let i = 0; i < n; i++) lines[i] = silhouette[i] | interior[i];
  return { lines, silhouette };
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
function palette(data, flat, minShare = 0.02) {
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
  return merged.map((c, j) => ({ rgb: c.map(Math.round), share: counts[j] / px.length })).filter(c => c.share >= minShare);
}
const chroma = c => Math.max(...c) - Math.min(...c);
const toHex = c => `#${c.map(v => v.toString(16).padStart(2, "0")).join("")}`;

async function bake(team) {
  const p = PARAMS[team] ?? {}, stroke = p.stroke ?? STROKE, floor = p.floor ?? neonLib.NEON_MIN_CONTRAST;
  const png = original(team), { lines, silhouette } = await skeleton(png, p), data = await raw(png, 0), flat = flatMask(data), pal = palette(data, flat, p.minShare), n = TRACE * TRACE;
  const single = neonLib.teamNeon(team).stroke;
  const swap = c => {
    if (p.only && !p.only.keep.some(k => dist2(k, c.rgb) < p.only.within ** 2)) return p.only.to === "stroke" ? single : p.only.to;
    return (REMAP[team] ?? []).find(r => dist2(r.near, c.rgb) < r.within ** 2)?.to ?? toHex(c.rgb);
  };
  const neon = pal.map(c => neonLib.withNeonFloor(swap(c), floor)), neonRgb = neon.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  const fixed = p.interiorColor ? [1, 3, 5].map(i => parseInt(neonLib.withNeonFloor(p.interiorColor, floor).slice(i, i + 2), 16)) : null;
  // Logo centre (opaque centroid) for the "inner" pick.
  let cx = 0, cy = 0, count = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] > 235) { cx += i % TRACE; cy += Math.floor(i / TRACE); count++; }
  cx /= count; cy /= count;
  const index = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (flat[i]) { const p = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]; index[i] = pal.reduce((b, c, j) => dist2(c.rgb, p) < dist2(pal[b].rgb, p) ? j : b, 0); }
  const colorOf = new Int8Array(n).fill(-1), used = pal.map(() => 0);
  for (let i = 0; i < n; i++) if (lines[i]) {
    const x = i % TRACE, y = (i - x) / TRACE, votes = pal.map(() => 0), radius = pal.map(() => 0);
    for (let dy = -WINDOW; dy <= WINDOW; dy++) for (let dx = -WINDOW; dx <= WINDOW; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < TRACE && yy < TRACE && index[yy * TRACE + xx] >= 0) { const k = index[yy * TRACE + xx]; votes[k]++; radius[k] += Math.hypot(xx - cx, yy - cy); }
    }
    const present = votes.map((v, j) => [v, j]).filter(([v]) => v >= MIN_VOTES);
    // The most colourful region wins (white/black/grey borders give way to the team colour beside them); among equally
    // neutral regions, the smaller one, so details keep their colour.
    const rank = j => [chroma(pal[j].rgb), -pal[j].share];
    const better = (b, c) => { const [x, y] = [rank(c[1]), rank(b[1])]; return x[0] > y[0] + 24 || (Math.abs(x[0] - y[0]) <= 24 && x[1] > y[1]) ? c : b; };
    const inner = (b, c) => radius[c[1]] / c[0] < radius[b[1]] / b[0] ? c : b;
    const pick = present.length ? present.reduce(p.pick === "inner" ? inner : better)[1] : votes.reduce((b, v, j) => v > votes[b] ? j : b, 0);
    // "interior": interior edges take the fixed colour (marked -2); the silhouette keeps its pick.
    colorOf[i] = p.pick === "interior" && !silhouette[i] ? -2 : pick;
    if (colorOf[i] >= 0) used[pick]++;
  }
  const rgba = Buffer.alloc(n * 4, 0);
  for (let y = 0; y < TRACE; y++) for (let x = 0; x < TRACE; x++) {
    const k = colorOf[y * TRACE + x];
    if (k === -1) continue;
    const reach = Math.ceil(stroke);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const yy = y + dy, xx = x + dx, o = (yy * TRACE + xx) * 4;
      if (dx * dx + dy * dy > stroke * stroke + 1 || yy < 0 || yy >= TRACE || xx < 0 || xx >= TRACE || rgba[o + 3]) continue;
      // Two-tone lines: a stroke pixel over a flat region takes that region's colour, so an edge between red and white
      // is red on the red side and white on the white side; off the logo or over a blend it takes the skeleton's pick.
      const own = index[yy * TRACE + xx], c = k === -2 ? fixed : neonRgb[p.twoTone !== false && own >= 0 ? own : k];
      rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
    }
  }
  const out = await sharp(rgba, { raw: { width: TRACE, height: TRACE, channels: 4 } }).resize(OUT, OUT).png().toBuffer();
  const strokePx = Math.max(1, used.reduce((a, b) => a + b, 0));
  // outlineShare: share of skeleton picks (the colour off the logo and on blends); flat pixels under the stroke keep their own.
  return { out, params: p, palette: pal.map((c, j) => ({ original: toHex(c.rgb), neon: neon[j], logoShare: Number(c.share.toFixed(3)), outlineShare: Number((used[j] / strokePx).toFixed(3)) })) };
}

const outDir = resolve(repo, "web/public/teamLogos/outline/color");
mkdirSync(outDir, { recursive: true });
const report = {};
// TT-12 add-on: every team is baked; teamNeon decides which ones the tiles use (NEON_MULTICOLOUR).
for (const team of TEAMS) {
  const { out, palette: pal, params } = await bake(team);
  writeFileSync(resolve(outDir, `${team}.png`), out);
  report[team] = { params, palette: pal };
  console.log(team, pal.map(p => `${p.original}->${p.neon} logo ${p.logoShare} outline ${p.outlineShare}`).join(" | "));
}
writeFileSync(resolve(here, "palettes.json"), `${JSON.stringify({ trace: TRACE, out: OUT, window: WINDOW, minVotes: MIN_VOTES, teams: report }, null, 2)}\n`);

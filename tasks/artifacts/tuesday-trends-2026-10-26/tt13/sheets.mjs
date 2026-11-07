// TT-13 evidence: (1) TT-12 vs TT-13 at the 120 px tile size on green and red frames, for the teams TJ changed;
// (2) close-ups (original · TT-12 · TT-13, 240 px) of VGK, WPG, TOR and SEA. TT-12 = the committed baked PNG at HEAD
// (git show; GIT_DIR stripped). TT-13 = the current bake, or the single tint for NEON_SINGLE_COLOUR teams. Halo and
// spread come from teamNeon (unchanged by TT-13). Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt13/sheets.mjs`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { frame, glow, label, neonLib, original, repo, sharp, tinted } from "../tt12/neon-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CHANGED = ["BUF", "CAR", "CBJ", "CGY", "COL", "DAL", "EDM", "NSH", "NYR", "SEA", "TOR", "VGK", "WPG"];
const TILE = 120, GREEN = "#00ff99", RED = "#ff6b6b";
const gitEnv = { ...process.env };
delete gitEnv.GIT_DIR; delete gitEnv.GIT_WORK_TREE;
const tt12Png = team => execFileSync("git", ["show", `HEAD:web/public/teamLogos/outline/color/${team}.png`], { cwd: repo, maxBuffer: 64 << 20, env: gitEnv });
const outline = team => readFileSync(resolve(repo, `web/public/teamLogos/outline/${team}.png`));
async function v12(team, size) { const n = neonLib.teamNeon(team); return glow(await sharp(tt12Png(team)).resize(size, size).png().toBuffer(), n.halo, n.spread, size); }
async function v13(team, size) {
  const n = neonLib.teamNeon(team);
  return glow(n.multicolour ? await sharp(readFileSync(resolve(repo, `web/public/teamLogos/outline/color/${team}.png`))).resize(size, size).png().toBuffer() : await tinted(outline(team), n.stroke, size), n.halo, n.spread, size);
}
const blank = (w, h) => ({ create: { width: w, height: h, channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } });

const slot = TILE + 16, cell = 5 * slot + 30, rowH = TILE + 54, cols = 2, width = cols * cell + 20, height = 64 + Math.ceil(CHANGED.length / cols) * rowH;
const layers = [{ input: Buffer.from(`<svg width="${width}" height="60"><text x="16" y="38" font-family="Helvetica" font-size="22" font-weight="700" fill="#d8dde3">Original · TT-12 (green, red) · TT-13 (green, red) · ${TILE} px · changed teams</text></svg>`), top: 0, left: 0 }];
for (const [i, team] of CHANGED.entries()) {
  const left = 10 + (i % cols) * cell, top = 64 + Math.floor(i / cols) * rowH, n = neonLib.teamNeon(team);
  layers.push({ input: frame("#3a4048", TILE), top, left }, { input: await sharp(original(team)).resize(TILE, TILE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top: top + 6, left: left + 6 });
  const arts = [await v12(team, TILE), await v13(team, TILE)];
  for (const [v, art] of arts.entries()) for (const [j, edge] of [GREEN, RED].entries()) {
    const x = left + slot + 10 + v * (2 * slot + 10) + j * slot;
    layers.push({ input: frame(edge, TILE), top, left: x }, { input: art, top: top + 6, left: x + 6 });
  }
  layers.push({ input: label(`${team} · TT-13 ${n.multicolour ? "multi-colour" : `single ${n.stroke}`} · halo ${n.halo} · ${n.spread}`, cell, "#d8dde3", 11), top: top + TILE + 18, left });
}
await sharp(blank(width, height)).composite(layers).png().toFile(resolve(here, "contact-sheet-tt12-vs-tt13.png"));

const BIG = 240, close = ["VGK", "WPG", "TOR", "SEA"], cw = 3 * (BIG + 20) + 20, ch = BIG + 50, parts = [];
for (const [i, team] of close.entries()) {
  const top = i * ch + 10;
  parts.push({ input: await sharp(original(team)).resize(BIG, BIG, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top, left: 20 });
  parts.push({ input: await v12(team, BIG), top, left: 40 + BIG }, { input: await v13(team, BIG), top, left: 60 + 2 * BIG });
  parts.push({ input: label(`${team}: original · TT-12 · TT-13`, cw, "#d8dde3", 13), top: top + BIG + 6, left: 0 });
}
await sharp(blank(cw, close.length * ch + 10)).composite(parts).png().toFile(resolve(here, "closeups-vgk-wpg-tor-sea.png"));
console.log("tt13 sheets written");

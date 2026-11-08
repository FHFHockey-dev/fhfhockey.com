// The shipped TT-13 neon logos for all 32 teams: original, then the final art on a green and a red tile frame, 120 px.
// Final = baked multi-colour (web/public/teamLogos/outline/color) or the single tint for NEON_SINGLE_COLOUR teams, with
// each team's halo and spread from teamNeon. Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt13/sheet-final-all32.mjs`.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TEAMS, frame, glow, label, neonLib, original, repo, sharp, tinted } from "../tt12/neon-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const TILE = 120, slot = TILE + 16, cell = 3 * slot + 20, rowH = TILE + 50, cols = 4;
const width = cols * cell + 20, height = 64 + Math.ceil(TEAMS.length / cols) * rowH;
const layers = [{ input: Buffer.from(`<svg width="${width}" height="60"><text x="16" y="38" font-family="Helvetica" font-size="22" font-weight="700" fill="#d8dde3">Tuesday neon logos, final (TT-13) · all 32 · original · green tile · red tile · ${TILE} px</text></svg>`), top: 0, left: 0 }];
for (const [i, team] of TEAMS.entries()) {
  const n = neonLib.teamNeon(team), left = 10 + (i % cols) * cell, top = 64 + Math.floor(i / cols) * rowH;
  const colored = n.multicolour ? await sharp(readFileSync(resolve(repo, `web/public/teamLogos/outline/color/${team}.png`))).resize(TILE, TILE).png().toBuffer()
    : await tinted(readFileSync(resolve(repo, `web/public/teamLogos/outline/${team}.png`)), n.stroke, TILE);
  const art = await glow(colored, n.halo, n.spread, TILE);
  layers.push({ input: frame("#3a4048", TILE), top, left }, { input: await sharp(original(team)).resize(TILE, TILE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top: top + 6, left: left + 6 });
  for (const [j, edge] of ["#00ff99", "#ff6b6b"].entries()) layers.push({ input: frame(edge, TILE), top, left: left + (j + 1) * slot }, { input: art, top: top + 6, left: left + (j + 1) * slot + 6 });
  layers.push({ input: label(`${team} · ${n.multicolour ? "multi-colour" : "single"} · ${n.spread}`, 3 * slot, "#d8dde3", 12), top: top + TILE + 16, left });
}
await sharp({ create: { width, height, channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } }).composite(layers).png().toFile(resolve(here, "final-all32.png"));
console.log("final-all32.png written");

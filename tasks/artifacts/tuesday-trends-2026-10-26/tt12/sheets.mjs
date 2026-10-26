// TT-12 evidence: (1) contact sheet original · TT-11 · TT-12, all 32 teams at the 120 px tile size on green and red frames;
// (2) close-ups of the multi-colour teams (original · TT-11 · TT-12 baked) at 240 px. TT-11 is rebuilt from
// tt11/colours.json (normal spread, single tint); TT-12 from teamNeon (overrides, spreads) and the baked PNGs.
// Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt12/sheets.mjs`. Offline.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEAMS, frame, glow, here, label, neonLib, original, repo, sharp, tinted } from "./neon-lib.mjs";

const TILE = 120, GREEN = "#00ff99", RED = "#ff6b6b";
const tt11 = JSON.parse(readFileSync(resolve(here, "../tt11/colours.json"), "utf8"));
const outline = team => readFileSync(resolve(repo, `web/public/teamLogos/outline/${team}.png`));
const baked = team => readFileSync(resolve(repo, `web/public/teamLogos/outline/color/${team}.png`));
const v11 = async (team, size) => glow(await tinted(outline(team), tt11[team].stroke, size), tt11[team].halo, "normal", size);
async function v12(team, size) {
  const n = neonLib.teamNeon(team);
  return glow(n.multicolour ? await sharp(baked(team)).resize(size, size).png().toBuffer() : await tinted(outline(team), n.stroke, size), n.halo, n.spread, size);
}
const blank = (w, h) => ({ create: { width: w, height: h, channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } });

// (1) Contact sheet (add-on): per team, the original, then TT-11 green/red, then TT-12 green/red.
const slot = TILE + 16, cell = 5 * slot + 30, rowH = TILE + 54, cols = 2, width = cols * cell + 20, height = 64 + Math.ceil(TEAMS.length / cols) * rowH;
const layers = [{ input: Buffer.from(`<svg width="${width}" height="60"><text x="16" y="38" font-family="Helvetica" font-size="22" font-weight="700" fill="#d8dde3">Original · TT-11 (green, red) · TT-12 (green, red) · ${TILE} px</text></svg>`), top: 0, left: 0 }];
for (const [i, team] of TEAMS.entries()) {
  const left = 10 + (i % cols) * cell, top = 64 + Math.floor(i / cols) * rowH, n = neonLib.teamNeon(team);
  layers.push({ input: frame("#3a4048", TILE), top, left }, { input: await sharp(original(team)).resize(TILE, TILE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top: top + 6, left: left + 6 });
  const arts = [await v11(team, TILE), await v12(team, TILE)];
  for (const [v, art] of arts.entries()) for (const [j, edge] of [GREEN, RED].entries()) {
    const x = left + slot + 10 + v * (2 * slot + 10) + j * slot;
    layers.push({ input: frame(edge, TILE), top, left: x }, { input: art, top: top + 6, left: x + 6 });
  }
  const what = `${team} · TT-12 ${n.multicolour ? "multi-colour" : `single ${n.stroke} (${n.strokeFrom})`} · halo ${n.halo} (${n.haloFrom}) · ${n.spread}`;
  layers.push({ input: label(what, cell, "#d8dde3", 11), top: top + TILE + 18, left });
}
await sharp(blank(width, height)).composite(layers).png().toFile(resolve(here, "contact-sheet-tt11-vs-tt12.png"));

// (2) Close-ups of the multi-colour teams.
// The nine busy logos TJ named first (TT-12 item 6); the add-on's other teams are on the contact sheet.
const BIG = 240, multi = ["NYR", "NYI", "CHI", "ANA", "FLA", "DET", "TOR", "WSH", "EDM"], cw = 3 * (BIG + 20) + 20, ch = BIG + 50;
const close = [];
for (const [i, team] of multi.entries()) {
  const top = i * ch + 10, n = neonLib.teamNeon(team);
  close.push({ input: await sharp(original(team)).resize(BIG, BIG, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), top, left: 20 });
  close.push({ input: await v11(team, BIG), top, left: 20 + BIG + 20 });
  close.push({ input: await v12(team, BIG), top, left: 20 + 2 * (BIG + 20) });
  close.push({ input: label(`${team}: original · TT-11 single colour · TT-12 baked multi-colour (halo ${n.halo}, ${n.spread})`, cw, "#d8dde3", 13), top: top + BIG + 6, left: 0 });
}
await sharp(blank(cw, multi.length * ch + 10)).composite(close).png().toFile(resolve(here, "closeups-multicolour.png"));
console.log("sheets written");

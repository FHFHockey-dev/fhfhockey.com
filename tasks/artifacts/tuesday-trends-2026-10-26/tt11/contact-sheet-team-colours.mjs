// TT-11 contact sheet: all 32 neon outlines in their team colours (teamNeon: floored lightColor stroke, floored
// secondaryColor halo) at the real tile size, each on a green (rise) and a red (fall) tile frame, plus colours.json.
// Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt11/contact-sheet-team-colours.mjs`. Offline: reads the committed
// outline PNGs in web/public/teamLogos/outline and lib/teamsInfo.ts (bundled with esbuild); no network.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const req = createRequire(resolve(repo, "web/package.json"));
const sharp = req("sharp"), esbuild = req("esbuild");
const bundle = await esbuild.build({ entryPoints: [resolve(repo, "web/lib/socialShare/teamNeon.ts")], bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent", absWorkingDir: resolve(repo, "web"), nodePaths: [resolve(repo, "web")] });
const mod = { exports: {} };
new Function("module", "exports", "require", bundle.outputFiles[0].text)(mod, mod.exports, req);
const { teamNeon, contrast, NEON_CARD } = mod.exports;
const TEAMS = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"];
const TILE = 120, GREEN = "#00ff99", RED = "#ff6b6b";
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

async function tint(alpha, color, size) {
  const [r, g, b] = rgb(color);
  return sharp({ create: { width: size, height: size, channels: 3, background: { r, g, b } } }).joinChannel(alpha).png().toBuffer();
}
/** Approximates the tile CSS: white 3px glow at 50%, dark 1px edge at 90%, team halo 2px at 55%, then the stroke. */
async function neon(team, colors, size) {
  const alpha = await sharp(readFileSync(resolve(repo, `web/public/teamLogos/outline/${team}.png`))).resize(size, size).extractChannel(3).toBuffer();
  const layer = async (color, blur, opacity) => sharp(await tint(alpha, color, size)).blur(blur).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await layer("#ffffff", 3, 0.5) }, { input: await layer("#000000", 1, 0.9) }, { input: await layer(colors.halo, 2, 0.55) }, { input: await tint(alpha, colors.stroke, size) }]).png().toBuffer();
}
const text = (s, w, color = "#d8dde3", px = 13) => Buffer.from(`<svg width="${w}" height="20"><text x="${w / 2}" y="15" text-anchor="middle" font-family="Helvetica" font-size="${px}" font-weight="700" fill="${color}">${s}</text></svg>`);
const frame = (color) => Buffer.from(`<svg width="${TILE + 12}" height="${TILE + 12}"><rect x="1.5" y="1.5" width="${TILE + 9}" height="${TILE + 9}" rx="8" fill="${NEON_CARD}" stroke="${color}" stroke-width="2.5"/></svg>`);

const cell = 2 * (TILE + 16) + 10, rowH = TILE + 52, cols = 4, width = cols * cell + 20, height = 60 + Math.ceil(TEAMS.length / cols) * rowH;
const layers = [{ input: Buffer.from(`<svg width="${width}" height="56"><text x="16" y="36" font-family="Helvetica" font-size="22" font-weight="700" fill="#d8dde3">Tuesday neon logos in team colours (TT-11) · ${TILE} px · green and red tile frames</text></svg>`), top: 0, left: 0 }];
const colours = {};
for (const [i, team] of TEAMS.entries()) {
  const colors = teamNeon(team), left = 10 + (i % cols) * cell, top = 60 + Math.floor(i / cols) * rowH;
  colours[team] = { ...colors, strokeContrast: Number(contrast(colors.stroke, NEON_CARD).toFixed(2)), haloContrast: Number(contrast(colors.halo, NEON_CARD).toFixed(2)) };
  const art = await neon(team, colors, TILE);
  for (const [j, edge] of [GREEN, RED].entries()) {
    layers.push({ input: frame(edge), top, left: left + j * (TILE + 16) });
    layers.push({ input: art, top: top + 6, left: left + j * (TILE + 16) + 6 });
  }
  layers.push({ input: text(`${team} · stroke ${colors.stroke} · halo ${colors.halo}`, cell, "#d8dde3", 12), top: top + TILE + 16, left });
}
await sharp({ create: { width, height, channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } }).composite(layers).png().toFile(resolve(here, "contact-sheet-team-colours.png"));
writeFileSync(resolve(here, "colours.json"), `${JSON.stringify(colours, null, 2)}\n`);
console.log(`sheet: ${TEAMS.length} teams`);

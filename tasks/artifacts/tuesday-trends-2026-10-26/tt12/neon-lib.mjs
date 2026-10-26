// TT-12 shared helpers for the offline bake and sheets: loads web/lib/socialShare/teamNeon.ts (esbuild bundle, no
// network), sharp, the committed originals (git show HEAD, GIT_DIR stripped), and the tile's neon rendering.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const here = dirname(fileURLToPath(import.meta.url));
export const repo = resolve(here, "../../../..");
const req = createRequire(resolve(repo, "web/package.json"));
export const sharp = req("sharp");
const bundle = await req("esbuild").build({ entryPoints: [resolve(repo, "web/lib/socialShare/teamNeon.ts")], bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent", absWorkingDir: resolve(repo, "web"), nodePaths: [resolve(repo, "web")] });
const mod = { exports: {} };
new Function("module", "exports", "require", bundle.outputFiles[0].text)(mod, mod.exports, req);
export const neonLib = mod.exports;
export const TEAMS = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"];
const gitEnv = { ...process.env };
delete gitEnv.GIT_DIR; delete gitEnv.GIT_WORK_TREE;
export const original = team => execFileSync("git", ["show", `HEAD:web/public/teamLogos/${team}.png`], { cwd: repo, maxBuffer: 64 << 20, env: gitEnv });
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const blank = size => ({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

/** Single-colour tint of a white outline PNG (the runtime canvas path). */
export async function tinted(outlinePng, color, size) {
  const [r, g, b] = rgb(color);
  const alpha = await sharp(outlinePng).resize(size, size).extractChannel(3).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: { r, g, b } } }).joinChannel(alpha).png().toBuffer();
}
/** The tile CSS at a spread: white glow, dark 1px edge, halo, then the coloured outline itself. */
export async function glow(colored, halo, spread, size) {
  const s = neonLib.NEON_SPREADS[spread], alpha = await sharp(colored).resize(size, size).extractChannel(3).toBuffer();
  const layer = async (color, blur, opacity) => {
    const [r, g, b] = rgb(color);
    const solid = await sharp({ create: { width: size, height: size, channels: 3, background: { r, g, b } } }).joinChannel(alpha).png().toBuffer();
    return sharp(solid).blur(Math.max(0.3, blur)).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]).png().toBuffer();
  };
  return sharp(blank(size)).composite([{ input: await layer("#ffffff", s.glowPx, s.glowAlpha) }, { input: await layer("#000000", 1, 0.9) }, { input: await layer(halo, s.haloPx, s.haloAlpha) }, { input: await sharp(colored).resize(size, size).png().toBuffer() }]).png().toBuffer();
}
export const label = (text, width, color = "#d8dde3", px = 12) => Buffer.from(`<svg width="${width}" height="20"><text x="${width / 2}" y="15" text-anchor="middle" font-family="Helvetica" font-size="${px}" font-weight="700" fill="${color}">${text}</text></svg>`);
export const frame = (color, tile) => Buffer.from(`<svg width="${tile + 12}" height="${tile + 12}"><rect x="1.5" y="1.5" width="${tile + 9}" height="${tile + 9}" rx="8" fill="${neonLib.NEON_CARD}" stroke="${color}" stroke-width="2.5"/></svg>`);

// TT-15 before/after: one tile per card (plus the mirrored right-column tile on 2-column cards) from the genuine-run-2
// (no series) and the fixture (with sparklines)
// 1080 PNG exports. Before = tt14 (centre stripe band, value columns), after = tt15 (no stripes, sparkline-led).
// Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt15/before-after-crops.mjs`. Offline.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { label, sharp } from "../tt12/neon-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Tile boxes in the 1080 export (left, top, width, height): first tile of each column.
const CARDS = {
  hot: [[75, 188, 454, 150], [551, 188, 454, 150]],
  deployment: [[75, 188, 454, 184], [551, 188, 454, 184]],
  movers: [[75, 188, 454, 150], [551, 188, 454, 150]],
  rates: [[36, 188, 322, 252]],
  // Genuine run-2 has no series (baselines); the fixture shows the sparklines.
  "hot-fixture": [[75, 188, 454, 150], [551, 188, 454, 150]],
  "deployment-fixture": [[75, 188, 454, 184], [551, 188, 454, 184]],
  "movers-fixture": [[75, 188, 454, 150], [551, 188, 454, 150]],
  "rates-fixture": [[36, 188, 322, 252], [724, 188, 322, 252]],
};
const gap = 16, layers = [];
let top = 10, width = 0;
for (const [card, boxes] of Object.entries(CARDS)) {
  const fixture = card.endsWith("-fixture"), kind = card.replace("-fixture", "");
  const [before, after] = (fixture ? ["tt14/fixture/TT14-OFFLINE-FIXTURE", "tt15/fixture/TT15-OFFLINE-FIXTURE"] : ["tt14/genuine-run2/TT14-GENUINE-DATA", "tt15/genuine-run2/TT15-GENUINE-DATA"]).map(prefix => resolve(here, `../${prefix}-png-${kind}.png`));
  let left = 10, rowH = 0;
  for (const [x, y, w, h] of boxes) for (const [file, tag] of [[before, "before"], [after, "after"]]) {
    layers.push({ input: await sharp(file).extract({ left: x, top: y, width: w, height: h }).png().toBuffer(), top: top + 22, left });
    layers.push({ input: label(`${card} · ${tag}`, w, "#d8dde3", 13), top, left });
    left += w + gap; rowH = Math.max(rowH, h + 22);
  }
  width = Math.max(width, left); top += rowH + gap;
}
await sharp({ create: { width: width + 10, height: top + 10, channels: 4, background: { r: 16, g: 19, b: 23, alpha: 1 } } }).composite(layers).png().toFile(resolve(here, "before-after-crops.png"));
console.log("before-after-crops.png written");

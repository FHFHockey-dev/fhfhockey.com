// TT-17: re-derive run-3's Hot/Cold series with the fixed solver (lib/socialShare/trends.ts gameSeries), offline, from
// what run-3 captured: each shown skater's S1 rows (genuine/run-3/series-diagnosis.json: season games played and the
// season points total) plus the latest row's last-5 / last-10 points (the layer's recent and preceding P/GP × 5). No
// new read. Deployment and Rates keep run-3's series: their missing early games are not pinned by any sum the read
// holds. Run: `node tasks/artifacts/tuesday-trends-2026-10-26/tt17/rederive-run3.mjs`. Writes genuine/run-3/layer-tt17.json.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, "../../../.."), run3 = resolve(here, "../genuine/run-3");
const req = createRequire(resolve(repo, "web/package.json"));
const bundle = await req("esbuild").build({ entryPoints: [resolve(repo, "web/lib/socialShare/trends.ts")], bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent", absWorkingDir: resolve(repo, "web"), nodePaths: [resolve(repo, "web")] });
const mod = { exports: {} };
new Function("module", "exports", "require", bundle.outputFiles[0].text)(mod, mod.exports, req);
const { gameSeries } = mod.exports;
const capture = JSON.parse(readFileSync(resolve(run3, "layer.json"), "utf8")), diagnosis = JSON.parse(readFileSync(resolve(run3, "series-diagnosis.json"), "utf8"));
const byId = new Map(diagnosis.hot.map(entry => [entry.nhlId, entry])), changes = [];
const fix = row => {
  const entry = byId.get(row.nhlId);
  if (!entry?.latest || !row.series) return row;
  const sgp = entry.latest.sgp, last5 = Math.round(row.recent * 5), last10 = Math.round((row.recent + row.preceding) * 5);
  const rows = entry.rows.filter(item => item.points !== null).map(item => ({ season_games_played: item.sgp, points_avg_season: item.points / item.sgp }));
  const series = gameSeries(rows, sgp, item => Math.round(item.points_avg_season * item.season_games_played), [{ from: sgp - 4, to: sgp, total: last5 }, { from: sgp - 9, to: sgp, total: last10 }], value => Number.isInteger(value) && value >= 0, true);
  // The same consistency checks as the layer: last 5 and last 10 must match the row's own windows when complete.
  const sum = list => list.every(value => value !== null) ? list.reduce((a, b) => a + b, 0) : null;
  if ((sum(series.slice(-5)) ?? last5) !== last5 || (sum(series) ?? last10) !== last10) throw new Error(`${row.name}: re-derived series fails the window check`);
  changes.push({ name: row.name, before: row.series, after: series });
  return { ...row, series };
};
const hot = capture.layer.sections.hot;
const layer = { ...capture.layer, sections: { ...capture.layer.sections, hot: { ...hot, hot: hot.hot.map(fix), cold: hot.cold.map(fix) } } };
writeFileSync(resolve(run3, "layer-tt17.json"), `${JSON.stringify({ ...capture, rederived: "TT-17: Hot/Cold series re-derived offline from run-3's captured rows and windows with the fixed solver (tt17/rederive-run3.mjs); no new read", layer }, null, 2)}\n`);
writeFileSync(resolve(here, "rederive-changes.json"), `${JSON.stringify(changes, null, 2)}\n`);
for (const change of changes) console.log(change.name.padEnd(20), JSON.stringify(change.before), "→", JSON.stringify(change.after));

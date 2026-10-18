import { readFileSync, writeFileSync } from "node:fs";
import calcWeekScore, { calculateSlateCrowding } from "../../../../web/components/GameGrid/utils/calcWeekScore.ts";

const data = JSON.parse(readFileSync(new URL("./schedule-2025-03-17_04-07.json", import.meta.url)));
const { dates, gamesPerDate, teams, schedule } = data;
const weekStarts = ["2025-03-17", "2025-03-24", "2025-03-31"];
const SLOTS = 12, ROSTERS = 4000;

let seed = 20261018;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const rosterSets = Object.fromEntries([14, 16, 18].map((r) => [r, Array.from({ length: ROSTERS }, () =>
  Array.from({ length: r }, () => teams[Math.floor(rand() * teams.length)]))]));

const masks = [];
for (let m = 0; m < 128; m++) { const n = [...Array(7).keys()].filter((i) => m >> i & 1).length; if (n >= 4) masks.push(m); }

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function rankAvg(values) { // average ranks for ties
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = Array(values.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
function spearman(a, b) { const ra = rankAvg(a), rb = rankAvg(b), ma = mean(ra), mb = mean(rb);
  let n = 0, da = 0, db = 0; ra.forEach((x, i) => { n += (x - ma) * (rb[i] - mb); da += (x - ma) ** 2; db += (rb[i] - mb) ** 2; });
  return da && db ? n / Math.sqrt(da * db) : 0; }
/** Expected mean utility of the top-k under uniform random tie-breaking. */
function expectedTopK(scores, util, k) {
  const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]); let taken = 0, total = 0;
  for (let i = 0; i < order.length && taken < k;) { let j = i; while (j + 1 < order.length && scores[order[j + 1]] === scores[order[i]]) j++;
    const group = order.slice(i, j + 1), use = Math.min(k - taken, group.length);
    total += use * mean(group.map((t) => util[t])); taken += use; i = j + 1; }
  return total / k;
}
const key = (x) => Math.round(x * 1e9) / 1e9;

const results = {}; let guaranteeViolations = 0, scenarios = 0, top1Changed = 0;
for (const R of [14, 16, 18]) results[R] = { regretV1: [], regretV2: [], top1V1: [], top1V2: [], top5V1: [], top5V2: [], rhoV1: [], rhoV2: [] };
for (const week of weekStarts) {
  const w0 = dates.indexOf(week), weekDates = dates.slice(w0, w0 + 7), weekCounts = gamesPerDate.slice(w0, w0 + 7);
  for (const mask of masks) {
    scenarios++;
    const inc = weekDates.map((d, i) => [d, weekCounts[i]]).filter((_, i) => mask >> i & 1);
    const leagueGames = inc.reduce((s, [, n]) => s + n, 0);
    const rows = teams.map((t) => {
      const played = inc.filter(([d]) => schedule[t][d]);
      const gp = played.length, on = played.filter(([, n]) => n <= 8).length, slates = played.map(([, n]) => n);
      const v2 = calcWeekScore([], on, leagueGames, gp, slates, true);
      const c = calculateSlateCrowding(slates, gp, true).adjustment;
      return { t, gp, on, v1: key(v2 - c), v2: key(v2), played };
    });
    for (let a = 0; a < rows.length; a++) for (let b = 0; b < rows.length; b++) {
      const A = rows[a], B = rows[b];
      if ((A.gp !== B.gp || A.on !== B.on) && A.v1 > B.v1 && !(A.v2 > B.v2)) guaranteeViolations++;
    }
    const top = (field) => { const m = Math.max(...rows.map((r) => r[field])); return rows.filter((r) => r[field] === m).map((r) => r.t).sort().join(); };
    if (top("v1") !== top("v2")) top1Changed++;
    for (const R of [14, 16, 18]) {
      const util = rows.map(({ played }) => mean(rosterSets[R].map((roster) =>
        played.reduce((s, [d]) => s + (roster.filter((t) => schedule[t][d]).length < SLOTS ? 1 : 0), 0))));
      const best = Math.max(...util), res = results[R];
      const v1 = rows.map((r) => r.v1), v2 = rows.map((r) => r.v2);
      res.top1V1.push(expectedTopK(v1, util, 1)); res.top1V2.push(expectedTopK(v2, util, 1));
      res.regretV1.push(best - expectedTopK(v1, util, 1)); res.regretV2.push(best - expectedTopK(v2, util, 1));
      res.top5V1.push(expectedTopK(v1, util, 5)); res.top5V2.push(expectedTopK(v2, util, 5));
      res.rhoV1.push(spearman(v1, util)); res.rhoV2.push(spearman(v2, util));
    }
  }
}
const summary = { scenarios, top1SetChanged: top1Changed, guaranteeViolations, slots: SLOTS, rosters: ROSTERS, byRosterSize: {} };
for (const [R, r] of Object.entries(results)) {
  const better = r.regretV2.filter((x, i) => x < r.regretV1[i] - 1e-12).length, worse = r.regretV2.filter((x, i) => x > r.regretV1[i] + 1e-12).length;
  summary.byRosterSize[R] = Object.fromEntries(Object.entries({
    meanTop1RegretV1: mean(r.regretV1), meanTop1RegretV2: mean(r.regretV2),
    meanTop1UtilityV1: mean(r.top1V1), meanTop1UtilityV2: mean(r.top1V2),
    meanTop5UtilityV1: mean(r.top5V1), meanTop5UtilityV2: mean(r.top5V2),
    meanSpearmanV1: mean(r.rhoV1), meanSpearmanV2: mean(r.rhoV2),
    scenariosTop1Better: better, scenariosTop1Worse: worse,
  }).map(([k, v]) => [k, typeof v === "number" && !Number.isInteger(v) ? Number(v.toFixed(4)) : v]));
}
const pass = guaranteeViolations === 0 && Object.values(summary.byRosterSize).every((s) =>
  s.meanTop1RegretV2 <= s.meanTop1RegretV1 && s.meanTop5UtilityV2 >= s.meanTop5UtilityV1);
summary.preregisteredCriterion = pass ? "met" : "not met";
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

/** Scratch: apply opportunity.ts to the saved 2026-10-28 snapshot. Read-only; writes only to argv[4].
 * Usage (from web/): npx vite-node <this> <snapshot.json> <dev-history.jsonl> <out.json> */
import { readFileSync, writeFileSync } from "node:fs";
import { outcomes } from "/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/productionReference";
import { compareOpportunity, pooledCohort, summarizeOpportunityHistory, type OpportunityGame } from "/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/opportunity";

const [snapPath, devPath, outPath] = process.argv.slice(2);
const snap = JSON.parse(readFileSync(snapPath, "utf8"));
const rows = new Map<number, any>();
for (const line of readFileSync(devPath, "utf8").split("\n")) if (line) { const r = JSON.parse(line); rows.set(r.id, r); }
const pos = (c: string | null) => (c === "D" ? "D" : ["F", "C", "L", "R", "LW", "RW"].includes(c ?? "") ? "F" : null);
const toGame = (r: any): OpportunityGame => ({
  seconds: r.games_played === 1 ? r.toi_per_game : null, ppSeconds: r.pp_toi_per_game, goals: r.goals, assists: r.assists, ppPoints: r.pp_points,
  tracks: r.games_played === 1 ? outcomes(r).map(m => m.value) : [null, null, null],
});
const cohorts = { F: pooledCohort([...rows.values()].filter(r => pos(r.position_code) === "F" && r.games_played === 1).map(toGame)),
  D: pooledCohort([...rows.values()].filter(r => pos(r.position_code) === "D" && r.games_played === 1).map(toGame)) };

const out: any[] = [];
for (const p of snap.profiles) {
  const ids: number[] = p.evidence.reference.sourceIds ?? [];
  const games = ids.map(id => rows.get(id)).filter(Boolean).map(toGame);
  const opp = Object.fromEntries((p.context?.opportunity ?? []).map((o: any) => [o.metric, o]));
  const n = p.evidence.window.games, ppPer = opp.PP_TOI_per_game?.current;
  const cohort = p.position === "F" || p.position === "D" ? cohorts[p.position as "F" | "D"] : null;
  const h = summarizeOpportunityHistory(games, { cohort });
  const r = compareOpportunity(h, { games: n, seconds: p.evidence.window.seconds ?? null, ppSeconds: typeof ppPer === "number" ? ppPer * n : null, observed: ["fantasy_points", "goals_plus_assists", "wigo_game_score"].map(k => p.tracks.find((t: any) => t.track === k)?.observed ?? null) });
  out.push({
    playerId: p.playerId, name: p.displayName, position: p.position, list: p.score.list, rank: p.score.rank, status: p.score.status,
    missingRefRows: ids.length - games.length, refGames: games.length,
    toiDelta: opp.total_TOI_per_game?.delta ?? null, ppDelta: opp.PP_TOI_per_game?.delta ?? null,
    tracks: r.tracks.map(t => ({ a: t.perGame.direction, aReason: t.perGame.reason, b: t.adjusted.direction, bReason: t.adjusted.reason, za: t.perGame.z, zb: t.adjusted.z,
      dir: t.assessment.direction, reason: t.assessment.reason, qualified: t.assessment.qualified, conflict: t.assessment.conflict, shift: t.assessment.opportunityShift })),
    headlineText: r.headline.text, toiText: r.changes.toi.text, ppText: r.changes.pp.text,
  });
}
writeFileSync(outPath, JSON.stringify({ cohorts, profiles: out }, null, 1));
console.log("profiles", out.length, "cohorts", JSON.stringify(cohorts));

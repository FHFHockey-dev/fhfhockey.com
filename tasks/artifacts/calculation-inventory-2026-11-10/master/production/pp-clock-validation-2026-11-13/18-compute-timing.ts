// Decision 152 Part B (F11): compute cost of the on-demand numerator per game
// (buildTeamPpClock for both teams + clock spans ∩ stored shift rows), from
// stored scratch pages; no network. Build like 14, then:
//   node timing.mjs <after-d152/team-game-results.csv> <pbp_dir> <shift_dir>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { buildTeamPpClock } from "../../../../../../web/utils/getPowerPlayBlocks";
import { buildPenaltyClock } from "../../../../../../web/lib/projections/penaltyClock";
const [resultsPath, pbpDir, shiftDir] = process.argv.slice(2);
const csv = (t: string) => { const l = t.split("\n").filter(Boolean); const h = l[0].split(","); return l.slice(1).map((x) => { const c = x.split(","); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ""])); }); };
const pages = (d: string) => readdirSync(d).filter((f) => f.endsWith(".csv")).sort().flatMap((f) => csv(readFileSync(join(d, f), "utf8")));
const tgs = csv(readFileSync(resultsPath, "utf8")).filter((r: any) => r.season_id === "20262027" && r.game_type === "2" && r.is_home === "true");
const want = new Set(tgs.map((r: any) => +r.game_id));
const plays = new Map<number, any[]>();
for (const r of pages(pbpDir) as any[]) { const g = +r.game_id; if (!want.has(g)) continue; const d: any = {}; if (r.event_owner_team_id) d.eventOwnerTeamId = +r.event_owner_team_id; if (r.penalty_type_code) d.typeCode = r.penalty_type_code; if (r.penalty_desc_key) d.descKey = r.penalty_desc_key; if (r.penalty_duration_minutes) d.duration = +r.penalty_duration_minutes; if (r.committed_by_player_id) d.committedByPlayerId = +r.committed_by_player_id; if (r.served_by_player_id) d.servedByPlayerId = +r.served_by_player_id;
  const list = plays.get(g) ?? []; list.push({ eventId: +r.event_id, sortOrder: r.sort_order === "" ? null : +r.sort_order, periodDescriptor: { number: +r.period_number, periodType: r.period_type || null }, timeInPeriod: r.time_in_period || null, timeRemaining: r.time_remaining || null, situationCode: r.situation_code || null, typeDescKey: r.type_desc_key || null, details: d }); plays.set(g, list); }
// Shifts as stored rows: [player, team, period, start, end].
const shifts = new Map<number, number[][]>();
for (const r of pages(shiftDir) as any[]) { const g = +r.game_id; if (!want.has(g) || r.start_seconds === "") continue; const l = shifts.get(g) ?? []; l.push([+r.player_id, +r.team_id, +r.period, +r.start_seconds, +r.end_seconds]); shifts.set(g, l); }
const times: number[] = [];
let checksum = 0;
for (let pass = 0; pass < 3; pass++) for (const tg of tgs as any[]) {
  const g = +tg.game_id, home = +tg.team_id, away = +tg.opp_id;
  const t0 = performance.now();
  // Qualification (clock + audit) for both teams, then interval ∩ shifts per player with sorted interval sweeps.
  for (const team of [home, away]) buildTeamPpClock({ gameId: g, teamId: team, homeTeamId: home, awayTeamId: away, gameType: 2, plays: plays.get(g)!, official: null });
  const spans = buildPenaltyClock(plays.get(g)!, { homeTeamId: home, awayTeamId: away, gameType: 2 }).spans;
  const perPlayer = new Map<number, number>();
  for (const [player, team, period, start, end] of shifts.get(g) ?? []) {
    const a = (period - 1) * 1200 + start, b = (period - 1) * 1200 + end;
    for (const s of spans) if (s.teamId === team) { const o = Math.min(b, s.end) - Math.max(a, s.start); if (o > 0) perPlayer.set(player, (perPlayer.get(player) ?? 0) + o); }
  }
  const t1 = performance.now();
  if (pass === 2) times.push(t1 - t0);
  checksum += perPlayer.size;
}
times.sort((a, b) => a - b);
const q = (p: number) => times[Math.floor(p * (times.length - 1))].toFixed(2);
console.log(JSON.stringify({ games: times.length, msPerGameBothTeams: { p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1) }, totalMsAllGames: times.reduce((a, b) => a + b, 0).toFixed(0), checksum }));

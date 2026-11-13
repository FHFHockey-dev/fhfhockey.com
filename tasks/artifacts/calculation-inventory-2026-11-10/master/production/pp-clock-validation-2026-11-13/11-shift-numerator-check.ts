// Decision 144 (F11): sanity-check the share numerator's inputs. For every
// clock PP second in the given games, count each team's players on the ice
// from stored shift rows (goalies included). With complete shifts the
// advantaged team should have more players on the ice than the short-handed
// team in almost every PP second; line-change overlap and second-resolution
// stamps explain the rest. Per-player PP seconds = shifts ∩ clock spans, so
// player <= clock holds by construction; this checks coverage, not identity.
// Build like 05-compare-clock.ts, then:
//   node shiftcheck.mjs <classes.csv> <pbp_dir> <shift_dir> <out_dir>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildPenaltyClock } from "../../../../../../web/lib/projections/penaltyClock";

const [classesPath, pbpDir, shiftDir, outDir] = process.argv.slice(2);
const csv = (text: string) => {
  const lines = text.split("\n").filter(Boolean);
  const h = lines[0].split(",");
  return lines.slice(1).map((l) => { const c = l.split(","); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ""])); });
};
const files = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".csv")).map((f) => join(dir, f));

const games = new Map<number, { home: number; away: number; type: number }>();
for (const r of csv(readFileSync(classesPath, "utf8"))) {
  if (r.is_home === "t") games.set(Number(r.game_id), { home: Number(r.team_id), away: Number(r.opp_id), type: Number(r.game_type) });
}
const shifts = new Map<number, { team: number; start: number; end: number }[]>();
for (const f of files(shiftDir)) for (const r of csv(readFileSync(f, "utf8"))) {
  if (r.start_seconds === "" || r.end_seconds === "") continue;
  const g = Number(r.game_id);
  const base = (Number(r.period) - 1) * 1200;
  const list = shifts.get(g) ?? [];
  list.push({ team: Number(r.team_id), start: base + Number(r.start_seconds), end: base + Number(r.end_seconds) });
  shifts.set(g, list);
}
const plays = new Map<number, any[]>();
for (const f of files(pbpDir)) for (const r of csv(readFileSync(f, "utf8"))) {
  const g = Number(r.game_id);
  if (!shifts.has(g)) continue;
  const details: Record<string, unknown> = {};
  if (r.event_owner_team_id !== "") details.eventOwnerTeamId = Number(r.event_owner_team_id);
  if (r.penalty_type_code !== "") details.typeCode = r.penalty_type_code;
  if (r.penalty_desc_key !== "") details.descKey = r.penalty_desc_key;
  if (r.penalty_duration_minutes !== "") details.duration = Number(r.penalty_duration_minutes);
  if (r.committed_by_player_id !== "") details.committedByPlayerId = Number(r.committed_by_player_id);
  if (r.served_by_player_id !== "") details.servedByPlayerId = Number(r.served_by_player_id);
  const list = plays.get(g) ?? [];
  list.push({ eventId: Number(r.event_id), sortOrder: r.sort_order === "" ? null : Number(r.sort_order),
    periodDescriptor: { number: Number(r.period_number), periodType: r.period_type || null },
    timeInPeriod: r.time_in_period || null, timeRemaining: r.time_remaining || null,
    situationCode: r.situation_code || null, typeDescKey: r.type_desc_key || null, details });
  plays.set(g, list);
}

let ppSeconds = 0, advantaged = 0, equal = 0, reversed = 0, ppTeamPlayerSeconds = 0;
const pairs: Record<string, number> = {};
const perGame: { game_id: number; pp_seconds: number; advantaged_share: number }[] = [];
for (const [g, list] of shifts) {
  const meta = games.get(g);
  const p = plays.get(g);
  if (!meta || !p) continue;
  let spans;
  try { spans = buildPenaltyClock(p, { homeTeamId: meta.home, awayTeamId: meta.away, gameType: meta.type }).spans; }
  catch { continue; }
  let gp = 0, ga = 0;
  for (const sp of spans) {
    const opp = sp.teamId === meta.home ? meta.away : meta.home;
    for (let s = sp.start; s < sp.end; s++) {
      let nT = 0, nO = 0;
      for (const sh of list) if (sh.start <= s && s < sh.end) { if (sh.team === sp.teamId) nT++; else if (sh.team === opp) nO++; }
      ppSeconds++; gp++; ppTeamPlayerSeconds += nT;
      if (nT > nO) { advantaged++; ga++; } else if (nT === nO) equal++; else reversed++;
      pairs[`${nT}v${nO}`] = (pairs[`${nT}v${nO}`] ?? 0) + 1;
    }
  }
  perGame.push({ game_id: g, pp_seconds: gp, advantaged_share: gp ? ga / gp : 1 });
}
const topPairs = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 10);
const out = {
  games: perGame.length, ppSeconds,
  advantagedShare: advantaged / ppSeconds, equalShare: equal / ppSeconds, reversedShare: reversed / ppSeconds,
  meanPpTeamPlayersOnIce: ppTeamPlayerSeconds / ppSeconds,
  gamesBelow95: perGame.filter((x) => x.advantaged_share < 0.95).length,
  gamesBelow90: perGame.filter((x) => x.advantaged_share < 0.9).length,
  worstGames: perGame.sort((a, b) => a.advantaged_share - b.advantaged_share).slice(0, 5),
  topOnIcePairs: topPairs,
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "shift-numerator-check.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));

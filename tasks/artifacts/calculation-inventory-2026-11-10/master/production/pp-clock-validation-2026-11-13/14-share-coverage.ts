// Decision 151 O1 (F11): for 2026-27 regular-season team-games, separate the
// clock check (buildTeamPpClock qualified, from results/after-c1-c2) from
// whether PP share could actually display: player shifts ∩ the qualified
// team PP intervals present, and no player or unit time above the clock.
// Never caps. Two numerators are checked:
//  - recomputed: stored NHL shift rows (nhl_api_shift_rows) intersected with
//    the clock's spans for that team. Shift rows carry no position, so a
//    player with any single shift of 300 s or more is taken as a goalie;
//    numerator presence uses the route's rule (skater seconds >= 3 x clock,
//    update-power-play-combinations MIN_SKATERS_PER_PP_SECOND);
//  - stored: powerPlayCombinations (PPTOI, unit average, pp_share_of_team),
//    which the rolling writer reads today.
// Stored evidence only (scratch pages from 04, 10 and 12); no network calls.
// Build like 05-compare-clock.ts, then:
//   node share.mjs <after-c1-c2/team-game-results.csv> <pbp_dir> <shift_dir> <ppcombos_dir> <normalization.csv> <out_dir>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildPenaltyClock } from "../../../../../../web/lib/projections/penaltyClock";

const [resultsPath, pbpDir, shiftDir, comboDir, normPath, outDir] = process.argv.slice(2);
const csv = (text: string) => {
  const lines = text.split("\n").filter(Boolean);
  const h = lines[0].split(",");
  return lines.slice(1).map((l) => { const c = l.split(","); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ""])); });
};
const pages = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".csv")).sort().flatMap((f) => csv(readFileSync(join(dir, f), "utf8")));

// psql CSV quoting only matters for the reason column, which is not used here.
const teamGames = csv(readFileSync(resultsPath, "utf8"))
  .filter((r) => r.season_id === "20262027" && r.game_type === "2");
const wanted = new Set(teamGames.map((r) => Number(r.game_id)));
const normComplete = new Set(csv(readFileSync(normPath, "utf8")).filter((r) => r.status === "complete").map((r) => Number(r.game_id)));

const plays = new Map<number, any[]>();
for (const r of pages(pbpDir)) {
  const g = Number(r.game_id);
  if (!wanted.has(g)) continue;
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
// Per game: player -> team and that player's on-ice seconds (half-open, like 11).
const GOALIE_SHIFT_SECONDS = 300;
const shifts = new Map<number, Map<number, { team: number; seconds: Set<number>; longestShift: number }>>();
for (const r of pages(shiftDir)) {
  const g = Number(r.game_id);
  if (!wanted.has(g) || r.start_seconds === "" || r.end_seconds === "") continue;
  const base = (Number(r.period) - 1) * 1200;
  const byPlayer = shifts.get(g) ?? new Map();
  const p = byPlayer.get(Number(r.player_id)) ?? { team: Number(r.team_id), seconds: new Set<number>(), longestShift: 0 };
  p.longestShift = Math.max(p.longestShift, Number(r.end_seconds) - Number(r.start_seconds));
  for (let s = base + Number(r.start_seconds); s < base + Number(r.end_seconds); s++) p.seconds.add(s);
  byPlayer.set(Number(r.player_id), p);
  shifts.set(g, byPlayer);
}
const combos = new Map<number, { player: number; unit: number; pptoi: number; unitAvg: number; share: number | null }[]>();
for (const r of pages(comboDir)) {
  const g = Number(r.game_id);
  const list = combos.get(g) ?? [];
  list.push({ player: Number(r.player_id), unit: Number(r.unit), pptoi: Number(r.pptoi),
    unitAvg: Number(r.pptoi) - Number(r.pp_unit_relative_toi), share: r.pp_share_of_team === "" ? null : Number(r.pp_share_of_team) });
  combos.set(g, list);
}

type Out = Record<string, string | number | boolean | null>;
const out: Out[] = [];
for (const tg of teamGames) {
  const g = Number(tg.game_id), team = Number(tg.team_id);
  const qualified = tg.qualified === "true";
  const clock = tg.sim_s === "" ? null : Number(tg.sim_s);
  const row: Out = { game_id: g, team_id: team, clock_qualified: qualified, clock_s: clock, official_class: tg.official_class };
  if (!qualified || clock == null) { out.push({ ...row, state: "clock_withheld" }); continue; }
  if (clock === 0) { out.push({ ...row, state: "not_applicable" }); continue; }
  const homeTeamId = tg.is_home === "true" ? team : Number(tg.opp_id);
  const awayTeamId = tg.is_home === "true" ? Number(tg.opp_id) : team;
  const ppSeconds = new Set<number>();
  for (const sp of buildPenaltyClock(plays.get(g)!, { homeTeamId, awayTeamId, gameType: 2 }).spans) {
    if (sp.teamId === team) for (let s = sp.start; s < sp.end; s++) ppSeconds.add(s);
  }
  if (ppSeconds.size !== clock) throw new Error(`span seconds ${ppSeconds.size} != clock ${clock} for ${g}/${team}`);
  const roster = [...(shifts.get(g) ?? new Map()).entries()].filter(([, p]) => p.team === team);
  const recomputed = new Map<number, number>();
  for (const [player, p] of roster) {
    let n = 0;
    for (const s of ppSeconds) if (p.seconds.has(s)) n++;
    if (n > 0) recomputed.set(player, n);
  }
  const values = [...recomputed.values()];
  const goalies = new Set(roster.filter(([, p]) => p.longestShift >= GOALIE_SHIFT_SECONDS).map(([player]) => player));
  const skaterSeconds = [...recomputed.entries()].filter(([player]) => !goalies.has(player)).reduce((a, [, n]) => a + n, 0);
  const maxPlayer = values.length ? Math.max(...values) : 0;
  // Unit time: seconds when every member of a stored unit is on the ice together.
  const stored = (combos.get(g) ?? []).filter((c) => roster.some(([player]) => player === c.player));
  const unitShared: number[] = [];
  for (const unit of new Set(stored.map((c) => c.unit))) {
    const members = stored.filter((c) => c.unit === unit).map((c) => (shifts.get(g)!.get(c.player)!).seconds);
    let n = 0;
    for (const s of ppSeconds) if (members.every((m) => m.has(s))) n++;
    unitShared.push(n);
  }
  const denominators = stored.filter((c) => c.share && c.share > 0).map((c) => c.pptoi / c.share!);
  const storedDiffs = stored.map((c) => c.pptoi - (recomputed.get(c.player) ?? 0));
  const missingFromStored = [...recomputed.entries()]
    .filter(([player]) => !goalies.has(player) && !stored.some((c) => c.player === player));
  const recomputedOk = normComplete.has(g) && roster.length > 0 && skaterSeconds >= 3 * clock && maxPlayer <= clock &&
    unitShared.every((n) => n <= clock);
  const storedAboveClock = stored.some((c) => c.pptoi > clock || c.unitAvg > clock || (c.share ?? 0) > 1);
  const denominatorMatches = denominators.length > 0 && denominators.every((d) => Math.abs(d - clock) <= 1);
  out.push({
    ...row,
    state: recomputedOk ? "share_displayable" : "numerator_withheld",
    normalization_complete: normComplete.has(g),
    shift_players: roster.length,
    pp_players: recomputed.size,
    goalies: goalies.size,
    max_player_pp_s: maxPlayer,
    skater_seconds_per_clock_second: Number((skaterSeconds / clock).toFixed(3)),
    max_unit_shared_s: unitShared.length ? Math.max(...unitShared) : null,
    stored_rows: stored.length,
    stored_max_pptoi: stored.length ? Math.max(...stored.map((c) => c.pptoi)) : null,
    stored_above_clock: storedAboveClock,
    stored_denominator_min: denominators.length ? Number(Math.min(...denominators).toFixed(1)) : null,
    stored_denominator_max: denominators.length ? Number(Math.max(...denominators).toFixed(1)) : null,
    stored_denominator_matches_clock: denominatorMatches,
    stored_max_abs_diff_vs_recomputed: storedDiffs.length ? Math.max(...storedDiffs.map(Math.abs)) : null,
    recomputed_players_missing_from_stored: missingFromStored.length,
    stored_consistent: recomputedOk && stored.length > 0 && !storedAboveClock && denominatorMatches &&
      storedDiffs.every((d) => Math.abs(d) <= 2) && missingFromStored.length === 0,
  });
}

mkdirSync(outDir, { recursive: true });
const cols = [...new Set(out.flatMap((r) => Object.keys(r)))];
writeFileSync(join(outDir, "share-coverage-2026-27-regular.csv"),
  [cols.join(","), ...out.map((r) => cols.map((c) => r[c] ?? "").join(","))].join("\n") + "\n");
const count = (f: (r: Out) => boolean) => out.filter(f).length;
const displayable = out.filter((r) => r.state === "share_displayable");
const summary = {
  teamGames: out.length,
  clockQualified: count((r) => r.clock_qualified === true),
  clockWithheld: count((r) => r.state === "clock_withheld"),
  notApplicableVerifiedZero: count((r) => r.state === "not_applicable"),
  clockQualifiedWithPpTime: count((r) => r.clock_qualified === true && (r.clock_s as number) > 0),
  shareDisplayableRecomputed: displayable.length,
  numeratorWithheld: count((r) => r.state === "numerator_withheld"),
  anyPlayerAboveClock: count((r) => (r.max_player_pp_s as number) > (r.clock_s as number)),
  anyUnitAboveClock: count((r) => r.max_unit_shared_s != null && (r.max_unit_shared_s as number) > (r.clock_s as number)),
  minSkaterSecondsPerClockSecond: Math.min(...displayable.map((r) => r.skater_seconds_per_clock_second as number)),
  goaliesPerTeamGame: Object.fromEntries([...new Set(displayable.map((r) => r.goalies))].map((n) => [n, displayable.filter((r) => r.goalies === n).length])),
  stored: {
    rowsPresent: count((r) => (r.stored_rows as number) > 0),
    anyAboveClock: count((r) => r.stored_above_clock === true),
    denominatorMatchesClock: count((r) => r.stored_denominator_matches_clock === true),
    pptoiWithin2sOfRecomputed: count((r) => r.stored_max_abs_diff_vs_recomputed != null && (r.stored_max_abs_diff_vs_recomputed as number) <= 2),
    skatersMissing: count((r) => (r.recomputed_players_missing_from_stored as number) > 0),
    consistentWithQualifiedClock: count((r) => r.stored_consistent === true),
  },
};
writeFileSync(join(outDir, "share-coverage-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));

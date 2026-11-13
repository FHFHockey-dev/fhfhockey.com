// Decision 152 Part B (F11): per-player PP numerator, computed from stored
// shift rows ∩ the qualified team PP intervals (v2 clock), against the stored
// powerPlayCombinations rows, for 2026-27 regular-season team-games that pass
// the clock check with PP time. Every stored row is also matched against the
// two older writer clocks to show which version wrote it:
//  - pre1101: utils/getPowerPlayBlocks.ts at d793446f9^ (production until 11-01);
//  - master: utils/getPowerPlayBlocks.ts at master (d793446f9, production since 11-01).
// A row "matches" a version when its PPTOI is within 2 s of the player's shifts
// ∩ that version's PP seconds and its implied denominator (PPTOI / share) is
// within 1 s of that version's writer total (sum of block lengths, as the
// writer adds them). Stored evidence only; no network calls. Build with:
//   git show d793446f9^:web/utils/getPowerPlayBlocks.ts > $S/versions/pre1101/getPowerPlayBlocks.ts
//   git show master:web/utils/getPowerPlayBlocks.ts > $S/versions/master/getPowerPlayBlocks.ts
//   esbuild 16-numerator-compare.ts --bundle --platform=node --format=esm --tsconfig=web/tsconfig.json --loader:.scss=empty \
//     --alias:pp-blocks-pre1101=$S/versions/pre1101/getPowerPlayBlocks.ts --alias:pp-blocks-master=$S/versions/master/getPowerPlayBlocks.ts --outfile=$S/numerator.mjs
//   node $S/numerator.mjs <after-d152/team-game-results.csv> <pbp_dir> <shift_dir> <ppcombos_dir> <created_dir> <out_dir>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildPenaltyClock } from "../../../../../../web/lib/projections/penaltyClock";
// @ts-expect-error resolved by the esbuild alias above
import pre1101Blocks from "pp-blocks-pre1101";
// @ts-expect-error resolved by the esbuild alias above
import masterBlocks from "pp-blocks-master";

const [resultsPath, pbpDir, shiftDir, comboDir, createdDir, outDir] = process.argv.slice(2);
const csv = (text: string) => {
  const lines = text.split("\n").filter(Boolean);
  const h = lines[0].split(",");
  return lines.slice(1).map((l) => { const c = l.split(","); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ""])); });
};
const pages = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".csv")).sort().flatMap((f) => csv(readFileSync(join(dir, f), "utf8")));

const teamGames = csv(readFileSync(resultsPath, "utf8"))
  .filter((r) => r.season_id === "20262027" && r.game_type === "2" && r.qualified === "true" && Number(r.sim_s) > 0);
const wanted = new Set(teamGames.map((r) => Number(r.game_id)));

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
const created = new Map<string, string>();
for (const r of pages(createdDir)) created.set(`${r.game_id}/${r.player_id}`, r.created_at);
const combos = new Map<number, { player: number; unit: number; pptoi: number; share: number | null }[]>();
for (const r of pages(comboDir)) {
  const g = Number(r.game_id);
  if (!wanted.has(g)) continue;
  const list = combos.get(g) ?? [];
  list.push({ player: Number(r.player_id), unit: Number(r.unit), pptoi: Number(r.pptoi),
    share: r.pp_share_of_team === "" ? null : Number(r.pp_share_of_team) });
  combos.set(g, list);
}

// Old Block shape: { teamId, start: { period, timeInPeriod }, end: { ... } }.
const clock = (t: string) => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
function blockVersion(blocks: any[], team: number) {
  const seconds = new Set<number>();
  let writerTotal = 0;
  for (const b of blocks.filter((x) => x.teamId === team)) {
    const start = (b.start.period - 1) * 1200 + clock(b.start.timeInPeriod);
    const end = (b.end.period - 1) * 1200 + clock(b.end.timeInPeriod);
    // The writer's own sum (update-power-play-combinations/[gameId].ts).
    const s0 = clock(b.start.timeInPeriod), e0 = clock(b.end.timeInPeriod);
    writerTotal += Math.max(b.start.period === b.end.period ? e0 - s0 : 1200 - s0 + e0, 0);
    for (let s = start; s < end; s++) seconds.add(s);
  }
  return { seconds, writerTotal };
}

type Out = Record<string, string | number | boolean | null>;
const rows: Out[] = [];
const teamOut: Out[] = [];
for (const tg of teamGames) {
  const g = Number(tg.game_id), team = Number(tg.team_id);
  const homeTeamId = tg.is_home === "true" ? team : Number(tg.opp_id);
  const awayTeamId = tg.is_home === "true" ? Number(tg.opp_id) : team;
  const gamePlays = plays.get(g)!;
  const v2Seconds = new Set<number>();
  for (const sp of buildPenaltyClock(gamePlays, { homeTeamId, awayTeamId, gameType: 2 }).spans) {
    if (sp.teamId === team) for (let s = sp.start; s < sp.end; s++) v2Seconds.add(s);
  }
  const clockS = Number(tg.sim_s);
  const versions: Record<string, { seconds: Set<number>; writerTotal: number } | null> = {
    v2: { seconds: v2Seconds, writerTotal: v2Seconds.size },
    master: null,
    pre1101: null
  };
  for (const [name, fn] of [["master", masterBlocks], ["pre1101", pre1101Blocks]] as const) {
    try { versions[name] = blockVersion(fn(gamePlays), team); } catch { versions[name] = null; }
  }
  const roster = [...(shifts.get(g) ?? new Map()).entries()].filter(([, p]) => p.team === team);
  const goalies = new Set(roster.filter(([, p]) => p.longestShift >= GOALIE_SHIFT_SECONDS).map(([player]) => player));
  const onIce = (player: number, set: Set<number>) => {
    const p = shifts.get(g)?.get(player);
    if (!p) return null;
    let n = 0;
    for (const s of set) if (p.seconds.has(s)) n++;
    return n;
  };
  const computed = roster.filter(([player]) => !goalies.has(player))
    .map(([player]) => ({ player, seconds: onIce(player, v2Seconds)! }))
    .filter((c) => c.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  // Units as the writer forms them (LinemateMatrix sortByPPTOI): PP1 is the top
  // player plus the 4 with the most shared PP time with them; PP2 the same among
  // the rest; everyone else is unit 3. Shared time is shifts ∩ shifts ∩ PP.
  const shared = (a: number, b: number) => {
    const sa = shifts.get(g)!.get(a)!.seconds, sb = shifts.get(g)!.get(b)!.seconds;
    let n = 0;
    for (const s of v2Seconds) if (sa.has(s) && sb.has(s)) n++;
    return n;
  };
  const pick = (pool: number[]) => {
    if (pool.length === 0) return new Set<number>();
    const pivot = pool[0];
    return new Set([...pool].sort((a, b) => shared(pivot, b) - shared(pivot, a)).slice(0, 5));
  };
  const ranked = computed.map((c) => c.player);
  const pp1 = pick(ranked);
  const pp2 = pick(ranked.filter((p) => !pp1.has(p)));
  const computedUnit = new Map(ranked.map((p) => [p, pp1.has(p) ? 1 : pp2.has(p) ? 2 : 3]));
  const stored = (combos.get(g) ?? []).filter((c) => roster.some(([player]) => player === c.player));
  const players = new Set([...computed.map((c) => c.player), ...stored.map((c) => c.player)]);
  const versionCounts: Record<string, number> = { v2: 0, master: 0, pre1101: 0, none: 0 };
  let agree = 0;
  for (const player of players) {
    const c = computed.find((x) => x.player === player);
    const s = stored.find((x) => x.player === player);
    const computedSeconds = c?.seconds ?? onIce(player, v2Seconds) ?? 0;
    const row: Out = {
      game_id: g, team_id: team, player_id: player, clock_s: clockS,
      computed_pptoi: computedSeconds,
      computed_share: Number((computedSeconds / clockS).toFixed(6)),
      computed_unit: computedUnit.get(player) ?? null,
      stored_pptoi: s?.pptoi ?? null,
      stored_share: s?.share ?? null,
      stored_unit: s?.unit ?? null,
      stored_implied_denominator: s && s.share ? Number((s.pptoi / s.share).toFixed(1)) : null,
      created_at: created.get(`${g}/${player}`) ?? null,
    };
    const matches: string[] = [];
    if (s) {
      for (const [name, v] of Object.entries(versions)) {
        if (!v) continue;
        const playerSeconds = onIce(player, v.seconds) ?? 0;
        const denominatorOk = s.share ? Math.abs(s.pptoi / s.share - v.writerTotal) <= 1 : false;
        if (Math.abs(s.pptoi - playerSeconds) <= 2 && denominatorOk) matches.push(name);
      }
    }
    row.matches = s ? (matches.join("+") || "none") : "not_stored";
    row.agree_within_2s = s != null && c != null && Math.abs(s.pptoi - c.seconds) <= 2 &&
      s.share != null && Math.abs(s.share - c.seconds / clockS) <= 0.005;
    if (row.agree_within_2s) agree++;
    if (s) versionCounts[matches.includes("v2") ? "v2" : matches.includes("master") ? "master" : matches.includes("pre1101") ? "pre1101" : "none"]++;
    rows.push(row);
  }
  // A tie: two players within 2 s around a PP-time rank boundary (5/6 or 10/11).
  const near = (i: number) => computed[i] && computed[i + 1] && computed[i].seconds - computed[i + 1].seconds <= 2;
  teamOut.push({
    game_id: g, team_id: team, clock_s: clockS,
    unit_boundary_tied: Boolean(near(4) || near(9)),
    unit_mismatches: [...players].filter((player) => {
      const s = stored.find((x) => x.player === player);
      return s != null && s.unit !== computedUnit.get(player);
    }).length,
    master_writer_total: versions.master?.writerTotal ?? null,
    pre1101_writer_total: versions.pre1101?.writerTotal ?? null,
    computed_players: computed.length, stored_players: stored.length, players_agreeing: agree,
    team_game_agrees: agree === players.size && computed.length === stored.length,
    rows_v2: versionCounts.v2, rows_master_only: versionCounts.master, rows_pre1101_only: versionCounts.pre1101, rows_none: versionCounts.none,
    created_dates: [...new Set(stored.map((s) => (created.get(`${g}/${s.player}`) ?? "").slice(0, 10)))].sort().join(" "),
  });
}

mkdirSync(outDir, { recursive: true });
const write = (name: string, list: Out[]) => {
  const cols = [...new Set(list.flatMap((r) => Object.keys(r)))];
  writeFileSync(join(outDir, name), [cols.join(","), ...list.map((r) => cols.map((c) => r[c] ?? "").join(","))].join("\n") + "\n");
};
write("numerator-team-games.csv", teamOut);
const disagreeing = teamOut.filter((t) => !t.team_game_agrees);
const disagreeingKeys = new Set(disagreeing.map((t) => `${t.game_id}/${t.team_id}`));
write("numerator-rows-disagreeing-team-games.csv", rows.filter((r) => disagreeingKeys.has(`${r.game_id}/${r.team_id}`)));
write("numerator-rows-all.csv", rows);
const count = (list: Out[], f: (r: Out) => boolean) => list.filter(f).length;
const storedRows = rows.filter((r) => r.stored_pptoi != null);
const summary = {
  teamGames: teamOut.length,
  teamGamesAgreeing: teamOut.length - disagreeing.length,
  teamGamesDisagreeing: disagreeing.length,
  disagreeingGames: new Set(disagreeing.map((t) => t.game_id)).size,
  players: rows.length,
  playersAgreeingWithin2sAndShare0005: count(rows, (r) => r.agree_within_2s === true),
  storedRows: storedRows.length,
  computedPlayersNotStored: count(rows, (r) => r.stored_pptoi == null && (r.computed_pptoi as number) > 0),
  storedRowsWithNoComputedTime: count(storedRows, (r) => r.computed_pptoi === 0),
  unitAgreement: count(rows, (r) => r.stored_unit != null && r.stored_unit === r.computed_unit),
  unitMismatchesByTeamGame: {
    agreeingTeamGamesWithTiedBoundary: teamOut.filter((t) => t.team_game_agrees && t.unit_boundary_tied)
      .reduce((a, t) => a + (t.unit_mismatches as number), 0),
    agreeingTeamGamesWithoutTie: teamOut.filter((t) => t.team_game_agrees && !t.unit_boundary_tied)
      .reduce((a, t) => a + (t.unit_mismatches as number), 0),
    disagreeingTeamGames: disagreeing.reduce((a, t) => a + (t.unit_mismatches as number), 0),
  },
  storedRowsByWriterVersion: {
    v2: count(storedRows, (r) => String(r.matches).includes("v2")),
    masterNotV2: count(storedRows, (r) => !String(r.matches).includes("v2") && String(r.matches).includes("master")),
    pre1101Only: count(storedRows, (r) => r.matches === "pre1101"),
    none: count(storedRows, (r) => r.matches === "none"),
  },
  allTeamGamesV2EqualsMaster: count(teamOut, (t) => t.master_writer_total === t.clock_s),
};
writeFileSync(join(outDir, "numerator-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));

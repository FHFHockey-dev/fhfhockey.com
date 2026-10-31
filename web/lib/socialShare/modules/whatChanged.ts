import { currentSeason } from "lib/socialShare/schedule";
import { defineShareModule, type SharePostLoadResult, type SharePostSource } from "./contract";
import { competitionRanks, editionDate, lastN, per60, previousN, versusSeason } from "./shared/definitions";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";

/** What Changed (SS 2.0): recent production, opportunity and underlying metrics against season to date or the previous matched window. */
export type WhatChangedWindow = "l5" | "l10";
export type WhatChangedMetricId = "goals" | "assists" | "points" | "shots" | "ppPoints" | "toi" | "ppToi" | "ixg" | "iscf" | "icf" | "xgfPct";
export type WhatChangedSettings = { window: WhatChangedWindow; comparison: "std" | "previous"; minGp: number; minCoverage: number; metric: WhatChangedMetricId; basis: "perGame" | "per60"; player: string };

export const NST_COUNT_COLUMNS = ["player_id", "date_scraped", "season", "ixg", "iscfs", "icf"] as const;
export const NST_ON_ICE_COLUMNS = ["player_id", "date_scraped", "season", "xgf", "xga"] as const;
export type NstCountRow = { player_id: number; date_scraped: string; season: number; ixg: number | null; iscfs: number | null; icf: number | null };
export type NstOnIceRow = { player_id: number; date_scraped: string; season: number; xgf: number | null; xga: number | null };

/** NST has no game id, so it joins on player and date. Two games or two rows on one date cannot be told apart: unresolved, never guessed. */
type NstJoin<Row> = { state: "found"; row: Row } | { state: "missing" } | { state: "unresolved" };
type ChangeGame = SkaterAppearance & { nst: NstJoin<NstCountRow>; onIce: NstJoin<NstOnIceRow> };

type MetricKind = "count" | "time" | "share";
type MetricSource = "wgo" | "nst";
type MetricDefinition = {
  id: WhatChangedMetricId; label: string; short: string; group: "Production" | "Opportunity" | "Underlying"; kind: MetricKind; source: MetricSource; strength: string;
  /** The count, seconds, or xGF/xGA pair from one game; null is missing, never zero. */
  read: (game: ChangeGame) => number | null | { for: number; against: number };
  /** Denominator for a per-60 value, in seconds. TOI metrics and xGF% have no per-60 basis. */
  per60Seconds?: (game: ChangeGame) => number | null;
  join?: (game: ChangeGame) => NstJoin<unknown>;
};
const found = <Row, Value>(join: NstJoin<Row>, read: (row: Row) => Value | null) => join.state === "found" ? read(join.row) : null;
const allToi = (game: ChangeGame) => game.toiSeconds;
export const WHAT_CHANGED_METRICS: readonly MetricDefinition[] = [
  { id: "goals", label: "Goals", short: "Goals", group: "Production", kind: "count", source: "wgo", strength: "All situations", read: game => game.goals, per60Seconds: allToi },
  { id: "assists", label: "Assists", short: "Assists", group: "Production", kind: "count", source: "wgo", strength: "All situations", read: game => game.assists, per60Seconds: allToi },
  { id: "points", label: "Points", short: "Points", group: "Production", kind: "count", source: "wgo", strength: "All situations", read: game => game.points, per60Seconds: allToi },
  { id: "shots", label: "Shots on goal", short: "Shots", group: "Production", kind: "count", source: "wgo", strength: "All situations", read: game => game.shots, per60Seconds: allToi },
  { id: "ppPoints", label: "PP points", short: "PP Pts", group: "Production", kind: "count", source: "wgo", strength: "Power play", read: game => game.ppPoints, per60Seconds: game => game.ppToiSeconds },
  { id: "toi", label: "TOI", short: "TOI", group: "Opportunity", kind: "time", source: "wgo", strength: "All situations", read: game => game.toiSeconds },
  { id: "ppToi", label: "PP TOI", short: "PP TOI", group: "Opportunity", kind: "time", source: "wgo", strength: "Power play", read: game => game.ppToiSeconds },
  { id: "ixg", label: "Individual xG (ixG)", short: "ixG", group: "Underlying", kind: "count", source: "nst", strength: "All situations (NST)", read: game => found(game.nst, row => row.ixg), per60Seconds: allToi, join: game => game.nst },
  { id: "iscf", label: "Individual scoring chances (iSCF)", short: "iSCF", group: "Underlying", kind: "count", source: "nst", strength: "All situations (NST)", read: game => found(game.nst, row => row.iscfs), per60Seconds: allToi, join: game => game.nst },
  { id: "icf", label: "Individual shot attempts (iCF)", short: "iCF", group: "Underlying", kind: "count", source: "nst", strength: "All situations (NST)", read: game => found(game.nst, row => row.icf), per60Seconds: allToi, join: game => game.nst },
  { id: "xgfPct", label: "On-ice xGF%", short: "xGF%", group: "Underlying", kind: "share", source: "nst", strength: "All situations, on ice (NST)", read: game => found(game.onIce, row => row.xgf === null || row.xga === null ? null : { for: row.xgf, against: row.xga }), join: game => game.onIce },
];
const metricOf = (id: WhatChangedMetricId) => WHAT_CHANGED_METRICS.find(metric => metric.id === id)!;
export const usesOnIce = (id: WhatChangedMetricId) => id === "xgfPct";
export const usesNstCounts = (id: WhatChangedMetricId) => metricOf(id).source === "nst" && !usesOnIce(id);

export const windowSize = (window: WhatChangedWindow) => window === "l5" ? 5 : 10;
export const windowLabel = (window: WhatChangedWindow) => window === "l5" ? "L5" : "L10";
export const seasonFloor = (season: number) => `${String(season).slice(0, 4)}-07-01`;
/** Through yesterday in New York: today's games may not be final. */
export function shareThrough(generatedAt: string) {
  const through = new Date(Date.parse(`${editionDate(generatedAt)}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return { through, season: currentSeason(through), from: seasonFloor(currentSeason(through)) };
}
const rounded = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/** m:ss from seconds. */
export function formatSeconds(seconds: number | null, signed = false) {
  if (seconds === null) return "—";
  const whole = Math.abs(Math.round(seconds));
  return `${signed ? (seconds > 0 ? "+" : seconds < 0 ? "−" : "") : ""}${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export type MetricCoverage = { observed: number; expected: number; missing: number; unresolved: number };
export type MetricWindow = { value: number | null; coverage: MetricCoverage; admitted: boolean };
export type MetricChange = { metric: WhatChangedMetricId; label: string; short: string; group: MetricDefinition["group"]; kind: MetricKind; unit: string; strength: string; recent: MetricWindow; baseline: MetricWindow; delta: number | null };
/** Integers only, so 89% can never round up to 90%. */
export const coverageAdmits = (observed: number, expected: number, minCoveragePct: number) => expected > 0 && observed * 100 >= minCoveragePct * expected;

/** NST values need the post's minimum coverage; WGO windows must be complete (CONTRACT §2, Coverage admission). */
function metricWindow(metric: MetricDefinition, basis: WhatChangedSettings["basis"], games: readonly ChangeGame[], minCoverage: number): MetricWindow {
  let observed = 0, unresolved = 0, sum = 0, against = 0, seconds = 0;
  const perSixty = basis === "per60" && !!metric.per60Seconds;
  for (const game of games) {
    if (metric.join?.(game).state === "unresolved") unresolved++;
    const value = metric.read(game), denominator = perSixty ? metric.per60Seconds!(game) : 0;
    if (value === null || denominator === null) continue;
    observed++;
    if (typeof value === "number") { sum += value; seconds += denominator; }
    else { sum += value.for; against += value.against; }
  }
  const coverage = { observed, expected: games.length, missing: games.length - observed, unresolved };
  const admitted = coverageAdmits(observed, games.length, metric.source === "wgo" ? 100 : minCoverage);
  if (!admitted) return { value: null, coverage, admitted };
  if (metric.kind === "share") return { value: sum + against > 0 ? rounded(sum * 100 / (sum + against), 1) : null, coverage, admitted };
  if (metric.kind === "time") return { value: Math.round(sum / observed), coverage, admitted };
  const value = perSixty ? per60(sum, seconds) : sum / observed;
  return { value: value === null ? null : rounded(value, 2), coverage, admitted };
}
const shortOf = (metric: MetricDefinition, basis: WhatChangedSettings["basis"]) => metric.kind === "count" ? `${metric.short}/${basis === "per60" ? "60" : "G"}` : metric.short;
const unitOf = (metric: MetricDefinition, basis: WhatChangedSettings["basis"]) => metric.kind === "share" ? "pooled" : metric.kind === "time" ? "m:ss per game" : basis === "per60" ? metric.id === "ppPoints" ? "per 60 PP min" : "per 60" : "per game";
function metricChange(metric: MetricDefinition, basis: WhatChangedSettings["basis"], recentGames: readonly ChangeGame[], baselineGames: readonly ChangeGame[], minCoverage: number): MetricChange {
  const recent = metricWindow(metric, basis, recentGames, minCoverage), baseline = metricWindow(metric, basis, baselineGames, minCoverage);
  const digits = metric.kind === "time" ? 0 : metric.kind === "share" ? 1 : 2;
  return { metric: metric.id, label: metric.label, short: shortOf(metric, basis), group: metric.group, kind: metric.kind, unit: unitOf(metric, basis), strength: metric.strength, recent, baseline, delta: recent.value === null || baseline.value === null ? null : rounded(recent.value - baseline.value, digits) };
}
export function formatMetricValue(change: Pick<MetricChange, "kind">, value: number | null, signed = false) {
  if (value === null) return "—";
  if (change.kind === "time") return formatSeconds(value, signed);
  const sign = signed ? value > 0 ? "+" : value < 0 ? "−" : "" : "";
  return `${sign}${Math.abs(value).toFixed(change.kind === "share" ? 1 : 2)}`;
}

/** The team moved from and to, read from game teams only. Null when every game in view is for one team. */
export type TeamChange = { from: string; to: string; recentGamesWithNewTeam: number };
export function teamChangeOf(games: readonly { team: string | null }[], recent: readonly { team: string | null }[]): TeamChange | null {
  const to = games[games.length - 1]?.team ?? null;
  if (!to) return null;
  const before = [...games].reverse().find(game => game.team && game.team !== to);
  return before?.team ? { from: before.team, to, recentGamesWithNewTeam: recent.filter(game => game.team === to).length } : null;
}

export type WhatChangedPlayer = {
  playerId: number; name: string | null; position: string | null; team: string | null; teamChange: TeamChange | null;
  /** Actual samples: `short` means fewer than the window asked for. Overlap is counted from game ids, not assumed. */
  seasonGames: number; recentGames: number; baselineGames: number; overlap: number; short: boolean;
};
/** One appearance of the ranked metric; a null value is a gap in the line, never zero. */
export type SeriesPoint = { gameId: number; date: string; value: number | null };
export type WhatChangedRow = WhatChangedPlayer & {
  rank: number; change: MetricChange;
  /** One metric from each group, recent value and change, each admitted on its own. */
  tiles: MetricChange[];
  /** The ranked metric over the last appearances; `recentFrom` is the series index where the recent window starts. */
  series: SeriesPoint[]; recentFrom: number;
};
export type WhatChangedFocus = WhatChangedPlayer & { eligible: boolean; changes: MetricChange[] };
export type WhatChangedData = {
  through: string; window: WhatChangedWindow; comparison: WhatChangedSettings["comparison"]; requested: number;
  metricLabel: string; unit: string; strength: string;
  risers: WhatChangedRow[]; fallers: WhatChangedRow[];
  /** Eligible players with no rank: why is counted, and they are never zero-filled. */
  cohort: { eligible: number; ranked: number; shortSample: number; unadmitted: number; unchanged: number; listedLimit: number; unlisted: number };
  /** Ranked players left off a side who share the last rank shown on it. */
  moreTied: { up: number; down: number };
  focus: WhatChangedFocus | null; playerQuery: string; candidates: { playerId: number; name: string | null; team: string | null }[];
};

/** Rows per side on the Up and Down boards. A tie running past them is counted and said, not shown. */
export const WHAT_CHANGED_BOARD_ROWS = 6;
export function boardRanks<T extends { rank: number }>(ranked: readonly T[]) {
  const listed = ranked.slice(0, WHAT_CHANGED_BOARD_ROWS), last = listed[listed.length - 1]?.rank;
  return { listed, moreTied: ranked.slice(listed.length).filter(row => row.rank === last).length };
}
export const WHAT_CHANGED_SERIES = 10;
const GROUP_DEFAULTS: Record<MetricDefinition["group"], WhatChangedMetricId> = { Production: "points", Opportunity: "toi", Underlying: "ixg" };
/** One metric per group: the group's default, or the ranked metric in its own group so its recent value is printed. */
export const tileMetrics = (ranked: WhatChangedMetricId) => (Object.keys(GROUP_DEFAULTS) as MetricDefinition["group"][]).map(group => metricOf(ranked).group === group ? metricOf(ranked) : metricOf(GROUP_DEFAULTS[group]));
function gameValue(metric: MetricDefinition, basis: WhatChangedSettings["basis"], game: ChangeGame) {
  const value = metric.read(game);
  if (value === null) return null;
  if (typeof value !== "number") return value.for + value.against > 0 ? rounded(value.for * 100 / (value.for + value.against), 1) : null;
  if (basis !== "per60" || !metric.per60Seconds) return value;
  const perSixty = per60(value, metric.per60Seconds(game));
  return perSixty === null ? null : rounded(perSixty, 2);
}
/** Index runs of known values: the line breaks at each null and never joins across one. */
export function seriesRuns(values: readonly (number | null)[]) {
  const runs: number[][] = [];
  values.forEach((value, index) => { if (value === null) return; if (index > 0 && values[index - 1] !== null) runs[runs.length - 1].push(index); else runs.push([index]); });
  return runs;
}

export function joinNst<Row extends { player_id: number; date_scraped: string }>(appearances: readonly SkaterAppearance[], rows: readonly Row[] | null) {
  const byKey = new Map<string, Row[]>(), gamesOnDate = new Map<string, number>();
  for (const row of rows ?? []) { const key = `${row.player_id}:${row.date_scraped}`; byKey.set(key, [...(byKey.get(key) ?? []), row]); }
  for (const game of appearances) { const key = `${game.playerId}:${game.date}`; gamesOnDate.set(key, (gamesOnDate.get(key) ?? 0) + 1); }
  return (game: SkaterAppearance): NstJoin<Row> => {
    const key = `${game.playerId}:${game.date}`, matched = byKey.get(key) ?? [];
    if (!matched.length) return { state: "missing" };
    return matched.length > 1 || gamesOnDate.get(key)! > 1 ? { state: "unresolved" } : { state: "found", row: matched[0] };
  };
}

/** Completed games read against the schedule, and whether every completed game has skater rows. Anything short is partial. */
export function gameCoverage(input: { appearances: readonly SkaterAppearance[]; completedTeamGames: readonly { gameId: number }[]; scheduledGameIds: readonly number[] }) {
  const scheduled = new Set(input.scheduledGameIds), withSkaters = new Set(input.appearances.map(game => game.gameId));
  const completed = input.completedTeamGames.filter(game => scheduled.has(game.gameId));
  const noSkaterRows = new Set(completed.filter(game => !withSkaters.has(game.gameId)).map(game => game.gameId)).size;
  const expected = scheduled.size * 2, observed = completed.length, missing = Math.max(0, expected - observed);
  return { observed, expected, missing, noSkaterRows, reasons: [...(missing ? [`${missing} of ${expected} scheduled team games have no reported result.`] : []), ...(noSkaterRows ? [`${noSkaterRows} completed games have no skater rows.`] : [])] };
}
export const newestDate = (dates: Iterable<string>) => { let newest: string | null = null; for (const date of dates) if (!newest || date > newest) newest = date; return newest; };

/** Exact NHL id, or a name fragment for display lookup. More than one match selects nobody: identity is never guessed from a name. */
export function matchPlayer(appearances: readonly SkaterAppearance[], query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return { playerId: null as number | null, candidates: [] };
  const latest = new Map<number, SkaterAppearance>();
  for (const game of appearances) latest.set(game.playerId, game);
  const matches = /^\d+$/.test(text) ? latest.has(Number(text)) ? [latest.get(Number(text))!] : [] : [...latest.values()].filter(game => game.name?.toLowerCase().includes(text));
  return { playerId: matches.length === 1 ? matches[0].playerId : null, candidates: matches.length > 1 ? matches.slice(0, 5).map(game => ({ playerId: game.playerId, name: game.name, team: game.team })) : [] };
}

/** Recent and baseline windows through the shared producers: previous N never shares a game with the recent N. */
export function changeWindows<T extends { gameId: number }>(games: readonly T[], requested: number, comparison: WhatChangedSettings["comparison"]) {
  const recent = lastN(games, requested);
  const baseline = comparison === "previous" ? previousN(games, requested, requested) : versusSeason(games, requested).season;
  const inRecent = new Set(recent.rows.map(game => game.gameId));
  return { recent, baseline, overlap: baseline.rows.filter(game => inRecent.has(game.gameId)).length };
}

export type WhatChangedInput = {
  appearances: readonly SkaterAppearance[]; nstCounts: readonly NstCountRow[] | null; nstOnIce: readonly NstOnIceRow[] | null;
  completedTeamGames: readonly { gameId: number }[]; scheduledGameIds: readonly number[]; through: string; settings: WhatChangedSettings;
};
export function buildWhatChanged(input: WhatChangedInput): SharePostLoadResult<WhatChangedData> {
  const { settings, appearances } = input, requested = windowSize(settings.window), metric = metricOf(settings.metric);
  const counts = joinNst(appearances, input.nstCounts), onIce = joinNst(appearances, input.nstOnIce);
  const { playerId: focusId, candidates } = matchPlayer(appearances, settings.player);
  const players = [...appearancesByPlayer(appearances)].map(([playerId, games]) => {
    const joined = games.map((game): ChangeGame => ({ ...game, nst: counts(game), onIce: onIce(game) }));
    const { recent, baseline, overlap } = changeWindows(joined, requested, settings.comparison), last = games[games.length - 1];
    const who: WhatChangedPlayer = { playerId, name: last.name, position: last.position, team: last.team, teamChange: teamChangeOf(games, recent.rows), seasonGames: games.length, recentGames: recent.actual, baselineGames: baseline.actual, overlap, short: recent.short || baseline.short };
    return { who, games: joined, recent: recent.rows, baseline: baseline.rows };
  });
  const eligible = players.filter(player => player.who.seasonGames >= settings.minGp);
  // An STD baseline no longer than the recent window is the same games: no comparison exists, so it is a short sample.
  const comparable = (who: WhatChangedPlayer) => !who.short && who.baselineGames > who.overlap;
  const changed = eligible.map(player => ({ player, who: player.who, change: metricChange(metric, settings.basis, player.recent, player.baseline, settings.minCoverage) }));
  const admitted = changed.filter(row => comparable(row.who) && row.change.delta !== null);
  const rankDirection = (rows: typeof admitted, direction: "high" | "low") => competitionRanks(rows, row => row.change.delta, row => row.who.playerId, direction).map(({ row, rank }) => ({ rank, row }));
  const up = rankDirection(admitted.filter(row => row.change.delta! > 0), "high"), down = rankDirection(admitted.filter(row => row.change.delta! < 0), "low");
  const boardRow = ({ rank, row }: typeof up[number]): WhatChangedRow => {
    const last = lastN(row.player.games, WHAT_CHANGED_SERIES).rows;
    return { ...row.who, rank, change: row.change, tiles: tileMetrics(settings.metric).map(entry => metricChange(entry, settings.basis, row.player.recent, row.player.baseline, settings.minCoverage)), series: last.map(game => ({ gameId: game.gameId, date: game.date, value: gameValue(metric, settings.basis, game) })), recentFrom: Math.max(0, last.length - requested) };
  };
  const upBoard = boardRanks(up), downBoard = boardRanks(down);
  const risers = upBoard.listed.map(boardRow), fallers = downBoard.listed.map(boardRow);
  const focusPlayer = focusId === null ? null : players.find(player => player.who.playerId === focusId) ?? null;
  const focus: WhatChangedFocus | null = focusPlayer && { ...focusPlayer.who, eligible: focusPlayer.who.seasonGames >= settings.minGp, changes: WHAT_CHANGED_METRICS.map(entry => metricChange(entry, settings.basis, focusPlayer.recent, focusPlayer.baseline, settings.minCoverage)) };

  const games = gameCoverage({ appearances, completedTeamGames: input.completedTeamGames, scheduledGameIds: input.scheduledGameIds });
  const eligibleIds = new Set(eligible.map(player => player.who.playerId));
  const wgoGaps = appearances.filter(game => eligibleIds.has(game.playerId) && [game.goals, game.assists, game.points, game.shots, game.ppPoints, game.toiSeconds, game.ppToiSeconds].some(value => value === null)).length;
  const reasons = [...games.reasons, ...(wgoGaps ? [`${wgoGaps} eligible skater appearances have a missing NHL.com stat.`] : [])];
  const shortSample = changed.filter(row => !comparable(row.who)).length;
  const unadmitted = changed.filter(row => comparable(row.who) && row.change.delta === null).length;
  const usedNst = metric.source === "nst" ? changed.reduce((total, row) => ({ observed: total.observed + row.change.baseline.coverage.observed + (settings.comparison === "previous" ? row.change.recent.coverage.observed : 0), expected: total.expected + row.change.baseline.coverage.expected + (settings.comparison === "previous" ? row.change.recent.coverage.expected : 0) }), { observed: 0, expected: 0 }) : null;
  const windowName = windowLabel(settings.window);
  const unlisted = up.length + down.length - risers.length - fallers.length;
  const moves = [...new Set([...risers, ...fallers, ...(focus ? [focus] : [])].flatMap(row => row.teamChange ? [`${row.name ?? row.playerId} ${row.teamChange.from} to ${row.teamChange.to}, ${row.teamChange.recentGamesWithNewTeam} of ${row.recentGames} recent games`] : []))];
  const focusSample = focus ? `. ${focus.name ?? focus.playerId}: ${focus.recentGames} recent GP, ${focus.baselineGames} baseline GP, ${focus.overlap} overlap. A dash means below coverage or no denominator` : "";
  const boardSample = focus ? "" : `. Tiles show the recent value and its change, each admitted on its own; n/m is games covered when below the minimum. The line is the ranked metric over each player's last ${WHAT_CHANGED_SERIES} appearances, and a gap is a game with no value`;
  const movesSample = moves.length ? `. New team: ${moves.join("; ")}` : "";
  const focusGaps = focus?.changes.some(change => change.group === "Underlying" && (change.recent.coverage.missing > 0 || change.baseline.coverage.missing > 0)) ?? false;
  const tileGaps = [...risers, ...fallers].some(row => row.tiles.some(tile => tile.group === "Underlying" && (tile.recent.coverage.missing > 0 || tile.baseline.coverage.missing > 0)));
  const nstState = (usedNst && usedNst.observed < usedNst.expected) || focusGaps || tileGaps ? "partial" as const : "ready" as const;
  const sources: SharePostSource[] = [
    { name: "NHL.com skater game stats", tables: ["wgo_skater_stats"], state: reasons.length ? "partial" : "ready", asOf: newestDate(appearances.map(game => game.date)), updatedAt: null },
    { name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: games.missing ? "partial" : "ready", asOf: input.through, updatedAt: null },
    ...(input.nstCounts ? [{ name: "Natural Stat Trick individual counts", tables: ["nst_gamelog_as_counts"], state: nstState, asOf: newestDate(input.nstCounts.map(row => row.date_scraped)), updatedAt: null }] : []),
    ...(input.nstOnIce ? [{ name: "Natural Stat Trick on-ice counts", tables: ["nst_gamelog_as_counts_oi"], state: nstState, asOf: newestDate(input.nstOnIce.map(row => row.date_scraped)), updatedAt: null }] : []),
  ];
  const rowTeams = [...risers, ...fallers, ...(focus ? [focus] : [])].flatMap(row => row.team ? [row.team] : []);
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: {
      through: input.through, window: settings.window, comparison: settings.comparison, requested, metricLabel: metric.label, unit: unitOf(metric, settings.basis), strength: metric.strength,
      risers, fallers, cohort: { eligible: eligible.length, ranked: admitted.length, shortSample, unadmitted, unchanged: admitted.length - up.length - down.length, listedLimit: WHAT_CHANGED_BOARD_ROWS, unlisted },
      moreTied: { up: upBoard.moreTied, down: downBoard.moreTied },
      focus, playerQuery: settings.player, candidates,
    },
    teams: [...new Set(rowTeams)].sort(),
    evidence: {
      sources,
      sample: settings.comparison === "std"
        ? `${windowName} versus season to date through ${input.through}. Season values contain the recent games: recent games sit inside STD${focusSample}${boardSample}${movesSample}`
        : `${windowName} versus the previous ${requested} appearances through ${input.through}. No game is in both windows${focusSample}${boardSample}${movesSample}`,
      strength: focus ? "All situations; PP points and PP TOI on the power play; each row names its own" : [...new Set(tileMetrics(settings.metric).map(entry => entry.strength))].join("; "),
      cohort: `${eligible.length} skaters with ${settings.minGp}+ season GP: ${admitted.length} ranked, ${shortSample} short sample, ${unadmitted} below coverage${unlisted ? `, ${unlisted} more not listed` : ""}`,
      coverage: usedNst ? { observed: usedNst.observed, expected: usedNst.expected, missing: usedNst.expected - usedNst.observed, unit: `${metric.label} appearances` } : { observed: games.observed, expected: games.expected, missing: games.missing, unit: "team games" },
    },
  };
}

const altTile = (tile: MetricChange) => `${tile.short} ${formatMetricValue(tile, tile.recent.value)}, change ${formatMetricValue(tile, tile.delta, true)}, ${tile.recent.coverage.observed} of ${tile.recent.coverage.expected} recent games covered`;
const altRow = (row: WhatChangedRow) => `${row.rank}. ${row.name ?? `Player ${row.playerId}`}: ${formatMetricValue(row.change, row.change.recent.value)} versus ${formatMetricValue(row.change, row.change.baseline.value)} (${row.recentGames} and ${row.baselineGames} GP, overlap ${row.overlap}). ${row.tiles.map(altTile).join("; ")}. Last ${row.series.length} games: ${row.series.map(point => point.value === null ? "gap" : formatMetricValue(row.change, point.value)).join(", ")}`;
export const whatChangedModule = defineShareModule<WhatChangedSettings, WhatChangedData>({
  id: "what-changed", title: "What Changed", summary: "Recent production, opportunity and underlying metrics against season to date or the previous matched window.", group: "skaters", basis: "observed",
  fields: [
    { id: "window", label: "Recent window", kind: "select", default: "l5", options: [{ value: "l5", label: "L5" }, { value: "l10", label: "L10" }] },
    { id: "comparison", label: "Compared with", kind: "select", default: "std", options: [{ value: "std", label: "Season to date" }, { value: "previous", label: "Previous matched window" }] },
    { id: "minGp", label: "Min season GP", kind: "number", default: 10, min: 1, max: 82, step: 1 },
    { id: "minCoverage", label: "Min NST coverage %", kind: "number", default: 90, min: 50, max: 100, step: 1 },
    { id: "metric", label: "Metric", kind: "select", default: "points", options: WHAT_CHANGED_METRICS.map(metric => ({ value: metric.id, label: metric.label })) },
    { id: "basis", label: "Basis", kind: "select", default: "perGame", options: [{ value: "perGame", label: "Per game" }, { value: "per60", label: "Per 60" }] },
    { id: "player", label: "One player (name or NHL id)", kind: "text", default: "", maxLength: 40 },
  ],
  load: () => import("./whatChanged.sources").then(sources => sources.loadWhatChanged),
  card: () => import("components/SocialShare/modules/WhatChangedCard").then(card => card.default),
  hasRows: (data, settings) => settings.player.trim() ? data.focus !== null : data.risers.length + data.fallers.length > 0,
  altText: (snapshot, data) => {
    const samples = `${snapshot.evidence.sample}. ${snapshot.evidence.cohort}.`;
    if (data.focus) return `FHFH What Changed for ${data.focus.name ?? `player ${data.focus.playerId}`}. ${data.focus.changes.map(change => `${change.label}: ${formatMetricValue(change, change.recent.value)} versus ${formatMetricValue(change, change.baseline.value)}, ${change.recent.coverage.observed} of ${change.recent.coverage.expected} recent games covered`).join("; ")}. ${samples}`;
    return `FHFH What Changed, ${data.metricLabel} ${data.unit}. Up: ${data.risers.map(altRow).join("; ") || "none"}. Down: ${data.fallers.map(altRow).join("; ") || "none"}. ${samples}`;
  },
});

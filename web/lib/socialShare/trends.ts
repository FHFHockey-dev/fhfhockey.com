import type { Database } from "lib/supabase/database-generated.types";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { normalizeEvDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import { PLAYER_STATS_MAX_AGE_MS, type ShareMapRow } from "./players";
import { SHARE_TIME_ZONE, type ShareDataState, type ShareDeploymentRow, type ShareHotRow, type ShareMoverRow, type SharePpState, type ShareRateRow, type ShareTrendKind, type ShareTrendLayer, type ShareTrendSectionState, type ShareTrendWho, type SocialShareSnapshot } from "./types";

type Tables = Database["public"]["Tables"];
type RollingRow = Tables["rolling_player_game_metrics"]["Row"];
/**
 * Explicit read-only columns (tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md). Every name is checked
 * against database-generated.types.ts by `satisfies`; none is in ROLLING_DROPPED_COLUMNS.
 */
export const ROLLING_COLUMNS = [
  "player_id", "team_id", "season", "game_id", "game_date", "strength_state", "updated_at", "season_games_played",
  "points_avg_season", "points_total_last5", "toi_seconds_avg_last5", "toi_seconds_avg_season", "toi_seconds_total_last5",
  "pp_toi_seconds_total_last5", "pp_toi_seconds_avg_season", "sog_per_60_last5", "sog_per_60_season",
  "shot_attempts_per_60_last5", "shot_attempts_per_60_season", "ixg_per_60_last5", "ixg_per_60_season",
  "line_combo_slot", "line_combo_group", "pp_unit",
] as const satisfies readonly (keyof RollingRow)[];
export const EV_COLUMNS = ["player_id", "season", "game_date", "strength_state", "toi_seconds_avg_last5", "toi_seconds_avg_season"] as const satisfies readonly (keyof RollingRow)[];
export const PPC_COLUMNS = ["gameId", "playerId", "unit"] as const satisfies readonly (keyof Tables["powerPlayCombinations"]["Row"])[];
export const OWNERSHIP_COLUMNS = ["player_key", "player_id", "ownership_date", "ownership_pct"] as const satisfies readonly (keyof Tables["yahoo_player_ownership_history"]["Row"])[];
export const NAME_COLUMNS = ["id", "fullName", "position"] as const satisfies readonly (keyof Tables["players"]["Row"])[];
export type ShareRollingRow = Pick<RollingRow, typeof ROLLING_COLUMNS[number]>;
export type ShareEvRow = Pick<RollingRow, typeof EV_COLUMNS[number]>;
export type SharePpcRow = Pick<Tables["powerPlayCombinations"]["Row"], typeof PPC_COLUMNS[number]>;
export type ShareOwnershipRow = Pick<Tables["yahoo_player_ownership_history"]["Row"], typeof OWNERSHIP_COLUMNS[number]>;
export type SharePlayerNameRow = Pick<Tables["players"]["Row"], typeof NAME_COLUMNS[number]>;

/** One source read: its rows, or why it failed (never fixture values). */
export type SourceRead<T> = { rows: T[] } | { failed: string };
/**
 * Read-only Tuesday sources. The live loader reads `ev`, `map` and `players` only for the shortlists computed
 * from the others (trendShortlists); a fixture may hold every row, and the layer is the same.
 */
export type ShareTrendSources = {
  /** Strength "all", the edition's season, game_date within the last TREND_MAX_GAME_AGE_DAYS days. */
  rolling: SourceRead<ShareRollingRow>;
  ev: SourceRead<ShareEvRow>;
  ppc: SourceRead<SharePpcRow>;
  /** Rows on the latest observation date and on the latest date on or before MOVER_WINDOW_DAYS earlier. */
  ownership: SourceRead<ShareOwnershipRow>;
  map: SourceRead<ShareMapRow>;
  players: SourceRead<SharePlayerNameRow>;
};

export const TREND_WINDOW_GAMES = 5;
/** Tuesday form needs 10 games before the L5 window (15 season games). */
export const MIN_PRIOR_GAMES = 10;
/** Deployment and rate baselines need 10 season games. */
export const MIN_TREND_SEASON_GAMES = 10;
/** Last-5 per-60 rates need at least 50 minutes of ice time behind them. */
export const MIN_RATE_TOI_SECONDS_LAST5 = 3000;
/** A skater's latest game must be within this many days (injury, scratch). Also the rolling read window. */
export const TREND_MAX_GAME_AGE_DAYS = 7;
/** Without a line or PP change, a deployment row needs this TOI/GP change (seconds). */
export const MIN_DEPLOYMENT_TOI_DELTA_SECONDS = 60;
export const MOVER_WINDOW_DAYS = 5;
/** Ownership older than yesterday (New York) is stale. */
export const OWNERSHIP_MAX_AGE_DAYS = 1;
/** Smallest listed rostered-% change, in percentage points. */
export const MIN_MOVER_POINTS = 1;
/** Movers ranked before identity mapping; the loader maps only these keys per direction. */
export const MOVER_CANDIDATES = 30;
/** Ranked rows considered per list before the name/position filter (a goalie or unnamed id drops out). */
export const NAME_SLACK = 5;
export const TREND_LIST = 5;
export const DEPLOYMENT_LIST = 4;
export const RATE_LIST = 3;
export const RATE_METRICS = ["sogPer60", "icfPer60", "ixgPer60"] as const;
export type RateMetric = typeof RATE_METRICS[number];
const RATE_COLUMNS: Record<RateMetric, ["sog_per_60_last5" | "shot_attempts_per_60_last5" | "ixg_per_60_last5", "sog_per_60_season" | "shot_attempts_per_60_season" | "ixg_per_60_season"]> = {
  sogPer60: ["sog_per_60_last5", "sog_per_60_season"], icfPer60: ["shot_attempts_per_60_last5", "shot_attempts_per_60_season"], ixgPer60: ["ixg_per_60_last5", "ixg_per_60_season"],
};
export const RATE_DIGITS: Record<RateMetric, number> = { sogPer60: 1, icfPer60: 1, ixgPer60: 2 };

const DAY_MS = 86400000;
export const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const num = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number, digits: number) => Number((Math.round(value * 10 ** digits) / 10 ** digits).toFixed(digits));
const TEAM_BY_ID = new Map(Object.entries(teamsInfo).filter(([abbr]) => activeTeamAbbreviations.has(abbr)).map(([abbr, info]) => [info.id, abbr]));
const rowsOf = <T,>(read: SourceRead<T> | undefined): T[] | null => read && "rows" in read ? read.rows : null;
const failureOf = (read: SourceRead<unknown>, what: string) => "failed" in read ? [`${what} unavailable: ${read.failed}`] : [];
const dayLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export type TrendContext = { season: number; fetchedAt: string; generatedAt: string };
type Active = { latest: ShareRollingRow; previous: ShareRollingRow | null; team: string };

/**
 * Current skaters from the strength-all rows: latest game within the window and a known team. The previous row is
 * kept only when it is provably the game before (season games played steps by exactly 1).
 * Freshness is the writer's, not the row's (TT-2 capture): the daily pipeline writes each game row once, so a skater
 * whose last game was four days ago carries a four-day-old `updated_at` while still current. The source is stale
 * when its newest row update (the writer's last run) is older than 72 h.
 */
export function activeSkaters(rows: ShareRollingRow[], context: TrendContext) {
  const today = localDate(context.generatedAt, SHARE_TIME_ZONE), oldest = shiftDate(today, -TREND_MAX_GAME_AGE_DAYS), generated = Date.parse(context.generatedAt);
  const byPlayer = new Map<number, ShareRollingRow[]>();
  for (const row of rows) {
    if (row.season !== context.season || row.strength_state !== "all" || !isDate(row.game_date) || row.game_date < oldest) continue;
    byPlayer.set(row.player_id, [...(byPlayer.get(row.player_id) ?? []), row]);
  }
  const active = new Map<number, Active>();
  let future = 0, noTeam = 0, newestUpdate: string | null = null, through: string | null = null;
  for (const [id, list] of byPlayer) {
    list.sort((a, b) => b.game_date.localeCompare(a.game_date));
    const [latest, second] = list, updated = Date.parse(latest.updated_at);
    if (latest.game_date > today || !Number.isFinite(updated) || updated > generated) { future++; continue; }
    const iso = new Date(updated).toISOString();
    if (!newestUpdate || iso > newestUpdate) newestUpdate = iso;
    const team = latest.team_id === null ? undefined : TEAM_BY_ID.get(latest.team_id);
    if (!team) { noTeam++; continue; }
    const contiguous = second && num(latest.season_games_played) && second.season_games_played === latest.season_games_played - 1 ? second : null;
    active.set(id, { latest, previous: contiguous, team });
    if (!through || latest.game_date > through) through = latest.game_date;
  }
  let state: ShareDataState = "ready";
  const reasons: string[] = [];
  if (newestUpdate && generated - Date.parse(newestUpdate) > PLAYER_STATS_MAX_AGE_MS) { state = "stale"; reasons.push(`Rolling metrics are stale: last updated ${dayLabel(newestUpdate.slice(0, 10))} (newest row older than 72 h).`); }
  else if (!active.size) { state = future ? "missing" : "partial"; reasons.push(future ? "Rolling metric time is in the future." : `No skater has a rolling row from the last ${TREND_MAX_GAME_AGE_DAYS} days.`); }
  else if (future || noTeam) reasons.push(`Excluded ${future} future-dated and ${noTeam} team-unknown skaters.`);
  return { active: state === "stale" ? new Map<number, Active>() : active, state, reasons, through, updatedAt: newestUpdate, today };
}

/** PP evidence per game: unit when listed, "none" when the game has PP rows without the player, else unknown. */
function ppEvidence(ppc: SharePpcRow[]) {
  const games = new Map<number, Map<number, number>>();
  for (const row of ppc) {
    if (!num(row.gameId) || !num(row.playerId) || !num(row.unit)) continue;
    const units = games.get(row.gameId) ?? new Map<number, number>();
    units.set(row.playerId, row.unit);
    games.set(row.gameId, units);
  }
  return (row: ShareRollingRow): SharePpState => {
    const units = row.game_id === null ? undefined : games.get(row.game_id);
    if (units?.has(row.player_id)) return units.get(row.player_id)! > 0 ? units.get(row.player_id)! : "none";
    if (units) return "none";
    // No PP rows for the game: only the rolling row's own unit is evidence; a null there stays unknown.
    return num(row.pp_unit) && row.pp_unit > 0 ? row.pp_unit : null;
  };
}
const ppRank = (state: SharePpState) => state === "none" ? 9 : state;
const step = (now: number | null, before: number | null): -1 | 0 | 1 => now === null || before === null || now === before ? 0 : now < before ? 1 : -1;

type Ranked<T> = T & { nhlId: number };
const hotOrder = (direction: 1 | -1) => (a: Omit<ShareHotRow, keyof ShareTrendWho> & { nhlId: number }, b: typeof a) => direction * (b.delta - a.delta) || b.l5 - a.l5 || a.nhlId - b.nhlId;

/** Ranked candidates per list, cut to list length + NAME_SLACK, before names and EV rows are known. */
export function trendShortlists(sources: Pick<ShareTrendSources, "rolling" | "ppc" | "ownership" | "map">, context: TrendContext) {
  const rolling = rowsOf(sources.rolling), skaters = rolling ? activeSkaters(rolling, context) : null, active = skaters?.active ?? new Map<number, Active>();
  const cut = <T,>(list: T[], size: number) => list.slice(0, size + NAME_SLACK);

  // Tuesday form: L5 P/GP vs the season baseline without those games: (season avg × GP − L5 points) ÷ (GP − 5).
  const form = [...active].flatMap(([nhlId, { latest }]) => {
    const gp = latest.season_games_played, priorGames = num(gp) ? gp - TREND_WINDOW_GAMES : 0;
    if (priorGames < MIN_PRIOR_GAMES || !num(latest.points_avg_season) || !num(latest.points_total_last5)) return [];
    const priorRaw = (latest.points_avg_season * gp! - latest.points_total_last5) / priorGames;
    if (priorRaw < -0.01) return [];
    const l5 = round(latest.points_total_last5 / TREND_WINDOW_GAMES, 2), prior = round(Math.max(0, priorRaw), 2);
    return [{ nhlId, lastGame: latest.game_date, l5, prior, priorGames, delta: round(l5 - prior, 2) }];
  });
  const hot = cut(form.filter(row => row.delta > 0).sort(hotOrder(1)), TREND_LIST), cold = cut(form.filter(row => row.delta < 0).sort(hotOrder(-1)), TREND_LIST);

  const rates = Object.fromEntries(RATE_METRICS.map(metric => {
    const [l5Column, seasonColumn] = RATE_COLUMNS[metric], digits = RATE_DIGITS[metric];
    const list = [...active].flatMap(([nhlId, { latest }]) => {
      if (!num(latest.season_games_played) || latest.season_games_played < MIN_TREND_SEASON_GAMES || !num(latest.toi_seconds_total_last5) || latest.toi_seconds_total_last5 < MIN_RATE_TOI_SECONDS_LAST5) return [];
      const l5Raw = latest[l5Column], seasonRaw = latest[seasonColumn];
      if (!num(l5Raw) || !num(seasonRaw)) return [];
      const l5 = round(l5Raw, digits), season = round(seasonRaw, digits);
      return [{ nhlId, l5, season, delta: round(l5 - season, digits), l5Minutes: Math.floor(latest.toi_seconds_total_last5 / 60) }];
    }).filter(row => row.delta > 0).sort((a, b) => b.delta - a.delta || b.l5 - a.l5 || a.nhlId - b.nhlId);
    return [metric, cut(list, RATE_LIST)];
  })) as Record<RateMetric, Ranked<Omit<ShareRateRow, keyof ShareTrendWho>>[]>;

  // Deployment: TOI/GP L5 vs season, plus line and PP changes from the previous contiguous game (same team only).
  const ppc = rowsOf(sources.ppc), pp = ppEvidence(ppc ?? []);
  const deployment = [...active].flatMap(([nhlId, { latest, previous }]) => {
    if (!num(latest.season_games_played) || latest.season_games_played < MIN_TREND_SEASON_GAMES || !num(latest.toi_seconds_avg_last5) || !num(latest.toi_seconds_avg_season)) return [];
    const teamChange = !!previous && previous.team_id !== latest.team_id, before = teamChange ? null : previous;
    const lineNow = normalizeEvDeploymentBucket({ lineComboGroup: latest.line_combo_group, lineComboSlot: latest.line_combo_slot });
    const lineBefore = before ? normalizeEvDeploymentBucket({ lineComboGroup: before.line_combo_group, lineComboSlot: before.line_combo_slot }) : null;
    const lineChange = lineNow && lineBefore && lineNow[0] === lineBefore[0] ? step(Number(lineNow.slice(1)), Number(lineBefore.slice(1))) : 0;
    const ppNow = pp(latest), ppBefore = before ? pp(before) : null;
    const ppChange = ppNow === null || ppBefore === null ? 0 : step(ppRank(ppNow), ppRank(ppBefore));
    const toi = { l5: Math.round(latest.toi_seconds_avg_last5), season: Math.round(latest.toi_seconds_avg_season) }, delta = toi.l5 - toi.season;
    if (!lineChange && !ppChange && Math.abs(delta) < MIN_DEPLOYMENT_TOI_DELTA_SECONDS) return [];
    const role = lineChange + ppChange, up = role > 0 || (role === 0 && delta >= 0);
    return [{ nhlId, up, changed: lineChange || ppChange ? 1 : 0, role, lastGame: latest.game_date, toi, delta, teamChange,
      line: { now: lineNow, before: lineBefore }, ppUnit: { now: ppNow, before: ppBefore }, lineChange, ppChange,
      pp: { l5: num(latest.pp_toi_seconds_total_last5) ? Math.round(latest.pp_toi_seconds_total_last5 / TREND_WINDOW_GAMES) : null, season: num(latest.pp_toi_seconds_avg_season) ? Math.round(latest.pp_toi_seconds_avg_season) : null } }];
  }).sort((a, b) => b.changed - a.changed || Math.abs(b.role) - Math.abs(a.role) || Math.abs(b.delta) - Math.abs(a.delta) || a.nhlId - b.nhlId);
  const up = cut(deployment.filter(row => row.up), DEPLOYMENT_LIST), down = cut(deployment.filter(row => !row.up), DEPLOYMENT_LIST);

  // Movers: percentage-point change between two dated observations, rounded to 0.1 before the difference.
  const ownership = rowsOf(sources.ownership) ?? [], dates = [...new Set(ownership.map(row => row.ownership_date).filter(isDate))].sort();
  const latestDate = dates[dates.length - 1] ?? null, previousDate = latestDate ? [...dates].reverse().find(date => date <= shiftDate(latestDate, -MOVER_WINDOW_DAYS)) ?? null : null;
  const valueOf = (date: string | null) => new Map(ownership.filter(row => row.ownership_date === date && num(row.ownership_pct) && row.ownership_pct >= 0 && row.ownership_pct <= 100).map(row => [row.player_key, row]));
  const latestRows = valueOf(latestDate), previousRows = valueOf(previousDate);
  const moves = [...latestRows].flatMap(([key, row]) => {
    const before = previousRows.get(key);
    // A missing observation is not 0%: no previous row, no mover.
    if (!before) return [];
    const latest = round(row.ownership_pct!, 1), previous = round(before.ownership_pct!, 1), delta = round(latest - previous, 1);
    return Math.abs(delta) >= MIN_MOVER_POINTS ? [{ key, yahooId: row.player_id ?? before.player_id, latest, previous, delta }] : [];
  });
  const moveOrder = (direction: 1 | -1) => (a: typeof moves[number], b: typeof moves[number]) => direction * (b.delta - a.delta) || b.latest - a.latest || a.key.localeCompare(b.key);
  const riserKeys = moves.filter(move => move.delta > 0).sort(moveOrder(1)).slice(0, MOVER_CANDIDATES), fallerKeys = moves.filter(move => move.delta < 0).sort(moveOrder(-1)).slice(0, MOVER_CANDIDATES);
  const map = rowsOf(sources.map), nhlIds = new Map<string, Set<number>>();
  for (const row of map ?? []) {
    const id = Number(row.nhl_player_id);
    if (!row.yahoo_player_id || !Number.isInteger(id) || id <= 0) continue;
    nhlIds.set(row.yahoo_player_id, (nhlIds.get(row.yahoo_player_id) ?? new Set()).add(id));
  }
  const identify = (move: typeof moves[number]) => {
    const ids = new Set([...(nhlIds.get(move.key) ?? []), ...(move.yahooId === null ? [] : nhlIds.get(String(move.yahooId)) ?? [])]);
    // Ambiguous or unmapped keys drop out; so do players without a current rolling row (no per-game team).
    const id = ids.size === 1 ? [...ids][0] : null;
    return id !== null && active.has(id) ? [{ nhlId: id, latest: move.latest, previous: move.previous, delta: move.delta }] : [];
  };
  const risers = cut(riserKeys.flatMap(identify), TREND_LIST), fallers = cut(fallerKeys.flatMap(identify), TREND_LIST);
  const today = skaters?.today ?? localDate(context.generatedAt, SHARE_TIME_ZONE);
  return { skaters, active, hot, cold, rates, up, down, risers, fallers, latestDate, previousDate, today,
    moverKeys: [...riserKeys, ...fallerKeys].flatMap(move => [move.key, ...(move.yahooId === null ? [] : [String(move.yahooId)])]),
    gameIds: [...new Set([...active.values()].flatMap(({ latest, previous }) => [latest.game_id, previous?.game_id]).filter(num))].sort((a, b) => a - b) };
}
export type TrendShortlists = ReturnType<typeof trendShortlists>;

/** Every id the shortlists may show (names are read for these only). */
export const shortlistIds = (lists: TrendShortlists) => [...new Set([...lists.hot, ...lists.cold, ...Object.values(lists.rates).flat(), ...lists.up, ...lists.down, ...lists.risers, ...lists.fallers].map(row => row.nhlId))].sort((a, b) => a - b);

/** The deployment rows that survive the name filter: the only players whose EV rows are read. */
export function deploymentShownIds(lists: TrendShortlists, players: SharePlayerNameRow[]) {
  const names = skaterNames(players);
  return [...lists.up.filter(row => names.has(row.nhlId)).slice(0, DEPLOYMENT_LIST), ...lists.down.filter(row => names.has(row.nhlId)).slice(0, DEPLOYMENT_LIST)].map(row => row.nhlId).sort((a, b) => a - b);
}
const skaterNames = (players: SharePlayerNameRow[]) => new Map(players.filter(row => row.position !== "G" && typeof row.fullName === "string" && row.fullName.trim()).map(row => [row.id, row]));

const section = (sources: SourceRead<unknown>[], names: string[], gate: { state: ShareDataState; reasons: string[] } | null): ShareTrendSectionState => {
  const failed = sources.flatMap((read, index) => failureOf(read, names[index]));
  if (failed.length) return { state: "missing", reasons: failed };
  return gate ?? { state: "ready", reasons: [] };
};

/**
 * Tuesday layer from read-only sources. Each section is gated on its own sources: a failed read makes that section
 * "missing" with the reason, stale rolling rows or ownership make it "stale" with the as-of date, and no fixture
 * value ever fills a gap. Only listed players are in the result.
 */
export function buildTrendLayer(sources: ShareTrendSources | null, context: TrendContext, notReadReason = "Rolling game metrics and ownership were not read."): ShareTrendLayer {
  const base = { name: "FHFH rolling game metrics + Yahoo ownership" as const, version: 2 as const, season: context.season, fetchedAt: context.fetchedAt };
  if (!sources) {
    const empty = { state: "missing" as const, reasons: [notReadReason] };
    return { ...base, metricsThrough: null, metricsUpdatedAt: null, ownershipLatestDate: null, ownershipPreviousDate: null,
      sections: { hot: { ...empty, hot: [], cold: [] }, deployment: { ...empty, up: [], down: [] }, rates: { ...empty, sogPer60: [], icfPer60: [], ixgPer60: [] }, movers: { ...empty, risers: [], fallers: [] } } };
  }
  const lists = trendShortlists(sources, context), names = skaterNames(rowsOf(sources.players) ?? []);
  const who = (nhlId: number): ShareTrendWho | null => {
    const name = names.get(nhlId), active = lists.active.get(nhlId);
    return name && active ? { nhlId, name: name.fullName, team: active.team, position: name.position } : null;
  };
  const shown = <T extends { nhlId: number }, R>(list: T[], size: number, make: (row: T, person: ShareTrendWho) => R) => list.flatMap(row => { const person = who(row.nhlId); return person ? [make(row, person)] : []; }).slice(0, size);
  const metricsGate = lists.skaters && lists.skaters.state !== "ready" ? { state: lists.skaters.state, reasons: lists.skaters.reasons } : lists.skaters ? { state: "ready" as const, reasons: lists.skaters.reasons } : null;

  const hotState = section([sources.rolling, sources.players], ["Rolling game metrics", "Player names"], metricsGate);
  const hotReady = hotState.state === "ready";
  const hotRow = (row: TrendShortlists["hot"][number], person: ShareTrendWho): ShareHotRow => ({ ...person, lastGame: row.lastGame, l5: row.l5, prior: row.prior, priorGames: row.priorGames, delta: row.delta });

  const ratesState = section([sources.rolling, sources.players], ["Rolling game metrics", "Player names"], metricsGate), ratesReady = ratesState.state === "ready";

  const deployState = section([sources.rolling, sources.ppc, sources.ev, sources.players], ["Rolling game metrics", "Power-play combinations", "Even-strength rolling rows", "Player names"], metricsGate);
  const deployReady = deployState.state === "ready", ev = new Map((rowsOf(sources.ev) ?? []).filter(row => row.season === context.season && row.strength_state === "ev").map(row => [`${row.player_id}|${row.game_date}`, row]));
  const deployRow = (row: TrendShortlists["up"][number], person: ShareTrendWho): ShareDeploymentRow => {
    const even = ev.get(`${row.nhlId}|${row.lastGame}`);
    return { ...person, lastGame: row.lastGame, toi: row.toi, delta: row.delta, pp: row.pp, line: row.line, ppUnit: row.ppUnit, teamChange: row.teamChange, lineChange: row.lineChange, ppChange: row.ppChange,
      ev: { l5: even && num(even.toi_seconds_avg_last5) ? Math.round(even.toi_seconds_avg_last5) : null, season: even && num(even.toi_seconds_avg_season) ? Math.round(even.toi_seconds_avg_season) : null } };
  };

  let ownershipGate: { state: ShareDataState; reasons: string[] } | null = metricsGate && metricsGate.state !== "ready" ? { state: metricsGate.state, reasons: [`Team identity needs current rolling rows: ${metricsGate.reasons[0] ?? metricsGate.state}`] } : null;
  if (!ownershipGate && "rows" in sources.ownership) {
    if (!lists.latestDate) ownershipGate = { state: "missing", reasons: ["No Yahoo ownership observation was found."] };
    else if (lists.latestDate > lists.today) ownershipGate = { state: "missing", reasons: [`Yahoo ownership date ${lists.latestDate} is in the future.`] };
    else if (lists.latestDate < shiftDate(lists.today, -OWNERSHIP_MAX_AGE_DAYS)) ownershipGate = { state: "stale", reasons: [`Yahoo ownership is stale: last observed ${dayLabel(lists.latestDate)}.`] };
    else if (!lists.previousDate) ownershipGate = { state: "missing", reasons: [`No Yahoo ownership observation on or before ${dayLabel(shiftDate(lists.latestDate, -MOVER_WINDOW_DAYS))}.`] };
  }
  const moversState = section([sources.ownership, sources.map, sources.rolling, sources.players], ["Yahoo ownership", "Yahoo to NHL id map", "Rolling game metrics", "Player names"], ownershipGate);
  const moversReady = moversState.state === "ready";
  const moverRow = (row: TrendShortlists["risers"][number], person: ShareTrendWho): ShareMoverRow => ({ ...person, latest: row.latest, previous: row.previous, delta: row.delta });

  return { ...base, metricsThrough: lists.skaters?.through ?? null, metricsUpdatedAt: lists.skaters?.updatedAt ?? null,
    ownershipLatestDate: lists.latestDate, ownershipPreviousDate: lists.previousDate,
    sections: {
      hot: { ...hotState, hot: hotReady ? shown(lists.hot, TREND_LIST, hotRow) : [], cold: hotReady ? shown(lists.cold, TREND_LIST, hotRow) : [] },
      deployment: { ...deployState, up: deployReady ? shown(lists.up, DEPLOYMENT_LIST, deployRow) : [], down: deployReady ? shown(lists.down, DEPLOYMENT_LIST, deployRow) : [] },
      rates: { ...ratesState, ...Object.fromEntries(RATE_METRICS.map(metric => [metric, ratesReady ? shown(lists.rates[metric], RATE_LIST, (row, person): ShareRateRow => ({ ...person, l5: row.l5, season: row.season, delta: row.delta, l5Minutes: row.l5Minutes })) : []])) as Record<RateMetric, ShareRateRow[]> },
      movers: { ...moversState, risers: moversReady ? shown(lists.risers, TREND_LIST, moverRow) : [], fallers: moversReady ? shown(lists.fallers, TREND_LIST, moverRow) : [] },
    } };
}

/** Section definitions (CONTRACT.md), printed in each card footer. */
export const trendDefinitions: Record<ShareTrendKind, string[]> = {
  hot: [`Tuesday form: P/GP last ${TREND_WINDOW_GAMES} GP vs prior GP (season minus L${TREND_WINDOW_GAMES})`, `Min ${MIN_PRIOR_GAMES} prior GP · last game ≤ ${TREND_MAX_GAME_AGE_DAYS} days`],
  deployment: [`TOI/GP L${TREND_WINDOW_GAMES} / season: all · EV · PP`, "Line & PP unit: last game vs the game before", `Listed: any line/PP change or ±${MIN_DEPLOYMENT_TOI_DELTA_SECONDS / 60}:00 TOI · PP ? = unknown`],
  rates: [`Per-60: L${TREND_WINDOW_GAMES} rate and Δ vs season`, `Min ${MIN_RATE_TOI_SECONDS_LAST5 / 60} L${TREND_WINDOW_GAMES} min · ${MIN_TREND_SEASON_GAMES}+ GP`, "iCF = all individual shot attempts"],
  movers: [`pct pts = percentage-point change in Yahoo rostered %, latest vs on/before ${MOVER_WINDOW_DAYS} days earlier`, "No observation ≠ 0% · not add/drop counts"],
};

/** Snapshot id + graphic + selected days: the PNG must capture exactly this verified edition and card (lane TT). */
export const trendExportToken = (snapshot: SocialShareSnapshot, graphic: string) => `${snapshot.id}|${graphic}|${snapshot.selectedDates.join(",")}`;

/** A section is publishable only when the edition's trend layer marks it ready. */
export const trendSectionReady = (snapshot: SocialShareSnapshot, kind: ShareTrendKind) => snapshot.trends?.version === 2 && snapshot.trends.sections[kind].state === "ready";

/** Card rows with the team's remaining games in the selected days (selection-dependent, so computed here). */
const withWeek = <T extends { team: string }>(snapshot: SocialShareSnapshot, list: T[]) => {
  const games = new Map(snapshot.rows.map(row => [row.team.abbreviation, row.remainingGames]));
  return list.map(row => ({ ...row, weekGames: games.get(row.team) ?? null }));
};
export type WithWeek<T> = T & { weekGames: number | null };

export function hotCold(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted || !trendSectionReady(snapshot, "hot")) return { hot: [], cold: [] };
  const { hot, cold } = snapshot.trends!.sections.hot;
  return { hot: withWeek(snapshot, hot), cold: withWeek(snapshot, cold) };
}
export function deploymentChanges(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted || !trendSectionReady(snapshot, "deployment")) return { up: [], down: [] };
  const { up, down } = snapshot.trends!.sections.deployment;
  return { up: withWeek(snapshot, up), down: withWeek(snapshot, down) };
}
export function rateStandouts(snapshot: SocialShareSnapshot, trusted: boolean): Record<RateMetric, WithWeek<ShareRateRow>[]> {
  if (!trusted || !trendSectionReady(snapshot, "rates")) return { sogPer60: [], icfPer60: [], ixgPer60: [] };
  const rates = snapshot.trends!.sections.rates;
  return { sogPer60: withWeek(snapshot, rates.sogPer60), icfPer60: withWeek(snapshot, rates.icfPer60), ixgPer60: withWeek(snapshot, rates.ixgPer60) };
}
export function ownershipMovers(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted || !trendSectionReady(snapshot, "movers")) return { risers: [], fallers: [] };
  const { risers, fallers } = snapshot.trends!.sections.movers;
  return { risers: withWeek(snapshot, risers), fallers: withWeek(snapshot, fallers) };
}

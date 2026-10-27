import type { Database } from "lib/supabase/database-generated.types";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { normalizeEvDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import { PLAYER_STATS_MAX_AGE_MS, type ShareMapRow } from "./players";
import { RECENT_FORM_RULE, SHARE_TIME_ZONE, type ShareDataState, type ShareDeploymentRow, type ShareHotRow, type ShareMoverRow, type SharePpState, type ShareRateRow, type ShareTrendKind, type ShareTrendLayer, type ShareTrendSectionState, type ShareTrendWho, type SocialShareSnapshot } from "./types";

type Tables = Database["public"]["Tables"];
type RollingRow = Tables["rolling_player_game_metrics"]["Row"];
/**
 * Explicit read-only columns (tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md). Every name is checked
 * against database-generated.types.ts by `satisfies`; none is in ROLLING_DROPPED_COLUMNS.
 */
export const ROLLING_COLUMNS = [
  "player_id", "team_id", "season", "game_id", "game_date", "strength_state", "updated_at", "season_games_played",
  "points_avg_season", "points_total_last5", "points_total_last10", "toi_seconds_avg_last5", "toi_seconds_avg_season", "toi_seconds_total_last5",
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
/**
 * Sparkline rows (TT-4, READ-PLAN v2 S1): season-to-date values on every strength-all game row. A game's own value is
 * the difference between two contiguous rows (season games played one apart), or the row itself on game 1.
 */
export const SERIES_COLUMNS = [
  "player_id", "season", "game_date", "strength_state", "season_games_played", "points_avg_season", "toi_seconds_avg_season",
  "sog_per_60_shots_season", "sog_per_60_toi_seconds_season", "shot_attempts_per_60_shot_attempts_season", "shot_attempts_per_60_toi_seconds_season",
  "ixg_per_60_ixg_season", "ixg_per_60_toi_seconds_season",
] as const satisfies readonly (keyof RollingRow)[];
export type ShareSeriesRow = Pick<RollingRow, typeof SERIES_COLUMNS[number]>;

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
  /** Sparklines (TT-4): strength-all season rows of the shown skaters for the last SERIES_LOOKBACK_DAYS days. */
  series?: SourceRead<ShareSeriesRow>;
  /** Sparklines (TT-4): the shown movers' daily observations from the comparison date to the latest. */
  ownershipSeries?: SourceRead<ShareOwnershipRow>;
  /** TT-10 (READ-PLAN v3 M3): Yahoo↔NHL id map rows for the shown non-mover players (rostered % on every tile). */
  rosterMap?: SourceRead<ShareMapRow>;
};

export const TREND_WINDOW_GAMES = 5;
/** Recent Form (recent-form-v1-early) compares two non-overlapping 5-appearance windows, all 10 in the current season. */
export const RECENT_FORM_GAMES = 10;
/** Deployment and rate baselines need 10 season games. */
export const MIN_TREND_SEASON_GAMES = 10;
/** Last-5 per-60 rates need at least 50 minutes of ice time behind them. */
export const MIN_RATE_TOI_SECONDS_LAST5 = 3000;
/** A skater's latest game must be within this many days (injury, scratch). Also the rolling read window. */
export const TREND_MAX_GAME_AGE_DAYS = 7;
/** Without a line or PP change, a deployment row needs this TOI/GP change (seconds). */
export const MIN_DEPLOYMENT_TOI_DELTA_SECONDS = 60;
export const MOVER_WINDOW_DAYS = 5;
/** Sparklines (TT-4): the last 10 games per listed skater from a 35-day read; movers' daily values up to 14 days apart. */
export const SERIES_GAMES = 10;
export const SERIES_LOOKBACK_DAYS = 35;
export const OWNERSHIP_SERIES_MAX_DAYS = 14;
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

/**
 * PP evidence per game: PP1 or PP2 when listed; "none" when the game has PP rows and the player is not on PP1/PP2;
 * otherwise unknown. There are only two PP units (TJ, TT-4): the writer (update-power-play-combinations/[gameId].ts)
 * ranks skaters by PP TOI, top 5 → 1, next 5 → 2, everyone else with PP time → 3, so unit 3 is incidental PP time.
 */
export const PP_UNITS = 2;
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
    if (units?.has(row.player_id)) { const unit = units.get(row.player_id)!; return unit >= 1 && unit <= PP_UNITS ? unit : "none"; }
    if (units) return "none";
    // No PP rows for the game: only the rolling row's own PP1/PP2 is evidence. Anything else (null, or a unit 3 that
    // the game's rows cannot confirm) stays unknown.
    return num(row.pp_unit) && row.pp_unit >= 1 && row.pp_unit <= PP_UNITS ? row.pp_unit : null;
  };
}
const ppRank = (state: SharePpState) => state === "none" ? 9 : state;
const step = (now: number | null, before: number | null): -1 | 0 | 1 => now === null || before === null || now === before ? 0 : now < before ? 1 : -1;

type Ranked<T> = T & { nhlId: number };
const hotOrder = (direction: 1 | -1) => (a: Omit<ShareHotRow, keyof ShareTrendWho> & { nhlId: number }, b: typeof a) => direction * (b.delta - a.delta) || b.recent - a.recent || a.nhlId - b.nhlId;

/** Ranked candidates per list, cut to list length + NAME_SLACK, before names and EV rows are known. */
export function trendShortlists(sources: Pick<ShareTrendSources, "rolling" | "ppc" | "ownership" | "map">, context: TrendContext) {
  const rolling = rowsOf(sources.rolling), skaters = rolling ? activeSkaters(rolling, context) : null, active = skaters?.active ?? new Map<number, Active>();
  const cut = <T,>(list: T[], size: number) => list.slice(0, size + NAME_SLACK);

  // Recent Form (recent-form-v1-early): the writer's points windows hold the last N valid observations across seasons.
  // With ≥ 10 season games and season points proven whole (season average × GP is an integer, so no in-season game
  // lacks points), the last 10 observations are the last 10 appearances, all this season, and last10 − last5 is the
  // preceding 5 with no overlap. Anything unproven is left out, never read as zero.
  const form = [...active].flatMap(([nhlId, { latest }]) => {
    const gp = latest.season_games_played, last5 = latest.points_total_last5, last10 = latest.points_total_last10;
    if (!num(gp) || gp < RECENT_FORM_GAMES || !num(latest.points_avg_season) || !num(last5) || !num(last10) || last5 < 0 || last10 < last5) return [];
    const seasonPoints = latest.points_avg_season * gp;
    if (Math.abs(seasonPoints - Math.round(seasonPoints)) > 0.01 || last10 > Math.round(seasonPoints)) return [];
    const recent = round(last5 / TREND_WINDOW_GAMES, 2), preceding = round((last10 - last5) / TREND_WINDOW_GAMES, 2);
    return [{ nhlId, lastGame: latest.game_date, recent, preceding, delta: round(recent - preceding, 2) }];
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
    // Column (TT-3): a TOI change of 1:00 or more sets the column by its sign, so the hero number never contradicts
    // it, while the role chips keep their own arrows. Role-only rows (smaller TOI change) follow the role direction;
    // a mixed role (line up, PP down, or the reverse) has no direction and is left out.
    const driver: "toi" | "role" = Math.abs(delta) >= MIN_DEPLOYMENT_TOI_DELTA_SECONDS ? "toi" : "role";
    if (driver === "role" && (!(lineChange || ppChange) || lineChange * ppChange < 0)) return [];
    const role = lineChange + ppChange, up = driver === "toi" ? delta > 0 : role > 0;
    return [{ nhlId, up, driver, changed: lineChange || ppChange ? 1 : 0, role, lastGame: latest.game_date, toi, delta, teamChange,
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
    return id !== null && active.has(id) ? [{ nhlId: id, key: move.key, latest: move.latest, previous: move.previous, delta: move.delta }] : [];
  };
  const risers = cut(riserKeys.flatMap(identify), TREND_LIST), fallers = cut(fallerKeys.flatMap(identify), TREND_LIST);
  const today = skaters?.today ?? localDate(context.generatedAt, SHARE_TIME_ZONE);
  return { skaters, active, hot, cold, formQualifiers: form.length, rates, up, down, risers, fallers, latestDate, previousDate, today,
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
/** Shown rows' ids and Yahoo keys, for the sparkline reads (TT-4): only players a card lists. */
export function seriesShownIds(lists: TrendShortlists, players: SharePlayerNameRow[]) {
  const names = skaterNames(players), take = <T extends { nhlId: number }>(list: T[], size: number) => list.filter(row => names.has(row.nhlId)).slice(0, size);
  return [...new Set([...take(lists.hot, TREND_LIST), ...take(lists.cold, TREND_LIST), ...take(lists.up, DEPLOYMENT_LIST), ...take(lists.down, DEPLOYMENT_LIST),
    ...RATE_METRICS.flatMap(metric => take(lists.rates[metric], RATE_LIST))].map(row => row.nhlId))].sort((a, b) => a - b);
}
export function moverShownKeys(lists: TrendShortlists, players: SharePlayerNameRow[]) {
  const names = skaterNames(players);
  return [...lists.risers.filter(row => names.has(row.nhlId)).slice(0, TREND_LIST), ...lists.fallers.filter(row => names.has(row.nhlId)).slice(0, TREND_LIST)].map(row => row.key).sort();
}
/** The movers sparkline's dates, P..D inclusive, or null when they are more than OWNERSHIP_SERIES_MAX_DAYS apart. */
export function ownershipSeriesDates(previous: string | null, latest: string | null) {
  if (!previous || !latest) return null;
  const days = Math.round((Date.parse(`${latest}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / DAY_MS);
  return days < 1 || days > OWNERSHIP_SERIES_MAX_DAYS ? null : Array.from({ length: days + 1 }, (_, day) => shiftDate(previous, day));
}

/**
 * One skater's last SERIES_GAMES per-game values, oldest first, from season-to-date values on contiguous rows. A game
 * whose own row, previous row or value is missing is null (a gap), never interpolated.
 */
function gameSeries(rows: ShareSeriesRow[], latestSgp: number, cumulative: (row: ShareSeriesRow) => number | null) {
  const bySgp = new Map<number, ShareSeriesRow | null>();
  for (const row of rows) if (num(row.season_games_played)) bySgp.set(row.season_games_played, bySgp.has(row.season_games_played) ? null : row);
  const at = (sgp: number) => { const row = bySgp.get(sgp); return row ? cumulative(row) : null; };
  return Array.from({ length: SERIES_GAMES }, (_, k) => {
    const sgp = latestSgp - (SERIES_GAMES - 1 - k), now = sgp >= 1 ? at(sgp) : null, before = sgp === 1 ? 0 : at(sgp - 1);
    return now === null || before === null ? null : now - before;
  });
}
const complete = (values: (number | null)[]): values is number[] => values.every(num);

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
    return { ...base, metricsThrough: null, metricsUpdatedAt: null, ownershipLatestDate: null, ownershipPreviousDate: null, ownershipSeriesDates: null, rosteredAsOf: null,
      sections: { hot: { ...empty, rule: RECENT_FORM_RULE, qualifiers: 0, hot: [], cold: [] }, deployment: { ...empty, up: [], down: [] }, rates: { ...empty, sogPer60: [], icfPer60: [], ixgPer60: [] }, movers: { ...empty, risers: [], fallers: [] } } };
  }
  const lists = trendShortlists(sources, context), names = skaterNames(rowsOf(sources.players) ?? []);
  // TT-10: rostered % for every shown player from the ownership rows already read at the latest date D (O3), mapped
  // NHL → Yahoo by M3. Only fresh ownership counts; no observation, or Yahoo ids that disagree, is null ("—"), never 0%.
  const ownershipRows = rowsOf(sources.ownership) ?? [], rosteredFresh = !!lists.latestDate && lists.latestDate <= lists.today && lists.latestDate >= shiftDate(lists.today, -OWNERSHIP_MAX_AGE_DAYS);
  const atLatest = new Map<string, number>();
  for (const row of ownershipRows) if (row.ownership_date === lists.latestDate && num(row.ownership_pct) && row.ownership_pct >= 0 && row.ownership_pct <= 100) {
    const value = round(row.ownership_pct, 1);
    atLatest.set(row.player_key, value);
    if (row.player_id !== null) atLatest.set(String(row.player_id), value);
  }
  const yahooIds = new Map<number, string[]>();
  for (const row of rowsOf(sources.rosterMap) ?? []) {
    const id = Number(row.nhl_player_id);
    if (row.yahoo_player_id && Number.isInteger(id)) yahooIds.set(id, [...(yahooIds.get(id) ?? []), row.yahoo_player_id]);
  }
  const rosteredOf = (nhlId: number) => {
    if (!rosteredFresh || !sources.rosterMap || !("rows" in sources.rosterMap)) return null;
    const values = new Set((yahooIds.get(nhlId) ?? []).flatMap(key => atLatest.has(key) ? [atLatest.get(key)!] : []));
    return values.size === 1 ? [...values][0] : null;
  };
  // TT-10: the latest game's line/pair and PP unit, from the rolling row and the PP rows already read (two-unit rule).
  const ppOf = ppEvidence(rowsOf(sources.ppc) ?? []), ppKnown = !!sources.ppc && "rows" in sources.ppc;
  const who = (nhlId: number): ShareTrendWho | null => {
    const name = names.get(nhlId), active = lists.active.get(nhlId);
    if (!name || !active) return null;
    const line = normalizeEvDeploymentBucket({ lineComboGroup: active.latest.line_combo_group, lineComboSlot: active.latest.line_combo_slot });
    return { nhlId, name: name.fullName, team: active.team, position: name.position, rostered: rosteredOf(nhlId), role: { line, pp: ppKnown ? ppOf(active.latest) : null } };
  };
  const shown = <T extends { nhlId: number }, R>(list: T[], size: number, make: (row: T, person: ShareTrendWho) => R) => list.flatMap(row => { const person = who(row.nhlId); return person ? [make(row, person)] : []; }).slice(0, size);
  // Sparklines (TT-4): per-game series for listed rows only, each checked against the row's own L5 window. A failed
  // or inconsistent series is omitted (null); it never blocks a section.
  const seriesRows = new Map<number, ShareSeriesRow[]>(), oldestGame = shiftDate(lists.today, -SERIES_LOOKBACK_DAYS);
  for (const row of rowsOf(sources.series) ?? []) {
    if (row.season !== context.season || row.strength_state !== "all" || !isDate(row.game_date) || row.game_date < oldestGame || row.game_date > lists.today) continue;
    seriesRows.set(row.player_id, [...(seriesRows.get(row.player_id) ?? []), row]);
  }
  const seriesFor = (nhlId: number, cumulative: (row: ShareSeriesRow) => number | null) => {
    const latest = lists.active.get(nhlId)?.latest, rows = seriesRows.get(nhlId);
    if (!latest || !rows || !num(latest.season_games_played) || !rows.some(row => row.game_date === latest.game_date && row.season_games_played === latest.season_games_played)) return null;
    return gameSeries(rows, latest.season_games_played, cumulative);
  };
  const pointsSeries = (nhlId: number) => {
    const values = seriesFor(nhlId, row => { const total = num(row.points_avg_season) && num(row.season_games_played) ? row.points_avg_season * row.season_games_played : null; return total !== null && Math.abs(total - Math.round(total)) <= 0.01 ? Math.round(total) : null; });
    const latest = lists.active.get(nhlId)!.latest, sum = (list: (number | null)[]) => complete(list) ? list.reduce((a, b) => a + b, 0) : null;
    if (!values || values.some(value => value !== null && value < 0)) return null;
    const last5 = sum(values.slice(-5)), last10 = sum(values);
    return (last5 !== null && last5 !== latest.points_total_last5) || (last10 !== null && last10 !== latest.points_total_last10) ? null : values;
  };
  const toiSeries = (nhlId: number) => {
    const values = seriesFor(nhlId, row => num(row.toi_seconds_avg_season) && num(row.season_games_played) ? row.toi_seconds_avg_season * row.season_games_played : null)?.map(value => value === null ? null : Math.round(value));
    const latest = lists.active.get(nhlId)!.latest, last5 = values?.slice(-5);
    if (!values || values.some(value => value !== null && value <= 0)) return null;
    return last5 && complete(last5) && num(latest.toi_seconds_avg_last5) && Math.abs(last5.reduce((a, b) => a + b, 0) / 5 - latest.toi_seconds_avg_last5) > 2 ? null : values;
  };
  const RATE_PARTS: Record<RateMetric, [keyof ShareSeriesRow, keyof ShareSeriesRow]> = { sogPer60: ["sog_per_60_shots_season", "sog_per_60_toi_seconds_season"],
    icfPer60: ["shot_attempts_per_60_shot_attempts_season", "shot_attempts_per_60_toi_seconds_season"], ixgPer60: ["ixg_per_60_ixg_season", "ixg_per_60_toi_seconds_season"] };
  const rateSeries = (nhlId: number, metric: RateMetric) => {
    const [part, seconds] = RATE_PARTS[metric], take = (key: keyof ShareSeriesRow) => (row: ShareSeriesRow) => num(row[key]) ? row[key] as number : null;
    const counts = seriesFor(nhlId, take(part)), tois = seriesFor(nhlId, take(seconds)), latest = lists.active.get(nhlId)!.latest, l5 = latest[RATE_COLUMNS[metric][0]];
    if (!counts || !tois) return null;
    const c5 = counts.slice(-5), t5 = tois.slice(-5);
    if (complete(c5) && complete(t5) && num(l5)) { const sum = (list: number[]) => list.reduce((a, b) => a + b, 0), rate = sum(c5) / sum(t5) * 3600; if (Math.abs(rate - l5) > Math.max(0.02 * l5, 0.05)) return null; }
    return counts.map((count, index) => count === null || tois[index] === null || tois[index]! <= 0 || count < 0 ? null : round(count / tois[index]! * 3600, RATE_DIGITS[metric]));
  };
  const seriesDates = ownershipSeriesDates(lists.previousDate, lists.latestDate), seriesObs = new Map<string, number>();
  for (const row of rowsOf(sources.ownershipSeries) ?? []) if (num(row.ownership_pct) && row.ownership_pct >= 0 && row.ownership_pct <= 100) seriesObs.set(`${row.player_key}|${row.ownership_date}`, round(row.ownership_pct, 1));
  const moverSeries = (row: { key: string; latest: number; previous: number }) => {
    if (!seriesDates || !sources.ownershipSeries || !("rows" in sources.ownershipSeries)) return null;
    const values = seriesDates.map(date => seriesObs.get(`${row.key}|${date}`) ?? null);
    return values[0] === row.previous && values[values.length - 1] === row.latest ? values : null;
  };
  const seriesNote = sources.series && "failed" in sources.series ? [`Sparklines unavailable: ${sources.series.failed}`] : [];
  const metricsGate = lists.skaters && lists.skaters.state !== "ready" ? { state: lists.skaters.state, reasons: lists.skaters.reasons } : lists.skaters ? { state: "ready" as const, reasons: lists.skaters.reasons } : null;

  const hotState = section([sources.rolling, sources.players], ["Rolling game metrics", "Player names"], metricsGate);
  const hotReady = hotState.state === "ready";
  const hotRow = (row: TrendShortlists["hot"][number], person: ShareTrendWho): ShareHotRow => ({ ...person, lastGame: row.lastGame, recent: row.recent, preceding: row.preceding, delta: row.delta, series: pointsSeries(row.nhlId) });

  const ratesState = section([sources.rolling, sources.players], ["Rolling game metrics", "Player names"], metricsGate), ratesReady = ratesState.state === "ready";

  const deployState = section([sources.rolling, sources.ppc, sources.ev, sources.players], ["Rolling game metrics", "Power-play combinations", "Even-strength rolling rows", "Player names"], metricsGate);
  const deployReady = deployState.state === "ready", ev = new Map((rowsOf(sources.ev) ?? []).filter(row => row.season === context.season && row.strength_state === "ev").map(row => [`${row.player_id}|${row.game_date}`, row]));
  const deployRow = (row: TrendShortlists["up"][number], person: ShareTrendWho): ShareDeploymentRow => {
    const even = ev.get(`${row.nhlId}|${row.lastGame}`);
    return { ...person, lastGame: row.lastGame, toi: row.toi, delta: row.delta, driver: row.driver, pp: row.pp, line: row.line, ppUnit: row.ppUnit, teamChange: row.teamChange, lineChange: row.lineChange, ppChange: row.ppChange,
      ev: { l5: even && num(even.toi_seconds_avg_last5) ? Math.round(even.toi_seconds_avg_last5) : null, season: even && num(even.toi_seconds_avg_season) ? Math.round(even.toi_seconds_avg_season) : null }, series: toiSeries(row.nhlId) };
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
  const moverRow = (row: TrendShortlists["risers"][number], person: ShareTrendWho): ShareMoverRow => ({ ...person, rostered: row.latest, latest: row.latest, previous: row.previous, delta: row.delta, series: moverSeries(row) });

  return { ...base, metricsThrough: lists.skaters?.through ?? null, metricsUpdatedAt: lists.skaters?.updatedAt ?? null,
    ownershipLatestDate: lists.latestDate, ownershipPreviousDate: lists.previousDate, ownershipSeriesDates: seriesDates, rosteredAsOf: rosteredFresh ? lists.latestDate : null,
    sections: {
      hot: { ...hotState, reasons: [...hotState.reasons, ...(hotReady ? seriesNote : [])], rule: RECENT_FORM_RULE, qualifiers: hotReady ? lists.formQualifiers : 0, hot: hotReady ? shown(lists.hot, TREND_LIST, hotRow) : [], cold: hotReady ? shown(lists.cold, TREND_LIST, hotRow) : [] },
      deployment: { ...deployState, reasons: [...deployState.reasons, ...(deployReady ? seriesNote : [])], up: deployReady ? shown(lists.up, DEPLOYMENT_LIST, deployRow) : [], down: deployReady ? shown(lists.down, DEPLOYMENT_LIST, deployRow) : [] },
      rates: { ...ratesState, reasons: [...ratesState.reasons, ...(ratesReady ? seriesNote : [])], ...Object.fromEntries(RATE_METRICS.map(metric => [metric, ratesReady ? shown(lists.rates[metric], RATE_LIST, (row, person): ShareRateRow => ({ ...person, l5: row.l5, season: row.season, delta: row.delta, l5Minutes: row.l5Minutes, series: rateSeries(row.nhlId, metric) })) : []])) as Record<RateMetric, ShareRateRow[]> },
      movers: { ...moversState, reasons: [...moversState.reasons, ...(moversReady && sources.ownershipSeries && "failed" in sources.ownershipSeries ? [`Sparklines unavailable: ${sources.ownershipSeries.failed}`] : [])], risers: moversReady ? shown(lists.risers, TREND_LIST, moverRow) : [], fallers: moversReady ? shown(lists.fallers, TREND_LIST, moverRow) : [] },
    } };
}

/** Section definitions (CONTRACT.md), printed in each card footer. */
export const trendDefinitions: Record<ShareTrendKind, string[]> = {
  hot: [`Hot/Cold (${RECENT_FORM_RULE}): P/GP last ${TREND_WINDOW_GAMES} appearances vs the ${TREND_WINDOW_GAMES} before`, `All ${RECENT_FORM_GAMES} this season · last game ≤ ${TREND_MAX_GAME_AGE_DAYS} days · Early season · small sample`],
  deployment: [`TOI/GP L${TREND_WINDOW_GAMES} / season: all · EV · PP`, "Line & PP unit: last game vs the game before", `Column: TOI change ±${MIN_DEPLOYMENT_TOI_DELTA_SECONDS / 60}:00+ by its sign, else line/PP direction · PP ? = unknown`],
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

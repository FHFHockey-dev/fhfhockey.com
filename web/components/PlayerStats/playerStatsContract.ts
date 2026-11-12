// Shared data contract for the player stats page tabs: dates, season scope,
// played/missed/future denominators, summary aggregation and units. Every tab
// reads the same game log through these helpers so their figures agree.
import {
  formatStatValue,
  MissedGame,
  PER_60_STATS,
  PER_GAME_STATS,
  PERCENTAGE_STATS,
  TimeFrame
} from "./types";

type DatedRow = { date: string; [key: string]: any };

// NHL schedule dates are league-local (Eastern) calendar days.
export const LEAGUE_TIME_ZONE = "America/New_York";

export function leagueDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

/** Parse "YYYY-MM-DD" as a local calendar day (new Date() would use UTC). */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

const dateKey = (dateString: string) => dateString.slice(0, 10);

/** Season of a game date; July starts a new season (covers September openers). */
export function seasonIdForDate(dateString: string): number {
  const [year, month] = dateString.slice(0, 7).split("-").map(Number);
  const startYear = month >= 7 ? year : year - 1;
  return startYear * 10000 + startYear + 1;
}

/**
 * Inclusive date window for a season. Provider rows can carry a wrong
 * season_id, so season reads are bounded by date as well. Uses the seasons
 * table row when present, else Sep 1 (start year) through Aug 31 (end year).
 */
export function seasonDateWindow(
  seasonId: string | number | null | undefined,
  seasonRow?: { startDate?: string | null; endDate?: string | null } | null
): { start: string; end: string } | null {
  const id = String(seasonId ?? "");
  if (!/^\d{8}$/.test(id)) return null;
  const startYear = Number(id.slice(0, 4));
  const endYear = Number(id.slice(4));
  if (endYear !== startYear + 1) return null;
  if (seasonRow?.startDate && seasonRow?.endDate) {
    return { start: dateKey(seasonRow.startDate), end: dateKey(seasonRow.endDate) };
  }
  return { start: `${startYear}-09-01`, end: `${endYear}-08-31` };
}

/**
 * The server already scopes the logs to the page season (season_id and date), so only
 * a different season falls back to date inference.
 */
export function scopeLogToSeason<T extends DatedRow>(
  rows: T[],
  seasonId: string | number | null | undefined,
  pageSeasonId: string | number | null | undefined
): T[] {
  if (!seasonId) return rows;
  if (pageSeasonId && String(seasonId) === String(pageSeasonId)) return rows;
  return rows.filter(
    (row) => !!row.date && String(seasonIdForDate(row.date)) === String(seasonId)
  );
}

export function sortGameLogAscending<T extends DatedRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    dateKey(a.date).localeCompare(dateKey(b.date))
  );
}

/** Latest N games of an ascending log. */
export function windowGameLog<T extends DatedRow>(
  ascendingRows: T[],
  timeFrame: TimeFrame
): T[] {
  if (timeFrame === "season" || timeFrame === "custom") return ascendingRows;
  const games = timeFrame === "last10" ? 10 : timeFrame === "last20" ? 20 : 30;
  return ascendingRows.slice(-games);
}

export const isAppearance = (row: Record<string, any>) =>
  Number(row.games_played) > 0;

export function countAppearances(rows: Record<string, any>[]): number {
  return rows.filter(isAppearance).length;
}

/**
 * Split the team schedule rows the server returns (past games without an
 * appearance plus future games) into elapsed absences, upcoming games and
 * unconfirmed games. A game on or after the as-of date is never an absence,
 * and neither is a past game whose box score has not been loaded for the
 * player's team (a missing provider row is not proof the player sat out).
 * `windowStartDate` limits past games to the selected game window.
 */
export function splitTeamSchedule(
  scheduleGames: MissedGame[] | null | undefined,
  asOfDate: string,
  windowStartDate: string | null = null
): { absences: MissedGame[]; upcoming: MissedGame[]; unconfirmed: MissedGame[] } {
  const absences: MissedGame[] = [];
  const upcoming: MissedGame[] = [];
  const unconfirmed: MissedGame[] = [];
  for (const game of scheduleGames ?? []) {
    const key = dateKey(game.date);
    if (game.isFuture || key >= asOfDate) {
      upcoming.push(game);
    } else if (windowStartDate && key < windowStartDate) {
      continue;
    } else if (game.isUnconfirmed) {
      unconfirmed.push(game);
    } else {
      absences.push(game);
    }
  }
  return { absences, upcoming, unconfirmed };
}

export interface Availability {
  played: number;
  missed: number | null;
  possible: number | null;
  percentage: number | null;
  // Past regular-season team games still awaiting a box score.
  unconfirmed: number | null;
}

/** Regular-season availability: appearances over elapsed eligible team games. */
export function computeAvailability(
  gameLog: Record<string, any>[],
  scheduleGames: MissedGame[] | null | undefined,
  asOfDate: string,
  windowStartDate: string | null = null
): Availability {
  const played = countAppearances(gameLog);
  if (scheduleGames == null) {
    return {
      played,
      missed: null,
      possible: null,
      percentage: null,
      unconfirmed: null
    };
  }
  const split = splitTeamSchedule(scheduleGames, asOfDate, windowStartDate);
  const missed = split.absences.filter((game) => !game.isPlayoff).length;
  const possible = played + missed;
  return {
    played,
    missed,
    possible,
    percentage: possible > 0 ? (played / possible) * 100 : null,
    unconfirmed: split.unconfirmed.filter((game) => !game.isPlayoff).length
  };
}

/** First date of a windowed log, or null for the full season. */
export function windowStartDate(
  ascendingWindow: DatedRow[],
  timeFrame: TimeFrame
): string | null {
  if (timeFrame === "season" || ascendingWindow.length === 0) return null;
  return dateKey(ascendingWindow[0].date);
}

const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Goalie primitives come from numeric WGO fields. Do not infer missing counts
// or parse a formatted clock as elapsed seconds.
const goalieNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;

export function summarizeQualityStarts(log: DatedRow[]): {
  starts: number;
  classifiedStarts: number;
  unknownStarts: number;
  rate: number | null;
} {
  let starts = 0;
  let classifiedStarts = 0;
  let qualityStarts = 0;
  let unknownStarts = 0;
  for (const row of log) {
    const played = goalieNumber(row.games_played);
    if (played === 0) continue;
    const started = goalieNumber(row.games_started);
    if (played === null || (started !== 0 && started !== 1)) {
      unknownStarts += 1;
      continue;
    }
    if (started === 0) continue;
    starts += 1;
    const classification = goalieNumber(row.quality_start);
    if (classification === 0 || classification === 1) {
      classifiedStarts += 1;
      qualityStarts += classification;
    }
  }
  return {
    starts,
    classifiedStarts,
    unknownStarts,
    rate: unknownStarts === 0 && starts > 0 && classifiedStarts === starts
      ? qualityStarts / starts
      : null
  };
}

// --- Pooled window stats ------------------------------------------------------
// Rates and shares over several games are pooled from source-matched
// primitives (rule 26): per-60 = Σcount × 3600 / ΣTOI seconds, a share =
// Σpart / Σdenominator. Primitives are carried by `mergeNstGameRow` (NST,
// `nst_` individual and `nst_oi_` on-ice) or selected from WGO.
type Sums = Record<string, number>;
interface PooledStat {
  fields: string[];
  pool: (sums: Sums) => number | null;
}

const per60 = (count: string, toi: string): PooledStat => ({
  fields: [count, toi],
  pool: (s) => (s[toi] > 0 ? (s[count] * 3600) / s[toi] : null)
});
/** part / (part + others) × scale */
const share = (part: string, others: string[], scale: number): PooledStat => ({
  fields: [part, ...others],
  pool: (s) => {
    const denominator = others.reduce((sum, key) => sum + s[key], s[part]);
    return denominator > 0 ? (s[part] / denominator) * scale : null;
  }
});
const ratio = (numerator: string, denominator: string, scale: number): PooledStat => ({
  fields: [numerator, denominator],
  pool: (s) => (s[denominator] > 0 ? (s[numerator] / s[denominator]) * scale : null)
});
const onIceSave = (scale: number) => (s: Sums) =>
  s.nst_oi_sa > 0 ? ((s.nst_oi_sa - s.nst_oi_ga) / s.nst_oi_sa) * scale : null;

const individualPer60 = (count: string) => per60(`nst_${count}`, "nst_toi");
const onIcePer60 = (count: string) => per60(`nst_oi_${count}`, "nst_oi_toi");
const onIceShare = (forKey: string, againstKey: string) =>
  share(`nst_oi_${forKey}`, [`nst_oi_${againstKey}`], 100);

export const POOLED_STATS: Record<string, PooledStat> = {
  // WGO (fractions)
  shooting_percentage: ratio("goals", "shots", 1),
  fow_percentage: share("total_fow", ["total_fol"], 1),
  // NST individual per 60
  goals_per_60: individualPer60("goals"),
  total_assists_per_60: individualPer60("total_assists"),
  first_assists_per_60: individualPer60("first_assists"),
  second_assists_per_60: individualPer60("second_assists"),
  total_points_per_60: individualPer60("total_points"),
  shots_per_60: individualPer60("shots"),
  ixg_per_60: individualPer60("ixg"),
  icf_per_60: individualPer60("icf"),
  iff_per_60: individualPer60("iff"),
  iscfs_per_60: individualPer60("iscfs"),
  hdcf_per_60: individualPer60("hdcf"),
  rush_attempts_per_60: individualPer60("rush_attempts"),
  rebounds_created_per_60: individualPer60("rebounds_created"),
  shots_blocked_per_60: individualPer60("shots_blocked"),
  pim_per_60: individualPer60("pim"),
  total_penalties_per_60: individualPer60("total_penalties"),
  penalties_drawn_per_60: individualPer60("penalties_drawn"),
  giveaways_per_60: individualPer60("giveaways"),
  takeaways_per_60: individualPer60("takeaways"),
  hits_per_60: individualPer60("hits"),
  // Drawn minus taken; may be negative, so it is not a plain per60().
  penalty_differential_per_60: {
    fields: ["nst_penalties_drawn", "nst_total_penalties", "nst_toi"],
    pool: (s) =>
      s.nst_toi > 0
        ? ((s.nst_penalties_drawn - s.nst_total_penalties) * 3600) / s.nst_toi
        : null
  },
  // NST on-ice per 60
  hdca_per_60: onIcePer60("hdca"),
  sca_per_60: onIcePer60("sca"),
  xga_per_60: onIcePer60("xga"),
  ga_per_60: onIcePer60("ga"),
  on_ice_goals_per_60: onIcePer60("gf"),
  on_ice_goals_against_per_60: onIcePer60("ga"),
  on_ice_shots_per_60: onIcePer60("sf"),
  on_ice_shots_against_per_60: onIcePer60("sa"),
  on_ice_cf_per_60: onIcePer60("cf"),
  on_ice_ca_per_60: onIcePer60("ca"),
  on_ice_ff_per_60: onIcePer60("ff"),
  on_ice_fa_per_60: onIcePer60("fa"),
  on_ice_xgf_per_60: onIcePer60("xgf"),
  on_ice_xga_per_60: onIcePer60("xga"),
  // NST on-ice shares (percentage points)
  cf_pct: onIceShare("cf", "ca"),
  ff_pct: onIceShare("ff", "fa"),
  sf_pct: onIceShare("sf", "sa"),
  gf_pct: onIceShare("gf", "ga"),
  xgf_pct: onIceShare("xgf", "xga"),
  scf_pct: onIceShare("scf", "sca"),
  hdcf_pct: onIceShare("hdcf", "hdca"),
  mdcf_pct: onIceShare("mdcf", "mdca"),
  ldcf_pct: onIceShare("ldcf", "ldca"),
  on_ice_cf_pct: onIceShare("cf", "ca"),
  on_ice_ff_pct: onIceShare("ff", "fa"),
  on_ice_sf_pct: onIceShare("sf", "sa"),
  on_ice_gf_pct: onIceShare("gf", "ga"),
  on_ice_xgf_pct: onIceShare("xgf", "xga"),
  on_ice_scf_pct: onIceShare("scf", "sca"),
  on_ice_hdcf_pct: onIceShare("hdcf", "hdca"),
  // NST zone usage: OZS% = OZ / (OZ + DZ) (decision 9); DZS% and NZS% are
  // shares of all starts, as the page merge defines them per game.
  off_zone_start_pct: share("nst_oi_off_zone_starts", ["nst_oi_def_zone_starts"], 100),
  def_zone_start_pct: share(
    "nst_oi_def_zone_starts",
    ["nst_oi_off_zone_starts", "nst_oi_neu_zone_starts"],
    100
  ),
  neu_zone_start_pct: share(
    "nst_oi_neu_zone_starts",
    ["nst_oi_off_zone_starts", "nst_oi_def_zone_starts"],
    100
  ),
  off_zone_faceoff_pct: share("nst_oi_off_zone_faceoffs", ["nst_oi_def_zone_faceoffs"], 100),
  // NST on-ice impact
  on_ice_sh_pct: ratio("nst_oi_gf", "nst_oi_sf", 100),
  on_ice_sv_pct: { fields: ["nst_oi_sa", "nst_oi_ga"], pool: onIceSave(100) },
  pdo: {
    fields: ["nst_oi_gf", "nst_oi_sf", "nst_oi_sa", "nst_oi_ga"],
    pool: (s) => {
      const save = onIceSave(1)(s);
      return s.nst_oi_sf > 0 && save !== null ? s.nst_oi_gf / s.nst_oi_sf + save : null;
    }
  }
};

/**
 * Pool one stat over every row of a window. Every row must carry every
 * primitive as a finite, non-negative number; otherwise the window is
 * incomplete and the result is null (never a silently smaller sample).
 */
function poolStat(log: DatedRow[], spec: PooledStat): number | null {
  if (log.length === 0) return null;
  const sums: Sums = Object.fromEntries(spec.fields.map((field) => [field, 0]));
  for (const row of log) {
    for (const field of spec.fields) {
      const n = finite(row[field]);
      if (n === null || n < 0) return null;
      sums[field] += n;
    }
  }
  return spec.pool(sums);
}

/** Values of one stat over a window, or null if any row lacks it. */
function completeValues(log: DatedRow[], stat: string): number[] | null {
  const values: number[] = [];
  for (const row of log) {
    const n = finite(row[stat]);
    if (n === null) return null;
    values.push(n);
  }
  return values;
}

const isPercentStat = (stat: string) =>
  (PERCENTAGE_STATS as readonly string[]).includes(stat);
const isRateStat = (stat: string) =>
  (PER_60_STATS as readonly string[]).includes(stat);

/**
 * Aggregate one stat over a log (the caller passes appearances). Rates and
 * shares pool their primitives; counts sum; per-game stats (TOI per game)
 * average per appearance. A window with any missing value is null, never a
 * smaller sample, and a zero denominator is null. A rate or share without
 * declared primitives is only shown for a single game.
 */
export function aggregateSummaryStat(
  log: DatedRow[],
  stat: string
): number | null {
  if (stat === "save_pct" || stat === "goals_against_avg") {
    let numerator = 0;
    let denominator = 0;
    for (const row of log) {
      const top = goalieNumber(row[stat === "save_pct" ? "saves" : "goals_against"]);
      const bottom = goalieNumber(row[stat === "save_pct" ? "shots_against" : "time_on_ice"]);
      if (top === null || bottom === null || !Number.isInteger(top)) return null;
      if (stat === "save_pct" && (!Number.isInteger(bottom) || top > bottom)) return null;
      if (bottom === 0 && top > 0) return null;
      numerator += top;
      denominator += bottom;
    }
    // WGO time_on_ice is numeric seconds; never infer 60 minutes per appearance.
    return denominator > 0 ? numerator * (stat === "save_pct" ? 1 : 3600) / denominator : null;
  }
  const pooled = POOLED_STATS[stat];
  if (pooled) return poolStat(log, pooled);

  const values = completeValues(log, stat);
  if (!values || values.length === 0) return null;

  if (isPercentStat(stat) || isRateStat(stat)) {
    // No declared primitives: a mean of game rates is not the window rate.
    return values.length === 1 ? values[0] : null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  // Mean per appearance is right for per-game stats (TOI per game); not TOI-weighted.
  return (PER_GAME_STATS as readonly string[]).includes(stat)
    ? total / values.length
    : total;
}

/**
 * The window value the chart plots: pooled rates and shares, and the
 * per-game average for counts and per-game stats. Null when incomplete.
 */
export function windowRate(log: DatedRow[], stat: string): number | null {
  const value = aggregateSummaryStat(log, stat);
  if (value === null) return null;
  if (
    POOLED_STATS[stat] ||
    stat === "save_pct" ||
    stat === "goals_against_avg" ||
    isPercentStat(stat) ||
    isRateStat(stat) ||
    (PER_GAME_STATS as readonly string[]).includes(stat)
  ) {
    return value;
  }
  return value / log.length;
}

// NHL-API (WGO) percentages are stored as fractions; NST percentages are
// already percentage points. The shared formatter expects percentage points.
export const FRACTION_PERCENT_STATS = [
  "shooting_percentage",
  "fow_percentage",
  "sat_pct",
  "usat_pct",
  "zone_start_pct",
  "on_ice_shooting_pct"
] as const;

const isFractionStat = (stat: string) =>
  (FRACTION_PERCENT_STATS as readonly string[]).includes(stat);

/** Value in the unit the shared thresholds and formatters use. */
export function toDisplayUnits(value: unknown, stat: string): number | null {
  const n = finite(value);
  if (n === null) return null;
  return isFractionStat(stat) ? n * 100 : n;
}

// Per-game and season counts. The shared formatter shows two decimals (it is
// built for averages), so whole counts are shown as integers here.
const COUNT_STATS = new Set([
  "goals",
  "assists",
  "points",
  "shots",
  "pp_points",
  "gw_goals",
  "hits",
  "blocked_shots",
  "takeaways",
  "giveaways",
  "plus_minus",
  "wins",
  "losses",
  "ot_losses",
  "shutouts",
  "saves",
  "shots_against",
  "goals_against",
  "games_started"
]);

export function formatPlayerStat(value: unknown, stat: string): string {
  const n = toDisplayUnits(value, stat);
  if (n === null) return "-";
  if (COUNT_STATS.has(stat) && Number.isInteger(n)) return String(n);
  if (stat === "usat_pct") return `${n.toFixed(1)}%`;
  return formatStatValue(n, stat);
}

// --- Chart units ------------------------------------------------------------
// Stats on different scales never share an axis: counts, rates (per 60 / per
// game / indexes), percentages on 0-100, and time on ice in minutes.
export type ChartUnit = "count" | "rate" | "percent" | "toi";

export const CHART_UNIT_ORDER: ChartUnit[] = ["count", "rate", "percent", "toi"];

export const CHART_UNIT_META: Record<ChartUnit, { label: string; axis: string }> = {
  count: { label: "Counts", axis: "Per game" },
  rate: { label: "Rates", axis: "Per 60 / per game" },
  percent: { label: "Percentages", axis: "%" },
  toi: { label: "Time on ice", axis: "Minutes" }
};

const TOI_STATS = new Set(["toi_per_game", "pp_toi_per_game", "time_on_ice"]);
// PDO is an index around 100 (or 1.0), not a share, so it is not on 0-100.
const NOT_PERCENT = new Set(["pdo"]);

export function statChartUnit(stat: string): ChartUnit {
  if (TOI_STATS.has(stat)) return "toi";
  if (
    (PERCENTAGE_STATS as readonly string[]).includes(stat) &&
    !NOT_PERCENT.has(stat)
  ) {
    return "percent";
  }
  if (
    NOT_PERCENT.has(stat) ||
    (PER_60_STATS as readonly string[]).includes(stat) ||
    (PER_GAME_STATS as readonly string[]).includes(stat)
  ) {
    return "rate";
  }
  return "count";
}

/** Selected stats grouped by unit, in a fixed panel order; empty groups dropped. */
export function groupStatsByUnit(
  stats: string[]
): { unit: ChartUnit; stats: string[] }[] {
  return CHART_UNIT_ORDER.map((unit) => ({
    unit,
    stats: stats.filter((stat) => statChartUnit(stat) === unit)
  })).filter((group) => group.stats.length > 0);
}

/** Value in its chart unit: percentage points, minutes, or as stored. */
export function toChartValue(value: unknown, stat: string): number | null {
  const n = finite(value);
  if (n === null) return null;
  const unit = statChartUnit(stat);
  if (unit === "toi") return n / 60;
  if (unit === "percent") {
    return stat === "save_pct" ? n * 100 : toDisplayUnits(n, stat);
  }
  return n;
}

export function formatMinutes(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Trailing rolling window value (`windowRate`): rates pooled by TOI, shares
 * by their denominators, counts averaged per game. A window with any missing
 * value is a gap (null), never a smaller sample or zero.
 */
export function rollingAverage(
  rows: DatedRow[],
  stat: string,
  size = 5
): (number | null)[] {
  return rows.map((_, index) =>
    windowRate(rows.slice(Math.max(0, index - size + 1), index + 1), stat)
  );
}

export const SEASON_INDEX_WINDOW = 5;

/**
 * "Relative to season average": each game's trailing 5-game value as a
 * percentage of the same quantity over the season (100 = season level):
 * pooled window rate ÷ pooled season rate for rates and shares, per-game
 * averages for counts. Drawn only once 5 games have been played; an
 * incomplete window is a gap, and an incomplete or zero season value has no
 * baseline.
 */
export function seasonIndexSeries(
  seasonRows: DatedRow[],
  stat: string,
  window = SEASON_INDEX_WINDOW
): (number | null)[] {
  const seasonValue = windowRate(seasonRows, stat);
  if (!seasonValue) return seasonRows.map(() => null);
  return rollingAverage(seasonRows, stat, window).map((value, index) =>
    index < window - 1 || value === null ? null : (value / seasonValue) * 100
  );
}

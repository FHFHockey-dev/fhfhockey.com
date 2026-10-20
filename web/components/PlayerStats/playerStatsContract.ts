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

// Ratios rebuilt from summed components rather than averaged per game.
const RATIO_COMPONENTS: Record<string, [string, string]> = {
  shooting_percentage: ["goals", "shots"],
  save_pct: ["saves", "shots_against"]
};

/**
 * Aggregate one stat over a log. Missing values are skipped, never counted as
 * zero; a stat with no usable values (or a zero denominator) is null.
 */
export function aggregateSummaryStat(
  log: DatedRow[],
  stat: string
): number | null {
  const ratio = RATIO_COMPONENTS[stat];
  if (ratio) {
    let numerator = 0;
    let denominator = 0;
    for (const row of log) {
      const top = finite(row[ratio[0]]);
      const bottom = finite(row[ratio[1]]);
      if (top === null || bottom === null) continue;
      numerator += top;
      denominator += bottom;
    }
    return denominator > 0 ? numerator / denominator : null;
  }

  const rows = log
    .map((row) => ({ value: finite(row[stat]), row }))
    .filter((entry): entry is { value: number; row: DatedRow } => entry.value !== null);
  if (rows.length === 0) return null;

  if ((PERCENTAGE_STATS as readonly string[]).includes(stat)) {
    // Games-weighted mean; no shared denominator columns are loaded for these.
    let weighted = 0;
    let weight = 0;
    for (const { value, row } of rows) {
      const w = Number(row.games_played) > 0 ? Number(row.games_played) : 1;
      weighted += value * w;
      weight += w;
    }
    return weighted / weight;
  }

  if (
    (PER_60_STATS as readonly string[]).includes(stat) ||
    (PER_GAME_STATS as readonly string[]).includes(stat)
  ) {
    return rows.reduce((sum, { value }) => sum + value, 0) / rows.length;
  }

  return rows.reduce((sum, { value }) => sum + value, 0);
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
 * Trailing rolling average over the values present in each window; a window
 * with no values is a gap (null), never zero.
 */
export function rollingAverage(
  rows: DatedRow[],
  stat: string,
  size = 5
): (number | null)[] {
  return rows.map((_, index) => {
    const values = rows
      .slice(Math.max(0, index - size + 1), index + 1)
      .map((row) => finite(row[stat]))
      .filter((value): value is number => value !== null);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  });
}

export const SEASON_INDEX_WINDOW = 5;

/**
 * "Relative to season average": each game's trailing 5-game average as a
 * percentage of the player's season average for that stat (100 = season
 * average). Drawn only once 5 games have been played; missing values are
 * gaps, and a season average of 0 (or none) has no baseline.
 */
export function seasonIndexSeries(
  seasonRows: DatedRow[],
  stat: string,
  window = SEASON_INDEX_WINDOW
): (number | null)[] {
  const present = seasonRows
    .map((row) => finite(row[stat]))
    .filter((value): value is number => value !== null);
  const seasonAverage = present.length
    ? present.reduce((sum, value) => sum + value, 0) / present.length
    : null;
  if (!seasonAverage) return seasonRows.map(() => null);
  return rollingAverage(seasonRows, stat, window).map((average, index) =>
    index < window - 1 || average === null
      ? null
      : (average / seasonAverage) * 100
  );
}

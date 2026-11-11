import {
  computeRatioValue,
  type RatioComponentTotals
} from "lib/supabase/Upserts/rollingMetricAggregation";
import {
  isRollingRatioMetricKey,
  ROLLING_RATIO_METRIC_SPECS
} from "lib/supabase/Upserts/rollingRatioMetricSpecs";

/**
 * Explicit count support for rolling windows (W1 P0 #10, W2-P0-11, W3-6 N1).
 *
 * The wide `*_total_lastN` columns of ratio and per-60 metrics hold the RATE,
 * not a count. Readers that need counts (goals, ixG, on-ice counts, TOI
 * seconds) read this versioned object from
 * `rolling_player_metric_support_payloads.support_payload.windowCountSupport`
 * instead of inferring counts from rate aliases.
 *
 * Contract (version `rolling-player-window-counts-v1`):
 * - `windows.lastN.gameIds` / `gameDates`: the exact appearance window (the
 *   player's last N chronological appearances in this strength state, across
 *   seasons), the same membership the `<metric>_lastN` ratio fields use.
 * - `windows.lastN.ratio[metric] = [numerator, denominator, observations]`:
 *   components summed over the games in that window where both were known
 *   (rule 13). `observations < appearances` means a covered subset (rule 22);
 *   a reader that needs the full window must treat it as unknown.
 *   Per-60 metrics: numerator is the count, denominator is TOI seconds
 *   (rate = numerator × 3600 ÷ denominator). Percentages: numerator over its
 *   denominator (for example goals over shots, ixG over unblocked attempts).
 *   `pdo` stores on-ice goals for over shots for in `ratio` and on-ice saves
 *   over shots against in `secondary`.
 * - `game`: this row's own game components, so calendar windows (decision 18)
 *   pool exactly the games inside the dates.
 */
export const ROLLING_WINDOW_COUNT_SUPPORT_VERSION =
  "rolling-player-window-counts-v1" as const;

export const WINDOW_COUNT_SUPPORT_WINDOWS = [5, 10, 20] as const;
export type WindowCountSupportWindow =
  (typeof WINDOW_COUNT_SUPPORT_WINDOWS)[number];

/** [numerator, denominator, secondaryNumerator, secondaryDenominator] */
export type RatioComponentTuple = [number, number, number, number];
/** [numerator, denominator, observations] */
export type WindowRatioCounts = [number, number, number];

export type RollingWindowCountSupport = {
  version: typeof ROLLING_WINDOW_COUNT_SUPPORT_VERSION;
  strengthState: string;
  anchor: { gameId: number | null; gameDate: string; season: number };
  selection: "chronological_appearances_in_strength_state";
  game: {
    appeared: boolean;
    ratio: Record<string, RatioComponentTuple | null>;
    additive: Record<string, number | null>;
  };
  windows: Record<
    `last${WindowCountSupportWindow}`,
    {
      appearances: number;
      gameIds: Array<number | null>;
      gameDates: string[];
      ratio: Record<string, WindowRatioCounts>;
      secondary: Record<string, [number, number]>;
    }
  >;
};

export type AppearanceRef = { gameId: number | null; gameDate: string };

function round6(value: number): number {
  return Number(value.toFixed(6));
}

export function buildRollingWindowCountSupport(args: {
  strengthState: string;
  anchor: RollingWindowCountSupport["anchor"];
  appeared: boolean;
  gameRatio: Record<string, RatioComponentTuple | null>;
  gameAdditive: Record<string, number | null>;
  /** Chronological appearances so far, oldest first. */
  appearances: AppearanceRef[];
  windowComponents: Record<
    string,
    Record<WindowCountSupportWindow, RatioComponentTotals>
  >;
}): RollingWindowCountSupport {
  const windows = {} as RollingWindowCountSupport["windows"];
  for (const size of WINDOW_COUNT_SUPPORT_WINDOWS) {
    const members = args.appearances.slice(-size);
    const ratio: Record<string, WindowRatioCounts> = {};
    const secondary: Record<string, [number, number]> = {};
    for (const [metricKey, bySize] of Object.entries(args.windowComponents)) {
      const totals = bySize[size];
      if (!totals || totals.count <= 0) continue;
      ratio[metricKey] = [
        round6(totals.numerator),
        round6(totals.denominator),
        totals.count
      ];
      if (totals.secondaryDenominator > 0) {
        secondary[metricKey] = [
          round6(totals.secondaryNumerator),
          round6(totals.secondaryDenominator)
        ];
      }
    }
    windows[`last${size}`] = {
      appearances: members.length,
      gameIds: members.map((member) => member.gameId),
      gameDates: members.map((member) => member.gameDate),
      ratio,
      secondary
    };
  }

  return {
    version: ROLLING_WINDOW_COUNT_SUPPORT_VERSION,
    strengthState: args.strengthState,
    anchor: args.anchor,
    selection: "chronological_appearances_in_strength_state",
    game: {
      appeared: args.appeared,
      ratio: args.gameRatio,
      additive: args.gameAdditive
    },
    windows
  };
}

/** The per-game part a reader needs; null for unversioned or missing data. */
export function readWindowCountSupportGame(
  value: unknown
): RollingWindowCountSupport["game"] | null {
  const support = value as Partial<RollingWindowCountSupport> | null;
  if (
    !support ||
    support.version !== ROLLING_WINDOW_COUNT_SUPPORT_VERSION ||
    !support.game ||
    typeof support.game.appeared !== "boolean"
  ) {
    return null;
  }
  return support.game;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type CalendarWindowResult = {
  value: number | null;
  /** Appearances dated inside the window. */
  games: number;
  /** Appearances inside the window whose components were known. */
  observations: number;
  /** Rows inside the window written before window counts existed. */
  unsupportedRows: number;
};

/**
 * "Last 7/14/30 days" (decision 18): calendar days ending `todayIso`
 * (inclusive), pooled from each game's components. Counts give the mean per
 * game over the known games; ratios pool numerators and denominators. A
 * window with any unknown game is a covered subset: `observations < games`.
 */
export function poolCalendarWindow(
  rows: Array<{ gameDate: string; game: RollingWindowCountSupport["game"] | null }>,
  metricKey: string,
  options: { todayIso: string; days: number }
): CalendarWindowResult {
  const startIso = shiftIsoDate(options.todayIso, -(options.days - 1));
  const inWindow = rows.filter(
    (row) => row.gameDate >= startIso && row.gameDate <= options.todayIso
  );
  const unsupportedRows = inWindow.filter((row) => row.game == null).length;
  const appeared = inWindow.filter((row) => row.game?.appeared);
  const games = appeared.length;

  if (isRollingRatioMetricKey(metricKey)) {
    const totals: RatioComponentTotals = {
      numerator: 0,
      denominator: 0,
      secondaryNumerator: 0,
      secondaryDenominator: 0,
      count: 0
    };
    for (const row of appeared) {
      const tuple = row.game?.ratio[metricKey];
      if (!tuple) continue;
      totals.numerator += tuple[0];
      totals.denominator += tuple[1];
      totals.secondaryNumerator += tuple[2];
      totals.secondaryDenominator += tuple[3];
      totals.count += 1;
    }
    return {
      value:
        totals.count > 0
          ? computeRatioValue(totals, ROLLING_RATIO_METRIC_SPECS[metricKey])
          : null,
      games,
      observations: totals.count,
      unsupportedRows
    };
  }

  let sum = 0;
  let observations = 0;
  for (const row of appeared) {
    const value = row.game?.additive[metricKey];
    if (value == null || !Number.isFinite(value)) continue;
    sum += value;
    observations += 1;
  }
  return {
    value: observations > 0 ? round6(sum / observations) : null,
    games,
    observations,
    unsupportedRows
  };
}

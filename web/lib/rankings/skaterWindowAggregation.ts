import type { Database } from "lib/supabase/database-generated.types";
import {
  ROLLING_WINDOW_COUNT_SUPPORT_VERSION,
  type RollingWindowCountSupport,
} from "lib/rollingPlayerWindowCountSupport";

import {
  AVAILABLE_CONTEXTUAL_RANKING_METRIC_KEYS,
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";

export type RollingPlayerGameMetricRow =
  Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"] & {
    /**
     * L6 explicit window counts (`rolling-player-window-counts-v1`), joined
     * from `rolling_player_metric_support_payloads` by the reader. Absent on
     * rows written before the L6 writer: unknown, never zero.
     */
    windowCountSupport?: RollingWindowCountSupport | null;
  };

export type SkaterProductionWindow = "season" | "last5" | "last10" | "last20";

export type SkaterProductionWindowType =
  | "season"
  | "last_5"
  | "last_10"
  | "last_20";

export type SkaterWindowStrengthState = "all" | "5v5" | "ev" | "pp" | "pk";

export type SkaterWindowSemantics =
  | "season_to_date"
  | "player_last_n_games_played";

export type SkaterWindowAggregate = {
  playerId: number;
  teamId: number | null;
  seasonId: number;
  snapshotDate: string;
  strengthState: SkaterWindowStrengthState;
  window: SkaterProductionWindow;
  windowType: SkaterProductionWindowType;
  windowSize: number;
  windowSemantics: SkaterWindowSemantics;
  metricKey: ContextualRankingMetricKey;
  rawValue: number | null;
  numerator: number | null;
  denominator: number | null;
  gamesPlayed: number | null;
  toiSeconds: number | null;
  sourceFields: string[];
  /**
   * Last-N membership from the L6 window count support (null for season or
   * when support is absent). `crossesSeasons` marks a window that reaches
   * into an earlier season (decision 103 labels it).
   */
  windowMembership: {
    appearances: number;
    gameDates: string[];
    currentSeasonAppearances: number | null;
    crossesSeasons: boolean | null;
  } | null;
};

type RowRecord = Record<string, unknown>;

type MetricExtractionSpec = {
  metricKey: ContextualRankingMetricKey;
  formula?:
    | "rate_per_60"
    | "expected_shooting_percentage"
    | "sax_percentage"
    | "goals_above_expected"
    | "unrealized_xg"
    | "goals_above_expected_per_60"
    | "unrealized_xg_per_60"
    | "xga_per_60"
    | "on_ice_gf_percentage"
    | "on_ice_xgf_percentage";
  directFieldBase?: string;
  numeratorBase?: string;
  denominatorBase?: string;
  seasonNumeratorField?: string;
  seasonDenominatorField?: string;
  deriveSeasonFromAverages?: boolean;
  /**
   * Ratio key in the L6 window count support. Set for per-60 metrics whose
   * wide `<metric>_total_lastN` columns hold the RATE (W3-6 N1): last-N counts
   * come only from the support, never from that rate alias.
   */
  windowCountKey?: string;
};

const PHASE_1_WINDOW_METRIC_SPECS: MetricExtractionSpec[] = [
  {
    metricKey: "goals_per_60",
    directFieldBase: "goals_per_60",
    windowCountKey: "goals_per_60",
    seasonNumeratorField: "goals_per_60_goals_season",
    seasonDenominatorField: "goals_per_60_toi_seconds_season",
  },
  {
    metricKey: "assists_per_60",
    directFieldBase: "assists_per_60",
    windowCountKey: "assists_per_60",
    seasonNumeratorField: "assists_per_60_assists_season",
    seasonDenominatorField: "assists_per_60_toi_seconds_season",
  },
  {
    metricKey: "primary_assists_per_60",
    directFieldBase: "primary_assists_per_60",
    windowCountKey: "primary_assists_per_60",
    seasonNumeratorField: "primary_assists_per_60_primary_assists_season",
    seasonDenominatorField: "primary_assists_per_60_toi_seconds_season",
  },
  {
    metricKey: "points_per_60",
    numeratorBase: "points",
    denominatorBase: "toi_seconds",
    seasonNumeratorField: "points_avg_season",
    seasonDenominatorField: "toi_seconds_avg_season",
    deriveSeasonFromAverages: true,
  },
  {
    metricKey: "pp_points_per_60",
    numeratorBase: "pp_points",
    denominatorBase: "pp_toi_seconds",
    seasonNumeratorField: "pp_points_avg_season",
    seasonDenominatorField: "pp_toi_seconds_avg_season",
    deriveSeasonFromAverages: true,
  },
  {
    metricKey: "sog_per_60",
    directFieldBase: "sog_per_60",
    windowCountKey: "sog_per_60",
    seasonNumeratorField: "sog_per_60_shots_season",
    seasonDenominatorField: "sog_per_60_toi_seconds_season",
  },
  {
    metricKey: "shot_attempts_per_60",
    directFieldBase: "shot_attempts_per_60",
    windowCountKey: "shot_attempts_per_60",
    seasonNumeratorField: "shot_attempts_per_60_shot_attempts_season",
    seasonDenominatorField: "shot_attempts_per_60_toi_seconds_season",
  },
  {
    metricKey: "hits_per_60",
    directFieldBase: "hits_per_60",
    windowCountKey: "hits_per_60",
    seasonNumeratorField: "hits_per_60_hits_season",
    seasonDenominatorField: "hits_per_60_toi_seconds_season",
  },
  {
    metricKey: "blocks_per_60",
    directFieldBase: "blocks_per_60",
    windowCountKey: "blocks_per_60",
    seasonNumeratorField: "blocks_per_60_blocks_season",
    seasonDenominatorField: "blocks_per_60_toi_seconds_season",
  },
  {
    metricKey: "penalties_taken_per_60",
    directFieldBase: "penalties_taken_per_60",
    windowCountKey: "penalties_taken_per_60",
    seasonNumeratorField: "penalties_taken_per_60_penalties_taken_season",
    seasonDenominatorField: "penalties_taken_per_60_toi_seconds_season",
  },
  {
    metricKey: "ixg_per_60",
    directFieldBase: "ixg_per_60",
    windowCountKey: "ixg_per_60",
    seasonNumeratorField: "ixg_per_60_ixg_season",
    seasonDenominatorField: "ixg_per_60_toi_seconds_season",
  },
  { metricKey: "expected_shooting_percentage", formula: "expected_shooting_percentage" },
  { metricKey: "sax_percentage", formula: "sax_percentage" },
  { metricKey: "goals_above_expected", formula: "goals_above_expected" },
  { metricKey: "unrealized_xg", formula: "unrealized_xg" },
  {
    metricKey: "goals_above_expected_per_60",
    formula: "goals_above_expected_per_60",
  },
  { metricKey: "unrealized_xg_per_60", formula: "unrealized_xg_per_60" },
  { metricKey: "xga_per_60", formula: "xga_per_60" },
  { metricKey: "on_ice_gf_percentage", formula: "on_ice_gf_percentage" },
  { metricKey: "on_ice_xgf_percentage", formula: "on_ice_xgf_percentage" },
];

export const SKATER_PRODUCTION_WINDOWS: SkaterProductionWindow[] = [
  "season",
  "last5",
  "last10",
  "last20",
];

export const SUPPORTED_SKATER_WINDOW_STRENGTH_STATES: SkaterWindowStrengthState[] =
  ["all", "5v5", "ev", "pp", "pk"];

export const SKATER_WINDOW_AGGREGATION_REFRESH_SURFACES = {
  endpoint: "/api/v1/db/update-rolling-player-averages",
  truncateRpc: "truncate_rolling_player_game_metrics",
  sourceTable: "rolling_player_game_metrics",
} as const;

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function readNumber(row: RowRecord, field: string): number | null {
  return finiteNumber(row[field]);
}

function ratePer60(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Number(((numerator / denominator) * 3600).toFixed(6));
}

function percent(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(6));
}

export function isSupportedSkaterWindowStrengthState(
  value: string | null | undefined,
): value is SkaterWindowStrengthState {
  return SUPPORTED_SKATER_WINDOW_STRENGTH_STATES.includes(
    value as SkaterWindowStrengthState,
  );
}

export function getSkaterProductionWindowType(
  window: SkaterProductionWindow,
): SkaterProductionWindowType {
  if (window === "last5") return "last_5";
  if (window === "last10") return "last_10";
  if (window === "last20") return "last_20";
  return "season";
}

export function getSkaterProductionWindowSize(
  window: SkaterProductionWindow,
): number {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return 0;
}

export function getSkaterWindowSemantics(
  window: SkaterProductionWindow,
): SkaterWindowSemantics {
  return window === "season"
    ? "season_to_date"
    : "player_last_n_games_played";
}

function getSeasonParticipationField(strengthState: SkaterWindowStrengthState) {
  return strengthState === "all"
    ? "season_games_played"
    : "season_participation_games";
}

type WindowCountSupportWindow = RollingWindowCountSupport["windows"]["last5"];

/** The L6 count-support window for a last-N request, or null when absent. */
function readSupportWindow(
  row: RowRecord,
  window: SkaterProductionWindow,
): WindowCountSupportWindow | null {
  if (window === "season") return null;
  const support = row.windowCountSupport as RollingWindowCountSupport | null | undefined;
  if (
    !support ||
    typeof support !== "object" ||
    support.version !== ROLLING_WINDOW_COUNT_SUPPORT_VERSION
  ) {
    return null;
  }
  const supportWindow = support.windows?.[window];
  if (!supportWindow || typeof supportWindow.appearances !== "number") return null;
  return supportWindow;
}

function hasWindowCountSupport(row: RowRecord) {
  const support = row.windowCountSupport as RollingWindowCountSupport | null | undefined;
  return support?.version === ROLLING_WINDOW_COUNT_SUPPORT_VERSION;
}

/**
 * Full-window `[numerator, denominator]` for a ratio key: both components
 * known in every appearance of the window (rule 13). A covered subset
 * (`observations < appearances`) is unknown here (rule 22).
 */
function fullWindowRatio(
  supportWindow: WindowCountSupportWindow | null,
  key: string,
): [number, number] | null {
  if (!supportWindow || supportWindow.appearances <= 0) return null;
  const tuple = supportWindow.ratio?.[key];
  if (!Array.isArray(tuple)) return null;
  const [numerator, denominator, observations] = tuple;
  if (
    finiteNumber(numerator) == null ||
    finiteNumber(denominator) == null ||
    observations !== supportWindow.appearances
  ) {
    return null;
  }
  return [numerator, denominator];
}

/** NHL game ids carry the season start year in their first four digits. */
function seasonStartYearFromGameId(gameId: number | null) {
  if (gameId == null || !Number.isFinite(gameId)) return null;
  const year = Math.floor(gameId / 1_000_000);
  return year >= 1900 && year <= 2999 ? year : null;
}

function resolveWindowMembership(
  supportWindow: WindowCountSupportWindow | null,
  seasonId: number,
): SkaterWindowAggregate["windowMembership"] {
  if (!supportWindow) return null;
  const currentStartYear = Math.floor(seasonId / 10_000);
  const years = supportWindow.gameIds.map(seasonStartYearFromGameId);
  const known = years.every((year) => year != null);
  const currentSeasonAppearances = known
    ? years.filter((year) => year === currentStartYear).length
    : null;
  return {
    appearances: supportWindow.appearances,
    gameDates: [...supportWindow.gameDates],
    currentSeasonAppearances,
    crossesSeasons:
      currentSeasonAppearances == null
        ? null
        : currentSeasonAppearances < supportWindow.appearances,
  };
}

function resolveGamesPlayed(
  row: RowRecord,
  strengthState: SkaterWindowStrengthState,
  window: SkaterProductionWindow,
) {
  const seasonGames =
    readNumber(row, getSeasonParticipationField(strengthState)) ??
    readNumber(row, "games_played");

  if (window === "season") {
    return seasonGames;
  }

  // Last-N windows are the player's last N appearances and can reach into an
  // earlier season. Use the persisted window membership (W2-4 A2); never infer
  // a full window from this season's GP or TOI magnitudes.
  const supportWindow = readSupportWindow(row, window);
  if (supportWindow) return supportWindow.appearances;

  // Exact when both are stored for the same window (total ÷ mean per game).
  const windowSize = getSkaterProductionWindowSize(window);
  const windowToi = readNumber(row, `toi_seconds_total_${window}`);
  const windowAvgToi = readNumber(row, `toi_seconds_avg_${window}`);
  if (windowToi != null && windowAvgToi != null && windowAvgToi > 0) {
    return Math.min(windowSize, Math.round(windowToi / windowAvgToi));
  }
  return null;
}

function resolveToiSeconds(args: {
  row: RowRecord;
  window: SkaterProductionWindow;
  denominator: number | null;
  gamesPlayed: number | null;
}) {
  if (args.window === "season") {
    if (args.denominator != null) return args.denominator;
    const seasonAverageToi = readNumber(args.row, "toi_seconds_avg_season");
    if (seasonAverageToi != null && args.gamesPlayed != null) {
      return Number((seasonAverageToi * args.gamesPlayed).toFixed(6));
    }
    return args.denominator;
  }

  return (
    args.denominator ??
    readNumber(
      args.row,
      `toi_seconds_total_${args.window}`,
    )
  );
}

function seasonGamesForRow(row: RowRecord) {
  return (
    readNumber(
      row,
      getSeasonParticipationField(
        isSupportedSkaterWindowStrengthState(row.strength_state as string)
          ? (row.strength_state as SkaterWindowStrengthState)
          : "all",
      ),
    ) ?? readNumber(row, "games_played")
  );
}

function onIceComponentField(
  component: "oi_gf" | "oi_ga" | "oi_xgf" | "oi_xga" | "toi_seconds",
  window: SkaterProductionWindow,
) {
  return window === "season"
    ? `${component}_avg_season`
    : `${component}_total_${window}`;
}

type ExtractedWindowMetric = {
  rawValue: number | null;
  numerator: number | null;
  denominator: number | null;
  sourceFields: string[];
};

const UNAVAILABLE_METRIC: ExtractedWindowMetric = {
  rawValue: null,
  numerator: null,
  denominator: null,
  sourceFields: [],
};

const SUPPORT_FIELD = "rolling_player_metric_support_payloads.windowCountSupport";

/**
 * Goals and ixG counts for one window, on the same games (decision 75).
 * Season: the paired season count columns. Last-N: L6 window counts with
 * full coverage; the `_total_lastN` aliases are rates and are never read.
 */
function goalsAndIxgCounts(row: RowRecord, window: SkaterProductionWindow) {
  if (window === "season") {
    const goals = readNumber(row, "goals_per_60_goals_season");
    const goalsToi = readNumber(row, "goals_per_60_toi_seconds_season");
    const ixg = readNumber(row, "ixg_per_60_ixg_season");
    const ixgToi = readNumber(row, "ixg_per_60_toi_seconds_season");
    return {
      goals,
      ixg,
      // Same exposure only when both pairs cover the same TOI.
      toiSeconds: goalsToi != null && goalsToi === ixgToi ? goalsToi : null,
      sourceFields: [
        "goals_per_60_goals_season",
        "ixg_per_60_ixg_season",
        "goals_per_60_toi_seconds_season",
        "ixg_per_60_toi_seconds_season",
      ],
    };
  }
  const supportWindow = readSupportWindow(row, window);
  const goalsPair = fullWindowRatio(supportWindow, "goals_per_60");
  const ixgPair = fullWindowRatio(supportWindow, "ixg_per_60");
  const both = goalsPair != null && ixgPair != null;
  return {
    goals: both ? goalsPair[0] : null,
    ixg: both ? ixgPair[0] : null,
    toiSeconds: both && goalsPair[1] === ixgPair[1] ? goalsPair[1] : null,
    sourceFields: [`${SUPPORT_FIELD}.${window}.goals_per_60`, `${SUPPORT_FIELD}.${window}.ixg_per_60`],
  };
}

function extractDerivedWindowMetric(args: {
  row: RowRecord;
  formula: Exclude<NonNullable<MetricExtractionSpec["formula"]>, "rate_per_60">;
  window: SkaterProductionWindow;
}): ExtractedWindowMetric {
  const { row, window } = args;

  if (args.formula === "on_ice_gf_percentage") {
    const oiGfField = onIceComponentField("oi_gf", window);
    const oiGaField = onIceComponentField("oi_ga", window);
    const oiGf = readNumber(row, oiGfField);
    const oiGa = readNumber(row, oiGaField);

    return {
      rawValue: oiGf != null && oiGa != null ? percent(oiGf, oiGf + oiGa) : null,
      numerator: oiGf,
      denominator:
        oiGf != null && oiGa != null
          ? Number((oiGf + oiGa).toFixed(6))
          : null,
      sourceFields: [oiGfField, oiGaField],
    };
  }

  if (args.formula === "on_ice_xgf_percentage") {
    const oiXgfField = onIceComponentField("oi_xgf", window);
    const oiXgaField = onIceComponentField("oi_xga", window);
    const oiXgf = readNumber(row, oiXgfField);
    const oiXga = readNumber(row, oiXgaField);

    return {
      rawValue:
        oiXgf != null && oiXga != null ? percent(oiXgf, oiXgf + oiXga) : null,
      numerator: oiXgf,
      denominator:
        oiXgf != null && oiXga != null
          ? Number((oiXgf + oiXga).toFixed(6))
          : null,
      sourceFields: [oiXgfField, oiXgaField],
    };
  }

  if (args.formula === "xga_per_60") {
    const oiXgaField = onIceComponentField("oi_xga", window);
    const toiField = onIceComponentField("toi_seconds", window);
    let oiXga = readNumber(row, oiXgaField);
    let toiSeconds = readNumber(row, toiField);
    if (window === "season") {
      // Season fields are per-game means; the sample gate needs the season's
      // exposure, so scale both by the games behind the means (W2-4 D6).
      const seasonGames = seasonGamesForRow(row);
      oiXga =
        oiXga != null && seasonGames != null
          ? Number((oiXga * seasonGames).toFixed(6))
          : null;
      toiSeconds =
        toiSeconds != null && seasonGames != null
          ? Number((toiSeconds * seasonGames).toFixed(6))
          : null;
    }

    return {
      rawValue: ratePer60(oiXga, toiSeconds),
      numerator: oiXga,
      denominator: toiSeconds,
      sourceFields: [oiXgaField, toiField],
    };
  }

  if (args.formula === "expected_shooting_percentage") {
    // Decision 17: xS% = ixG ÷ individual unblocked attempts (Fenwick) × 100.
    // Only L6-writer rows carry that definition (older rows divide by shots
    // or all attempts), so the support version is the provenance (W2-4 D5).
    if (window === "season") {
      if (!hasWindowCountSupport(row)) return UNAVAILABLE_METRIC;
      return {
        rawValue: readNumber(row, "expected_sh_pct_season"),
        numerator: null,
        denominator: null,
        sourceFields: ["expected_sh_pct_season", SUPPORT_FIELD],
      };
    }
    const pair = fullWindowRatio(readSupportWindow(row, window), "expected_sh_pct");
    return {
      rawValue: pair ? percent(pair[0], pair[1]) : null,
      numerator: pair?.[0] ?? null,
      denominator: pair?.[1] ?? null,
      sourceFields: [`${SUPPORT_FIELD}.${window}.expected_sh_pct`],
    };
  }

  if (args.formula === "sax_percentage") {
    // SAX% = (goals − ixG) ÷ Fenwick × 100 on the same games. The season
    // Fenwick count is not stored yet, so the season view is unavailable.
    if (window === "season") return UNAVAILABLE_METRIC;
    const supportWindow = readSupportWindow(row, window);
    const xsPair = fullWindowRatio(supportWindow, "expected_sh_pct");
    const goalsPair = fullWindowRatio(supportWindow, "goals_per_60");
    if (!xsPair || !goalsPair) {
      return {
        ...UNAVAILABLE_METRIC,
        sourceFields: [`${SUPPORT_FIELD}.${window}.expected_sh_pct`, `${SUPPORT_FIELD}.${window}.goals_per_60`],
      };
    }
    const goalsMinusIxg = Number((goalsPair[0] - xsPair[0]).toFixed(6));
    return {
      rawValue: percent(goalsMinusIxg, xsPair[1]),
      numerator: goalsMinusIxg,
      denominator: xsPair[1],
      sourceFields: [`${SUPPORT_FIELD}.${window}.expected_sh_pct`, `${SUPPORT_FIELD}.${window}.goals_per_60`],
    };
  }

  // Decision 75: ranked GAx and Unrealized xG are window counts in goals;
  // their per-60 forms are separate, labelled metrics.
  const counts = goalsAndIxgCounts(row, window);
  const { goals, ixg } = counts;
  const difference =
    goals != null && ixg != null
      ? Number(
          (args.formula === "goals_above_expected" ||
          args.formula === "goals_above_expected_per_60"
            ? goals - ixg
            : ixg - goals
          ).toFixed(6),
        )
      : null;

  if (
    args.formula === "goals_above_expected_per_60" ||
    args.formula === "unrealized_xg_per_60"
  ) {
    return {
      rawValue: ratePer60(difference, counts.toiSeconds),
      numerator: difference,
      denominator: difference == null ? null : counts.toiSeconds,
      sourceFields: counts.sourceFields,
    };
  }

  return {
    rawValue: difference,
    numerator: args.formula === "goals_above_expected" ? goals : ixg,
    denominator: args.formula === "goals_above_expected" ? ixg : goals,
    sourceFields: counts.sourceFields,
  };
}

function extractWindowMetric(args: {
  row: RowRecord;
  spec: MetricExtractionSpec;
  window: SkaterProductionWindow;
}): ExtractedWindowMetric {
  const { row, spec, window } = args;

  if (spec.formula && spec.formula !== "rate_per_60") {
    return extractDerivedWindowMetric({ row, formula: spec.formula, window });
  }

  if (window === "season") {
    const numeratorField = spec.seasonNumeratorField;
    const denominatorField = spec.seasonDenominatorField;
    const rawNumerator = numeratorField ? readNumber(row, numeratorField) : null;
    const rawDenominator = denominatorField ? readNumber(row, denominatorField) : null;
    const seasonGames = seasonGamesForRow(row);
    const numerator =
      spec.deriveSeasonFromAverages && rawNumerator != null && seasonGames != null
        ? Number((rawNumerator * seasonGames).toFixed(6))
        : rawNumerator;
    const denominator =
      spec.deriveSeasonFromAverages && rawDenominator != null && seasonGames != null
        ? Number((rawDenominator * seasonGames).toFixed(6))
        : rawDenominator;
    const directField = spec.directFieldBase
      ? `${spec.directFieldBase}_season`
      : null;
    const directValue = directField ? readNumber(row, directField) : null;

    return {
      rawValue: directValue ?? ratePer60(numerator, denominator),
      numerator,
      denominator,
      sourceFields: [
        ...(directField ? [directField] : []),
        ...(numeratorField ? [numeratorField] : []),
        ...(denominatorField ? [denominatorField] : []),
      ],
    };
  }

  const directField = spec.directFieldBase
    ? `${spec.directFieldBase}_${window}`
    : null;
  const directValue = directField ? readNumber(row, directField) : null;

  if (spec.windowCountKey) {
    // Rate-alias metric (W3-6 N1): `<metric>_total_lastN` is a rate, so the
    // count and its TOI come only from the L6 window counts.
    const pair = fullWindowRatio(readSupportWindow(row, window), spec.windowCountKey);
    return {
      rawValue: directValue ?? (pair ? ratePer60(pair[0], pair[1]) : null),
      numerator: pair?.[0] ?? null,
      denominator: pair?.[1] ?? null,
      sourceFields: [
        ...(directField ? [directField] : []),
        `${SUPPORT_FIELD}.${window}.${spec.windowCountKey}`,
      ],
    };
  }

  if (!spec.numeratorBase) return UNAVAILABLE_METRIC;
  // Count metric (points, PP points): the window total is a real count.
  const numeratorField = `${spec.numeratorBase}_total_${window}`;
  const denominatorField = `${spec.denominatorBase ?? "toi_seconds"}_total_${window}`;
  const numerator = readNumber(row, numeratorField);
  const denominator = readNumber(row, denominatorField);

  return {
    rawValue: directValue ?? ratePer60(numerator, denominator),
    numerator,
    denominator,
    sourceFields: [
      ...(directField ? [directField] : []),
      numeratorField,
      denominatorField,
    ],
  };
}

export function buildSkaterWindowAggregatesFromRollingRow(
  rollingRow: RollingPlayerGameMetricRow,
  options?: {
    windows?: SkaterProductionWindow[];
    metricKeys?: ContextualRankingMetricKey[];
  },
): SkaterWindowAggregate[] {
  const row = rollingRow as RowRecord;
  const playerId = finiteNumber(rollingRow.player_id);
  const seasonId = finiteNumber(rollingRow.season);
  const snapshotDate = rollingRow.game_date;

  if (
    playerId == null ||
    seasonId == null ||
    !snapshotDate ||
    !isSupportedSkaterWindowStrengthState(rollingRow.strength_state)
  ) {
    return [];
  }

  const windows = options?.windows ?? SKATER_PRODUCTION_WINDOWS;
  const metricKeys = new Set(
    options?.metricKeys ?? AVAILABLE_CONTEXTUAL_RANKING_METRIC_KEYS,
  );
  const aggregates: SkaterWindowAggregate[] = [];

  for (const spec of PHASE_1_WINDOW_METRIC_SPECS) {
    if (!metricKeys.has(spec.metricKey)) continue;
    const definition = getContextualRankingMetricDefinition(spec.metricKey);
    if (!definition || definition.availabilityStatus !== "available") continue;

    for (const window of windows) {
      const extracted = extractWindowMetric({ row, spec, window });
      const gamesPlayed = resolveGamesPlayed(
        row,
        rollingRow.strength_state,
        window,
      );
      const toiSeconds = resolveToiSeconds({
        row,
        window,
        denominator: definition.isRateStat ? extracted.denominator : null,
        gamesPlayed,
      });

      aggregates.push({
        playerId,
        teamId: finiteNumber(rollingRow.team_id),
        seasonId,
        snapshotDate,
        strengthState: rollingRow.strength_state,
        window,
        windowType: getSkaterProductionWindowType(window),
        windowSize: getSkaterProductionWindowSize(window),
        windowSemantics: getSkaterWindowSemantics(window),
        metricKey: spec.metricKey,
        rawValue: extracted.rawValue,
        numerator: extracted.numerator,
        denominator: extracted.denominator,
        gamesPlayed,
        toiSeconds,
        sourceFields: extracted.sourceFields,
        windowMembership: resolveWindowMembership(
          readSupportWindow(row, window),
          seasonId,
        ),
      });
    }
  }

  return aggregates;
}

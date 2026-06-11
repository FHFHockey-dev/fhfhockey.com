import type { Database } from "lib/supabase/database-generated.types";

import {
  AVAILABLE_CONTEXTUAL_RANKING_METRIC_KEYS,
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";

export type RollingPlayerGameMetricRow =
  Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"];

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
    | "xga_per_60"
    | "on_ice_gf_percentage"
    | "on_ice_xgf_percentage";
  directFieldBase?: string;
  numeratorBase?: string;
  denominatorBase?: string;
  seasonNumeratorField?: string;
  seasonDenominatorField?: string;
  deriveSeasonFromAverages?: boolean;
};

const PHASE_1_WINDOW_METRIC_SPECS: MetricExtractionSpec[] = [
  {
    metricKey: "goals_per_60",
    directFieldBase: "goals_per_60",
    numeratorBase: "goals_per_60",
    seasonNumeratorField: "goals_per_60_goals_season",
    seasonDenominatorField: "goals_per_60_toi_seconds_season",
  },
  {
    metricKey: "assists_per_60",
    directFieldBase: "assists_per_60",
    numeratorBase: "assists_per_60",
    seasonNumeratorField: "assists_per_60_assists_season",
    seasonDenominatorField: "assists_per_60_toi_seconds_season",
  },
  {
    metricKey: "primary_assists_per_60",
    directFieldBase: "primary_assists_per_60",
    numeratorBase: "primary_assists_per_60",
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
    metricKey: "sog_per_60",
    directFieldBase: "sog_per_60",
    numeratorBase: "sog_per_60",
    seasonNumeratorField: "sog_per_60_shots_season",
    seasonDenominatorField: "sog_per_60_toi_seconds_season",
  },
  {
    metricKey: "shot_attempts_per_60",
    directFieldBase: "shot_attempts_per_60",
    numeratorBase: "shot_attempts_per_60",
    seasonNumeratorField: "shot_attempts_per_60_shot_attempts_season",
    seasonDenominatorField: "shot_attempts_per_60_toi_seconds_season",
  },
  {
    metricKey: "hits_per_60",
    directFieldBase: "hits_per_60",
    numeratorBase: "hits_per_60",
    seasonNumeratorField: "hits_per_60_hits_season",
    seasonDenominatorField: "hits_per_60_toi_seconds_season",
  },
  {
    metricKey: "blocks_per_60",
    directFieldBase: "blocks_per_60",
    numeratorBase: "blocks_per_60",
    seasonNumeratorField: "blocks_per_60_blocks_season",
    seasonDenominatorField: "blocks_per_60_toi_seconds_season",
  },
  {
    metricKey: "penalties_taken_per_60",
    directFieldBase: "penalties_taken_per_60",
    numeratorBase: "penalties_taken_per_60",
    seasonNumeratorField: "penalties_taken_per_60_penalties_taken_season",
    seasonDenominatorField: "penalties_taken_per_60_toi_seconds_season",
  },
  {
    metricKey: "ixg_per_60",
    directFieldBase: "ixg_per_60",
    numeratorBase: "ixg_per_60",
    seasonNumeratorField: "ixg_per_60_ixg_season",
    seasonDenominatorField: "ixg_per_60_toi_seconds_season",
  },
  { metricKey: "expected_shooting_percentage", formula: "expected_shooting_percentage" },
  { metricKey: "sax_percentage", formula: "sax_percentage" },
  { metricKey: "goals_above_expected", formula: "goals_above_expected" },
  { metricKey: "unrealized_xg", formula: "unrealized_xg" },
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

function resolveGamesPlayed(
  row: RowRecord,
  strengthState: SkaterWindowStrengthState,
  window: SkaterProductionWindow,
) {
  const seasonGames =
    readNumber(row, getSeasonParticipationField(strengthState)) ??
    readNumber(row, "games_played");

  if (window === "season" || seasonGames == null) {
    return seasonGames;
  }

  return Math.min(seasonGames, getSkaterProductionWindowSize(window));
}

function resolveToiSeconds(args: {
  row: RowRecord;
  window: SkaterProductionWindow;
  denominator: number | null;
  gamesPlayed: number | null;
}) {
  if (args.window === "season") {
    const seasonAverageToi = readNumber(args.row, "toi_seconds_avg_season");
    if (seasonAverageToi != null && args.gamesPlayed != null) {
      return Number((seasonAverageToi * args.gamesPlayed).toFixed(6));
    }
    return args.denominator;
  }

  return (
    readNumber(
      args.row,
      `toi_seconds_total_${args.window}`,
    ) ?? args.denominator
  );
}

function derivedComponentField(
  component:
    | "goals"
    | "ixg"
    | "shot_attempts"
    | "oi_gf"
    | "oi_ga"
    | "oi_xgf"
    | "oi_xga"
    | "toi_seconds",
  window: SkaterProductionWindow,
) {
  if (window === "season") {
    if (component === "goals") return "goals_per_60_goals_season";
    if (component === "ixg") return "ixg_per_60_ixg_season";
    if (component === "oi_gf") return "oi_gf_avg_season";
    if (component === "oi_ga") return "oi_ga_avg_season";
    if (component === "oi_xgf") return "oi_xgf_avg_season";
    if (component === "oi_xga") return "oi_xga_avg_season";
    if (component === "toi_seconds") return "toi_seconds_avg_season";
    return "shot_attempts_per_60_shot_attempts_season";
  }

  if (component === "goals") return `goals_per_60_total_${window}`;
  if (component === "ixg") return `ixg_per_60_total_${window}`;
  if (component === "oi_gf") return `oi_gf_total_${window}`;
  if (component === "oi_ga") return `oi_ga_total_${window}`;
  if (component === "oi_xgf") return `oi_xgf_total_${window}`;
  if (component === "oi_xga") return `oi_xga_total_${window}`;
  if (component === "toi_seconds") return `toi_seconds_total_${window}`;
  return `shot_attempts_per_60_total_${window}`;
}

function extractDerivedWindowMetric(args: {
  row: RowRecord;
  formula: Exclude<NonNullable<MetricExtractionSpec["formula"]>, "rate_per_60">;
  window: SkaterProductionWindow;
}): {
  rawValue: number | null;
  numerator: number | null;
  denominator: number | null;
  sourceFields: string[];
} {
  const goalsField = derivedComponentField("goals", args.window);
  const ixgField = derivedComponentField("ixg", args.window);
  const shotAttemptsField = derivedComponentField("shot_attempts", args.window);

  const goals = readNumber(args.row, goalsField);
  const ixg = readNumber(args.row, ixgField);
  const shotAttempts = readNumber(args.row, shotAttemptsField);

  if (args.formula === "on_ice_gf_percentage") {
    const oiGfField = derivedComponentField("oi_gf", args.window);
    const oiGaField = derivedComponentField("oi_ga", args.window);
    const oiGf = readNumber(args.row, oiGfField);
    const oiGa = readNumber(args.row, oiGaField);

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
    const oiXgfField = derivedComponentField("oi_xgf", args.window);
    const oiXgaField = derivedComponentField("oi_xga", args.window);
    const oiXgf = readNumber(args.row, oiXgfField);
    const oiXga = readNumber(args.row, oiXgaField);

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
    const oiXgaField = derivedComponentField("oi_xga", args.window);
    const toiField = derivedComponentField("toi_seconds", args.window);
    const oiXga = readNumber(args.row, oiXgaField);
    const toiSeconds = readNumber(args.row, toiField);

    return {
      rawValue: ratePer60(oiXga, toiSeconds),
      numerator: oiXga,
      denominator: toiSeconds,
      sourceFields: [oiXgaField, toiField],
    };
  }

  if (args.formula === "expected_shooting_percentage") {
    return {
      rawValue: percent(ixg, shotAttempts),
      numerator: ixg,
      denominator: shotAttempts,
      sourceFields: [ixgField, shotAttemptsField],
    };
  }

  if (args.formula === "sax_percentage") {
    const actualShootingPercentage = percent(goals, shotAttempts);
    const expectedShootingPercentage = percent(ixg, shotAttempts);

    return {
      rawValue:
        actualShootingPercentage != null && expectedShootingPercentage != null
          ? Number(
              (actualShootingPercentage - expectedShootingPercentage).toFixed(6),
            )
          : null,
      numerator: goals != null && ixg != null ? Number((goals - ixg).toFixed(6)) : null,
      denominator: shotAttempts,
      sourceFields: [goalsField, ixgField, shotAttemptsField],
    };
  }

  if (args.formula === "goals_above_expected") {
    return {
      rawValue: goals != null && ixg != null ? Number((goals - ixg).toFixed(6)) : null,
      numerator: goals,
      denominator: ixg,
      sourceFields: [goalsField, ixgField],
    };
  }

  return {
    rawValue: ixg != null && goals != null ? Number((ixg - goals).toFixed(6)) : null,
    numerator: ixg,
    denominator: goals,
    sourceFields: [ixgField, goalsField],
  };
}

function extractWindowMetric(args: {
  row: RowRecord;
  spec: MetricExtractionSpec;
  window: SkaterProductionWindow;
}): {
  rawValue: number | null;
  numerator: number | null;
  denominator: number | null;
  sourceFields: string[];
} {
  const { row, spec, window } = args;

  if (spec.formula && spec.formula !== "rate_per_60") {
    return extractDerivedWindowMetric({ row, formula: spec.formula, window });
  }

  if (window === "season") {
    const numeratorField = spec.seasonNumeratorField;
    const denominatorField = spec.seasonDenominatorField;
    const numerator = numeratorField ? readNumber(row, numeratorField) : null;
    const denominator = denominatorField ? readNumber(row, denominatorField) : null;
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
  if (!spec.numeratorBase) {
    return { rawValue: null, numerator: null, denominator: null, sourceFields: [] };
  }
  const numeratorField = `${spec.numeratorBase}_total_${window}`;
  const denominatorField = `${spec.denominatorBase ?? "toi_seconds"}_total_${window}`;
  const numerator = readNumber(row, numeratorField);
  const denominator = readNumber(row, denominatorField);

  return {
    rawValue:
      (directField ? readNumber(row, directField) : null) ??
      ratePer60(numerator, denominator),
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
      });
    }
  }

  return aggregates;
}

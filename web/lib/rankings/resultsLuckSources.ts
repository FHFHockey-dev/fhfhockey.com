import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

import type { SkaterProductionWindow, SkaterWindowStrengthState } from "./skaterWindowAggregation";
import type {
  ResultsLuckBaselineProvenance,
  ResultsLuckSignalComponentInput,
} from "./resultsLuckIndex";

type RollingRow = Record<string, unknown>;

export type ResultsLuckRollingSource = {
  playerId: number;
  gameDate: string;
  strengthState: SkaterWindowStrengthState;
  components: ResultsLuckSignalComponentInput[];
  baselineProvenance: ResultsLuckBaselineProvenance;
};

const BASE_RESULTS_LUCK_FIELDS = [
  "player_id",
  "game_date",
  "strength_state",
  "season_games_played",
  "season_participation_games",
  "games_played",
] as const;

function windowSuffix(window: Exclude<SkaterProductionWindow, "season">) {
  if (window === "last5") return "last5";
  if (window === "last10") return "last10";
  return "last20";
}

export function resultsLuckRollingSelectFields(window: SkaterProductionWindow) {
  const currentWindow =
    window === "season" ? "last20" : windowSuffix(window);
  return [
    ...BASE_RESULTS_LUCK_FIELDS,
    `goals_per_60_total_${currentWindow}`,
    `ixg_per_60_total_${currentWindow}`,
    `shot_attempts_per_60_total_${currentWindow}`,
    `ipp_points_${currentWindow}`,
    `ipp_on_ice_goals_for_${currentWindow}`,
    `oi_gf_total_${currentWindow}`,
    `oi_xgf_total_${currentWindow}`,
    "goals_per_60_goals_season",
    "ixg_per_60_ixg_season",
    "shot_attempts_per_60_shot_attempts_season",
    "ipp_points_season",
    "ipp_on_ice_goals_for_season",
    "oi_gf_avg_season",
    "oi_xgf_avg_season",
  ];
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function percent(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(6));
}

function subtractSeasonWindow(
  seasonValue: number | null,
  windowValue: number | null,
) {
  if (seasonValue == null || windowValue == null) return null;
  return Number((seasonValue - windowValue).toFixed(6));
}

function seasonGames(row: RollingRow) {
  return (
    finite(row.season_participation_games) ??
    finite(row.season_games_played) ??
    finite(row.games_played)
  );
}

export function buildResultsLuckRollingSourceFromRow(args: {
  row: RollingRow;
  window: SkaterProductionWindow;
}): ResultsLuckRollingSource | null {
  const playerId = finite(args.row.player_id);
  const gameDate = text(args.row.game_date);
  const strengthState = text(args.row.strength_state) as SkaterWindowStrengthState | null;
  if (playerId == null || !gameDate || !strengthState) return null;

  const warnings: string[] = [];
  if (args.window === "season") {
    warnings.push("season_window_has_no_non_overlapping_baseline");
  }

  const currentWindow =
    args.window === "season" ? "last20" : windowSuffix(args.window);
  const games = seasonGames(args.row);

  const currentGoals = finite(args.row[`goals_per_60_total_${currentWindow}`]);
  const currentIxg = finite(args.row[`ixg_per_60_total_${currentWindow}`]);
  const currentAttempts = finite(
    args.row[`shot_attempts_per_60_total_${currentWindow}`],
  );
  const seasonGoals = finite(args.row.goals_per_60_goals_season);
  const seasonIxg = finite(args.row.ixg_per_60_ixg_season);
  const seasonAttempts = finite(args.row.shot_attempts_per_60_shot_attempts_season);

  const baselineGoals =
    args.window === "season"
      ? null
      : subtractSeasonWindow(seasonGoals, currentGoals);
  const baselineIxg =
    args.window === "season" ? null : subtractSeasonWindow(seasonIxg, currentIxg);
  const baselineAttempts =
    args.window === "season"
      ? null
      : subtractSeasonWindow(seasonAttempts, currentAttempts);

  const currentIppPoints = finite(args.row[`ipp_points_${currentWindow}`]);
  const currentIppOnIceGoals = finite(
    args.row[`ipp_on_ice_goals_for_${currentWindow}`],
  );
  const seasonIppPoints = finite(args.row.ipp_points_season);
  const seasonIppOnIceGoals = finite(args.row.ipp_on_ice_goals_for_season);
  const baselineIppPoints =
    args.window === "season"
      ? null
      : subtractSeasonWindow(seasonIppPoints, currentIppPoints);
  const baselineIppOnIceGoals =
    args.window === "season"
      ? null
      : subtractSeasonWindow(seasonIppOnIceGoals, currentIppOnIceGoals);

  const currentOiGf = finite(args.row[`oi_gf_total_${currentWindow}`]);
  const currentOiXgf = finite(args.row[`oi_xgf_total_${currentWindow}`]);
  const seasonOiGf =
    games != null && finite(args.row.oi_gf_avg_season) != null
      ? Number(((finite(args.row.oi_gf_avg_season) ?? 0) * games).toFixed(6))
      : null;
  const seasonOiXgf =
    games != null && finite(args.row.oi_xgf_avg_season) != null
      ? Number(((finite(args.row.oi_xgf_avg_season) ?? 0) * games).toFixed(6))
      : null;
  const baselineOiGf =
    args.window === "season" ? null : subtractSeasonWindow(seasonOiGf, currentOiGf);
  const baselineOiXgf =
    args.window === "season" ? null : subtractSeasonWindow(seasonOiXgf, currentOiXgf);

  const baselineWindowExcluded =
    args.window !== "season" &&
    [
      baselineGoals,
      baselineIxg,
      baselineAttempts,
      baselineIppPoints,
      baselineIppOnIceGoals,
      baselineOiGf,
      baselineOiXgf,
    ].every((value) => value != null);

  if (!baselineWindowExcluded) {
    warnings.push("selected_window_exclusion_not_verified");
  }

  return {
    playerId,
    gameDate,
    strengthState,
    components: [
      {
        key: "goals_above_expected",
        semantics: "signed_difference",
        currentValue:
          currentGoals != null && currentIxg != null
            ? Number((currentGoals - currentIxg).toFixed(6))
            : null,
        baselineValue:
          baselineGoals != null && baselineIxg != null
            ? Number((baselineGoals - baselineIxg).toFixed(6))
            : null,
        scale: 2,
        weight: 0.35,
      },
      {
        key: "sax_percentage",
        semantics: "signed_difference",
        currentValue:
          percent(currentGoals, currentAttempts) != null &&
          percent(currentIxg, currentAttempts) != null
            ? Number(
                (
                  (percent(currentGoals, currentAttempts) ?? 0) -
                  (percent(currentIxg, currentAttempts) ?? 0)
                ).toFixed(6),
              )
            : null,
        baselineValue:
          percent(baselineGoals, baselineAttempts) != null &&
          percent(baselineIxg, baselineAttempts) != null
            ? Number(
                (
                  (percent(baselineGoals, baselineAttempts) ?? 0) -
                  (percent(baselineIxg, baselineAttempts) ?? 0)
                ).toFixed(6),
              )
            : null,
        scale: 10,
        weight: 0.25,
      },
      {
        key: "ipp",
        semantics: "ratio",
        currentValue: percent(currentIppPoints, currentIppOnIceGoals),
        baselineValue: percent(baselineIppPoints, baselineIppOnIceGoals),
        weight: 0.2,
      },
      {
        key: "on_ice_shooting_context",
        semantics: "contextual_on_ice",
        currentValue:
          currentOiGf != null && currentOiXgf != null
            ? Number((currentOiGf - currentOiXgf).toFixed(6))
            : null,
        baselineValue:
          baselineOiGf != null && baselineOiXgf != null
            ? Number((baselineOiGf - baselineOiXgf).toFixed(6))
            : null,
        scale: 4,
        weight: 0.2,
      },
    ],
    baselineProvenance: {
      baselineSource: baselineWindowExcluded ? "player_non_overlapping" : "unavailable",
      baselineSnapshotDate: baselineWindowExcluded ? gameDate : null,
      baselineWindowExcluded,
      baselineWeight: baselineWindowExcluded ? 1 : 0,
      peerBaselineValue: null,
      warnings,
    },
  };
}

export async function fetchResultsLuckRollingSources(
  client: SupabaseClient<Database>,
  args: {
    playerIds: number[];
    season: number;
    strength: SkaterWindowStrengthState;
    snapshotDate: string;
    window: SkaterProductionWindow;
  },
) {
  if (args.playerIds.length === 0) return new Map<number, ResultsLuckRollingSource>();

  const { data, error } = await client
    .from("rolling_player_game_metrics")
    .select(resultsLuckRollingSelectFields(args.window).join(","))
    .eq("season", args.season)
    .eq("strength_state", args.strength)
    .eq("game_date", args.snapshotDate)
    .in("player_id", args.playerIds);
  if (error) throw error;

  const sources = new Map<number, ResultsLuckRollingSource>();
  for (const row of ((data ?? []) as unknown as RollingRow[])) {
    const source = buildResultsLuckRollingSourceFromRow({
      row,
      window: args.window,
    });
    if (source) sources.set(source.playerId, source);
  }
  return sources;
}

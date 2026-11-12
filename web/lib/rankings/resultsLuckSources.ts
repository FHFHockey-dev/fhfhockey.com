import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

import {
  ROLLING_WINDOW_COUNT_SUPPORT_VERSION,
  type RollingWindowCountSupport,
} from "lib/rollingPlayerWindowCountSupport";

import type { SkaterProductionWindow, SkaterWindowStrengthState } from "./skaterWindowAggregation";
import {
  attachWindowCountSupport,
  fetchWindowCountSupportForDate,
} from "./rollingWindowCountSupportReader";
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
    "season",
    `toi_seconds_total_${currentWindow}`,
    `oi_gf_total_${currentWindow}`,
    `oi_xgf_total_${currentWindow}`,
    "goals_per_60_goals_season",
    "goals_per_60_toi_seconds_season",
    "ixg_per_60_ixg_season",
    "ixg_per_60_toi_seconds_season",
    "ipp_points_season",
    "ipp_on_ice_goals_for_season",
    "oi_gf_avg_season",
    "oi_xgf_avg_season",
    "toi_seconds_avg_season",
  ];
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function round6(value: number) {
  return Number(value.toFixed(6));
}

function percent(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return round6((numerator / denominator) * 100);
}

function per60(numerator: number | null, toiSeconds: number | null) {
  if (numerator == null || toiSeconds == null || toiSeconds <= 0) return null;
  return round6((numerator / toiSeconds) * 3600);
}

function minus(left: number | null, right: number | null) {
  if (left == null || right == null) return null;
  return round6(left - right);
}

function seasonGames(row: RollingRow) {
  return (
    finite(row.season_participation_games) ??
    finite(row.season_games_played) ??
    finite(row.games_played)
  );
}

type SupportWindow = RollingWindowCountSupport["windows"]["last5"];

function supportWindow(row: RollingRow, window: "last5" | "last10" | "last20") {
  const support = row.windowCountSupport as RollingWindowCountSupport | null | undefined;
  if (support?.version !== ROLLING_WINDOW_COUNT_SUPPORT_VERSION) return null;
  return support.windows?.[window] ?? null;
}

/** `[numerator, denominator]` only when known in every window appearance. */
function fullPair(window: SupportWindow | null, key: string): [number, number] | null {
  const tuple = window?.ratio?.[key];
  if (!window || !Array.isArray(tuple) || window.appearances <= 0) return null;
  const [numerator, denominator, observations] = tuple;
  if (finite(numerator) == null || finite(denominator) == null) return null;
  return observations === window.appearances ? [numerator, denominator] : null;
}

function windowInsideSeason(window: SupportWindow | null, season: number | null) {
  if (!window || season == null) return false;
  const startYear = Math.floor(season / 10_000);
  return window.gameIds.every(
    (gameId) => gameId != null && Math.floor(gameId / 1_000_000) === startYear,
  );
}

/**
 * Results Luck sources (decision 23): (G − ixG)/60 in the window against the
 * non-overlapping baseline (season minus window) on matched exposure, from
 * explicit counts (L6 window counts and paired season count columns). The
 * `_total_lastN` per-60 aliases are rates and are never read (W2-4 D3). A
 * window that reaches into an earlier season has no "season minus window"
 * baseline, so its baseline is unknown.
 */
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
  const support = supportWindow(args.row, currentWindow);
  if (!support) warnings.push("window_count_support_unavailable");
  const insideSeason = windowInsideSeason(support, finite(args.row.season));
  if (support && !insideSeason) warnings.push("window_crosses_seasons_no_baseline");
  const baselineAllowed = args.window !== "season" && insideSeason;

  // Goals and ixG: window counts on the same games and TOI.
  const goalsPair = fullPair(support, "goals_per_60");
  const ixgPair = fullPair(support, "ixg_per_60");
  const windowToi =
    goalsPair && ixgPair && goalsPair[1] === ixgPair[1] ? goalsPair[1] : null;
  const currentGax = per60(
    windowToi == null ? null : minus(goalsPair![0], ixgPair![0]),
    windowToi,
  );
  const seasonGoals = finite(args.row.goals_per_60_goals_season);
  const seasonIxg = finite(args.row.ixg_per_60_ixg_season);
  const seasonGoalsToi = finite(args.row.goals_per_60_toi_seconds_season);
  const seasonIxgToi = finite(args.row.ixg_per_60_toi_seconds_season);
  const seasonToi =
    seasonGoalsToi != null && seasonGoalsToi === seasonIxgToi ? seasonGoalsToi : null;
  const baselineGax =
    baselineAllowed && windowToi != null && seasonToi != null
      ? per60(
          minus(
            minus(seasonGoals, goalsPair![0]),
            minus(seasonIxg, ixgPair![0]),
          ),
          minus(seasonToi, windowToi),
        )
      : null;

  // IPP: points over on-ice goals for, window vs season minus window.
  const ippPair = fullPair(support, "ipp");
  const currentIppPoints = ippPair?.[0] ?? null;
  const currentIppOnIceGoals = ippPair?.[1] ?? null;
  const baselineIppPoints = baselineAllowed
    ? minus(finite(args.row.ipp_points_season), currentIppPoints)
    : null;
  const baselineIppOnIceGoals = baselineAllowed
    ? minus(finite(args.row.ipp_on_ice_goals_for_season), currentIppOnIceGoals)
    : null;

  // On-ice finishing: (GF − xGF)/60 on matched exposure.
  const currentOiGf = finite(args.row[`oi_gf_total_${currentWindow}`]);
  const currentOiXgf = finite(args.row[`oi_xgf_total_${currentWindow}`]);
  const currentOiToi = finite(args.row[`toi_seconds_total_${currentWindow}`]);
  const scaleByGames = (value: unknown) =>
    games != null && finite(value) != null ? round6((finite(value) ?? 0) * games) : null;
  const seasonOiGf = scaleByGames(args.row.oi_gf_avg_season);
  const seasonOiXgf = scaleByGames(args.row.oi_xgf_avg_season);
  const seasonOiToi = scaleByGames(args.row.toi_seconds_avg_season);
  const currentOnIce = support
    ? per60(minus(currentOiGf, currentOiXgf), currentOiToi)
    : null;
  const baselineOnIce = baselineAllowed
    ? per60(
        minus(minus(seasonOiGf, currentOiGf), minus(seasonOiXgf, currentOiXgf)),
        minus(seasonOiToi, currentOiToi),
      )
    : null;

  const baselineWindowExcluded =
    baselineAllowed &&
    [baselineGax, baselineIppPoints, baselineIppOnIceGoals, baselineOnIce].every(
      (value) => value != null,
    );

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
        currentValue: currentGax,
        baselineValue: baselineGax,
        // Goals above expected per 60 minutes (decision 23).
        scale: 1,
        weight: 0.35,
      },
      {
        key: "sax_percentage",
        semantics: "signed_difference",
        // Needs a season unblocked-attempt count for the baseline, which is
        // not stored yet; unknown keeps the index unpublished.
        currentValue: (() => {
          const xsPair = fullPair(support, "expected_sh_pct");
          return xsPair && goalsPair
            ? percent(minus(goalsPair[0], xsPair[0]), xsPair[1])
            : null;
        })(),
        baselineValue: null,
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
        currentValue: currentOnIce,
        baselineValue: baselineOnIce,
        scale: 2,
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

  const supportRows = await fetchWindowCountSupportForDate(client as never, {
    season: args.season,
    strength: args.strength,
    gameDate: args.snapshotDate,
  });
  const rows = attachWindowCountSupport(
    (data ?? []) as never,
    supportRows,
  ) as unknown as RollingRow[];
  const sources = new Map<number, ResultsLuckRollingSource>();
  for (const row of rows) {
    const source = buildResultsLuckRollingSourceFromRow({
      row,
      window: args.window,
    });
    if (source) sources.set(source.playerId, source);
  }
  return sources;
}

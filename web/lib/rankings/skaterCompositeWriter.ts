import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import supabase from "lib/supabase/server";

import type { ContextualRankingMetricKey } from "./metricDefinitions";
import { buildContextualRankingsSurface } from "./rankingQueries";
import type {
  ContextualRankingApiRow,
  ContextualRankingsDeploymentFilter,
  ContextualRankingsPositionFilter,
  ContextualRankingsRequest,
} from "./rankingTypes";
import type { ContextualRankingPeerGroupType } from "./rankingCalculator";
import type {
  SkaterProductionWindow,
  SkaterWindowStrengthState,
} from "./skaterWindowAggregation";
import {
  canPersistComponentAwareResultsLuckIndex,
  calculateComponentAwareResultsLuckIndex,
  type ResultsLuckBaselineProvenance,
} from "./resultsLuckIndex";
import {
  fetchResultsLuckRollingSources,
  type ResultsLuckRollingSource,
} from "./resultsLuckSources";
import {
  BEAST_TIER_GATES,
  DEFENSE_RATING_CONTRACT,
  MCM_COMPONENTS,
  MCM_SCORE_CONTRACT,
  OFFENSE_RATING_CONTRACT,
  RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT,
  RESULTS_LUCK_INDEX_CONTRACT,
  RESULTS_LUCK_SIGNAL_COMPONENTS,
  SKATER_ARCHETYPE_TAG_CONTRACTS,
} from "./skaterCompositeMethodology";

export type SkaterCompositeRatingInsert =
  Database["public"]["Tables"]["skater_composite_ratings"]["Insert"];

export type SkaterCompositeBuildRequest = {
  season: number;
  asOfDate: string | null;
  window: SkaterProductionWindow;
  position: ContextualRankingsPositionFilter;
  deployment: ContextualRankingsDeploymentFilter;
  strength: SkaterWindowStrengthState;
  minGp: number | null;
  minToiSeconds: number | null;
  teamId: number | null;
  peerGroupType: ContextualRankingPeerGroupType;
  limit: number;
};

type MetricPercentileMap = Record<string, number | null>;

type MetricSurfaceEntry = {
  metricKey: ContextualRankingMetricKey;
  rowsByPlayerId: Map<number, ContextualRankingApiRow>;
  snapshotDate: string | null;
  snapshotUpdatedAt: string | null;
  unavailable: boolean;
  message: string | null;
};

export type SkaterCompositeSourceFreshness = {
  metricKey: ContextualRankingMetricKey;
  snapshotDate: string | null;
  snapshotUpdatedAt: string | null;
  unavailable: boolean;
  reason: string | null;
};

export type SkaterCompositeBuildResult = {
  request: SkaterCompositeBuildRequest;
  rows: SkaterCompositeRatingInsert[];
  snapshotDate: string | null;
  snapshotUpdatedAt: string | null;
  sourceMetrics: ContextualRankingMetricKey[];
  sourceFreshness: SkaterCompositeSourceFreshness[];
  unavailableMetrics: Array<{
    metricKey: ContextualRankingMetricKey;
    reason: string;
  }>;
};

const METHODOLOGY_VERSION = "contextual_composites_v1";
const UPSERT_CONFLICT_COLUMNS =
  "player_id,season_id,snapshot_date,window_type,window_size,strength_state,peer_group_type,peer_group_key";

export const SKATER_COMPOSITE_SOURCE_METRICS = [
  "goals_per_60",
  "points_per_60",
  "pp_points_per_60",
  "ixg_per_60",
  "shot_attempts_per_60",
  "sog_per_60",
  "primary_assists_per_60",
  "assists_per_60",
  "expected_shooting_percentage",
  "sax_percentage",
  "goals_above_expected",
  "xga_per_60",
  "on_ice_xgf_percentage",
  "on_ice_gf_percentage",
  "blocks_per_60",
  "hits_per_60",
] as const satisfies readonly ContextualRankingMetricKey[];

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number | null, digits = 2) {
  if (value == null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampPercentile(value: number | null) {
  if (value == null) return null;
  return Math.max(0, Math.min(100, value));
}

function average(values: Array<number | null>) {
  const finiteValues = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function averageTopN(values: Array<number | null>, count: number) {
  const finiteValues = values
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => b - a);
  if (finiteValues.length < count) return null;
  return finiteValues.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
}

function weightedAverage(
  entries: Array<{ value: number | null; weight: number }>,
) {
  const usable = entries.filter((entry) => entry.value != null);
  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (usable.length === 0 || totalWeight <= 0) return null;
  return usable.reduce((sum, entry) => sum + (entry.value ?? 0) * entry.weight, 0) / totalWeight;
}

function countAtLeast(values: Array<number | null>, threshold: number) {
  return values.filter((value) => value != null && value >= threshold).length;
}

function percentilesFor(
  metricRows: MetricSurfaceEntry[],
  playerId: number,
): MetricPercentileMap {
  const percentiles: MetricPercentileMap = {};
  for (const entry of metricRows) {
    percentiles[entry.metricKey] =
      entry.rowsByPlayerId.get(playerId)?.metric.percentile ?? null;
  }
  return percentiles;
}

function windowType(window: SkaterProductionWindow) {
  if (window === "last5") return "last_5";
  if (window === "last10") return "last_10";
  if (window === "last20") return "last_20";
  return "season";
}

function windowSize(window: SkaterProductionWindow) {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return 0;
}

function windowSemantics(window: SkaterProductionWindow) {
  return window === "season" ? "season_to_date" : "player_last_n_games_played";
}

function requestPeerGroupKey(request: SkaterCompositeBuildRequest) {
  if (request.teamId != null) return String(request.teamId);
  if (request.deployment !== "all") return request.deployment;
  if (request.position === "F" || request.position === "D") return request.position;
  return "all_skaters";
}

function requestPositionGroup(
  request: SkaterCompositeBuildRequest,
  baseRow: ContextualRankingApiRow,
) {
  if (request.position === "F") return "forward";
  if (request.position === "D") return "defense";
  return baseRow.entity.positionGroup ?? null;
}

function contextualRequestForMetric(
  request: SkaterCompositeBuildRequest,
  metric: ContextualRankingMetricKey,
): ContextualRankingsRequest {
  return {
    entity: "skaters",
    season: request.season,
    asOfDate: request.asOfDate,
    window: request.window,
    position: request.position,
    deployment: request.deployment,
    strength: request.strength,
    metric,
    minGp: request.minGp,
    minToiSeconds: request.minToiSeconds,
    teamId: request.teamId,
    peerGroupType: request.peerGroupType,
    sort: "percentile",
    direction: "desc",
    limit: request.limit,
    entityIds: null,
  };
}

function sourceSnapshotDate(entries: MetricSurfaceEntry[]) {
  return entries.find((entry) => entry.snapshotDate != null)?.snapshotDate ?? null;
}

function sourceSnapshotUpdatedAt(entries: MetricSurfaceEntry[]) {
  return entries.find((entry) => entry.snapshotUpdatedAt != null)?.snapshotUpdatedAt ?? null;
}

function sourceRowsByPlayerId(entries: MetricSurfaceEntry[]) {
  const rows = new Map<number, ContextualRankingApiRow>();
  for (const entry of entries) {
    for (const row of entry.rowsByPlayerId.values()) {
      rows.set(row.entity.id, rows.get(row.entity.id) ?? row);
    }
  }
  return rows;
}

function buildUnavailableResultsLuckProvenance(request: SkaterCompositeBuildRequest) {
  return {
    baselineSource: "unavailable",
    baselineSnapshotDate: null,
    baselineWindowExcluded: false,
    baselineWeight: 0,
    peerBaselineValue: null,
    currentWindow: request.window,
    warnings: [
      "baseline_not_persisted",
      "selected_window_exclusion_not_verified",
    ],
  } satisfies ResultsLuckBaselineProvenance & { currentWindow: SkaterProductionWindow };
}

function sourceFreshness(entries: MetricSurfaceEntry[]): SkaterCompositeSourceFreshness[] {
  return entries.map((entry) => ({
    metricKey: entry.metricKey,
    snapshotDate: entry.snapshotDate,
    snapshotUpdatedAt: entry.snapshotUpdatedAt,
    unavailable: entry.unavailable,
    reason: entry.unavailable ? entry.message ?? "Metric unavailable in this context." : null,
  }));
}

export function calculateOffenseRating(percentiles: MetricPercentileMap) {
  const scoringRateScore = average([
    percentiles.goals_per_60,
    percentiles.points_per_60,
  ]);
  const chanceCreationScore = average([
    percentiles.ixg_per_60,
    percentiles.shot_attempts_per_60,
    percentiles.sog_per_60,
  ]);
  const playmakingScore = average([
    percentiles.primary_assists_per_60,
    percentiles.assists_per_60,
  ]);
  const finishingContextScore = average([
    percentiles.expected_shooting_percentage,
    percentiles.sax_percentage,
    percentiles.goals_above_expected,
  ]);

  return round(
    clampPercentile(
      weightedAverage([
        { value: scoringRateScore, weight: 0.35 },
        { value: chanceCreationScore, weight: 0.3 },
        { value: playmakingScore, weight: 0.2 },
        { value: finishingContextScore, weight: 0.15 },
      ]),
    ),
  );
}

export function calculateDefenseRating(percentiles: MetricPercentileMap) {
  const suppressionScore = average([percentiles.xga_per_60]);
  const onIceProcessScore = average([
    percentiles.on_ice_xgf_percentage,
    percentiles.on_ice_gf_percentage,
  ]);
  const physicalSupportScore = average([percentiles.blocks_per_60]);

  return round(
    clampPercentile(
      weightedAverage([
        { value: suppressionScore, weight: 0.45 },
        { value: onIceProcessScore, weight: 0.35 },
        { value: physicalSupportScore, weight: 0.2 },
      ]),
    ),
  );
}

export function calculateMcmScore(percentiles: MetricPercentileMap) {
  const riffPercentiles = MCM_COMPONENTS.riff.map((metric) => percentiles[metric]);
  const scoringPercentiles = MCM_COMPONENTS.scoring.map((metric) => percentiles[metric]);
  const riffScore = averageTopN(riffPercentiles, 2);
  const scoringScore = averageTopN(scoringPercentiles, 1);
  const depthScore = average([...riffPercentiles, ...scoringPercentiles]);
  if (riffScore == null || scoringScore == null || depthScore == null) return null;
  return round(
    clampPercentile(0.45 * riffScore + 0.35 * scoringScore + 0.2 * depthScore),
  );
}

export function resolveBeastTier(
  percentiles: MetricPercentileMap,
  mcmScore: number | null,
) {
  const riffPercentiles = MCM_COMPONENTS.riff.map((metric) => percentiles[metric]);
  const scoringPercentiles = MCM_COMPONENTS.scoring.map((metric) => percentiles[metric]);
  const allPercentiles = [...riffPercentiles, ...scoringPercentiles];

  for (const gate of BEAST_TIER_GATES) {
    if (gate.minimumMcmScore != null && (mcmScore == null || mcmScore < gate.minimumMcmScore)) {
      continue;
    }
    if (countAtLeast(riffPercentiles, gate.riffThresholds.percentile) < gate.riffThresholds.count) {
      continue;
    }
    if (
      countAtLeast(scoringPercentiles, gate.scoringThresholds.percentile) <
      gate.scoringThresholds.count
    ) {
      continue;
    }
    if (
      gate.allCategoryThresholds &&
      countAtLeast(allPercentiles, gate.allCategoryThresholds.percentile) <
        gate.allCategoryThresholds.count
    ) {
      continue;
    }
    return gate.tier;
  }
  return null;
}

export function calculateArchetypeScores(percentiles: MetricPercentileMap) {
  const shootFirstScore = round(
    clampPercentile(
      weightedAverage([
        { value: percentiles.shot_attempts_per_60, weight: 0.55 },
        { value: percentiles.sog_per_60, weight: 0.35 },
        {
          value:
            percentiles.primary_assists_per_60 == null
              ? null
              : 100 - percentiles.primary_assists_per_60,
          weight: 0.1,
        },
      ]),
    ),
  );
  const passFirstScore = round(
    clampPercentile(
      weightedAverage([
        { value: percentiles.primary_assists_per_60, weight: 0.6 },
        { value: percentiles.assists_per_60, weight: 0.3 },
        {
          value:
            percentiles.shot_attempts_per_60 == null
              ? null
              : 100 - percentiles.shot_attempts_per_60,
          weight: 0.1,
        },
      ]),
    ),
  );
  const playDriverScore = round(
    clampPercentile(
      weightedAverage([
        { value: percentiles.on_ice_xgf_percentage, weight: 0.5 },
        { value: percentiles.shot_attempts_per_60, weight: 0.25 },
        { value: percentiles.primary_assists_per_60, weight: 0.25 },
      ]),
    ),
  );

  return {
    shootFirstScore,
    passFirstScore,
    playDriverScore,
  };
}

function archetypeTags(args: {
  percentiles: MetricPercentileMap;
  scores: ReturnType<typeof calculateArchetypeScores>;
}) {
  const tags: string[] = [];
  if (
    args.percentiles.shot_attempts_per_60 != null &&
    args.percentiles.shot_attempts_per_60 >= 75 &&
    (args.percentiles.primary_assists_per_60 ?? 0) < 70
  ) {
    tags.push("shoot_first");
  }
  if (
    args.percentiles.primary_assists_per_60 != null &&
    args.percentiles.primary_assists_per_60 >= 75 &&
    (args.percentiles.shot_attempts_per_60 ?? 0) < 70
  ) {
    tags.push("pass_first");
  }
  if (
    args.percentiles.on_ice_xgf_percentage != null &&
    args.percentiles.on_ice_xgf_percentage >= 70 &&
    Math.max(
      args.percentiles.shot_attempts_per_60 ?? 0,
      args.percentiles.primary_assists_per_60 ?? 0,
    ) >= 70
  ) {
    tags.push("play_driver");
  }
  if ((args.scores.shootFirstScore ?? 0) >= 85) tags.push("high_shot_volume");
  if ((args.scores.passFirstScore ?? 0) >= 85) tags.push("high_playmaking");
  return [...new Set(tags)];
}

function flagCounts(percentiles: MetricPercentileMap) {
  const riffPercentiles = MCM_COMPONENTS.riff.map((metric) => percentiles[metric]);
  const scoringPercentiles = MCM_COMPONENTS.scoring.map((metric) => percentiles[metric]);
  return {
    totalAt70: countAtLeast([...riffPercentiles, ...scoringPercentiles], 70),
    riffAt70: countAtLeast(riffPercentiles, 70),
    scoringAt70: countAtLeast(scoringPercentiles, 70),
  };
}

export function buildSkaterCompositeRatingRow(args: {
  request: SkaterCompositeBuildRequest;
  baseRow: ContextualRankingApiRow;
  snapshotDate: string;
  snapshotUpdatedAt: string | null;
  percentiles: MetricPercentileMap;
  unavailableMetrics: SkaterCompositeBuildResult["unavailableMetrics"];
  sourceFreshness: SkaterCompositeSourceFreshness[];
  resultsLuckSource?: ResultsLuckRollingSource | null;
}): SkaterCompositeRatingInsert {
  const offenseRating = calculateOffenseRating(args.percentiles);
  const defenseRating = calculateDefenseRating(args.percentiles);
  const mcmScore = calculateMcmScore(args.percentiles);
  const beastTier = resolveBeastTier(args.percentiles, mcmScore);
  const archetypeScores = calculateArchetypeScores(args.percentiles);
  const tags = archetypeTags({
    percentiles: args.percentiles,
    scores: archetypeScores,
  });
  if (beastTier) tags.push(beastTier);
  const counts = flagCounts(args.percentiles);
  const isDeploymentContext = args.request.deployment !== "all";
  const resultsLuckScore = args.resultsLuckSource
    ? calculateComponentAwareResultsLuckIndex({
        components: args.resultsLuckSource.components,
        baselineProvenance: args.resultsLuckSource.baselineProvenance,
        currentWindow: args.request.window,
      })
    : null;
  const resultsLuckIndex =
    resultsLuckScore && canPersistComponentAwareResultsLuckIndex(resultsLuckScore)
      ? round(resultsLuckScore.indexValue)
      : null;
  const resultsLuckBaselineProvenance =
    args.resultsLuckSource?.baselineProvenance ??
    buildUnavailableResultsLuckProvenance(args.request);

  return {
    player_id: args.baseRow.entity.id,
    team_id: finite(args.baseRow.team.id),
    season_id: args.request.season,
    snapshot_date: args.snapshotDate,
    window_type: windowType(args.request.window),
    window_size: windowSize(args.request.window),
    window_semantics: windowSemantics(args.request.window),
    strength_state: args.request.strength,
    peer_group_type: args.request.peerGroupType,
    peer_group_key: requestPeerGroupKey(args.request),
    position_group: requestPositionGroup(args.request, args.baseRow),
    deployment_bucket: isDeploymentContext ? args.request.deployment : "all",
    offense_rating_overall: isDeploymentContext ? null : offenseRating,
    offense_rating_deployment: isDeploymentContext ? offenseRating : null,
    defense_rating_overall: isDeploymentContext ? null : defenseRating,
    defense_rating_deployment: isDeploymentContext ? defenseRating : null,
    mcm_score: mcmScore,
    beast_tier: beastTier,
    shoot_first_score: archetypeScores.shootFirstScore,
    pass_first_score: archetypeScores.passFirstScore,
    play_driver_score: archetypeScores.playDriverScore,
    results_luck_index: resultsLuckIndex,
    tags: tags as unknown as Json,
    components_json: {
      percentiles: args.percentiles,
      mcm: {
        formula: MCM_SCORE_CONTRACT.formula,
        flagCounts: counts,
        visibleThresholds: BEAST_TIER_GATES,
      },
      offense: OFFENSE_RATING_CONTRACT,
      defense: DEFENSE_RATING_CONTRACT,
      archetypes: SKATER_ARCHETYPE_TAG_CONTRACTS,
      resultsLuck: {
        ...RESULTS_LUCK_INDEX_CONTRACT,
        signalComponents: RESULTS_LUCK_SIGNAL_COMPONENTS,
        persistence: RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT,
        baselineProvenance: resultsLuckBaselineProvenance,
        score: resultsLuckScore,
        status: resultsLuckIndex == null ? "not_computed" : "computed",
        reason:
          resultsLuckIndex == null
            ? "Verified selected-window-excluded Results Luck source values were unavailable or failed the publish gate."
            : null,
      },
    } as unknown as Json,
    provenance: {
      methodologyVersion: METHODOLOGY_VERSION,
      snapshotUpdatedAt: args.snapshotUpdatedAt,
      peerGroupType: args.request.peerGroupType,
      peerGroupKey: requestPeerGroupKey(args.request),
      deployment: args.request.deployment,
      sourceMetrics: SKATER_COMPOSITE_SOURCE_METRICS,
      sourceFreshness: args.sourceFreshness,
      unavailableMetrics: args.unavailableMetrics,
      caveats: [
        ...MCM_SCORE_CONTRACT.caveats,
        ...DEFENSE_RATING_CONTRACT.caveats,
      ],
    } as unknown as Json,
    methodology_version: METHODOLOGY_VERSION,
  };
}

export async function buildSkaterCompositeRatingRows(
  request: SkaterCompositeBuildRequest,
): Promise<SkaterCompositeBuildResult> {
  const metricEntries = await Promise.all(
    SKATER_COMPOSITE_SOURCE_METRICS.map(async (metricKey) => {
      const surface = await buildContextualRankingsSurface(
        contextualRequestForMetric(request, metricKey),
      );
      return {
        metricKey,
        rowsByPlayerId: new Map(
          surface.rankings.map((row) => [row.entity.id, row]),
        ),
        snapshotDate: surface.meta.snapshotDate,
        snapshotUpdatedAt: surface.meta.snapshotUpdatedAt,
        unavailable: surface.meta.unavailable,
        message: surface.meta.message,
      } satisfies MetricSurfaceEntry;
    }),
  );
  const unavailableMetrics = metricEntries.flatMap((entry) =>
    entry.unavailable
      ? [
          {
            metricKey: entry.metricKey,
            reason: entry.message ?? "Metric unavailable in this context.",
          },
        ]
      : [],
  );
  const snapshotDate = sourceSnapshotDate(metricEntries);
  const snapshotUpdatedAt = sourceSnapshotUpdatedAt(metricEntries);
  const freshness = sourceFreshness(metricEntries);
  const baseRows = sourceRowsByPlayerId(metricEntries);
  const resultsLuckSources =
    snapshotDate == null
      ? new Map<number, ResultsLuckRollingSource>()
      : await fetchResultsLuckRollingSources(supabase, {
          playerIds: [...baseRows.keys()],
          season: request.season,
          strength: request.strength,
          snapshotDate,
          window: request.window,
        });

  const rows =
    snapshotDate == null
      ? []
      : [...baseRows.values()].map((baseRow) =>
          buildSkaterCompositeRatingRow({
            request,
            baseRow,
            snapshotDate,
            snapshotUpdatedAt,
            percentiles: percentilesFor(metricEntries, baseRow.entity.id),
            unavailableMetrics,
            sourceFreshness: freshness,
            resultsLuckSource: resultsLuckSources.get(baseRow.entity.id) ?? null,
          }),
        );

  return {
    request,
    rows,
    snapshotDate,
    snapshotUpdatedAt,
    sourceMetrics: [...SKATER_COMPOSITE_SOURCE_METRICS],
    sourceFreshness: freshness,
    unavailableMetrics,
  };
}

export async function upsertSkaterCompositeRatingRows(
  client: SupabaseClient<Database>,
  rows: SkaterCompositeRatingInsert[],
) {
  const chunkSize = 250;
  let rowsUpserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client
      .from("skater_composite_ratings")
      .upsert(chunk, { onConflict: UPSERT_CONFLICT_COLUMNS });
    if (error) {
      throw new Error(`Failed to upsert skater_composite_ratings: ${error.message}`);
    }
    rowsUpserted += chunk.length;
  }

  return rowsUpserted;
}

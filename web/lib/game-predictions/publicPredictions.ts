import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import type { GamePredictionFeatureSnapshotPayload } from "./featureBuilder";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type PublicPredictionTeam = {
  id: number;
  abbreviation: string;
  name: string;
};

export type PublicPredictionFactor = {
  featureKey: string;
  label: string;
  value: number | null;
  contribution: number | null;
  direction: "home" | "away" | "neutral";
};

export type PublicPredictionMatchup = {
  homeOffRating: number | null;
  awayOffRating: number | null;
  homeDefRating: number | null;
  awayDefRating: number | null;
  homeGoalieRating: number | null;
  awayGoalieRating: number | null;
  homeSpecialRating: number | null;
  awaySpecialRating: number | null;
  homeRestDays: number | null;
  awayRestDays: number | null;
  homeGoalieGsaaPer60: number | null;
  awayGoalieGsaaPer60: number | null;
  homeGoalieConfirmed: boolean;
  awayGoalieConfirmed: boolean;
  homeGoalieSource: string | null;
  awayGoalieSource: string | null;
  homeGoalieName: string | null;
  awayGoalieName: string | null;
  homeGoalieId: number | null;
  awayGoalieId: number | null;
  optionalPlayerImpactAvailable: boolean;
};

export type PublicGamePrediction = {
  gameId: number;
  snapshotDate: string;
  startTime: string | null;
  homeTeam: PublicPredictionTeam;
  awayTeam: PublicPredictionTeam;
  homeWinProbability: number | null;
  awayWinProbability: number | null;
  predictedWinnerTeamId: number | null;
  confidenceLabel: string | null;
  computedAt: string;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string | null;
  freshness: {
    hasStaleSource: boolean;
    warnings: Array<{ code: string; message: string; source?: string }>;
    staleSources: Array<{ table: string; cutoff: string | null }>;
  };
  factors: PublicPredictionFactor[];
  matchup: PublicPredictionMatchup | null;
};

export type PublicPredictionPerformance = {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  evaluatedGames: number;
  evaluationStartDate: string;
  evaluationEndDate: string;
  accuracy: number | null;
  logLoss: number | null;
  brierScore: number | null;
  calibrationSummary: string | null;
  computedAt: string;
} | null;

export type PublicGamePredictionsPayload = {
  generatedAt: string;
  count: number;
  predictions: PublicGamePrediction[];
  performance: PublicPredictionPerformance;
};

type OutputRow = Tables<"game_prediction_outputs">;
type HistoryRow = Tables<"game_prediction_history">;
type FeatureSnapshotRow = Tables<"game_prediction_feature_snapshots">;
type TeamRow = Pick<Tables<"teams">, "id" | "abbreviation" | "name">;
type GameRow = Pick<Tables<"games">, "id" | "startTime">;
type MetricRow = Tables<"game_prediction_model_metrics">;
type ModelVersionRow = Tables<"game_prediction_model_versions">;

const FACTOR_LABELS: Record<string, string> = {
  homeMinusAwayOffRating: "Offense rating edge",
  homeMinusAwayDefRating: "Defense rating edge",
  homeMinusAwayGoalieRating: "Goalie rating edge",
  homeMinusAwaySpecialRating: "Special teams edge",
  homeMinusAwayPointPctg: "Standings point rate edge",
  homeMinusAwayGoalDifferential: "Goal differential edge",
  homeMinusAwayRecent5GoalDifferentialPerGame: "Last 5 goal differential edge",
  homeMinusAwayRecent10GoalDifferentialPerGame: "Last 10 goal differential edge",
  homeMinusAwayRecent20GoalDifferentialPerGame: "Last 20 goal differential edge",
  homeMinusAwayRecent40GoalDifferentialPerGame: "Last 40 goal differential edge",
  homeMinusAwayRecent5XgfPct: "Last 5 xG share edge",
  homeMinusAwayRecent10XgfPct: "Last 10 xG share edge",
  homeMinusAwayRecent20XgfPct: "Last 20 xG share edge",
  homeMinusAwayRecent40XgfPct: "Last 40 xG share edge",
  homeMinusAwaySeasonToDateXgfPct: "Season xG share edge",
  homeMinusAwayCrossSeasonPriorXgfPct: "Early-season prior xG edge",
  homeMinusAwayRecent10PointPct: "Last 10 point rate edge",
  homeMinusAwaySeasonToDatePointPct: "Season point rate edge",
  homeMinusAwayRecent20ShotShare: "Last 20 shot share edge",
  homeMinusAwayRecent40ShotShare: "Last 40 shot share edge",
  homeMinusAwayRecent20FenwickShare: "Last 20 Fenwick share edge",
  homeMinusAwayRecent40FenwickShare: "Last 40 Fenwick share edge",
  homeMinusAwayRecent20GfPct: "Last 20 goal share edge",
  homeMinusAwayRecent40GfPct: "Last 40 goal share edge",
  homeMinusAwayRecent20XgaPer60: "Last 20 xGA/60 edge",
  homeMinusAwayRecent40XgaPer60: "Last 40 xGA/60 edge",
  homeMinusAwayCtpi: "Team context pressure edge",
  homeMinusAwayPastOpponentCompositeRating: "Recent schedule strength edge",
  homeMinusAwayForgeProjectedGoals: "Projected goals edge",
  homeMinusAwayForgeProjectedShots: "Projected shots edge",
  homeMinusAwayWeightedGoalieGsaaPer60: "Projected goalie GSAA edge",
  homeMinusAwayGoalieStartUncertainty: "Goalie starter certainty edge",
  homeRestAdvantageDays: "Rest edge",
  homeMinusAwayGamesPlayedAsOf: "Games-played context edge",
  seasonPhaseOrdinal: "Season phase context",
  homeMarketNoVigProbability: "Market implied probability",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publicExplanationFeatureKeys(
  output: OutputRow,
  history?: HistoryRow,
): Set<string> {
  const metadataSources = [history?.metadata, output.metadata];
  for (const metadata of metadataSources) {
    if (!isRecord(metadata)) continue;
    const keys = metadata.public_explanation_feature_keys;
    if (Array.isArray(keys)) {
      return new Set(keys.filter((key): key is string => typeof key === "string"));
    }
  }
  return new Set();
}

function extractTopFactors(
  output: OutputRow,
  history?: HistoryRow,
): PublicPredictionFactor[] {
  const source = Array.isArray(history?.top_factors)
    ? history?.top_factors
    : isRecord(output.components) &&
        Array.isArray(output.components.top_factors)
      ? output.components.top_factors
      : [];
  const allowedFeatureKeys = publicExplanationFeatureKeys(output, history);

  return source.flatMap((factor) => {
    if (!isRecord(factor)) return [];
    const featureKey = String(factor.featureKey ?? "");
    if (!featureKey || !allowedFeatureKeys.has(featureKey)) return [];
    const contribution = toNumber(factor.contribution);
    return [
      {
        featureKey,
        label: FACTOR_LABELS[featureKey] ?? featureKey,
        value: toNumber(factor.value),
        contribution,
        direction:
          contribution == null || Math.abs(contribution) < 0.0001
            ? "neutral"
            : contribution > 0
              ? "home"
              : "away",
      },
    ];
  });
}

function extractFreshness(
  output: OutputRow,
  payload?: GamePredictionFeatureSnapshotPayload,
): PublicGamePrediction["freshness"] {
  const metadata = isRecord(output.metadata) ? output.metadata : {};
  const warnings = Array.isArray(metadata.warnings)
    ? metadata.warnings.flatMap((warning) => {
        if (!isRecord(warning)) return [];
        return [
          {
            code: String(warning.code ?? "warning"),
            message: String(warning.message ?? ""),
            source:
              typeof warning.source === "string" ? warning.source : undefined,
          },
        ];
      })
    : (payload?.warnings ?? []);

  const sourceCutoffs = payload?.sourceCutoffs ?? [];
  return {
    hasStaleSource:
      metadata.has_stale_source === true ||
      sourceCutoffs.some((cutoff) => cutoff.stale),
    warnings,
    staleSources: sourceCutoffs
      .filter((cutoff) => cutoff.stale)
      .map((cutoff) => ({ table: cutoff.table, cutoff: cutoff.cutoff })),
  };
}

function toFeaturePayload(
  snapshot?: FeatureSnapshotRow,
): GamePredictionFeatureSnapshotPayload | undefined {
  if (!snapshot || !isRecord(snapshot.feature_payload)) return undefined;
  return snapshot.feature_payload as unknown as GamePredictionFeatureSnapshotPayload;
}

function buildMatchup(
  payload?: GamePredictionFeatureSnapshotPayload,
): PublicPredictionMatchup | null {
  if (!payload) return null;
  return {
    homeOffRating: payload.home.teamPower?.offRating ?? null,
    awayOffRating: payload.away.teamPower?.offRating ?? null,
    homeDefRating: payload.home.teamPower?.defRating ?? null,
    awayDefRating: payload.away.teamPower?.defRating ?? null,
    homeGoalieRating: payload.home.teamPower?.goalieRating ?? null,
    awayGoalieRating: payload.away.teamPower?.goalieRating ?? null,
    homeSpecialRating: payload.home.teamPower?.specialRating ?? null,
    awaySpecialRating: payload.away.teamPower?.specialRating ?? null,
    homeRestDays: payload.home.daysRest,
    awayRestDays: payload.away.daysRest,
    homeGoalieGsaaPer60: payload.home.goalie.weightedProjectedGsaaPer60,
    awayGoalieGsaaPer60: payload.away.goalie.weightedProjectedGsaaPer60,
    homeGoalieConfirmed: payload.home.goalie.confirmed,
    awayGoalieConfirmed: payload.away.goalie.confirmed,
    homeGoalieSource: payload.home.goalie.source,
    awayGoalieSource: payload.away.goalie.source,
    homeGoalieName: payload.home.goalie.topGoalieName,
    awayGoalieName: payload.away.goalie.topGoalieName,
    homeGoalieId: payload.home.goalie.topGoalieId,
    awayGoalieId: payload.away.goalie.topGoalieId,
    optionalPlayerImpactAvailable: Boolean(
      payload.home.lineup || payload.away.lineup,
    ),
  };
}

function mapTeam(
  row: TeamRow | undefined,
  teamId: number,
): PublicPredictionTeam {
  return {
    id: teamId,
    abbreviation: row?.abbreviation ?? String(teamId),
    name: row?.name ?? `Team ${teamId}`,
  };
}

function outputKey(
  row: Pick<
    OutputRow,
    "game_id" | "model_name" | "model_version" | "prediction_scope"
  >,
) {
  return `${row.game_id}|${row.model_name}|${row.model_version}|${row.prediction_scope}`;
}

function modelMetricKey(row: {
  model_name: string;
  model_version: string;
  feature_set_version: string;
}) {
  return `${row.model_name}|${row.model_version}|${row.feature_set_version}`;
}

function outputFeatureSetVersion(
  output: OutputRow,
  history?: HistoryRow,
): string | null {
  if (history?.feature_set_version) return history.feature_set_version;
  if (
    isRecord(output.metadata) &&
    typeof output.metadata.feature_set_version === "string"
  ) {
    return output.metadata.feature_set_version;
  }
  return null;
}

export function buildPublicGamePredictionsPayload(args: {
  outputs: OutputRow[];
  histories?: HistoryRow[];
  featureSnapshots?: FeatureSnapshotRow[];
  teams?: TeamRow[];
  games?: GameRow[];
  metrics?: MetricRow[];
  modelVersions?: ModelVersionRow[];
  generatedAt?: string;
}): PublicGamePredictionsPayload {
  const teamsById = new Map((args.teams ?? []).map((team) => [team.id, team]));
  const gamesById = new Map((args.games ?? []).map((game) => [game.id, game]));
  const snapshotsById = new Map(
    (args.featureSnapshots ?? []).map((snapshot) => [
      snapshot.feature_snapshot_id,
      snapshot,
    ]),
  );
  const historyByOutputKey = new Map<string, HistoryRow>();
  for (const history of args.histories ?? []) {
    const key = outputKey(history);
    const current = historyByOutputKey.get(key);
    if (!current || history.computed_at > current.computed_at) {
      historyByOutputKey.set(key, history);
    }
  }
  const productionModelKeys = args.modelVersions
    ? new Set(
        args.modelVersions
          .filter((model) => model.status === "production")
          .map(modelMetricKey),
      )
    : null;

  const publicOutputs = args.outputs.filter((output) => {
    const history = historyByOutputKey.get(outputKey(output));
    if (!productionModelKeys) return true;
    const featureSetVersion = outputFeatureSetVersion(output, history);
    return featureSetVersion
      ? productionModelKeys.has(
          modelMetricKey({
            model_name: output.model_name,
            model_version: output.model_version,
            feature_set_version: featureSetVersion,
          }),
        )
      : false;
  });

  const predictions = publicOutputs.map((output) => {
    const history = historyByOutputKey.get(outputKey(output));
    const payload = toFeaturePayload(
      history?.feature_snapshot_id
        ? snapshotsById.get(history.feature_snapshot_id)
        : undefined,
    );

    return {
      gameId: output.game_id,
      snapshotDate: output.snapshot_date,
      startTime: gamesById.get(output.game_id)?.startTime ?? null,
      homeTeam: mapTeam(
        teamsById.get(output.home_team_id),
        output.home_team_id,
      ),
      awayTeam: mapTeam(
        teamsById.get(output.away_team_id),
        output.away_team_id,
      ),
      homeWinProbability: output.home_win_probability,
      awayWinProbability: output.away_win_probability,
      predictedWinnerTeamId:
        history?.predicted_winner_team_id ??
        (output.home_win_probability != null &&
        output.away_win_probability != null
          ? output.home_win_probability >= output.away_win_probability
            ? output.home_team_id
            : output.away_team_id
          : null),
      confidenceLabel:
        history?.confidence_label ??
        (isRecord(output.metadata) &&
        typeof output.metadata.confidence_label === "string"
          ? output.metadata.confidence_label
          : null),
      computedAt: output.computed_at,
      modelName: output.model_name,
      modelVersion: output.model_version,
      featureSetVersion: outputFeatureSetVersion(output, history),
      freshness: extractFreshness(output, payload),
      factors: extractTopFactors(output, history),
      matchup: buildMatchup(payload),
    };
  });

  const visiblePredictionMetricKeys = new Set(
    predictions.flatMap((prediction) =>
      prediction.featureSetVersion
        ? [
            modelMetricKey({
              model_name: prediction.modelName,
              model_version: prediction.modelVersion,
              feature_set_version: prediction.featureSetVersion,
            }),
          ]
        : [],
    ),
  );
  const allowedMetricKeys =
    visiblePredictionMetricKeys.size > 0
      ? visiblePredictionMetricKeys
      : productionModelKeys;
  const overallMetric =
    (args.metrics ?? [])
      .filter(
        (metric) =>
          metric.segment_key === "overall" &&
          metric.segment_value === "all" &&
          (allowedMetricKeys == null ||
            allowedMetricKeys.has(modelMetricKey(metric))),
      )
      .sort((a, b) => b.computed_at.localeCompare(a.computed_at))[0] ?? null;

  return {
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    count: predictions.length,
    predictions,
    performance: overallMetric
      ? {
          modelName: overallMetric.model_name,
          modelVersion: overallMetric.model_version,
          featureSetVersion: overallMetric.feature_set_version,
          evaluatedGames: overallMetric.evaluated_games,
          evaluationStartDate: overallMetric.evaluation_start_date,
          evaluationEndDate: overallMetric.evaluation_end_date,
          accuracy: overallMetric.accuracy,
          logLoss: overallMetric.log_loss,
          brierScore: overallMetric.brier_score,
          calibrationSummary: summarizeCalibration(overallMetric.calibration),
          computedAt: overallMetric.computed_at,
        }
      : null,
  };
}

function summarizeCalibration(calibration: Json): string | null {
  if (!Array.isArray(calibration) || calibration.length === 0) return null;
  const populatedBins = calibration.filter(
    (bin) => isRecord(bin) && Number(bin.count) > 0,
  );
  return populatedBins.length
    ? `${populatedBins.length} populated calibration bins`
    : null;
}

function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function fetchPublicGamePredictions(args: {
  client: SupabaseClient<Database>;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<PublicGamePredictionsPayload> {
  const today = new Date();
  const fromDate = args.fromDate ?? today.toISOString().slice(0, 10);
  const toDate = args.toDate ?? addDays(today, 7);
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);

  const modelVersionsResult = await args.client
    .from("game_prediction_model_versions")
    .select("*")
    .eq("status", "production");
  if (modelVersionsResult.error) throw modelVersionsResult.error;
  const productionModels = modelVersionsResult.data ?? [];

  const { data: outputs, error: outputsError } = await args.client
    .from("game_prediction_outputs")
    .select("*")
    .eq("prediction_scope", "pregame")
    .gte("snapshot_date", fromDate)
    .lte("snapshot_date", toDate)
    .order("snapshot_date", { ascending: true })
    .order("computed_at", { ascending: false })
    .limit(limit);
  if (outputsError) throw outputsError;

  const outputRows = outputs ?? [];
  const gameIds = Array.from(new Set(outputRows.map((row) => row.game_id)));
  const teamIds = Array.from(
    new Set(outputRows.flatMap((row) => [row.home_team_id, row.away_team_id])),
  );
  let metricsQuery = args.client
    .from("game_prediction_model_metrics")
    .select("*")
    .eq("segment_key", "overall")
    .eq("segment_value", "all")
    .order("computed_at", { ascending: false });

  if (productionModels.length > 0) {
    metricsQuery = metricsQuery
      .in(
        "model_name",
        uniqueStrings(productionModels.map((model) => model.model_name)),
      )
      .in(
        "model_version",
        uniqueStrings(productionModels.map((model) => model.model_version)),
      )
      .in(
        "feature_set_version",
        uniqueStrings(productionModels.map((model) => model.feature_set_version)),
      )
      .limit(Math.max(5, productionModels.length * 3));
  } else {
    metricsQuery = metricsQuery.limit(5);
  }

  const [teamsResult, gamesResult, historiesResult, metricsResult] =
    await Promise.all([
      teamIds.length
        ? args.client
            .from("teams")
            .select("id, abbreviation, name")
            .in("id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      gameIds.length
        ? args.client.from("games").select("id, startTime").in("id", gameIds)
        : Promise.resolve({ data: [], error: null }),
      gameIds.length
        ? args.client
            .from("game_prediction_history")
            .select("*")
            .in("game_id", gameIds)
            .eq("prediction_scope", "pregame")
            .eq("is_public", true)
            .order("computed_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      metricsQuery,
    ]);

  for (const result of [
    teamsResult,
    gamesResult,
    historiesResult,
    metricsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const featureSnapshotIds = Array.from(
    new Set(
      (historiesResult.data ?? [])
        .map((row) => row.feature_snapshot_id)
        .filter(Boolean),
    ),
  );
  const featureSnapshotsResult = featureSnapshotIds.length
    ? await args.client
        .from("game_prediction_feature_snapshots")
        .select("*")
        .in("feature_snapshot_id", featureSnapshotIds)
    : { data: [], error: null };
  if (featureSnapshotsResult.error) throw featureSnapshotsResult.error;

  return buildPublicGamePredictionsPayload({
    outputs: outputRows,
    histories: historiesResult.data ?? [],
    featureSnapshots: featureSnapshotsResult.data ?? [],
    teams: teamsResult.data ?? [],
    games: gamesResult.data ?? [],
    metrics: metricsResult.data ?? [],
    modelVersions: productionModels,
  });
}

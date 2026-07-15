import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import {
  auditScoringRowsAgainstFeatureCoverage,
  buildXgFeatureCoverageProfile,
  type XgFeatureCoverageProfile,
  type XgSelectedFeatures,
} from "lib/xg/featureCoverage";
import { buildFlurryAdjustedPredictions, summarizeFlurryAdjustedXg } from "lib/xg/flurryAdjusted";
import { buildXgInternalBenchmarkSurfaces, buildXgSegmentCalibrationAudit, XG_EXTERNAL_TAXONOMY, type XgHardeningShot } from "lib/xg/hardeningAudit";
import { buildXgOperationsAlerts, buildXgTeamAggregateReconciliation } from "lib/xg/operationsHealth";
import { buildReboundHeadOutputs } from "lib/xg/reboundHeads";
import { buildLaggedResidualSkillLayers } from "lib/xg/residualSkill";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = { query: Record<string, string | string[] | undefined>; supabase: SupabaseClient<Database> };
type Row = Record<string, any>;
const SAMPLE_LIMIT = 1000;
const PAGE_SIZE = 1000;

async function optionalRows(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, label: string, notes: string[]): Promise<Row[]> {
  const { data, error } = await query;
  if (error) { notes.push(`${label} unavailable: ${error.message}`); return []; }
  return (data ?? []) as Row[];
}

async function optionalCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string, notes: string[]): Promise<number | null> {
  const { count, error } = await query;
  if (error) { notes.push(`${label} count unavailable: ${error.message}`); return null; }
  return count;
}

function chunks<T>(rows: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, index * size + size));
}

function isSelectedFeatures(value: unknown): value is XgSelectedFeatures {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["numeric", "boolean", "categorical"].every((key) =>
    Array.isArray(candidate[key]) && (candidate[key] as unknown[]).every((entry) => typeof entry === "string")
  );
}

function isCoverageProfile(value: unknown): value is XgFeatureCoverageProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.rowCount === "number" && !!candidate.policy && !!candidate.features;
}

async function fetchFeatureRows(client: SupabaseClient<Database>, predictions: Row[], notes: string[]): Promise<Row[]> {
  const wanted = new Set(predictions.map((row) => `${row.game_id}:${row.event_id}`));
  const gameIds = Array.from(new Set(predictions.map((row) => Number(row.game_id)).filter(Number.isFinite)));
  const rows: Row[] = [];
  for (const gameChunk of chunks(gameIds, 25)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await (client as any).from("nhl_xg_shot_features").select("game_id,event_id,strength_state,strength_exact,shot_event_type,is_empty_net_event,is_blocked_shot,is_flurry_shot,flurry_sequence_id,flurry_shot_index,shooter_player_id,goalie_in_net_id,feature_payload").in("game_id", gameChunk).order("game_id").order("event_id").range(from, from + PAGE_SIZE - 1);
      if (error) { notes.push(`feature sample unavailable: ${error.message}`); return rows; }
      const page = (data ?? []) as Row[];
      rows.push(...page.filter((row) => wanted.has(`${row.game_id}:${row.event_id}`)));
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  const client = req.supabase;
  const notes: string[] = [];
  const [predictions, reboundPredictions, registryRows, leaseRows, teamAggregateSample, featureCount, predictionCount, teamCount, playerCount, goalieCount] = await Promise.all([
    optionalRows((client as any).from("nhl_xg_shot_predictions").select("model_version,feature_version,game_id,event_id,game_date,shooter_player_id,goalie_in_net_id,label,xg").eq("prediction_type", "shot_goal").eq("model_approved", true).order("game_date", { ascending: false }).limit(SAMPLE_LIMIT), "prediction sample", notes),
    optionalRows((client as any).from("nhl_xg_shot_predictions").select("game_id,event_id,xg").eq("prediction_type", "rebound_creation").eq("model_approved", true).order("game_date", { ascending: false }).limit(SAMPLE_LIMIT), "rebound sample", notes),
    optionalRows((client as any).from("nhl_xg_model_registry").select("model_version,prediction_type,selected_features,feature_coverage,is_active,is_champion,updated_at").eq("prediction_type", "shot_goal").or("is_active.eq.true,is_champion.eq.true").order("updated_at", { ascending: false }).limit(5), "model registry", notes),
    optionalRows((client as any).from("xg_execution_leases").select("lease_key,state,lease_expires_at,last_success_at,last_failure_at,last_error,attempt_count,updated_at").order("updated_at", { ascending: false }).limit(20), "execution leases", notes),
    optionalRows((client as any).from("nhl_xg_team_game_aggregates").select("model_version,feature_version,game_id,xg_for,xg_against,flurry_adjusted_xg_for,flurry_adjusted_xg_against").order("game_date", { ascending: false }).limit(500), "team aggregate sample", notes),
    optionalCount((client as any).from("nhl_xg_shot_features").select("*", { count: "exact", head: true }), "feature", notes),
    optionalCount((client as any).from("nhl_xg_shot_predictions").select("*", { count: "exact", head: true }).eq("prediction_type", "shot_goal").eq("model_approved", true), "prediction", notes),
    optionalCount((client as any).from("nhl_xg_team_game_aggregates").select("*", { count: "exact", head: true }), "team aggregate", notes),
    optionalCount((client as any).from("nhl_xg_player_game_aggregates").select("*", { count: "exact", head: true }), "player aggregate", notes),
    optionalCount((client as any).from("nhl_xg_goalie_game_aggregates").select("*", { count: "exact", head: true }), "goalie aggregate", notes),
  ]);
  const features = await fetchFeatureRows(client, predictions, notes);
  const featureMap = new Map(features.map((row) => [`${row.game_id}:${row.event_id}`, row]));
  const gameIds = Array.from(new Set(predictions.map((row) => Number(row.game_id)).filter(Number.isFinite)));
  const games = gameIds.length ? await optionalRows((client as any).from("games").select("id,type,homeTeamId").in("id", gameIds.slice(0, 200)), "game context", notes) : [];
  const gameMap = new Map(games.map((row) => [Number(row.id), row]));
  const shots: XgHardeningShot[] = predictions.flatMap((row) => {
    const feature = featureMap.get(`${row.game_id}:${row.event_id}`);
    if (!feature || typeof row.label !== "boolean") return [];
    const game = gameMap.get(Number(row.game_id));
    const payload = feature.feature_payload && typeof feature.feature_payload === "object" ? feature.feature_payload : {};
    return [{ gameId: Number(row.game_id), eventId: Number(row.event_id), prediction: Number(row.xg), label: row.label ? 1 as const : 0 as const, rinkId: game?.homeTeamId == null ? null : String(game.homeTeamId), isPlayoff: Number(game?.type) === 3, strengthState: feature.strength_exact ?? feature.strength_state ?? null, scoreState: payload.scoreState ?? payload.score_state ?? null, shotEventType: feature.shot_event_type ?? "unknown", isEmptyNet: feature.is_empty_net_event === true }];
  });
  const calibration = buildXgSegmentCalibrationAudit(shots, { minimumSampleSize: 50, binCount: 10 });
  const benchmarks = buildXgInternalBenchmarkSurfaces(shots);
  const flurryRows = buildFlurryAdjustedPredictions(predictions.flatMap((row) => {
    const feature = featureMap.get(`${row.game_id}:${row.event_id}`);
    return feature ? [{ gameId: Number(row.game_id), eventId: Number(row.event_id), rawXg: Number(row.xg), flurrySequenceId: feature.flurry_sequence_id ?? null, flurryShotIndex: feature.flurry_shot_index ?? null }] : [];
  }));
  const residualLayers = buildLaggedResidualSkillLayers(predictions.flatMap((row) => typeof row.label === "boolean" ? [{ gameId: Number(row.game_id), eventId: Number(row.event_id), gameDate: String(row.game_date ?? "9999-12-31"), shooterId: row.shooter_player_id == null ? null : Number(row.shooter_player_id), goalieId: row.goalie_in_net_id == null ? null : Number(row.goalie_in_net_id), baselineXg: Number(row.xg), label: row.label ? 1 as const : 0 as const }] : []), { minimumSamples: 25, priorStrength: 100 });
  const reboundHeads = buildReboundHeadOutputs(reboundPredictions.map((row) => ({ gameId: Number(row.game_id), eventId: Number(row.event_id), reboundCreationProbability: Number(row.xg), conditionalDangerProbability: null, goalieFreezeProbability: null, conditionalSecondChanceXg: null })));
  const latestRegistry = registryRows[0] ?? null;
  const latestPredictionVersion = predictions[0]?.model_version ?? null;
  const activeModelVersion = latestRegistry?.model_version ?? latestPredictionVersion;
  const flurrySurfaceSpecs = [
    ["teamGame", "nhl_xg_team_game_aggregates", "flurry_adjusted_xg_for"],
    ["playerGame", "nhl_xg_player_game_aggregates", "flurry_adjusted_ixg"],
    ["goalieGame", "nhl_xg_goalie_game_aggregates", "flurry_adjusted_xg_against"],
    ["teamRolling", "nhl_xg_team_rolling_aggregates", "flurry_adjusted_xg_for"],
    ["playerRolling", "nhl_xg_player_rolling_aggregates", "flurry_adjusted_ixg"],
    ["goalieRolling", "nhl_xg_goalie_rolling_aggregates", "flurry_adjusted_xg_against"],
  ] as const;
  const flurryAggregateCoverage: Record<string, { total: number | null; adjusted: number | null }> = {};
  if (activeModelVersion) {
    await Promise.all(flurrySurfaceSpecs.map(async ([key, table, column]) => {
      const [total, adjusted] = await Promise.all([
        optionalCount((client as any).from(table).select("*", { count: "exact", head: true }).eq("model_version", activeModelVersion), `${key} flurry total`, notes),
        optionalCount((client as any).from(table).select("*", { count: "exact", head: true }).eq("model_version", activeModelVersion).not(column, "is", null), `${key} flurry adjusted`, notes),
      ]);
      flurryAggregateCoverage[key] = { total, adjusted };
    }));
  } else {
    for (const [key] of flurrySurfaceSpecs) flurryAggregateCoverage[key] = { total: null, adjusted: null };
  }
  const selectedFeatures = isSelectedFeatures(latestRegistry?.selected_features) ? latestRegistry.selected_features : null;
  const trainingCoverage = isCoverageProfile(latestRegistry?.feature_coverage) ? latestRegistry.feature_coverage : null;
  const scoringRows = features.map((feature) => ({
    ...(feature.feature_payload && typeof feature.feature_payload === "object" ? feature.feature_payload : {}),
    ...feature,
  })) as any[];
  const scoringCoverage = selectedFeatures
    ? buildXgFeatureCoverageProfile({ rows: scoringRows, selectedFeatures, policy: trainingCoverage?.policy })
    : null;
  const featureDriftIssues = selectedFeatures && trainingCoverage
    ? auditScoringRowsAgainstFeatureCoverage({ rows: scoringRows, selectedFeatures, trainingProfile: trainingCoverage })
    : [];
  const featureDriftStatus = !selectedFeatures || !trainingCoverage
    ? "unavailable" as const
    : scoringRows.length < trainingCoverage.policy.minScoringRowsForDriftCheck
      ? "insufficient" as const
      : featureDriftIssues.length > 0
        ? "warning" as const
        : "ok" as const;
  const aggregateReconciliation = buildXgTeamAggregateReconciliation(teamAggregateSample as any);
  const flurryAggregateReconciliation = buildXgTeamAggregateReconciliation(teamAggregateSample.flatMap((row) =>
    row.flurry_adjusted_xg_for == null || row.flurry_adjusted_xg_against == null
      ? []
      : [{ ...row, xg_for: Number(row.flurry_adjusted_xg_for), xg_against: Number(row.flurry_adjusted_xg_against) }]
  ) as any);
  const summaryInput = { featureCount, predictionCount, aggregateCounts: { team: teamCount, player: playerCount, goalie: goalieCount }, aggregateReconciliation, flurryAggregateCoverage, flurryAggregateReconciliation, registryModelVersion: latestRegistry?.model_version ?? null, predictionModelVersion: latestPredictionVersion, registryAvailable: registryRows.length > 0, leasesAvailable: !notes.some((note) => note.startsWith("execution leases unavailable")), runningLeaseCount: leaseRows.filter((row) => row.state === "running").length, featureDriftStatus, featureDriftIssues, calibration, benchmarks };
  return res.status(200).json({
    success: true,
    generatedAt: new Date().toISOString(),
    partial: notes.length > 0,
    notes,
    counts: summaryInput,
    alerts: buildXgOperationsAlerts(summaryInput),
    calibration,
    benchmarks,
    featureCoverage: {
      status: featureDriftStatus,
      sampleRows: scoringRows.length,
      requiredRows: trainingCoverage?.policy.minScoringRowsForDriftCheck ?? null,
      issues: featureDriftIssues,
      scoringProfile: scoringCoverage,
    },
    externalTaxonomy: XG_EXTERNAL_TAXONOMY,
    derivedLayers: { flurry: summarizeFlurryAdjustedXg(flurryRows), residual: { rows: residualLayers.length, shooterEffectsAvailable: residualLayers.filter((row) => row.shooterFinishingEffect != null).length, goalieEffectsAvailable: residualLayers.filter((row) => row.goalieSaveEffect != null).length }, reboundHeads: { rows: reboundHeads.length, available: reboundHeads.filter((row) => row.value != null).length } },
    registry: registryRows,
    leases: leaseRows,
  });
}

export default adminOnly(handler as any);

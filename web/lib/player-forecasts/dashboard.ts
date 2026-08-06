import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAccountabilityCandles, buildPlayerForecastCandles } from "./accountability";
import {
  PLAYER_FORECAST_DEFAULT_LABEL,
  PLAYER_FORECAST_SYSTEM_KEY,
  type PlayerForecastAccountabilityCheckpoint,
  type PlayerForecastConditioning,
  type PlayerForecastDashboardPayload,
  type PlayerForecastRevision,
} from "./contracts";
import { parsePlayerForecastGameStart } from "./schedule";
import { loadPlayerForecastRestOfSeason } from "./restOfSeason";

type DashboardFilters = {
  playerId?: number | null;
  gameId?: number | null;
  targetKey?: string | null;
  conditioning?: PlayerForecastConditioning | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function loadPlayerForecastDashboard(args: {
  supabase: SupabaseClient<any>;
  filters?: DashboardFilters;
}): Promise<PlayerForecastDashboardPayload> {
  const filters = args.filters ?? {};
  let outputQuery = args.supabase
    .from("player_forecast_outputs")
    .select(
      "id,run_id,game_id,team_id,player_id,population,target_key,conditioning,team_game_horizon,point_estimate,probability,distribution_kind,distribution,quantiles,source_high_watermark,fallback_flags,issued_at",
    )
    .order("issued_at", { ascending: true })
    .limit(3000);
  if (filters.playerId != null) outputQuery = outputQuery.eq("player_id", filters.playerId);
  if (filters.gameId != null) outputQuery = outputQuery.eq("game_id", filters.gameId);
  if (filters.targetKey) outputQuery = outputQuery.eq("target_key", filters.targetKey);
  if (filters.conditioning) outputQuery = outputQuery.eq("conditioning", filters.conditioning);
  const { data: outputRows, error: outputError } = await outputQuery;
  if (outputError) throw outputError;

  const runIds = Array.from(new Set((outputRows ?? []).map((row: any) => row.run_id)));
  const { data: runRows, error: runError } = runIds.length > 0
    ? await args.supabase
      .from("player_forecast_runs")
      .select("id,cutoff_at,degraded,degraded_reasons,feature_schema_version,model_artifact_id")
      .in("id", runIds)
    : { data: [], error: null };
  if (runError) throw runError;
  const runs = new Map((runRows ?? []).map((row: any) => [String(row.id), row]));
  const artifactIds = Array.from(new Set((runRows ?? []).map((row: any) => row.model_artifact_id).filter(Boolean)));
  const { data: artifactRows, error: artifactError } = artifactIds.length > 0
    ? await args.supabase
      .from("player_forecast_model_artifacts")
      .select("id,model_version,artifact_checksum,evidence")
      .in("id", artifactIds)
    : { data: [], error: null };
  if (artifactError) throw artifactError;
  const artifacts = new Map((artifactRows ?? []).map((row: any) => [String(row.id), row]));
  const rawPlayerIds = Array.from(new Set((outputRows ?? []).map((row: any) => row.player_id)));
  const rawGameIds = Array.from(new Set((outputRows ?? []).map((row: any) => row.game_id)));
  const [{ data: playerRows, error: playerError }, { data: gameRows, error: gameError }] = await Promise.all([
    rawPlayerIds.length > 0
      ? args.supabase.from("players").select("id,fullName").in("id", rawPlayerIds)
      : Promise.resolve({ data: [], error: null }),
    rawGameIds.length > 0
      ? args.supabase.from("games").select("id,date,startTime").in("id", rawGameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (playerError) throw playerError;
  if (gameError) throw gameError;
  const players = new Map((playerRows ?? []).map((row: any) => [Number(row.id), row]));
  const games = new Map((gameRows ?? []).map((row: any) => [Number(row.id), row]));

  const revisions: PlayerForecastRevision[] = (outputRows ?? []).flatMap((row: any) => {
    const run = runs.get(String(row.run_id));
    const model = run?.model_artifact_id ? artifacts.get(String(run.model_artifact_id)) : null;
    const player = players.get(Number(row.player_id));
    const game = games.get(Number(row.game_id));
    const scheduledStartAt = parsePlayerForecastGameStart(game?.startTime, game?.date);
    if (!run || !scheduledStartAt) return [];
    return [{
      outputId: String(row.id),
      runId: String(row.run_id),
      gameId: Number(row.game_id),
      teamId: Number(row.team_id),
      playerId: Number(row.player_id),
      playerName: String(player?.fullName ?? `Player ${row.player_id}`),
      population: row.population,
      targetKey: String(row.target_key),
      conditioning: row.conditioning,
      teamGameHorizon: Number(row.team_game_horizon),
      pointEstimate: row.point_estimate == null ? null : Number(row.point_estimate),
      probability: row.probability == null ? null : Number(row.probability),
      distributionKind: row.distribution_kind ?? null,
      distribution: row.distribution ?? null,
      quantiles: row.quantiles ?? null,
      issuedAt: String(row.issued_at),
      cutoffAt: String(run.cutoff_at),
      scheduledStartAt,
      modelVersion: model?.model_version ?? null,
      artifactChecksum: model?.artifact_checksum ?? null,
      featureSchemaVersion: run.feature_schema_version ?? null,
      sourceHighWatermark: String(row.source_high_watermark),
      fallbackFlags: row.fallback_flags ?? [],
      degraded: Boolean(run.degraded),
      degradedReasons: run.degraded_reasons ?? [],
    } satisfies PlayerForecastRevision];
  });

  const gameIds = Array.from(new Set(revisions.map((revision) => revision.gameId)));
  const playerIds = Array.from(new Set(revisions.map((revision) => revision.playerId)));
  let outcomes: Array<{
    gameId: number;
    playerId: number;
    targetKey: string;
    value: number;
    settlementStatus: "provisional" | "final" | "corrected";
  }> = [];
  if (gameIds.length > 0 && playerIds.length > 0) {
    const { data, error } = await args.supabase
      .from("player_forecast_outcome_revisions")
      .select("game_id,player_id,target_key,outcome_value,finality,available_at")
      .in("game_id", gameIds)
      .in("player_id", playerIds)
      .order("available_at", { ascending: false });
    if (error) throw error;
    const latest = new Map<string, any>();
    for (const row of data ?? []) {
      const key = `${row.game_id}:${row.player_id}:${row.target_key}`;
      if (!latest.has(key) && row.outcome_value != null) latest.set(key, row);
    }
    outcomes = Array.from(latest.values()).map((row) => ({
      gameId: Number(row.game_id),
      playerId: Number(row.player_id),
      targetKey: String(row.target_key),
      value: Number(row.outcome_value),
      settlementStatus: row.finality,
    }));
  }

  const { data: accountabilityRows, error: accountabilityError } = await args.supabase
    .from("player_forecast_accountability_revisions")
    .select("slate_date,checkpoint_key,checkpoint_order,model_artifact_id,scoring_version,settlement_status,evaluated_forecasts,composite_skill_score,evaluated_at")
    .order("evaluated_at", { ascending: false })
    .limit(2000);
  if (accountabilityError) throw accountabilityError;
  const missingArtifactIds = Array.from(new Set((accountabilityRows ?? [])
    .map((row: any) => String(row.model_artifact_id))
    .filter((id: string) => !artifacts.has(id))));
  if (missingArtifactIds.length > 0) {
    const { data, error } = await args.supabase
      .from("player_forecast_model_artifacts")
      .select("id,model_version,artifact_checksum,evidence")
      .in("id", missingArtifactIds);
    if (error) throw error;
    for (const row of data ?? []) artifacts.set(String(row.id), row);
  }
  const latestAccountability = new Map<string, any>();
  for (const row of accountabilityRows ?? []) {
    const key = [
      row.slate_date,
      row.checkpoint_key,
      row.model_artifact_id,
      row.scoring_version,
    ].join(":");
    if (!latestAccountability.has(key)) latestAccountability.set(key, row);
  }
  const accountabilityCheckpoints: PlayerForecastAccountabilityCheckpoint[] =
    Array.from(latestAccountability.values()).map((row) => ({
      slateDate: String(row.slate_date),
      modelArtifactId: String(row.model_artifact_id),
      modelVersion: String(artifacts.get(String(row.model_artifact_id))?.model_version ?? "unknown"),
      checkpoint: String(row.checkpoint_key),
      checkpointOrder: Number(row.checkpoint_order),
      compositeSkillScore: Number(row.composite_skill_score),
      evaluatedForecasts: Number(row.evaluated_forecasts),
      scoringVersion: String(row.scoring_version),
      settlementStatus: row.settlement_status,
    }));

  const [{ data: conflicts, error: conflictError }, { data: queue, error: queueError }, { count: blocked, error: blockedError }] =
    await Promise.all([
      args.supabase
        .from("player_forecast_observation_conflicts")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(100),
      args.supabase
        .from("player_forecast_inference_queue")
        .select("status")
        .limit(5000),
      args.supabase
        .from("player_forecast_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "research_blocked"),
    ]);
  if (conflictError) throw conflictError;
  if (queueError) throw queueError;
  if (blockedError) throw blockedError;
  const health = { pending: 0, running: 0, failed: 0, succeeded: 0 };
  for (const row of queue ?? []) {
    if (row.status in health) health[row.status as keyof typeof health] += 1;
  }
  const fixtureDataPresent = Array.from(artifacts.values()).some((artifact: any) =>
    artifact.evidence?.fixture === true || artifact.evidence?.notModelAccuracy === true,
  );
  const restOfSeasonForecasts = await loadPlayerForecastRestOfSeason({
    supabase: args.supabase,
    playerId: filters.playerId,
    targetKey: filters.targetKey,
    conditioning:
      filters.conditioning === "conditional_playing" || filters.conditioning === "unconditional"
        ? filters.conditioning
        : null,
  });

  return {
    success: true,
    systemKey: PLAYER_FORECAST_SYSTEM_KEY,
    label:
      process.env.NEXT_PUBLIC_PLAYER_FORECAST_LABEL?.trim() ||
      PLAYER_FORECAST_DEFAULT_LABEL,
    researchGate: "approved",
    generatedAt: new Date().toISOString(),
    filters: {
      playerId: filters.playerId ?? null,
      gameId: filters.gameId ?? null,
      targetKey: filters.targetKey ?? null,
      conditioning: filters.conditioning ?? null,
    },
    playerCandles: buildPlayerForecastCandles({ revisions, outcomes }),
    accountabilityCandles: buildAccountabilityCandles(accountabilityCheckpoints),
    revisions,
    restOfSeasonForecasts,
    conflicts: (conflicts ?? []) as Array<Record<string, unknown>>,
    fixtureData: {
      present: fixtureDataPresent,
      disclaimer: fixtureDataPresent
        ? "Fixture demonstration data is present. These candles verify workflow and chart behavior; they are not model-accuracy evidence."
        : null,
    },
    runHealth: {
      ...health,
      researchBlockedRuns: blocked ?? 0,
    },
  };
}

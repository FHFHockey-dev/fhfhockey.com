import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildNextTenGameScopes,
  scheduleRevisionHash,
  type PlayerForecastGameScope,
  type PlayerForecastScheduleGame,
} from "./schedule";
import {
  PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256,
  PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION,
} from "./researchContract";
import { loadPlayerForecastInferenceInputs } from "./serving";

type QueueRow = {
  id: string;
  scope_key: string;
  game_id: number;
  team_id: number;
  team_game_horizon: number | null;
  reason: string;
  source_high_watermark: string;
  claimed_watermark: string;
  metadata: Record<string, unknown> | null;
};

type WorkerResponse = {
  success: boolean;
  mode?: string;
  researchGate?: string;
  modelArtifactId?: string;
  artifactChecksum?: string;
  featureSchemaVersion?: string;
  outputs?: Array<{
    featureSnapshotId: string;
    gameId: number;
    teamId: number;
    playerId: number;
    population: "forward" | "defense" | "goalie";
    targetKey: string;
    conditioning: "playing_probability" | "start_probability" | "conditional_playing" | "conditional_start" | "unconditional";
    teamGameHorizon: number;
    pointEstimate?: number | null;
    probability?: number | null;
    distributionKind?: string | null;
    distribution?: Record<string, unknown> | null;
    quantiles?: Record<string, unknown> | null;
    sourceHighWatermark: string;
    fallbackFlags?: string[];
  }>;
  message?: string;
};

function isDuplicate(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function codeVersion(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    "local-dev"
  );
}

function idempotencyKey(job: QueueRow, horizon: number): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        scopeKey: job.scope_key,
        sourceHighWatermark: job.claimed_watermark,
        horizon,
        codeVersion: codeVersion(),
      }),
    )
    .digest("hex");
}

async function fetchFutureGames(
  supabase: SupabaseClient<any>,
  now: Date,
): Promise<PlayerForecastScheduleGame[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id,seasonId,date,startTime,homeTeamId,awayTeamId,type")
    .gte("date", now.toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .order("startTime", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as PlayerForecastScheduleGame[];
}

async function insertScheduleRevisions(args: {
  supabase: SupabaseClient<any>;
  scopes: PlayerForecastGameScope[];
  observedAt: string;
}): Promise<number> {
  const games = Array.from(
    new Map(args.scopes.map((scope) => [scope.gameId, scope])).values(),
  );
  let inserted = 0;
  for (const scope of games) {
    const hash = scheduleRevisionHash(scope);
    const { error } = await args.supabase
      .from("player_forecast_schedule_revisions")
      .insert({
        game_id: scope.gameId,
        season_id: scope.seasonId,
        scheduled_start_at: scope.scheduledStartAt,
        game_date: scope.gameDate,
        home_team_id: scope.homeTeamId,
        away_team_id: scope.awayTeamId,
        game_status: "scheduled",
        source: "games_current",
        source_revision_key: `${scope.gameId}:${scope.scheduledStartAt}`,
        observed_at: args.observedAt,
        available_at: args.observedAt,
        payload_hash: hash,
        raw_payload: {
          gameId: scope.gameId,
          seasonId: scope.seasonId,
          scheduledStartAt: scope.scheduledStartAt,
          gameDate: scope.gameDate,
          homeTeamId: scope.homeTeamId,
          awayTeamId: scope.awayTeamId,
        },
      });
    if (error && !isDuplicate(error)) throw error;
    if (!error) inserted += 1;
  }
  return inserted;
}

export async function seedCanonicalPlayerForecastJobs(args: {
  supabase: SupabaseClient<any>;
  now?: Date;
}): Promise<{ scopes: number; scheduleRevisions: number; queued: number }> {
  const now = args.now ?? new Date();
  const observedAt = now.toISOString();
  const scopes = buildNextTenGameScopes({
    games: await fetchFutureGames(args.supabase, now),
    now,
  });
  const scheduleRevisions = await insertScheduleRevisions({
    supabase: args.supabase,
    scopes,
    observedAt,
  });
  let queued = 0;
  for (const scope of scopes) {
    const { error } = await args.supabase.rpc("enqueue_player_forecast_job", {
      p_scope_key: scope.scopeKey,
      p_game_id: scope.gameId,
      p_team_id: scope.teamId,
      p_team_game_horizon: scope.teamGameHorizon,
      p_reason: "canonical_daily",
      p_observed_at: observedAt,
      p_not_before: observedAt,
      p_metadata: {
        scheduledStartAt: scope.scheduledStartAt,
        opponentTeamId: scope.opponentTeamId,
      },
    } as never);
    if (error) throw error;
    queued += 1;
  }
  return { scopes: scopes.length, scheduleRevisions, queued };
}

async function resolveHorizon(args: {
  supabase: SupabaseClient<any>;
  job: QueueRow;
  now: Date;
}): Promise<number | null> {
  if (args.job.team_game_horizon != null) return args.job.team_game_horizon;
  const scopes = buildNextTenGameScopes({
    games: await fetchFutureGames(args.supabase, args.now),
    now: args.now,
    teamId: args.job.team_id,
  });
  return scopes.find((scope) => scope.gameId === args.job.game_id)?.teamGameHorizon ?? null;
}

async function callInferenceWorker(args: {
  supabase: SupabaseClient<any>;
  job: QueueRow;
  horizon: number;
  dryRun: boolean;
}): Promise<WorkerResponse> {
  if (args.dryRun) {
    return {
      success: true,
      mode: "contract_only",
      researchGate: "approved",
      outputs: [],
      message: "Dry-run orchestration completed without statistical inference.",
    };
  }
  const url = process.env.PLAYER_FORECAST_INFERENCE_URL?.trim();
  const secret = process.env.PLAYER_FORECAST_INFERENCE_SECRET?.trim();
  if (!url || !secret) {
    throw new Error(
      "PLAYER_FORECAST_INFERENCE_URL and PLAYER_FORECAST_INFERENCE_SECRET are required.",
    );
  }
  const sourceHighWatermark = new Date(args.job.claimed_watermark).toISOString();
  const inferenceEnabled = process.env.PLAYER_FORECAST_ENABLE_INFERENCE?.trim().toLowerCase() === "true";
  const inferenceInputs = inferenceEnabled
    ? await loadPlayerForecastInferenceInputs({
        supabase: args.supabase,
        gameId: args.job.game_id,
        teamId: args.job.team_id,
        horizon: args.horizon,
        sourceHighWatermark,
      })
    : null;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: args.job.id,
      scopeKey: args.job.scope_key,
      gameId: args.job.game_id,
      teamId: args.job.team_id,
      teamGameHorizon: args.horizon,
      sourceHighWatermark,
      codeVersion: codeVersion(),
      releaseChannel: "shadow",
      executionMode: inferenceInputs ? "inference" : "contract_only",
      researchContractVersion:
        inferenceInputs?.researchContractVersion ?? PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION,
      researchContractChecksum:
        inferenceInputs?.researchContractChecksum ?? PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256,
      ...(inferenceInputs ?? {}),
    }),
  });
  const payload = (await response.json()) as WorkerResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? `Inference worker returned HTTP ${response.status}.`);
  }
  return payload;
}

async function recordRun(args: {
  supabase: SupabaseClient<any>;
  job: QueueRow;
  horizon: number;
  worker: WorkerResponse;
}): Promise<void> {
  const now = new Date().toISOString();
  const outputs = args.worker.outputs ?? [];
  if (outputs.length > 0 && (!args.worker.modelArtifactId || !args.worker.artifactChecksum)) {
    throw new Error("Inference output omitted its immutable model artifact identity.");
  }
  const insert = {
    idempotency_key: idempotencyKey(args.job, args.horizon),
    queue_id: args.job.id,
    game_id: args.job.game_id,
    team_id: args.job.team_id,
    team_game_horizon: args.horizon,
    model_artifact_id: args.worker.modelArtifactId ?? null,
    run_kind: args.job.reason === "canonical_daily" ? "canonical_daily" : "event_reissue",
    release_channel: "shadow",
    status: outputs.length > 0 ? "running" : "research_blocked",
    cutoff_at: args.job.claimed_watermark,
    issued_at: outputs.length > 0 ? now : null,
    source_high_watermark: args.job.claimed_watermark,
    feature_schema_version: args.worker.featureSchemaVersion ?? null,
    code_version: codeVersion(),
    research_gate: args.worker.researchGate ?? "pending",
    degraded: false,
    degraded_reasons: [],
    metadata: {
      workerMode: args.worker.mode ?? "unknown",
      message: args.worker.message ?? null,
    },
    completed_at: outputs.length > 0 ? null : now,
  };
  const { data: insertedRun, error } = await args.supabase
    .from("player_forecast_runs")
    .insert(insert)
    .select("id")
    .maybeSingle();
  if (error && !isDuplicate(error)) throw error;
  let runId = insertedRun?.id;
  if (!runId) {
    const { data: existing, error: existingError } = await args.supabase
      .from("player_forecast_runs")
      .select("id,status")
      .eq("idempotency_key", insert.idempotency_key)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing || existing.status === "succeeded" || outputs.length === 0) return;
    runId = existing.id;
  }
  if (outputs.length === 0) return;
  const { error: outputError } = await args.supabase
    .from("player_forecast_outputs")
    .upsert(outputs.map((output) => ({
      run_id: runId,
      feature_snapshot_id: output.featureSnapshotId,
      game_id: output.gameId,
      team_id: output.teamId,
      player_id: output.playerId,
      population: output.population,
      target_key: output.targetKey,
      conditioning: output.conditioning,
      team_game_horizon: output.teamGameHorizon,
      point_estimate: output.pointEstimate ?? null,
      probability: output.probability ?? null,
      distribution_kind: output.distributionKind ?? null,
      distribution: output.distribution ?? null,
      quantiles: output.quantiles ?? null,
      source_high_watermark: output.sourceHighWatermark,
      fallback_flags: output.fallbackFlags ?? [],
      issued_at: now,
    })), { onConflict: "run_id,player_id,target_key,conditioning", ignoreDuplicates: true });
  if (outputError) throw outputError;
  const { error: completionError } = await args.supabase
    .from("player_forecast_runs")
    .update({ status: "succeeded", completed_at: now })
    .eq("id", runId);
  if (completionError) throw completionError;
}

export async function drainPlayerForecastQueue(args: {
  supabase: SupabaseClient<any>;
  limit?: number;
  dryRun?: boolean;
  now?: Date;
}): Promise<{
  claimed: number;
  succeeded: number;
  failed: number;
  skippedAfterStart: number;
  errors: Array<{ jobId: string; message: string }>;
}> {
  const ownerToken = crypto.randomUUID();
  const now = args.now ?? new Date();
  const { data, error } = await args.supabase.rpc("claim_player_forecast_jobs", {
    p_owner_token: ownerToken,
    p_limit: Math.min(Math.max(args.limit ?? 8, 1), 50),
    p_lease_seconds: 240,
  } as never);
  if (error) throw error;
  const jobs = (data ?? []) as QueueRow[];
  let succeeded = 0;
  let failed = 0;
  let skippedAfterStart = 0;
  const errors: Array<{ jobId: string; message: string }> = [];

  for (const job of jobs) {
    let jobSucceeded = false;
    let failureMessage: string | null = null;
    try {
      const horizon = await resolveHorizon({ supabase: args.supabase, job, now });
      const scheduledStartAt =
        typeof job.metadata?.scheduledStartAt === "string"
          ? job.metadata.scheduledStartAt
          : null;
      if (scheduledStartAt && Date.parse(scheduledStartAt) <= now.getTime()) {
        skippedAfterStart += 1;
        throw new Error("Forecast cutoff passed; observation retained without issuing a forecast.");
      }
      if (horizon == null) {
        throw new Error("Game is no longer inside the team's next-10 schedule horizon.");
      }
      const worker = await callInferenceWorker({
        supabase: args.supabase,
        job,
        horizon,
        dryRun: args.dryRun ?? false,
      });
      await recordRun({ supabase: args.supabase, job, horizon, worker });
      jobSucceeded = true;
      succeeded += 1;
    } catch (jobError) {
      failureMessage = jobError instanceof Error ? jobError.message : String(jobError);
      failed += 1;
      errors.push({ jobId: job.id, message: failureMessage });
    }
    const { error: finishError } = await args.supabase.rpc(
      "finish_player_forecast_job",
      {
        p_job_id: job.id,
        p_owner_token: ownerToken,
        p_succeeded: jobSucceeded,
        p_error: failureMessage,
      } as never,
    );
    if (finishError) throw finishError;
  }
  return { claimed: jobs.length, succeeded, failed, skippedAfterStart, errors };
}

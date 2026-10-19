import type { SupabaseClient } from "@supabase/supabase-js";

import {
  acquireProjectionPipelineLease,
  advanceProjectionPipelineLease,
  finishProjectionPipelineLease,
  type ProjectionPipelineLease
} from "lib/projections/projectionPipelineState";
import type { Database } from "lib/supabase/database-generated.types";

import type { RollingForgePipelineStageId } from "./rollingForgePipeline";
import type { RollingForgePipelineMode } from "./rollingPlayerOperationalPolicy";

/**
 * Durable progress for the scheduled rolling-to-FORGE pipeline.
 *
 * One `projection_pipeline_state` row per stage, keyed by
 * (`rolling_forge_pipeline`, `<mode>:<run date>`, `<stage id>`). The existing
 * lease RPC gives each stage a single owner, a monotonic cursor (the rolling
 * step's player resume id) and a terminal `complete`/`failed` status, so a
 * later invocation can continue where an earlier one stopped. An invocation
 * killed mid-stage leaves a `running` row; once its lease expires the next
 * invocation repeats that stage from its last stored cursor.
 */
export const ROLLING_FORGE_RUN_PIPELINE_KEY = "rolling_forge_pipeline";

export type RollingForgeStageState = {
  status: "running" | "complete" | "failed";
  cursorGameId: number | null;
  lastError: string | null;
  leaseExpiresAt: string | null;
};

const FAILURE_ATTEMPT_PATTERN = /^stage_failed:attempt-(\d+)$/;

export function buildRollingForgeRunScopeKey(
  mode: RollingForgePipelineMode,
  runDate: string
) {
  return `${mode}:${runDate}`;
}

export function buildRollingForgeStageFailureCode(attempt: number) {
  return `stage_failed:attempt-${attempt}`;
}

/** Failed attempts recorded on a stage row; 0 when it has not failed. */
export function readRollingForgeStageFailedAttempts(
  state: RollingForgeStageState | undefined
) {
  if (state?.status !== "failed") return 0;
  const match = FAILURE_ATTEMPT_PATTERN.exec(state.lastError ?? "");
  return match ? Number(match[1]) : 1;
}

export async function readRollingForgeRunState(args: {
  supabase: SupabaseClient<Database>;
  scopeKey: string;
}): Promise<Map<string, RollingForgeStageState>> {
  const { data, error } = await args.supabase
    .from("projection_pipeline_state")
    .select("operation_key,status,cursor_game_id,last_error,lease_expires_at")
    .eq("pipeline_key", ROLLING_FORGE_RUN_PIPELINE_KEY)
    .eq("scope_key", args.scopeKey);
  if (error) {
    throw new Error(
      `Could not read rolling-forge pipeline state: ${error.message}`
    );
  }
  const states = new Map<string, RollingForgeStageState>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    if (
      typeof row.operation_key !== "string" ||
      !["running", "complete", "failed"].includes(String(row.status))
    ) {
      throw new Error("Rolling-forge pipeline state row is malformed");
    }
    states.set(row.operation_key, {
      status: row.status as RollingForgeStageState["status"],
      cursorGameId:
        row.cursor_game_id == null ? null : Number(row.cursor_game_id),
      lastError: typeof row.last_error === "string" ? row.last_error : null,
      leaseExpiresAt:
        typeof row.lease_expires_at === "string" ? row.lease_expires_at : null
    });
  }
  return states;
}

export function acquireRollingForgeStage(args: {
  supabase: SupabaseClient<Database>;
  scopeKey: string;
  stageId: RollingForgePipelineStageId;
  runDate: string;
  leaseExpiresAtMs: number;
}): Promise<ProjectionPipelineLease> {
  const now = new Date();
  return acquireProjectionPipelineLease({
    supabase: args.supabase,
    pipelineKey: ROLLING_FORGE_RUN_PIPELINE_KEY,
    scopeKey: args.scopeKey,
    operationKey: args.stageId,
    rangeStartDate: args.runDate,
    rangeEndDate: args.runDate,
    initialCursorDate: args.runDate,
    leaseMs: Math.max(30_000, args.leaseExpiresAtMs - now.getTime()),
    now
  });
}

/** Stores a partial stage's cursor and releases the lease shortly after. */
export function advanceRollingForgeStage(args: {
  supabase: SupabaseClient<Database>;
  lease: ProjectionPipelineLease;
  cursorGameId: number | null;
}) {
  return advanceProjectionPipelineLease({
    supabase: args.supabase,
    lease: args.lease,
    nextCursorDate: args.lease.cursorDate ?? args.lease.rangeStartDate,
    nextCursorGameId: args.cursorGameId ?? args.lease.cursorGameId,
    leaseMs: 30_000
  });
}

export function finishRollingForgeStage(args: {
  supabase: SupabaseClient<Database>;
  lease: ProjectionPipelineLease;
  outcome: "complete" | "failed";
  attempt?: number;
}) {
  return finishProjectionPipelineLease({
    supabase: args.supabase,
    lease: args.lease,
    outcome: args.outcome,
    failureCode:
      args.outcome === "failed"
        ? buildRollingForgeStageFailureCode(args.attempt ?? 1)
        : undefined
  });
}

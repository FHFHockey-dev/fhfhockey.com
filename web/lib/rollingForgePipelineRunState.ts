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
  updatedAt: string | null;
};

// A stage handed over at the end of an invocation (partial) keeps a lease
// this short; a lease still longer than this when it expires belonged to an
// invocation that died.
export const ROLLING_FORGE_HANDOFF_LEASE_MS = 30_000;
const DEAD_LEASE_MIN_SPAN_MS = 2 * ROLLING_FORGE_HANDOFF_LEASE_MS;

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

export function buildRollingForgeStageKilledCode(attempt: number) {
  return `stage_killed:attempt-${attempt}`;
}

/** Failed attempts recorded on a stage row; 0 when it has not failed. */
export function readRollingForgeStageFailedAttempts(
  state: RollingForgeStageState | undefined
) {
  if (state?.status !== "failed") return 0;
  const match = FAILURE_ATTEMPT_PATTERN.exec(state.lastError ?? "");
  return match ? Number(match[1]) : 1;
}

/**
 * True when the row is `running`, its lease has expired, and that lease was
 * not the short hand-off lease of a partial stage: the invocation holding it
 * died.
 */
export function isRollingForgeStageLeaseDead(
  state: RollingForgeStageState | undefined,
  nowMs = Date.now()
) {
  if (state?.status !== "running" || !state.leaseExpiresAt) return false;
  const expiresAt = Date.parse(state.leaseExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt > nowMs) return false;
  const updatedAt = state.updatedAt ? Date.parse(state.updatedAt) : NaN;
  return !Number.isFinite(updatedAt) || expiresAt - updatedAt > DEAD_LEASE_MIN_SPAN_MS;
}

/**
 * Invocations that died holding a stage are counted on a companion row,
 * `<stage id>:kills`, because taking the stage again clears its last_error.
 * The count lives in the companion's forward-only cursor_game_id; its
 * last_error carries the same number for operators.
 */
function buildRollingForgeStageKillsKey(stageId: RollingForgePipelineStageId) {
  return `${stageId}:kills`;
}

export function readRollingForgeStageKills(
  states: Map<string, RollingForgeStageState>,
  stageId: RollingForgePipelineStageId
) {
  return states.get(buildRollingForgeStageKillsKey(stageId))?.cursorGameId ?? 0;
}

/** Records one more dead invocation for the stage; returns the new count. */
export async function recordRollingForgeStageKill(args: {
  supabase: SupabaseClient<Database>;
  scopeKey: string;
  stageId: RollingForgePipelineStageId;
  runDate: string;
}): Promise<number> {
  const now = new Date();
  const lease = await acquireProjectionPipelineLease({
    supabase: args.supabase,
    pipelineKey: ROLLING_FORGE_RUN_PIPELINE_KEY,
    scopeKey: args.scopeKey,
    operationKey: buildRollingForgeStageKillsKey(args.stageId),
    rangeStartDate: args.runDate,
    rangeEndDate: args.runDate,
    initialCursorDate: args.runDate,
    leaseMs: 30_000,
    now
  });
  const kills = (lease.cursorGameId ?? 0) + 1;
  const advanced = await advanceProjectionPipelineLease({
    supabase: args.supabase,
    lease,
    nextCursorDate: lease.cursorDate ?? args.runDate,
    nextCursorGameId: kills,
    leaseMs: 30_000,
    now
  });
  await finishProjectionPipelineLease({
    supabase: args.supabase,
    lease: advanced,
    outcome: "failed",
    failureCode: buildRollingForgeStageKilledCode(kills)
  });
  return kills;
}

export async function readRollingForgeRunState(args: {
  supabase: SupabaseClient<Database>;
  scopeKey: string;
}): Promise<Map<string, RollingForgeStageState>> {
  const { data, error } = await args.supabase
    .from("projection_pipeline_state")
    .select("operation_key,status,cursor_game_id,last_error,lease_expires_at,updated_at")
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
        typeof row.lease_expires_at === "string" ? row.lease_expires_at : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null
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

/**
 * Stores a stage's cursor. Without `leaseExpiresAtMs` this is the hand-off
 * of a partial stage: the lease is released shortly after. With it, the
 * invocation keeps the stage (a chunk finished mid-stage).
 */
export function advanceRollingForgeStage(args: {
  supabase: SupabaseClient<Database>;
  lease: ProjectionPipelineLease;
  cursorGameId: number | null;
  leaseExpiresAtMs?: number;
}) {
  const now = new Date();
  return advanceProjectionPipelineLease({
    supabase: args.supabase,
    lease: args.lease,
    nextCursorDate: args.lease.cursorDate ?? args.lease.rangeStartDate,
    nextCursorGameId: args.cursorGameId ?? args.lease.cursorGameId,
    leaseMs:
      args.leaseExpiresAtMs == null
        ? ROLLING_FORGE_HANDOFF_LEASE_MS
        : Math.max(ROLLING_FORGE_HANDOFF_LEASE_MS, args.leaseExpiresAtMs - now.getTime()),
    now
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

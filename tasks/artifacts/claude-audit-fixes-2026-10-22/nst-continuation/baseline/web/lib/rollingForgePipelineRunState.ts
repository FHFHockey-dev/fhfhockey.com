import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

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
  leaseOwner?: string | null;
  updatedAt: string | null;
};

// A partial stage releases its lease with an explicit resumable marker.
export const ROLLING_FORGE_HANDOFF_LEASE_MS = 30_000;
const HANDOFF_CODE = "stage_handoff";

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
  if (state.lastError === HANDOFF_CODE) return 0;
  const match = FAILURE_ATTEMPT_PATTERN.exec(state.lastError ?? "");
  return match ? Number(match[1]) : 1;
}

/**
 * Checkpoints do not change ownership. Any expired running lease is dead;
 * deliberate handoffs are explicitly marked failed/resumable instead.
 */
export function isRollingForgeStageLeaseDead(
  state: RollingForgeStageState | undefined,
  nowMs = Date.now()
) {
  if (state?.status !== "running" || !state.leaseExpiresAt) return false;
  const expiresAt = Date.parse(state.leaseExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt > nowMs) return false;
  return true;
}

/**
 * Preserve the legacy aggregate count. New kills have one durable receipt
 * per lease owner, so racing/replayed observers cannot count a death twice.
 */
function buildRollingForgeStageKillsKey(stageId: RollingForgePipelineStageId) {
  return `${stageId}:kills`;
}

export function readRollingForgeStageKills(
  states: Map<string, RollingForgeStageState>,
  stageId: RollingForgePipelineStageId
) {
  const legacy = states.get(buildRollingForgeStageKillsKey(stageId))?.cursorGameId ?? 0;
  const prefix = `${stageId}:kill:`;
  return legacy + [...states.keys()].filter(key => key.startsWith(prefix) && /^[a-f0-9]{24}$/.test(key.slice(prefix.length))).length;
}

/** Creating the owner-keyed receipt is the accounting commit. Completion is housekeeping;
 * even a recorder killed immediately after acquisition leaves exactly one counted receipt. */
export async function recordRollingForgeStageKill(args: {
  supabase: SupabaseClient<Database>;
  scopeKey: string;
  stageId: RollingForgePipelineStageId;
  runDate: string;
  expiredLeaseOwner: string | null;
}): Promise<number> {
  if (!args.expiredLeaseOwner) throw new Error("Expired stage lease has no owner identity");
  const now = new Date();
  const ownerKey = createHash("sha256").update(args.expiredLeaseOwner).digest("hex").slice(0, 24);
  const lease = await acquireProjectionPipelineLease({
    supabase: args.supabase,
    pipelineKey: ROLLING_FORGE_RUN_PIPELINE_KEY,
    scopeKey: args.scopeKey,
    operationKey: `${args.stageId}:kill:${ownerKey}`,
    rangeStartDate: args.runDate,
    rangeEndDate: args.runDate,
    initialCursorDate: args.runDate,
    leaseMs: 30_000,
    now
  });
  if (lease.status === "running") await finishProjectionPipelineLease({
    supabase: args.supabase,
    lease,
    outcome: "complete"
  });
  return readRollingForgeStageKills(await readRollingForgeRunState(args), args.stageId);
}

export async function readRollingForgeRunState(args: {
  supabase: SupabaseClient<Database>;
  scopeKey: string;
}): Promise<Map<string, RollingForgeStageState>> {
  const { data, error } = await args.supabase
    .from("projection_pipeline_state")
    .select("operation_key,status,cursor_game_id,last_error,lease_owner,lease_expires_at,updated_at")
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
      leaseOwner: typeof row.lease_owner === "string" ? row.lease_owner : null,
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
 * of a partial stage: the lease is explicitly released. With it, the
 * invocation keeps the stage (a chunk finished mid-stage).
 */
export async function advanceRollingForgeStage(args: {
  supabase: SupabaseClient<Database>;
  lease: ProjectionPipelineLease;
  cursorGameId: number | null;
  leaseExpiresAtMs?: number;
}) {
  const now = new Date();
  const advanced = await advanceProjectionPipelineLease({
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
  return args.leaseExpiresAtMs == null
    ? finishProjectionPipelineLease({ supabase: args.supabase, lease: advanced, outcome: "failed", failureCode: HANDOFF_CODE })
    : advanced;
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

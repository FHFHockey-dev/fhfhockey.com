import { z } from "zod";
import { jsonValue, RUN_PHASES, RunnerError, type ExperimentPlan, type JsonValue, type RunState, type StepResult } from "./runnerContracts";
import type { OwnerReadStore } from "./ownerRoutes";

export type WorkerLease = Readonly<{
  runId: string; ownerUserId: string; workerId: string; fence: number; expiresAtMs: number;
  planHash: string; unitId: string;
}>;
export type ClaimedWork = Readonly<{
  lease: WorkerLease; plan: ExperimentPlan; unit: ExperimentPlan["work"][number]; checkpoint: JsonValue | null;
}>;
export type StepAcceptance = "accepted" | "checkpointed" | "pending_outcomes" | "retry_queued"
  | "failed" | "cancelled" | "stale" | "already_accepted";
export type StoreMode = "memory_reference" | "durable";
const RUN_STATES = ["queued", "running", "cancellation_requested", "cancelled", "failed",
  "completed_awaiting_reveal", "completed_revealed"] as const satisfies ReadonlyArray<RunState>;
const TERMINAL_STATES: ReadonlyArray<RunState> = ["cancelled", "failed", "completed_awaiting_reveal", "completed_revealed"];
/** Closed vocabulary: a projection never carries free-form store or executor text. */
export const RUN_EVENTS = ["accepted", "step_claimed", "unit_accepted", "checkpoint_saved", "awaiting_outcomes",
  "retry_queued", "completed_sealed", "planned_reveal", "cancellation_requested", "cancelled", "cancelled_at_checkpoint",
  "cancelled_after_lease_expiry", "run_deadline", "execution_budget", "outcome_check_budget", "retry_budget",
  "storage_limit"] as const;
export type RunEvent = typeof RUN_EVENTS[number];
export const MAX_LISTED_RUNS = 50;

/** No payloads, hashes of outcomes, checkpoints or arbitrary error text in this projection. */
export type RunProgress = Readonly<{
  runId: string; planHash: string; storageMode: StoreMode; state: RunState; revision: number;
  createdAtMs: number; finishedAtMs: number | null; heartbeatAtMs: number | null;
  notBeforeMs: number; lastEvent: RunEvent;
  stages: ReadonlyArray<{
    phase: ExperimentPlan["work"][number]["phase"]; total: number; successful: number;
    failed: number; pending: number; skipped: 0; percent: number | null;
  }>;
}>;

/**
 * Internal server/worker interface, not an HTTP/auth boundary. A future durable
 * adapter must commit each method atomically: owner+idempotency uniqueness,
 * immutable plan, monotonic fencing, output uniqueness and counter/checkpoint
 * transitions in the same transaction. Acknowledgement follows durable commit.
 * Stored owner identity comes from the server owner policy, never a request body.
 */
export interface ExperimentRunStore {
  readonly storageMode: StoreMode;
  accept(ownerUserId: string, idempotencyKey: string, plan: unknown, nowMs: number): Promise<{ runId: string; planHash: string; replayed: boolean; storageMode: StoreMode }>;
  claim(ownerUserId: string, runId: string, workerId: string, nowMs: number): Promise<ClaimedWork | null>;
  finish(lease: WorkerLease, result: StepResult, nowMs: number): Promise<StepAcceptance>;
  cancel(ownerUserId: string, runId: string, nowMs: number): Promise<RunProgress>;
  progress(ownerUserId: string, runId: string): Promise<RunProgress>;
  /** Newest first, at most MAX_LISTED_RUNS, operational projections only. */
  list(ownerUserId: string): Promise<ReadonlyArray<RunProgress>>;
  reveal(ownerUserId: string, runId: string, nowMs: number): Promise<boolean>;
  results(ownerUserId: string, runId: string): Promise<{ status: "sealed" } | { status: "revealed"; outputs: ReadonlyArray<{ unitId: string; payload: JsonValue }> }>;
}

const count = z.number().int().nonnegative().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const stageSchema = z.object({
  phase: z.enum(RUN_PHASES), total: count.positive(), successful: count, failed: count, pending: count,
  skipped: z.literal(0), percent: z.number().nullable(),
}).strict().refine(stage => stage.successful + stage.failed + stage.pending === stage.total
  && stage.percent === (stage.phase === "fitting" ? null : (stage.successful + stage.failed) / stage.total * 100));
export const runProgressSchema = z.object({
  runId: z.string().uuid(), planHash: hash, storageMode: z.enum(["memory_reference", "durable"]),
  state: z.enum(RUN_STATES), revision: count, createdAtMs: count, finishedAtMs: count.nullable(),
  heartbeatAtMs: count.nullable(), notBeforeMs: count, lastEvent: z.enum(RUN_EVENTS),
  stages: z.array(stageSchema).min(1).max(RUN_PHASES.length),
}).strict().refine(run => TERMINAL_STATES.includes(run.state) === (run.finishedAtMs !== null)
  && run.stages.every((stage, index) => index === 0
    || RUN_PHASES.indexOf(stage.phase) > RUN_PHASES.indexOf(run.stages[index - 1].phase)));
const revealedResultsSchema = z.object({
  status: z.literal("revealed"),
  outputs: z.array(z.object({ unitId: hash, payload: jsonValue }).strict()),
}).strict();

/**
 * Validating OwnerReadStore over a run store. Operational reads return only the
 * strict progress projection; any other store output is refused, never reflected.
 * Sealed reads need the store's own results channel to agree with a
 * completed_revealed projection. Health, manifest, logs and export have no store
 * source yet and fail closed. Not installed in the exported route wrappers.
 */
export function createRunStoreReadAdapter(store: ExperimentRunStore): OwnerReadStore {
  const projection = (value: unknown, runId?: string) => {
    const parsed = runProgressSchema.safeParse(value);
    if (!parsed.success || runId !== undefined && parsed.data.runId !== runId
      || parsed.data.storageMode !== store.storageMode) throw new RunnerError("invalid_projection");
    return parsed.data;
  };
  const current = async (ownerId: string, runId: string) => projection(await store.progress(ownerId, runId), runId);
  const unsupported = (): never => { throw new RunnerError("operation_not_supported"); };
  return {
    listOwned: async ownerId => {
      const runs: unknown = await store.list(ownerId);
      if (!Array.isArray(runs) || runs.length > MAX_LISTED_RUNS) throw new RunnerError("invalid_projection");
      const projected = runs.map(run => projection(run));
      if (new Set(projected.map(run => run.runId)).size !== projected.length) throw new RunnerError("invalid_projection");
      return { runs: projected };
    },
    findOwned: async (ownerId, runId) => {
      try { await current(ownerId, runId); }
      catch (error) {
        if (error instanceof RunnerError && error.code === "run_not_found") return null;
        throw error;
      }
      return { ownerUserId: ownerId, runId };
    },
    readOperational: async (ownerId, runId, operation) => operation === "progress" ? current(ownerId, runId) : unsupported(),
    authorizeSealedRead: async (ownerId, runId) => (await current(ownerId, runId)).state === "completed_revealed"
      && revealedResultsSchema.safeParse(await store.results(ownerId, runId)).success,
    readSealed: async (ownerId, runId, operation) => {
      if (operation !== "results") return unsupported();
      if ((await current(ownerId, runId)).state !== "completed_revealed") throw new RunnerError("results_sealed");
      const parsed = revealedResultsSchema.safeParse(await store.results(ownerId, runId));
      if (!parsed.success) throw new RunnerError("results_sealed");
      return parsed.data;
    },
  };
}

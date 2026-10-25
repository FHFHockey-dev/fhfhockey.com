import { z } from "zod";
import { contentHash, jsonValue, parsePlan, RunnerError, type ExperimentPlan, type JsonValue, type RunState, type StepResult } from "./runnerContracts";
import { MAX_LISTED_RUNS, runProgressSchema, type RunEvent } from "./runProjection";
import type { OwnerReadStore } from "./ownerRoutes";

export { MAX_LISTED_RUNS, RUN_EVENTS, runProgressSchema, type RunEvent } from "./runProjection";

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
  /** The immutable accepted plan: configuration references only, never outputs or outcomes. */
  manifest(ownerUserId: string, runId: string): Promise<ExperimentPlan>;
  results(ownerUserId: string, runId: string): Promise<{ status: "sealed" } | { status: "revealed"; outputs: ReadonlyArray<{ unitId: string; payload: JsonValue }> }>;
}

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const revealedResultsSchema = z.object({
  status: z.literal("revealed"),
  outputs: z.array(z.object({ unitId: hash, payload: jsonValue }).strict()),
}).strict();

/**
 * Validating OwnerReadStore over a run store. Operational reads return only the
 * strict progress projection; any other store output is refused, never reflected.
 * Sealed reads need the store's own results channel to agree with a
 * completed_revealed projection. The manifest is the revalidated, hash-bound plan.
 * Health, logs and export have no store source yet and fail closed. Not installed in the exported route wrappers.
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
    readOperational: async (ownerId, runId, operation) => {
      if (operation === "progress") return current(ownerId, runId);
      if (operation !== "manifest") return unsupported();
      // Revalidate and bind to the run's own plan hash; a mismatched plan is refused.
      const { planHash } = await current(ownerId, runId);
      let plan: ExperimentPlan;
      try { plan = parsePlan(await store.manifest(ownerId, runId)); } catch { throw new RunnerError("invalid_projection"); }
      if (contentHash(plan) !== planHash) throw new RunnerError("invalid_projection");
      return { runId, planHash, plan };
    },
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

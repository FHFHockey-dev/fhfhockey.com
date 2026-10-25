import type { ExperimentPlan, JsonValue, RunState, StepResult } from "./runnerContracts";

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
  notBeforeMs: number; lastEvent: string;
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
  reveal(ownerUserId: string, runId: string, nowMs: number): Promise<boolean>;
  results(ownerUserId: string, runId: string): Promise<{ status: "sealed" } | { status: "revealed"; outputs: ReadonlyArray<{ unitId: string; payload: JsonValue }> }>;
}

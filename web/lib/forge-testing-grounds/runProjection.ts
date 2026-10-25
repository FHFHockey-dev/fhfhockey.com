import { z } from "zod";
import type { RunState } from "./runnerContracts";

// Browser-safe: zod only and no node imports, so the preview can validate saved listings.
export const RUN_PHASES = ["history", "fitting", "prediction", "evaluation"] as const;
export const RUN_STATES = ["queued", "running", "cancellation_requested", "cancelled", "failed",
  "completed_awaiting_reveal", "completed_revealed"] as const satisfies ReadonlyArray<RunState>;
const TERMINAL_STATES: ReadonlyArray<RunState> = ["cancelled", "failed", "completed_awaiting_reveal", "completed_revealed"];
/** Closed vocabulary: a projection never carries free-form store or executor text. */
export const RUN_EVENTS = ["accepted", "step_claimed", "unit_accepted", "checkpoint_saved", "awaiting_outcomes",
  "retry_queued", "completed_sealed", "planned_reveal", "cancellation_requested", "cancelled", "cancelled_at_checkpoint",
  "cancelled_after_lease_expiry", "run_deadline", "execution_budget", "outcome_check_budget", "retry_budget",
  "storage_limit"] as const;
export type RunEvent = typeof RUN_EVENTS[number];
export const MAX_LISTED_RUNS = 50;

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

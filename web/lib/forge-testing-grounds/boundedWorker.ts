import { parseStepResult, type StepResult } from "./runnerContracts";
import type { ClaimedWork, ExperimentRunStore } from "./runStore";

export type StepExecutor = (work: ClaimedWork, signal: AbortSignal) => Promise<StepResult>;

/**
 * One step only, with no maintenance route/provider/model imports. Executors must
 * be side-effect-free against immutable inputs and honor the signal/checkpoint
 * deadline. A timer cannot preempt synchronous CPU work; hosted fitting remains
 * unqualified until its bound/checkpoint behavior is measured independently.
 */
export async function runBoundedStep(args: {
  store: ExperimentRunStore; ownerUserId: string; runId: string; workerId: string;
  now: () => number; execute: StepExecutor;
}) {
  const work = await args.store.claim(args.ownerUserId, args.runId, args.workerId, args.now());
  if (!work) return { status: "not_claimed" as const };
  const abort = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const startedAt = args.now();
  const timeoutMs = Math.min(work.plan.limits.stepTimeoutMs, work.lease.expiresAtMs - startedAt);
  const failure = (code: "executor_failed" | "step_timeout"): StepResult => ({ kind: "failed", code });
  if (timeoutMs <= 0) return { status: await args.store.finish(work.lease, failure("step_timeout"), args.now()), unitId: work.lease.unitId };
  let result: StepResult;
  try {
    result = await Promise.race([
      Promise.resolve().then(() => args.execute(work, abort.signal)).then(parseStepResult).catch(() => failure("executor_failed")),
      new Promise<StepResult>(resolve => {
        timeout = setTimeout(() => { abort.abort(); resolve(failure("step_timeout")); }, Math.max(0, timeoutMs));
      }),
    ]);
  } finally { if (timeout !== undefined) clearTimeout(timeout); }
  const finishedAt = args.now();
  // A blocked event loop can delay the timer. Do not accept an over-time result
  // even when the executor resolves before the overdue timer gets scheduled.
  if (finishedAt >= startedAt + timeoutMs) { abort.abort(); result = failure("step_timeout"); }
  // Late executor promises never call finish. Store fencing independently rejects
  // stale acknowledgements, even if the worker timed out or lost its response.
  return { status: await args.store.finish(work.lease, result, finishedAt), unitId: work.lease.unitId };
}


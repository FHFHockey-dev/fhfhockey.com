import { randomUUID } from "node:crypto";
import { boundedPayload, checkedIdentity, checkedInstant, contentHash, freezeCopy, parsePlan, parseStepResult, RUN_PHASES,
  RunnerError, workUnitId, type ExperimentPlan, type JsonValue, type RunState, type StepResult } from "./runnerContracts";
import type { ClaimedWork, ExperimentRunStore, RunProgress, StepAcceptance, WorkerLease } from "./runStore";

type StoredPayload = ReturnType<typeof boundedPayload>;
type Run = {
  id: string; owner: string; plan: ExperimentPlan; hash: string; state: RunState; revision: number; fence: number;
  created: number; updated: number; finished: number | null; heartbeat: number | null; notBefore: number;
  lease: WorkerLease | null; event: string; bytes: number;
  outputs: Map<string, StoredPayload>; checkpoints: Map<string, StoredPayload[]>;
  executions: Map<string, number>; outcomeChecks: Map<string, number>;
  failures: Map<string, number>; failedUnit: string | null;
};
const terminal = (state: RunState) => ["cancelled", "failed", "completed_awaiting_reveal", "completed_revealed"].includes(state);

/** Inert reference store. Atomic within this instance, NOT durable across process exit. */
export class MemoryExperimentRunStore implements ExperimentRunStore {
  readonly storageMode = "memory_reference" as const;
  private readonly runs = new Map<string, Run>();
  private readonly requests = new Map<string, string>();
  private readonly capacity: { maxQueuedRuns: number; maxConcurrentLeases: number };

  constructor(capacity: { maxQueuedRuns: number; maxConcurrentLeases: number }) {
    if (![capacity.maxQueuedRuns, capacity.maxConcurrentLeases].every(n => Number.isSafeInteger(n) && n > 0)) throw new RunnerError("invalid_capacity");
    this.capacity = { ...capacity };
  }
  private owned(owner: string, id: string): Run {
    const run = this.runs.get(id);
    if (!run || run.owner !== checkedIdentity(owner)) throw new RunnerError("run_not_found");
    return run;
  }
  private at(run: Run, now: number) {
    checkedInstant(now);
    if (now < run.updated) throw new RunnerError("clock_before_state");
  }
  private change(run: Run, now: number, event: string) {
    run.revision++; run.updated = now; run.event = event;
  }
  private stop(run: Run, state: "cancelled" | "failed", now: number, event: string) {
    run.state = state; run.finished = now; run.lease = null; run.fence++;
    this.change(run, now, event);
  }
  private next(run: Run) {
    return run.plan.work.findIndex((_, index) => !run.outputs.has(workUnitId(run.hash, index)));
  }

  async accept(ownerUserId: string, idempotencyKey: string, value: unknown, nowMs: number) {
    const owner = checkedIdentity(ownerUserId), now = checkedInstant(nowMs), plan = parsePlan(value);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(idempotencyKey)) throw new RunnerError("invalid_idempotency_key");
    checkedInstant(now + plan.limits.maxRunMs);
    const hash = contentHash(plan), key = `${owner}:${idempotencyKey}`, existing = this.requests.get(key);
    if (existing) {
      const run = this.runs.get(existing)!;
      if (run.hash !== hash) throw new RunnerError("idempotency_conflict");
      return { runId: run.id, planHash: hash, replayed: true, storageMode: this.storageMode };
    }
    if ([...this.runs.values()].filter(run => !terminal(run.state)).length >= this.capacity.maxQueuedRuns) throw new RunnerError("queue_capacity");
    const bytes = Buffer.byteLength(JSON.stringify(plan));
    if (bytes > plan.limits.maxStoredBytes) throw new RunnerError("storage_limit");
    const id = randomUUID();
    this.runs.set(id, { id, owner, plan, hash, state: "queued", revision: 0, fence: 0,
      created: now, updated: now, finished: null, heartbeat: null, notBefore: now, lease: null, event: "accepted", bytes,
      outputs: new Map(), checkpoints: new Map(), executions: new Map(), outcomeChecks: new Map(), failures: new Map(), failedUnit: null });
    this.requests.set(key, id); // Same atomic acceptance as the run record.
    return { runId: id, planHash: hash, replayed: false, storageMode: this.storageMode };
  }

  async claim(ownerUserId: string, runId: string, workerId: string, nowMs: number): Promise<ClaimedWork | null> {
    const run = this.owned(ownerUserId, runId), worker = checkedIdentity(workerId);
    this.at(run, nowMs);
    if (terminal(run.state)) return null;
    if (run.state === "cancellation_requested") {
      if (!run.lease || run.lease.expiresAtMs <= nowMs) this.stop(run, "cancelled", nowMs, "cancelled_after_lease_expiry");
      return null;
    }
    if (nowMs >= run.created + run.plan.limits.maxRunMs) { this.stop(run, "failed", nowMs, "run_deadline"); return null; }
    if (nowMs < run.notBefore || run.lease && run.lease.expiresAtMs > nowMs) return null;
    if ([...this.runs.values()].filter(other => other.lease && other.lease.expiresAtMs > nowMs).length >= this.capacity.maxConcurrentLeases) return null;
    const index = this.next(run), unitId = workUnitId(run.hash, index);
    const outcomeLimit = run.plan.limits.maxOutcomeChecksPerUnit ?? run.plan.limits.maxExecutionsPerUnit;
    if ((run.outcomeChecks.get(unitId) ?? 0) >= outcomeLimit) {
      // Operational resource stop, not an observed failure of unavailable outcomes.
      this.stop(run, "failed", nowMs, "outcome_check_budget"); return null;
    }
    const executions = run.executions.get(unitId) ?? 0;
    if (executions >= run.plan.limits.maxExecutionsPerUnit) {
      run.failedUnit = unitId; this.stop(run, "failed", nowMs, "execution_budget"); return null;
    }
    const lease = freezeCopy({ runId, ownerUserId: run.owner, workerId: worker, fence: ++run.fence,
      expiresAtMs: Math.min(nowMs + run.plan.limits.leaseMs, run.created + run.plan.limits.maxRunMs), planHash: run.hash, unitId });
    run.lease = lease; run.state = "running"; run.heartbeat = nowMs;
    run.executions.set(unitId, executions + 1); this.change(run, nowMs, "step_claimed");
    const history = run.checkpoints.get(unitId) ?? [];
    return freezeCopy({ lease, plan: run.plan, unit: run.plan.work[index], checkpoint: history.at(-1)?.value ?? null });
  }

  async finish(lease: WorkerLease, result: StepResult, nowMs: number): Promise<StepAcceptance> {
    const run = this.owned(lease.ownerUserId, lease.runId);
    this.at(run, nowMs);
    result = parseStepResult(result);
    if (lease.planHash !== run.hash) return "stale";
    const existing = run.outputs.get(lease.unitId);
    if (existing && result.kind === "completed") {
      const retry = boundedPayload(result.payload, run.plan.limits.maxOutputBytes);
      if (retry.hash !== existing.hash) throw new RunnerError("output_conflict");
      return "already_accepted"; // Lost acknowledgement: no output/counter/state rewrite.
    }
    if (!run.lease || lease.fence !== run.lease.fence || lease.workerId !== run.lease.workerId
      || lease.unitId !== run.lease.unitId || nowMs >= run.lease.expiresAtMs) return "stale";
    if (run.state === "cancellation_requested") { this.stop(run, "cancelled", nowMs, "cancelled_at_checkpoint"); return "cancelled"; }
    if (run.state !== "running") return "stale";
    const index = this.next(run), unit = run.plan.work[index];
    if (result.kind === "pending_outcomes" && unit.phase !== "evaluation") throw new RunnerError("invalid_pending_phase");
    if (result.kind === "completed" && unit.phase === "evaluation" && result.outcomeStatus !== "settled") throw new RunnerError("outcomes_not_settled");
    let payload: StoredPayload | null = null;
    if (result.kind === "completed" || result.kind === "checkpoint") {
      payload = boundedPayload(result.payload, result.kind === "completed" ? run.plan.limits.maxOutputBytes : run.plan.limits.maxCheckpointBytes);
      if (run.bytes + payload.bytes > run.plan.limits.maxStoredBytes) {
        run.failedUnit = lease.unitId; this.stop(run, "failed", nowMs, "storage_limit"); return "failed";
      }
    }
    run.heartbeat = nowMs;
    if (result.kind === "completed") {
      run.outputs.set(lease.unitId, payload!); run.bytes += payload!.bytes;
      run.lease = null;
      const complete = this.next(run) === -1;
      run.state = complete ? "completed_awaiting_reveal" : "queued";
      run.finished = complete ? nowMs : null; run.notBefore = nowMs;
      this.change(run, nowMs, complete ? "completed_sealed" : "unit_accepted");
      return "accepted";
    }
    if (result.kind === "checkpoint") {
      run.checkpoints.set(lease.unitId, [...(run.checkpoints.get(lease.unitId) ?? []), payload!]); run.bytes += payload!.bytes;
    }
    if (result.kind === "pending_outcomes") {
      // Claim provisionally charges computation so crashes remain bounded. A
      // valid availability-only acknowledgement moves it to the separate cap.
      // Fencing above ensures a duplicate/stale reply cannot refund it twice.
      run.executions.set(lease.unitId, run.executions.get(lease.unitId)! - 1);
      run.outcomeChecks.set(lease.unitId, (run.outcomeChecks.get(lease.unitId) ?? 0) + 1);
    }
    if (result.kind === "failed") {
      const failures = (run.failures.get(lease.unitId) ?? 0) + 1; run.failures.set(lease.unitId, failures);
      if (failures >= run.plan.limits.maxFailuresPerUnit) {
        run.failedUnit = lease.unitId; this.stop(run, "failed", nowMs, "retry_budget"); return "failed";
      }
    }
    run.lease = null; run.state = "queued";
    run.notBefore = result.kind === "checkpoint" ? nowMs : Math.min(nowMs + run.plan.limits.retryDelayMs, run.created + run.plan.limits.maxRunMs);
    this.change(run, nowMs, result.kind === "checkpoint" ? "checkpoint_saved"
      : result.kind === "pending_outcomes" ? "awaiting_outcomes" : "retry_queued");
    return result.kind === "checkpoint" ? "checkpointed" : result.kind === "pending_outcomes" ? "pending_outcomes" : "retry_queued";
  }

  async cancel(ownerUserId: string, runId: string, nowMs: number): Promise<RunProgress> {
    const run = this.owned(ownerUserId, runId); this.at(run, nowMs);
    if (terminal(run.state)) return this.progress(ownerUserId, runId);
    if (run.lease && run.lease.expiresAtMs > nowMs) {
      run.state = "cancellation_requested"; this.change(run, nowMs, "cancellation_requested");
    } else this.stop(run, "cancelled", nowMs, "cancelled");
    return this.progress(ownerUserId, runId);
  }
  async progress(ownerUserId: string, runId: string): Promise<RunProgress> {
    const run = this.owned(ownerUserId, runId);
    return freezeCopy({ runId: run.id, planHash: run.hash, storageMode: this.storageMode, state: run.state, revision: run.revision,
      createdAtMs: run.created, finishedAtMs: run.finished, heartbeatAtMs: run.heartbeat, notBeforeMs: run.notBefore, lastEvent: run.event,
      stages: RUN_PHASES.flatMap(phase => {
        const ids = run.plan.work.flatMap((unit, index) => unit.phase === phase ? [workUnitId(run.hash, index)] : []);
        if (!ids.length) return [];
        const successful = ids.filter(id => run.outputs.has(id)).length, failed = ids.includes(run.failedUnit ?? "") ? 1 : 0;
        return [{ phase, total: ids.length, successful, failed, pending: ids.length - successful - failed, skipped: 0 as const,
          percent: phase === "fitting" ? null : (successful + failed) / ids.length * 100 }];
      }) });
  }
  async reveal(ownerUserId: string, runId: string, nowMs: number): Promise<boolean> {
    const run = this.owned(ownerUserId, runId); this.at(run, nowMs);
    // A date and an executor's "settled" assertion cannot authorize real holdouts.
    // Only synthetic fixtures have a reveal implementation in this reference store.
    if (run.plan.inputManifest.historyClass !== "synthetic") return false;
    if (run.state === "completed_revealed") return true;
    if (run.state !== "completed_awaiting_reveal" || nowMs < run.plan.reveal.notBeforeMs) return false;
    run.state = "completed_revealed"; this.change(run, nowMs, "planned_reveal"); return true;
  }
  async results(ownerUserId: string, runId: string) {
    const run = this.owned(ownerUserId, runId);
    if (run.state !== "completed_revealed") return { status: "sealed" as const };
    return freezeCopy({ status: "revealed" as const, outputs: [...run.outputs.entries()].map(([unitId, payload]) => ({ unitId, payload: payload.value })) });
  }
}

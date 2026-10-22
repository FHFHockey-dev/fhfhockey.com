import { describe, expect, it, vi } from "vitest";

import {
  ROUTE_RUNNER_LEASE_MS,
  ROUTE_RUNNER_SOURCE_DOWN_WAIT_MS,
  ROUTE_RUNNER_STEP_DEADLINE_MS
} from "./core";
import { createMemoryRouteRunnerStore, makeJob } from "./memoryStore.testHelper";
import { runRouteRunnerTick, type RouteHandler } from "./tick";

const NOW = Date.parse("2026-10-22T10:00:00.000Z");
const now = () => NOW;
const NST_PATH = "/api/v1/db/update-nst-gamelog";
const SCOPE = { runMode: "incremental", startDate: "2026-03-01", endDate: "2026-03-07" };

function responder(statusCode: number, body: unknown): RouteHandler {
  return vi.fn(async (_req: any, res: any) => res.status(statusCode).json(body));
}

function nstContinuation(cursor: number) {
  return responder(207, {
    success: false,
    operationStatus: "continuation_required",
    resume: { required: true, request: { query: { ...SCOPE, deadlineAt: "1", cursor: String(cursor) } } },
    nstProgress: {
      auditPersistence: "confirmed",
      continuation: { nextIndex: cursor, totalUrls: 400 },
      sourceOutcomes: { counts: { rows_persisted: 38 } }
    }
  });
}

function tick(store: any, handlers: Record<string, RouteHandler>, extra: Record<string, unknown> = {}) {
  return runRouteRunnerTick({ store, handlers, cronSecret: "cron-secret", now, ...extra });
}

describe("runRouteRunnerTick", () => {
  it("does nothing when no job is runnable", async () => {
    const future = new Date(NOW + 60_000).toISOString();
    const { store } = createMemoryRouteRunnerStore([
      makeJob({ status: "waiting", not_before: future }),
      makeJob({ id: "00000000-0000-4000-8000-000000000009", status: "completed" })
    ]);
    const handler = responder(200, { success: true });
    await expect(tick(store, { [NST_PATH]: handler })).resolves.toEqual({ success: true, action: "idle", expired: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("claims the oldest job, runs one step with the cron bearer and a deadline, and releases the lease", async () => {
    const { store, jobs, events } = createMemoryRouteRunnerStore([
      makeJob({ id: "00000000-0000-4000-8000-000000000002", created_at: "2026-10-22T09:30:00.000Z" }),
      makeJob()
    ]);
    const handler = nstContinuation(40);
    const summary = await tick(store, { [NST_PATH]: handler });

    expect(summary).toMatchObject({ action: "stepped", jobId: makeJob().id, step: 1, statusCode: 207, outcome: "continue" });
    const [req] = (handler as any).mock.calls[0];
    expect(req.headers.authorization).toBe("Bearer cron-secret");
    expect(req.query).toEqual({ ...SCOPE, deadlineAt: String(NOW + ROUTE_RUNNER_STEP_DEADLINE_MS - 20_000) });

    const job = jobs.get(makeJob().id)!;
    expect(job).toMatchObject({
      status: "queued",
      lease_until: null,
      steps: 1,
      rows_total: 38,
      next_query: { ...SCOPE, cursor: "40" },
      last_status_code: 207,
      last_operation_status: "continuation_required"
    });
    expect(job.progress).toMatchObject({ done: 40, total: 400, unit: "urls", rowsTotal: 38 });
    expect(jobs.get("00000000-0000-4000-8000-000000000002")!.status).toBe("queued");
    expect(events.map((event) => [event.level, event.step, event.status_code])).toEqual([
      ["info", 1, null],
      ["info", 1, 207]
    ]);
  });

  it("keeps global concurrency at one", async () => {
    const leased = new Date(NOW + 30_000).toISOString();
    const { store } = createMemoryRouteRunnerStore([
      makeJob({ id: "00000000-0000-4000-8000-000000000002", status: "running", lease_until: leased }),
      makeJob()
    ]);
    const handler = responder(200, { success: true });
    await expect(tick(store, { [NST_PATH]: handler })).resolves.toMatchObject({ action: "busy" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("backs off and restores the job when another tick leased a job after its check", async () => {
    const memory = createMemoryRouteRunnerStore([makeJob()]);
    let checks = 0;
    const store = {
      ...memory.store,
      findLeaseHolder: async () => (checks++ === 0 ? null : "other-job")
    };
    const handler = responder(200, { success: true });
    await expect(tick(store, { [NST_PATH]: handler })).resolves.toMatchObject({ action: "busy" });
    expect(handler).not.toHaveBeenCalled();
    expect(memory.jobs.get(makeJob().id)).toMatchObject({ status: "queued", lease_until: null });
  });

  it("reports a lost race when the conditional claim matches nothing", async () => {
    const memory = createMemoryRouteRunnerStore([makeJob()]);
    const store = { ...memory.store, claimJob: async () => null };
    await expect(tick(store, { [NST_PATH]: responder(200, {}) })).resolves.toMatchObject({ action: "lost_race" });
  });

  it("completes, waits on source_down, and fails", async () => {
    const complete = createMemoryRouteRunnerStore([makeJob()]);
    await tick(complete.store, { [NST_PATH]: responder(200, { success: true, operationStatus: "completed" }) });
    expect(complete.jobs.get(makeJob().id)).toMatchObject({ status: "completed", finished_at: new Date(NOW).toISOString(), lease_until: null });
    expect(complete.events.at(-1)?.level).toBe("success");

    const wait = createMemoryRouteRunnerStore([makeJob()]);
    await tick(wait.store, { [NST_PATH]: responder(503, { success: false, operationStatus: "source_down" }) });
    expect(wait.jobs.get(makeJob().id)).toMatchObject({
      status: "waiting",
      next_query: SCOPE,
      not_before: new Date(NOW + ROUTE_RUNNER_SOURCE_DOWN_WAIT_MS).toISOString()
    });

    const failed = createMemoryRouteRunnerStore([makeJob()]);
    await tick(failed.store, { [NST_PATH]: vi.fn(async () => { throw new Error("db down"); }) });
    expect(failed.jobs.get(makeJob().id)).toMatchObject({ status: "failed", last_status_code: 500, last_error: "HTTP 500: The route threw: db down" });
  });

  it("counts a killed step, retries, and fails after three kills", async () => {
    const lapsed = new Date(NOW - 1_000).toISOString();
    const retry = createMemoryRouteRunnerStore([makeJob({ status: "running", lease_until: lapsed, steps: 2, kills: 1 })]);
    const handler = nstContinuation(40);
    await tick(retry.store, { [NST_PATH]: handler });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(retry.jobs.get(makeJob().id)).toMatchObject({ kills: 2, steps: 3, status: "queued" });
    expect(retry.events[0]).toMatchObject({ level: "warn", step: 3 });

    const out = createMemoryRouteRunnerStore([makeJob({ status: "running", lease_until: lapsed, kills: 2 })]);
    const unused = responder(200, { success: true });
    await expect(tick(out.store, { [NST_PATH]: unused })).resolves.toMatchObject({ action: "killed_out" });
    expect(unused).not.toHaveBeenCalled();
    expect(out.jobs.get(makeJob().id)).toMatchObject({ status: "failed", kills: 3, lease_until: null });
  });

  it("stops a step that outlives the timeout and keeps the lease until it lapses", async () => {
    const memory = createMemoryRouteRunnerStore([makeJob()]);
    const hung: RouteHandler = () => new Promise(() => undefined);
    await expect(tick(memory.store, { [NST_PATH]: hung }, { stepTimeoutMs: 5 })).resolves.toMatchObject({ action: "timed_out" });
    expect(memory.jobs.get(makeJob().id)).toMatchObject({
      status: "queued",
      kills: 1,
      steps: 0,
      lease_until: new Date(NOW + ROUTE_RUNNER_LEASE_MS).toISOString()
    });
  });

  it("records a step whose job was cancelled mid-run without continuing it", async () => {
    const memory = createMemoryRouteRunnerStore([makeJob()]);
    const handler: RouteHandler = async (_req, res) => {
      memory.jobs.get(makeJob().id)!.status = "cancelled";
      return nstContinuation(40)(_req, res);
    };
    await tick(memory.store, { [NST_PATH]: handler });
    expect(memory.jobs.get(makeJob().id)).toMatchObject({ status: "cancelled", steps: 1, lease_until: null, next_query: SCOPE });
    expect(memory.events.at(-1)).toMatchObject({ level: "warn" });
  });

  it("never runs cancelled jobs and fails expired ones", async () => {
    const { store, jobs, events } = createMemoryRouteRunnerStore([
      makeJob({ status: "cancelled" }),
      makeJob({ id: "00000000-0000-4000-8000-000000000003", expires_at: new Date(NOW - 1).toISOString() })
    ]);
    const handler = responder(200, { success: true });
    await expect(tick(store, { [NST_PATH]: handler })).resolves.toEqual({ success: true, action: "idle", expired: 1 });
    expect(handler).not.toHaveBeenCalled();
    expect(jobs.get("00000000-0000-4000-8000-000000000003")!.status).toBe("failed");
    expect(events[0]).toMatchObject({ level: "error", job_id: "00000000-0000-4000-8000-000000000003" });
  });

  it("rejects a job whose route is not on the allowlist", async () => {
    const { store, jobs } = createMemoryRouteRunnerStore([makeJob({ route_path: "/api/v1/db/update-teams" })]);
    await expect(tick(store, { [NST_PATH]: responder(200, {}) })).resolves.toMatchObject({ action: "rejected" });
    expect(jobs.get(makeJob().id)).toMatchObject({ status: "failed", lease_until: null });
  });

  it("replays a projection date while games complete and fails when they stop", async () => {
    const path = "/api/v1/db/run-projection-v2";
    const memory = createMemoryRouteRunnerStore([
      makeJob({ route_path: path, contract: null, next_query: { date: "2026-10-22" } })
    ]);
    const partial = (completedGames: number) =>
      responder(207, {
        success: false,
        operationStatus: "partial",
        resume: { required: true, reason: "runtime_budget", runId: "r", completedGames, totalGames: 12, request: { date: "2026-10-22" } }
      });
    const first = partial(4);
    await tick(memory.store, { [path]: first });
    expect((first as any).mock.calls[0][0].query).toEqual({
      date: "2026-10-22",
      maxDurationMs: String(ROUTE_RUNNER_STEP_DEADLINE_MS - 40_000)
    });
    for (const done of [8, 12 - 1]) await tick(memory.store, { [path]: partial(done) });
    expect(memory.jobs.get(makeJob().id)).toMatchObject({ status: "queued", steps: 3, next_query: { date: "2026-10-22" } });
    expect(memory.jobs.get(makeJob().id)!.progress).toMatchObject({ done: 11, total: 12, unit: "games", stalls: 0 });

    // Another call holds the run: wait 150 s without counting a stall.
    await tick(memory.store, {
      [path]: responder(207, { success: false, operationStatus: "partial", resume: { required: true, reason: "run_in_progress_elsewhere", completedGames: null, totalGames: null, request: { date: "2026-10-22" } } })
    });
    expect(memory.jobs.get(makeJob().id)).toMatchObject({ status: "waiting", not_before: new Date(NOW + 150_000).toISOString() });
    memory.jobs.get(makeJob().id)!.not_before = null;

    for (let step = 0; step < 3; step += 1) await tick(memory.store, { [path]: partial(11) });
    expect(memory.jobs.get(makeJob().id)).toMatchObject({ status: "failed", steps: 7 });
    expect(memory.jobs.get(makeJob().id)!.last_error).toBe("No progress: completed games stayed at 11 for 3 steps in a row.");
  });

  it("fails a freshness-blocked rolling step but keeps its continuation for a re-queue", async () => {
    const rolling = "/api/v1/db/update-rolling-player-averages";
    const memory = createMemoryRouteRunnerStore([
      makeJob({ route_path: rolling, contract: "rolling_resume_from", next_query: { startDate: "2026-01-01", endDate: "2026-01-31" } })
    ]);
    await tick(memory.store, {
      [rolling]: responder(422, {
        success: false,
        operationStatus: "blocked",
        freshnessGate: { status: "FAIL", blockerCount: 1 },
        resume: { required: true, nextResumeFrom: 8478402, request: { startDate: "2026-01-01", endDate: "2026-01-31", resumeFrom: 8478402 } }
      })
    });
    const job = memory.jobs.get(makeJob().id)!;
    expect(job).toMatchObject({
      status: "failed",
      last_status_code: 422,
      last_operation_status: "blocked",
      next_query: { startDate: "2026-01-01", endDate: "2026-01-31", resumeFrom: "8478402" }
    });
    expect(job.last_error).toContain("Blocked by freshness checks");
    expect(job.progress).toMatchObject({ blockedBy: "freshness", blockerCount: 1 });
  });

  it("keeps the approved bypass on a bypassed job and marks every step result", async () => {
    const rolling = "/api/v1/db/update-rolling-player-averages";
    const freshnessBypass = {
      approvedBy: "admin-1", approvedAt: "2026-10-22T09:59:00.000Z",
      sourceJobId: "00000000-0000-4000-8000-000000000009", blockerCount: 1, reason: "Blocked by freshness checks."
    };
    const memory = createMemoryRouteRunnerStore([
      makeJob({ route_path: rolling, contract: "rolling_resume_from", progress: { freshnessBypass },
        next_query: { startDate: "2026-01-01", endDate: "2026-01-31", bypassFreshnessBlockers: "true" } })
    ]);
    await tick(memory.store, { [rolling]: responder(200, { success: true, operationStatus: "completed", runSummary: { rowsUpserted: 12 } }) });
    const job = memory.jobs.get(makeJob().id)!;
    expect(job.status).toBe("completed");
    expect(job.progress).toMatchObject({ freshnessBypass });
    const result = memory.events.find((event) => event.status_code === 200)!;
    expect(result.level).toBe("warn");
    expect(result.message).toContain("Freshness bypass approved by admin-1 at 2026-10-22T09:59:00.000Z");
  });

  it("fails a job whose route keeps asking for the same query", async () => {
    const rolling = "/api/v1/db/update-rolling-player-averages";
    const memory = createMemoryRouteRunnerStore([
      makeJob({ route_path: rolling, contract: "rolling_resume_from", next_query: { startDate: "2026-01-01" } })
    ]);
    const stuck = responder(207, { success: false, operationStatus: "partial", resume: { required: true, nextResumeFrom: null, request: { startDate: "2026-01-01" } } });
    for (let step = 0; step < 3; step += 1) await tick(memory.store, { [rolling]: stuck });
    expect(memory.jobs.get(makeJob().id)).toMatchObject({ status: "failed", steps: 3 });
    expect(memory.jobs.get(makeJob().id)!.last_error).toContain("same query 3 steps");
  });
});

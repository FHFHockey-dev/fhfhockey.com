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

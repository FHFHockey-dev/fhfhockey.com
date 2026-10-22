import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  role: vi.fn(),
  auditInsert: vi.fn(),
  memory: null as any
}));

vi.mock("lib/supabase/server", () => ({
  default: { from: () => ({ insert: mocks.auditInsert }) }
}));
vi.mock("lib/supabase", () => ({
  createClientWithToken: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.role }) }) })
  })
}));
vi.mock("lib/routeRunner/store", () => ({
  createSupabaseRouteRunnerStore: () => mocks.memory.store
}));

// The tick imports every allowlisted route handler statically; none may run here.
const routeHandler = vi.hoisted(() => () => ({
  default: vi.fn(async (_req: any, res: any) => res.status(200).json({ success: true }))
}));
vi.mock("../../../../../pages/api/v1/db/update-nst-gamelog", routeHandler);
vi.mock("../../../../../pages/api/v1/db/update-rolling-player-averages", routeHandler);
vi.mock("../../../../../pages/api/v1/db/update-nst-team-daily", routeHandler);
vi.mock("../../../../../pages/api/v1/db/update-nst-goalies", routeHandler);
vi.mock("../../../../../pages/api/v1/db/update-nst-current-season", routeHandler);
vi.mock("../../../../../pages/api/v1/db/update-wgo-skaters", routeHandler);
vi.mock("../../../../../pages/api/v1/db/update-wgo-goalies", routeHandler);
vi.mock("../../../../../pages/api/v1/db/update-wgo-totals", routeHandler);
vi.mock("../../../../../pages/api/v1/db/run-projection-v2", routeHandler);

import { createMemoryRouteRunnerStore, makeJob } from "lib/routeRunner/memoryStore.testHelper";
import jobsHandler from "../../../../../pages/api/v1/db/route-runner/jobs";
import jobHandler from "../../../../../pages/api/v1/db/route-runner/jobs/[id]";
import tickHandler from "../../../../../pages/api/v1/db/route-runner-tick";
import nstGamelogHandler from "../../../../../pages/api/v1/db/update-nst-gamelog";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

function createRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    headersSent: false,
    setHeader() {
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  } as any;
}

function request(method: string, authorization?: string, extra: Record<string, unknown> = {}) {
  return { method, headers: { authorization, host: "fhfhockey.com" }, query: {}, url: "/api/v1/db/route-runner", ...extra } as any;
}

const originalCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  process.env.CRON_SECRET = "configured-test-secret";
  mocks.memory = createMemoryRouteRunnerStore();
  mocks.getUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
  mocks.role.mockResolvedValue({ data: { role: "admin" } });
  mocks.auditInsert.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("route runner jobs API", () => {
  it("rejects missing and non-admin bearers before touching jobs", async () => {
    const anonymous = createRes();
    await jobsHandler(request("GET"), anonymous);
    expect(anonymous.statusCode).toBe(401);

    mocks.role.mockResolvedValue({ data: { role: null } });
    const member = createRes();
    await jobsHandler(request("POST", "Bearer user-token", { body: { path: "/api/v1/db/update-wgo-totals" } }), member);
    expect(member.statusCode).toBe(403);
    expect(mocks.memory.jobs.size).toBe(0);
  });

  it("queues an allowlisted route for the verified admin", async () => {
    const res = createRes();
    await jobsHandler(
      request("POST", "Bearer admin-token", {
        body: { path: "https://fhfhockey.com/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-01&endDate=2026-03-07&deadlineAt=5" }
      }),
      res
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      ignoredParams: ["deadlineAt"],
      job: {
        route_path: "/api/v1/db/update-nst-gamelog",
        contract: "nst_resume",
        status: "queued",
        created_by: ADMIN_ID,
        next_query: { runMode: "incremental", startDate: "2026-03-01", endDate: "2026-03-07" }
      }
    });
    expect(mocks.memory.events[0].message).toContain("Ignored deadlineAt");
  });

  it("queues a single-date projection run with a null stored contract and rejects ranges", async () => {
    const res = createRes();
    await jobsHandler(
      request("POST", "Bearer admin-token", { body: { path: "/api/v1/db/run-projection-v2?date=2026-10-22&maxDurationMs=5" } }),
      res
    );
    expect(res.statusCode).toBe(201);
    // route_runner_jobs.contract only accepts the original four contracts.
    expect(res.body).toMatchObject({
      ignoredParams: ["maxDurationMs"],
      job: { route_path: "/api/v1/db/run-projection-v2", contract: null, next_query: { date: "2026-10-22" } }
    });

    const range = createRes();
    await jobsHandler(
      request("POST", "Bearer admin-token", {
        body: { path: "/api/v1/db/run-projection-v2?startDate=2026-10-20&endDate=2026-10-22" }
      }),
      range
    );
    expect(range.statusCode).toBe(400);
    expect(range.body.error).toContain("single-date runs only");
  });

  it("rejects routes off the allowlist and malformed bodies", async () => {
    const offList = createRes();
    await jobsHandler(request("POST", "Bearer admin-token", { body: { path: "/api/v1/db/update-teams" } }), offList);
    expect(offList.statusCode).toBe(400);
    expect(offList.body.error).toContain("not on the route runner allowlist");

    const missing = createRes();
    await jobsHandler(request("POST", "Bearer admin-token", { body: {} }), missing);
    expect(missing.statusCode).toBe(400);
    expect(mocks.memory.jobs.size).toBe(0);
  });

  it("lists jobs for the cron bearer without recording a user", async () => {
    mocks.memory = createMemoryRouteRunnerStore([makeJob()]);
    const res = createRes();
    await jobsHandler(request("GET", "Bearer configured-test-secret"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});

describe("route runner job API", () => {
  const id = makeJob().id;

  it("returns the job with events after an id", async () => {
    mocks.memory = createMemoryRouteRunnerStore([makeJob()]);
    await mocks.memory.store.insertEvents([
      { job_id: id, level: "info", message: "one" },
      { job_id: id, level: "info", message: "two" }
    ]);
    const res = createRes();
    await jobHandler(request("GET", "Bearer admin-token", { query: { id, after: "1" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.events.map((event: any) => event.message)).toEqual(["two"]);

    const bad = createRes();
    await jobHandler(request("GET", "Bearer admin-token", { query: { id: "x" } }), bad);
    expect(bad.statusCode).toBe(400);
  });

  it("cancels an active job once and clears a wait on run_now", async () => {
    mocks.memory = createMemoryRouteRunnerStore([makeJob({ status: "waiting", not_before: "2026-10-22T11:00:00.000Z" })]);
    const runNow = createRes();
    await jobHandler(request("POST", "Bearer admin-token", { query: { id }, body: { action: "run_now" } }), runNow);
    expect(runNow.body.job).toMatchObject({ status: "waiting", not_before: null });

    const cancel = createRes();
    await jobHandler(request("POST", "Bearer admin-token", { query: { id }, body: { action: "cancel" } }), cancel);
    expect(cancel.body.job.status).toBe("cancelled");

    const again = createRes();
    await jobHandler(request("POST", "Bearer admin-token", { query: { id }, body: { action: "cancel" } }), again);
    expect(again.statusCode).toBe(409);
  });

  it("requires admin auth", async () => {
    const res = createRes();
    await jobHandler(request("POST", undefined, { query: { id }, body: { action: "cancel" } }), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("route runner tick route", () => {
  it("rejects unauthenticated calls before running or auditing", async () => {
    mocks.memory = createMemoryRouteRunnerStore([makeJob()]);
    const res = createRes();
    await tickHandler(request("GET"), res);
    expect(res.statusCode).toBe(401);
    expect(nstGamelogHandler).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("runs one step for the cron bearer and writes one small audit row", async () => {
    mocks.memory = createMemoryRouteRunnerStore([makeJob()]);
    const res = createRes();
    await tickHandler(request("GET", "Bearer configured-test-secret"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, action: "stepped", outcome: "complete" });
    expect(nstGamelogHandler).toHaveBeenCalledTimes(1);
    expect(mocks.memory.jobs.get(makeJob().id).status).toBe("completed");
    expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
    expect(mocks.auditInsert.mock.calls[0][0]).toMatchObject({ job_name: "route-runner-tick", rows_affected: null });
  });

  it("claims nothing when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    mocks.memory = createMemoryRouteRunnerStore([makeJob()]);
    const res = createRes();
    await tickHandler(request("POST", "Bearer admin-token"), res);
    expect(res.statusCode).toBe(500);
    expect(mocks.memory.jobs.get(makeJob().id).status).toBe("queued");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ seed: vi.fn(), inspect: vi.fn(), consumer: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("lib/player-forecasts/orchestration", () => ({
  seedCalendarForgeJobs: mocks.seed,
  inspectCalendarForgeCoverage: mocks.inspect,
}));

vi.mock("lib/player-forecasts/calendarCoverage", async (importOriginal) => ({
  ...await importOriginal<typeof import("lib/player-forecasts/calendarCoverage")>(),
  inspectCalendarConsumerCoverage: mocks.consumer,
}));

import handler from "./forecast-calendar";
import { ForecastScheduleError } from "lib/player-forecasts/scopeReads";

function response() {
  return { statusCode: 200, body: null as unknown,
    setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; }, end() { return this; } } as any;
}

describe("forecast calendar scheduler", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "local-test-secret");
    vi.stubEnv("STARTER_BOARD_CALENDAR_SCHEDULER_ENABLED", "false");
    vi.stubEnv("STARTER_BOARD_CALENDAR_DRY_RUN", "true");
    mocks.seed.mockReset().mockResolvedValue({ calendarDays: 14, dryRun: true, gameIds: [1],
      calendarPolicy: { version: "forecast-calendar-v1", calendarDays: 14, overlapDays: 7, timeZone: "UTC" },
      excludedByCanary: 0, inserted: 0, workload: [] });
    mocks.consumer.mockReset().mockResolvedValue({ status: "evaluated", requiredPlayerGameTargets: 3,
      eligiblePlayerGameTargets: 1, recommendationReadiness: "not_evaluated" });
    mocks.inspect.mockReset().mockResolvedValue({ games: 1, queuedGames: 0, issuedGames: 0,
      unissuedGameIds: [1], projectionRows: 0, complete: true, readStatus: "complete", coverageBasis: "storage_receipts",
      scopeReceipts: { gameIds: [1], queue: [], revisions: [] },
      consumerCoverage: { status: "not_evaluated", requiredPlayerGameTargets: null, eligiblePlayerGameTargets: null } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects unauthenticated calls and leaves scheduled work disabled by default", async () => {
    const unauthorized = response();
    await handler({ method: "GET", headers: {}, query: {} } as any, unauthorized);
    expect(unauthorized.statusCode).toBe(401);
    const disabled = response();
    await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" }, query: {} } as any, disabled);
    expect(disabled.body).toEqual({ disabled: true });
    expect(mocks.seed).not.toHaveBeenCalled();
  });

  it("previews dry-run coverage without treating queue receipts as issued forecasts", async () => {
    vi.stubEnv("STARTER_BOARD_CALENDAR_DRY_RUN", "false");
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" },
      query: { preview: "true", dryRun: "false", days: "14" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(mocks.seed).toHaveBeenCalledWith(expect.objectContaining({ days: 14, dryRun: true }));
    expect(res.body).toMatchObject({ dryRun: true, coverage: { games: 1, queuedGames: 0,
      issuedGames: 0, projectionRows: 0, unissuedGameIds: [1], readStatus: "complete",
      consumerCoverage: { status: "not_evaluated", eligiblePlayerGameTargets: null } } });
    expect(res.body.calendarPolicy).toEqual({ version: "forecast-calendar-v1", calendarDays: 14, overlapDays: 7, timeZone: "UTC" });
    expect(res.body.coverage).not.toHaveProperty("scopeReceipts");
  });
  it("evaluates an explicit profile across pre-canary competitors without certifying a lineup", async () => {
    const scopes = [{ gameId: 1 }, { gameId: 2 }];
    mocks.seed.mockResolvedValueOnce({ calendarDays: 14, dryRun: true, gameIds: [1], scopes,
      excludedByCanary: 1, inserted: 0, workload: [], scheduleCoverage: { readStatus: "complete", staleGameIds: [2] } });
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" },
      query: { preview: "true", skaterTargets: "GOALS,ASSISTS", goalieTargets: "SAVES_GOALIE" } } as any, res);
    expect(mocks.consumer).toHaveBeenCalledWith(expect.anything(), scopes,
      { skaterTargets: ["ASSISTS", "GOALS"], goalieTargets: ["SAVES_GOALIE"] }, expect.any(Date), 14,
      { gameIds: [1], queue: [], revisions: [] });
    expect(res.body).toMatchObject({ dryRun: true, excludedByCanary: 1, scheduleCoverage: { staleGameIds: [2] },
      coverage: { consumerCoverage: { status: "evaluated", requiredPlayerGameTargets: 3, eligiblePlayerGameTargets: 1,
        recommendationReadiness: "not_evaluated" } } });
  });
  it("rejects invalid profiles before orchestration and never substitutes zero after consumer failure", async () => {
    for (const query of [{ skaterTargets: "" }, { skaterTargets: ["GOALS"] }, { goalieTargets: "GOALS" }, { skaterTargets: "SAVES_GOALIE" }]) {
      const res = response();
      await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" }, query: { preview: "true", ...query } } as any, res);
      expect(res.statusCode).toBe(400);
    }
    expect(mocks.seed).not.toHaveBeenCalled();
    mocks.consumer.mockRejectedValueOnce(new Error("private source failure"));
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" },
      query: { preview: "true", skaterTargets: "GOALS" } } as any, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Forecast calendar orchestration unavailable", coverageUnavailable: true,
      queueReceipt: { dryRun: true, inserted: 0, gameIds: [1], excludedByCanary: 0 } });
  });
  it("reports incomplete diagnostic reads as unavailable, never as zero issued coverage", async () => {
    mocks.inspect.mockRejectedValue(new Error("private backend details"));
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" }, query: { preview: "true" } } as any, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Forecast calendar orchestration unavailable", coverageUnavailable: true,
      queueReceipt: { dryRun: true, inserted: 0, gameIds: [1], excludedByCanary: 0 } });
    expect(mocks.seed).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });
  it("retains safe per-game failures without turning complete schedule reads into usable coverage", async () => {
    const receipt = { readStatus: "complete" as const, validationStatus: "rejected" as const, stage: "reconciliation" as const,
      scope: { fromDate: "2026-09-30", throughDate: "2026-10-21", teamId: null },
      discoveredGames: 148, checkedGames: 148, unreadGames: 0,
      reasons: ["start_time_mismatch" as const], rejectedGames: [{ gameId: 2026020048, reasons: ["start_time_mismatch" as const] }] };
    const error = new ForecastScheduleError(receipt);
    error.cause = new Error("private database payload");
    mocks.seed.mockRejectedValueOnce(error);
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" },
      query: { preview: "true", skaterTargets: "GOALS" } } as any, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Forecast calendar orchestration unavailable", dryRun: true, inserted: 0,
      scheduleCoverage: receipt, consumerCoverage: { status: "not_evaluated", requiredPlayerGameTargets: null, eligiblePlayerGameTargets: null } });
    expect(JSON.stringify(res.body)).not.toContain("private");
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(mocks.consumer).not.toHaveBeenCalled();
  });
  it("retains an acknowledged queue write when later coverage discovery fails", async () => {
    vi.stubEnv("STARTER_BOARD_CALENDAR_SCHEDULER_ENABLED", "true");
    mocks.seed.mockResolvedValueOnce({ calendarDays: 14, dryRun: false, gameIds: [1],
      excludedByCanary: 2, inserted: 1, workload: [] });
    mocks.inspect.mockRejectedValueOnce(new Error("private diagnostic failure"));
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer local-test-secret" },
      query: { dryRun: "false" } } as any, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Forecast calendar orchestration unavailable", coverageUnavailable: true,
      queueReceipt: { dryRun: false, inserted: 1, gameIds: [1], excludedByCanary: 2 } });
    expect(mocks.seed).toHaveBeenCalledTimes(1);
    expect(mocks.consumer).not.toHaveBeenCalled();
  });
});

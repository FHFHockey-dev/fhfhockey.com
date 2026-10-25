import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  // Installed before the route graph loads, so an import-time request would be caught.
  // A plain counter, so vi.clearAllMocks cannot hide an earlier request.
  const network = { requests: 0 };
  globalThis.fetch = (() => { network.requests += 1; throw new Error("Network forbidden in route test"); }) as any;
  return { run: vi.fn(), limit: vi.fn(), auditInsert: vi.fn(), network };
});
vi.mock("lib/integrations/yahoo/pollCoordinator", () => ({ runYahooDraftPollCoordinator: mocks.run }));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => table === "cron_job_audit"
  ? { insert: mocks.auditInsert }
  : { select: () => ({ in: () => ({ limit: mocks.limit }) }) } } }));
import handler from "../../../../pages/api/internal/yahoo-live-draft";

const response = () => {
  // The audit wrapper swaps res.json, so assertions keep the original spy as `sent`.
  const res: any = { statusCode: 200, headersSent: false, setHeader: vi.fn() };
  res.json = res.sent = vi.fn(() => { res.headersSent = true; return res; });
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  return res;
};
const request = (authorization = "Bearer test-secret", method = "GET") => ({ method, url: "/api/internal/yahoo-live-draft", headers: { authorization } });
const auditRow = () => {
  expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
  return mocks.auditInsert.mock.calls[0][0];
};

describe("Yahoo production scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-08-01T04:00:00Z"));
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "true");
    vi.stubEnv("YAHOO_LIVE_DRAFT_SEASON", "2026");
    vi.stubEnv("YAHOO_LIVE_DRAFT_TARGET_SEASON_ID", "20262027");
    mocks.limit.mockResolvedValue({ data: [], error: null });
    mocks.run.mockResolvedValue({ attempted: 1, succeeded: 1, failed: 0 });
    mocks.auditInsert.mockResolvedValue({ error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("rejects wrong methods and unauthorized requests without provider work", async () => {
    for (const [req, status] of [[request("wrong"), 401], [request(undefined, "POST"), 405]] as const) {
      const res = response();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(status);
    }
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });
  it("fails closed without a scheduler secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = response();
    await handler(request() as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });
  it("does no work when disabled or no sessions are active", async () => {
    const res = response();
    await handler(request() as any, res as any);
    expect(res.sent).toHaveBeenCalledWith({ cycles: 0, attempted: 0, succeeded: 0, failed: 0 });
    expect(auditRow()).toMatchObject({ job_name: "/api/internal/yahoo-live-draft", status: "success", rows_affected: null });
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "false");
    await handler(request() as any, res as any);
    expect(res.sent).toHaveBeenLastCalledWith({ disabled: true });
    expect(mocks.run).not.toHaveBeenCalled();
    // The disabled exit is not an execution and adds no second row.
    expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
  });
  it("suspends off-season polling before configuration, database or provider work", async () => {
    vi.setSystemTime(new Date("2027-08-01T03:59:59.999Z"));
    vi.stubEnv("YAHOO_LIVE_DRAFT_SEASON", "");
    const res = response();
    await handler(request() as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.sent).toHaveBeenCalledWith({ suspended: true, resumesAt: "2027-08-01T00:00:00-04:00" });
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("runs bounded batches across the minute boundary", async () => {
    vi.useFakeTimers();
    mocks.limit.mockResolvedValue({ data: [{ id: "session" }], error: null });
    const res = response();
    const pending = handler(request() as any, res as any);
    await vi.advanceTimersByTimeAsync(65_000);
    await pending;
    expect(mocks.run).toHaveBeenCalledTimes(65);
    expect(mocks.run).toHaveBeenCalledWith({ limit: 4, concurrency: 4 });
    expect(res.status).toHaveBeenCalledWith(200);
    // One row for the whole invocation, written before the response is flushed.
    const row = auditRow();
    expect(row).toMatchObject({ status: "success", rows_affected: null,
      details: { statusCode: 200, rowsUpserted: null, failedRows: null, error: null } });
    expect(JSON.parse(row.details.response)).toEqual({ cycles: 65, attempted: 65, succeeded: 65, failed: 0 });
    expect(mocks.auditInsert.mock.invocationCallOrder[0]).toBeLessThan(res.sent.mock.invocationCallOrder[0]);
  });
  it("records a partial batch as a failed run with its true counters", async () => {
    mocks.limit.mockResolvedValue({ data: [{ id: "session" }], error: null });
    mocks.run.mockResolvedValue({ attempted: 3, succeeded: 2, failed: 1 });
    const res = response();
    const pending = handler(request() as any, res as any);
    await vi.advanceTimersByTimeAsync(65_000);
    await pending;
    expect(res.status).toHaveBeenCalledWith(503);
    const row = auditRow();
    expect(row).toMatchObject({ status: "failure", details: { statusCode: 503 } });
    expect(JSON.parse(row.details.response)).toEqual({ cycles: 65, attempted: 195, succeeded: 130, failed: 65 });
  });
  it("does not leak provider or database errors", async () => {
    mocks.limit.mockResolvedValue({ data: null, error: new Error("private details") });
    const res = response();
    await handler(request() as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.sent).toHaveBeenCalledWith({ error: "Yahoo polling coordinator unavailable" });
    expect(auditRow()).toMatchObject({ status: "failure", details: { statusCode: 503 } });
    expect(JSON.stringify(auditRow())).not.toContain("private details");
  });
  it("records a thrown coordinator as one safe failure row", async () => {
    mocks.limit.mockResolvedValue({ data: [{ id: "session" }], error: null });
    mocks.run.mockRejectedValue(new Error("private provider detail"));
    const res = response();
    await handler(request() as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.sent).toHaveBeenCalledExactlyOnceWith({ error: "Yahoo polling coordinator unavailable" });
    const row = auditRow();
    expect(row).toMatchObject({ status: "failure", details: { statusCode: 503, error: null,
      responseOutcome: { error: "Yahoo polling coordinator unavailable" } } });
    for (const sensitive of ["private provider detail", "test-secret"]) expect(JSON.stringify(row)).not.toContain(sensitive);
  });
  it("still answers when the audit insert fails", async () => {
    mocks.auditInsert.mockResolvedValue({ error: { message: "audit unavailable" } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = response();
    await handler(request() as any, res as any);
    expect(res.sent).toHaveBeenCalledExactlyOnceWith({ cycles: 0, attempted: 0, succeeded: 0, failed: 0 });
    expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
  describe("idle heartbeat", () => {
    const suspendedBody = { suspended: true, resumesAt: "2027-08-01T00:00:00-04:00" };
    it.each([
      { name: "suspended", at: "2027-07-15T12:00:30Z", enabled: "true", body: suspendedBody },
      { name: "disabled", at: "2027-08-15T12:00:00Z", enabled: "false", body: { disabled: true } },
    ])("records one bounded $name row in the 12:00 UTC minute", async ({ at, enabled, body }) => {
      vi.setSystemTime(new Date(at));
      vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", enabled);
      const res = response();
      await handler(request() as any, res as any);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.sent).toHaveBeenCalledExactlyOnceWith(body);
      const row = auditRow();
      expect(row).toMatchObject({ job_name: "/api/internal/yahoo-live-draft", status: "success", rows_affected: null,
        details: { statusCode: 200, rowsUpserted: null, failedRows: null, error: null } });
      expect(JSON.parse(row.details.response)).toEqual(body);
      expect(mocks.limit).not.toHaveBeenCalled();
      expect(mocks.run).not.toHaveBeenCalled();
    });
    it.each(["2027-07-15T11:59:59.999Z", "2027-07-15T12:01:00Z"])("writes no idle row outside the heartbeat minute (%s)", async (at) => {
      vi.setSystemTime(new Date(at));
      const res = response();
      await handler(request() as any, res as any);
      expect(res.sent).toHaveBeenCalledExactlyOnceWith(suspendedBody);
      expect(mocks.auditInsert).not.toHaveBeenCalled();
    });
    it("keeps denied and unconfigured calls unaudited in the heartbeat minute", async () => {
      vi.setSystemTime(new Date("2027-07-15T12:00:00Z"));
      await handler(request("wrong") as any, response() as any);
      vi.stubEnv("CRON_SECRET", "");
      await handler(request() as any, response() as any);
      expect(mocks.auditInsert).not.toHaveBeenCalled();
    });
    it("writes only the poll row when an active run lands in the heartbeat minute", async () => {
      vi.setSystemTime(new Date("2027-08-15T12:00:00Z"));
      const res = response();
      await handler(request() as any, res as any);
      expect(res.sent).toHaveBeenCalledExactlyOnceWith({ cycles: 0, attempted: 0, succeeded: 0, failed: 0 });
      expect(JSON.parse(auditRow().details.response)).toEqual({ cycles: 0, attempted: 0, succeeded: 0, failed: 0 });
    });
    it("still answers when the heartbeat insert fails", async () => {
      vi.setSystemTime(new Date("2027-07-15T12:00:00Z"));
      mocks.auditInsert.mockResolvedValue({ error: { message: "audit unavailable" } });
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = response();
      await handler(request() as any, res as any);
      expect(res.sent).toHaveBeenCalledExactlyOnceWith(suspendedBody);
      expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
      error.mockRestore();
    });
  });
  it("makes no network request at import or during a run", () => {
    expect(mocks.network.requests).toBe(0);
  });
});

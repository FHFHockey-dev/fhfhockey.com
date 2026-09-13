import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), limit: vi.fn() }));
vi.mock("lib/integrations/yahoo/pollCoordinator", () => ({ runYahooDraftPollCoordinator: mocks.run }));
vi.mock("lib/supabase/server", () => ({ default: { from: () => ({ select: () => ({ in: () => ({ limit: mocks.limit }) }) }) } }));
import handler from "../../../../pages/api/internal/yahoo-live-draft";

const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() });
const request = (authorization = "Bearer test-secret", method = "GET") => ({ method, headers: { authorization } });

describe("Yahoo production scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "true");
    vi.stubEnv("YAHOO_LIVE_DRAFT_SEASON", "2026");
    vi.stubEnv("YAHOO_LIVE_DRAFT_TARGET_SEASON_ID", "20262027");
    mocks.limit.mockResolvedValue({ data: [], error: null });
    mocks.run.mockResolvedValue({ attempted: 1, succeeded: 1, failed: 0 });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("rejects wrong methods and unauthorized requests without provider work", async () => {
    for (const [req, status] of [[request("wrong"), 401], [request(undefined, "POST"), 405]] as const) {
      const res = response();
      await handler(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(status);
    }
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("fails closed without a scheduler secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = response();
    await handler(request() as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("does no work when disabled or no sessions are active", async () => {
    const res = response();
    await handler(request() as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ cycles: 0, attempted: 0, succeeded: 0, failed: 0 });
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "false");
    await handler(request() as any, res as any);
    expect(res.json).toHaveBeenLastCalledWith({ disabled: true });
    expect(mocks.run).not.toHaveBeenCalled();
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
  });
  it("does not leak provider or database errors", async () => {
    mocks.limit.mockResolvedValue({ data: null, error: new Error("private details") });
    const res = response();
    await handler(request() as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "Yahoo polling coordinator unavailable" });
  });
});

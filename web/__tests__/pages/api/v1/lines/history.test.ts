import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "pages/api/v1/lines/history";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from } }));

const valid = { teamId: "54", startDate: "2026-11-04", endDate: "2026-11-10", mode: "publication" };
async function request(query: Record<string, unknown> = valid, method = "GET") {
  const response = {
    code: 200, body: undefined as unknown, headers: {} as Record<string, string>,
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end() {},
  };
  await handler({ query, method } as any, response as any);
  return response;
}

function store(data: unknown[] | null = [], error: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  };
  mocks.from.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
  vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
  store();
});
afterEach(() => vi.unstubAllEnvs());

describe("historical Lines API", () => {
  it("returns bounded empty publication coverage without implying completeness", async () => {
    const result = await request();
    expect(result.code).toBe(200);
    expect(result.body).toEqual({
      enabled: true, items: [], nextCursor: null, coverage: "unknown", correctionHistory: "unverified", skippedRecords: 0, scannedRecords: 0,
    });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("tweet_projection_reports");
    expect(result.headers["Cache-Control"]).toBe("private, no-store");
  });

  it("defaults to the separate game-date stream without reading legacy projections", async () => {
    const { mode: _mode, ...scope } = valid;
    await request(scope);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("games");
  });

  it.each([
    {}, { ...valid, teamId: ["54"] }, { ...valid, teamId: "1.5" },
    { ...valid, startDate: "2026-02-29" }, { ...valid, startDate: "2026-11-11" },
    { ...valid, mode: "observed" }, { ...valid, mode: ["game"] },
    { ...valid, cursor: "x),team_id.gt.0" },
  ])("rejects malformed scope/cursors before a private read: %j", async (query) => {
    expect((await request(query)).code).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("requires GET and declares the allowed method", async () => {
    const result = await request(valid, "POST");
    expect(result.code).toBe(405);
    expect(result.headers.Allow).toBe("GET");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not query either stream when publishing is disabled", async () => {
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "false");
    expect((await request()).body).toMatchObject({ enabled: false, items: [] });
    await request({ ...valid, mode: "game" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns safe 503 errors rather than empty success on store failures", async () => {
    store(null, { message: "SECRET backend failure" });
    const result = await request();
    expect(result.code).toBe(503);
    expect(result.body).toEqual({ error: "Historical reports are temporarily unavailable" });
  });

  it("asks for a narrower range if the game-scope safety bound is exceeded", async () => {
    store(Array.from({ length: 201 }, () => ({})));
    const result = await request({ ...valid, mode: "game" });
    expect(result.code).toBe(400);
    expect(result.body).toEqual({ error: "This range contains too many games; choose a narrower date range" });
  });
});

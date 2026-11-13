import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ flags: { observations: false, entryServing: false, carryForward: false }, read: vi.fn(), reports: vi.fn(), from: vi.fn() }));
vi.mock("lib/lines/types", async (load) => ({ ...await load<object>(), lineSnapshotFlags: () => mocks.flags }));
vi.mock("lib/lines/service", () => ({ readGameLines: mocks.read }));
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from } }));
vi.mock("lib/sources/tweetProjectionStorage", () => ({ fetchTweetProjectionReports: mocks.reports }));
import handler from "pages/api/v1/lines/projected";
import { fixtureResponse } from "lib/lines/testFixtures";

const request = async (query: Record<string, unknown> = {}, method = "GET") => {
  const res = { code: 200, body: undefined as any, headers: {} as Record<string, string>, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; }, setHeader(name: string, value: string) { this.headers[name] = value; }, end() {} };
  await handler({ query, method } as any, res as any); return res;
};
beforeEach(() => { vi.clearAllMocks(); mocks.flags = { observations: true, entryServing: true, carryForward: true }; mocks.read.mockResolvedValue(fixtureResponse()); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("shared game/team Lines API", () => {
  it("uses one contract for team and game routes without writing on GET", async () => {
    expect((await request({ teamId: "14" })).body.mode).toBe("snapshots");
    expect(mocks.read).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ teamId: 14, gameId: undefined }));
    await request({ gameId: "2026010001" });
    expect(mocks.read).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ gameId: 2026010001, teamId: undefined }));
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([{ teamId: "0" }, { gameId: "-1" }, { teamId: ["14"] }, { teamId: "NaN" }, { gameId: "9007199254740992" }])("rejects invalid scope %j", async (query) => {
    expect((await request(query)).code).toBe(400); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("requires a scope and preserves team participation validation", async () => {
    const missing = await request();
    expect(missing.code).toBe(400); expect(missing.body).toEqual({ error: "A teamId or gameId query parameter is required" }); expect(mocks.read).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue({ ...fixtureResponse(), game: null });
    expect((await request({ teamId: "99", gameId: "2026010001" })).code).toBe(404);
  });
  it("returns an unavailable state if the snapshot store cannot be read", async () => {
    mocks.read.mockRejectedValue(new Error("migration absent"));
    expect((await request({ teamId: "14" })).code).toBe(503);
  });
  it("preserves disabled legacy publishing when entry-serving control is off", async () => {
    mocks.flags.entryServing = false;
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "false");
    expect((await request({ teamId: "14" })).body.enabled).toBe(false);
    expect(mocks.read).not.toHaveBeenCalled(); vi.unstubAllEnvs();
  });
  it("accepts only GET", async () => { expect((await request({ teamId: "14" }, "POST")).code).toBe(405); });
});

describe("legacy team report recency", () => {
  beforeEach(() => {
    mocks.flags.entryServing = false;
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T23:00:00Z"));
    mocks.reports.mockReset(); mocks.from.mockReset();
  });
  const query = (data: unknown, error: unknown = null) => {
    const chain: any = {};
    for (const method of ["select", "eq", "gte", "lt", "order", "limit"]) chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
    mocks.from.mockReturnValue(chain); return chain;
  };
  it("uses the latest retained day within seven prior days when today has no reports", async () => {
    const chain = query({ report_date: "2026-11-11" });
    const retained = { key: "older-report", publishedAt: null, text: "Retained source text" };
    mocks.reports.mockResolvedValueOnce([]).mockResolvedValueOnce([retained]);
    const result = await request({ teamId: "54" });
    expect(result.code).toBe(200);
    expect(result.body.reportScope).toEqual({ requestedDate: "2026-11-12", reportDate: "2026-11-11", fallback: true });
    expect(result.body.reports).toEqual([retained]);
    expect(chain.eq).toHaveBeenCalledWith("team_id", 54);
    expect(chain.gte).toHaveBeenCalledWith("report_date", "2026-11-05");
    expect(chain.lt).toHaveBeenCalledWith("report_date", "2026-11-12");
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(mocks.reports).toHaveBeenLastCalledWith(expect.anything(), { teamId: 54, date: "2026-11-11" });
  });
  it("keeps today's reports and avoids the fallback query, using Eastern today", async () => {
    vi.setSystemTime(new Date("2026-11-13T04:30:00Z"));
    const current = { key: "current-report", publishedAt: null };
    mocks.reports.mockResolvedValue([current]);
    const result = await request({ teamId: "54" });
    expect(result.body.reports).toEqual([current]);
    expect(result.body.reportScope).toEqual({ requestedDate: "2026-11-12", reportDate: "2026-11-12", fallback: false });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not broaden an exact game's empty report result", async () => {
    query({ date: "2026-11-11" }); mocks.reports.mockResolvedValue([]);
    const result = await request({ teamId: "54", gameId: "2026020296" });
    expect(result.body.reportScope.fallback).toBe(false);
    expect(mocks.reports).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("games");
  });
  it.each([null, { report_date: "2026-10-01" }, { report_date: "2026-11-13" }])("keeps empty state without a recent retained date: %j", async (data) => {
    query(data); mocks.reports.mockResolvedValue([]);
    const result = await request({ teamId: "54" });
    expect(result.body.reportScope.fallback).toBe(false);
    expect(mocks.reports).toHaveBeenCalledTimes(1);
  });
  it("reports a store failure rather than pretending there are no posts", async () => {
    query(null, new Error("unavailable")); mocks.reports.mockResolvedValue([]);
    expect((await request({ teamId: "54" })).code).toBe(503);
  });
});

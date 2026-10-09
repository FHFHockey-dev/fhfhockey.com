import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect((await request()).code).toBe(400);
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

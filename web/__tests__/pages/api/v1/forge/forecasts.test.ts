import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), db: {} }));
vi.mock("lib/supabase/server", () => ({ default: mocks.db }));
vi.mock("lib/rosterScheduleData/planning", async importOriginal => ({
  ...await importOriginal<typeof import("lib/rosterScheduleData/planning")>(), loadPlanningData: mocks.load,
}));
import * as displayCodec from "lib/player-forecasts/gameExpectationView";
import { decodeGameExpectationView, GAME_EXPECTATION_VIEW_VERSION, GameExpectationViewLimitError } from "lib/player-forecasts/gameExpectationView";
import * as reader from "lib/player-forecasts/gameExpectationReader";
import handler from "pages/api/v1/forge/forecasts";
const query = { seasonId: "20262027", startDate: "2026-10-15", endDate: "2026-10-18", games: "2", mode: "next_n" };
function response() {
  const res: any = { code: null, body: null, headers: {}, setHeader: vi.fn((k, v) => { res.headers[k] = v; }),
    status: vi.fn(code => { res.code = code; return res; }), end: vi.fn(), json: vi.fn(body => { res.body = body; return res; }) };
  return res;
}
async function request(changes = {}) {
  const res = response(); await handler({ method: "GET", query, ...changes } as any, res); return res;
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  mocks.load.mockResolvedValue({ players: [], games: [], forecasts: [], evidence: {} }); });
afterEach(() => vi.useRealTimers());
describe("read-only public game expectations", () => {
  it("uses one shared loader, returns a versioned view and never invents missing forecasts", async () => {
    const res = await request(); expect(res.code).toBe(200); expect(res.headers["Cache-Control"]).toBe("s-maxage=15, stale-while-revalidate=0");
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith(mocks.db, { ...query, seasonId: 20262027, games: 2, timeZone: "UTC" }, { now: new Date(), skipOwnership: true, skipRecentForm: true });
    expect(res.body.data.version).toBe(GAME_EXPECTATION_VIEW_VERSION);
    expect(decodeGameExpectationView(res.body.data)).toMatchObject({ version: "forge-game-expectations-v1", readAsOf: "2026-10-15T12:00:00.000Z", players: [], manifestId: null });
  });
  it.each(["10", "20"])("accepts a declared %s scheduled-team-game horizon without claiming coverage", async games => {
    const res = await request({ query: { ...query, games } });
    expect(res.code).toBe(200);
    expect(res.body.data.scope.games).toBe(Number(games));
    expect(res.body.data.players).toEqual([]);
  });
  it.each([{ games: "1.5" }, { games: "21" }, { mode: "unknown" }, { mode: ["calendar"] },
    { startDate: "2026-02-30" }, { playerIds: "7,7" }, { playerIds: ["7"] },
    { mode: "calendar", endDate: "2026-11-15" }, { endDate: "2027-01-15" },
    { startDate: "2026-10-16" }, { endDate: "2026-10-14", startDate: "2026-10-12" }])("rejects invalid scope %j before reads", async overrides => {
    const res = await request({ query: { ...query, ...overrides } }); expect(res.code).toBe(400); expect(mocks.load).not.toHaveBeenCalled();
  });
  it.each([["2026-10-15T12:00:07.900Z", "s-maxage=7"], ["2026-10-15T11:59:59.000Z", "s-maxage=0"]])(
    "never lets a shared copy outlive the earliest receipt expiry %s", async (expiresAt, maxAge) => {
      const game = { scheduledAt: "2026-10-15T23:00:00Z", startParticipation: null, targets: { GOALS: {
        expiresAt: "2026-10-15T18:00:00Z", participation: { expiresAt: "2026-10-15T20:00:00Z" }, sources: [{ expiresAt }] } } };
      vi.spyOn(reader, "loadGameExpectations").mockResolvedValueOnce({ players: [{ games: [game] }] } as any);
      vi.spyOn(displayCodec, "buildGameExpectationView").mockReturnValueOnce({} as any);
      const res = await request();
      expect(res.code).toBe(200); expect(res.headers["Cache-Control"]).toBe(`${maxAge}, stale-while-revalidate=0`);
    });
  it("reports delivery capacity honestly without sending a truncated success", async () => {
    vi.spyOn(displayCodec, "buildGameExpectationView").mockImplementationOnce(() => { throw new GameExpectationViewLimitError(); });
    const res = await request();
    expect(res.code).toBe(503);
    expect(res.body).toEqual({ success: false, code: "forecast_view_too_large", error: "This forecast window is too large to display. Choose a shorter window." });
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.body.data).toBeUndefined();
  });
  it("rejects writes and redacts backend errors", async () => {
    expect((await request({ method: "POST" })).code).toBe(405); expect(mocks.load).not.toHaveBeenCalled();
    mocks.load.mockRejectedValue(new Error("fixture-secret-database-url"));
    const res = await request(); expect(res.code).toBe(503); expect(JSON.stringify(res.body)).not.toContain("fixture-secret");
  });
});

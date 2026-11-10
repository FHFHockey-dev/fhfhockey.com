import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ season: vi.fn(), injuries: vi.fn(), news: vi.fn(), pulse: vi.fn() }));
vi.mock("lib/NHL/server", () => ({ getCurrentSeason: mocks.season }));
vi.mock("lib/NHL/server/playoffBracket", () => ({ getPlayoffBracket: vi.fn() }));
vi.mock("lib/newsFeed", () => ({ fetchNewsFeedItems: mocks.news }));
vi.mock("components/NewsFeed/NewsCard", () => ({ default: () => null }));
vi.mock("lib/homepagePulse", () => ({ fetchHomepagePulse: mocks.pulse }));
vi.mock("lib/homepageGameAnalytics", () => ({ enrichHomepageGames: async ({ games }: any) => games }));
vi.mock("lib/sources/injuryStatusIngestion", () => ({
  fetchCurrentHomepagePlayerStatuses: mocks.injuries,
  fetchBellMediaInjuries: vi.fn(), buildTeamStatusDirectory: vi.fn(),
  mapPlayerStatusRowsToHomepageRows: vi.fn(), normalizeBellMediaInjuryRows: vi.fn(),
}));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => {
  const q: any = { select: () => q, gte: () => q, order: () => q, limit: () => q,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: any) => Promise.resolve({ data: [], count: table === "players" ? 10 : null, error: null }).then(resolve),
  }; return q;
} } }));
import { getServerSideProps } from "../../pages/index";
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  mocks.season.mockResolvedValue({ seasonId: 20262027, regularSeasonStartDate: "2026-10-01", regularSeasonEndDate: "2027-04-15", seasonEndDate: "2027-06-30", lastRegularSeasonEndDate: "2026-04-15" });
  mocks.injuries.mockResolvedValue([{ date: "2026-11-10" }]);
  mocks.news.mockResolvedValue([]);
  mocks.pulse.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, text: async () => JSON.stringify(
    url.includes("standings") ? { standings: [] } : { gameWeek: [{ date: "2026-11-10", games: [{ id: 1 }] }] }
  ) })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const run = () => getServerSideProps({ req: {}, res: { setHeader: vi.fn() } });
describe("homepage loading", () => {
  it("uses one direct season lookup and no server-to-self requests", async () => {
    const result = await run();
    expect(mocks.season).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => !String(url).includes("/api/v1/season"))).toBe(true);
    expect(result.props).toMatchObject({ isOffseason: false, homepagePlayerCount: 10, nextGameDate: "2026-11-10" });
  });
  it("starts independent sections while injuries are still pending", async () => {
    let resolve!: (rows: any[]) => void;
    mocks.injuries.mockReturnValue(new Promise((done) => { resolve = done; }));
    const result = run();
    await vi.waitFor(() => { expect(mocks.news).toHaveBeenCalledTimes(2); expect(mocks.pulse).toHaveBeenCalledTimes(1); });
    resolve([{ date: "2026-11-10" }]);
    await result;
  });
  it("keeps injury news when the independent news feed fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.news.mockImplementation(async (args: any) => { if (!args.categories) throw new Error("unavailable"); return [{ id: "injury" }]; });
    const result = await run();
    expect(result.props.latestNews).toEqual([]);
    expect(result.props.recentInjuryNews).toEqual([{ id: "injury" }]);
    vi.restoreAllMocks();
  });
});

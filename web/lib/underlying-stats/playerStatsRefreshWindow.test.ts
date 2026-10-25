import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSeason: vi.fn(),
  summaryGameIds: vi.fn(),
  gamesRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("lib/NHL/server", () => ({ getCurrentSeason: mocks.getCurrentSeason }));
vi.mock("./playerStatsSummaryRefresh", () => ({
  fetchSeasonSummaryGameIdSet: mocks.summaryGameIds,
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX: "derived://underlying-player-summary-v2/",
}));
vi.mock("lib/supabase/pagination", () => ({
  fetchAllSupabasePages: async (factory: (page: { from: number; to: number }) => PromiseLike<{ data: unknown[] }>) =>
    (await factory({ from: 0, to: 999 })).data,
}));
vi.mock("lib/supabase/server", () => {
  const query: any = {
    select: () => query, eq: () => query, lte: () => query, order: () => query, range: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.gamesRows, error: null }).then(resolve),
  };
  return { default: { from: () => query } };
});

import { resolvePlayerStatsIncrementalSelection } from "./playerStatsRefreshWindow";

const id = (n: number) => 2026020000 + n;
/** Finished regular-season games; `ns` are offsets from 2026020000. */
function slate(date: string, ns: number[]) {
  return ns.map(n => ({ id: id(n), date, startTime: `${date}T23:00:00Z`, seasonId: 20262027, type: 2 }));
}
/** The games query orders by date desc, id desc; every game except `uncovered` has a summary. */
function install(games: ReturnType<typeof slate>, uncovered: number[]) {
  mocks.gamesRows = [...games].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  mocks.summaryGameIds.mockResolvedValue(new Set(games.map(game => game.id).filter(gameId => !uncovered.includes(gameId))));
}
const OCT24 = slate("2026-10-24", [171, 172, 173, 174, 175, 176, 177, 178, 179]);
const OCT25 = slate("2026-10-25", [180, 181, 182, 183, 184, 185]);
const HOLES = [id(171), id(179)];

describe("resolvePlayerStatsIncrementalSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20262027 });
  });
  afterEach(() => vi.useRealTimers());

  it("reselects uncovered games behind a newer covered game and reports the earliest selected date", async () => {
    install([...OCT24, ...OCT25], HOLES);
    const selection = await resolvePlayerStatsIncrementalSelection();
    expect(selection).toEqual({ mode: "incremental", seasonId: 20262027, requestedGameType: 2,
      startDate: "2026-10-24", endDate: "2026-10-25", latestCoveredDate: "2026-10-25",
      gameIds: [...HOLES, ...OCT25.map(game => game.id)] });
  });

  it("includes each hole once and excludes covered games between the holes and the watermark", async () => {
    install([...OCT24, ...OCT25], HOLES);
    const { gameIds } = await resolvePlayerStatsIncrementalSelection();
    expect(new Set(gameIds).size).toBe(gameIds.length);
    for (const covered of OCT24.map(game => game.id).filter(gameId => !HOLES.includes(gameId))) {
      expect(gameIds).not.toContain(covered);
    }
  });

  it("selects an uncovered game on the watermark date once", async () => {
    install([...OCT24, ...OCT25], [id(183)]);
    const selection = await resolvePlayerStatsIncrementalSelection();
    expect(selection.startDate).toBe("2026-10-25");
    expect(selection.gameIds).toEqual(OCT25.map(game => game.id));
  });

  it.each([
    ["exactly seven days before", "2026-10-25", true],
    ["eight days before", "2026-10-24", false],
  ])("bounds hole reselection at the latest finished game's date minus 7 days: %s", async (_label, holeDate, selected) => {
    vi.setSystemTime(new Date("2026-11-02T16:00:00Z"));
    install([...slate(holeDate, [190]), ...slate("2026-10-28", [200]), ...slate("2026-11-01", [210, 211])], [id(190)]);
    const selection = await resolvePlayerStatsIncrementalSelection();
    expect(selection.latestCoveredDate).toBe("2026-11-01");
    expect(selection.startDate).toBe(selected ? holeDate : "2026-11-01");
    expect(selection.gameIds).toEqual([...(selected ? [id(190)] : []), id(210), id(211)]);
  });

  it("anchors the bound to the latest finished game, not the wall clock", async () => {
    vi.setSystemTime(new Date("2026-11-20T16:00:00Z"));
    install([...slate("2026-10-25", [190]), ...slate("2026-11-01", [210])], [id(190)]);
    const selection = await resolvePlayerStatsIncrementalSelection();
    expect(selection.endDate).toBe("2026-11-01");
    expect(selection.gameIds).toEqual([id(190), id(210)]);
  });

  it("does not let an unfinished game move the bound", async () => {
    vi.setSystemTime(new Date("2026-11-02T03:00:00Z"));
    install([...slate("2026-10-24", [190]), ...slate("2026-10-31", [205]), ...slate("2026-11-01", [210])], [id(190)]);
    const selection = await resolvePlayerStatsIncrementalSelection();
    expect(selection).toMatchObject({ startDate: "2026-10-24", endDate: "2026-10-31", latestCoveredDate: "2026-10-31" });
    expect(selection.gameIds).toEqual([id(190), id(205)]);
  });

  it("selects only games from the watermark onward when there are no holes", async () => {
    install([...OCT24, ...OCT25], []);
    const selection = await resolvePlayerStatsIncrementalSelection();
    expect(selection).toMatchObject({ startDate: "2026-10-25", latestCoveredDate: "2026-10-25" });
    expect(selection.gameIds).toEqual(OCT25.map(game => game.id));
  });

  it("keeps selecting every finished game when no game is covered", async () => {
    vi.setSystemTime(new Date("2026-11-20T16:00:00Z"));
    const games = [...slate("2026-10-01", [100]), ...slate("2026-11-01", [210])];
    install(games, games.map(game => game.id));
    const selection = await resolvePlayerStatsIncrementalSelection();
    expect(selection).toMatchObject({ startDate: "2026-10-01", endDate: "2026-11-01", latestCoveredDate: null });
    expect(selection.gameIds).toEqual([id(100), id(210)]);
  });

  it("returns an empty selection when no games have finished", async () => {
    install([], []);
    expect(await resolvePlayerStatsIncrementalSelection()).toEqual({ mode: "incremental", seasonId: 20262027,
      requestedGameType: 2, startDate: null, endDate: null, latestCoveredDate: null, gameIds: [] });
    expect(mocks.summaryGameIds).not.toHaveBeenCalled();
  });
});

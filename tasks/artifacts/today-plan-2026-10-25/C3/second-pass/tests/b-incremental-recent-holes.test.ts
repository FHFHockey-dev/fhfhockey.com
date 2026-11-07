// C3b second pass: regression tests for the corrected incremental selector (CODEX-20261025-082).
// Offline only: season lookup, games table, summary coverage and pagination are mocked; games are fabricated.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSeason: vi.fn(),
  summaryGameIds: vi.fn(),
  gamesRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("lib/NHL/server", () => ({ getCurrentSeason: mocks.getCurrentSeason }));
vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", async (importOriginal) => ({
  ...await importOriginal<typeof import("lib/underlying-stats/playerStatsSummaryRefresh")>(),
  fetchSeasonSummaryGameIdSet: mocks.summaryGameIds,
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

import { resolvePlayerStatsIncrementalSelection as canonical } from "lib/underlying-stats/playerStatsRefreshWindow";
import { resolvePlayerStatsIncrementalSelection as corrected } from "../patched/playerStatsRefreshWindow";

/** Finished regular-season games; `ids` are offsets from 2026020000. */
function slate(date: string, ids: number[]) {
  return ids.map(n => ({ id: 2026020000 + n, date, startTime: `${date}T23:00:00Z`, seasonId: 20262027, type: 2 }));
}
/** The games query orders by date desc, id desc. */
function install(games: ReturnType<typeof slate>, uncovered: number[]) {
  mocks.gamesRows = [...games].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  mocks.summaryGameIds.mockResolvedValue(new Set(games.map(g => g.id).filter(id => !uncovered.includes(id))));
}
const id = (n: number) => 2026020000 + n;
const OCT24 = slate("2026-10-24", [171, 172, 173, 174, 175, 176, 177, 178, 179]);
const OCT25 = slate("2026-10-25", [180, 181, 182, 183, 184, 185]);
const HOLES = [id(171), id(179)];
const countOf = (list: number[], value: number) => list.filter(item => item === value).length;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20262027 });
});
afterEach(() => vi.useRealTimers());

describe("C3b canonical selector (sha256 d6a291b2): the defect being corrected", () => {
  it("skips earlier holes once a later game is covered", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    install([...OCT24, ...OCT25], HOLES);
    const selection = await canonical({});
    expect(selection).toMatchObject({ startDate: "2026-10-25", latestCoveredDate: "2026-10-25", endDate: "2026-10-25" });
    for (const hole of HOLES) expect(selection.gameIds).not.toContain(hole);
  });
});

describe("C3b corrected selector", () => {
  it("reports the interval truthfully: startDate is the earliest selected game; latestCoveredDate stays the watermark", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    install([...OCT24, ...OCT25], HOLES);
    const selection = await corrected({});
    expect(selection).toMatchObject({ mode: "incremental", seasonId: 20262027, requestedGameType: 2,
      startDate: "2026-10-24", latestCoveredDate: "2026-10-25", endDate: "2026-10-25" });
    expect(selection.gameIds).toEqual([...HOLES, ...OCT25.map(g => g.id)]);
  });

  it("includes each hole exactly once and excludes the covered games between the holes and the watermark", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    install([...OCT24, ...OCT25], HOLES);
    const { gameIds } = await corrected({});
    for (const hole of HOLES) expect(countOf(gameIds, hole)).toBe(1);
    expect(new Set(gameIds).size).toBe(gameIds.length);
    for (const covered of OCT24.map(g => g.id).filter(gid => !HOLES.includes(gid))) expect(gameIds).not.toContain(covered);
  });

  it("an uncovered game on the watermark date itself is selected once (by the watermark rule)", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    install([...OCT24, ...OCT25], [id(183)]);
    const selection = await corrected({});
    expect(selection.startDate).toBe("2026-10-25");
    expect(countOf(selection.gameIds, id(183))).toBe(1);
    expect(selection.gameIds).toEqual(OCT25.map(g => g.id));
  });

  it("bound boundary: a hole dated exactly latest-finished-date minus 7 days is selected", async () => {
    vi.setSystemTime(new Date("2026-11-02T16:00:00Z"));
    install([...slate("2026-10-25", [190]), ...slate("2026-10-28", [200]), ...slate("2026-11-01", [210, 211])], [id(190)]);
    const selection = await corrected({});
    expect(selection).toMatchObject({ startDate: "2026-10-25", latestCoveredDate: "2026-11-01", endDate: "2026-11-01" });
    expect(selection.gameIds).toEqual([id(190), id(210), id(211)]);
  });

  it("outside the bound: a hole dated latest-finished-date minus 8 days is not selected", async () => {
    vi.setSystemTime(new Date("2026-11-02T16:00:00Z"));
    install([...slate("2026-10-24", [190]), ...slate("2026-10-28", [200]), ...slate("2026-11-01", [210, 211])], [id(190)]);
    const selection = await corrected({});
    expect(selection).toMatchObject({ startDate: "2026-11-01", latestCoveredDate: "2026-11-01" });
    expect(selection.gameIds).toEqual([id(210), id(211)]);
  });

  it("the bound follows the latest finished eligible game, not the wall clock", async () => {
    vi.setSystemTime(new Date("2026-11-20T16:00:00Z")); // 19 days after the last finished game
    install([...slate("2026-10-25", [190]), ...slate("2026-11-01", [210])], [id(190)]);
    const selection = await corrected({});
    expect(selection.endDate).toBe("2026-11-01");
    expect(selection.gameIds).toEqual([id(190), id(210)]);
  });

  it("a game that has not finished does not move the bound", async () => {
    vi.setSystemTime(new Date("2026-11-02T03:00:00Z")); // Nov 1 game started 4 h ago: not finished (8 h rule)
    install([...slate("2026-10-24", [190]), ...slate("2026-10-31", [205]), ...slate("2026-11-01", [210])], [id(190)]);
    const selection = await corrected({});
    expect(selection.endDate).toBe("2026-10-31");
    expect(selection.gameIds).toEqual([id(190), id(205)]);
    expect(selection.startDate).toBe("2026-10-24");
  });
});

describe("C3b controls: the correction changes nothing else", () => {
  it.each([
    ["no holes", () => install([...OCT24, ...OCT25], [])],
    ["no covered game (no watermark)", () => install([...OCT24, ...OCT25], [...OCT24, ...OCT25].map(g => g.id))],
    ["no finished games", () => install([], [])],
  ])("%s: corrected selection equals canonical selection", async (_label, setup) => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    setup();
    const [before, after] = [await canonical({}), await corrected({})];
    expect(after).toEqual(before);
  });

  it("no-watermark control does not gain the hole bound: every finished game is still selected", async () => {
    vi.setSystemTime(new Date("2026-11-20T16:00:00Z"));
    const games = [...slate("2026-10-01", [100]), ...slate("2026-11-01", [210])];
    install(games, games.map(g => g.id));
    const selection = await corrected({});
    expect(selection).toMatchObject({ startDate: "2026-10-01", latestCoveredDate: null });
    expect(selection.gameIds).toEqual([id(100), id(210)]);
  });

  it("empty control returns the canonical empty shape", async () => {
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    install([], []);
    expect(await corrected({})).toEqual({ mode: "incremental", seasonId: 20262027, requestedGameType: 2,
      startDate: null, endDate: null, latestCoveredDate: null, gameIds: [] });
  });
});

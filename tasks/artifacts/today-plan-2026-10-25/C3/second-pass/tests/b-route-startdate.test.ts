// C3b second pass: the corrected startDate is what the route reports for incremental runs.
// Offline only: the route's selector is the corrected copy; ingest, summaries, season lookup and Supabase are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ingestBestEffort: vi.fn(),
  refreshPlayerSummaries: vi.fn(),
  refreshTeamSummaries: vi.fn(),
  getCurrentSeason: vi.fn(),
  summaryGameIds: vi.fn(),
  gamesRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/supabase/Upserts/nhlRawGamecenterRoute", () => ({ resolveRequestedGameIds: vi.fn() }));
vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({ ingestNhlApiRawGamesBestEffort: mocks.ingestBestEffort }));
vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", async (importOriginal) => ({
  ...await importOriginal<typeof import("lib/underlying-stats/playerStatsSummaryRefresh")>(),
  refreshPlayerUnderlyingSummarySnapshotsForGameIds: mocks.refreshPlayerSummaries,
  fetchSeasonSummaryGameIdSet: mocks.summaryGameIds,
}));
vi.mock("lib/underlying-stats/teamStatsSummaryRefresh", () => ({ refreshTeamUnderlyingSummaryRowsForGameIds: mocks.refreshTeamSummaries }));
vi.mock("lib/underlying-stats/playerStatsRefreshWindow", () => import("../patched/playerStatsRefreshWindow"));
vi.mock("lib/NHL/server", () => ({ getCurrentSeason: mocks.getCurrentSeason }));
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

import handler from "pages/api/v1/db/update-player-underlying-stats";

const id = (n: number) => 2026020000 + n;
const game = (n: number, date: string) => ({ id: id(n), date, startTime: `${date}T23:00:00Z`, seasonId: 20262027, type: 2 });

describe("C3b route: incremental response carries the corrected interval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T16:00:00Z"));
    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20262027 });
    const games = [game(171, "2026-10-24"), game(175, "2026-10-24"), game(179, "2026-10-24"), game(180, "2026-10-25"), game(181, "2026-10-25")];
    mocks.gamesRows = [...games].reverse();
    mocks.summaryGameIds.mockResolvedValue(new Set([id(175), id(180), id(181)]));
    mocks.ingestBestEffort.mockImplementation(async (_db: unknown, gameIds: number[]) => ({
      results: gameIds.map(gameId => ({ gameId, rosterCount: 40, eventCount: 300, shiftCount: 800, rawEndpointsStored: 4, idempotent: false })),
      failures: [],
    }));
    mocks.refreshPlayerSummaries.mockResolvedValue({ rowsUpserted: 10, summaryWriteBusyRetries: 0 });
    mocks.refreshTeamSummaries.mockResolvedValue({ rowsUpserted: 2 });
  });
  afterEach(() => vi.useRealTimers());

  it("reports startDate as the earliest reselected hole and ingests each selected game once", async () => {
    const res: any = { statusCode: 200, body: null, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
    await handler({ method: "POST", query: { incremental: "true" }, headers: {} } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ mode: "incremental", startDate: "2026-10-24", endDate: "2026-10-25", latestCoveredDate: "2026-10-25",
      gameIds: [id(171), id(179), id(180), id(181)], requestedGameCount: 4 });
    expect(mocks.ingestBestEffort).toHaveBeenCalledTimes(1);
    expect(mocks.ingestBestEffort.mock.calls[0][1]).toEqual([id(171), id(179), id(180), id(181)]);
  });
});

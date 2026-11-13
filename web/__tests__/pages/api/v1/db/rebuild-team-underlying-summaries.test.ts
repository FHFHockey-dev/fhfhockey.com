import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchGameIdsMock, refreshMock } = vi.hoisted(() => ({
  fetchGameIdsMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("lib/cron/withOperationalRouteAuth", () => ({
  operationalRouteContracts: { rebuildTeamUnderlyingSummaries: {} },
  withOperationalRouteAuth: (handler: any) => handler,
}));
vi.mock("lib/supabase/server", () => ({ default: { from: vi.fn() } }));
vi.mock("lib/underlying-stats/teamStatsSummaryRefresh", () => ({
  fetchTeamSummaryRebuildGameIds: fetchGameIdsMock,
  refreshTeamUnderlyingSummaryRowsForGameIds: refreshMock,
}));

import handler from "../../../../../pages/api/v1/db/rebuild-team-underlying-summaries";

function call(query: Record<string, string>) {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return Promise.resolve(handler({ method: "POST", query, headers: {} } as any, res)).then(() => res);
}

describe("/api/v1/db/rebuild-team-underlying-summaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchGameIdsMock.mockResolvedValue([2025020001, 2025020002]);
    refreshMock.mockResolvedValue({
      rowsUpserted: 0,
      rowsGenerated: 280,
      gameIdsProcessed: [2025020001, 2025020002],
      staleKeys: [{ game_id: 2025020001, team_id: 1, strength: "threeOnThree", score_state: "tied" }],
    });
  });

  it("dry-runs by default and reports stale keys without writing", async () => {
    const res = await call({ seasonId: "20252026", startDate: "2025-10-07", endDate: "2025-10-13" });

    expect(res.statusCode).toBe(200);
    expect(refreshMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameIds: [2025020001, 2025020002], dryRun: true, reportStaleKeys: true })
    );
    expect(res.body).toMatchObject({ dryRun: true, rowsGenerated: 280, rowsUpserted: 0, staleKeyCount: 1 });
  });

  it("writes only when dryRun=false is explicit", async () => {
    await call({ seasonId: "20252026", startDate: "2025-10-07", endDate: "2025-10-13", dryRun: "false" });
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
  });

  it.each([
    [{ seasonId: "20252026", startDate: "2025-10-01", endDate: "2025-10-31" }, "at most 14 days"],
    [{ seasonId: "20252026", startDate: "2025-10-13", endDate: "2025-10-07" }, "on or after"],
    [{ startDate: "2025-10-07", endDate: "2025-10-13" }, "seasonId"],
  ])("rejects an unbounded or invalid window %#", async (query, message) => {
    const res = await call(query as Record<string, string>);
    expect(res.statusCode).toBe(400);
    expect(String(res.body.error)).toContain(message);
    expect(fetchGameIdsMock).not.toHaveBeenCalled();
  });

  it("diffs exactly the requested final games, read-only (penalty-shot refresh, decision 149)", async () => {
    fetchGameIdsMock.mockResolvedValue([2026020065, 2026020094]);
    refreshMock.mockResolvedValue({
      rowsUpserted: 0,
      rowsGenerated: 280,
      gameIdsProcessed: [2026020065, 2026020094],
      staleKeys: [],
      diffs: [
        {
          game_id: 2026020065,
          team_id: 54,
          strength: "allStrengths",
          score_state: "allScores",
          changes: { sf: { stored: 42, rebuilt: 43 }, gf: { stored: 2, rebuilt: 3 } },
        },
      ],
    });
    const res = await call({ seasonId: "20262027", gameIds: "2026020065,2026020094", diff: "true" });
    expect(res.statusCode).toBe(200);
    expect(fetchGameIdsMock).toHaveBeenCalledWith(
      expect.objectContaining({ seasonId: 20262027, gameIds: [2026020065, 2026020094] })
    );
    expect(refreshMock).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, reportDiffs: true, gameIds: [2026020065, 2026020094] })
    );
    expect(res.body).toMatchObject({ dryRun: true, rowsUpserted: 0, diffRowCount: 1, diffsTruncated: false });
  });

  it.each([
    [{ seasonId: "20262027", gameIds: "2026020065", diff: "true", dryRun: "false" }, "read-only"],
    [{ seasonId: "20262027", gameIds: "1,2,3,4,5,6,7,8,9,10,11" }, "1-10 distinct"],
    [{ seasonId: "20262027", gameIds: "2026020065,2026020065" }, "1-10 distinct"],
    [{ seasonId: "20262027", gameIds: "2026020065", startDate: "2026-10-08", endDate: "2026-10-08" }, "not both"],
  ])("rejects an invalid gameIds request %#", async (query, message) => {
    const res = await call(query as Record<string, string>);
    expect(res.statusCode).toBe(400);
    expect(String(res.body.error)).toContain(message);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses a requested game that is not a final game of the season", async () => {
    fetchGameIdsMock.mockResolvedValue([2026020065]);
    const res = await call({ seasonId: "20262027", gameIds: "2026020065,2026029999" });
    expect(res.statusCode).toBe(400);
    expect(String(res.body.error)).toContain("2026029999");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refuses a window that selects too many games", async () => {
    fetchGameIdsMock.mockResolvedValue(Array.from({ length: 121 }, (_, index) => index + 1));
    const res = await call({ seasonId: "20252026", startDate: "2025-10-07", endDate: "2025-10-13" });
    expect(res.statusCode).toBe(400);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

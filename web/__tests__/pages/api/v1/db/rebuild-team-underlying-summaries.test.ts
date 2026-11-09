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

  it("refuses a window that selects too many games", async () => {
    fetchGameIdsMock.mockResolvedValue(Array.from({ length: 121 }, (_, index) => index + 1));
    const res = await call({ seasonId: "20252026", startDate: "2025-10-07", endDate: "2025-10-13" });
    expect(res.statusCode).toBe(400);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildMatrixMock, resolveTeamTokenMock } = vi.hoisted(() => ({
  buildMatrixMock: vi.fn(),
  resolveTeamTokenMock: vi.fn(),
}));

vi.mock("../../../../lib/rankings/teamTokenResolver", () => ({
  resolveTeamToken: resolveTeamTokenMock,
}));

vi.mock("../../../../lib/rankings/playerMatrix", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../lib/rankings/playerMatrix")>();
  return {
    ...actual,
    buildPlayerMatrixSurface: buildMatrixMock,
  };
});

import handler from "../../../../pages/api/v1/contextual-rankings/matrix";
import snapshotHandler from "../../../../pages/api/v1/contextual-rankings/snapshot";
import comparisonHandler from "../../../../pages/api/v1/contextual-rankings/comparison";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("/api/v1/contextual-rankings/matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveTeamTokenMock.mockReset().mockResolvedValue(null);
    buildMatrixMock.mockImplementation(async (request) => ({
      success: true,
      request,
      rows: [],
      selectedPlayerId: null,
      meta: {
        generatedAt: "2026-06-07T12:00:00.000Z",
        rowCount: 0,
        totalRankedRows: 0,
        page: request.page,
        pageSize: request.pageSize,
        pageCount: 1,
        sortMetric: request.sortMetric,
        sortDirection: request.sortDirection,
        metricGroups: [],
        metricColumns: [],
        plannedMetrics: [],
        unavailableMetrics: [],
        colorScaleBands: [],
        activePeerGroupDescription: "all skaters",
        snapshotDate: null,
        latestAvailableSnapshotDate: null,
        snapshotUpdatedAt: null,
        snapshotSelectionReason: null,
        sourceTable: "rolling_player_game_metrics",
        message: null,
      },
    }));
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(buildMatrixMock).not.toHaveBeenCalled();
  });

  it("normalizes matrix filters and passes them to the surface builder", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        position: "F",
        deployment: "L2",
        strength: "5v5",
        window: "last20",
        sort_metric: "xga_per_60",
        sort_direction: "asc",
        sample_confidence: "medium_plus",
        ranking_source: "entity_metric_rankings",
        page: "2",
        page_size: "25",
        selected_player: "8478402",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildMatrixMock).toHaveBeenCalledWith(
      expect.objectContaining({
        season: 20252026,
        position: "F",
        deployment: "L2",
        strength: "5v5",
        window: "last20",
        sortMetric: "xga_per_60",
        sortDirection: "asc",
        sampleConfidence: "medium_plus",
        rankingSourcePreference: "entity_metric_rankings",
        page: 2,
        pageSize: 25,
        selectedPlayerId: 8478402,
        peerGroupType: "deployment",
      }),
    );
    expect(res.body?.success).toBe(true);
  });

  it("accepts the larger true-5v5 smoke shape with the max supported page size", async () => {
    buildMatrixMock.mockImplementationOnce(async (request) => ({
      success: true,
      request,
      rows: Array.from({ length: 50 }, (_, index) => ({
        entity: { id: index + 1 },
      })),
      selectedPlayerId: null,
      meta: {
        generatedAt: "2026-06-08T12:00:00.000Z",
        rowCount: 50,
        totalRankedRows: 216,
        page: request.page,
        pageSize: request.pageSize,
        pageCount: 5,
        sortMetric: request.sortMetric,
        sortDirection: request.sortDirection,
        metricGroups: [],
        metricColumns: [],
        plannedMetrics: [],
        unavailableMetrics: [],
        colorScaleBands: [],
        activePeerGroupDescription: "all skaters",
        snapshotDate: "2026-04-16",
        latestAvailableSnapshotDate: "2026-04-16",
        snapshotUpdatedAt: "2026-06-08T12:00:00.000Z",
        snapshotSelectionReason: "latest_available",
        sourceTable: "rolling_player_game_metrics",
        message: null,
      },
    }));
    const req: any = {
      method: "GET",
      query: {
        entity: "skaters",
        season: "20252026",
        window: "season",
        position: "all",
        deployment: "all",
        strength: "5v5",
        min_gp: "1",
        min_toi: "300",
        sort_metric: "points_per_60",
        sort_direction: "desc",
        page: "1",
        page_size: "50",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildMatrixMock).toHaveBeenCalledWith(
      expect.objectContaining({
        strength: "5v5",
        sortMetric: "points_per_60",
        sortDirection: "desc",
        page: 1,
        pageSize: 50,
      }),
    );
    expect(res.body?.meta).toMatchObject({
      rowCount: 50,
      totalRankedRows: 216,
      pageCount: 5,
      snapshotDate: "2026-04-16",
    });
  });

  it("resolves team abbreviations before building the matrix", async () => {
    resolveTeamTokenMock.mockResolvedValueOnce({
      input: "BOS",
      teamId: 6,
      abbreviation: "BOS",
      name: "Boston Bruins",
      matchedBy: "abbreviation",
    });
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        team: "BOS",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(resolveTeamTokenMock).toHaveBeenCalledWith("BOS");
    expect(buildMatrixMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 6,
        peerGroupType: "team",
      }),
    );
  });

  it("returns a clear validation message for unknown text teams", async () => {
    resolveTeamTokenMock.mockResolvedValueOnce(null);
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        team: "BOSX",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe("No team matched BOSX");
    expect(res.body?.details).toMatchObject({
      team: "must be a numeric id, team abbreviation, or team name",
    });
    expect(buildMatrixMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid query params before building the matrix", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        page_size: "500",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/page_size/);
    expect(buildMatrixMock).not.toHaveBeenCalled();
  });

  describe.each([
    { label: "snapshot", routeHandler: snapshotHandler, selection: { player_id: "97" }, version: "contextual_ranking_snapshot_v1" },
    { label: "comparison", routeHandler: comparisonHandler, selection: { player_ids: "97" }, version: "contextual_ranking_comparison_v1" },
  ])("$label team-filter parity with Matrix", ({ label, routeHandler, selection, version }) => {
    it.each([
      { team: "EDM", matchedBy: "abbreviation" },
      { team: " eDm ", matchedBy: "abbreviation" },
      { team: "Edmonton Oilers", matchedBy: "name" },
      { team: "22", matchedBy: "id" },
    ])("resolves $team before building the skater surface", async ({ team, matchedBy }) => {
      resolveTeamTokenMock.mockResolvedValueOnce({
        input: team.trim(),
        teamId: 22,
        abbreviation: "EDM",
        name: "Edmonton Oilers",
        matchedBy,
      });
      const req: any = {
        method: "GET",
        query: {
          entity: "skaters",
          season: "20262027",
          window: "last10",
          as_of_date: "2026-11-07",
          position: "F",
          deployment: "L2",
          strength: "5v5",
          min_gp: "5",
          min_toi: "1800",
          sort_metric: "points_per_60",
          sort_direction: "asc",
          sample_confidence: "medium_plus",
          search: "Connor",
          page: "9",
          page_size: "10",
          team,
          ...selection,
        },
      };
      const res = createMockRes();

      await routeHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        version,
        status: "unavailable",
        request: { entity: "skaters", season: 20262027, window: "last10" },
      });
      expect(resolveTeamTokenMock).toHaveBeenCalledWith(team.trim());
      expect(buildMatrixMock).toHaveBeenCalledOnce();
      expect(buildMatrixMock).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: "skaters",
          season: 20262027,
          window: "last10",
          asOfDate: "2026-11-07",
          position: "F",
          deployment: "L2",
          strength: "5v5",
          minGp: 5,
          minToiSeconds: 1800,
          sortMetric: "points_per_60",
          sortDirection: "asc",
          sampleConfidence: "medium_plus",
          search: "Connor",
          teamId: 22,
          peerGroupType: "team",
          page: 1,
          pageSize: 50,
        }),
      );
    });

    it.each([undefined, ""])("preserves an unfiltered request for team=%s", async (team) => {
      const req: any = {
        method: "GET",
        query: { entity: "skaters", season: "20262027", team, ...selection },
      };
      const res = createMockRes();

      await routeHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(buildMatrixMock).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: null, peerGroupType: "all_skaters" }),
      );
    });

    it.each(["EDMX", "   "])("preserves Matrix's validation contract for team=%s", async (team) => {
      const req: any = {
        method: "GET",
        query: { entity: "skaters", season: "20262027", team, ...selection },
      };
      const matrixRes = createMockRes();
      const res = createMockRes();

      await handler(req, matrixRes);
      await routeHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual(matrixRes.body);
      expect(buildMatrixMock).not.toHaveBeenCalled();
    });

    it("keeps team lookup failures inside the existing internal-error contract", async () => {
      resolveTeamTokenMock.mockRejectedValueOnce(new Error("private team lookup details"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const req: any = {
        method: "GET",
        query: { entity: "skaters", season: "20262027", team: "EDM", ...selection },
      };
      const res = createMockRes();

      try {
        await routeHandler(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({
          success: false,
          message: `Failed to build contextual ranking ${label}.`,
          error: "CONTEXTUAL_RANKINGS_UNAVAILABLE",
        });
        expect(JSON.stringify(res.body)).not.toContain("private");
        expect(buildMatrixMock).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    });
  });
});

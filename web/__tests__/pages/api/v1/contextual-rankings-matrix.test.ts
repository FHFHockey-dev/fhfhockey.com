import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildMatrixMock } = vi.hoisted(() => ({
  buildMatrixMock: vi.fn(),
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
});

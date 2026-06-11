import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildTrendingSurfaceMock,
  parseTrendingRequestMock,
} = vi.hoisted(() => ({
  buildTrendingSurfaceMock: vi.fn(),
  parseTrendingRequestMock: vi.fn(),
}));

vi.mock("../../../../lib/rankings/trending", () => ({
  buildTrendingSurface: buildTrendingSurfaceMock,
  parseTrendingRequest: parseTrendingRequestMock,
}));

import handler from "../../../../pages/api/v1/contextual-rankings/trending";

function mockResponse() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader: vi.fn((key: string, value: string) => {
      res.headers[key] = value;
    }),
    status: vi.fn((statusCode: number) => {
      res.statusCode = statusCode;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

describe("/api/v1/contextual-rankings/trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseTrendingRequestMock.mockReturnValue({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      position: "all",
      deployment: "all",
      strength: "5v5",
      minGp: 1,
      minToiSeconds: 300,
      teamId: null,
      peerGroupType: "all_skaters",
      metricKeys: ["points_per_60"],
      sortDirection: "desc",
      limit: 25,
    });
    buildTrendingSurfaceMock.mockResolvedValue({
      success: true,
      rows: [],
      meta: {
        generatedAt: "2026-06-08T00:00:00.000Z",
        rowCount: 0,
        sourceTable: "rolling_player_game_metrics",
        metricKeys: ["points_per_60"],
        windows: ["season", "last20", "last10", "last5"],
        snapshotDates: {},
        latestAvailableSnapshotDate: null,
        message: null,
      },
    });
  });

  it("returns trending rows for GET requests", async () => {
    const res = mockResponse();
    await handler(
      {
        method: "GET",
        query: {
          entity: "skaters",
          season: "20252026",
        },
      } as any,
      res as any,
    );

    expect(parseTrendingRequestMock).toHaveBeenCalledWith({
      entity: "skaters",
      season: "20252026",
    });
    expect(buildTrendingSurfaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ season: 20252026 }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("rejects unsupported methods", async () => {
    const res = mockResponse();
    await handler({ method: "POST", query: {} } as any, res as any);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(res.body).toMatchObject({
      success: false,
      error: "Method not allowed",
    });
  });
});

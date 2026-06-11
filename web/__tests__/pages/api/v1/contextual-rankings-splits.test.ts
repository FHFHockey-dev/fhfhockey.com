import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildRankingsSplitsSurfaceMock,
  parseRankingsSplitsRequestMock,
} = vi.hoisted(() => ({
  buildRankingsSplitsSurfaceMock: vi.fn(),
  parseRankingsSplitsRequestMock: vi.fn(),
}));

vi.mock("../../../../lib/rankings/splits", () => ({
  buildRankingsSplitsSurface: buildRankingsSplitsSurfaceMock,
  parseRankingsSplitsRequest: parseRankingsSplitsRequestMock,
}));

import handler from "../../../../pages/api/v1/contextual-rankings/splits";

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

describe("/api/v1/contextual-rankings/splits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseRankingsSplitsRequestMock.mockReturnValue({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "season",
      position: "all",
      deployment: "all",
      strength: "5v5",
      metric: "points_per_60",
      minGp: 1,
      minToiSeconds: 300,
      teamId: null,
      peerGroupType: "all_skaters",
      limit: 25,
    });
    buildRankingsSplitsSurfaceMock.mockResolvedValue({
      success: true,
      rows: [],
      sections: [],
      meta: {
        generatedAt: "2026-06-08T00:00:00.000Z",
        rowCount: 0,
        sourceTable: "rolling_player_game_metrics",
        metric: { key: "points_per_60", displayName: "Points/60" },
        baseSnapshotDate: null,
        latestAvailableSnapshotDate: null,
        unsupportedSplits: [],
        message: null,
      },
    });
  });

  it("returns ranking splits for GET requests", async () => {
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

    expect(parseRankingsSplitsRequestMock).toHaveBeenCalledWith({
      entity: "skaters",
      season: "20252026",
    });
    expect(buildRankingsSplitsSurfaceMock).toHaveBeenCalledWith(
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

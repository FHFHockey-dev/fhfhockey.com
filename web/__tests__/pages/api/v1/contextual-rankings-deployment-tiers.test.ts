import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildDeploymentTiersSurfaceMock,
  parseDeploymentTiersRequestMock,
} = vi.hoisted(() => ({
  buildDeploymentTiersSurfaceMock: vi.fn(),
  parseDeploymentTiersRequestMock: vi.fn(),
}));

vi.mock("../../../../lib/rankings/deploymentTiers", () => ({
  buildDeploymentTiersSurface: buildDeploymentTiersSurfaceMock,
  parseDeploymentTiersRequest: parseDeploymentTiersRequestMock,
}));

import handler from "../../../../pages/api/v1/contextual-rankings/deployment-tiers";

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

describe("/api/v1/contextual-rankings/deployment-tiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseDeploymentTiersRequestMock.mockReturnValue({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "season",
      position: "all",
      strength: "5v5",
      minGp: 1,
      minToiSeconds: 300,
      teamId: null,
      metricKeys: ["points_per_60"],
    });
    buildDeploymentTiersSurfaceMock.mockResolvedValue({
      success: true,
      sections: [],
      meta: {
        generatedAt: "2026-06-08T00:00:00.000Z",
        snapshotDates: [],
        latestAvailableSnapshotDate: null,
        sourceTable: "rolling_player_game_metrics",
        metricKeys: ["points_per_60"],
        message: null,
      },
    });
  });

  it("returns deployment tier summaries for GET requests", async () => {
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

    expect(parseDeploymentTiersRequestMock).toHaveBeenCalledWith({
      entity: "skaters",
      season: "20252026",
    });
    expect(buildDeploymentTiersSurfaceMock).toHaveBeenCalledWith(
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

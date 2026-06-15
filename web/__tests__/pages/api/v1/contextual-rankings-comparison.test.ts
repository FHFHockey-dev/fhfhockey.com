import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildComparisonSurfaceMock } = vi.hoisted(() => ({
  buildComparisonSurfaceMock: vi.fn(),
}));

vi.mock("../../../../lib/rankings/comparison", () => ({
  buildContextualRankingComparisonSurface: buildComparisonSurfaceMock,
}));

import handler from "../../../../pages/api/v1/contextual-rankings/comparison";

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

describe("/api/v1/contextual-rankings/comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(buildComparisonSurfaceMock).not.toHaveBeenCalled();
  });

  it("returns the comparison payload from the builder", async () => {
    buildComparisonSurfaceMock.mockResolvedValue({
      success: true,
      version: "contextual_ranking_comparison_v1",
      status: "partial",
      request: {
        entity: "teams",
        season: 20252026,
        window: null,
        metric: "off_rating",
        subjectCount: 2,
      },
      source: {
        endpoint: "/api/v1/contextual-rankings/teams",
        sourceTables: ["team_power_ratings_daily"],
        snapshotDate: "2026-06-13",
        latestAvailableSnapshotDate: "2026-06-13",
        generatedAt: "2026-06-13T12:00:00.000Z",
      },
      metricColumns: [],
      subjects: [
        { key: "DAL", label: "Dallas Stars", status: "available", row: {}, reason: null, caveats: [] },
        { key: "MIN", label: "MIN", status: "unavailable", row: null, reason: "Missing", caveats: [] },
      ],
      caveats: [],
    });
    const req: any = {
      method: "GET",
      query: { entity: "teams", teams: "DAL,MIN", season: "20252026" },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      version: "contextual_ranking_comparison_v1",
      status: "partial",
      request: {
        entity: "teams",
        subjectCount: 2,
      },
    });
    expect(buildComparisonSurfaceMock).toHaveBeenCalledWith(req.query);
  });
});

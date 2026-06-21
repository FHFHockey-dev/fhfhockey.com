import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildSurfaceMock, resolveTeamTokenMock } = vi.hoisted(() => ({
  buildSurfaceMock: vi.fn(),
  resolveTeamTokenMock: vi.fn(),
}));

vi.mock("../../../../lib/rankings/teamTokenResolver", () => ({
  resolveTeamToken: resolveTeamTokenMock,
}));

vi.mock("../../../../lib/rankings/rankingQueries", () => ({
  buildSnapshotFirstContextualRankingsSurface: buildSurfaceMock,
}));

import handler from "../../../../pages/api/v1/contextual-rankings";

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

describe("/api/v1/contextual-rankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveTeamTokenMock.mockResolvedValue(null);
    buildSurfaceMock.mockImplementation(async (request) => ({
      success: true,
      request,
      rankings: [],
      meta: {
        generatedAt: "2026-06-05T12:00:00.000Z",
        snapshotDate: "2026-04-16",
        snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
        latestAvailableSnapshotDate: "2026-04-16",
        snapshotSelectionReason: "latest_available",
        sourceTable: "rolling_player_game_metrics",
        metric: {
          key: request.metric,
          displayName: "Goals/60",
          availabilityStatus: "available",
          higherIsBetter: true,
          description: "Goals scored per 60 minutes in the selected window.",
          formulaDescription: "goals / TOI seconds * 3600",
          applicableStrengthStates: ["all", "ev", "pp", "pk"],
          denominatorKey: "toi_seconds",
          denominatorDescription: "Time on ice in seconds.",
          sampleRequirements: {
            minimumGp: 3,
            minimumToiSeconds: 600,
            windowSource: "rolling_player_game_metrics",
          },
          methodologyVersion: "contextual_rankings_v1",
          methodologyUpdatedAt: "2026-06-06",
          sourceQualityFlags: [],
        },
        unavailable: false,
        rowCount: 0,
        limit: request.limit,
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
    expect(buildSurfaceMock).not.toHaveBeenCalled();
  });

  it("validates params and passes the normalized request to the surface builder", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        window: "last10",
        position: "D",
        metric: "ixg_per_60",
        limit: "25",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildSurfaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        season: 20252026,
        window: "last10",
        position: "D",
        metric: "ixg_per_60",
        peerGroupType: "position",
        limit: 25,
      }),
    );
    expect(res.body?.success).toBe(true);
  });

  it("resolves team names before building Metric Explorer rankings", async () => {
    resolveTeamTokenMock.mockResolvedValueOnce({
      input: "Boston Bruins",
      teamId: 6,
      abbreviation: "BOS",
      name: "Boston Bruins",
      matchedBy: "name",
    });
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        metric: "goals_per_60",
        team: "Boston Bruins",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(resolveTeamTokenMock).toHaveBeenCalledWith("Boston Bruins");
    expect(buildSurfaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 6,
        peerGroupType: "team",
      }),
    );
  });

  it("returns 400 for invalid query params before querying Supabase", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        strength: "bad_strength",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/strength/);
    expect(buildSurfaceMock).not.toHaveBeenCalled();
  });

  it("passes unavailable metric requests through for unavailable metadata responses", async () => {
    buildSurfaceMock.mockImplementationOnce(async (request) => ({
      success: true,
      request,
      rankings: [],
      meta: {
        generatedAt: "2026-06-05T12:00:00.000Z",
        snapshotDate: null,
        snapshotUpdatedAt: null,
        latestAvailableSnapshotDate: null,
        snapshotSelectionReason: "metric_unavailable",
        sourceTable: "rolling_player_game_metrics",
        metric: {
          key: "xga_per_60",
          displayName: "xGA/60",
          availabilityStatus: "planned",
          higherIsBetter: false,
          description: "On-ice expected goals against per 60 minutes.",
          formulaDescription: "Pending source refresh.",
          applicableStrengthStates: ["ev"],
          denominatorKey: null,
          denominatorDescription: null,
          sampleRequirements: null,
          methodologyVersion: "contextual_rankings_v1",
          methodologyUpdatedAt: "2026-06-06",
          sourceQualityFlags: [],
        },
        unavailable: true,
        rowCount: 0,
        limit: request.limit,
        message: "Requested metric is not available from current verified data.",
      },
    }));
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        metric: "xga_per_60",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.meta.unavailable).toBe(true);
    expect(res.body?.rankings).toEqual([]);
  });
});

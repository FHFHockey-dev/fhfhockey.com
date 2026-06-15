import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildSnapshotSurfaceMock } = vi.hoisted(() => ({
  buildSnapshotSurfaceMock: vi.fn(),
}));

vi.mock("../../../../lib/rankings/snapshot", () => ({
  buildContextualRankingSnapshotSurface: buildSnapshotSurfaceMock,
}));

import handler from "../../../../pages/api/v1/contextual-rankings/snapshot";

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

describe("/api/v1/contextual-rankings/snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(buildSnapshotSurfaceMock).not.toHaveBeenCalled();
  });

  it("returns the selected snapshot payload from the builder", async () => {
    buildSnapshotSurfaceMock.mockResolvedValue({
      success: true,
      version: "contextual_ranking_snapshot_v1",
      status: "available",
      request: {
        entity: "teams",
        season: 20252026,
        window: null,
        selectedPlayerId: null,
        selectedGoalieId: null,
        selectedTeam: "DAL",
      },
      row: { team: { abbreviation: "DAL" } },
      source: {
        endpoint: "/api/v1/contextual-rankings/teams",
        sourceTables: ["team_power_ratings_daily"],
        snapshotDate: "2026-06-12",
        latestAvailableSnapshotDate: "2026-06-12",
        generatedAt: "2026-06-13T12:00:00.000Z",
      },
      caveats: [],
    });
    const req: any = {
      method: "GET",
      query: { entity: "teams", selected_team: "DAL", season: "20252026" },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      status: "available",
      row: { team: { abbreviation: "DAL" } },
    });
    expect(buildSnapshotSurfaceMock).toHaveBeenCalledWith(req.query);
  });
});

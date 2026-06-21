import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildRowsMock, upsertRowsMock, fakeSupabase } = vi.hoisted(() => ({
  buildRowsMock: vi.fn(),
  upsertRowsMock: vi.fn(),
  fakeSupabase: { from: vi.fn() },
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("../../../../../utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => (req: any, res: any) =>
    handler({ ...req, supabase: fakeSupabase }, res),
}));

vi.mock("../../../../../lib/rankings/entityMetricRankingWriter", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../../../lib/rankings/entityMetricRankingWriter")
    >();
  return {
    ...actual,
    buildEntityMetricRankingRows: buildRowsMock,
    upsertEntityMetricRankingRows: upsertRowsMock,
  };
});

import handler from "../../../../../pages/api/v1/db/update-entity-metric-rankings";

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

describe("/api/v1/db/update-entity-metric-rankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildRowsMock.mockResolvedValue({
      request: {},
      rows: [{ entity_id: 1 }, { entity_id: 2 }],
      contexts: [
        {
          window: "last5",
          snapshotDate: "2026-04-16",
          snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
          latestAvailableSnapshotDate: "2026-04-16",
          generatedRows: 2,
        },
      ],
      sourceFreshness: [],
      unavailableMetrics: [],
    });
    upsertRowsMock.mockResolvedValue(2);
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = { method: "DELETE", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, POST");
    expect(buildRowsMock).not.toHaveBeenCalled();
  });

  it("defaults to dry run and four 5v5 skater matrix windows", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        as_of_date: "2026-04-16",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        season: 20252026,
        asOfDate: "2026-04-16",
        windows: ["season", "last5", "last10", "last20"],
        position: "all",
        deployment: "all",
        strength: "5v5",
        minGp: 1,
        minToiSeconds: 300,
        teamId: null,
        peerGroupType: "all_skaters",
      }),
    );
    expect(buildRowsMock.mock.calls[0]?.[0].metricKeys).toContain("points_per_60");
    expect(buildRowsMock.mock.calls[0]?.[0].metricKeys).not.toContain("mcm_score");
    expect(upsertRowsMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      dryRun: true,
      generatedRows: 2,
      rowsUpserted: 0,
    });
  });

  it("parses explicit windows and metrics and upserts when dryRun is false", async () => {
    const req: any = {
      method: "POST",
      query: {
        season: "20252026",
        dryRun: "false",
        windows: "last5,last10",
        metrics: "points_per_60,xga_per_60",
        position: "F",
        deployment: "L2",
        strength: "5v5",
        upsertChunkSize: "25",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(buildRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windows: ["last5", "last10"],
        metricKeys: ["points_per_60", "xga_per_60"],
        position: "F",
        deployment: "L2",
        peerGroupType: "deployment",
      }),
    );
    expect(upsertRowsMock).toHaveBeenCalledWith(
      fakeSupabase,
      [{ entity_id: 1 }, { entity_id: 2 }],
      { chunkSize: 25 },
    );
    expect(res.body).toMatchObject({
      dryRun: false,
      upsertChunkSize: 25,
      rowsUpserted: 2,
    });
  });

  it("rejects composite-only metrics rather than inventing snapshot rows", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        metrics: "offense_rating",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/verified rolling ranking snapshot/);
    expect(buildRowsMock).not.toHaveBeenCalled();
  });
});

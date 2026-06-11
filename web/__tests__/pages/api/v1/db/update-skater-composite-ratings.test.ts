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

vi.mock("../../../../../lib/rankings/skaterCompositeWriter", () => ({
  buildSkaterCompositeRatingRows: buildRowsMock,
  upsertSkaterCompositeRatingRows: upsertRowsMock,
}));

import handler from "../../../../../pages/api/v1/db/update-skater-composite-ratings";

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

describe("/api/v1/db/update-skater-composite-ratings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildRowsMock.mockResolvedValue({
      request: {},
      rows: [{ player_id: 1 }, { player_id: 2 }],
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
      sourceMetrics: ["points_per_60"],
      sourceFreshness: [
        {
          metricKey: "points_per_60",
          snapshotDate: "2026-03-01",
          snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
          unavailable: false,
          reason: null,
        },
      ],
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

  it("defaults to dry run and passes normalized filters to the writer", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        as_of_date: "2026-03-01",
        window: "last20",
        position: "F",
        deployment: "L2",
        strength: "5v5",
        min_gp: "2",
        min_toi: "600",
        limit: "25",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildRowsMock).toHaveBeenCalledWith({
      season: 20252026,
      asOfDate: "2026-03-01",
      window: "last20",
      position: "F",
      deployment: "L2",
      strength: "5v5",
      minGp: 2,
      minToiSeconds: 600,
      teamId: null,
      peerGroupType: "deployment",
      limit: 25,
    });
    expect(upsertRowsMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      dryRun: true,
      generatedRows: 2,
      rowsUpserted: 0,
      snapshotDate: "2026-03-01",
      sourceFreshness: [
        {
          metricKey: "points_per_60",
          snapshotDate: "2026-03-01",
          snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
          unavailable: false,
          reason: null,
        },
      ],
    });
  });

  it("upserts generated rows when dryRun is false", async () => {
    const req: any = {
      method: "POST",
      query: {
        season: "20252026",
        dryRun: "false",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(upsertRowsMock).toHaveBeenCalledWith(fakeSupabase, [
      { player_id: 1 },
      { player_id: 2 },
    ]);
    expect(buildRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 1000,
      }),
    );
    expect(res.body).toMatchObject({
      dryRun: false,
      rowsUpserted: 2,
    });
  });

  it("returns 400 when season is missing", async () => {
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toMatch(/season/);
    expect(buildRowsMock).not.toHaveBeenCalled();
  });
});

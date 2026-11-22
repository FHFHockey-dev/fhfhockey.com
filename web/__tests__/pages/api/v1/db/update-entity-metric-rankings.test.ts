import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { buildRowsMock, upsertRowsMock, fakeSupabase } = vi.hoisted(() => ({
  buildRowsMock: vi.fn(),
  upsertRowsMock: vi.fn(),
  fakeSupabase: { from: vi.fn(), rpc: vi.fn() },
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
    publishEntityMetricRankingRows: upsertRowsMock,
  };
});

import { RankingPublicationTableMissingError } from "../../../../../lib/rankings/rankingPublications";

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
    fakeSupabase.rpc.mockImplementation(async (name) => ({
      data: name === "claim_ranking_publication_dispatch"
        ? { outcome: "claimed", id: "claim-id", priorCutoff: "2026-11-14" } : null,
      error: null,
    }));
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
      expectedEntities: 2,
    });
    upsertRowsMock.mockResolvedValue({
      rowsUpserted: 2, dbWrittenRows: 2, marked: false, notMarkedReasons: ["fixture"],
      complete: false, windows: [],
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([[{ min_gp: "3" }, true], [{ position: "D" }, false]] as const)(
    "protects colliding all-skater keys while allowing independent keys under the same lock", async (filters, protect) => {
      vi.stubEnv("RANKINGS_DAILY_PUBLICATION", "daily");
      const res = createMockRes();
      await handler({ method: "POST", query: { season: "20262027", dryRun: "false", ...filters } } as any, res);
      expect(fakeSupabase.rpc).toHaveBeenCalledWith("claim_ranking_publication_dispatch",
        expect.objectContaining({ p_protect: protect }));
      expect(upsertRowsMock).toHaveBeenCalledOnce();
    },
  );

  it.each([{}, { min_gp: "3", limit: "2", metrics: "points_per_60" }])(
    "guards default and custom current 5v5 writes while a scheduled pair is active", async (filters) => {
      fakeSupabase.rpc.mockResolvedValueOnce({
        data: { outcome: "busy", id: null, priorCutoff: "2026-11-14", reason: "Active writer" },
        error: null,
      });
      const res = createMockRes();
      await handler({ method: "POST", query: { season: "20262027", dryRun: "false", ...filters } } as any, res);
      expect(fakeSupabase.rpc).toHaveBeenCalledWith("claim_ranking_publication_dispatch",
        expect.objectContaining({ p_season: 20262027, p_mode: "manual_rankings" }));
      expect(res.statusCode).toBe(409);
      expect(upsertRowsMock).not.toHaveBeenCalled();
    },
  );

  it("keeps a current-season dry run free of ledger writes", async () => {
    const res = createMockRes();
    await handler({ method: "GET", query: { season: "20262027" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(fakeSupabase.rpc).not.toHaveBeenCalled();
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
      expect.objectContaining({ rows: [{ entity_id: 1 }, { entity_id: 2 }] }),
      { chunkSize: 25 },
    );
    expect(res.body).toMatchObject({
      dryRun: false,
      upsertChunkSize: 25,
      rowsUpserted: 2,
    });
  });

  it("reports the publication plan on a dry run without writing", async () => {
    const res = createMockRes();
    await handler({ method: "GET", query: { season: "20252026" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.publication).toMatchObject({ marked: expect.any(Boolean), expectedEntities: 2 });
    expect(upsertRowsMock).not.toHaveBeenCalled();
  });

  it("returns 409 when a full publication did not complete", async () => {
    upsertRowsMock.mockResolvedValueOnce({
      rowsUpserted: 2, dbWrittenRows: 1, marked: true, notMarkedReasons: [], complete: false,
      windows: [{ windowType: "season", status: "writing", blockers: ["short"] }],
    });
    const res = createMockRes();
    await handler({ method: "POST", query: { season: "20262027", dryRun: "false" } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ success: false, publication: { complete: false } });
  });

  it("returns 409 when the marker table is not deployed", async () => {
    upsertRowsMock.mockRejectedValueOnce(new RankingPublicationTableMissingError());
    const res = createMockRes();
    await handler({ method: "POST", query: { season: "20262027", dryRun: "false" } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/not deployed/);
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

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

vi.mock("../../../../../lib/rankings/skaterCompositeWriter", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../../lib/rankings/skaterCompositeWriter")>();
  return {
    ...actual,
    buildSkaterCompositeRatingRows: buildRowsMock,
    publishSkaterCompositeRatingRows: upsertRowsMock,
  };
});

import { RankingsNotCompleteError } from "../../../../../lib/rankings/skaterCompositeWriter";
import { RankingPublicationTableMissingError } from "../../../../../lib/rankings/rankingPublications";

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
    fakeSupabase.rpc.mockImplementation(async (name) => ({
      data: name === "claim_ranking_publication_dispatch"
        ? { outcome: "claimed", id: "claim-id", priorCutoff: "2026-11-14" } : null,
      error: null,
    }));
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
      publication: { ready: true, blockers: [], candidateCount: 2, scoredCount: 2, unscoredCount: 0, truncated: false },
    });
    upsertRowsMock.mockResolvedValue({
      rowsUpserted: 2, dbWrittenRows: 2, marked: true, status: "complete",
      snapshotDate: "2026-04-16", writtenEntities: 2, blockers: [],
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([[{ min_gp: "3" }, true], [{ window: "last5" }, false]] as const)(
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
        expect.objectContaining({ p_season: 20262027, p_mode: "manual_composites" }));
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

    expect(upsertRowsMock).toHaveBeenCalledWith(
      fakeSupabase,
      expect.objectContaining({ rows: [{ player_id: 1 }, { player_id: 2 }] }),
    );
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

  it("never writes a cohort that fails publication checks", async () => {
    buildRowsMock.mockResolvedValueOnce({ rows: [], publication: { ready: false, blockers: ["source unavailable"] } });
    const res = createMockRes();
    await handler({ method: "POST", query: { season: "20262027", dryRun: "false" } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.rowsUpserted).toBe(0);
    expect(upsertRowsMock).not.toHaveBeenCalled();
  });

  it("returns 409 and writes nothing until Rankings at the cutoff are complete", async () => {
    upsertRowsMock.mockRejectedValueOnce(new RankingsNotCompleteError("Rankings at 2026-04-16 (5v5, season) are not a complete publication"));
    const res = createMockRes();
    await handler({ method: "POST", query: { season: "20262027", dryRun: "false" } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ success: false, rowsUpserted: 0 });
    expect(res.body.error).toMatch(/not a complete publication/);
  });

  it("returns 409 when the marker table is not deployed", async () => {
    upsertRowsMock.mockRejectedValueOnce(new RankingPublicationTableMissingError());
    const res = createMockRes();
    await handler({ method: "POST", query: { season: "20262027", dryRun: "false" } } as any, res);
    expect(res.statusCode).toBe(409);
  });

  it("returns 409 when the composite write did not complete", async () => {
    upsertRowsMock.mockResolvedValueOnce({
      rowsUpserted: 2, dbWrittenRows: 1, marked: true, status: "writing",
      snapshotDate: "2026-04-16", writtenEntities: 2, blockers: ["short"],
    });
    const res = createMockRes();
    await handler({ method: "POST", query: { season: "20262027", dryRun: "false" } } as any, res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ success: false, completion: { status: "writing" } });
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

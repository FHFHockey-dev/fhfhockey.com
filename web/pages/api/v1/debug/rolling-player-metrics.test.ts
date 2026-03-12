import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildPayloadMock } = vi.hoisted(() => ({
  buildPayloadMock: vi.fn()
}));

vi.mock("lib/supabase/Upserts/rollingPlayerValidationPayload", () => ({
  buildRollingPlayerValidationPayload: buildPayloadMock
}));

import handler from "./rolling-player-metrics";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("/api/v1/debug/rolling-player-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildPayloadMock.mockResolvedValue({
      generatedAt: "2026-03-12T12:00:00.000Z",
      request: {
        playerId: 8478402,
        season: 20252026,
        strength: "all"
      },
      selected: {
        player: null,
        focusedRow: null,
        metric: {
          key: null,
          family: null,
          canonicalField: null,
          legacyFields: [],
          supportFields: []
        }
      },
      readiness: {
        status: "READY",
        blockerReasons: [],
        cautionReasons: [],
        nextRecommendedAction: null
      },
      stored: null,
      recomputed: null,
      sourceRows: null,
      diagnostics: null,
      contracts: null,
      formulas: null,
      windows: null,
      comparisons: null,
      helpers: null
    });
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "POST",
      query: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, HEAD");
    expect(res.body).toEqual({
      success: false,
      error: "Method not allowed"
    });
  });

  it("returns 400 when required params are missing", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(buildPayloadMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: false,
      error: "Missing required query param: playerId"
    });
  });

  it("parses the request and returns the validation payload", async () => {
    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026",
        strength: "pp",
        teamId: "1",
        gameId: "2025021023",
        gameDate: "2026-03-11",
        startDate: "2026-02-01",
        endDate: "2026-03-11",
        metric: "pp_share_pct_last5",
        metricFamily: "power-play usage",
        includeStoredRows: "false",
        includeRecomputedRows: "true",
        includeSourceRows: "yes",
        includeDiagnostics: "1"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildPayloadMock).toHaveBeenCalledWith({
      playerId: 8478402,
      season: 20252026,
      strength: "pp",
      teamId: 1,
      gameId: 2025021023,
      gameDate: "2026-03-11",
      startDate: "2026-02-01",
      endDate: "2026-03-11",
      metric: "pp_share_pct_last5",
      metricFamily: "power-play usage",
      includeStoredRows: false,
      includeRecomputedRows: true,
      includeSourceRows: true,
      includeDiagnostics: true
    });
    expect(res.body).toMatchObject({
      success: true,
      payload: {
        readiness: {
          status: "READY"
        }
      }
    });
  });

  it("responds to HEAD without building the payload", async () => {
    const req: any = {
      method: "HEAD",
      query: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildPayloadMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: true,
      message: "Rolling player metrics validation endpoint OK."
    });
  });

  it("returns 500 when payload generation fails", async () => {
    buildPayloadMock.mockRejectedValueOnce(new Error("upsert blocker"));

    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: "upsert blocker"
    });
  });
});

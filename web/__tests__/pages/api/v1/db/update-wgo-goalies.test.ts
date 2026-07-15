import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  fetchMock,
  fromMock,
  seasonMaybeSingleMock,
  seasonOrderMock,
  wgoDeleteEqMock,
  wgoDeleteNotMock,
  wgoExistingLimitMock,
  wgoUpsertMock,
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn(),
  fetchMock: vi.fn(),
  fromMock: vi.fn(),
  seasonMaybeSingleMock: vi.fn(),
  seasonOrderMock: vi.fn(),
  wgoDeleteEqMock: vi.fn(),
  wgoDeleteNotMock: vi.fn(),
  wgoExistingLimitMock: vi.fn(),
  wgoUpsertMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock,
  },
}));

vi.mock("lib/cors-fetch", () => ({
  default: fetchMock,
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: vi.fn(),
}));

vi.mock("lib/supabase/utils/updateAllGoalies", () => ({
  updateAllGoaliesStats: vi.fn(),
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

import handler, {
  fetchDataForPlayer,
} from "../../../../../pages/api/v1/db/update-wgo-goalies";

function createMockRes() {
  return {
    body: null as unknown,
    headersSent: false,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  } as any;
}

describe("/api/v1/db/update-wgo-goalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const seasonQuery = {
      select() {
        return this;
      },
      lte() {
        return this;
      },
      gte() {
        return this;
      },
      maybeSingle: seasonMaybeSingleMock,
      order: seasonOrderMock,
    };

    seasonMaybeSingleMock.mockResolvedValue({
      data: {
        id: 20252026,
        startDate: "2025-10-07",
        regularSeasonEndDate: "2026-04-16",
      },
      error: null,
    });
    seasonOrderMock.mockResolvedValue({ data: [], error: null });

    const writeError = {
      code: "42883",
      message: "function unaccent(unknown, text) does not exist",
    };
    wgoUpsertMock.mockResolvedValue({ data: null, error: writeError });
    wgoDeleteNotMock.mockResolvedValue({ data: null, error: null });
    wgoDeleteEqMock.mockReturnValue({ not: wgoDeleteNotMock });
    wgoExistingLimitMock.mockResolvedValue({ data: [], error: null });
    auditInsertMock.mockResolvedValue({ data: null, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "seasons") {
        return seasonQuery;
      }
      if (table === "wgo_goalie_stats") {
        return {
          delete: () => ({ eq: wgoDeleteEqMock }),
          select: () => ({
            eq: () => ({ limit: wgoExistingLimitMock }),
          }),
          upsert: wgoUpsertMock,
        };
      }
      if (table === "cron_job_audit") {
        return { insert: auditInsertMock };
      }
      throw new Error(`Unexpected Supabase table: ${table}`);
    });

    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?")
            ? [
                {
                  goalieFullName: "Regression Goalie",
                  playerId: 8478402,
                },
              ]
            : [],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns and audits a structured error when bulk and row retry writes both fail", async () => {
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wgoUpsertMock).toHaveBeenCalledTimes(2);
    expect(wgoUpsertMock).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        goalie_id: 8478402,
        goalie_name: "Regression Goalie",
        date: "2026-01-01",
        season_id: 20252026,
      }),
    ]);
    expect(wgoUpsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        goalie_id: 8478402,
        date: "2026-01-01",
        season_id: 20252026,
      }),
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_WRITE_FAILED",
      requestedRows: 1,
      persistedRows: 0,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: 0,
      failedRows: 1,
      bulkError: "function unaccent(unknown, text) does not exist",
      failedSamples: [
        {
          goalieId: 8478402,
          date: "2026-01-01",
          seasonId: 20252026,
          code: "42883",
          message: "function unaccent(unknown, text) does not exist",
        },
      ],
    });

    expect(auditInsertMock).toHaveBeenCalledOnce();
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      job_name: "update-all-wgo-goalies",
      status: "error",
      rows_affected: 0,
      details: {
        method: "GET",
        url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
        statusCode: 500,
        response: {
          success: false,
          code: "WGO_GOALIE_WRITE_FAILED",
          requestedRows: 1,
          persistedRows: 0,
          totalPersistedRows: 0,
          failedRows: 1,
        },
        context: {
          action: "single_date_update",
          code: "WGO_GOALIE_WRITE_FAILED",
          requestedRows: 1,
          persistedRows: 0,
          totalPersistedRows: 0,
          failedRows: 1,
          failedSamples: [
            expect.objectContaining({
              goalieId: 8478402,
              code: "42883",
            }),
          ],
        },
      },
    });
  });

  it("redacts secret-shaped write errors from the route and audit surfaces", async () => {
    wgoUpsertMock.mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message:
          "write failed at https://example.test/private?token=value Bearer write-secret\ncontinued",
      },
    });
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      bulkError: "write failed at [redacted-url] Bearer [redacted] continued",
      failedSamples: [
        expect.objectContaining({
          message: "write failed at [redacted-url] Bearer [redacted] continued",
        }),
      ],
    });
    const serializedSurfaces = JSON.stringify({
      response: res.body,
      audit: auditInsertMock.mock.calls,
    });
    expect(serializedSurfaces).not.toContain("write-secret");
    expect(serializedSurfaces).not.toContain("token=value");
  });

  it("normalizes rejected write promises before response, audit, and log surfaces", async () => {
    wgoUpsertMock.mockRejectedValue(
      Object.assign(
        new Error(
          "write rejected at https://example.test/private?token=value Bearer write-secret\ncontinued",
        ),
        { code: "NETWORK_ERROR" },
      ),
    );
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(wgoUpsertMock).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_WRITE_FAILED",
      requestedRows: 1,
      persistedRows: 0,
      failedRows: 1,
      bulkErrorCode: "NETWORK_ERROR",
      bulkError: "write rejected at [redacted-url] Bearer [redacted] continued",
      failedSamples: [
        expect.objectContaining({
          code: "NETWORK_ERROR",
          message:
            "write rejected at [redacted-url] Bearer [redacted] continued",
        }),
      ],
    });
    const serializedSurfaces = JSON.stringify({
      response: res.body,
      audit: auditInsertMock.mock.calls,
      logs: vi.mocked(console.error).mock.calls,
    });
    expect(serializedSurfaces).not.toMatch(
      /write-secret|token=value|example\.test/,
    );
  });

  it("surfaces resolved audit insert errors with bounded value-safe diagnostics", async () => {
    wgoUpsertMock.mockResolvedValue({ data: null, error: null });
    auditInsertMock.mockResolvedValue({
      data: null,
      error: {
        message: `audit failed at https://example.test/private?token=value Bearer audit-secret\n${"x".repeat(500)}`,
      },
    });
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      message: "Failed to persist the required cron audit row.",
      success: false,
      code: "WGO_GOALIE_AUDIT_WRITE_FAILED",
      intendedStatusCode: 200,
    });
    expect(res.body.auditError).toContain("[redacted-url]");
    expect(res.body.auditError).toContain("Bearer [redacted]");
    expect(res.body.auditError).toHaveLength(300);
    expect(auditInsertMock).toHaveBeenCalledOnce();
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "success",
      rows_affected: 1,
      details: {
        statusCode: 200,
        intendedStatusCode: 200,
        response: {
          success: true,
        },
        context: {
          action: "single_date_update",
          actualUpserts: 1,
        },
      },
    });
    const auditFailureCall = vi
      .mocked(console.error)
      .mock.calls.find((call) => call[0] === "Failed to write audit row:");
    expect(auditFailureCall).toBeDefined();
    expect(auditFailureCall?.[1]).toContain("[redacted-url]");
    expect(auditFailureCall?.[1]).toContain("Bearer [redacted]");
    expect(String(auditFailureCall?.[1])).toHaveLength(300);
    expect(
      JSON.stringify({ response: res.body, logs: auditFailureCall }),
    ).not.toMatch(/audit-secret|token=value|example\.test/);
  });

  it("fails closed when a success-path audit insert promise rejects", async () => {
    wgoUpsertMock.mockResolvedValue({ data: null, error: null });
    auditInsertMock.mockRejectedValue(
      new Error(
        `audit rejected at https://example.test/private?token=value Bearer rejected-secret\n${"x".repeat(500)}`,
      ),
    );
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      message: "Failed to persist the required cron audit row.",
      success: false,
      code: "WGO_GOALIE_AUDIT_WRITE_FAILED",
      intendedStatusCode: 200,
    });
    expect(res.body.auditError).toContain("[redacted-url]");
    expect(res.body.auditError).toContain("Bearer [redacted]");
    expect(res.body.auditError).toHaveLength(300);
    expect(auditInsertMock).toHaveBeenCalledOnce();
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "success",
      rows_affected: 1,
      details: {
        statusCode: 200,
        intendedStatusCode: 200,
        response: {
          success: true,
        },
        context: {
          action: "single_date_update",
          actualUpserts: 1,
        },
      },
    });
    const auditFailureCall = vi
      .mocked(console.error)
      .mock.calls.find((call) => call[0] === "Failed to write audit row:");
    expect(auditFailureCall?.[1]).toBe(res.body.auditError);
    expect(
      JSON.stringify({ response: res.body, logs: auditFailureCall }),
    ).not.toMatch(/rejected-secret|token=value|example\.test/);
  });

  it("fails closed when required season metadata cannot be queried", async () => {
    seasonMaybeSingleMock.mockResolvedValue({
      data: null,
      error: {
        message:
          "season lookup failed at https://example.test/private?token=value Bearer season-secret",
      },
    });
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(seasonOrderMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "season",
      date: "2026-01-01",
      pageStart: 0,
      pageLimit: 1,
      completedRowsBeforeFailure: 0,
    });
    expect(res.body.upstreamError).toBe(
      "season lookup failed at [redacted-url] Bearer [redacted]",
    );
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        context: {
          action: "single_date_update",
          source: "season",
          code: "WGO_GOALIE_FETCH_FAILED",
        },
      },
    });
    expect(JSON.stringify(auditRows)).not.toContain("season-secret");
    expect(JSON.stringify(auditRows)).not.toContain("token=value");
  });

  it("does not count a range date as processed when season lookup fails", async () => {
    seasonMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "season lookup unavailable" },
    });
    const req = {
      method: "GET",
      query: {
        runMode: "single",
        startDate: "2026-01-01",
        overwrite: "true",
      },
      url: "/api/v1/db/update-wgo-goalies?runMode=single&startDate=2026-01-01&overwrite=true",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(wgoExistingLimitMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "season",
      completedRowsBeforeFailure: 0,
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        context: {
          action: "single_range_update",
          source: "season",
          completedRowsBeforeFailure: 0,
        },
      },
    });
    expect(auditRows[0].details.context).not.toHaveProperty("processedDates");
  });

  it("keeps a genuine no-season result as an explicit zero-update skip", async () => {
    seasonMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    seasonOrderMock.mockResolvedValue({ data: [], error: null });
    const req = {
      method: "GET",
      query: { date: "1990-07-01" },
      url: "/api/v1/db/update-wgo-goalies?date=1990-07-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(seasonOrderMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        updated: false,
        processedDate: "1990-07-01",
        actualUpsertCount: 0,
      },
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "success",
      rows_affected: 0,
      details: { statusCode: 200 },
    });
  });

  it("reports partially persisted fallback rows truthfully in the audit", async () => {
    const writeError = {
      code: "42883",
      message: "function unaccent(unknown, text) does not exist",
    };
    wgoUpsertMock
      .mockReset()
      .mockResolvedValueOnce({ data: null, error: writeError })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: writeError });
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?")
            ? [
                { goalieFullName: "Persisted Goalie", playerId: 8478402 },
                { goalieFullName: "Failed Goalie", playerId: 8478403 },
              ]
            : [],
        }),
      }),
    );

    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      requestedRows: 2,
      persistedRows: 1,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: 1,
      failedRows: 1,
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 1,
      details: {
        statusCode: 500,
        response: {
          success: false,
          totalPersistedRows: 1,
          failedRows: 1,
        },
        context: {
          totalPersistedRows: 1,
          failedRows: 1,
        },
      },
    });
  });

  it("fails a later required source page without writing an accumulated partial batch", async () => {
    const firstSummaryPage = Array.from({ length: 100 }, (_, index) => ({
      goalieFullName: `Acquired Goalie ${index + 1}`,
      playerId: 8478000 + index,
    }));
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/goalie/advanced?") && url.includes("start=100")) {
        return Promise.reject(
          new Error(
            `advanced page failed at https://example.test/private?token=value Bearer sensitive\n${"x".repeat(500)}`,
          ),
        );
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data:
            url.includes("/goalie/summary?") && url.includes("start=0")
              ? firstSummaryPage
              : [],
        }),
      });
    });

    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      date: "2026-01-01",
      source: "advanced",
      pageStart: 100,
      pageLimit: 100,
      completedRowsBeforeFailure: 0,
    });
    expect(res.body.upstreamError).toContain("[redacted-url]");
    expect(res.body.upstreamError).toContain("Bearer [redacted]");
    expect(res.body.upstreamError).not.toContain("sensitive");
    expect(res.body.upstreamError.length).toBeLessThanOrEqual(300);

    expect(auditInsertMock).toHaveBeenCalledOnce();
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        response: {
          success: false,
          code: "WGO_GOALIE_FETCH_FAILED",
          source: "advanced",
          pageStart: 100,
        },
        context: {
          action: "single_date_update",
          code: "WGO_GOALIE_FETCH_FAILED",
          date: "2026-01-01",
          source: "advanced",
          pageStart: 100,
          completedRowsBeforeFailure: 0,
        },
      },
    });
  });

  it("rejects a repeated full source page before persistence", async () => {
    const repeatedSummaryPage = Array.from({ length: 100 }, (_, index) => ({
      goalieFullName: `Repeated Goalie ${index + 1}`,
      playerId: 8478000 + index,
    }));
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?") ? repeatedSummaryPage : [],
        }),
      }),
    );
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "summary",
      pageStart: 100,
      pageLimit: 100,
      upstreamError:
        "Refusing repeated full summary page during WGO date pagination.",
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        context: {
          source: "summary",
          pageStart: 100,
        },
      },
    });
  });

  it("rejects a repeated short source page while another source keeps pagination active", async () => {
    const repeatedAdvancedPage = [{ playerId: 8478402 }];
    fetchMock.mockImplementation((url: string) => {
      const parsedUrl = new URL(url);
      const pageStart = Number(parsedUrl.searchParams.get("start") ?? "0");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?")
            ? Array.from({ length: 100 }, (_, index) => ({
                goalieFullName: `Unique Goalie ${pageStart + index + 1}`,
                playerId: 8_000_000 + pageStart + index,
              }))
            : url.includes("/goalie/advanced?")
              ? repeatedAdvancedPage
              : [],
        }),
      });
    });
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "advanced",
      pageStart: 100,
      pageLimit: 100,
      upstreamError:
        "Refusing repeated non-empty advanced page during WGO date pagination.",
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        intendedStatusCode: 500,
        context: {
          source: "advanced",
          pageStart: 100,
        },
      },
    });
  });

  it("enforces the hard date-page ceiling before persistence", async () => {
    fetchMock.mockImplementation((url: string) => {
      const parsedUrl = new URL(url);
      const pageStart = Number(parsedUrl.searchParams.get("start") ?? "0");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?")
            ? Array.from({ length: 100 }, (_, index) => ({
                goalieFullName: `Unique Goalie ${pageStart + index + 1}`,
                playerId: 8_000_000 + pageStart + index,
              }))
            : [],
        }),
      });
    });
    const req = {
      method: "GET",
      query: { date: "2026-01-01" },
      url: "/api/v1/db/update-wgo-goalies?date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(75);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "summary",
      pageStart: 2400,
      pageLimit: 100,
      upstreamError:
        "Refusing WGO date pagination beyond 25 pages while a required source still returns full pages.",
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        context: {
          source: "summary",
          pageStart: 2400,
        },
      },
    });
  });

  it("rejects an invalid source-level player ID before season lookup or upstream fetch", async () => {
    await expect(
      fetchDataForPlayer("0", "Invalid Goalie", "2026-01-01"),
    ).rejects.toThrow("Invalid playerId. Expected a positive safe integer.");

    expect(seasonMaybeSingleMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a query-expression player ID before season lookup or upstream fetch", async () => {
    const req = {
      method: "GET",
      query: {
        playerId: '8478402" or playerId>"0',
        date: "2026-01-01",
      },
      url: "/api/v1/db/update-wgo-goalies?playerId=malformed&date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(seasonMaybeSingleMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: "Invalid playerId. Expected a positive safe integer.",
      success: false,
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 400,
        context: {
          action: "fetch_single_player",
          error: "Invalid playerId. Expected a positive safe integer.",
        },
      },
    });
  });

  it("keeps a normalized, response-filtered single-player fetch read-only", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?")
            ? [
                {
                  goalieFullName: "Regression Goalie",
                  playerId: 8478402,
                },
                {
                  goalieFullName: "Different Goalie",
                  playerId: 8478403,
                },
              ]
            : url.includes("/goalie/advanced?")
              ? [
                  {
                    goalieFullName: "Different Goalie",
                    playerId: 8478403,
                  },
                  {
                    goalieFullName: "Regression Goalie",
                    playerId: "8478402",
                  },
                ]
              : url.includes("/goalie/daysrest?")
                ? [
                    {
                      goalieFullName: "Regression Goalie",
                      playerId: 8478402,
                    },
                    {
                      goalieFullName: "Different Goalie",
                      playerId: 8478403,
                    },
                  ]
                : [],
        }),
      }),
    );
    const req = {
      method: "GET",
      query: {
        playerId: "0008478402",
        date: "2026-01-01",
        goalieFullName: "Regression Goalie",
      },
      url: "/api/v1/db/update-wgo-goalies?playerId=0008478402&date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        goalieStats: [
          expect.objectContaining({
            goalieFullName: "Regression Goalie",
            playerId: 8478402,
          }),
        ],
        advancedGoalieStats: [
          expect.objectContaining({
            goalieFullName: "Regression Goalie",
            playerId: "8478402",
          }),
        ],
        daysLeftStats: [
          expect.objectContaining({
            goalieFullName: "Regression Goalie",
            playerId: 8478402,
          }),
        ],
      },
    });
    expect(res.body.data.goalieStats).toHaveLength(1);
    expect(res.body.data.advancedGoalieStats).toHaveLength(1);
    expect(res.body.data.daysLeftStats).toHaveLength(1);
    for (const [requestUrl] of fetchMock.mock.calls) {
      const cayenneExpression = new URL(String(requestUrl)).searchParams.get(
        "cayenneExp",
      );
      expect(cayenneExpression).toContain('playerId="8478402"');
      expect(cayenneExpression).not.toContain("0008478402");
    }
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "success",
      rows_affected: 1,
      details: {
        context: {
          action: "fetch_single_player",
          playerId: "8478402",
        },
      },
    });
  });

  it("fails a single-player fetch when a required payload is malformed", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/goalie/summary?") ? { unexpected: [] } : { data: [] },
      }),
    );
    const req = {
      method: "GET",
      query: {
        playerId: "8478402",
        date: "2026-01-01",
        goalieFullName: "Regression Goalie",
      },
      url: "/api/v1/db/update-wgo-goalies?playerId=8478402&date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "summary",
      date: "2026-01-01",
      pageStart: 0,
      pageLimit: 100,
      upstreamError: "Upstream response omitted the required data array.",
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        context: {
          action: "fetch_single_player",
          source: "summary",
          pageStart: 0,
        },
      },
    });
  });

  it("rejects a repeated full page during single-player pagination", async () => {
    const repeatedSummaryPage = Array.from({ length: 100 }, (_, index) => ({
      goalieFullName: `Repeated Player Page ${index + 1}`,
      playerId: 8478000 + index,
    }));
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?") ? repeatedSummaryPage : [],
        }),
      }),
    );
    const req = {
      method: "GET",
      query: {
        playerId: "8478402",
        date: "2026-01-01",
        goalieFullName: "Regression Goalie",
      },
      url: "/api/v1/db/update-wgo-goalies?playerId=8478402&date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "summary",
      pageStart: 100,
      pageLimit: 100,
      upstreamError:
        "Refusing repeated full summary page during WGO player pagination.",
    });
  });

  it("enforces the hard page ceiling during single-player pagination", async () => {
    fetchMock.mockImplementation((url: string) => {
      const parsedUrl = new URL(url);
      const pageStart = Number(parsedUrl.searchParams.get("start") ?? "0");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?")
            ? Array.from({ length: 100 }, (_, index) => ({
                goalieFullName: `Unique Player Page ${pageStart + index + 1}`,
                playerId: 8_000_000 + pageStart + index,
              }))
            : [],
        }),
      });
    });
    const req = {
      method: "GET",
      query: {
        playerId: "8478402",
        date: "2026-01-01",
        goalieFullName: "Regression Goalie",
      },
      url: "/api/v1/db/update-wgo-goalies?playerId=8478402&date=2026-01-01",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(75);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      source: "summary",
      pageStart: 2400,
      pageLimit: 100,
      upstreamError:
        "Refusing WGO player pagination beyond 25 pages while a required source still returns full pages.",
    });
  });

  it("does not delete overwrite rows until every required source page is acquired", async () => {
    wgoExistingLimitMock.mockResolvedValue({
      data: [{ goalie_id: 8478402 }],
      error: null,
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/goalie/summary?")) {
        return Promise.reject(new Error("summary source unavailable"));
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });
    });

    const req = {
      method: "GET",
      query: {
        overwrite: "true",
        runMode: "single",
        startDate: "2026-01-01",
      },
      url: "/api/v1/db/update-wgo-goalies?runMode=single&startDate=2026-01-01&overwrite=true",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(wgoExistingLimitMock).toHaveBeenCalledWith(1);
    expect(wgoDeleteEqMock).not.toHaveBeenCalled();
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      date: "2026-01-01",
      source: "summary",
      pageStart: 0,
      pageLimit: 100,
      completedRowsBeforeFailure: 0,
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        context: {
          action: "single_range_update",
          code: "WGO_GOALIE_FETCH_FAILED",
        },
      },
    });
  });

  it("does not prune overwrite rows when the acquired batch fails to persist", async () => {
    wgoExistingLimitMock.mockResolvedValue({
      data: [{ goalie_id: 8478402 }],
      error: null,
    });

    const req = {
      method: "GET",
      query: {
        overwrite: "true",
        runMode: "single",
        startDate: "2026-01-01",
      },
      url: "/api/v1/db/update-wgo-goalies?runMode=single&startDate=2026-01-01&overwrite=true",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(wgoUpsertMock).toHaveBeenCalledTimes(2);
    expect(wgoDeleteEqMock).not.toHaveBeenCalled();
    expect(wgoDeleteNotMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_WRITE_FAILED",
      requestedRows: 1,
      persistedRows: 0,
      failedRows: 1,
    });
  });

  it("retains existing overwrite rows when the acquired summary is empty", async () => {
    wgoExistingLimitMock.mockResolvedValue({
      data: [{ goalie_id: 8478402 }],
      error: null,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    const req = {
      method: "GET",
      query: {
        overwrite: "true",
        runMode: "single",
        startDate: "2026-01-01",
      },
      url: "/api/v1/db/update-wgo-goalies?runMode=single&startDate=2026-01-01&overwrite=true",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(wgoDeleteEqMock).not.toHaveBeenCalled();
    expect(wgoDeleteNotMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_FETCH_FAILED",
      date: "2026-01-01",
      source: "summary",
      pageStart: 0,
      pageLimit: 100,
      completedRowsBeforeFailure: 0,
      upstreamError:
        "Refusing to replace existing goalie stats with an empty acquired summary.",
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 0,
      details: {
        statusCode: 500,
        response: {
          success: false,
          code: "WGO_GOALIE_FETCH_FAILED",
        },
      },
    });
  });

  it("allows a completely acquired empty date when overwrite has no existing rows", async () => {
    wgoExistingLimitMock.mockResolvedValue({ data: [], error: null });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    const req = {
      method: "GET",
      query: {
        overwrite: "true",
        runMode: "single",
        startDate: "2026-01-01",
      },
      url: "/api/v1/db/update-wgo-goalies?runMode=single&startDate=2026-01-01&overwrite=true",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wgoUpsertMock).not.toHaveBeenCalled();
    expect(wgoDeleteEqMock).not.toHaveBeenCalled();
    expect(wgoDeleteNotMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        processedDates: 1,
        totalErrors: 0,
        totalUpdates: 0,
      },
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "success",
      rows_affected: 0,
      details: { statusCode: 200 },
    });
  });

  it("returns and audits a structured safe-superset error when post-write pruning fails", async () => {
    wgoExistingLimitMock.mockResolvedValue({
      data: [{ goalie_id: 8478401 }],
      error: null,
    });
    wgoUpsertMock.mockResolvedValue({ data: null, error: null });
    wgoDeleteNotMock.mockResolvedValue({
      data: null,
      error: {
        message:
          "prune failed at https://example.test/private Bearer sensitive",
      },
    });

    const req = {
      method: "GET",
      query: {
        overwrite: "true",
        runMode: "single",
        startDate: "2026-01-01",
      },
      url: "/api/v1/db/update-wgo-goalies?runMode=single&startDate=2026-01-01&overwrite=true",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(wgoUpsertMock).toHaveBeenCalledOnce();
    expect(wgoDeleteEqMock).toHaveBeenCalledWith("date", "2026-01-01");
    expect(wgoDeleteNotMock).toHaveBeenCalledWith(
      "goalie_id",
      "in",
      "(8478402)",
    );
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      code: "WGO_GOALIE_PRUNE_FAILED",
      date: "2026-01-01",
      replacementRowsPersisted: 1,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: 1,
      safeSupersetRetained: true,
    });
    expect(res.body.upstreamError).toContain("[redacted-url]");
    expect(res.body.upstreamError).toContain("Bearer [redacted]");
    expect(res.body.upstreamError).not.toContain("sensitive");
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "error",
      rows_affected: 1,
      details: {
        statusCode: 500,
        response: {
          success: false,
          code: "WGO_GOALIE_PRUNE_FAILED",
          totalPersistedRows: 1,
          safeSupersetRetained: true,
        },
        context: {
          action: "single_range_update",
          code: "WGO_GOALIE_PRUNE_FAILED",
          totalPersistedRows: 1,
          safeSupersetRetained: true,
        },
      },
    });
  });

  it("prunes only stale goalie IDs after a successful overwrite upsert", async () => {
    wgoExistingLimitMock.mockResolvedValue({
      data: [{ goalie_id: 8478402 }],
      error: null,
    });
    wgoUpsertMock.mockResolvedValue({ data: null, error: null });
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: url.includes("/goalie/summary?")
            ? [
                {
                  goalieFullName: "Preserved Goalie One",
                  playerId: 8478402,
                },
                {
                  goalieFullName: "Preserved Goalie Two",
                  playerId: 8478403,
                },
              ]
            : [],
        }),
      }),
    );

    const req = {
      method: "GET",
      query: {
        overwrite: "true",
        runMode: "single",
        startDate: "2026-01-01",
      },
      url: "/api/v1/db/update-wgo-goalies?runMode=single&startDate=2026-01-01&overwrite=true",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(wgoUpsertMock).toHaveBeenCalledOnce();
    expect(wgoDeleteEqMock).toHaveBeenCalledOnce();
    expect(wgoDeleteEqMock).toHaveBeenCalledWith("date", "2026-01-01");
    expect(wgoDeleteNotMock).toHaveBeenCalledOnce();
    expect(wgoDeleteNotMock).toHaveBeenCalledWith(
      "goalie_id",
      "in",
      "(8478402,8478403)",
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        overwrite: true,
        processedDates: 1,
        totalErrors: 0,
        totalUpdates: 2,
      },
    });
    const [auditRows] = auditInsertMock.mock.calls[0];
    expect(auditRows[0]).toMatchObject({
      status: "success",
      rows_affected: 2,
      details: {
        statusCode: 200,
        context: {
          action: "single_range_update",
          overwrite: true,
          totalUpdates: 2,
          totalErrors: 0,
        },
      },
    });
  });
});

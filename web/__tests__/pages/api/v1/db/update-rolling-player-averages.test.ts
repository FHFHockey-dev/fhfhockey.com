import { beforeEach, describe, expect, it, vi } from "vitest";

const { mainMock, auditInsertMock } = vi.hoisted(() => ({
  mainMock: vi.fn(),
  auditInsertMock: vi.fn().mockResolvedValue({ error: null })
}));

function createRollingRunSummary(overrides: Record<string, unknown> = {}) {
  return {
    rowsUpserted: 10,
    processedPlayers: 2,
    playersWithRows: 2,
    coverageWarnings: 0,
    suspiciousOutputWarnings: 0,
    unknownGameIds: 0,
    freshnessBlockers: 0,
    sourceTracking: {
      missingSources: {
        counts: 0,
        rates: 0,
        countsOi: 0,
        pp: 0,
        ppUnit: 0,
        line: 0,
        lineAssignment: 0,
        knownGameId: 0
      },
      wgoFallbacks: {
        goals: 0,
        assists: 0,
        primary_assists: 0,
        secondary_assists: 0,
        shots: 0,
        hits: 0,
        blocks: 0,
        points: 0,
        ixg: 0
      },
      rateReconstructions: {
        sog_per_60: 0,
        ixg_per_60: 0
      },
      ixgPer60Sources: {
        counts_raw: 0,
        wgo_raw: 0,
        rate_reconstruction: 0,
        unavailable: 0
      },
      toiSources: {
        counts: 0,
        counts_oi: 0,
        rates: 0,
        fallback: 0,
        wgo: 0,
        none: 0
      },
      toiFallbackSeeds: {
        counts: 0,
        counts_oi: 0,
        wgo: 0,
        none: 0
      },
      toiTrustTiers: {
        authoritative: 0,
        supplementary: 0,
        fallback: 0,
        none: 0
      },
      toiWgoNormalizations: {
        minutes_to_seconds: 0,
        already_seconds: 0,
        missing: 0,
        invalid: 0
      },
      toiSuspiciousReasons: {
        non_finite: 0,
        non_positive: 0,
        above_max_seconds: 0
      }
    },
    ...overrides
  };
}

vi.mock("lib/supabase/Upserts/fetchRollingPlayerAverages", () => ({
  main: mainMock
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

import handler from "../../../../../pages/api/v1/db/update-rolling-player-averages";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/update-rolling-player-averages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainMock.mockResolvedValue(createRollingRunSummary());
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "DELETE",
      query: {},
      url: "/api/v1/db/update-rolling-player-averages"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, POST, HEAD");
    expect(res.body).toEqual({ message: "Method not allowed" });
  });

  it("forwards dry-run and debug upsert controls with fast-mode defaults to main", async () => {
    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402",
        season: "20252026",
        resumeFrom: "8478000",
        fullRefresh: "false",
        fullRefreshMode: "overwrite_only",
        deleteChunkSize: "25000",
        upsertBatchSize: "900",
        dryRunUpsert: "yes",
        debugUpsertPayload: "true",
        fastMode: "true"
      },
      url: "/api/v1/db/update-rolling-player-averages?playerId=8478402"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mainMock).toHaveBeenCalledWith({
      playerId: 8478402,
      season: 20252026,
      startDate: undefined,
      endDate: undefined,
      resumePlayerId: 8478000,
      forceFullRefresh: false,
      fullRefreshMode: "overwrite_only",
      fullRefreshDeleteChunkSize: 25000,
      playerConcurrency: 4,
      upsertBatchSize: 900,
      upsertConcurrency: 4,
      skipDiagnostics: true,
      dryRunUpsert: true,
      debugUpsertPayload: true
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "Rolling player averages processed successfully.",
      executionProfile: "targeted_repair",
      runSummary: expect.objectContaining({
        freshnessBlockers: 0
      }),
      dependencyContract: {
        version: "rolling-forge-operator-order-v1",
        currentStage: {
          id: "rolling_player_recompute",
          order: 4
        }
      },
      runtimeBudget: expect.objectContaining({
        budgetMs: 600000,
        withinBudget: true
      })
    });
  });

  it("infers overnight tuning defaults for broad fast-mode season sweeps", async () => {
    const req: any = {
      method: "GET",
      query: {
        season: "20252026",
        fastMode: "true"
      },
      url: "/api/v1/db/update-rolling-player-averages?season=20252026&fastMode=true"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mainMock).toHaveBeenCalledWith({
      playerId: undefined,
      season: 20252026,
      startDate: undefined,
      endDate: undefined,
      resumePlayerId: undefined,
      forceFullRefresh: undefined,
      fullRefreshMode: undefined,
      fullRefreshDeleteChunkSize: undefined,
      playerConcurrency: 4,
      upsertBatchSize: 250,
      upsertConcurrency: 2,
      skipDiagnostics: true,
      dryRunUpsert: undefined,
      debugUpsertPayload: undefined
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      executionProfile: "overnight",
      runtimeBudget: expect.objectContaining({
        budgetMs: 1800000,
        withinBudget: true
      })
    });
  });

  it("bounds bare GET cron calls to an implicit recent daily window", async () => {
    const req: any = {
      method: "GET",
      query: {},
      url: "/api/v1/db/update-rolling-player-averages"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mainMock).toHaveBeenCalledTimes(1);
    const args = mainMock.mock.calls[0][0];
    expect(args.playerId).toBeUndefined();
    expect(args.season).toBeUndefined();
    expect(args.resumePlayerId).toBeUndefined();
    expect(args.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(args.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(args.playerConcurrency).toBe(4);
    expect(args.upsertBatchSize).toBe(500);
    expect(args.upsertConcurrency).toBe(4);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      executionProfile: "daily_incremental",
      executionScope: {
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        implicitDailyWindowApplied: true,
        windowDays: 15,
        smokeTestComparable: false,
        smokeTestGuidance:
          "This run is not a one-day smoke test. Use explicit startDate=endDate for a true one-day operational probe."
      },
      runtimeBudget: expect.objectContaining({
        budgetMs: 270000,
        withinBudget: true
      })
    });
  });

  it("allows POST body params to bound cron runs explicitly", async () => {
    const req: any = {
      method: "POST",
      query: {},
      body: {
        startDate: "2026-03-10",
        endDate: "2026-03-14",
        fastMode: true,
        executionProfile: "daily_incremental"
      },
      url: "/api/v1/db/update-rolling-player-averages"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(mainMock).toHaveBeenCalledWith({
      playerId: undefined,
      season: undefined,
      startDate: "2026-03-10",
      endDate: "2026-03-14",
      resumePlayerId: undefined,
      maxPlayers: undefined,
      forceFullRefresh: undefined,
      fullRefreshMode: undefined,
      fullRefreshDeleteChunkSize: undefined,
      playerConcurrency: 4,
      upsertBatchSize: 500,
      upsertConcurrency: 4,
      skipDiagnostics: true,
      dryRunUpsert: undefined,
      debugUpsertPayload: undefined
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      executionProfile: "daily_incremental",
      executionScope: {
        startDate: "2026-03-10",
        endDate: "2026-03-14",
        implicitDailyWindowApplied: false,
        windowDays: 5,
        smokeTestComparable: false,
        smokeTestGuidance:
          "This run is not a one-day smoke test. Use explicit startDate=endDate for a true one-day operational probe."
      }
    });
  });

  it("marks explicit same-day rolling runs as smoke-test comparable", async () => {
    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-03-14",
        endDate: "2026-03-14",
        executionProfile: "daily_incremental"
      },
      url: "/api/v1/db/update-rolling-player-averages?startDate=2026-03-14&endDate=2026-03-14&executionProfile=daily_incremental"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      executionProfile: "daily_incremental",
      executionScope: {
        startDate: "2026-03-14",
        endDate: "2026-03-14",
        implicitDailyWindowApplied: false,
        windowDays: 1,
        smokeTestComparable: true,
        smokeTestGuidance: null
      }
    });
  });

  it("returns 500 when the rolling writer throws", async () => {
    mainMock.mockRejectedValueOnce(new Error("upsert blocker"));

    const req: any = {
      method: "GET",
      query: {
        playerId: "8478402"
      },
      url: "/api/v1/db/update-rolling-player-averages?playerId=8478402"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      message: "upsert blocker",
      dependencyContract: expect.objectContaining({
        currentStage: expect.objectContaining({
          id: "rolling_player_recompute"
        })
      }),
      runSummary: undefined
    });
  });

  it("returns 422 when upstream freshness blockers remain", async () => {
    mainMock.mockResolvedValueOnce(
      createRollingRunSummary({
        freshnessBlockers: 3
      })
    );

    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-03-10",
        endDate: "2026-03-14"
      },
      url: "/api/v1/db/update-rolling-player-averages?startDate=2026-03-10&endDate=2026-03-14"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({
      message:
        "Freshness dependency checks failed. Refresh stale upstream sources or use bypassFreshnessBlockers=true to override.",
      success: false,
      operationStatus: "blocked",
      warning:
        "Rolling player averages were blocked because required upstream freshness checks failed.",
      executionScope: {
        startDate: "2026-03-10",
        endDate: "2026-03-14",
        implicitDailyWindowApplied: false,
        windowDays: 5,
        smokeTestComparable: false,
        smokeTestGuidance:
          "This run is not a one-day smoke test. Use explicit startDate=endDate for a true one-day operational probe."
      },
      runSummary: expect.objectContaining({
        freshnessBlockers: 3
      }),
      freshnessGate: {
        status: "FAIL",
        blockerCount: 3,
        bypassed: false
      }
    });
  });

  it("returns warning status and successful audit semantics when freshness blockers are bypassed", async () => {
    mainMock.mockResolvedValueOnce(
      createRollingRunSummary({
        freshnessBlockers: 2
      })
    );
    const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    try {
      const req: any = {
        method: "GET",
        query: {
          startDate: "2026-03-14",
          endDate: "2026-03-14",
          bypassFreshnessBlockers: "true"
        },
        url: "/api/v1/db/update-rolling-player-averages?startDate=2026-03-14&endDate=2026-03-14&bypassFreshnessBlockers=true"
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        message:
          "Rolling player averages processed with freshness blockers bypassed.",
        success: true,
        operationStatus: "warning",
        warning:
          "Upstream freshness blockers were bypassed. Treat this recompute as degraded until stale sources are refreshed.",
        executionScope: {
          startDate: "2026-03-14",
          endDate: "2026-03-14",
          implicitDailyWindowApplied: false,
          windowDays: 1,
          smokeTestComparable: true,
          smokeTestGuidance: null
        },
        freshnessGate: {
          status: "FAIL",
          blockerCount: 2,
          bypassed: true,
          action:
            "Refresh stale upstream sources or use bypassFreshnessBlockers=true to override."
        }
      });
      expect(auditInsertMock).toHaveBeenCalled();
      const insertedAuditRow = auditInsertMock.mock.calls.at(-1)?.[0];
      expect(insertedAuditRow).toMatchObject({
        status: "success",
        job_name: "/api/v1/db/update-rolling-player-averages"
      });
    } finally {
      if (previousServiceRoleKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
      }
    }
  });

  it("downgrades freshness blockers to warning status for the implicit daily cron shape", async () => {
    mainMock.mockResolvedValueOnce(
      createRollingRunSummary({
        freshnessBlockers: 1
      })
    );

    const req: any = {
      method: "GET",
      query: {},
      url: "/api/v1/db/update-rolling-player-averages"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      operationStatus: "warning",
      message:
        "Rolling player averages processed with freshness warnings on the implicit daily window.",
      warning:
        "Implicit daily maintenance tolerated upstream freshness blockers. Treat this recompute as degraded until stale sources are refreshed.",
      executionProfile: "daily_incremental",
      executionScope: expect.objectContaining({
        implicitDailyWindowApplied: true
      }),
      freshnessGate: {
        status: "FAIL",
        blockerCount: 1,
        bypassed: true,
        action:
          "Refresh stale upstream sources or use bypassFreshnessBlockers=true to override."
      }
    });
  });
});

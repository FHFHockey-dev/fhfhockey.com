import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditInsertMock, gamesEqMock, gamesSelectMock, runningRunRows } = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  gamesEqMock: vi.fn(),
  gamesSelectMock: vi.fn(),
  runningRunRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock,
    })),
  },
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      if (table === "cron_job_audit") {
        return {
          insert: auditInsertMock,
        };
      }

      if (table === "forge_runs") {
        const query: any = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          limit: vi.fn().mockImplementation(async () => ({ data: runningRunRows, error: null })),
        };
        return query;
      }

      if (table === "games") {
        gamesEqMock.mockResolvedValue({
          data: null,
          error: {
            message:
              "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title></html>",
          },
        });
        gamesSelectMock.mockReturnValue({
          eq: gamesEqMock,
        });
        return {
          select: gamesSelectMock,
        };
      }

      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
    }),
  },
}));

vi.mock("lib/projections/run-forge-projections", () => ({
  runProjectionV2ForDate: vi.fn(),
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

import { runProjectionV2ForDate } from "lib/projections/run-forge-projections";
import handler, {
  buildProjectionDerivedGate,
  buildProjectionInputIngestGate,
  parseProjectionGameIds,
  summarizeSkaterFreshnessCoverage,
  summarizeGoalieRosterAssignments,
} from "../../../../../pages/api/v1/db/run-projection-v2";

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
    },
  };
  return res;
}

describe("/api/v1/db/run-projection-v2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runningRunRows.length = 0;
  });

  it("normalizes a bounded single-date game batch without duplicate ids", () => {
    expect(
      parseProjectionGameIds("2025020101, 2025020102,2025020101,bad,-1"),
    ).toEqual([2025020101, 2025020102]);
  });

  it("normalizes html upstream dependency failures into structured payloads", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    const auditPrefix = JSON.stringify(res.body).slice(0, 4000);
    expect(auditPrefix).toContain('"dependencyError"');
    expect(auditPrefix).toContain('"classification":"html_upstream_response"');
    expect(Object.keys(res.body).indexOf("error")).toBeLessThan(Object.keys(res.body).indexOf("pipeline"));
    expect(res.body).toMatchObject({
      success: false,
      termination: {
        state: "blocked",
        resumeRequired: true,
        nextStartDate: "2026-03-20",
      },
      finalAudit: {
        owner: "withCronJobAudit",
        status: "persisted",
      },
      error:
        "Upstream dependency returned an HTML error page instead of structured JSON.",
      dependencyContract: {
        version: "rolling-forge-operator-order-v2",
        currentStage: {
          id: "projection_execution",
          order: 8,
        },
        prerequisiteStages: [
          expect.objectContaining({
            id: "rolling_player_recompute",
            order: 4,
          }),
          expect.objectContaining({
            id: "projection_derived_build",
            order: 7,
          }),
        ],
      },
      compatibilityInventory: {
        version: "forge-compatibility-inventory-v2",
        removedShim: {
          legacyModulePath: "web/lib/projections/runProjectionV2.ts",
          canonicalModulePath: "web/lib/projections/run-forge-projections.ts",
          status: "removed",
        },
        duplicateReaders: expect.arrayContaining([
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/players",
            legacyRoute: "/api/v1/projections/players",
          }),
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/goalies",
            legacyRoute: "/api/v1/projections/goalies",
          }),
        ]),
      },
      dependencyError: {
        kind: "dependency_error",
        classification: "html_upstream_response",
        source: "supabase_or_proxy",
        htmlLike: true,
      },
      observability: {
        dataQualityWarnings: [
          expect.objectContaining({
            code: "dependency_error",
            message:
              "Upstream dependency returned an HTML error page instead of structured JSON.",
          }),
        ],
      },
      scanSummary: {
        surface: "projection_run_operator",
        requestedDate: "2026-03-20",
        activeDataDate: "2026-03-20",
        fallbackApplied: false,
        status: "blocked",
        rowCounts: {
          gamesProcessed: 0,
          playerRowsUpserted: 0,
          teamRowsUpserted: 0,
          goalieRowsUpserted: 0,
        },
        blockingIssueCount: 1,
      },
    });
    expect(auditInsertMock.mock.calls[0]?.[0]?.details?.finalAudit).toEqual({
      owner: "withCronJobAudit",
      status: "persisted",
    });
  });

  it("reports a resumable run stopped at its deadline as a 207 continuation, not a failure", async () => {
    vi.mocked(runProjectionV2ForDate).mockResolvedValueOnce({
      runId: "run-1",
      gamesProcessed: 10,
      playerRowsUpserted: 360,
      teamRowsUpserted: 20,
      goalieRowsUpserted: 20,
      timedOut: true,
      resume: { resumed: false, invocations: 1, completedGames: 10, totalGames: 14, pendingGames: 4 },
    });
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-10-17", bypassPreflight: "true" } } as any, res);

    expect(res.statusCode).toBe(207);
    expect(res.body).not.toHaveProperty("error");
    expect(res.body).toMatchObject({
      success: false,
      operationStatus: "partial",
      runId: "run-1",
      gamesProcessed: 10,
      timedOut: true,
      termination: { state: "resume_required", resumeRequired: true, nextStartDate: "2026-10-17" },
      resume: {
        required: true,
        reason: "runtime_budget",
        runId: "run-1",
        completedGames: 10,
        totalGames: 14,
        pendingGames: 4,
        request: { date: "2026-10-17", horizonGames: "1", bypassPreflight: "true" },
      },
      scanSummary: { status: "partial", blockingIssueCount: 0 },
    });
    expect(auditInsertMock.mock.calls[0]?.[0]?.status).toBe("continued");
  });

  it("reports a run held by another call as a continuation", async () => {
    vi.mocked(runProjectionV2ForDate).mockRejectedValueOnce(Object.assign(
      new Error("Projection run already active for 2026-10-17 (run run-1, last activity 1m ago)."),
      { code: "ACTIVE_RUN_EXISTS", statusCode: 409, resumeInProgress: true },
    ));
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-10-17", bypassPreflight: "true" } } as any, res);

    expect(res.statusCode).toBe(207);
    expect(res.body).not.toHaveProperty("error");
    expect(res.body).toMatchObject({
      operationStatus: "partial",
      resume: { required: true, reason: "run_in_progress_elsewhere", runId: null },
    });
    expect(auditInsertMock.mock.calls[0]?.[0]?.status).toBe("continued");
  });

  // 2026-10-22: a game stalled after the 210 s budget's last boundary check and
  // Vercel killed the call at 240 s (504) before it answered.
  it.each([
    ["the default budget", {}, 210_000, 225_000],
    ["a budget above the cap", { maxDurationMs: "999999" }, 210_000, 225_000],
    ["an in-process caller's shorter budget", { maxDurationMs: "60000" }, 60_000, 75_000],
  ])("answers a stuck run with a 207 resume before the platform limit (%s)", async (_label, query, budgetMs, answerAfterMs) => {
    vi.useFakeTimers();
    try {
      const startedAt = Date.now();
      type Out = Awaited<ReturnType<typeof runProjectionV2ForDate>>;
      let finishLate!: (value: Out) => void;
      vi.mocked(runProjectionV2ForDate).mockReturnValueOnce(new Promise<Out>((resolve) => { finishLate = resolve; }));
      const res = createMockRes();

      const answered = handler({ method: "GET", query: { date: "2026-10-22", bypassPreflight: "true", ...query } } as any, res);
      await vi.advanceTimersByTimeAsync(answerAfterMs - 1);
      expect(res.headersSent).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await answered;

      expect(vi.mocked(runProjectionV2ForDate).mock.calls[0]?.[1]).toMatchObject({ deadlineMs: startedAt + budgetMs });
      expect(res.statusCode).toBe(207);
      expect(res.body).not.toHaveProperty("error");
      expect(res.body).toMatchObject({
        success: false,
        operationStatus: "partial",
        timedOut: true,
        termination: { state: "resume_required", resumeRequired: true, nextStartDate: "2026-10-22" },
        resume: {
          required: true,
          reason: "runtime_budget",
          runId: null,
          completedGames: null,
          request: { date: "2026-10-22", horizonGames: "1", bypassPreflight: "true" },
        },
      });
      expect(auditInsertMock.mock.calls[0]?.[0]?.status).toBe("continued");

      // The abandoned work settles later without touching the answered response.
      finishLate({ runId: "run-late", gamesProcessed: 12, playerRowsUpserted: 0, teamRowsUpserted: 0, goalieRowsUpserted: 0, timedOut: false });
      await vi.advanceTimersByTimeAsync(0);
      expect(res.body.resume.runId).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers a stuck range date with the range timeout before the platform limit", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(runProjectionV2ForDate).mockReturnValueOnce(new Promise<never>(() => undefined));
      const res = createMockRes();

      const answered = handler({
        method: "GET",
        query: { startDate: "2026-10-22", endDate: "2026-10-23", bypassPreflight: "true" },
      } as any, res);
      await vi.advanceTimersByTimeAsync(225_000);
      await answered;

      expect(runProjectionV2ForDate).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        success: false,
        timedOut: true,
        nextStartDate: "2026-10-22",
        termination: { state: "resume_required", resumeRequired: true, nextStartDate: "2026-10-22" },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a succeeded run whose post-run snapshot save failed as succeeded, with a non-blocking warning", async () => {
    vi.mocked(runProjectionV2ForDate).mockResolvedValueOnce({
      runId: "run-3",
      gamesProcessed: 6,
      playerRowsUpserted: 216,
      teamRowsUpserted: 12,
      goalieRowsUpserted: 12,
      timedOut: false,
      postRunFailure: {
        step: "save_input_snapshot",
        message: "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 520: Web server is returning an unknown error</title></html>",
      },
    });
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-10-20", bypassPreflight: "true" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toHaveProperty("error");
    expect(res.body).toMatchObject({
      success: true,
      runId: "run-3",
      gamesProcessed: 6,
      termination: { state: "completed", resumeRequired: false },
      postRun: {
        step: "save_input_snapshot",
        status: "failed",
        blocking: false,
        dependencyError: { classification: "html_upstream_response" },
      },
      observability: {
        dataQualityWarnings: [expect.objectContaining({
          code: "post_run_step_failed",
          message: expect.stringContaining("Run for 2026-10-20 succeeded; post-run step save_input_snapshot failed (non-blocking)"),
        })],
      },
      scanSummary: { status: "ready", blockingIssueCount: 0 },
    });
    expect(auditInsertMock.mock.calls[0]?.[0]?.status).toBe("success");
  });

  it.each([
    ["resumes this scope's paused run: route preflight skipped", "h1:full", true],
    ["another scope's paused run: route preflight runs", "h5:full", false],
  ])("%s", async (_label, scopeKey, skipped) => {
    runningRunRows.push({
      run_id: "run-4",
      metrics: {
        resume: {
          version: "forge-run-resume-v1",
          scope_key: scopeKey,
          lease_owner: "earlier-call",
          lease_expires_at: "2026-10-17T10:00:00.000Z",
          completed_game_ids: [2026020101],
        },
      },
    });
    if (skipped) {
      vi.mocked(runProjectionV2ForDate).mockResolvedValueOnce({
        runId: "run-4",
        gamesProcessed: 3,
        playerRowsUpserted: 108,
        teamRowsUpserted: 6,
        goalieRowsUpserted: 6,
        timedOut: false,
      });
    }
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-10-17" } } as any, res);

    if (skipped) {
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ success: true, runId: "run-4", preflightSkipped: "resumed_run" });
      // The preflight's first read never happened; the run's own stage preflight still applies.
      expect(gamesSelectMock).not.toHaveBeenCalled();
      expect(runProjectionV2ForDate).toHaveBeenCalledTimes(1);
    } else {
      expect(res.statusCode).toBe(500);
      expect(res.body).not.toHaveProperty("preflightSkipped");
      expect(gamesSelectMock).toHaveBeenCalled();
      expect(runProjectionV2ForDate).not.toHaveBeenCalled();
    }
  });

  it("keeps a non-resumable timeout as an unsuccessful 200", async () => {
    vi.mocked(runProjectionV2ForDate).mockResolvedValueOnce({
      runId: "run-2",
      gamesProcessed: 1,
      playerRowsUpserted: 36,
      teamRowsUpserted: 2,
      goalieRowsUpserted: 2,
      timedOut: true,
    });
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-10-17", bypassPreflight: "true" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: false, error: "Timed out", termination: { state: "resume_required" } });
    expect(res.body).not.toHaveProperty("operationStatus");
    expect(auditInsertMock.mock.calls[0]?.[0]?.status).toBe("failure");
  });

  it("uses season rosters instead of current players.team_id to evaluate goalie assignment drift", () => {
    const result = summarizeGoalieRosterAssignments({
      latestGoaliesByTeam: new Map([
        [6, [101, 202]],
        [7, [101]],
      ]),
      goaliePlayers: [
        { id: 101, position: "G" },
        { id: 202, position: "G" },
      ],
      goalieRosters: [
        { playerId: 101, teamId: 6 },
        { playerId: 101, teamId: 7 },
        { playerId: 202, teamId: 8 },
      ],
    });

    expect(result).toEqual({
      goalieCandidatesChecked: 2,
      mismatchedAssignments: 1,
      nonGoaliePositionRows: 0,
    });
  });

  it("fails when even one actual PBP game lacks complete shift coverage", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 5,
        invalidShiftGames: 0,
        shiftRows: 191,
      }),
    ).toMatchObject({
      status: "FAIL",
      detail:
        "scheduled_recent_games=10, actual_pbp_games=6, shifted_actual_games=5, invalid_shift_games=0, shift_coverage=0.83, shift_rows=191",
    });
  });

  it("passes only when every actual PBP game has complete shift coverage", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 6,
        invalidShiftGames: 0,
        shiftRows: 220,
      }),
    ).toMatchObject({
      status: "PASS",
      detail:
        "scheduled_recent_games=10, actual_pbp_games=6, shifted_actual_games=6, invalid_shift_games=0, shift_coverage=1.00, shift_rows=220",
    });
  });

  it("fails projection ingest coverage when actual PBP games lack shift coverage", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 3,
        invalidShiftGames: 0,
        shiftRows: 120,
      }),
    ).toMatchObject({
      status: "FAIL",
      action:
        "Run /api/v1/db/ingest-projection-inputs for recent actual game dates.",
    });
  });

  it("fails closed when scheduled recent games have no terminal PBP evidence", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 8,
        actualPbpGames: 0,
        shiftedActualGames: 0,
        invalidShiftGames: 0,
        shiftRows: 0,
      }),
    ).toMatchObject({
      status: "FAIL",
      action: expect.stringContaining("complete terminal PBP evidence"),
    });
  });

  it("fails projection ingest coverage when any persisted shift game is invalid", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 6,
        invalidShiftGames: 1,
        shiftRows: 220,
      }),
    ).toMatchObject({ status: "FAIL" });
  });

  it("treats projection-derived freshness as not applicable on a zero-game slate", () => {
    expect(
      buildProjectionDerivedGate({
        scheduledGameCount: 0,
        playerLatest: null,
        teamLatest: null,
        goalieLatest: null,
      }),
    ).toEqual({
      gate_key: "projection_derived_v2",
      status: "PASS",
      detail:
        "No scheduled games on requested date; projection-derived freshness is not applicable.",
      action: "None.",
    });
  });

  it("retains the projection-derived blocker when a scheduled slate lacks inputs", () => {
    expect(
      buildProjectionDerivedGate({
        scheduledGameCount: 1,
        playerLatest: null,
        teamLatest: "2026-03-19",
        goalieLatest: "2026-03-19",
      }),
    ).toMatchObject({
      gate_key: "projection_derived_v2",
      status: "FAIL",
      detail:
        "player_latest=none, team_latest=2026-03-19, goalie_latest=2026-03-19",
    });
  });

  it("separates missing, stale, thin-role, and derived skater freshness failures", () => {
    const result = summarizeSkaterFreshnessCoverage({
      asOfDate: "2026-03-30",
      scheduledTeamIds: [1, 2, 3],
      recentLineCombosByTeam: new Map([
        [
          1,
          [
            {
              gameId: 101,
              forwards: Array.from({ length: 12 }, (_, index) => index + 1),
              defensemen: Array.from({ length: 6 }, (_, index) => index + 20),
              games: { date: "2026-03-29" },
            },
          ],
        ],
        [
          2,
          [
            {
              gameId: 102,
              forwards: [31, 32, 33, 34, 35, 36],
              defensemen: [41, 42],
              games: { date: "2026-03-01" },
            },
          ],
        ],
      ]),
      teamsWithRecentDerivedRows: new Set([1, 2]),
    });

    expect(result).toEqual({
      missingLineComboTeams: 1,
      softStaleLineComboTeams: 0,
      hardStaleLineComboTeams: 1,
      insufficientRoleCoverageTeams: 2,
      missingRecentDerivedTeams: 1,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

const {
  updateGamesMock,
  updateTeamsMock,
  updatePlayersMock,
  updateNstGamelogMock,
  updateWgoSkatersMock,
  updateWgoTotalsMock,
  updateWgoAveragesMock,
  updateLineCombinationsMock,
  updatePowerPlayCombinationsMock,
  updateRollingPlayerAveragesMock,
  ingestProjectionInputsMock,
  shiftChartsMock,
  buildProjectionDerivedMock,
  updateGoalieProjectionsV2Mock,
  runProjectionV2Mock,
  runProjectionAccuracyMock,
  auditInsertMock,
  gamesSelectMock,
  gamesGteMock,
  gamesLteMock,
  gamesOrderMock,
  lineCombosInMock,
  lineCombosSelectMock,
  pipelineStateRows,
  pipelineStateFrom,
  pipelineStateRpc
} = vi.hoisted(() => {
  // In-memory projection_pipeline_state with the lease rules of
  // advance_projection_pipeline_state_v1 that the pipeline relies on.
  const pipelineStateRows = new Map<string, any>();
  const rowKey = (pipeline: string, scope: string, operation: string) =>
    `${pipeline}|${scope}|${operation}`;
  const pipelineStateFrom = () => {
    const filters: Record<string, unknown> = {};
    const rows = () =>
      [...pipelineStateRows.values()].filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value)
      );
    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: any, reject: any) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject)
    };
    return query;
  };
  const pipelineStateRpc = vi.fn(async (_name: string, a: any) => {
    const key = rowKey(a.p_pipeline_key, a.p_scope_key, a.p_operation_key);
    const current = pipelineStateRows.get(key);
    const fail = (message: string) => ({ data: null, error: { message } });
    if (!current && (a.p_transition !== "acquire" || a.p_expected_revision !== 0)) {
      return fail("PROJECTION_PIPELINE_STATE_ABSENT");
    }
    if (current) {
      if (current.revision !== a.p_expected_revision) {
        return fail("PROJECTION_PIPELINE_REVISION_MISMATCH");
      }
      if (a.p_transition === "acquire" && current.status === "complete") {
        return { data: [current], error: null };
      }
      if (
        a.p_transition === "acquire" &&
        current.status === "running" &&
        Date.parse(current.lease_expires_at) > Date.now() &&
        current.lease_owner !== a.p_lease_owner
      ) {
        return fail("PROJECTION_PIPELINE_LEASE_HELD");
      }
      if (
        a.p_transition !== "acquire" &&
        (current.status !== "running" || current.lease_owner !== a.p_lease_owner)
      ) {
        return fail("PROJECTION_PIPELINE_LEASE_MISMATCH");
      }
      if (
        a.p_transition === "advance" &&
        current.cursor_game_id != null &&
        (a.p_next_cursor_game_id == null || a.p_next_cursor_game_id < current.cursor_game_id)
      ) {
        return fail("PROJECTION_PIPELINE_CURSOR_REGRESSION");
      }
    }
    const running = a.p_next_status === "running";
    const row = {
      pipeline_key: a.p_pipeline_key,
      scope_key: a.p_scope_key,
      operation_key: a.p_operation_key,
      revision: (current?.revision ?? 0) + 1,
      status: a.p_next_status,
      cursor_game_id: a.p_next_cursor_game_id,
      cursor_date: a.p_next_cursor_date,
      range_start_date: a.p_range_start_date,
      range_end_date: a.p_range_end_date,
      lease_owner: running ? a.p_lease_owner : null,
      lease_expires_at: running ? a.p_lease_expires_at : null,
      last_error: a.p_next_status === "failed" ? a.p_last_error : null,
      updated_at: new Date().toISOString()
    };
    pipelineStateRows.set(key, row);
    return { data: [row], error: null };
  });

  const successResponder = vi.fn(async (_req: any, res: any) => {
    res.status(200).json({ success: true });
  });
  const gamesOrderMock = vi.fn(async () => ({
    data: [{ id: 2025021023 }, { id: 2025021024 }],
    error: null
  }));
  const gamesLteMock = vi.fn(() => ({
    order: gamesOrderMock
  }));
  const gamesGteMock = vi.fn(() => ({
    lte: gamesLteMock
  }));
  const gamesSelectMock = vi.fn(() => ({
    gte: gamesGteMock
  }));
  // lineCombinations rows for the source date's games; both teams by default.
  const lineCombosInMock = vi.fn(async (_column: string, gameIds: number[]) => ({
    data: gameIds.flatMap((gameId) => [
      { gameId, teamId: 1 },
      { gameId, teamId: 2 }
    ]),
    error: null
  }));
  const lineCombosSelectMock = vi.fn(() => ({ in: lineCombosInMock }));
  return {
    updateGamesMock: vi.fn(successResponder),
    updateTeamsMock: vi.fn(successResponder),
    updatePlayersMock: vi.fn(successResponder),
    updateNstGamelogMock: vi.fn(successResponder),
    updateWgoSkatersMock: vi.fn(successResponder),
    updateWgoTotalsMock: vi.fn(successResponder),
    updateWgoAveragesMock: vi.fn(successResponder),
    updateLineCombinationsMock: vi.fn(successResponder),
    updatePowerPlayCombinationsMock: vi.fn(successResponder),
    updateRollingPlayerAveragesMock: vi.fn(successResponder),
    ingestProjectionInputsMock: vi.fn(successResponder),
    shiftChartsMock: vi.fn(successResponder),
    buildProjectionDerivedMock: vi.fn(successResponder),
    updateGoalieProjectionsV2Mock: vi.fn(successResponder),
    runProjectionV2Mock: vi.fn(successResponder),
    runProjectionAccuracyMock: vi.fn(successResponder),
    auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
    gamesSelectMock,
    gamesGteMock,
    gamesLteMock,
    gamesOrderMock,
    lineCombosInMock,
    lineCombosSelectMock,
    pipelineStateRows,
    pipelineStateFrom,
    pipelineStateRpc
  };
});

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) =>
      table === "cron_job_audit"
        ? { insert: auditInsertMock }
        : table === "projection_pipeline_state"
          ? pipelineStateFrom()
          : table === "lineCombinations"
            ? { select: lineCombosSelectMock }
            : { select: gamesSelectMock }
    ),
    rpc: pipelineStateRpc
  }
}));

vi.mock("../../../../../pages/api/v1/db/update-games", () => ({ default: updateGamesMock }));
vi.mock("../../../../../pages/api/v1/db/update-teams", () => ({ default: updateTeamsMock }));
vi.mock("../../../../../pages/api/v1/db/update-players", () => ({ default: updatePlayersMock }));
vi.mock("../../../../../pages/api/v1/db/update-nst-gamelog", () => ({ default: updateNstGamelogMock }));
vi.mock("../../../../../pages/api/v1/db/update-wgo-skaters", () => ({ default: updateWgoSkatersMock }));
vi.mock("../../../../../pages/api/v1/db/update-wgo-totals", () => ({ default: updateWgoTotalsMock }));
vi.mock("../../../../../pages/api/v1/db/update-wgo-averages", () => ({ default: updateWgoAveragesMock }));
vi.mock("../../../../../pages/api/v1/db/update-line-combinations", () => ({
  default: updateLineCombinationsMock
}));
vi.mock("../../../../../pages/api/v1/db/update-power-play-combinations", () => ({
  default: updatePowerPlayCombinationsMock
}));
vi.mock("../../../../../pages/api/v1/db/update-rolling-player-averages", () => ({
  default: updateRollingPlayerAveragesMock
}));
vi.mock("../../../../../pages/api/v1/db/ingest-projection-inputs", () => ({
  default: ingestProjectionInputsMock
}));
vi.mock("../../../../../pages/api/v1/db/shift-charts", () => ({
  default: shiftChartsMock
}));
vi.mock("../../../../../pages/api/v1/db/build-projection-derived-v2", () => ({
  default: buildProjectionDerivedMock
}));
vi.mock("../../../../../pages/api/v1/db/update-goalie-projections-v2", () => ({
  default: updateGoalieProjectionsV2Mock
}));
vi.mock("../../../../../pages/api/v1/db/run-projection-v2", () => ({ default: runProjectionV2Mock }));
vi.mock("../../../../../pages/api/v1/db/run-projection-accuracy", () => ({
  default: runProjectionAccuracyMock
}));

import handler, { __testables } from "../../../../../pages/api/v1/db/run-rolling-forge-pipeline";
import { readRollingForgeRunState, readRollingForgeStageKills, recordRollingForgeStageKill } from "lib/rollingForgePipelineRunState";

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

describe("/api/v1/db/run-rolling-forge-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    pipelineStateRows.clear();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "DELETE",
      query: {},
      url: "/api/v1/db/run-rolling-forge-pipeline"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["GET", "POST"]);
  });

  it("runs the daily incremental coordinator and reports stage-level results", async () => {
    const req: any = {
      method: "GET",
      query: {
        mode: "daily_incremental",
        date: "2026-03-14",
        includeAccuracy: "false"
      },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=2026-03-14"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateGamesMock).toHaveBeenCalled();
    expect(updateNstGamelogMock).toHaveBeenCalled();
    expect(updatePowerPlayCombinationsMock).toHaveBeenCalledTimes(1);
    expect(updatePowerPlayCombinationsMock.mock.calls[0]?.[0]?.query).toMatchObject({
      startDate: "2026-03-14",
      endDate: "2026-03-14"
    });
    expect(updateRollingPlayerAveragesMock).toHaveBeenCalled();
    expect(updateRollingPlayerAveragesMock.mock.calls[0]?.[0]?.query).toMatchObject({
      startDate: "2026-03-14",
      endDate: "2026-03-14",
      fastMode: "true",
      executionProfile: "daily_incremental"
    });
    expect(ingestProjectionInputsMock.mock.calls[0]?.[0]?.query).toMatchObject({
      startDate: "2026-02-28",
      endDate: "2026-03-14"
    });
    expect(shiftChartsMock.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      query: { gameId: "all" }
    });
    expect(buildProjectionDerivedMock.mock.calls[0]?.[0]?.query).toMatchObject({
      startDate: "2026-03-07",
      endDate: "2026-03-13"
    });
    expect(updateGoalieProjectionsV2Mock.mock.calls[0]?.[0]?.query).toEqual({
      limit: "7"
    });
    expect(runProjectionV2Mock).toHaveBeenCalled();
    expect(runProjectionAccuracyMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      mode: "daily_incremental",
      runtimeBudget: {
        budgetMs: 210000,
        budgetLabel: "03:30",
        durationMs: expect.any(Number),
        durationLabel: expect.any(String),
        withinBudget: true
      },
      executionControls: {
        includeDownstream: true,
        includeAccuracy: false,
        stopOnFailure: true
      },
      termination: {
        state: "completed",
        resumeRequired: false,
        nextStartDate: null
      },
      finalAudit: {
        owner: "withCronJobAudit",
        status: "persisted"
      },
      downstreamSummary: {
        stageId: "downstream_projection_consumers",
        includesLegacyStartChartMaterialization: false,
        legacyStartChartMaterializerRetired: true,
        includesAccuracyRefresh: false,
        canonicalSkaterReadPath: "/api/v1/start-chart -> forge_player_projections",
        legacyMaterializerRoute: null
      },
      compatibilityInventory: {
        version: "forge-compatibility-inventory-v2",
        removedShim: {
          legacyModulePath: "web/lib/projections/runProjectionV2.ts",
          canonicalModulePath: "web/lib/projections/run-forge-projections.ts",
          status: "removed"
        },
        duplicateReaders: expect.arrayContaining([
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/players",
            legacyRoute: "/api/v1/projections/players"
          }),
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/goalies",
            legacyRoute: "/api/v1/projections/goalies"
          })
        ]),
        transitionalRoutes: expect.arrayContaining([
          expect.objectContaining({
            route: "/api/v1/db/update-goalie-projections-v2",
            status: "canonical"
          })
        ]),
        retiredRoutes: expect.arrayContaining([
          expect.objectContaining({
            route: "/api/v1/db/update-start-chart-projections",
            status: "retired"
          })
        ]),
        goalieStartTable: {
          decisionVersion: "goalie-start-ownership-v1",
          table: "goalie_start_projections",
          decision: "retain_shared_table_name_for_now",
          canonicalWriterRoute: "/api/v1/db/update-goalie-projections-v2",
          canonicalWriterStatus: "single_writer",
          renameDeferred: true
        }
      },
      scanSummary: {
        surface: "rolling_forge_pipeline_operator",
        requestedDate: "2026-03-14",
        activeDataDate: "2026-03-14",
        fallbackApplied: false,
        status: "ready",
        rowCounts: {
          rollingPlayerRowsUpserted: 0,
          projectionPlayerRowsUpserted: 0,
          projectionTeamRowsUpserted: 0,
          projectionGoalieRowsUpserted: 0,
          accuracyRowsUpserted: 0
        },
        blockingIssueCount: 0
      },
      dependencyContract: {
        version: "rolling-forge-operator-order-v2",
        healthyRunRule: expect.any(String),
        validationRule: expect.any(String),
        stages: expect.arrayContaining([
          expect.objectContaining({ id: "core_entity_freshness", order: 1 }),
          expect.objectContaining({ id: "upstream_skater_sources", order: 2 }),
          expect.objectContaining({ id: "contextual_builders", order: 3 }),
          expect.objectContaining({ id: "rolling_player_recompute", order: 4 }),
          expect.objectContaining({ id: "projection_input_ingest", order: 5 }),
          expect.objectContaining({
            id: "projection_relationship_build",
            order: 6
          }),
          expect.objectContaining({ id: "projection_derived_build", order: 7 }),
          expect.objectContaining({ id: "projection_execution", order: 8 })
        ])
      },
      pipeline: {
        version: "rolling-forge-pipeline-v4"
      }
    });
    expect(res.body.stages.map((stage: any) => stage.id)).toEqual([
      "core_entity_freshness",
      "upstream_skater_sources",
      "contextual_builders",
      "rolling_player_recompute",
      "projection_input_ingest",
      "projection_relationship_build",
      "projection_derived_build",
      "projection_execution",
      "downstream_projection_consumers",
      "monitoring"
    ]);
  });

  it("lets the implicit Vercel schedule use the durable projection backlog", async () => {
    const req: any = {
      method: "GET",
      query: {
        mode: "daily_incremental",
        includeAccuracy: "false",
        stopOnFailure: "false"
      },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&includeAccuracy=false&stopOnFailure=false"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(ingestProjectionInputsMock).toHaveBeenCalledTimes(1);
    expect(ingestProjectionInputsMock.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      query: {}
    });
    expect(ingestProjectionInputsMock.mock.calls[0]?.[0]?.query).not.toHaveProperty(
      "startDate"
    );
    expect(ingestProjectionInputsMock.mock.calls[0]?.[0]?.query).not.toHaveProperty(
      "maxGames"
    );
    expect(shiftChartsMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      ingestProjectionInputsMock.mock.invocationCallOrder[0]
    );
    expect(buildProjectionDerivedMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      shiftChartsMock.mock.invocationCallOrder[0]
    );
    expect(buildProjectionDerivedMock.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      query: {}
    });
    // The schedule forces stopOnFailure; the receipt says so instead of echoing it as requested.
    expect(res.body.executionControls).toMatchObject({
      stopOnFailure: true,
      stopOnFailureRequested: false
    });
  });

  it("fails the implicit schedule closed before derived work when relationships fail", async () => {
    shiftChartsMock.mockImplementationOnce(async (_req: any, res: any) => {
      res.status(500).json({ success: false, message: "relationship failed" });
    });
    const req: any = {
      method: "GET",
      query: {
        mode: "daily_incremental",
        stopOnFailure: "false"
      },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&stopOnFailure=false"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(207);
    expect(ingestProjectionInputsMock).toHaveBeenCalledTimes(1);
    expect(shiftChartsMock).toHaveBeenCalledTimes(1);
    expect(buildProjectionDerivedMock).not.toHaveBeenCalled();
    expect(runProjectionV2Mock).not.toHaveBeenCalled();
    expect(res.body.executionControls.stopOnFailure).toBe(true);
    expect(
      res.body.stages.find(
        (stage: any) => stage.id === "projection_derived_build"
      )
    ).toMatchObject({ status: "skipped" });
  });

  it.each(["legacy", "busy", "dependency", "malformed"])("stops after a blocking failure and retains bounded audit context: %s", async (kind) => {
    const firstError = { gameId: 2026010056, stage: "capture_raw_sources", message: "INVALID_PROJECTION_RAW_SHIFT_ROWS",
      ...(kind === "busy" ? { message: "NHL_NORMALIZATION_WRITER_BUSY", code: "P0001", endpoint: "shiftcharts", attempts: 2 } : {}),
      ...(kind === "malformed" ? { code: 1, endpoint: {}, attempts: -1 } : {}) };
    const childReceipt = { success: false, pipeline: { verbose: "x".repeat(6000) },
      errors: [firstError, { gameId: 2026010057, stage: "persist_inputs", message: "second failure" }],
      ...(kind === "dependency" ? { dependencyError: { classification: "html_upstream_response", detail: "original detail" } } : {}),
      message: "rolling failed" };
    updateRollingPlayerAveragesMock.mockImplementationOnce(
      async (_req: any, res: any) => {
        res.status(500).json(childReceipt);
      }
    );

    const req: any = {
      method: "GET",
      query: {
        mode: "daily_incremental",
        date: "2026-03-14"
      },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=2026-03-14"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(207);
    expect(res.body.failureSummary).toMatchObject({ failedStepCount: 1,
      firstFailure: { gameId: 2026010056, stage: "capture_raw_sources",
        error: firstError.message, reportedErrorCount: 2, statusCode: 500,
        code: kind === "busy" ? "P0001" : null, endpoint: kind === "busy" ? "shiftcharts" : null,
        attempts: kind === "busy" ? 2 : null, classification: kind === "dependency" ? "html_upstream_response" : null } });
    const auditPrefix = JSON.stringify(res.body).slice(0, 4000);
    expect(auditPrefix).toContain(firstError.message);
    expect(auditPrefix).toContain("2026010056");
    if (kind === "busy") {
      expect(auditPrefix).toContain('"code":"P0001"');
      expect(auditPrefix).toContain('"endpoint":"shiftcharts"');
      expect(auditPrefix).toContain('"attempts":2');
    }
    if (kind === "dependency") expect(auditPrefix).toContain('"classification":"html_upstream_response"');
    expect(res.body.stages.find((stage: any) => stage.id === "rolling_player_recompute").steps[0].summary).toEqual(childReceipt);
    expect(runProjectionV2Mock).not.toHaveBeenCalled();
    expect(res.body.success).toBe(false);
    expect(
      res.body.stages.find(
        (stage: any) => stage.id === "rolling_player_recompute"
      ).status
    ).toBe("failed");
    expect(
      res.body.stages.find(
        (stage: any) => stage.id === "projection_input_ingest"
      ).status
    ).toBe("skipped");
  });

  it("uses the overnight execution profile for the rolling recompute stage", async () => {
    const req: any = {
      method: "GET",
      query: {
        mode: "overnight",
        startDate: "2026-03-10",
        endDate: "2026-03-14",
        includeDownstream: "false",
        includeAccuracy: "false"
      },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=overnight&startDate=2026-03-10&endDate=2026-03-14"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateRollingPlayerAveragesMock.mock.calls[0]?.[0]?.query).toMatchObject({
      startDate: "2026-03-10",
      endDate: "2026-03-14",
      fastMode: "true",
      executionProfile: "overnight"
    });
    expect(res.body).toMatchObject({
      mode: "overnight",
      runtimeBudget: {
        budgetMs: 5400000,
        budgetLabel: "90:00",
        durationMs: expect.any(Number),
        durationLabel: expect.any(String),
        withinBudget: true
      }
    });
  });

  it("does not include retired support-only WGO routes in the upstream stage", async () => {
    const req: any = {
      method: "GET",
      query: {
        mode: "overnight",
        date: "2026-03-14"
      },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=overnight&date=2026-03-14"
    };
    const res = createMockRes();

    await handler(req, res);

    const stage = res.body.stages.find(
      (entry: any) => entry.id === "upstream_skater_sources"
    );

    expect(stage?.steps.map((step: any) => step.route)).not.toContain(
      "/api/v1/db/update-wgo-ly"
    );
    expect(stage?.steps.map((step: any) => step.route)).not.toContain(
      "/api/v1/db/update-wgo-averages"
    );
  });

  it("keeps the downstream stage accuracy-only after retiring the legacy start-chart materializer", async () => {
    const req: any = {
      method: "GET",
      query: {
        mode: "daily_incremental",
        date: "2026-03-14",
        includeAccuracy: "true"
      },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=2026-03-14&includeAccuracy=true"
    };
    const res = createMockRes();

    await handler(req, res);

    const stage = res.body.stages.find(
      (entry: any) => entry.id === "downstream_projection_consumers"
    );

    expect(runProjectionAccuracyMock).toHaveBeenCalledTimes(1);
    expect(stage?.steps).toEqual([
      expect.objectContaining({
        id: "run-projection-accuracy",
        route: "/api/v1/db/run-projection-accuracy",
        status: "success"
      })
    ]);
  });

  describe("resumable scheduled run", () => {
    const scheduledUrl =
      "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&includeDownstream=true&includeAccuracy=false&stopOnFailure=false";
    const invokeScheduled = async (at: string) => {
      vi.setSystemTime(new Date(at));
      const req: any = {
        method: "GET",
        query: {
          mode: "daily_incremental",
          includeDownstream: "true",
          includeAccuracy: "false",
          stopOnFailure: "false"
        },
        url: scheduledUrl
      };
      const res = createMockRes();
      await handler(req, res);
      return res;
    };
    const slowSuccess = (ms: number) => async (_req: any, res: any) => {
      vi.setSystemTime(Date.now() + ms);
      res.status(200).json({ success: true });
    };
    const stageStatus = (res: any, id: string) =>
      res.body.stages.find((stage: any) => stage.id === id);
    const nstStageRow = () =>
      [...pipelineStateRows.values()].find((row) => row.operation_key === "upstream_skater_sources");

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
    });

    it("completes every stage in order across several invocations, continuing a partial rolling step", async () => {
      updatePlayersMock.mockImplementationOnce(slowSuccess(60_000));
      updateWgoTotalsMock.mockImplementationOnce(slowSuccess(40_000));
      updateRollingPlayerAveragesMock.mockImplementationOnce(
        async (_req: any, res: any) => {
          res.status(207).json({
            success: false,
            operationStatus: "partial",
            resume: {
              required: true,
              nextResumeFrom: 8478402,
              request: { startDate: "2026-10-18", resumeFrom: 8478402 }
            }
          });
        }
      );

      // 1: two slow stages spend the start budget; the rest wait.
      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
      expect(first.statusCode).toBe(207);
      expect(first.body.success).toBe(false);
      expect(first.body.termination).toMatchObject({
        state: "continuation_required",
        resumeRequired: true,
        runKey: "daily_incremental:2026-10-19",
        nextStageId: "contextual_builders",
        reason: "runtime_budget",
        stagesRun: 2
      });
      expect(stageStatus(first, "upstream_skater_sources").status).toBe("success");
      expect(stageStatus(first, "contextual_builders").status).toBe("pending");
      expect(updateLineCombinationsMock).not.toHaveBeenCalled();

      // 2: the rolling step stops at its budget; that is a continuation, not a failure.
      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
      expect(second.statusCode).toBe(207);
      expect(second.body.termination).toMatchObject({
        state: "continuation_required",
        nextStageId: "rolling_player_recompute",
        reason: "stage_partial",
        rollingResumeFrom: 8478402
      });
      expect(second.body.failureSummary).toMatchObject({
        failedStepCount: 0,
        firstFailure: null
      });
      expect(stageStatus(second, "core_entity_freshness")).toMatchObject({
        status: "success",
        completedEarlier: true
      });
      expect(stageStatus(second, "rolling_player_recompute").status).toBe("partial");
      expect(stageStatus(second, "projection_input_ingest").status).toBe("pending");
      expect(updateGamesMock).toHaveBeenCalledTimes(1);
      expect(ingestProjectionInputsMock).not.toHaveBeenCalled();
      const firstRollingQuery =
        updateRollingPlayerAveragesMock.mock.calls[0]?.[0]?.query;
      expect(firstRollingQuery).toMatchObject({
        startDate: "2026-10-18",
        endDate: "2026-10-18",
        executionProfile: "daily_incremental"
      });
      expect(Number(firstRollingQuery.maxRuntimeMs)).toBeGreaterThanOrEqual(30_000);
      expect(Number(firstRollingQuery.maxRuntimeMs)).toBeLessThanOrEqual(180_000);
      expect(firstRollingQuery).not.toHaveProperty("resumeFrom");

      // 3: the rolling step resumes after its cursor and the run completes.
      const third = await invokeScheduled("2026-10-19T10:15:00.000Z");
      expect(third.statusCode).toBe(200);
      expect(third.body.success).toBe(true);
      expect(third.body.termination).toMatchObject({
        state: "completed",
        resumeRequired: false,
        nextStageId: null
      });
      expect(updateRollingPlayerAveragesMock.mock.calls[1]?.[0]?.query).toMatchObject({
        startDate: "2026-10-18",
        endDate: "2026-10-18",
        resumeFrom: "8478402"
      });
      const projectionQuery = runProjectionV2Mock.mock.calls[0]?.[0]?.query;
      expect(Object.keys(projectionQuery).sort()).toEqual(["date", "maxDurationMs"]);
      expect(projectionQuery.date).toBe("2026-10-19");
      expect(Number(projectionQuery.maxDurationMs)).toBeGreaterThanOrEqual(30_000);
      expect(Number(projectionQuery.maxDurationMs)).toBeLessThanOrEqual(180_000);
      const order = [
        updateGamesMock,
        updateNstGamelogMock,
        updateWgoTotalsMock,
        updateLineCombinationsMock,
        updateRollingPlayerAveragesMock,
        ingestProjectionInputsMock,
        shiftChartsMock,
        buildProjectionDerivedMock,
        updateGoalieProjectionsV2Mock,
        runProjectionV2Mock
      ].flatMap((mock) => mock.mock.invocationCallOrder);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      // The projection runs the run date and then the next day.
      expect(order).toHaveLength(12);
      expect(runProjectionV2Mock.mock.calls.map((call: any[]) => call[0].query.date)).toEqual(["2026-10-19", "2026-10-20"]);

      // 4: a later scheduled call finds the run complete and does no work.
      const fourth = await invokeScheduled("2026-10-19T10:20:00.000Z");
      expect(fourth.statusCode).toBe(200);
      expect(fourth.body.termination).toMatchObject({
        state: "completed",
        stagesRun: 0
      });
      expect(updateGamesMock).toHaveBeenCalledTimes(1);
      expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
    });

    // The scheduled run's NST deadline: its 180 s budget less 20 s of audit headroom.
    const nstDeadline = (at: string) => String(Date.parse(at) + 180_000 - 20_000);
    const nstQuery = (at: string, extra: Record<string, string> = {}) => ({
      runMode: "incremental", startDate: "2026-10-18", endDate: "2026-10-18", ...extra, deadlineAt: nstDeadline(at)
    });

    it("points the source steps at the last completed date, not the run date", async () => {
      const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

      expect(res.statusCode).toBe(200);
      expect(res.body.dateWindow).toMatchObject({ date: "2026-10-19", sourceStartDate: "2026-10-18", sourceEndDate: "2026-10-18" });
      expect(updateNstGamelogMock.mock.calls[0]?.[0]?.query).toEqual(nstQuery("2026-10-19T10:05:00.000Z"));
      expect(updateWgoSkatersMock.mock.calls[0]?.[0]?.query).toEqual({ action: "all", startDate: "2026-10-18" });
      expect(updateWgoTotalsMock.mock.calls[0]?.[0]?.query).toEqual({ season: "current" });
      // Power-play combinations come from played games: yesterday's slate, not today's.
      expect(gamesGteMock).toHaveBeenCalledWith("date", "2026-10-18");
      expect(gamesLteMock).toHaveBeenCalledWith("date", "2026-10-18");
      expect(updatePowerPlayCombinationsMock.mock.calls[0]?.[0]?.query).toEqual({ startDate: "2026-10-18", endDate: "2026-10-18" });
      // The projection itself is still for the run date.
      expect(runProjectionV2Mock.mock.calls[0]?.[0]?.query?.date).toBe("2026-10-19");
    });

    describe("NST step resume (agreed contract; inactive until Codex ships it)", () => {
      const continuation = (cursor: string, overrides: Record<string, string> = {}) =>
        async (req: any, res: any) => {
          res.status(207).json({
            success: false,
            operationStatus: "continuation_required",
            resume: { required: true, request: { query: { ...req.query, cursor, deadlineAt: "1", ...overrides } } }
          });
        };
      const reply = (status: number, body: Record<string, unknown>) => async (_req: any, res: any) => {
        res.status(status).json(body);
      };
      beforeEach(() => {
        __testables.nstStepResume.enabled = true;
      });
      afterEach(() => {
        __testables.nstStepResume.enabled = false;
        updateNstGamelogMock.mockReset();
      });

      it("pauses on a continuation, replays its query with a fresh deadline, and runs WGO only once NST finishes", async () => {
        updateNstGamelogMock
          .mockImplementationOnce(continuation("7"))
          .mockImplementationOnce(continuation("15"));

        const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expect(first.statusCode).toBe(207);
        expect(first.body.termination).toMatchObject({
          state: "continuation_required", reason: "stage_partial", nextStageId: "upstream_skater_sources"
        });
        expect(first.body.failureSummary).toMatchObject({ failedStepCount: 0 });
        expect(stageStatus(first, "upstream_skater_sources").status).toBe("partial");
        expect(stageStatus(first, "contextual_builders").status).toBe("pending");
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(updateWgoTotalsMock).not.toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "failed", last_error: "stage_handoff", cursor_game_id: 7 });

        const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
        expect(updateNstGamelogMock.mock.calls[1]?.[0]?.query).toEqual(nstQuery("2026-10-19T10:10:00.000Z", { cursor: "7" }));
        expect(second.body.termination).toMatchObject({ reason: "stage_partial", nextStageId: "upstream_skater_sources" });
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "failed", last_error: "stage_handoff", cursor_game_id: 15 });

        const third = await invokeScheduled("2026-10-19T10:15:00.000Z");
        expect(updateNstGamelogMock.mock.calls[2]?.[0]?.query).toEqual(nstQuery("2026-10-19T10:15:00.000Z", { cursor: "15" }));
        expect(updateNstGamelogMock).toHaveBeenCalledTimes(3);
        expect(updateWgoSkatersMock).toHaveBeenCalledTimes(1);
        expect(updateWgoTotalsMock).toHaveBeenCalledTimes(1);
        expect(updateWgoSkatersMock.mock.invocationCallOrder[0]).toBeGreaterThan(updateNstGamelogMock.mock.invocationCallOrder[2]);
        expect(nstStageRow()).toMatchObject({ status: "complete" });
        expect(third.statusCode).toBe(200);
        expect(third.body.termination).toMatchObject({ state: "completed" });
      });

      it("advances to WGO on the expected no-completed-games skip", async () => {
        updateNstGamelogMock.mockImplementationOnce(reply(200, { success: true, operationStatus: "skipped_no_completed_games" }));

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(res, "upstream_skater_sources").steps.map((step: any) => [step.id, step.status])).toEqual([
          ["update-nst-gamelog", "skipped"], ["update-wgo-skaters", "success"], ["update-wgo-totals", "success"],
        ]);
        expect(nstStageRow()).toMatchObject({ status: "complete" });
      });

      it.each([
        ["a provider failure (>= 400)", reply(503, { success: false, classification: "rate_limited" })],
        ["incomplete work (200, success false)", reply(200, { success: false, message: "Incomplete NST work; inspect source outcomes and deferred URLs." })],
        ["a 207 that is not a continuation", reply(207, { success: false, operationStatus: "partial" })],
        ["a cursor that is not positive", continuation("0")],
        ["a non-integer cursor", continuation("7.5")],
        ["a missing cursor", async (req: any, res: any) => {
          res.status(207).json({ success: false, operationStatus: "continuation_required",
            resume: { required: true, request: { query: { ...req.query } } } });
        }],
        ["a query whose scope differs from the one sent", continuation("7", { startDate: "2026-10-19" })],
        ["a query with a field this pipeline did not send", continuation("7", { datasetGroup: "skaters" })],
        ["no replayable query", reply(207, { success: false, operationStatus: "continuation_required", resume: { required: true, request: {} } })],
      ])("blocks on %s: the step fails, nothing advances and WGO does not run", async (_label, responder) => {
        updateNstGamelogMock.mockImplementationOnce(responder);

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(res, "upstream_skater_sources").steps.map((step: any) => [step.id, step.status])).toEqual([
          ["update-nst-gamelog", "failed"],
        ]);
        expect(res.body.termination).toMatchObject({ state: "stopped_on_blocking_failure", reason: "retry_on_next_invocation" });
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "failed", cursor_game_id: null });
      });

      it("blocks a resumed step whose cursor does not increase, keeping the stored cursor", async () => {
        updateNstGamelogMock
          .mockImplementationOnce(continuation("7"))
          .mockImplementationOnce(continuation("7"));

        await invokeScheduled("2026-10-19T10:05:00.000Z");
        expect(nstStageRow()).toMatchObject({ status: "failed", last_error: "stage_handoff", cursor_game_id: 7 });
        const second = await invokeScheduled("2026-10-19T10:10:00.000Z");

        expect(updateNstGamelogMock.mock.calls[1]?.[0]?.query).toMatchObject({ cursor: "7" });
        expect(stageStatus(second, "upstream_skater_sources").steps.map((step: any) => [step.id, step.status])).toEqual([
          ["update-nst-gamelog", "failed"],
        ]);
        expect(second.body.termination).toMatchObject({ state: "stopped_on_blocking_failure" });
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "failed", cursor_game_id: 7 });
      });

      it("does not advance when the cursor cannot be stored: the next invocation repeats from the last stored cursor", async () => {
        const original = pipelineStateRpc.getMockImplementation()!;
        let failedAdvance = false;
        pipelineStateRpc.mockImplementation(async (name: string, a: any) => {
          if (a.p_transition === "advance" && !failedAdvance) {
            failedAdvance = true;
            return { data: null, error: { message: "fetch failed" } };
          }
          return original(name, a);
        });
        try {
          updateNstGamelogMock.mockImplementationOnce(continuation("7"));
          const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
          expect(first.body.termination).toMatchObject({ state: "continuation_required", reason: "state_error", nextStageId: "upstream_skater_sources" });
          expect(updateWgoSkatersMock).not.toHaveBeenCalled();
          expect(nstStageRow()).toMatchObject({ status: "running", cursor_game_id: null });

          // After the lease frees, NST repeats from the stored (empty) cursor.
          await invokeScheduled("2026-10-19T10:15:00.000Z");
          expect(updateNstGamelogMock.mock.calls[1]?.[0]?.query).toEqual(nstQuery("2026-10-19T10:15:00.000Z"));
          expect(updateWgoSkatersMock).toHaveBeenCalledTimes(1);
        } finally {
          pipelineStateRpc.mockImplementation(original);
        }
      });
    });

    describe("an NST source outage degrades the day instead of blocking it", () => {
      // The route answered (200) but the source left dates unresolved, as when NST returns 521s.
      const outage = { success: false, operationStatus: "blocked",
        message: "Incomplete NST work; inspect source outcomes and deferred URLs.",
        nstProgress: { sourceOutcomes: { unresolvedCount: 1,
          counts: { rows_persisted: 0, fetch_or_write_failed: 1 } } } };
      afterEach(() => {
        updateNstGamelogMock.mockReset();
        __testables.nstStepResume.enabled = false;
      });

      it.each([false, true])("with NST step resume %s: WGO and the later stages run, and the response names the degraded step", async (resumeEnabled) => {
        __testables.nstStepResume.enabled = resumeEnabled;
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => { res.status(200).json(outage); });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        const upstream = stageStatus(res, "upstream_skater_sources");
        expect(upstream.steps.map((step: any) => [step.id, step.status])).toEqual([
          ["update-nst-gamelog", "skipped"], ["update-wgo-skaters", "success"], ["update-wgo-totals", "success"],
        ]);
        expect(upstream.status).toBe("success");
        expect(upstream.steps[0]).toMatchObject({ degraded: "nst_source_unavailable",
          reason: expect.stringContaining("NST source unavailable") });
        expect(res.body.failureSummary).toMatchObject({ failedStepCount: 0,
          degradedSteps: [{ stageId: "upstream_skater_sources", stepId: "update-nst-gamelog", code: "nst_source_unavailable" }] });
        expect(updateRollingPlayerAveragesMock).toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "complete" });
      });

      it("degrades the route's 503 source_down answer (NST 520-527) the same way", async () => {
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => {
          res.status(503).json({ ...outage, operationStatus: "source_down" });
        });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        const upstream = stageStatus(res, "upstream_skater_sources");
        expect(upstream.steps.map((step: any) => [step.id, step.status])).toEqual([
          ["update-nst-gamelog", "skipped"], ["update-wgo-skaters", "success"], ["update-wgo-totals", "success"],
        ]);
        expect(upstream.status).toBe("success");
        expect(upstream.steps[0]).toMatchObject({ statusCode: 503, degraded: "nst_source_unavailable" });
        expect(updateRollingPlayerAveragesMock).toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "complete" });
      });

      it("still blocks a 503 that is not a source_down answer", async () => {
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => { res.status(503).json(outage); });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(res, "upstream_skater_sources").status).toBe("failed");
        expect(res.body.termination).toMatchObject({ state: "stopped_on_blocking_failure" });
        expect(res.body.failureSummary.degradedSteps).toEqual([]);
      });

      it("still blocks when the NST route itself errors", async () => {
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => {
          res.status(500).json({ ...outage, error: "database write failed" });
        });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(res, "upstream_skater_sources").status).toBe("failed");
        expect(res.body.termination).toMatchObject({ state: "stopped_on_blocking_failure" });
        expect(res.body.failureSummary.degradedSteps).toEqual([]);
      });
    });

    describe("while NST step resume is inactive, today's NST responses behave as before", () => {
      afterEach(() => updateNstGamelogMock.mockReset());

      it.each([
        ["success", 200, { success: true, message: "Done" }, "success"],
        ["incomplete work", 200, { success: false, message: "Incomplete NST work; inspect source outcomes and deferred URLs." }, "failed"],
        ["an error", 500, { success: false, error: "boom" }, "failed"],
        ["a continuation", 207, { success: false, operationStatus: "continuation_required",
          resume: { required: true, request: { query: { runMode: "incremental", startDate: "2026-10-18", endDate: "2026-10-18", cursor: "7" } } } }, "failed"],
      ])("%s: WGO still runs and nothing is stored", async (_label, status, body, stepStatus) => {
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => { res.status(status).json(body); });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(res, "upstream_skater_sources").steps.map((step: any) => [step.id, step.status])).toEqual([
          ["update-nst-gamelog", stepStatus], ["update-wgo-skaters", "success"], ["update-wgo-totals", "success"],
        ]);
        expect(updateNstGamelogMock.mock.calls[0]?.[0]?.query).not.toHaveProperty("cursor");
        expect(nstStageRow()?.cursor_game_id ?? null).toBeNull();
      });
    });

    it("stops on a real stage failure, retries it once on the next invocation, then stays stopped", async () => {
      const failRelationships = async (_req: any, res: any) => {
        res.status(500).json({ success: false, message: "relationship failed" });
      };
      shiftChartsMock
        .mockImplementationOnce(failRelationships)
        .mockImplementationOnce(failRelationships);

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
      expect(first.statusCode).toBe(207);
      expect(first.body.termination).toMatchObject({
        state: "stopped_on_blocking_failure",
        resumeRequired: true,
        nextStageId: "projection_relationship_build",
        reason: "retry_on_next_invocation"
      });
      expect(first.body.failureSummary.failedStepCount).toBe(1);
      expect(stageStatus(first, "projection_derived_build").status).toBe("skipped");
      expect(buildProjectionDerivedMock).not.toHaveBeenCalled();

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
      expect(second.statusCode).toBe(207);
      expect(shiftChartsMock).toHaveBeenCalledTimes(2);
      expect(ingestProjectionInputsMock).toHaveBeenCalledTimes(1);
      expect(second.body.termination).toMatchObject({
        state: "stopped_on_blocking_failure",
        resumeRequired: false,
        reason: "attempts_exhausted"
      });

      const third = await invokeScheduled("2026-10-19T10:15:00.000Z");
      expect(third.statusCode).toBe(207);
      expect(third.body.success).toBe(false);
      expect(shiftChartsMock).toHaveBeenCalledTimes(2);
      expect(stageStatus(third, "projection_relationship_build")).toMatchObject({
        status: "failed",
        completedEarlier: true
      });
      expect(second.body.failureSummary).toMatchObject({
        failedStepCount: 1,
        // The terminal code replaces the child's; the step error stays.
        firstFailure: { stageId: "projection_relationship_build", stepId: "build-projection-relationships",
          code: "attempts_exhausted", error: "relationship failed" },
        terminalStop: { code: "attempts_exhausted", stageId: "projection_relationship_build" }
      });
      expect(third.body.failureSummary).toMatchObject({
        failedStepCount: 0,
        firstFailure: { stageId: "projection_relationship_build", stepId: null, code: "attempts_exhausted",
          error: "Failed 2 time(s) in earlier invocations of this run; not retried." },
        terminalStop: { code: "attempts_exhausted", stageId: "projection_relationship_build" }
      });
      expect(first.body.failureSummary.terminalStop).toBeNull();
      expect(runProjectionV2Mock).not.toHaveBeenCalled();
    });

    it("resumes a partial projection run on later invocations without using failed attempts", async () => {
      const partialProjection = async (_req: any, res: any) => {
        vi.setSystemTime(Date.now() + 150_000);
        res.status(207).json({
          success: false,
          operationStatus: "partial",
          resume: {
            required: true,
            reason: "runtime_budget",
            request: { date: "2026-10-19", horizonGames: "1" }
          }
        });
      };
      // More partial calls than MAX_BLOCKING_STAGE_ATTEMPTS: none counts as a failure.
      runProjectionV2Mock
        .mockImplementationOnce(partialProjection)
        .mockImplementationOnce(partialProjection)
        .mockImplementationOnce(partialProjection);

      for (const at of ["10:05", "10:10", "10:15"]) {
        const res = await invokeScheduled(`2026-10-19T${at}:00.000Z`);
        expect(res.statusCode).toBe(207);
        expect(res.body.termination).toMatchObject({
          state: "continuation_required",
          resumeRequired: true,
          nextStageId: "projection_execution",
          reason: "stage_partial"
        });
        expect(res.body.failureSummary).toMatchObject({ failedStepCount: 0, firstFailure: null });
        expect(stageStatus(res, "projection_execution").status).toBe("partial");
        expect(stageStatus(res, "downstream_projection_consumers").status).toBe("pending");
        const projectionState = pipelineStateRows.get(
          "rolling_forge_pipeline|daily_incremental:2026-10-19|projection_execution"
        );
        expect(projectionState).toMatchObject({ status: "failed", last_error: "stage_handoff" });
      }
      // Each call gets the time left in its invocation, after the earlier stages.
      for (const call of runProjectionV2Mock.mock.calls) {
        expect(Number(call[0].query.maxDurationMs)).toBeLessThanOrEqual(180_000);
      }

      const done = await invokeScheduled("2026-10-19T10:20:00.000Z");
      expect(done.statusCode).toBe(200);
      expect(done.body.termination).toMatchObject({ state: "completed" });
      // Three partial calls for the run date, then its completion and the next day.
      expect(runProjectionV2Mock).toHaveBeenCalledTimes(5);
      expect(runProjectionV2Mock.mock.calls.map((call: any[]) => call[0].query.date)).toEqual([
        "2026-10-19", "2026-10-19", "2026-10-19", "2026-10-19", "2026-10-20"
      ]);
      expect(updateGamesMock).toHaveBeenCalledTimes(1);
      expect(
        auditInsertMock.mock.calls.map((call: any[]) => call[0]?.status)
      ).toEqual(["continued", "continued", "continued", "success"]);
    });

    it("does not run a stage another invocation holds", async () => {
      pipelineStateRows.set(
        "rolling_forge_pipeline|daily_incremental:2026-10-19|core_entity_freshness",
        {
        pipeline_key: "rolling_forge_pipeline",
        scope_key: "daily_incremental:2026-10-19",
        operation_key: "core_entity_freshness",
        revision: 1,
        status: "running",
        cursor_game_id: null,
        cursor_date: "2026-10-19",
        range_start_date: "2026-10-19",
        range_end_date: "2026-10-19",
        lease_owner: "other-invocation",
        lease_expires_at: "2026-10-19T10:08:00.000Z",
        last_error: null,
        updated_at: "2026-10-19T10:04:00.000Z"
        }
      );

      const res = await invokeScheduled("2026-10-19T10:05:30.000Z");

      expect(res.statusCode).toBe(207);
      expect(res.body.termination).toMatchObject({
        state: "continuation_required",
        reason: "stage_in_progress_elsewhere",
        nextStageId: "core_entity_freshness"
      });
      expect(updateGamesMock).not.toHaveBeenCalled();
    });

    const stageKey = (stageId: string) =>
      `rolling_forge_pipeline|daily_incremental:2026-10-19|${stageId}`;
    const seedStageRow = (stageId: string, overrides: Record<string, unknown>) => {
      pipelineStateRows.set(stageKey(stageId), {
        pipeline_key: "rolling_forge_pipeline",
        scope_key: "daily_incremental:2026-10-19",
        operation_key: stageId,
        revision: 1,
        status: "complete",
        cursor_game_id: null,
        cursor_date: "2026-10-19",
        range_start_date: "2026-10-19",
        range_end_date: "2026-10-19",
        lease_owner: null,
        lease_expires_at: null,
        last_error: null,
        updated_at: "2026-10-19T10:04:00.000Z",
        ...overrides
      });
    };
    // A rolling chunk that takes `ms` and reports where the next one starts.
    const rollingChunk = (args: {
      ms: number;
      processedPlayers: number;
      nextResumeFrom: number | null;
      stoppedReason: "max_players" | "complete";
    }) =>
      async (_req: any, res: any) => {
        vi.setSystemTime(Date.now() + args.ms);
        res.status(200).json({
          success: true,
          operationStatus: "success",
          runSummary: {
            processedPlayers: args.processedPlayers,
            nextResumeFrom: args.nextResumeFrom,
            remainingPlayerCount: args.nextResumeFrom == null ? 0 : 10,
            stoppedReason: args.stoppedReason
          }
        });
      };

    it("runs the rolling step in chunks and stores the cursor after every chunk", async () => {
      const at = "2026-10-19T10:05:00.000Z";
      updateRollingPlayerAveragesMock
        .mockImplementationOnce(
          rollingChunk({ ms: 20_000, processedPlayers: 16, nextResumeFrom: 8478000, stoppedReason: "max_players" })
        )
        .mockImplementationOnce(async (req: any, res: any) => {
          // The first chunk's cursor is already durable before the second runs.
          expect(pipelineStateRows.get(stageKey("rolling_player_recompute"))).toMatchObject({
            status: "running",
            cursor_game_id: 8478000
          });
          await rollingChunk({ ms: 20_000, processedPlayers: 60, nextResumeFrom: 8479000, stoppedReason: "max_players" })(req, res);
        })
        .mockImplementationOnce(
          rollingChunk({ ms: 5_000, processedPlayers: 5, nextResumeFrom: null, stoppedReason: "complete" })
        );

      const res = await invokeScheduled(at);

      expect(res.statusCode).toBe(200);
      expect(res.body.termination).toMatchObject({ state: "completed" });
      const queries = updateRollingPlayerAveragesMock.mock.calls.map((call: any[]) => call[0].query);
      expect(queries).toHaveLength(3);
      expect(queries[0]).toMatchObject({
        startDate: "2026-10-18",
        endDate: "2026-10-18",
        maxPlayers: "16",
        bypassFreshnessBlockers: "true",
        deadlineAt: String(Date.parse(at) + 220_000)
      });
      expect(queries[0]).not.toHaveProperty("resumeFrom");
      // 20 s for 16 players, 160 s left: 96 would fit, capped at 60.
      expect(queries[1]).toMatchObject({ resumeFrom: "8478000", maxPlayers: "60" });
      expect(Number(queries[1].maxRuntimeMs)).toBe(160_000);
      expect(queries[2]).toMatchObject({ resumeFrom: "8479000" });
      expect(stageStatus(res, "rolling_player_recompute")).toMatchObject({ status: "success" });
      expect(stageStatus(res, "rolling_player_recompute").steps).toHaveLength(3);
      expect(pipelineStateRows.get(stageKey("rolling_player_recompute"))).toMatchObject({
        status: "complete",
        cursor_game_id: 8479000
      });
      expect(ingestProjectionInputsMock).toHaveBeenCalledTimes(1);
    });

    it("stops the rolling chunks at the claim budget and resumes them next invocation", async () => {
      updateRollingPlayerAveragesMock
        .mockImplementationOnce(
          rollingChunk({ ms: 100_000, processedPlayers: 16, nextResumeFrom: 8478000, stoppedReason: "max_players" })
        )
        .mockImplementationOnce(
          rollingChunk({ ms: 60_000, processedPlayers: 8, nextResumeFrom: 8478500, stoppedReason: "max_players" })
        )
        .mockImplementationOnce(
          rollingChunk({ ms: 10_000, processedPlayers: 3, nextResumeFrom: null, stoppedReason: "complete" })
        );

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

      // 160 s spent: under 30 s of claim budget left, so no third chunk here.
      expect(first.statusCode).toBe(207);
      expect(first.body.termination).toMatchObject({
        state: "continuation_required",
        reason: "stage_partial",
        nextStageId: "rolling_player_recompute",
        rollingResumeFrom: 8478500
      });
      expect(first.body.failureSummary.failedStepCount).toBe(0);
      expect(stageStatus(first, "rolling_player_recompute").status).toBe("partial");
      expect(updateRollingPlayerAveragesMock).toHaveBeenCalledTimes(2);

      expect(pipelineStateRows.get(stageKey("rolling_player_recompute"))).toMatchObject({
        status: "failed", last_error: "stage_handoff", lease_owner: null, lease_expires_at: null
      });

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");

      expect(second.statusCode).toBe(200);
      expect([...pipelineStateRows.values()].filter(row => row.operation_key.startsWith("rolling_player_recompute:kill:"))).toHaveLength(0);
      expect(updateRollingPlayerAveragesMock.mock.calls[2]?.[0]?.query).toMatchObject({
        resumeFrom: "8478500",
        maxPlayers: "16"
      });
    });

    it("counts a death after a late checkpoint once per lease owner, preserving its cursor and the kill cap", async () => {
      for (const stageId of ["core_entity_freshness", "upstream_skater_sources", "contextual_builders"]) {
        seedStageRow(stageId, {});
      }
      const deadLease = {
        revision: 9,
        status: "running",
        cursor_game_id: 8478402,
        lease_owner: "dead-invocation",
        lease_expires_at: "2026-10-19T10:09:30.000Z",
        updated_at: "2026-10-19T10:08:35.000Z"
      };
      seedStageRow("rolling_player_recompute", deadLease);

      const res = await invokeScheduled("2026-10-19T10:10:00.000Z");

      expect(res.statusCode).toBe(200);
      expect(updateRollingPlayerAveragesMock.mock.calls[0]?.[0]?.query).toMatchObject({
        resumeFrom: "8478402"
      });
      const db = { from: pipelineStateFrom, rpc: pipelineStateRpc } as any;
      const args = { supabase: db, scopeKey: "daily_incremental:2026-10-19", stageId: "rolling_player_recompute" as const,
        runDate: "2026-10-19", expiredLeaseOwner: "dead-invocation" };
      expect(readRollingForgeStageKills(await readRollingForgeRunState(args), args.stageId)).toBe(1);
      // Replayed/stale observers of the same death do not spend another retry.
      expect(await Promise.all([recordRollingForgeStageKill(args), recordRollingForgeStageKill(args)])).toEqual([1, 1]);

      // The third death closes the stage; later invocations stop without work.
      seedStageRow("rolling_player_recompute", deadLease);
      seedStageRow("rolling_player_recompute:kills", {
        status: "failed",
        cursor_game_id: 2,
        last_error: "stage_killed:attempt-2"
      });
      vi.clearAllMocks();

      const third = await invokeScheduled("2026-10-19T10:15:00.000Z");

      expect(third.statusCode).toBe(207);
      expect(third.body.termination).toMatchObject({
        state: "stopped_on_blocking_failure",
        reason: "attempts_exhausted",
        nextStageId: "rolling_player_recompute",
        detail: "Killed 3 time(s)."
      });
      expect(stageStatus(third, "rolling_player_recompute").status).toBe("failed");
      expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();
      expect(pipelineStateRows.get(stageKey("rolling_player_recompute"))).toMatchObject({
        status: "failed",
        cursor_game_id: 8478402,
        last_error: "stage_failed:attempt-2"
      });

      const fourth = await invokeScheduled("2026-10-19T10:20:00.000Z");

      expect(third.body.failureSummary).toMatchObject({
        failedStepCount: 0,
        firstFailure: { stageId: "rolling_player_recompute", stepId: null, code: "stage_killed",
          error: "Killed 3 time(s)." },
        terminalStop: { code: "stage_killed", stageId: "rolling_player_recompute" }
      });

      expect(fourth.body.termination).toMatchObject({ reason: "attempts_exhausted" });
      // Later invocations keep naming the kills, not a generic exhaustion.
      expect(fourth.body.failureSummary.terminalStop).toEqual({
        code: "stage_killed",
        stageId: "rolling_player_recompute"
      });
      expect(fourth.body.failureSummary.firstFailure).toMatchObject({ stepId: null, code: "stage_killed" });
      expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();
      expect(readRollingForgeStageKills(await readRollingForgeRunState(args), args.stageId)).toBe(3);
    });

    it("counts a kill receipt once across concurrent recorders and a recorder interrupted after acquisition", async () => {
      const args = { supabase: { from: pipelineStateFrom, rpc: pipelineStateRpc } as any, scopeKey: "daily_incremental:2026-10-19",
        stageId: "rolling_player_recompute" as const, runDate: "2026-10-19", expiredLeaseOwner: "one-dead-owner" };
      const results = await Promise.allSettled([recordRollingForgeStageKill(args), recordRollingForgeStageKill(args)]);
      expect(results.some(result => result.status === "fulfilled" && result.value === 1)).toBe(true);
      expect(readRollingForgeStageKills(await readRollingForgeRunState(args), args.stageId)).toBe(1);
      // An unfinished recorder receipt is already durable accounting, not another dead stage.
      const receipt = [...pipelineStateRows.values()].find(row => row.operation_key.includes(":kill:"));
      Object.assign(receipt, { status: "running", lease_owner: "interrupted-recorder", lease_expires_at: "2026-10-19T10:00:00Z" });
      expect(await recordRollingForgeStageKill(args)).toBe(1);
      expect(readRollingForgeStageKills(await readRollingForgeRunState(args), args.stageId)).toBe(1);
    });

    it("projects the next day after the run date, remembering finished dates across invocations", async () => {
      runProjectionV2Mock
        .mockImplementationOnce(slowSuccess(20_000))
        .mockImplementationOnce(async (_req: any, res: any) => {
          // The run date is already recorded as done before the next day starts.
          expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({
            status: "running",
            cursor_game_id: 1
          });
          vi.setSystemTime(Date.now() + 100_000);
          res.status(207).json({
            success: false,
            operationStatus: "partial",
            resume: { required: true, reason: "runtime_budget", request: { date: "2026-10-20", horizonGames: "1" } }
          });
        });

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

      expect(first.statusCode).toBe(207);
      expect(first.body.termination).toMatchObject({
        state: "continuation_required",
        reason: "stage_partial",
        nextStageId: "projection_execution"
      });
      // Goalie start priors are written through the next day so its projection gate passes.
      expect(updateGoalieProjectionsV2Mock.mock.calls[0][0].query).toEqual({ limit: "7", endDate: "2026-10-20" });
      expect(runProjectionV2Mock.mock.calls.map((call: any[]) => call[0].query.date)).toEqual(["2026-10-19", "2026-10-20"]);
      expect(Number(runProjectionV2Mock.mock.calls[1][0].query.maxDurationMs)).toBe(160_000);
      expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "failed", last_error: "stage_handoff", cursor_game_id: 1 });

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");

      expect(second.statusCode).toBe(200);
      // Only the unfinished next day runs again.
      expect(runProjectionV2Mock).toHaveBeenCalledTimes(3);
      expect(runProjectionV2Mock.mock.calls[2][0].query).toMatchObject({ date: "2026-10-20" });
      // The goalie priors were written by the invocation that projected the run date.
      expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(1);
      expect(stageStatus(second, "projection_execution").steps.map((step: any) => step.id)).toEqual(["run-projection-v2"]);
      expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "complete", cursor_game_id: 2 });
    });

    it("runs the goalie step on the first projection invocation only, also while the run date's projection stays partial", async () => {
      runProjectionV2Mock.mockImplementationOnce(async (_req: any, res: any) => {
        vi.setSystemTime(Date.now() + 100_000);
        res.status(207).json({
          success: false,
          operationStatus: "partial",
          resume: { required: true, reason: "runtime_budget", request: { date: "2026-10-19", horizonGames: "1" } }
        });
      });

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

      expect(stageStatus(first, "projection_execution").status).toBe("partial");
      expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(1);
      // No date finished, so the stage cursor alone could not tell the next invocation.
      expect(pipelineStateRows.get(stageKey("projection_execution"))?.cursor_game_id ?? null).toBeNull();
      expect(pipelineStateRows.get(stageKey("projection_execution:goalie"))).toMatchObject({ status: "complete" });

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");

      expect(second.statusCode).toBe(200);
      expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(1);
      expect(stageStatus(second, "projection_execution").steps.map((step: any) => step.id)).toEqual([
        "run-projection-v2",
        "run-projection-v2"
      ]);
    });

    it("retries a failed goalie step on the next invocation even after the projection dates finished", async () => {
      updateGoalieProjectionsV2Mock.mockImplementationOnce(async (_req: any, res: any) => {
        res.status(500).json({ success: false, message: "NHL goalie logs unavailable" });
      });

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

      expect(first.statusCode).toBe(207);
      expect(first.body.termination).toMatchObject({
        state: "stopped_on_blocking_failure",
        nextStageId: "projection_execution",
        reason: "retry_on_next_invocation"
      });
      expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
      expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "failed", cursor_game_id: 2 });
      expect(pipelineStateRows.has(stageKey("projection_execution:goalie"))).toBe(false);

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");

      expect(second.statusCode).toBe(200);
      expect(second.body.termination).toMatchObject({ state: "completed" });
      expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(2);
      // Only the goalie step repeats; the finished dates are not projected again.
      expect(stageStatus(second, "projection_execution").steps.map((step: any) => step.id)).toEqual([
        "update-goalie-projections-v2"
      ]);
      expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
      expect(pipelineStateRows.get(stageKey("projection_execution:goalie"))).toMatchObject({ status: "complete" });
    });

    it("records a failed next-day projection as a warning and completes the run date's downstream stages", async () => {
      runProjectionV2Mock
        .mockImplementationOnce(slowSuccess(10_000))
        .mockImplementationOnce(async (_req: any, res: any) => {
          res.status(422).json({ success: false, error: "Preflight failed", preflight: { status: "FAIL", gates: [{ gate_key: "goalie_start_priors_v2", status: "FAIL" }] } });
        });

      const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

      expect(res.statusCode).toBe(200);
      expect(res.body.termination).toMatchObject({ state: "completed" });
      expect(res.body.failureSummary).toMatchObject({ failedStepCount: 0, firstFailure: null });
      const stage = stageStatus(res, "projection_execution");
      expect(stage.status).toBe("success");
      const projections = stage.steps.filter((step: any) => step.id === "run-projection-v2");
      expect(projections.map((step: any) => [step.query.date, step.status])).toEqual([["2026-10-19", "success"], ["2026-10-20", "skipped"]]);
      expect(projections[1].reason).toContain("Next-day projection for 2026-10-20 failed (non-blocking): HTTP 422; failed gates goalie_start_priors_v2");
      expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "complete", cursor_game_id: 1 });
      expect(runProjectionAccuracyMock).not.toHaveBeenCalled();
    });

    it("defers the next day's projection to the following invocation when the run date used the budget", async () => {
      runProjectionV2Mock.mockImplementationOnce(slowSuccess(170_000));

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

      expect(first.statusCode).toBe(207);
      expect(first.body.termination).toMatchObject({ reason: "stage_partial", nextStageId: "projection_execution" });
      expect(stageStatus(first, "projection_execution").status).toBe("partial");
      expect(runProjectionV2Mock).toHaveBeenCalledTimes(1);

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");

      expect(second.statusCode).toBe(200);
      expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
      expect(runProjectionV2Mock.mock.calls[1][0].query).toMatchObject({ date: "2026-10-20" });
    });

    it("backfills the completed games' lines, retries once when a game still lacks them, then continues degraded", async () => {
      const missingSecondTeam = async (_column: string, gameIds: number[]) => ({
        data: [{ gameId: gameIds[0], teamId: 1 }],
        error: null
      });
      lineCombosInMock.mockImplementationOnce(missingSecondTeam).mockImplementationOnce(missingSecondTeam);

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

      expect(updateLineCombinationsMock.mock.calls[0]?.[0]?.query).toEqual({
        repairMode: "historical_backfill",
        gameIds: "2025021023,2025021024"
      });
      expect(first.statusCode).toBe(207);
      expect(first.body.termination).toMatchObject({
        state: "stopped_on_blocking_failure",
        reason: "retry_on_next_invocation",
        nextStageId: "contextual_builders"
      });
      const verify = stageStatus(first, "contextual_builders").steps.find((step: any) => step.id === "verify-line-context");
      expect(verify).toMatchObject({
        status: "failed",
        summary: { missingLineContextGameIds: [2025021023, 2025021024] }
      });
      expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");

      expect(second.statusCode).toBe(200);
      expect(updateLineCombinationsMock).toHaveBeenCalledTimes(2);
      expect(stageStatus(second, "contextual_builders").status).toBe("success");
      expect(
        stageStatus(second, "contextual_builders").steps.find((step: any) => step.id === "verify-line-context").reason
      ).toContain("degraded");
      expect(updateRollingPlayerAveragesMock).toHaveBeenCalledTimes(1);
    });
  });

  it("reports a partial rolling step in an explicit-date run as unfinished, not failed", async () => {
    updateRollingPlayerAveragesMock.mockImplementationOnce(
      async (_req: any, res: any) => {
        res.status(207).json({
          success: false,
          operationStatus: "partial",
          resume: { required: true, nextResumeFrom: 8477000, request: {} }
        });
      }
    );
    const req: any = {
      method: "GET",
      query: { mode: "daily_incremental", date: "2026-03-14" },
      url: "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=2026-03-14"
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(207);
    expect(res.body.termination).toMatchObject({
      state: "continuation_required",
      reason: "stage_partial",
      rollingResumeFrom: 8477000
    });
    expect(res.body.failureSummary.failedStepCount).toBe(0);
    expect(ingestProjectionInputsMock).not.toHaveBeenCalled();
    // One-shot runs chunk too, with the same hard deadline.
    const query = updateRollingPlayerAveragesMock.mock.calls[0]?.[0]?.query;
    expect(query).toMatchObject({ maxPlayers: "16", bypassFreshnessBlockers: "true" });
    expect(Number(query.deadlineAt)).toBeGreaterThan(Date.now() + 180_000);
    expect(Number(query.deadlineAt)).toBeLessThanOrEqual(Date.now() + 190_000);
  });
});

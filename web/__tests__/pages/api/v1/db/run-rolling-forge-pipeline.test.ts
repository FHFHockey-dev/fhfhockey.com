import { beforeEach, describe, expect, it, vi } from "vitest";

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
  buildProjectionDerivedMock,
  updateGoalieProjectionsV2Mock,
  runProjectionV2Mock,
  runProjectionAccuracyMock,
  auditInsertMock,
  gamesSelectMock,
  gamesGteMock,
  gamesLteMock,
  gamesOrderMock
} = vi.hoisted(() => {
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
    buildProjectionDerivedMock: vi.fn(successResponder),
    updateGoalieProjectionsV2Mock: vi.fn(successResponder),
    runProjectionV2Mock: vi.fn(successResponder),
    runProjectionAccuracyMock: vi.fn(successResponder),
    auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
    gamesSelectMock,
    gamesGteMock,
    gamesLteMock,
    gamesOrderMock
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
    from: vi.fn(() => ({
      select: gamesSelectMock
    }))
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

import handler from "../../../../../pages/api/v1/db/run-rolling-forge-pipeline";

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
    expect(buildProjectionDerivedMock.mock.calls[0]?.[0]?.query).toMatchObject({
      startDate: "2026-03-07",
      endDate: "2026-03-13"
    });
    expect(runProjectionV2Mock).toHaveBeenCalled();
    expect(runProjectionAccuracyMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      mode: "daily_incremental",
      runtimeBudget: {
        budgetMs: 270000,
        budgetLabel: "04:30",
        durationMs: expect.any(Number),
        durationLabel: expect.any(String),
        withinBudget: true
      },
      executionControls: {
        includeDownstream: true,
        includeAccuracy: false,
        stopOnFailure: true
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
        version: "rolling-forge-operator-order-v1",
        healthyRunRule: expect.any(String),
        validationRule: expect.any(String),
        stages: expect.arrayContaining([
          expect.objectContaining({ id: "core_entity_freshness", order: 1 }),
          expect.objectContaining({ id: "upstream_skater_sources", order: 2 }),
          expect.objectContaining({ id: "contextual_builders", order: 3 }),
          expect.objectContaining({ id: "rolling_player_recompute", order: 4 }),
          expect.objectContaining({ id: "projection_input_ingest", order: 5 }),
          expect.objectContaining({ id: "projection_derived_build", order: 6 }),
          expect.objectContaining({ id: "projection_execution", order: 7 })
        ])
      },
      pipeline: {
        version: "rolling-forge-pipeline-v3"
      }
    });
    expect(res.body.stages.map((stage: any) => stage.id)).toEqual([
      "core_entity_freshness",
      "upstream_skater_sources",
      "contextual_builders",
      "rolling_player_recompute",
      "projection_input_ingest",
      "projection_derived_build",
      "projection_execution",
      "downstream_projection_consumers",
      "monitoring"
    ]);
  });

  it("stops after a blocking stage failure and skips the remaining stages", async () => {
    updateRollingPlayerAveragesMock.mockImplementationOnce(
      async (_req: any, res: any) => {
        res.status(500).json({ success: false, message: "rolling failed" });
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

  it("keeps stage 8 accuracy-only after retiring the legacy start-chart materializer", async () => {
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
});

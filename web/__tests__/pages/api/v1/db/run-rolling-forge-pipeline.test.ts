import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { persistManualCronAudit, withManualCronAuditResponse } from "lib/cron/manualCronAudit";

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
  ppCombosInMock,
  ppCombosSelectMock,
  pipelineStateRows,
  pipelineStateFrom,
  pipelineStateRpc,
  wgo,
  wgoDefaults,
  wgoFrom,
  wgoDigestRpc,
  digestOf
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

  // What the standalone WGO jobs persisted, read by the scheduled run's
  // readiness check. The default is a normal ready day for any source date:
  // two final regular-season games, a clean job-9 receipt after both could
  // have ended, and 18 skaters on each side of each game.
  const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
  const previousDay = (date: string) => new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
  // Stand-in for public.wgo_skater_date_digest: the row count and a 32-hex hash of the date's rows.
  const digestOf = (rows: any[]) => {
    const text = JSON.stringify([...rows].sort((a, b) => a.player_id - b.player_id || a.game_id - b.game_id));
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
    return { rows: rows.length, md5: hash.toString(16).padStart(8, "0").repeat(4) };
  };
  const wgoDefaults = {
    games: (date: string): any[] => [2025021023, 2025021024].map((id, index) => ({
      id, date, startTime: `${date}T23:00:00.000Z`, type: 2, homeTeamId: 2 * index + 1, awayTeamId: 2 * index + 2,
      game_state: "OFF", game_schedule_state: "OK", game_state_observed_at: `${nextDay(date)}T03:00:00.000Z`
    })),
    receipt: (date: string, overrides: Record<string, any> = {}, context: Record<string, any> = {}): any => {
      const body = { message: "ok", success: true, totalUpdates: 72, datesProcessed: [date], failedDates: [], failedDatesCount: 0,
        failures: [], skippedDates: [previousDay(date), nextDay(date)], skippedDatesCount: 2, skips: [], ...context };
      // The shape update-wgo-skaters' own finally block writes for job 9 (action=all, no startDate),
      // as in production's 2026-11-22T07:32:53Z row, with the digest the writer records for the date.
      const sourceDigests = "sourceDigests" in context ? context.sourceDigests : { [date]: wgo.liveDigest(date) };
      return { job_name: "update-all-wgo-skaters", run_time: `${nextDay(date)}T03:30:00.000Z`, status: "success", rows_affected: 72,
        details: { method: "GET", url: "/api/v1/db/update-wgo-skaters?action=all", statusCode: 200, durationMs: 1000,
          rowsUpserted: body.totalUpdates, failedRows: 0, error: null,
          response: { ...body, sourceDigests, failedRows: 0, fullRefresh: false },
          context: { message: body.message, sourceDigests, datesProcessed: body.datesProcessed, failedDates: body.failedDates,
            failedDatesCount: body.failedDatesCount, failures: body.failures, skippedDates: body.skippedDates,
            skippedDatesCount: body.skippedDatesCount, skips: body.skips, fullRefresh: false } },
        ...overrides };
    },
    rows: (gameIds: number[], date: string, perSide = 18): any[] => gameIds.flatMap(gameId =>
      (["H", "R"] as const).flatMap((side, sideIndex) => Array.from({ length: perSide }, (_unused, index) => ({
        game_id: gameId, player_id: gameId * 100 + sideIndex * 50 + index, date, home_road: side }))))
  };
  const wgo = {
    games: wgoDefaults.games as (date: string) => any[],
    receipts: (date: string): any[] => [wgoDefaults.receipt(date)],
    rows: (gameIds: number[], date: string): any[] => wgoDefaults.rows(gameIds, date),
    lastDate: "",
    reads: [] as string[],
    // What public.wgo_skater_date_digest returns for the date right now.
    liveDigest: (date: string): any => digestOf(wgo.rows(wgo.games(date).map((game: any) => game.id), date)
      .filter((row: any) => row.date === date)),
    digestError: null as null | { message: string }
  };
  const wgoDigestRpc = async (args: { p_date: string }) => {
    wgo.reads.push("wgo_skater_date_digest");
    return wgo.digestError ? { data: null, error: wgo.digestError } : { data: wgo.liveDigest(args.p_date), error: null };
  };
  const wgoFrom = (table: string) => {
    if (table === "games") {
      return { select: () => ({ eq: async (_column: string, date: string) => {
        wgo.lastDate = date; wgo.reads.push("games");
        return { data: wgo.games(date), error: null };
      } }) };
    }
    if (table === "wgo_skater_stats") {
      return { select: () => ({ in: (_column: string, gameIds: number[]) => ({ limit: async () => {
        wgo.reads.push("wgo_skater_stats");
        return { data: wgo.rows(gameIds, wgo.lastDate).filter(row => gameIds.includes(row.game_id)), error: null };
      } }) }) };
    }
    // cron_job_audit reads, with the filters the readiness check sends.
    const keep: Array<(row: any) => boolean> = [];
    let since = "";
    const query: any = {
      eq: (column: string, value: unknown) => { keep.push(row => row[column] === value); return query; },
      gte: (column: string, value: string) => {
        since = new Date(Date.parse(value) - 86_400_000).toISOString().slice(0, 10);
        keep.push(row => row[column] >= value);
        return query;
      },
      lte: (column: string, value: string) => { keep.push(row => row[column] <= value); return query; },
      order: () => query,
      limit: async (count: number) => {
        wgo.reads.push("cron_job_audit");
        const rows = wgo.receipts(since).filter(row => keep.every(test => test(row)))
          .sort((a, b) => b.run_time.localeCompare(a.run_time));
        return { data: rows.slice(0, count), error: null };
      }
    };
    return { select: () => query };
  };

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
  // powerPlayCombinations rows for the source date's games; every game by default.
  const ppCombosInMock = vi.fn(async (_column: string, gameIds: number[]) => ({
    data: gameIds.map((gameId) => ({ gameId })),
    error: null
  }));
  const ppCombosSelectMock = vi.fn(() => ({ in: ppCombosInMock }));
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
    ppCombosInMock,
    ppCombosSelectMock,
    pipelineStateRows,
    pipelineStateFrom,
    pipelineStateRpc,
    wgo,
    wgoDefaults,
    wgoFrom,
    wgoDigestRpc,
    digestOf
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
        ? { insert: auditInsertMock, select: () => wgoFrom("cron_job_audit").select() }
        : table === "wgo_skater_stats"
          ? wgoFrom("wgo_skater_stats")
        : table === "games"
          ? { select: (columns?: string) => columns?.includes("game_state") ? wgoFrom("games").select() : gamesSelectMock() }
        : table === "projection_pipeline_state"
          ? pipelineStateFrom()
          : table === "lineCombinations"
            ? { select: lineCombosSelectMock }
            : table === "powerPlayCombinations"
              ? { select: ppCombosSelectMock }
              : { select: gamesSelectMock }
    ),
    rpc: (name: string, args: any) =>
      name === "wgo_skater_date_digest" ? wgoDigestRpc(args) : pipelineStateRpc(name, args)
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

import handler, { __testables, forgeProjectionDaysAhead } from "../../../../../pages/api/v1/db/run-rolling-forge-pipeline";
import { readRollingForgeRunState, readRollingForgeStageKills, recordRollingForgeStageKill } from "lib/rollingForgePipelineRunState";

function resetWgoFixture() {
  wgo.games = wgoDefaults.games;
  wgo.receipts = (date: string) => [wgoDefaults.receipt(date)];
  wgo.rows = (gameIds: number[], date: string) => wgoDefaults.rows(gameIds, date);
  wgo.lastDate = "";
  wgo.reads = [];
  wgo.liveDigest = (date: string) => digestOf(wgo.rows(wgo.games(date).map((game: any) => game.id), date)
    .filter((row: any) => row.date === date));
  wgo.digestError = null;
}

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
    resetWgoFixture();
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
    // An explicit-date run (a repair) still produces WGO itself; only the scheduled run reads the standalone jobs.
    expect(updateWgoSkatersMock.mock.calls[0]?.[0]?.query).toEqual({ action: "all", startDate: "2026-03-14" });
    expect(updateWgoTotalsMock).toHaveBeenCalledTimes(1);
    expect(res.body.wgoReadiness).toBeUndefined();
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

  it("skips the optional WGO totals refresh late in an explicit-date run", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T10:05:00.000Z"));
    updateWgoSkatersMock.mockImplementationOnce(async (_req: any, out: any) => {
      vi.setSystemTime(Date.now() + 100_000);
      out.status(200).json({ success: true });
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { mode: "daily_incremental", date: "2026-10-18", includeAccuracy: "false" }, headers: {} } as any, res);
    const upstream = res.body.stages.find((stage: any) => stage.id === "upstream_skater_sources");
    expect(upstream.steps.map((step: any) => [step.id, step.status])).toEqual([
      ["update-nst-gamelog", "success"], ["update-wgo-skaters", "success"], ["update-wgo-totals", "skipped"]]);
    expect(updateWgoTotalsMock).not.toHaveBeenCalled();
  });

  it("keeps an explicit NST window bounded and holds uncertain writes even when stopOnFailure is false", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T10:05:00.000Z"));
    updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => {
      res.status(500).json({ success: false, error: "write acknowledgement lost", writePersistence: "not_confirmed" });
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { mode: "daily_incremental", startDate: "2026-10-16", endDate: "2026-10-17", stopOnFailure: "false" }, headers: {} } as any, res);
    expect(updateNstGamelogMock.mock.calls[0][0].query).toEqual({
      runMode: "incremental", startDate: "2026-10-16", endDate: "2026-10-17",
      deadlineAt: String(Date.parse("2026-10-19T10:05:00.000Z") + 190_000)
    });
    expect(res.body.termination).toMatchObject({ state: "stopped_on_blocking_failure", resumeRequired: false, reason: "manual_review_required" });
    expect(res.body.failureSummary.terminalStop).toEqual({ code: "nst_persistence_unconfirmed", stageId: "upstream_skater_sources" });
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();
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
      updateNstGamelogMock.mockImplementationOnce(slowSuccess(40_000));
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
      expect(order).toHaveLength(11);
      expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      expect(updateWgoTotalsMock).not.toHaveBeenCalled();
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
      // WGO skater data and totals come from their standalone jobs, checked for the source date.
      expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      expect(updateWgoTotalsMock).not.toHaveBeenCalled();
      expect(res.body.wgoReadiness).toMatchObject({ ready: true, sourceDate: "2026-10-18" });
      // Power-play combinations come from played games: yesterday's slate, not today's.
      expect(gamesGteMock).toHaveBeenCalledWith("date", "2026-10-18");
      expect(gamesLteMock).toHaveBeenCalledWith("date", "2026-10-18");
      expect(updatePowerPlayCombinationsMock.mock.calls[0]?.[0]?.query).toEqual({ startDate: "2026-10-18", endDate: "2026-10-18" });
      // The projection itself is still for the run date.
      expect(runProjectionV2Mock.mock.calls[0]?.[0]?.query?.date).toBe("2026-10-19");
    });

    describe("NST step resume (production-default producer contract)", () => {
      const continuation = (cursor: string, overrides: Record<string, string> = {}) =>
        async (req: any, res: any) => {
          res.status(207).json({
            success: false,
            operationStatus: "continuation_required",
            nstProgress: { auditPersistence: "confirmed" },
            resume: { required: true, request: { query: { ...req.query, cursor, ...overrides } } }
          });
        };
      const reply = (status: number, body: unknown) => async (_req: any, res: any) => {
        res.status(status).json(body);
      };
      afterEach(() => {
        updateNstGamelogMock.mockReset();
      });

      it("pauses on a continuation, replays its query with a fresh deadline, and completes the stage once NST finishes", async () => {
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
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(updateWgoTotalsMock).not.toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "complete" });
        expect(third.statusCode).toBe(200);
        expect(third.body.termination).toMatchObject({ state: "completed" });
        const fourth = await invokeScheduled("2026-10-19T10:20:00.000Z");
        expect(fourth.body.termination.state).toBe("completed");
        expect(updateNstGamelogMock).toHaveBeenCalledTimes(3);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect([...pipelineStateRows.values()].filter(row => row.operation_key.startsWith("upstream_skater_sources:kill:"))).toHaveLength(0);
      });

      it("keeps a resumed source-down result explicitly degraded and completes the stage once", async () => {
        updateNstGamelogMock.mockImplementationOnce(continuation("7"))
          .mockImplementationOnce(reply(503, { success: false, operationStatus: "source_down",
            nstProgress: { auditPersistence: "confirmed", sourceOutcomes: { unresolvedCount: 1 } } }));
        await invokeScheduled("2026-10-19T10:05:00.000Z");
        const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
        expect(updateNstGamelogMock.mock.calls[1][0].query).toMatchObject({ cursor: "7" });
        expect(second.body.failureSummary.degradedSteps).toEqual([
          { stageId: "upstream_skater_sources", stepId: "update-nst-gamelog", code: "nst_source_unavailable", reason: expect.stringContaining("Backfill the date") }
        ]);
        expect(nstStageRow()).toMatchObject({ status: "complete", cursor_game_id: 7 });
        await invokeScheduled("2026-10-19T10:15:00.000Z");
        expect(updateNstGamelogMock).toHaveBeenCalledTimes(2);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      });

      it("leaves WGO skaters and season totals to their standalone jobs (pg_cron 9 and 14)", async () => {
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        const upstream = stageStatus(res, "upstream_skater_sources");
        expect(upstream.status).toBe("success");
        expect(upstream.steps.map((step: any) => [step.id, step.status])).toEqual([
          ["wgo-skater-readiness", "success"], ["update-nst-gamelog", "success"],
        ]);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(updateWgoTotalsMock).not.toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "complete" });
      });

      it("completes the stage on the expected no-completed-games skip", async () => {
        updateNstGamelogMock.mockImplementationOnce(reply(200, { success: true, operationStatus: "skipped_no_completed_games" }));

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(res, "upstream_skater_sources").steps.map((step: any) => [step.id, step.status])).toEqual([
          ["wgo-skater-readiness", "success"], ["update-nst-gamelog", "skipped"],
        ]);
        expect(nstStageRow()).toMatchObject({ status: "complete" });
      });

      it.each([
        ["a missing success acknowledgement", reply(200, {})],
        ["a null success body", reply(200, null)],
        ["a non-boolean success acknowledgement", reply(200, { success: "true" })],
        ["a contradictory successful continuation", reply(200, { success: true, operationStatus: "continuation_required", resume: { required: true } })],
        ["a provider failure (>= 400)", reply(503, { success: false, classification: "rate_limited" })],
        ["incomplete work (200, success false)", reply(200, { success: false, message: "Incomplete NST work; inspect source outcomes and deferred URLs." })],
        ["a 207 that is not a continuation", reply(207, { success: false, operationStatus: "partial" })],
        ["a cursor that is not positive", continuation("0")],
        ["a non-integer cursor", continuation("7.5")],
        ["a changed deadline", continuation("7", { deadlineAt: "1" })],
        ["an unacknowledged continuation", async (req: any, res: any) => {
          res.status(207).json({ success: false, operationStatus: "continuation_required",
            resume: { required: true, request: { query: { ...req.query, cursor: "7" } } } });
        }],
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
          ["wgo-skater-readiness", "success"], ["update-nst-gamelog", "failed"],
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
          ["wgo-skater-readiness", "success"], ["update-nst-gamelog", "failed"],
        ]);
        expect(second.body.termination).toMatchObject({ state: "stopped_on_blocking_failure" });
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(nstStageRow()).toMatchObject({ status: "failed", cursor_game_id: 7 });
      });

      it.each(["auditPersistence", "writePersistence"])("holds %s uncertainty for review across invocations without rerunning NST", async (field) => {
        updateNstGamelogMock
          .mockImplementationOnce(continuation("7"))
          .mockImplementationOnce(reply(500, { success: false, error: "acknowledgement lost", [field]: "not_confirmed" }));
        await invokeScheduled("2026-10-19T10:05:00.000Z");
        const failed = await invokeScheduled("2026-10-19T10:10:00.000Z");
        expect(failed.body.termination).toMatchObject({ state: "stopped_on_blocking_failure", resumeRequired: false, reason: "manual_review_required" });
        expect(nstStageRow()).toMatchObject({ status: "failed", last_error: "nst_persistence_unconfirmed", cursor_game_id: 7 });
        const held = await invokeScheduled("2026-10-19T10:15:00.000Z");
        expect(held.body.termination).toMatchObject({ state: "stopped_on_blocking_failure", resumeRequired: false, reason: "manual_review_required" });
        expect(held.body.failureSummary.terminalStop).toEqual({ code: "nst_persistence_unconfirmed", stageId: "upstream_skater_sources" });
        expect(updateNstGamelogMock).toHaveBeenCalledTimes(2);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();
      });

      it("does not advance when the cursor cannot be stored and holds the abandoned NST call for review", async () => {
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
          expect(first.body.termination).toMatchObject({ state: "stopped_on_blocking_failure", reason: "manual_review_required", resumeRequired: false, nextStageId: "upstream_skater_sources" });
          expect(updateWgoSkatersMock).not.toHaveBeenCalled();
          expect(nstStageRow()).toMatchObject({ status: "running", cursor_game_id: null });

          // An acknowledged producer response does not prove why a later
          // running row was abandoned. Recovery requires receipt review.
          const held = await invokeScheduled("2026-10-19T10:15:00.000Z");
          expect(held.body.termination).toMatchObject({ resumeRequired: false, reason: "manual_review_required" });
          expect(updateNstGamelogMock).toHaveBeenCalledTimes(1);
          expect(updateWgoSkatersMock).not.toHaveBeenCalled();
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
      });

      it("runs the later stages and names the degraded step", async () => {
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => { res.status(200).json(outage); });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        const upstream = stageStatus(res, "upstream_skater_sources");
        expect(upstream.steps.map((step: any) => [step.id, step.status])).toEqual([
          ["wgo-skater-readiness", "success"], ["update-nst-gamelog", "skipped"],
        ]);
        expect(upstream.status).toBe("success");
        expect(upstream.steps[1]).toMatchObject({ degraded: "nst_source_unavailable",
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
          ["wgo-skater-readiness", "success"], ["update-nst-gamelog", "skipped"],
        ]);
        expect(upstream.status).toBe("success");
        expect(upstream.steps[1]).toMatchObject({ statusCode: 503, degraded: "nst_source_unavailable" });
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

    it("preserves an expired checkpoint for review instead of treating it as a replay-safe handoff", async () => {
      for (const id of ["core_entity_freshness","upstream_skater_sources","contextual_builders"]) seedStageRow(id,{});
      const deadLease={revision:9,status:"running",cursor_game_id:8478402,lease_owner:"dead-invocation",
        lease_expires_at:"2026-10-19T10:09:30.000Z",updated_at:"2026-10-19T10:08:35.000Z"};
      seedStageRow("rolling_player_recompute",deadLease);
      const before={...pipelineStateRows.get(stageKey("rolling_player_recompute"))};
      for (const at of ["2026-10-19T10:10:00Z","2026-10-19T10:15:00Z"]) {
        const result=await invokeScheduled(at);
        expect(result.statusCode).toBe(207);expect(result.body.termination).toMatchObject({reason:"manual_review_required",resumeRequired:false});
        expect(result.body.failureSummary.terminalStop).toEqual({code:"stage_handoff_unconfirmed",stageId:"rolling_player_recompute"});
      }
      expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();
      expect(pipelineStateRows.get(stageKey("rolling_player_recompute"))).toEqual(before);
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

    describe("a stage left running by a dead invocation (audit C2, 2026-11-16)", () => {
      const scopeKey = "daily_incremental:2026-10-19";
      const beforeExecution = ["core_entity_freshness", "upstream_skater_sources", "contextual_builders",
        "rolling_player_recompute", "projection_input_ingest", "projection_relationship_build", "projection_derived_build"];
      const seedDone = (ids: string[]) => ids.forEach((id) => seedStageRow(id, {}));
      // The 10:20:29 invocation took the stage at 10:20:34 and never answered; its lease ran to 10:24:59.
      const seedDeadExecution = (owner: string) => seedStageRow("projection_execution", {
        revision: 4, status: "running", lease_owner: owner,
        lease_expires_at: "2026-10-19T10:24:59.000Z", updated_at: "2026-10-19T10:20:34.000Z"
      });
      const killReceipts = () =>
        [...pipelineStateRows.values()].filter((row) => row.operation_key.startsWith("projection_execution:kill:"));
      const recordKill = (owner: string) => recordRollingForgeStageKill({
        supabase: { from: pipelineStateFrom, rpc: pipelineStateRpc } as any, scopeKey,
        stageId: "projection_execution", runDate: "2026-10-19", expiredLeaseOwner: owner
      });

      it("retakes a replay-safe stage after its lease expired, counts the dead invocation once and finishes the run", async () => {
        seedDone(beforeExecution);
        seedDeadExecution("dead-10-20");

        const res = await invokeScheduled("2026-10-19T10:30:00.000Z");

        expect(res.statusCode).toBe(200);
        expect(res.body.termination).toMatchObject({ state: "completed" });
        expect(stageStatus(res, "projection_execution")).toMatchObject({
          status: "success", reason: expect.stringContaining("Retaken after 1 invocation(s) died holding it")
        });
        expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(1);
        expect(runProjectionV2Mock.mock.calls.map((call: any[]) => call[0].query.date)).toEqual(["2026-10-19", "2026-10-20"]);
        expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "complete", cursor_game_id: 2 });
        expect(killReceipts()).toHaveLength(1);
        expect(readRollingForgeStageKills(
          await readRollingForgeRunState({ supabase: { from: pipelineStateFrom } as any, scopeKey }), "projection_execution"
        )).toBe(1);
      });

      it("stops the run as stage_killed once three invocations died holding the stage, and stays stopped", async () => {
        seedDone(beforeExecution);
        await recordKill("dead-1");
        await recordKill("dead-2");
        seedDeadExecution("dead-3");

        const res = await invokeScheduled("2026-10-19T10:30:00.000Z");

        expect(res.statusCode).toBe(207);
        expect(res.body.termination).toMatchObject({
          state: "stopped_on_blocking_failure", resumeRequired: false, reason: "attempts_exhausted", nextStageId: "projection_execution"
        });
        expect(res.body.failureSummary.terminalStop).toEqual({ code: "stage_killed", stageId: "projection_execution" });
        expect(stageStatus(res, "projection_execution")).toMatchObject({ status: "failed", reason: expect.stringContaining("3 invocations died") });
        expect(killReceipts()).toHaveLength(3);

        const again = await invokeScheduled("2026-10-19T10:35:00.000Z");
        expect(again.body.failureSummary.terminalStop).toEqual({ code: "stage_killed", stageId: "projection_execution" });
        // The same dead owner is not counted twice.
        expect(killReceipts()).toHaveLength(3);
        expect(updateGoalieProjectionsV2Mock).not.toHaveBeenCalled();
        expect(runProjectionV2Mock).not.toHaveBeenCalled();
      });

      it("reports a lost handoff of a replay-safe stage as a retry and retakes it once the lease expires", async () => {
        seedDone(beforeExecution);
        const original = pipelineStateRpc.getMockImplementation()!;
        let lost = false;
        pipelineStateRpc.mockImplementation(async (name: string, a: any) => {
          if (!lost && a.p_operation_key === "projection_execution" && a.p_transition === "complete") {
            lost = true;
            return { data: null, error: { message: "fetch failed" } };
          }
          return original(name, a);
        });
        try {
          const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
          expect(first.body.termination).toMatchObject({
            reason: "retry_on_next_invocation", resumeRequired: true, nextStageId: "projection_execution",
            detail: expect.stringContaining("replay-safe")
          });
          expect(first.body.failureSummary.terminalStop).toBeNull();
          expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "running" });

          const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
          expect(second.statusCode).toBe(200);
          expect(stageStatus(second, "projection_execution").reason).toContain("Retaken after 1 invocation(s)");
          expect(killReceipts()).toHaveLength(1);
          // The finished dates and the goalie marker carried over: nothing ran twice.
          expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(1);
          expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
        } finally {
          pipelineStateRpc.mockImplementation(original);
        }
      });

      it("keeps a stored review hold on a replay-safe stage", async () => {
        seedDone(beforeExecution);
        seedStageRow("projection_execution", { status: "failed", last_error: "audit_persistence_unconfirmed" });

        const res = await invokeScheduled("2026-10-19T10:30:00.000Z");

        expect(res.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
        expect(res.body.failureSummary.terminalStop).toEqual({ code: "audit_persistence_unconfirmed", stageId: "projection_execution" });
        expect(updateGoalieProjectionsV2Mock).not.toHaveBeenCalled();
        expect(killReceipts()).toHaveLength(0);
      });

      it("does not take a replay-safe stage whose lease is still live", async () => {
        seedDone(beforeExecution);
        seedDeadExecution("live-owner");

        const res = await invokeScheduled("2026-10-19T10:22:00.000Z");

        expect(res.body.termination).toMatchObject({ state: "continuation_required", reason: "stage_in_progress_elsewhere" });
        expect(killReceipts()).toHaveLength(0);
        expect(updateGoalieProjectionsV2Mock).not.toHaveBeenCalled();
      });

      it("starts no projection date that cannot answer before the child-step deadline", async () => {
        seedDone(beforeExecution);
        // A slow goalie step leaves 38 s before the 228 s deadline: too little for a 30 s date plus its 15 s answer.
        updateGoalieProjectionsV2Mock.mockImplementationOnce(slowSuccess(190_000));

        const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(first, "projection_execution").status).toBe("partial");
        expect(first.body.termination).toMatchObject({ reason: "stage_partial", nextStageId: "projection_execution" });
        expect(runProjectionV2Mock).not.toHaveBeenCalled();

        const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
        expect(second.statusCode).toBe(200);
        expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(1);
        expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
      });
    });

    describe("child-step deadline (audit C2)", () => {
      const signal = () => {
        let resolve!: () => void;
        const promise = new Promise<void>((done) => { resolve = done; });
        return { promise, resolve };
      };
      const hangAfter = (entered: { resolve: () => void }) => () => {
        entered.resolve();
        return new Promise<void>(() => undefined);
      };

      beforeEach(() => {
        // A second useFakeTimers call keeps the first call's faked set, so reinstall.
        vi.useRealTimers();
        vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      });

      it("abandons a hung goalie step at 228 s, answers, fails the attempt and retries it next invocation", async () => {
        for (const id of ["core_entity_freshness", "upstream_skater_sources", "contextual_builders", "rolling_player_recompute",
          "projection_input_ingest", "projection_relationship_build", "projection_derived_build"]) seedStageRow(id, {});
        const entered = signal();
        updateGoalieProjectionsV2Mock.mockImplementationOnce(hangAfter(entered));

        const pending = invokeScheduled("2026-10-19T10:20:29.000Z");
        await entered.promise;
        await vi.advanceTimersByTimeAsync(228_000);
        const first = await pending;

        expect(Date.now() - Date.parse("2026-10-19T10:20:29.000Z")).toBeLessThan(240_000);
        const goalie = stageStatus(first, "projection_execution").steps[0];
        expect(goalie).toMatchObject({ id: "update-goalie-projections-v2", status: "failed", statusCode: 504, timedOut: true });
        expect(goalie).not.toHaveProperty("requiresReview");
        expect(first.body.termination).toMatchObject({ reason: "retry_on_next_invocation", resumeRequired: true });
        expect(first.body.failureSummary.firstFailure).toMatchObject({ stepId: "update-goalie-projections-v2", error: expect.stringContaining("Abandoned") });
        expect(runProjectionV2Mock).not.toHaveBeenCalled();
        expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "failed", last_error: "stage_failed:attempt-1" });

        const second = await invokeScheduled("2026-10-19T10:30:00.000Z");
        expect(second.statusCode).toBe(200);
        expect(updateGoalieProjectionsV2Mock).toHaveBeenCalledTimes(2);
        expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
      });

      it("holds a review-only stage whose child hung instead of replaying it", async () => {
        for (const id of ["core_entity_freshness", "upstream_skater_sources", "contextual_builders",
          "rolling_player_recompute", "projection_input_ingest"]) seedStageRow(id, {});
        const entered = signal();
        shiftChartsMock.mockImplementationOnce(hangAfter(entered));

        const pending = invokeScheduled("2026-10-19T10:05:00.000Z");
        await entered.promise;
        await vi.advanceTimersByTimeAsync(228_000);
        const first = await pending;

        expect(first.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
        expect(first.body.failureSummary.terminalStop).toEqual({ code: "stage_handoff_unconfirmed", stageId: "projection_relationship_build" });
        expect(pipelineStateRows.get(stageKey("projection_relationship_build"))).toMatchObject({
          status: "failed", last_error: "stage_handoff_unconfirmed"
        });

        const next = await invokeScheduled("2026-10-19T10:10:00.000Z");
        expect(next.body.failureSummary.terminalStop).toEqual({ code: "stage_handoff_unconfirmed", stageId: "projection_relationship_build" });
        expect(shiftChartsMock).toHaveBeenCalledTimes(1);
        expect(buildProjectionDerivedMock).not.toHaveBeenCalled();
      });
    });

    describe("standalone WGO skater readiness (TJ, 2026-11-22)", () => {
      const SOURCE = "2026-10-18";
      const projectionRunsFor = (date: string) =>
        runProjectionV2Mock.mock.calls.filter((call: any[]) => call[0].query.date === date).length;
      const pipelineAuditPreviews = () => auditInsertMock.mock.calls
        .map((call: any[]) => call[0])
        .filter((row: any) => row?.job_name === "run-rolling-forge-pipeline")
        .map((row: any) => String(row.details?.response ?? ""));
      // Fire the scheduled run at 10:05, 10:10 and 10:15 and return each response.
      const fireThree = async () => [
        await invokeScheduled("2026-10-19T10:05:00.000Z"),
        await invokeScheduled("2026-10-19T10:10:00.000Z"),
        await invokeScheduled("2026-10-19T10:15:00.000Z")
      ];
      const expectNotReady = (res: any, kinds: string[]) => {
        expect(res.statusCode).toBe(207);
        expect(res.body.termination).toMatchObject({ state: "continuation_required", resumeRequired: true,
          reason: "stage_partial", nextStageId: "upstream_skater_sources",
          detail: expect.stringContaining("the next scheduled slot checks again. WGO was not called.") });
        expect(res.body.failureSummary).toMatchObject({ failedStepCount: 0 });
        expect(res.body.wgoReadiness.ready).toBe(false);
        expect(res.body.wgoReadiness.gaps.map((gap: any) => gap.kind)).toEqual(kinds);
        expect(stageStatus(res, "upstream_skater_sources").steps.map((step: any) => [step.id, step.status]))
          .toEqual([["wgo-skater-readiness", "partial"]]);
        expect(nstStageRow()).toMatchObject({ status: "failed", last_error: "stage_handoff" });
      };

      it("consumes complete standalone inputs: one downstream run, zero WGO calls, receipt and cutoff recorded", async () => {
        const [first, second, third] = await fireThree();

        expect(first.body.wgoReadiness).toEqual({
          ready: true, sourceDate: SOURCE, checkedAt: "2026-10-19T10:05:00.000Z", dataCutoff: "2026-10-19T03:30:00.000Z",
          receipt: { jobName: "update-all-wgo-skaters", runTime: "2026-10-19T03:30:00.000Z", status: "success",
            url: "/api/v1/db/update-wgo-skaters?action=all", rowsAffected: 72, receiptsForDate: 1,
            sourceDigest: { rows: 72, md5: expect.stringMatching(/^[0-9a-f]{32}$/) },
            liveDigest: { rows: 72, md5: expect.stringMatching(/^[0-9a-f]{32}$/) } },
          requiredGames: 2, excludedGameIds: [], gapCount: 0, gaps: []
        });
        const readiness = stageStatus(first, "upstream_skater_sources").steps[0];
        expect(readiness.summary.coverage).toEqual([
          { gameId: 2025021023, homeSkaters: 18, roadSkaters: 18 }, { gameId: 2025021024, homeSkaters: 18, roadSkaters: 18 }]);
        // The pipeline's own audit preview carries the receipt and cutoff.
        expect(pipelineAuditPreviews()[0]).toContain('"wgoReadiness":{"ready":true');
        expect(pipelineAuditPreviews()[0]).toContain('"dataCutoff":"2026-10-19T03:30:00.000Z"');
        expect(third.body.termination.state).toBe("completed");
        expect([first, second, third].some(res => res.body.termination.state === "completed")).toBe(true);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        expect(updateWgoTotalsMock).not.toHaveBeenCalled();
        expect(updateNstGamelogMock).toHaveBeenCalledTimes(1);
        expect(updateRollingPlayerAveragesMock).toHaveBeenCalledTimes(1);
        expect(projectionRunsFor("2026-10-19")).toBe(1);
      });

      it("waits on partial inputs with exact game and team gaps, then runs once they are complete", async () => {
        // Game 2025021024: the road team (id 4) has 10 skaters; game 2025021023 lacks its home side.
        wgo.rows = (ids, date) => wgoDefaults.rows(ids, date).filter(row =>
          !(row.game_id === 2025021023 && row.home_road === "H") &&
          !(row.game_id === 2025021024 && row.home_road === "R" && row.player_id % 50 >= 10));

        const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expectNotReady(first, ["side_missing", "side_partial"]);
        expect(first.body.wgoReadiness.gaps).toEqual([
          { kind: "side_missing", gameId: 2025021023, teamId: 1 }, { kind: "side_partial", gameId: 2025021024, teamId: 4 }]);
        expect(first.body.termination.detail).toContain("No home skater rows for team 1 in game 2025021023.");
        expect(pipelineAuditPreviews()[0]).toContain('{"kind":"side_partial","gameId":2025021024,"teamId":4}');
        expect(updateNstGamelogMock).not.toHaveBeenCalled();
        expect(updateLineCombinationsMock).not.toHaveBeenCalled();

        const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
        expectNotReady(second, ["side_missing", "side_partial"]);

        // The standalone job's rows arrive (a manual job-9 rerun); the next slot proceeds.
        wgo.rows = (ids, date) => wgoDefaults.rows(ids, date);
        const third = await invokeScheduled("2026-10-19T10:15:00.000Z");
        expect(stageStatus(third, "upstream_skater_sources").status).toBe("success");
        await invokeScheduled("2026-10-19T10:20:00.000Z");
        expect(updateNstGamelogMock).toHaveBeenCalledTimes(1);
        expect(updateRollingPlayerAveragesMock).toHaveBeenCalledTimes(1);
        expect(projectionRunsFor("2026-10-19")).toBe(1);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      });

      it("names a finalized game with no rows at all", async () => {
        wgo.rows = (ids, date) => wgoDefaults.rows(ids, date).filter(row => row.game_id !== 2025021024);
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expectNotReady(res, ["game_missing"]);
        expect(res.body.wgoReadiness.gaps).toEqual([{ kind: "game_missing", gameId: 2025021024 }]);
      });

      it("refuses stale inputs captured before every game could have ended", async () => {
        // A 22:00 start ends no earlier than 01:00; the newest receipt ran at 00:30.
        wgo.games = date => wgoDefaults.games(date).map(game => ({ ...game, startTime: `${date}T22:00:00.000Z` }));
        wgo.receipts = date => [wgoDefaults.receipt(date, { run_time: "2026-10-19T00:30:00.000Z" })];
        const [first, second] = await fireThree();
        expectNotReady(first, ["producer_receipt_stale"]);
        expectNotReady(second, ["producer_receipt_stale"]);
        expect(first.body.wgoReadiness.receipt).toMatchObject({ runTime: "2026-10-19T00:30:00.000Z" });
        expect(updateNstGamelogMock).not.toHaveBeenCalled();
        expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      });

      it("waits for a late producer run, then runs once on the next slot", async () => {
        // Job 9 has not recorded the date by 10:05; it finishes at 10:12.
        wgo.receipts = date => [wgoDefaults.receipt(date, { run_time: "2026-10-19T10:12:00.000Z" })];
        const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expectNotReady(first, ["no_producer_receipt"]);
        expect(first.body.wgoReadiness.receipt).toBeNull();

        const second = await invokeScheduled("2026-10-19T10:15:00.000Z");
        expect(second.body.wgoReadiness).toMatchObject({ ready: true, dataCutoff: "2026-10-19T10:12:00.000Z" });
        await invokeScheduled("2026-10-19T10:20:00.000Z");
        await invokeScheduled("2026-10-19T10:25:00.000Z");
        expect(updateNstGamelogMock).toHaveBeenCalledTimes(1);
        expect(updateRollingPlayerAveragesMock).toHaveBeenCalledTimes(1);
        expect(projectionRunsFor("2026-10-19")).toBe(1);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      });

      it("takes the newest of duplicate producer receipts as the cutoff", async () => {
        wgo.receipts = date => [wgoDefaults.receipt(date), wgoDefaults.receipt(date, { run_time: "2026-10-19T09:00:00.000Z" })];
        const [first] = await fireThree();
        expect(first.body.wgoReadiness).toMatchObject({ ready: true, dataCutoff: "2026-10-19T09:00:00.000Z",
          receipt: { runTime: "2026-10-19T09:00:00.000Z", receiptsForDate: 2 } });
        expect(updateRollingPlayerAveragesMock).toHaveBeenCalledTimes(1);
        expect(projectionRunsFor("2026-10-19")).toBe(1);
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      });

      it("waits when the newest duplicate receipt for the date failed", async () => {
        wgo.receipts = date => [wgoDefaults.receipt(date), wgoDefaults.receipt(date, { run_time: "2026-10-19T09:00:00.000Z", status: "failure" },
          { datesProcessed: [], failedDates: [date], failedDatesCount: 1 })];
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expectNotReady(res, ["producer_receipt_failed"]);
        expect(res.body.wgoReadiness.receipt).toMatchObject({ runTime: "2026-10-19T09:00:00.000Z", status: "failure", receiptsForDate: 2 });
      });

      it("ignores the source date's own morning run, which can only skip it", async () => {
        wgo.receipts = date => [wgoDefaults.receipt(date, { run_time: `${date}T07:31:00.000Z` }, { datesProcessed: [], skippedDates: [date] })];
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expectNotReady(res, ["no_producer_receipt"]);
      });

      it("waits when a newer rerun skipped the date after an earlier green receipt", async () => {
        wgo.receipts = date => {
          const skipped = wgoDefaults.receipt(date, { run_time: "2026-10-19T09:00:00.000Z" }, { datesProcessed: [], skippedDates: [date] });
          skipped.details.url = `/api/v1/db/update-wgo-skaters?action=all&startDate=${date}`;
          return [wgoDefaults.receipt(date), skipped];
        };
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expectNotReady(res, ["producer_receipt_failed"]);
        expect(res.body.termination.detail).toContain("skipped the date");
      });

      it("waits while a game of the date is not final by its stored state, and excludes a postponed one", async () => {
        wgo.games = date => wgoDefaults.games(date).map((game, index) => index === 0
          ? { ...game, game_state: "LIVE" } : { ...game, game_schedule_state: "PPD", game_state: "FUT" });
        wgo.rows = () => [];
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expectNotReady(res, ["game_not_final"]);
        expect(res.body.wgoReadiness).toMatchObject({ excludedGameIds: [2025021024], gaps: [{ kind: "game_not_final", gameId: 2025021023 }] });
      });

      it("names rows filed under another date and a player listed twice", async () => {
        wgo.rows = (ids, date) => {
          const rows = wgoDefaults.rows(ids, date);
          rows[0] = { ...rows[0], date: "2026-10-17" };
          rows.push({ ...rows[40], game_id: 2025021024 });
          return rows;
        };
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expect(res.body.wgoReadiness.gaps.map((gap: any) => gap.kind)).toEqual(expect.arrayContaining(["row_date_mismatch", "duplicate_player"]));
        expect(res.body.wgoReadiness.ready).toBe(false);
      });

      describe("row proof: the data read must match the producer run's digest", () => {
        // 14 final games, 18 skaters a side: the 504 rows of 2026-11-21's real job-9 run.
        const fourteenGames = (date: string) => Array.from({ length: 14 }, (_unused, index) => ({
          ...wgoDefaults.games(date)[0], id: 2025021023 + index, homeTeamId: 2 * index + 1, awayTeamId: 2 * index + 2 }));
        const rewriteState = { committed: 0 };
        const rewrittenRows = (ids: number[], date: string) => wgoDefaults.rows(ids, date).map((row: any, index: number) =>
          index < rewriteState.committed ? { ...row, rewritten: true } : row);

        beforeEach(() => {
          wgo.games = fourteenGames;
          rewriteState.committed = 0;
          wgo.rows = rewrittenRows;
          // Job 9 recorded the digest of the original 504 rows.
          wgo.receipts = date => {
            const recorded = digestOf(wgoDefaults.rows(fourteenGames(date).map(game => game.id), date));
            return [wgoDefaults.receipt(date, { rows_affected: 504 }, { totalUpdates: 504, sourceDigests: { [date]: recorded } })];
          };
        });

        it("starts ready on the 504 rows job 9 recorded", async () => {
          const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
          expect(res.body.wgoReadiness).toMatchObject({ ready: true, requiredGames: 14,
            receipt: { sourceDigest: { rows: 504 }, liveDigest: { rows: 504 } } });
          expect(res.body.wgoReadiness.receipt.liveDigest).toEqual(res.body.wgoReadiness.receipt.sourceDigest);
        });

        it("defers a 504-row rewrite that commits 500 and then dies unaudited, with all 504 keys still present", async () => {
          rewriteState.committed = 500;
          const responses = [
            await invokeScheduled("2026-10-19T10:05:00.000Z"),
            await invokeScheduled("2026-10-19T10:10:00.000Z"),
            await invokeScheduled("2026-10-19T10:15:00.000Z")
          ];
          for (const res of responses) expectNotReady(res, ["data_changed_since_receipt"]);
          // Coverage alone would pass: every game has 18 + 18 rows.
          expect(stageStatus(responses[0], "upstream_skater_sources").steps[0].summary.coverage
            .every((game: any) => game.homeSkaters === 18 && game.roadSkaters === 18)).toBe(true);
          expect(responses[0].body.termination.detail).toContain("no longer matches the 2026-10-19T03:30:00.000Z run (recorded 504 rows");
          expect(updateNstGamelogMock).not.toHaveBeenCalled();
          expect(updateRollingPlayerAveragesMock).not.toHaveBeenCalled();
          expect(runProjectionV2Mock).not.toHaveBeenCalled();
          expect(updateWgoSkatersMock).not.toHaveBeenCalled();
        });

        it("defers the same rewrite when its failure is audited", async () => {
          rewriteState.committed = 500;
          const original = wgo.receipts;
          wgo.receipts = date => [...original(date), wgoDefaults.receipt(date,
            { run_time: "2026-10-19T09:00:00.000Z", status: "failure", rows_affected: 500 },
            { success: false, totalUpdates: 500, datesProcessed: [], failedDates: [date], failedDatesCount: 1, sourceDigests: {} })];
          const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
          expectNotReady(res, ["producer_receipt_failed"]);
          expect(updateNstGamelogMock).not.toHaveBeenCalled();
        });

        it("defers a receipt that recorded no digest (job-9 rows written before the digest writer)", async () => {
          wgo.receipts = date => [wgoDefaults.receipt(date, { rows_affected: 504 }, { sourceDigests: {} })];
          const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
          expectNotReady(res, ["producer_digest_missing"]);
          expect(wgo.reads).not.toContain("wgo_skater_date_digest");
        });

        it("defers when the digest cannot be recomputed (the RPC is not there yet)", async () => {
          wgo.digestError = { message: "Could not find the function public.wgo_skater_date_digest" };
          const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
          expectNotReady(res, ["read_failed"]);
          expect(res.body.termination.detail).toContain("Could not read the wgo_skater_stats digest for 2026-10-18");
        });
      });

      it("off-day control: a date with no stored games needs no WGO rows, and NST still decides the off day", async () => {
        wgo.games = () => [];
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) =>
          res.status(200).json({ success: true, operationStatus: "skipped_no_completed_games", nstProgress: { verifiedOffDates: [SOURCE] } }));
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expect(res.body.wgoReadiness).toMatchObject({ ready: true, requiredGames: 0, receipt: null, dataCutoff: null, gaps: [] });
        expect(wgo.reads).toEqual(["games"]);
        expect(stageStatus(res, "upstream_skater_sources").steps.map((step: any) => [step.id, step.status])).toEqual([
          ["wgo-skater-readiness", "success"], ["update-nst-gamelog", "skipped"]]);
        expect(nstStageRow()).toMatchObject({ status: "complete" });
        expect(updateWgoSkatersMock).not.toHaveBeenCalled();
      });

      it("an unverified empty schedule still blocks in NST", async () => {
        wgo.games = () => [];
        updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) =>
          res.status(200).json({ success: false, message: "Incomplete NST work", nstProgress: { missingScheduleDates: [SOURCE] } }));
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expect(stageStatus(res, "upstream_skater_sources").status).toBe("failed");
        expect(updateLineCombinationsMock).not.toHaveBeenCalled();
      });
    });

    describe("power-play context (audit M4)", () => {
      const contextual = (res: any) => stageStatus(res, "contextual_builders");

      it("names completed games still without power-play rows as deferred and does not block the day", async () => {
        ppCombosInMock.mockImplementationOnce(async (_column: string, gameIds: number[]) => ({
          data: [{ gameId: gameIds[0] }], error: null
        }));

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(res.statusCode).toBe(200);
        expect(contextual(res).status).toBe("success");
        const verify = contextual(res).steps.find((step: any) => step.id === "verify-pp-context");
        expect(verify).toMatchObject({
          status: "skipped", degraded: "pp_context_deferred",
          summary: { completedGames: 2, missingPowerPlayGameIds: [2025021024] }
        });
        expect(verify.reason).toMatch(/^Deferred: no power-play rows yet for 1 completed game\(s\) \(2025021024\)/);
        expect(res.body.failureSummary.degradedSteps).toEqual([
          expect.objectContaining({ stageId: "contextual_builders", stepId: "verify-pp-context", code: "pp_context_deferred" })
        ]);
        expect(updateRollingPlayerAveragesMock).toHaveBeenCalled();
      });

      it("passes the verification when every completed game has power-play rows", async () => {
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(contextual(res).steps.find((step: any) => step.id === "verify-pp-context")).toMatchObject({
          status: "success", summary: { missingPowerPlayGameIds: [] }
        });
        expect(res.body.failureSummary.degradedSteps).toEqual([]);
      });

      it("reports a power-play route that wrote nothing as skipped, not success", async () => {
        updatePowerPlayCombinationsMock.mockImplementationOnce(async (_req: any, res: any) => {
          res.status(200).json({ success: true, skipped: true, reason: "pp_stored_calculation_writes_disabled",
            message: "Power-play stored-calculation writes are off; nothing was written." });
        });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        const pp = contextual(res).steps.find((step: any) => step.id === "update-power-play-combinations-batch");
        expect(pp).toMatchObject({ status: "skipped", reason: "The power-play route wrote nothing (pp_stored_calculation_writes_disabled)." });
        expect(contextual(res).steps.some((step: any) => step.id === "verify-pp-context")).toBe(false);
        expect(ppCombosInMock).not.toHaveBeenCalled();
        expect(contextual(res).status).toBe("success");
      });
    });

    describe("one rejected shift chart (audit H1, 2026-11-14/15)", () => {
      const rejected = {
        gameId: 2026020310, date: "2026-10-18", stage: "precheck_shifts", isolated: true, retryPending: true,
        message: "Shift clock/duration mismatch for game 2026020310, player 8480947; period=1 start_s=0 end_s=481 duration_s=470"
      };

      it("degrades the ingest stage, names the game and runs the day's projections", async () => {
        ingestProjectionInputsMock.mockImplementationOnce(async (_req: any, res: any) => {
          res.status(200).json({ success: false, timedOut: false, gamesProcessed: 13, skipped: 1,
            skipReasons: { sourceDataRejected: 1 }, errors: [rejected] });
        });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(res.statusCode).toBe(200);
        expect(res.body.termination).toMatchObject({ state: "completed" });
        const ingest = stageStatus(res, "projection_input_ingest");
        expect(ingest.status).toBe("success");
        expect(ingest.steps[0]).toMatchObject({ status: "success", degraded: "projection_input_games_rejected" });
        expect(ingest.steps[0].reason).toContain("1 game(s) skipped by the NHL source checks");
        expect(ingest.steps[0].reason).toContain("Parked for retry on later runs: 2026020310.");
        expect(res.body.failureSummary).toMatchObject({
          failedStepCount: 0,
          degradedSteps: [{ stageId: "projection_input_ingest", stepId: "ingest-projection-inputs", code: "projection_input_games_rejected" }]
        });
        expect(runProjectionV2Mock).toHaveBeenCalledTimes(2);
      });

      it("still fails the stage when any error is not an isolated game", async () => {
        ingestProjectionInputsMock.mockImplementationOnce(async (_req: any, res: any) => {
          res.status(200).json({ success: false, timedOut: false, errors: [rejected,
            { gameId: 2026020311, date: "2026-10-18", stage: "persist_inputs", message: "transaction rejected" }] });
        });

        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");

        expect(stageStatus(res, "projection_input_ingest").status).toBe("failed");
        expect(res.body.termination).toMatchObject({ reason: "retry_on_next_invocation", nextStageId: "projection_input_ingest" });
        expect(res.body.failureSummary.degradedSteps).toEqual([]);
        expect(runProjectionV2Mock).not.toHaveBeenCalled();
      });
    });

    it("gives the ingest step the time left before the child-step deadline and resumes it after a budget stop", async () => {
      ingestProjectionInputsMock.mockImplementationOnce(async (_req: any, res: any) => {
        res.status(200).json({ success: false, timedOut: true, nextGameId: 2025021024, errors: [] });
      });

      const first = await invokeScheduled("2026-10-19T10:05:00.000Z");

      const query = ingestProjectionInputsMock.mock.calls[0][0].query;
      expect(Object.keys(query)).toEqual(["maxDurationMs"]);
      expect(Number(query.maxDurationMs)).toBeLessThanOrEqual(228_000 - 25_000);
      expect(stageStatus(first, "projection_input_ingest").status).toBe("partial");
      expect(first.body.termination).toMatchObject({ reason: "stage_partial", nextStageId: "projection_input_ingest" });
      expect(first.body.failureSummary.failedStepCount).toBe(0);

      const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
      expect(second.statusCode).toBe(200);
      expect(ingestProjectionInputsMock).toHaveBeenCalledTimes(2);
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
      expect(projections[1].reason).toContain("Days-ahead projection for 2026-10-20 failed (non-blocking): HTTP 422; failed gates goalie_start_priors_v2");
      // The skipped date counts as handled, so a re-entry does not retry it.
      expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "complete", cursor_game_id: 2 });
      expect(runProjectionAccuracyMock).not.toHaveBeenCalled();
    });

    describe("days ahead (FORGE_PROJECTION_DAYS_AHEAD)", () => {
      afterEach(() => vi.unstubAllEnvs());

      it.each([[undefined, 1], ["", 1], ["0", 0], ["1", 1], ["6", 6], ["7", 1], ["-1", 1], ["2.5", 1], ["six", 1]])(
        "reads %j as %i day(s) ahead", (value, days) => {
          expect(forgeProjectionDaysAhead(value === undefined ? {} : { FORGE_PROJECTION_DAYS_AHEAD: value })).toBe(days);
        });

      it("projects the run date through six days ahead, in date order, with goalie priors through the last date", async () => {
        vi.stubEnv("FORGE_PROJECTION_DAYS_AHEAD", "6");
        const res = await invokeScheduled("2026-10-19T10:05:00.000Z");
        expect(res.statusCode).toBe(200);
        expect(updateGoalieProjectionsV2Mock.mock.calls[0][0].query).toEqual({ limit: "7", endDate: "2026-10-25" });
        expect(runProjectionV2Mock.mock.calls.map((call: any[]) => call[0].query.date)).toEqual([
          "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
        expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "complete", cursor_game_id: 7 });
      });

      it("keeps going past a failed date ahead, and resumes after the last handled date", async () => {
        vi.stubEnv("FORGE_PROJECTION_DAYS_AHEAD", "3");
        runProjectionV2Mock
          .mockImplementationOnce(slowSuccess(10_000))
          .mockImplementationOnce(async (_req: any, res: any) => {
            res.status(422).json({ success: false, error: "Preflight failed", preflight: { status: "FAIL", gates: [{ gate_key: "goalie_start_priors_v2", status: "FAIL" }] } });
          })
          .mockImplementationOnce(slowSuccess(160_000));
        const first = await invokeScheduled("2026-10-19T10:05:00.000Z");
        // 10-21 used the rest of the budget; 10-22 waits for the next invocation.
        expect(first.statusCode).toBe(207);
        expect(runProjectionV2Mock.mock.calls.map((call: any[]) => call[0].query.date)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
        expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ cursor_game_id: 3 });

        const second = await invokeScheduled("2026-10-19T10:10:00.000Z");
        expect(second.statusCode).toBe(200);
        expect(runProjectionV2Mock.mock.calls.slice(3).map((call: any[]) => call[0].query.date)).toEqual(["2026-10-22"]);
        expect(pipelineStateRows.get(stageKey("projection_execution"))).toMatchObject({ status: "complete", cursor_game_id: 4 });
      });

      it("projects only the run date with 0 days ahead, and asks for goalie priors through today only", async () => {
        vi.stubEnv("FORGE_PROJECTION_DAYS_AHEAD", "0");
        await invokeScheduled("2026-10-19T10:05:00.000Z");
        expect(updateGoalieProjectionsV2Mock.mock.calls[0][0].query).toEqual({ limit: "7" });
        expect(runProjectionV2Mock.mock.calls.map((call: any[]) => call[0].query.date)).toEqual(["2026-10-19"]);
      });
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

  describe("invokeRouteStep child deadline", () => {
    const step = (handler: any, deadlineAtMs: number) => __testables.invokeRouteStep({ id: "child", route: "/api/v1/db/child", handler, deadlineAtMs });

    it("abandons a child that has not answered by the deadline", async () => {
      const result = await step(() => new Promise<void>(() => undefined), Date.now() + 20);
      expect(result).toMatchObject({ status: "failed", statusCode: 504, timedOut: true, summary: null });
      expect(result.reason).toContain("Abandoned");
    });

    it("returns the child's answer and leaves no timer behind", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const result = await step(async (_req: any, res: any) => { res.status(200).json({ success: true }); }, Date.now() + 60_000);
        expect(result).toMatchObject({ status: "success", statusCode: 200 });
        expect(result).not.toHaveProperty("timedOut");
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not start a child once the deadline has passed", async () => {
      const handler = vi.fn();
      const result = await step(handler, Date.now() - 1);
      expect(handler).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "partial", statusCode: 0 });
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

// Appended to the unchanged owner's test harness prefix in an isolated test file.
// Existing candidate source/tests stay byte-identical. All providers are mocked.
import serverClient from "lib/supabase/server";

describe("NST acquisition and uncertain-persistence regressions", () => {
  const stageKey = (id: string) => `rolling_forge_pipeline|daily_incremental:2026-10-19|${id}`;
  const stageRow = () => pipelineStateRows.get(stageKey("upstream_skater_sources"));
  const originalRpc = pipelineStateRpc.getMockImplementation()!;
  const originalFrom = vi.mocked(serverClient.from).getMockImplementation()!;
  const success = async (_req: any, res: any) => res.status(200).json({ success: true });
  const signal = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
  };
  const invoke = async (query: Record<string, string> = {}) => {
    const res = createMockRes();
    await handler({ method: "GET", headers: {}, query: { mode: "daily_incremental", includeAccuracy: "false", ...query } } as any, res);
    return res;
  };
  const seed = (id: string, extras: Record<string, unknown> = {}) => pipelineStateRows.set(stageKey(id), {
    pipeline_key: "rolling_forge_pipeline", scope_key: "daily_incremental:2026-10-19", operation_key: id,
    revision: 1, status: "complete", cursor_game_id: null, cursor_date: "2026-10-19",
    range_start_date: "2026-10-19", range_end_date: "2026-10-19", lease_owner: null,
    lease_expires_at: null, last_error: null, updated_at: "2026-10-19T10:04:00.000Z", ...extras
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T10:05:00.000Z"));
    pipelineStateRows.clear();
    resetWgoFixture();
    pipelineStateRpc.mockImplementation(originalRpc);
    vi.mocked(serverClient.from).mockImplementation(originalFrom);
    process.env.CRON_SECRET = "test-secret";
    for (const mock of [updateGamesMock, updateTeamsMock, updatePlayersMock, updateNstGamelogMock,
      updateWgoSkatersMock, updateWgoTotalsMock, updateWgoAveragesMock, updateLineCombinationsMock,
      updatePowerPlayCombinationsMock, updateRollingPlayerAveragesMock, ingestProjectionInputsMock,
      shiftChartsMock, buildProjectionDerivedMock, updateGoalieProjectionsV2Mock, runProjectionV2Mock, runProjectionAccuracyMock]) {
      mock.mockReset().mockImplementation(success);
    }
    seed("core_entity_freshness");
    seed("upstream_skater_sources", { status: "failed", last_error: "stage_handoff", cursor_game_id: 7 });
  });
  afterEach(() => {
    pipelineStateRpc.mockImplementation(originalRpc);
    vi.mocked(serverClient.from).mockImplementation(originalFrom);
    vi.useRealTimers();
  });

  it.each(["manual-lost", "manual-rejected", "shared-missing", "shared-null", "shared-empty", "shared-rejected", "shared-thrown"])
    ("holds %s after one child write and never replays on the second natural invocation", async (kind) => {
    let writes = 0;
    const operation = async (_req: any, out: any) => { writes++; out.json({ success: true, rowsUpserted: 2 }); };
    if (kind.startsWith("manual")) {
      updateNstGamelogMock.mockImplementation(withManualCronAuditResponse(async (req, out) => {
        await operation(req, out);
        await persistManualCronAudit({ from: () => ({ insert: () => kind === "manual-lost"
          ? Promise.reject(new Error("lost acknowledgement")) : Promise.resolve({ error: { message: "rejected" } }) }) }, {});
      }));
    } else {
      const receipt = kind === "shared-null" ? null : kind === "shared-empty" ? {} : kind === "shared-rejected" ? { error: { message: "rejected" } } : undefined;
      if (kind === "shared-thrown") auditInsertMock.mockRejectedValueOnce(new Error("lost acknowledgement"));
      else auditInsertMock.mockResolvedValueOnce(receipt);
      // Model a child that promises a final receipt, not a best-effort audit.
      updateNstGamelogMock.mockImplementation(withCronJobAudit(operation, { includeFinalAuditReceipt: true }));
    }
    const first = await invoke();
    const child = first.body.stages.find((stage: any) => stage.id === "upstream_skater_sources").steps.find((step: any) => step.id === "update-nst-gamelog");
    expect(child.summary).toMatchObject({ rowsUpserted: 2, operationOutcome: { statusCode: 200, success: true }, finalAudit: { retrySafe: false } });
    expect(first.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
    expect(stageRow()).toMatchObject({ status: "failed", last_error: "audit_persistence_unconfirmed" });
    expect(updateWgoSkatersMock).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-19T10:10:00.000Z")); const second = await invoke();
    expect(writes).toBe(1); expect(second.body.termination).toMatchObject({ reason: "manual_review_required", resumeRequired: false });
    expect(second.body.failureSummary.terminalStop.code).toBe("audit_persistence_unconfirmed");
  });

  it("must preserve a durable manual-review hold when another same-version invocation read state before the hold", async () => {
    const enteredNst = signal(), releaseNst = signal(), readSnapshot = signal(), releaseSnapshot = signal();
    updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) => {
      enteredNst.resolve();
      await releaseNst.promise;
      res.status(500).json({ success: false, error: "audit acknowledgement lost", auditPersistence: "not_confirmed" });
    });
    const firstPromise = invoke();
    await enteredNst.promise;
    let intercept = true;
    vi.mocked(serverClient.from).mockImplementation(((table: string) => {
      const query = originalFrom(table as any);
      if (table === "projection_pipeline_state" && intercept) {
        intercept = false;
        const originalThen = (query as any).then;
        (query as any).then = (resolve: any, reject: any) => originalThen(async (snapshot: any) => {
          readSnapshot.resolve();
          await releaseSnapshot.promise;
          return resolve(snapshot);
        }, reject);
      }
      return query;
    }) as any);
    const observerPromise = invoke();
    await readSnapshot.promise;
    releaseNst.resolve();
    const first = await firstPromise;
    expect(first.body.termination.reason).toBe("manual_review_required");
    expect(stageRow().last_error).toBe("nst_persistence_unconfirmed");
    releaseSnapshot.resolve();
    const observer = await observerPromise;
    console.log("REVIEW_RACE_OBSERVED", JSON.stringify({ nstCalls: updateNstGamelogMock.mock.calls.length,
      observerTermination: observer.body.termination, finalStage: stageRow() }));
    expect.soft(updateNstGamelogMock).toHaveBeenCalledTimes(1);
    expect.soft(observer.body.termination.reason).toBe("manual_review_required");
    expect.soft(stageRow().last_error).toBe("nst_persistence_unconfirmed");
  });

  it("must not advertise retry when a manual-review hold cannot be saved", async () => {
    pipelineStateRpc.mockImplementation(async (name: string, args: any) => {
      if (args.p_transition === "fail" && args.p_last_error === "nst_persistence_unconfirmed") {
        return { data: null, error: { message: "synthetic hold persistence failure" } };
      }
      return originalRpc(name, args);
    });
    updateNstGamelogMock.mockImplementationOnce(async (_req: any, res: any) =>
      res.status(500).json({ success: false, error: "write acknowledgement lost", writePersistence: "not_confirmed" }));
    const first = await invoke();
    console.log("REVIEW_FAILED_HOLD_FIRST", JSON.stringify({ termination: first.body.termination, row: stageRow() }));
    expect.soft(first.body.termination).toMatchObject({ resumeRequired: false, reason: "manual_review_required" });
    vi.setSystemTime(new Date("2026-10-19T10:15:00.000Z"));
    const next = await invoke();
    console.log("REVIEW_FAILED_HOLD_NEXT", JSON.stringify({ nstCalls: updateNstGamelogMock.mock.calls.length,
      termination: next.body.termination, row: stageRow() }));
    expect.soft(updateNstGamelogMock).toHaveBeenCalledTimes(1);
    expect.soft(updateWgoSkatersMock).not.toHaveBeenCalled();
  });

  it.each(["projection_relationship_build", "rolling_player_recompute"])("never replays %s when both child audit and review-hold persistence fail", async (stageId) => {
    let writes=0;
    const child=withManualCronAuditResponse(async(_req:any,out:any)=>{
      writes++;out.json({success:true,rowsUpserted:2});
      await persistManualCronAudit({from:()=>({insert:()=>Promise.reject(new Error("lost child audit"))})},{});
    });
    (stageId==="projection_relationship_build"?shiftChartsMock:updateRollingPlayerAveragesMock).mockImplementation(child);
    pipelineStateRpc.mockImplementation(async(name:string,a:any)=>a.p_transition==="fail"&&a.p_last_error==="audit_persistence_unconfirmed"
      ? {data:null,error:{message:"unavailable review-hold store"}} : originalRpc(name,a));
    const first=await invoke();const before=pipelineStateRows.get(stageKey(stageId));
    expect(writes).toBe(1);expect(before).toMatchObject({status:"running",last_error:null});
    expect(first.body.termination).toMatchObject({reason:"manual_review_required",resumeRequired:false});
    vi.setSystemTime(new Date("2026-10-19T10:10:00Z"));const second=await invoke();
    expect(writes).toBe(1);expect(second.body.termination).toMatchObject({reason:"manual_review_required",resumeRequired:false,nextStageId:stageId});
    expect(second.body.failureSummary.terminalStop.code).toBe("stage_handoff_unconfirmed");
    expect(pipelineStateRows.get(stageKey(stageId))).toEqual(before);
    expect(second.body.termination.detail).toContain("acknowledged handoff");
  });

});

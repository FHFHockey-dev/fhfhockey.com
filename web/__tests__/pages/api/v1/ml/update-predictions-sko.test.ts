import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assertPredictionsSkoPrerequisitesMock,
  authGetUserMock,
  serviceRoleRpcMock,
  serviceRoleClientMock,
  getCurrentSeasonMock,
  issue,
} = vi.hoisted(() => ({
  assertPredictionsSkoPrerequisitesMock: vi.fn(),
  authGetUserMock: vi.fn(),
  serviceRoleRpcMock: vi.fn(),
  serviceRoleClientMock: { from: vi.fn(), rpc: vi.fn() },
  getCurrentSeasonMock: vi.fn(),
  issue: {
    code: "missing_player_stats_unified",
    message:
      "Missing prerequisite data in player_stats_unified for sKO prediction refresh.",
    detail:
      "No eligible player_stats_unified rows were found between 2025-11-21 and 2026-03-21.",
    action:
      "Refresh player_stats_unified before running /api/v1/ml/update-predictions-sko.",
  } as const,
}));

vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (routeHandler: unknown) => routeHandler,
}));

vi.mock("lib/supabase", () => ({
  createClientWithToken: () => ({
    auth: { getUser: authGetUserMock },
  }),
}));

vi.mock("../../../../../lib/ml/predictionsSkoDependencyChecks", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../lib/ml/predictionsSkoDependencyChecks")
  >("../../../../../lib/ml/predictionsSkoDependencyChecks");
  return {
    ...actual,
    assertPredictionsSkoPrerequisites: assertPredictionsSkoPrerequisitesMock,
  };
});

vi.mock("../../../../../lib/supabase/server", () => ({
  default: serviceRoleClientMock,
}));

vi.mock("../../../../../lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock,
}));

import handler, {
  buildPredictionRecord,
  fetchSeriesPaginated,
  predictionScopeDigest,
  resolveSkoSeasonExecution,
} from "../../../../../pages/api/v1/ml/update-predictions-sko";
import { PredictionsSkoDependencyError } from "../../../../../lib/ml/predictionsSkoDependencyChecks";
import { buildPredictionsSkoHealth } from "../../../../../lib/ml/predictionsSkoRunControl";

const modelHistoryMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260729205048_preserve_sko_model_history.sql",
  ),
  "utf8",
);

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe("/api/v1/ml/update-predictions-sko", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "current-secret";
    authGetUserMock.mockResolvedValue({
      error: { message: "Invalid bearer token" },
    });
    assertPredictionsSkoPrerequisitesMock.mockResolvedValue(undefined);
    getCurrentSeasonMock.mockResolvedValue({
      seasonId: 20252026,
      regularSeasonStartDate: "2025-10-07",
      regularSeasonEndDate: "2026-04-16",
    });
    serviceRoleClientMock.rpc.mockImplementation(serviceRoleRpcMock);
    serviceRoleRpcMock.mockImplementation(async (name: string) => ({
      data:
        name === "acquire_sko_prediction_run"
          ? [
              {
                acquired: true,
                lease_expires_at: "2026-03-21T12:15:00Z",
                attempt_count: 3,
              },
            ]
          : true,
      error: null,
    }));
  });

  it.each([
    ["GET", undefined],
    ["POST", "Bearer stale-secret"],
  ])(
    "rejects unauthenticated %s mutations before dependency or write work",
    async (method, authorization) => {
      const req: any = {
        method,
        headers: authorization ? { authorization } : {},
        query: {},
        body: {},
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        message: "Unauthorized.",
        success: false,
      });
      expect(assertPredictionsSkoPrerequisitesMock).not.toHaveBeenCalled();
    },
  );

  it("returns a structured prerequisite failure when player_stats_unified is unavailable", async () => {
    assertPredictionsSkoPrerequisitesMock.mockRejectedValue(
      new PredictionsSkoDependencyError(issue),
    );

    const req: any = {
      method: "GET",
      headers: {
        authorization: "Bearer current-secret",
      },
      query: {
        asOfDate: "2026-03-21",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(424);
    expect(res.body.success).toBe(false);
    expect(res.body.rowsUpserted).toBe(0);
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });

  it("classifies official-season boundaries deterministically", () => {
    expect(
      resolveSkoSeasonExecution({
        asOfDate: "2026-04-16",
        regularSeasonStartDate: "2025-10-07T00:00:00Z",
        regularSeasonEndDate: "2026-04-16T00:00:00Z",
      }),
    ).toMatchObject({
      shouldRun: true,
      reason: "in_official_nhl_season",
    });
    expect(
      resolveSkoSeasonExecution({
        asOfDate: "2026-07-30",
        regularSeasonStartDate: "2025-10-07",
        regularSeasonEndDate: "2026-04-16",
      }),
    ).toMatchObject({
      shouldRun: false,
      reason: "outside_official_nhl_season",
    });
  });

  it("records a truthful offseason no-write run before source or publication work", async () => {
    const req: any = {
      method: "POST",
      headers: { authorization: "Bearer current-secret" },
      query: { asOfDate: "2026-07-30" },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      skipped: true,
      skipReason: "outside_official_nhl_season",
      rowsUpserted: 0,
      health: { status: "ok", alerts: [] },
      runManifest: { state: "succeeded" },
    });
    expect(assertPredictionsSkoPrerequisitesMock).not.toHaveBeenCalled();
    expect(serviceRoleClientMock.from).not.toHaveBeenCalled();
  });

  it("pages the source scan and keeps each player's latest 60 games in date order", async () => {
    const rows = Array.from({ length: 65 }, (_, index) => ({
      player_id: 7,
      date: `2026-01-01T00:00:00Z`,
      points: index,
      games_played: 1,
    })).map((row, index) => ({
      ...row,
      date: new Date(Date.parse(row.date) + index * 86_400_000)
        .toISOString()
        .slice(0, 10),
    }));
    rows.push({ player_id: 3, date: "2026-02-01", points: 1, games_played: 1 });
    const loadPage = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));

    const result = await fetchSeriesPaginated(loadPage, 40);

    expect(loadPage).toHaveBeenNthCalledWith(1, 0, 39);
    expect(loadPage).toHaveBeenNthCalledWith(2, 40, 79);
    expect(result.pages).toBe(2);
    expect(result.rowsScanned).toBe(66);
    const series7 = result.seriesByPlayer.get(7)!;
    expect(series7).toHaveLength(60);
    expect(series7[0].points).toBe(5);
    expect(series7.at(-1)!.points).toBe(64);
    expect(result.seriesByPlayer.get(3)).toHaveLength(1);
  });

  it("returns deterministic coverage, source-lag, model, and write diagnostics", async () => {
    const seriesBuilder = sourceBuilder([
        { player_id: 2, date: "2026-03-20", points: 2, games_played: 1 },
        { player_id: 2, date: "2026-03-19", points: 0, games_played: 1 },
      ]);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    serviceRoleClientMock.from.mockImplementation((table: string) => {
      if (table === "player_stats_unified") return seriesBuilder;
      if (table === "predictions_sko") return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    const req: any = {
      method: "POST",
      headers: { authorization: "Bearer current-secret" },
      query: {
        asOfDate: "2026-03-21",
        playerIds: "2,1",
        batchSize: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      players: 1,
      upserts: 1,
      rowsUpserted: 1,
      partial: true,
      model: { name: "baseline-moving-average", version: "v0.4" },
      coverage: {
        discoveredPlayers: 2,
        selectedPlayers: 1,
        processedPlayers: 1,
        skippedNoSeries: 0,
        sourceRows: 2,
        minSeriesLength: 2,
        maxSeriesLength: 2,
      },
      source: {
        requestedAsOfDate: "2026-03-21",
        earliestDate: "2026-03-19",
        latestDate: "2026-03-20",
        lagDays: 1,
      },
      write: {
        attemptedRows: 1,
        upsertedRows: 1,
        batchesCompleted: 1,
        partial: false,
      },
      health: { status: "ok", alerts: [] },
      warnings: [],
      runManifest: {
        runKey: "sko-predictions:baseline-moving-average:v0.4:2026-03-21:5",
        attempt: 3,
        state: "succeeded",
      },
    });
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ player_id: 2 })],
      {
        onConflict:
          "player_id,as_of_date,horizon_games,model_name,model_version",
      },
    );
    expect(serviceRoleRpcMock.mock.calls.map((call) => call[0])).toEqual([
      "acquire_sko_prediction_run",
      "finish_sko_prediction_run",
    ]);
  });

  it("defines model-complete history identity and read-only public grants", () => {
    expect(modelHistoryMigrationSql).toMatch(
      /primary key \(\s*player_id,\s*as_of_date,\s*horizon_games,\s*model_name,\s*model_version\s*\)/,
    );
    expect(modelHistoryMigrationSql).toContain(
      "revoke all on table public.predictions_sko from anon, authenticated",
    );
    expect(modelHistoryMigrationSql).toContain(
      "grant select on table public.predictions_sko to anon, authenticated",
    );
    expect(modelHistoryMigrationSql).not.toMatch(
      /grant\s+(?:insert|update|delete)[^;]*\b(?:anon|authenticated)\b/i,
    );
  });

  it("returns an exact dry-run manifest without changing prediction rows", async () => {
    const seriesBuilder = sourceBuilder([{ player_id: 2, date: "2026-03-22", points: 2, games_played: 1 }]);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    serviceRoleClientMock.from.mockImplementation((table: string) => {
      if (table === "player_stats_unified") return seriesBuilder;
      if (table === "predictions_sko") return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    const req: any = {
      method: "POST",
      headers: { authorization: "Bearer current-secret" },
      query: {
        asOfDate: "2026-03-22",
        playerIds: "2",
        dryRun: "true",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      dryRun: true,
      players: 1,
      upserts: 0,
      rowsUpserted: 0,
      wouldUpsertRows: 1,
      write: {
        attemptedRows: 1,
        upsertedRows: 0,
        batchesCompleted: 0,
        partial: false,
      },
      health: { status: "ok", alerts: [] },
      runManifest: { state: "succeeded" },
    });
    expect(res.body.write.scopeDigest).toBe(
      predictionScopeDigest([
        {
          player_id: 2,
          as_of_date: "2026-03-22",
          horizon_games: 5,
          model_name: "baseline-moving-average",
          model_version: "v0.4",
        },
      ]),
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("skips publication and warns when in-season source lag exceeds 72 hours", async () => {
    const seriesBuilder = sourceBuilder([{ player_id: 2, date: "2026-03-16", points: 2, games_played: 1 }]);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    serviceRoleClientMock.from.mockImplementation((table: string) => {
      if (table === "player_stats_unified") return seriesBuilder;
      if (table === "predictions_sko") return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    const req: any = {
      method: "POST",
      headers: { authorization: "Bearer current-secret" },
      query: { asOfDate: "2026-03-21", playerIds: "2" },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      skipped: true,
      skipReason: "source_lag_exceeds_72_hours",
      rowsUpserted: 0,
      source: { latestDate: "2026-03-16", lagDays: 5 },
      write: { attemptedRows: 0, upsertedRows: 0 },
      health: {
        status: "warning",
        alerts: [expect.objectContaining({ code: "stale_source" })],
      },
      runManifest: { state: "succeeded" },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects an overlapping run before dependency or write work", async () => {
    serviceRoleRpcMock.mockResolvedValueOnce({
      data: [
        {
          acquired: false,
          lease_expires_at: "2026-03-21T12:15:00Z",
          attempt_count: 3,
        },
      ],
      error: null,
    });
    const req: any = {
      method: "POST",
      headers: { authorization: "Bearer current-secret" },
      query: { asOfDate: "2026-03-21" },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      retryable: true,
      runKey: "sko-predictions:baseline-moving-average:v0.4:2026-03-21:5",
      leaseExpiresAt: "2026-03-21T12:15:00Z",
    });
    expect(assertPredictionsSkoPrerequisitesMock).not.toHaveBeenCalled();
    expect(serviceRoleClientMock.from).not.toHaveBeenCalled();
  });

  it("classifies selected rows that produced no writes as a warning", () => {
    expect(
      buildPredictionsSkoHealth(
        {
          success: true,
          coverage: { selectedPlayers: 2 },
          write: { attemptedRows: 0, upsertedRows: 0, partial: false },
        },
        200,
      ),
    ).toEqual({
      status: "warning",
      alerts: [
        {
          code: "low_rows_written",
          severity: "warning",
          message: "Only 0 rows were written for 2 selected players.",
        },
      ],
    });
  });

  it("keeps a real scoreless stretch instead of falling back to a longer window", () => {
    // 15 games: 1 point in each of the first 10, then 5 scoreless games.
    const coldStreak = [...Array(10).fill(1), ...Array(5).fill(0)];
    const cold = buildPredictionRecord(2, "2026-03-21", 5, coldStreak, 10);
    // avg5 = 0, avg10 = 0.5 -> 0.6 * 0.5 + 0.4 * 0 = 0.3 per game.
    expect(cold.pred_points_per_game).toBeCloseTo(0.3, 10);
    expect(cold.pred_points).toBeCloseTo(1.5, 10);
    expect(cold.model_version).toBe("v0.4");

    const scoreless = buildPredictionRecord(
      2,
      "2026-03-21",
      5,
      [...Array(10).fill(1), ...Array(10).fill(0)],
      10,
    );
    // Ten scoreless games predict 0, not the 20-game average.
    expect(scoreless.pred_points).toBe(0);
    expect(scoreless.sko).toBe(0);
  });
  // ---- L20: Volatility-Discounted Points Pace (decision 80), W3-7 D1 / R1 ----

  function multiplierOf(series: Array<number | null>) {
    return buildPredictionRecord(2, "2026-03-21", 5, series as number[], 10)
      .stability_multiplier;
  }

  const SERIES_22 = [0, 1, 0, 2, 1, 0, 3, 0, 1, 1, 0, 2, 0, 0, 1, 4, 0, 1, 2, 0, 1, 1];

  it("vets R1: the multiplier is invariant to adding or multiplying every game by a constant", () => {
    const base = buildPredictionRecord(2, "2026-03-21", 5, SERIES_22, 10);
    const scaled = buildPredictionRecord(
      2,
      "2026-03-21",
      5,
      SERIES_22.map((points) => 3 * points + 5),
      10,
    );
    expect(base.stability_multiplier).not.toBeNull();
    expect(scaled.stability_multiplier).toBeCloseTo(base.stability_multiplier!, 12);
    // The pace is affine-equivariant, not invariant: pace(3x + 5) = 3·pace(x) + 5.
    expect(scaled.pred_points_per_game).toBeCloseTo(
      3 * base.pred_points_per_game! + 5,
      12,
    );
    // sd ratios: the stored SD scales by |a| and ignores b.
    expect(scaled.stability_cv).toBeCloseTo(3 * base.stability_cv!, 12);
  });

  it("vets R1: bounds, a constant series gives 1.0 and every series of 10 or fewer games gives 0.9", () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % 4;
    };
    for (let trial = 0; trial < 200; trial++) {
      const length = 1 + (trial % 30);
      const series = Array.from({ length }, next);
      const record = buildPredictionRecord(2, "2026-03-21", 5, series, 10);
      expect(record.stability_multiplier!).toBeGreaterThanOrEqual(0.8);
      expect(record.stability_multiplier!).toBeLessThanOrEqual(1);
      expect(record.sko!).toBeLessThanOrEqual(record.pred_points! + 1e-12);
      expect(record.sko!).toBeGreaterThanOrEqual(0.8 * record.pred_points! - 1e-12);
    }
    expect(multiplierOf(Array(20).fill(2))).toBe(1);
    expect(multiplierOf([0, 1, 0, 1, 0, 1, 0, 1])).toBeCloseTo(0.9, 12);
    expect(multiplierOf([0, 3, 1, 0, 2, 0, 1, 0, 0, 4])).toBeCloseTo(0.9, 12);
  });

  it("returns unknown, not zero, for a player with no history (unknown stays unknown)", () => {
    const record = buildPredictionRecord(2, "2026-03-21", 5, [], 10);
    expect(record).toMatchObject({
      pred_points: null,
      pred_points_per_game: null,
      stability_cv: null,
      stability_multiplier: null,
      sko: null,
    });
  });

  it("keeps an unknown game unknown instead of dropping it or scoring it 0", () => {
    const paceWindowGap = [...Array(10).fill(1), 1, 1, null, 1, 1, 1, 1, 1, 1, 1];
    const gapInPace = buildPredictionRecord(2, "2026-03-21", 5, paceWindowGap as number[], 10);
    expect(gapInPace.pred_points).toBeNull();
    expect(gapInPace.sko).toBeNull();

    const sdWindowGap = [1, 1, null, ...Array(17).fill(1)];
    const gapInSd = buildPredictionRecord(2, "2026-03-21", 5, sdWindowGap as number[], 10);
    expect(gapInSd.pred_points).toBe(5);
    expect(gapInSd.stability_multiplier).toBeNull();
    expect(gapInSd.sko).toBeNull();
  });

  function sourceBuilder(rows: Array<Record<string, any>>) {
    const state: { ids?: number[]; playerId?: number } = {};
    const builder: any = {};
    for (const method of ["select", "lte", "gte", "not", "order"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.eq = vi.fn((column: string, value: unknown) => {
      if (column === "player_id") state.playerId = Number(value);
      return builder;
    });
    builder.in = vi.fn((column: string, values: number[]) => {
      if (column === "player_id") state.ids = values;
      return builder;
    });
    const sorted = () =>
      rows
        .filter((row) => !state.ids || state.ids.includes(row.player_id))
        .filter((row) => state.playerId === undefined || row.player_id === state.playerId)
        .slice()
        .sort((a, b) => a.player_id - b.player_id || a.date.localeCompare(b.date));
    builder.limit = vi.fn(async () => ({ data: sorted().reverse(), error: null }));
    builder.range = vi.fn(async (from: number, to: number) => ({
      data: sorted().slice(from, to + 1),
      error: null,
    }));
    return builder;
  }

  async function runWriter(
    rows: Array<Record<string, any>>,
    query: Record<string, string>,
  ) {
    const builders: any[] = [];
    const upsert = vi.fn().mockResolvedValue({ error: null });
    serviceRoleClientMock.from.mockImplementation((table: string) => {
      if (table === "player_stats_unified") {
        const builder = sourceBuilder(rows);
        builders.push(builder);
        return builder;
      }
      if (table === "predictions_sko") return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    const res = createMockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer current-secret" },
        query,
        body: {},
      } as any,
      res,
    );
    return { res, upsert, builders };
  }

  function games(playerId: number, points: Array<number | null>, lastDate = "2026-03-20") {
    const end = Date.parse(`${lastDate}T00:00:00Z`);
    return points.map((value, index) => ({
      player_id: playerId,
      date: new Date(end - (points.length - 1 - index) * 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      points: value,
      games_played: 1,
    }));
  }

  it("writes an unknown pace when a served source game has unknown points", async () => {
    const { res, upsert } = await runWriter(
      games(2, [1, 1, 1, 0, null, 1, 0, 1, 1, 2]),
      { asOfDate: "2026-03-21", playerIds: "2" },
    );
    expect(res.statusCode).toBe(200);
    const [written] = upsert.mock.calls[0][0];
    expect(written).toMatchObject({
      player_id: 2,
      pred_points: null,
      sko: null,
      model_version: "v0.4",
    });
  });

  it("reads only current regular-season games (no prior playoffs or preseason in the window)", async () => {
    const { builders } = await runWriter(games(2, [1, 0, 2], "2025-10-19"), {
      asOfDate: "2025-10-20",
      playerIds: "2",
    });
    const gteCalls = builders.flatMap((builder) => builder.gte.mock.calls);
    expect(gteCalls.length).toBeGreaterThan(0);
    for (const call of gteCalls) expect(call).toEqual(["date", "2025-10-07"]);
  });

  it("reads every selected player's series in one paged source query, not one query per player", async () => {
    const { res, upsert, builders } = await runWriter(
      [...games(1, [1, 0, 2]), ...games(2, [0, 0, 1, 1]), ...games(3, [2])],
      { asOfDate: "2026-03-21", playerIds: "3,1,2" },
    );
    expect(res.statusCode).toBe(200);
    expect(builders).toHaveLength(1);
    const written = upsert.mock.calls[0][0];
    expect(written.map((row: any) => row.player_id)).toEqual([3, 1, 2]);
    expect(written[2].pred_points_per_game).toBeCloseTo(
      0.6 * 0.5 + 0.4 * 0.5,
      12,
    );
  });
});

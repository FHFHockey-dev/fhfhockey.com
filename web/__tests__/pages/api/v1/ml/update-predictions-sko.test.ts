import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assertPredictionsSkoPrerequisitesMock,
  authGetUserMock,
  serviceRoleClientMock,
  issue,
} = vi.hoisted(() => ({
  assertPredictionsSkoPrerequisitesMock: vi.fn(),
  authGetUserMock: vi.fn(),
  serviceRoleClientMock: { from: vi.fn() },
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

import handler, {
  fetchPlayerIdsPaginated,
  fetchPlayerSeries,
} from "../../../../../pages/api/v1/ml/update-predictions-sko";
import { PredictionsSkoDependencyError } from "../../../../../lib/ml/predictionsSkoDependencyChecks";

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
        message: "Invalid bearer token",
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
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });

  it("paginates every player-discovery row and returns sorted unique ids", async () => {
    const loadPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ player_id: 2 }, { player_id: 1 }, { player_id: 2 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ player_id: "3" }],
        error: null,
      });

    await expect(fetchPlayerIdsPaginated(loadPage, 3)).resolves.toEqual({
      playerIds: [1, 2, 3],
      pages: 2,
      rowsScanned: 4,
    });
    expect(loadPage).toHaveBeenNthCalledWith(1, 0, 2);
    expect(loadPage).toHaveBeenNthCalledWith(2, 3, 5);
  });

  it("limits the source query to the latest 60 rows and restores chronological input", async () => {
    const rows = [
      { player_id: 7, date: "2026-03-20", points: 2, games_played: 1 },
      { player_id: 7, date: "2026-03-19", points: 1, games_played: 1 },
    ];
    const builder: any = {};
    for (const method of ["select", "eq", "lte", "gte"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const client = { from: vi.fn(() => builder) } as any;

    const result = await fetchPlayerSeries(
      client,
      7,
      "2026-03-21",
      "2025-11-21",
    );

    expect(builder.order).toHaveBeenCalledWith("date", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(60);
    expect(result.map((row) => row.date)).toEqual(["2026-03-19", "2026-03-20"]);
    expect(rows.map((row) => row.date)).toEqual(["2026-03-20", "2026-03-19"]);
  });

  it("returns deterministic coverage, source-lag, model, and write diagnostics", async () => {
    const seriesBuilder: any = {};
    for (const method of ["select", "eq", "lte", "gte"]) {
      seriesBuilder[method] = vi.fn(() => seriesBuilder);
    }
    seriesBuilder.order = vi.fn(() => seriesBuilder);
    seriesBuilder.limit = vi.fn().mockResolvedValue({
      data: [
        { player_id: 2, date: "2026-03-20", points: 2, games_played: 1 },
        { player_id: 2, date: "2026-03-19", points: 0, games_played: 1 },
      ],
      error: null,
    });
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
      partial: true,
      model: { name: "baseline-moving-average", version: "v0.2" },
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
    });
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ player_id: 2 })],
      { onConflict: "player_id,as_of_date,horizon_games" },
    );
  });
});

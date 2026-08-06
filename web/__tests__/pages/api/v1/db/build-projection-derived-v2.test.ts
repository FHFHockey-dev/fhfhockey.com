import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

const {
  auditInsertMock,
  gamesFetchMock,
  playerPrepareMock,
  teamPrepareMock,
  goaliePrepareMock,
  manifestReadMock,
  persistMock,
  derivedQueueRows,
  derivedQueueRangeMock,
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  gamesFetchMock: vi.fn(),
  playerPrepareMock: vi.fn(),
  teamPrepareMock: vi.fn(),
  goaliePrepareMock: vi.fn(),
  manifestReadMock: vi.fn(),
  persistMock: vi.fn(),
  derivedQueueRows: [] as any[],
  derivedQueueRangeMock: vi.fn(),
}));

vi.mock("lib/projections/derived/buildStrengthTablesV2", () => ({
  fetchProjectionDerivedGamesForDateRange: gamesFetchMock,
  preparePlayerGameStrengthV2: playerPrepareMock,
  prepareTeamGameStrengthV2: teamPrepareMock,
}));

vi.mock("lib/projections/derived/buildGoalieGameV2", () => ({
  prepareGoalieGameV2: goaliePrepareMock,
}));

vi.mock("lib/projections/derived/projectionDerivedPersistence", () => ({
  PROJECTION_DERIVED_ALGORITHM_VERSION:
    "projection-derived-materialization-v1",
  readProjectionGameInputManifest: manifestReadMock,
  persistProjectionGameDerivedV1: persistMock,
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      if (table === "projection_game_materialization_status") {
        const query: any = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          order: vi.fn(() => query),
          range: derivedQueueRangeMock,
        };
        return query;
      }
      return { insert: auditInsertMock };
    }),
  },
}));

import handler, {
  previousUtcDate,
} from "../../../../../pages/api/v1/db/build-projection-derived-v2";

const game = {
  id: 2025020001,
  date: "2026-03-18",
  homeTeamId: 1,
  awayTeamId: 2,
};

function derivedReceipt(overrides: Record<string, unknown> = {}) {
  return {
    observedPlayerRows: 10,
    observedTeamRows: 2,
    observedGoalieRows: 1,
    prunedPlayerRows: 0,
    prunedTeamRows: 0,
    prunedGoalieRows: 0,
    goalieOutcome: "complete",
    idempotent: false,
    completedAt: "2026-07-20T10:00:00.000Z",
    verifiedRows: 13,
    upsertedRows: 13,
    prunedRows: 0,
    affectedRows: 13,
    ...overrides,
  };
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
    },
  };
  return res;
}

describe("/api/v1/db/build-projection-derived-v2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    derivedQueueRows.length = 0;
    derivedQueueRangeMock.mockImplementation(async () => ({
      data: derivedQueueRows,
      error: null,
    }));
    auditInsertMock.mockResolvedValue({ error: null });
    gamesFetchMock.mockImplementation(async ({ startDate }: any) => [
      { ...game, date: startDate },
    ]);
    manifestReadMock.mockResolvedValue({
      gameId: game.id,
      inputFingerprint: "a".repeat(64),
      inputVersion: 1,
    });
    playerPrepareMock.mockResolvedValue({
      rows: [{ game_id: game.id, player_id: 10 }],
      plays: [],
    });
    teamPrepareMock.mockReturnValue([
      { game_id: game.id, team_id: 1 },
      { game_id: game.id, team_id: 2 },
    ]);
    goaliePrepareMock.mockReturnValue({
      rows: [{ game_id: game.id, goalie_id: 20 }],
      outcome: "complete",
      justification: null,
      emptyNetEvents: 0,
    });
    persistMock.mockResolvedValue(derivedReceipt());
  });

  it("bounds bare multi-day runs and commits each game through one RPC", async () => {
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-18",
        endDate: "2026-03-22",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      startDate: "2026-03-18",
      endDate: "2026-03-20",
      maxDays: 3,
      nextStartDate: "2026-03-21",
      processedDates: ["2026-03-18", "2026-03-19", "2026-03-20"],
      rowsAffected: 39,
      rowsVerified: 39,
      rowsPruned: 0,
      gamesVerified: 3,
      gamesIdempotent: 0,
      player: { gamesProcessed: 3, rowsUpserted: 30, rowsVerified: 30 },
      team: { gamesProcessed: 3, rowsUpserted: 6, rowsVerified: 6 },
      goalie: {
        gamesProcessed: 3,
        rowsUpserted: 3,
        rowsVerified: 3,
        gamesNotObserved: 0,
      },
      dependencyContract: {
        version: "rolling-forge-operator-order-v2",
        currentStage: {
          id: "projection_derived_build",
          order: 7,
        },
      },
    });
    expect(persistMock).toHaveBeenCalledTimes(3);
    expect(derivedQueueRangeMock).not.toHaveBeenCalled();
    expect(persistMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: game.id,
        playerRows: [{ game_id: game.id, player_id: 10 }],
        teamRows: [
          { game_id: game.id, team_id: 1 },
          { game_id: game.id, team_id: 2 },
        ],
      }),
    );
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rows_affected: 39,
        details: expect.objectContaining({ rowsUpserted: 39 }),
      }),
    );
  });

  it("defaults an empty scheduled request to the prior UTC slate", () => {
    expect(previousUtcDate(new Date("2026-03-20T09:50:00Z"))).toBe(
      "2026-03-19",
    );
  });

  it("recovers the oldest relationship-ready derived slate across date boundaries", async () => {
    derivedQueueRows.push(
      {
        game_id: game.id - 1,
        input_status: "complete",
        input_fingerprint: "b".repeat(64),
        relationship_status: "pending",
        relationship_input_fingerprint: null,
        relationship_algorithm_version: null,
        derived_status: "pending",
        derived_input_fingerprint: null,
        derived_algorithm_version: null,
        games: { id: game.id - 1, date: "2026-03-09" },
      },
      {
        game_id: game.id,
        input_status: "complete",
        input_fingerprint: "a".repeat(64),
        relationship_status: "complete",
        relationship_input_fingerprint: "a".repeat(64),
        relationship_algorithm_version:
          "shift_relationship_materializer_v3_position_bound",
        derived_status: "pending",
        derived_input_fingerprint: null,
        derived_algorithm_version: null,
        games: { id: game.id, date: "2026-03-10" },
      },
    );
    const req: any = { method: "POST", query: {}, body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(derivedQueueRangeMock).toHaveBeenCalledTimes(1);
    expect(gamesFetchMock).toHaveBeenCalledWith({
      startDate: "2026-03-10",
      endDate: "2026-03-10",
    });
    expect(res.body).toMatchObject({
      startDate: "2026-03-10",
      endDate: "2026-03-10",
      processedDates: ["2026-03-10"],
      maxDays: 3,
    });
  });

  it("returns the same date when the deadline is exhausted after a partial date", async () => {
    let now = 1_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    gamesFetchMock.mockResolvedValue([game, { ...game, id: game.id + 1 }]);
    persistMock.mockImplementation(async () => {
      now += 30;
      return derivedReceipt();
    });
    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-03-18",
        endDate: "2026-03-20",
        maxDurationMs: "25",
        maxDays: "3",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.timedOut).toBe(true);
    expect(res.body.processedDates).toEqual([]);
    expect(res.body.nextStartDate).toBe("2026-03-18");
    expect(res.body.player.gamesProcessed).toBe(1);
    dateNowSpy.mockRestore();
  });

  it("preserves a failed player date and never computes dependent stages", async () => {
    playerPrepareMock.mockRejectedValueOnce(
      new Error("shift strength is incomplete"),
    );
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-18",
        endDate: "2026-03-20",
        maxDays: "3",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(207);
    expect(res.body.processedDates).toEqual([]);
    expect(res.body.nextStartDate).toBe("2026-03-18");
    expect(res.body.failures).toEqual([
      {
        date: "2026-03-18",
        stage: "player",
        error: "shift strength is incomplete",
      },
    ]);
    expect(teamPrepareMock).not.toHaveBeenCalled();
    expect(goaliePrepareMock).not.toHaveBeenCalled();
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("retains the date and reports no committed rows when the atomic RPC fails", async () => {
    persistMock.mockRejectedValueOnce(new Error("derived transaction failed"));
    const req: any = {
      method: "POST",
      query: { startDate: "2026-03-18", endDate: "2026-03-18" },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({
      processedDates: [],
      nextStartDate: "2026-03-18",
      player: { gamesProcessed: 0, rowsUpserted: 0 },
      team: { gamesProcessed: 0, rowsUpserted: 0 },
      goalie: {
        gamesProcessed: 0,
        rowsUpserted: 0,
        gamesNotObserved: 0,
      },
      failures: [
        {
          date: "2026-03-18",
          stage: "persist",
          error: "derived transaction failed",
        },
      ],
    });
  });

  it("reports a successful, explicit zero-goalie materialization", async () => {
    goaliePrepareMock.mockReturnValueOnce({
      rows: [],
      outcome: "not_observed",
      justification: "completed_pbp_contains_no_countable_shot_events",
      emptyNetEvents: 0,
    });
    persistMock.mockResolvedValueOnce(
      derivedReceipt({
        observedGoalieRows: 0,
        goalieOutcome: "not_observed",
        verifiedRows: 12,
        upsertedRows: 12,
        affectedRows: 12,
      }),
    );
    const req: any = {
      method: "POST",
      query: { startDate: "2026-03-18", endDate: "2026-03-18" },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      processedDates: ["2026-03-18"],
      goalie: {
        gamesProcessed: 1,
        rowsUpserted: 0,
        rowsVerified: 0,
        gamesNotObserved: 1,
      },
      observability: {
        dataQualityWarnings: [
          expect.objectContaining({ code: "goalie_not_observed" }),
        ],
      },
    });
  });

  it("reports an idempotent receipt as verified without inflating logical mutations", async () => {
    persistMock.mockResolvedValueOnce(
      derivedReceipt({
        idempotent: true,
        upsertedRows: 0,
        affectedRows: 0,
      }),
    );
    const req: any = {
      method: "POST",
      query: { startDate: "2026-03-18", endDate: "2026-03-18" },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      rowsAffected: 0,
      rowsVerified: 13,
      rowsPruned: 0,
      gamesVerified: 1,
      gamesIdempotent: 1,
      player: { gamesProcessed: 1, rowsUpserted: 0, rowsVerified: 10 },
      team: { gamesProcessed: 1, rowsUpserted: 0, rowsVerified: 2 },
      goalie: {
        gamesProcessed: 1,
        rowsUpserted: 0,
        rowsVerified: 1,
      },
      observability: { goalieRowsProcessed: 1 },
    });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rows_affected: 0,
        details: expect.objectContaining({ rowsUpserted: 0 }),
      }),
    );
  });
});

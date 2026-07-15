import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateStatsMock } = vi.hoisted(() => ({
  updateStatsMock: vi.fn(),
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("../../../../../utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("../../../../../pages/api/v1/db/update-stats/[gameId]", () => ({
  updateStats: updateStatsMock,
}));

import { TransactionalGameStatsPersistenceError } from "../../../../../lib/cron/transactionalGameStatsPersistence";
import {
  GameIdentityMismatchError,
  PlayerGameStatsSourceError,
  TeamGameStatsError,
} from "../../../../../lib/cron/gameStatsCompleteness";
import { StatsPreWriteQuarantineError } from "../../../../../lib/cron/statsUpdateSafety";
import handler, {
  parseStatsCronCount,
} from "../../../../../pages/api/v1/db/cron/update-stats-cron";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
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

function createRpc(gameId: number) {
  return createRpcForGameIds([gameId]).rpc;
}

function quarantineReceipt(gameId: number) {
  return {
    game_id: gameId,
    outcome: "quarantined",
    reason: "game_not_finished",
    contract_version: 1,
    expected_team_rows: 0,
    observed_team_rows: 0,
    expected_skater_rows: 0,
    observed_skater_rows: 0,
    expected_goalie_rows: 0,
    observed_goalie_rows: 0,
    completed_at: "2026-07-15T01:30:00.000Z",
  };
}

function createTransactionalFailure(args: {
  gameId: number;
  phase: "persistence_rpc" | "receipt_validation";
  terminalCode: string;
}) {
  return new TransactionalGameStatsPersistenceError({
    kind: "transactional_game_stats_persistence_failure",
    code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
    phase: args.phase,
    gameId: args.gameId,
    requestedRows: 5,
    expectedTeamRows: 2,
    expectedSkaterRows: 2,
    expectedGoalieRows: 1,
    playerIds: [1, 2, 3],
    missingPlayerIds: [],
    failedRepairPlayerId: null,
    terminalError: {
      code: args.terminalCode,
      message: "The transactional manifest was not committed.",
    },
  });
}

function createRpcForGameIds(
  gameIds: number[],
  error?: Error,
  quarantineResult?: { data: unknown; error: unknown },
) {
  const builder: any = {
    throwOnError: vi.fn(async () => {
      if (error) throw error;
      return {
        data: gameIds.map((gameid) => ({ gameid })),
        error: null,
      };
    }),
  };
  const limit = vi.fn(() => builder);
  builder.limit = limit;
  const rpc = vi.fn((functionName: string) => {
    if (functionName === "get_unupdated_games") return builder;
    if (
      functionName === "quarantine_game_stats_v1" &&
      quarantineResult !== undefined
    ) {
      return Promise.resolve(quarantineResult);
    }
    throw new Error(`Unexpected RPC ${functionName}`);
  });
  return {
    rpc,
    limit,
  };
}

describe("/api/v1/db/cron/update-stats-cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses only the documented bounded integer count range", () => {
    expect(parseStatsCronCount(undefined)).toBe(5);
    expect(parseStatsCronCount("1")).toBe(1);
    expect(parseStatsCronCount("10")).toBe(10);

    for (const value of ["0", "11", "1.5", "-1", "abc", ["1"]]) {
      expect(parseStatsCronCount(value)).toBeNull();
    }
  });

  it("rejects an invalid count as a caller error before the RPC runs", async () => {
    const rpc = vi.fn(() => {
      throw new Error("RPC must not run for invalid input");
    });
    const req: any = {
      method: "GET",
      query: { count: "11" },
      supabase: { rpc },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps a transactional persistence RPC failure pending and reports bounded counts", async () => {
    const gameId = 2025020001;
    updateStatsMock.mockRejectedValue(
      createTransactionalFailure({
        gameId,
        phase: "persistence_rpc",
        terminalCode: "42501",
      }),
    );
    const from = vi.fn(() => {
      throw new Error(
        "Structured persistence failures must not be quarantined",
      );
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: {
        rpc: createRpc(gameId),
        from,
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      operationStatus: "failure",
      updatedGameIds: [],
      failedGameIds: [gameId],
      quarantinedGameIds: [],
      pendingRetryGameIds: [gameId],
      failedRows: 5,
      failures: [
        {
          kind: "transactional_game_stats_persistence_failure",
          code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
          phase: "persistence_rpc",
          gameId,
          expectedTeamRows: 2,
          expectedSkaterRows: 2,
          expectedGoalieRows: 1,
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("never quarantines a transactional receipt-validation failure", async () => {
    const gameId = 2025020002;
    updateStatsMock.mockRejectedValue(
      createTransactionalFailure({
        gameId,
        phase: "receipt_validation",
        terminalCode: "INVALID_TRANSACTIONAL_GAME_STATS_RECEIPT",
      }),
    );
    const from = vi.fn(() => {
      throw new Error("Goalie persistence failures must remain pending");
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: {
        rpc: createRpc(gameId),
        from,
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      operationStatus: "failure",
      updatedGameIds: [],
      failedGameIds: [gameId],
      quarantinedGameIds: [],
      pendingRetryGameIds: [gameId],
      failedRows: 5,
      failures: [
        {
          kind: "transactional_game_stats_persistence_failure",
          code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
          phase: "receipt_validation",
          gameId,
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps a current team-stat completeness failure pending", async () => {
    const gameId = 2025020003;
    updateStatsMock.mockRejectedValue(
      new TeamGameStatsError({
        kind: "team_game_stats_failure",
        code: "TEAM_GAME_STATS_FAILED",
        phase: "source_validation",
        gameId,
        requestedRows: 2,
        sourceStatCount: 0,
        teamIds: [1, 2],
        missingCategories: ["sog"],
        invalidCategories: [],
        terminalError: {
          code: "INCOMPLETE_TEAM_GAME_STATS_SOURCE",
          message: "team source incomplete",
        },
      }),
    );
    const from = vi.fn(() => {
      throw new Error("Team-stat failures must remain pending");
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: { rpc: createRpc(gameId), from },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      operationStatus: "failure",
      updatedGameIds: [],
      failedGameIds: [gameId],
      quarantinedGameIds: [],
      pendingRetryGameIds: [gameId],
      failedRows: 2,
      failures: [
        {
          kind: "team_game_stats_failure",
          phase: "source_validation",
          gameId,
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps a current player-source completeness failure pending", async () => {
    const gameId = 2025020004;
    updateStatsMock.mockRejectedValue(
      new PlayerGameStatsSourceError({
        kind: "player_game_stats_source_failure",
        code: "PLAYER_GAME_STATS_SOURCE_INCOMPLETE",
        phase: "source_validation",
        gameId,
        requestedRows: 1,
        skaterRows: 0,
        goalieRows: 0,
        invalidSections: ["homeTeam.forwards"],
        missingBatches: ["skaters", "goalies"],
        terminalError: {
          code: "INCOMPLETE_PLAYER_GAME_STATS_SOURCE",
          message: "player source incomplete",
        },
      }),
    );
    const from = vi.fn(() => {
      throw new Error("Player-source failures must remain pending");
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: { rpc: createRpc(gameId), from },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      operationStatus: "failure",
      updatedGameIds: [],
      failedGameIds: [gameId],
      quarantinedGameIds: [],
      pendingRetryGameIds: [gameId],
      failedRows: 1,
      failures: [
        {
          kind: "player_game_stats_source_failure",
          phase: "source_validation",
          gameId,
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps a stale generic failure pending and never logs raw settled results", async () => {
    const gameId = 2024020001;
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    updateStatsMock.mockRejectedValue(
      new Error(
        "post-write failure at https://example.test/private Bearer sensitive-token",
      ),
    );
    const from = vi.fn(() => {
      throw new Error("Generic failures must not be quarantine eligible");
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: {
        rpc: createRpc(gameId),
        from,
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      operationStatus: "failure",
      failedGameIds: [gameId],
      quarantinedGameIds: [],
      pendingRetryGameIds: [gameId],
      failures: [
        {
          kind: "stats_update_failure",
          code: "STATS_UPDATE_FAILED",
          gameId,
          message: "post-write failure at [redacted-url] Bearer [redacted]",
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
    const logged = [...consoleLog.mock.calls, ...consoleWarn.mock.calls]
      .flatMap((call) => call)
      .map((value) =>
        typeof value === "string" ? value : JSON.stringify(value),
      )
      .join(" ");
    expect(logged).not.toContain("sensitive-token");
    expect(logged).not.toContain("https://example.test/private");
    expect(logged).not.toContain('"status":"rejected"');
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
  });

  it("quarantines only an explicitly eligible stale pre-write failure", async () => {
    const gameId = 2024020002;
    updateStatsMock.mockRejectedValue(
      new StatsPreWriteQuarantineError({
        kind: "stats_pre_write_quarantine_failure",
        code: "STATS_PRE_WRITE_QUARANTINE_ELIGIBLE",
        phase: "pre_write_validation",
        gameId,
        requestedRows: 1,
        reason: "game_not_finished",
        message: "Game is not finished.",
      }),
    );
    const gamesIn = vi.fn().mockResolvedValue({
      data: [{ id: gameId, date: "2020-01-01" }],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "games") {
        return {
          select() {
            return this;
          },
          in: gamesIn,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const rpc = createRpcForGameIds([gameId], undefined, {
      data: [quarantineReceipt(gameId)],
      error: null,
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: {
        rpc: rpc.rpc,
        from,
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      operationStatus: "warning",
      failedGameIds: [gameId],
      quarantinedGameIds: [gameId],
      pendingRetryGameIds: [],
      failedRows: 1,
      failures: [
        {
          kind: "stats_pre_write_quarantine_failure",
          code: "STATS_PRE_WRITE_QUARANTINE_ELIGIBLE",
          gameId,
        },
      ],
    });
    expect(rpc.rpc).toHaveBeenNthCalledWith(1, "get_unupdated_games");
    expect(rpc.rpc).toHaveBeenNthCalledWith(2, "quarantine_game_stats_v1", {
      p_game_ids: [gameId],
      p_reason: "game_not_finished",
    });
    expect(gamesIn).toHaveBeenCalledWith("id", [gameId]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("games");
    expect(from).not.toHaveBeenCalledWith("statsUpdateStatus");
  });

  it("treats updateStats success as already committed and never writes status directly", async () => {
    const gameId = 2025020010;
    updateStatsMock.mockResolvedValue(undefined);
    const from = vi.fn(() => {
      throw new Error("Successful updateStats must own status advancement");
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: { rpc: createRpc(gameId), from },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      operationStatus: "success",
      updatedGameIds: [gameId],
      failedGameIds: [],
      quarantinedGameIds: [],
      pendingRetryGameIds: [],
      failures: [],
    });
    expect(updateStatsMock).toHaveBeenCalledWith(gameId, req.supabase);
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps a stale failure pending when quarantine lacks exact terminal receipts", async () => {
    const gameId = 2024020011;
    updateStatsMock.mockRejectedValue(
      new StatsPreWriteQuarantineError({
        kind: "stats_pre_write_quarantine_failure",
        code: "STATS_PRE_WRITE_QUARANTINE_ELIGIBLE",
        phase: "pre_write_validation",
        gameId,
        requestedRows: 1,
        reason: "game_not_finished",
        message: "Game is not finished.",
      }),
    );
    const from = vi.fn((table: string) => {
      if (table === "games") {
        return {
          select() {
            return this;
          },
          in: vi.fn().mockResolvedValue({
            data: [{ id: gameId, date: "2020-01-01" }],
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const rpc = createRpcForGameIds([gameId], undefined, {
      data: [],
      error: null,
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: { rpc: rpc.rpc, from },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      quarantinedGameIds: [],
      pendingRetryGameIds: [gameId],
      statusAdvancementFailure: {
        kind: "stats_status_advancement_failure",
        phase: "stale_quarantine",
        expectedGameIds: [gameId],
        returnedGameIds: [],
      },
    });
    expect(rpc.rpc).toHaveBeenNthCalledWith(2, "quarantine_game_stats_v1", {
      p_game_ids: [gameId],
      p_reason: "game_not_finished",
    });
    expect(from).not.toHaveBeenCalledWith("statsUpdateStatus");
  });

  it("keeps a requested game pending after a structured landing-ID mismatch", async () => {
    const requestedGameId = 2025020012;
    const landingGameId = 2025020099;
    updateStatsMock.mockRejectedValue(
      new GameIdentityMismatchError({
        kind: "game_identity_mismatch",
        code: "GAME_IDENTITY_MISMATCH",
        phase: "source_validation",
        gameId: requestedGameId,
        requestedRows: 1,
        requestedGameId,
        landingGameId,
        terminalError: {
          code: "GAME_IDENTITY_MISMATCH",
          message: "identity mismatch",
        },
      }),
    );
    const from = vi.fn(() => {
      throw new Error("Identity failures must not write or quarantine status");
    });
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: { rpc: createRpc(requestedGameId), from },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedGameIds: [requestedGameId],
      pendingRetryGameIds: [requestedGameId],
      failures: [
        {
          kind: "game_identity_mismatch",
          requestedGameId,
          landingGameId,
        },
      ],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("caps work and concurrency at ten selected game IDs", async () => {
    const gameIds = Array.from(
      { length: 12 },
      (_, index) => 2025020100 + index,
    );
    const rpc = createRpcForGameIds(gameIds);
    updateStatsMock.mockResolvedValue(undefined);
    const from = vi.fn(() => {
      throw new Error("Successful transactional updates must not write status");
    });
    const req: any = {
      method: "GET",
      query: { count: "10" },
      supabase: {
        rpc: rpc.rpc,
        from,
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      attemptedGameIds: gameIds.slice(0, 10),
      updatedGameIds: gameIds.slice(0, 10),
    });
    expect(rpc.limit).toHaveBeenCalledWith(10);
    expect(updateStatsMock).toHaveBeenCalledTimes(10);
    expect(updateStatsMock).not.toHaveBeenCalledWith(
      gameIds[10],
      expect.anything(),
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("classifies an RPC failure as bounded HTTP 500 internal failure", async () => {
    const rpc = createRpcForGameIds([], new Error("RPC unavailable"));
    const req: any = {
      method: "GET",
      query: { count: "1" },
      supabase: { rpc: rpc.rpc },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      operationStatus: "failure",
      dependencyError: {
        kind: "dependency_error",
        message: "RPC unavailable",
      },
    });
    expect(String(res.body.message).length).toBeLessThanOrEqual(240);
  });
});

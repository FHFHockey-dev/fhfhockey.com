import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, fetchWithCacheMock, getCurrentSeasonMock, getMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    fetchWithCacheMock: vi.fn(),
    getCurrentSeasonMock: vi.fn(),
    getMock: vi.fn(),
  }));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("../../../../../lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock,
}));

vi.mock("../../../../../lib/NHL/base", () => ({
  get: getMock,
}));

vi.mock("../../../../../lib/fetchWithCache", () => ({
  default: fetchWithCacheMock,
}));

vi.mock("../../../../../utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

import gameHandler from "../../../../../pages/api/v1/db/update-stats/[gameId]";
import seasonHandler from "../../../../../pages/api/v1/db/update-season-stats";

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

function completeTeamGameStats() {
  return [
    { category: "sog", awayValue: 31, homeValue: 29 },
    {
      category: "faceoffWinningPctg",
      awayValue: 0.48,
      homeValue: 0.52,
    },
    { category: "powerPlay", awayValue: "1/3", homeValue: "0/2" },
    {
      category: "powerPlayPctg",
      awayValue: 0.333333,
      homeValue: 0,
    },
    { category: "pim", awayValue: 4, homeValue: 6 },
    { category: "hits", awayValue: 12, homeValue: 15 },
    { category: "blockedShots", awayValue: 14, homeValue: 11 },
    { category: "giveaways", awayValue: 7, homeValue: 8 },
    { category: "takeaways", awayValue: 5, homeValue: 6 },
  ];
}

function completeRightRail() {
  return {
    teamGameStats: completeTeamGameStats(),
    homeTeam: { powerPlayToi: "04:00" },
    awayTeam: { powerPlayToi: "05:21" },
  };
}

function completeBoxscore(includeGoalie = true) {
  return {
    playerByGameStats: {
      homeTeam: {
        forwards: [
          {
            playerId: 10,
            position: "C",
            powerPlayGoals: 0,
          },
        ],
        defense: [],
        goalies: includeGoalie
          ? [
              {
                playerId: 12,
                position: "G",
                saveShotsAgainst: "20-22",
                pim: 0,
                goalsAgainst: 2,
                toi: "60:00",
              },
            ]
          : [],
      },
      awayTeam: {
        forwards: [],
        defense: [],
        goalies: [],
      },
    },
  };
}

function mockFinishedGameData(
  gameId: number,
  overrides: {
    rightRail?: unknown;
    boxscore?: unknown;
    landingGameId?: number;
  } = {},
) {
  const rightRail = Object.prototype.hasOwnProperty.call(overrides, "rightRail")
    ? overrides.rightRail
    : completeRightRail();
  const boxscore = Object.prototype.hasOwnProperty.call(overrides, "boxscore")
    ? overrides.boxscore
    : completeBoxscore();

  getMock.mockImplementation(async (path: string) => {
    if (path.endsWith("/landing")) {
      return {
        id: overrides.landingGameId ?? gameId,
        gameState: "FINAL",
        season: 20252026,
        summary: { scoring: [] },
        homeTeam: { id: 1, score: 3 },
        awayTeam: { id: 2, score: 4 },
      };
    }
    if (path.endsWith("/right-rail")) return rightRail;
    if (path.endsWith("/boxscore")) return boxscore;
    throw new Error(`Unexpected NHL path ${path}`);
  });
}

function mockFinishedGamesData() {
  getMock.mockImplementation(async (path: string) => {
    const match = path.match(
      /\/gamecenter\/(\d+)\/(landing|right-rail|boxscore)$/,
    );
    if (!match) throw new Error(`Unexpected NHL path ${path}`);

    const requestedGameId = Number(match[1]);
    if (match[2] === "landing") {
      return {
        id: requestedGameId,
        gameState: "FINAL",
        season: 20252026,
        summary: { scoring: [] },
        homeTeam: { id: 1, score: 3 },
        awayTeam: { id: 2, score: 4 },
      };
    }
    return match[2] === "right-rail" ? completeRightRail() : completeBoxscore();
  });
}

const completionTimestamp = "2026-07-14T22:30:00.000Z";

function completeManifest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    updated: true,
    outcome: "complete",
    reason: null,
    contract_version: 1,
    expected_team_rows: 2,
    observed_team_rows: 2,
    expected_skater_rows: 1,
    observed_skater_rows: 1,
    expected_goalie_rows: 1,
    observed_goalie_rows: 1,
    completed_at: completionTimestamp,
    ...overrides,
  };
}

function quarantinedManifest(): Record<string, unknown> {
  return completeManifest({
    outcome: "quarantined",
    reason: "game_not_finished",
    expected_team_rows: 0,
    observed_team_rows: 0,
    expected_skater_rows: 0,
    observed_skater_rows: 0,
    expected_goalie_rows: 0,
    observed_goalie_rows: 0,
  });
}

function completeRpcReceipt(
  gameId: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    game_id: gameId,
    outcome: "complete",
    contract_version: 1,
    expected_team_rows: 2,
    observed_team_rows: 2,
    expected_skater_rows: 1,
    observed_skater_rows: 1,
    expected_goalie_rows: 1,
    observed_goalie_rows: 1,
    pruned_team_rows: 0,
    pruned_skater_rows: 0,
    pruned_goalie_rows: 0,
    completed_at: completionTimestamp,
    ...overrides,
  };
}

function createStatsSupabase(args: {
  gameId: number;
  gameIds?: number[];
  includeGamesQuery: boolean;
  earliestPendingGameId?: number | null;
  incompleteStatsGameId?: number | null;
  missingStatusGameId?: number | null;
  legacyStatusGameId?: number | null;
  quarantinedGameId?: number | null;
  manifestByGameId?: Record<number, Record<string, unknown> | null>;
  rpcError?: unknown;
  rpcReceiptOverrides?: Record<string, unknown>;
}) {
  const gamesGte = vi.fn();
  let minimumGameId: number | null = null;
  const gameRows = (args.gameIds ?? [args.gameId]).map((id) => ({
    id,
    statsUpdateStatus:
      id === args.missingStatusGameId
        ? null
        : Object.prototype.hasOwnProperty.call(args.manifestByGameId ?? {}, id)
          ? args.manifestByGameId?.[id]
          : id === args.earliestPendingGameId
            ? completeManifest({
                updated: false,
                outcome: "pending",
                contract_version: 0,
                completed_at: null,
              })
            : id === args.incompleteStatsGameId
              ? completeManifest({ observed_goalie_rows: 0 })
              : id === args.legacyStatusGameId
                ? completeManifest({
                    outcome: "legacy_unverified",
                    contract_version: 0,
                    completed_at: null,
                  })
                : id === args.quarantinedGameId
                  ? quarantinedManifest()
                  : completeManifest(),
  }));
  const gamesRange = vi.fn().mockImplementation((from: number, to: number) => {
    const eligibleRows =
      minimumGameId == null
        ? gameRows
        : gameRows.filter((row) => row.id >= minimumGameId!);
    return Promise.resolve({
      data: eligibleRows.slice(from, to + 1),
      error: null,
    });
  });
  const gamesBuilder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    lte() {
      return this;
    },
    gte(_column: string, value: number) {
      gamesGte(value);
      minimumGameId = value;
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    range: gamesRange,
  };
  let requestedPlayerIds: number[] = [];
  const playerLimit = vi.fn().mockImplementation(() =>
    Promise.resolve({
      data: requestedPlayerIds.map((id) => ({ id })),
      error: null,
    }),
  );
  const playerTable = {
    select() {
      return this;
    },
    in(_column: string, ids: number[]) {
      requestedPlayerIds = ids;
      return this;
    },
    limit: playerLimit,
  };
  const from = vi.fn((table: string) => {
    if (args.includeGamesQuery && table === "games") return gamesBuilder;
    if (table === "players") return playerTable;
    throw new Error(`Unexpected table ${table}`);
  });
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    if (name !== "persist_complete_game_stats_v1") {
      throw new Error(`Unexpected RPC ${name}`);
    }
    if (args.rpcError) return { data: null, error: args.rpcError };
    return {
      data: [
        completeRpcReceipt(params.p_game_id as number, {
          expected_team_rows: (params.p_team_rows as unknown[]).length,
          observed_team_rows: (params.p_team_rows as unknown[]).length,
          expected_skater_rows: (params.p_skater_rows as unknown[]).length,
          observed_skater_rows: (params.p_skater_rows as unknown[]).length,
          expected_goalie_rows: (params.p_goalie_rows as unknown[]).length,
          observed_goalie_rows: (params.p_goalie_rows as unknown[]).length,
          ...args.rpcReceiptOverrides,
        }),
      ],
      error: null,
    };
  });

  return {
    supabase: { from, rpc },
    from,
    rpc,
    gamesGte,
    gamesRange,
    playerLimit,
  };
}

function mockGoalieGameData(gameId: number) {
  getMock.mockImplementation(async (path: string) => {
    if (path.endsWith("/landing")) {
      return {
        id: gameId,
        gameState: "FINAL",
        season: 20252026,
        summary: { scoring: [] },
        homeTeam: { id: 1, score: 3 },
        awayTeam: { id: 2, score: 4 },
      };
    }
    if (path.endsWith("/right-rail")) {
      return completeRightRail();
    }
    if (path.endsWith("/boxscore")) {
      return {
        playerByGameStats: {
          homeTeam: {
            forwards: [
              {
                playerId: 10,
                position: "C",
                powerPlayGoals: 0,
              },
            ],
            defense: [],
            goalies: [
              {
                playerId: 12,
                position: "G",
                saveShotsAgainst: "20-22",
                pim: 0,
                goalsAgainst: 2,
                toi: "60:00",
              },
            ],
          },
          awayTeam: {
            forwards: [],
            defense: [],
            goalies: [],
          },
        },
      };
    }
    throw new Error(`Unexpected NHL path ${path}`);
  });
}

function createRpcFailureSupabase(gameId: number, includeGamesQuery: boolean) {
  return createStatsSupabase({
    gameId,
    includeGamesQuery,
    rpcError: {
      code: "42501",
      message: "transactional game-stat write denied",
    },
  });
}

describe("/api/v1/db/update-season-stats route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });
    fetchWithCacheMock.mockResolvedValue("");
    const builder = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      lte() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      range() {
        return Promise.resolve({
          data: null,
          error: {
            message:
              "<!DOCTYPE html><html><body>Error code 522 from supabase.co</body></html>",
          },
        });
      },
    };
    createClientMock.mockReturnValue({
      from: vi.fn(() => builder),
    });
  });

  it("returns a structured dependency error instead of leaking html", async () => {
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Upstream dependency returned an HTML error page",
    );
    expect(res.body.dependencyError).toMatchObject({
      kind: "dependency_error",
      classification: "html_upstream_response",
      source: "supabase_or_proxy",
      htmlLike: true,
    });
  });

  it("returns HTTP 500 and a structured transactional RPC failure for a partial season run", async () => {
    const gameId = 2025020001;
    mockGoalieGameData(gameId);
    const client = createRpcFailureSupabase(gameId, true);
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "full" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      processed: 1,
      succeeded: 0,
      failed: 1,
      failedRows: 4,
      failedGameIds: [gameId],
      failures: [
        {
          kind: "transactional_game_stats_persistence_failure",
          code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
          phase: "persistence_rpc",
          gameId,
          requestedRows: 4,
          expectedTeamRows: 2,
          expectedSkaterRows: 1,
          expectedGoalieRows: 1,
          playerIds: [10, 12],
          terminalError: {
            code: "42501",
            message: "transactional game-stat write denied",
          },
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("players");
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("fails closed when a season game has no teamGameStats source", async () => {
    const gameId = 2025020003;
    mockFinishedGameData(gameId, { rightRail: {} });
    const client = createStatsSupabase({ gameId, includeGamesQuery: true });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "full" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      succeeded: 0,
      failed: 1,
      failedRows: 2,
      failedGameIds: [gameId],
      failures: [
        {
          kind: "team_game_stats_failure",
          code: "TEAM_GAME_STATS_FAILED",
          phase: "source_validation",
          gameId,
          requestedRows: 2,
        },
      ],
    });
    expect(client.from).not.toHaveBeenCalledWith("players");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("fails closed and sanitizes an error from the transactional persistence RPC", async () => {
    const gameId = 2025020004;
    mockFinishedGameData(gameId);
    const client = createStatsSupabase({
      gameId,
      includeGamesQuery: true,
      rpcError: {
        code: "42501",
        message:
          "transaction denied at https://example.test/private Bearer sensitive-token\ncontinued",
      },
    });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "full" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedRows: 4,
      failedGameIds: [gameId],
      failures: [
        {
          kind: "transactional_game_stats_persistence_failure",
          code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
          phase: "persistence_rpc",
          gameId,
          requestedRows: 4,
          expectedTeamRows: 2,
          expectedSkaterRows: 1,
          expectedGoalieRows: 1,
          terminalError: {
            code: "42501",
            message:
              "transaction denied at [redacted-url] Bearer [redacted] continued",
          },
        },
      ],
    });
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("fails closed when a finished season game has no goalie batch", async () => {
    const gameId = 2025020005;
    mockFinishedGameData(gameId, { boxscore: completeBoxscore(false) });
    const client = createStatsSupabase({ gameId, includeGamesQuery: true });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "full" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedGameIds: [gameId],
      failures: [
        {
          kind: "player_game_stats_source_failure",
          code: "PLAYER_GAME_STATS_SOURCE_INCOMPLETE",
          phase: "source_validation",
          gameId,
          skaterRows: 1,
          goalieRows: 0,
          missingBatches: ["goalies"],
        },
      ],
    });
    expect(client.from).not.toHaveBeenCalledWith("players");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("stops at the first incremental gap and retries it before a later game", async () => {
    const failedGameId = 2025020020;
    const deferredGameId = 2025020021;
    let failFirstGapAttempt = true;
    getMock.mockImplementation(async (path: string) => {
      const match = path.match(
        /\/gamecenter\/(\d+)\/(landing|right-rail|boxscore)$/,
      );
      if (!match) throw new Error(`Unexpected NHL path ${path}`);

      const requestedGameId = Number(match[1]);
      const resource = match[2];
      if (resource === "landing") {
        return {
          id: requestedGameId,
          gameState: "FINAL",
          season: 20252026,
          summary: { scoring: [] },
          homeTeam: { id: 1, score: 3 },
          awayTeam: { id: 2, score: 4 },
        };
      }
      if (resource === "right-rail") {
        if (requestedGameId === failedGameId && failFirstGapAttempt) {
          failFirstGapAttempt = false;
          return {};
        }
        return completeRightRail();
      }
      return completeBoxscore();
    });
    const client = createStatsSupabase({
      gameId: failedGameId,
      gameIds: [failedGameId, deferredGameId],
      includeGamesQuery: true,
      earliestPendingGameId: failedGameId,
    });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "incremental" },
    };

    const firstRes = createMockRes();
    await seasonHandler(req, firstRes);
    const secondRes = createMockRes();
    await seasonHandler(req, secondRes);

    expect(firstRes.statusCode).toBe(500);
    expect(firstRes.body).toMatchObject({
      success: false,
      processed: 1,
      selected: 2,
      failedGameIds: [failedGameId],
      deferredGameIds: [deferredGameId],
    });
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body).toMatchObject({
      success: true,
      processed: 2,
      selected: 2,
      succeeded: 2,
      failed: 0,
      failedGameIds: [],
      deferredGameIds: [],
    });
    const requestedPaths = getMock.mock.calls.map(([path]) => String(path));
    expect(
      requestedPaths.filter((path) =>
        path.includes(`/gamecenter/${failedGameId}/landing`),
      ),
    ).toHaveLength(2);
    expect(
      requestedPaths.filter((path) =>
        path.includes(`/gamecenter/${deferredGameId}/landing`),
      ),
    ).toHaveLength(1);
    expect(client.rpc).toHaveBeenCalledTimes(2);
  });

  it("starts at the earliest pending ledger game even when stat tables contain later games", async () => {
    const olderPendingGameId = 2025020010;
    const laterStatsGameId = 2025020090;
    getMock.mockImplementation(async (path: string) => {
      const match = path.match(
        /\/gamecenter\/(\d+)\/(landing|right-rail|boxscore)$/,
      );
      if (!match) throw new Error(`Unexpected NHL path ${path}`);

      const requestedGameId = Number(match[1]);
      if (match[2] === "landing") {
        return {
          id: requestedGameId,
          gameState: "FINAL",
          season: 20252026,
          summary: { scoring: [] },
          homeTeam: { id: 1, score: 3 },
          awayTeam: { id: 2, score: 4 },
        };
      }
      return match[2] === "right-rail"
        ? completeRightRail()
        : completeBoxscore();
    });
    const client = createStatsSupabase({
      gameId: olderPendingGameId,
      gameIds: [olderPendingGameId, laterStatsGameId],
      includeGamesQuery: true,
      earliestPendingGameId: olderPendingGameId,
    });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "incremental" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      incrementalStartGameId: olderPendingGameId,
      processed: 2,
      succeeded: 2,
    });
    expect(client.gamesGte).toHaveBeenCalledWith(olderPendingGameId);
    expect(client.gamesRange).toHaveBeenCalledTimes(2);
    expect(client.rpc).toHaveBeenCalledTimes(2);
  });

  it("retries a v1 complete manifest whose observed counts do not match", async () => {
    const incompleteGameId = 2025020011;
    const laterGameId = 2025020092;
    mockFinishedGamesData();
    const client = createStatsSupabase({
      gameId: incompleteGameId,
      gameIds: [incompleteGameId, laterGameId],
      includeGamesQuery: true,
      incompleteStatsGameId: incompleteGameId,
    });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "incremental" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      incrementalStartGameId: incompleteGameId,
      processed: 2,
    });
    expect(client.gamesGte).toHaveBeenCalledWith(incompleteGameId);
  });

  it("treats exact v1 complete and safe quarantine manifests as terminal", async () => {
    const completeGameId = 2025020013;
    const quarantinedGameId = 2025020014;
    const pendingGameId = 2025020015;
    mockFinishedGamesData();
    const client = createStatsSupabase({
      gameId: completeGameId,
      gameIds: [completeGameId, quarantinedGameId, pendingGameId],
      includeGamesQuery: true,
      quarantinedGameId,
      earliestPendingGameId: pendingGameId,
    });
    createClientMock.mockReturnValue(client.supabase);
    const res = createMockRes();

    await seasonHandler(
      {
        method: "GET",
        query: { seasonId: "20252026", runMode: "incremental" },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      incrementalStartGameId: pendingGameId,
      processed: 1,
      selected: 1,
    });
    expect(client.gamesGte).toHaveBeenCalledWith(pendingGameId);
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("does not trust a legacy updated=true row as a terminal manifest", async () => {
    const legacyGameId = 2025020016;
    const laterCompleteGameId = 2025020017;
    mockFinishedGamesData();
    const client = createStatsSupabase({
      gameId: legacyGameId,
      gameIds: [legacyGameId, laterCompleteGameId],
      includeGamesQuery: true,
      legacyStatusGameId: legacyGameId,
    });
    createClientMock.mockReturnValue(client.supabase);
    const res = createMockRes();

    await seasonHandler(
      {
        method: "GET",
        query: { seasonId: "20252026", runMode: "incremental" },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      incrementalStartGameId: legacyGameId,
      processed: 2,
    });
    expect(client.rpc).toHaveBeenCalledTimes(2);
  });

  it("caps one incremental run at ten games from the first incomplete manifest", async () => {
    const gameIds = Array.from(
      { length: 12 },
      (_unused, index) => 2025020100 + index,
    );
    mockFinishedGamesData();
    const client = createStatsSupabase({
      gameId: gameIds[0],
      gameIds,
      includeGamesQuery: true,
      earliestPendingGameId: gameIds[0],
    });
    createClientMock.mockReturnValue(client.supabase);
    const res = createMockRes();

    await seasonHandler(
      {
        method: "GET",
        query: { seasonId: "20252026", runMode: "incremental" },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      incrementalStartGameId: gameIds[0],
      selected: 10,
      processed: 10,
      succeeded: 10,
    });
    expect(client.rpc).toHaveBeenCalledTimes(10);
    const requestedGameIds = client.rpc.mock.calls.map(
      ([, params]) => params.p_game_id,
    );
    expect(requestedGameIds).toEqual(gameIds.slice(0, 10));
  });

  it("repairs a missing manifest row through the same transactional RPC as stat persistence", async () => {
    const missingStatusGameId = 2025020012;
    mockFinishedGamesData();
    const client = createStatsSupabase({
      gameId: missingStatusGameId,
      includeGamesQuery: true,
      missingStatusGameId,
    });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "incremental" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.incrementalStartGameId).toBe(missingStatusGameId);
    expect(client.rpc).toHaveBeenCalledWith(
      "persist_complete_game_stats_v1",
      expect.objectContaining({ p_game_id: missingStatusGameId }),
    );
  });

  it("fails closed when the transactional RPC receipt does not exactly match the requested manifest", async () => {
    const gameId = 2025020091;
    mockFinishedGameData(gameId);
    const client = createStatsSupabase({
      gameId,
      includeGamesQuery: true,
      rpcReceiptOverrides: { observed_goalie_rows: 0 },
    });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "full" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      succeeded: 0,
      failedGameIds: [gameId],
      failures: [
        {
          kind: "transactional_game_stats_persistence_failure",
          code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
          phase: "receipt_validation",
          gameId,
          expectedTeamRows: 2,
          expectedSkaterRows: 1,
          expectedGoalieRows: 1,
          terminalError: {
            code: "INVALID_TRANSACTIONAL_GAME_STATS_RECEIPT",
          },
        },
      ],
    });
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("uses the canonical eight-digit PP-TOI report URL and persists fallback values", async () => {
    const gameId = 2025020022;
    mockFinishedGameData(gameId, {
      rightRail: { teamGameStats: completeTeamGameStats() },
    });
    fetchWithCacheMock.mockResolvedValue(`
      <table id="PenaltySummary">
        <tr class="oddColor">
          <td>Power Plays (Goals-Opp./PPTime)</td><td>0-2/04:00</td>
        </tr>
        <tr class="evenColor">
          <td>Power Plays (Goals-Opp./PPTime)</td><td>1-3/05:21</td>
        </tr>
      </table>
    `);
    const client = createStatsSupabase({ gameId, includeGamesQuery: true });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "full" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fetchWithCacheMock).toHaveBeenCalledTimes(2);
    expect(fetchWithCacheMock).toHaveBeenNthCalledWith(
      1,
      "https://www.nhl.com/scores/htmlreports/20252026/GS020022.HTM",
      false,
    );
    expect(fetchWithCacheMock).toHaveBeenNthCalledWith(
      2,
      "https://www.nhl.com/scores/htmlreports/20252026/GS020022.HTM",
      false,
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "persist_complete_game_stats_v1",
      expect.objectContaining({
        p_game_id: gameId,
        p_team_rows: [
          expect.objectContaining({ teamId: 1, powerPlayToi: "05:21" }),
          expect.objectContaining({ teamId: 2, powerPlayToi: "04:00" }),
        ],
      }),
    );
  });

  it("sanitizes PP-TOI fallback errors in both stats writers", async () => {
    const seasonGameId = 2025020026;
    const directGameId = 2025020027;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchWithCacheMock.mockRejectedValue(
      new Error(
        "PP fallback failed at https://example.test/private Bearer sensitive-token\ncontinued",
      ),
    );

    try {
      mockFinishedGameData(seasonGameId, {
        rightRail: { teamGameStats: completeTeamGameStats() },
      });
      const seasonClient = createStatsSupabase({
        gameId: seasonGameId,
        includeGamesQuery: true,
      });
      createClientMock.mockReturnValue(seasonClient.supabase);
      const seasonRes = createMockRes();
      await seasonHandler(
        {
          method: "GET",
          query: { seasonId: "20252026", runMode: "full" },
        } as any,
        seasonRes,
      );

      mockFinishedGameData(directGameId, {
        rightRail: { teamGameStats: completeTeamGameStats() },
      });
      const directClient = createStatsSupabase({
        gameId: directGameId,
        includeGamesQuery: false,
      });
      const directRes = createMockRes();
      await gameHandler(
        {
          method: "GET",
          query: { gameId: String(directGameId) },
          supabase: directClient.supabase,
        } as any,
        directRes,
      );

      expect(seasonRes.statusCode).toBe(200);
      expect(directRes.statusCode).toBe(200);
      const logged = consoleError.mock.calls
        .flatMap((call) => call)
        .map((value) =>
          typeof value === "string" ? value : JSON.stringify(value),
        )
        .join(" ");
      expect(logged).toContain(
        "PP fallback failed at [redacted-url] Bearer [redacted] continued",
      );
      expect(logged).not.toContain("sensitive-token");
      expect(logged).not.toContain("https://example.test/private");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("rejects a season landing-ID mismatch before any stat write", async () => {
    const requestedGameId = 2025020023;
    const landingGameId = 2025020099;
    mockFinishedGameData(requestedGameId, { landingGameId });
    const client = createStatsSupabase({
      gameId: requestedGameId,
      includeGamesQuery: true,
    });
    createClientMock.mockReturnValue(client.supabase);
    const req: any = {
      method: "GET",
      query: { seasonId: "20252026", runMode: "full" },
    };
    const res = createMockRes();

    await seasonHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedGameIds: [requestedGameId],
      failures: [
        {
          kind: "game_identity_mismatch",
          code: "GAME_IDENTITY_MISMATCH",
          requestedGameId,
          landingGameId,
        },
      ],
    });
    expect(client.from).not.toHaveBeenCalledWith("players");
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("/api/v1/db/update-stats/[gameId] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies a structured transactional persistence failure as HTTP 500", async () => {
    const gameId = 2025020002;
    mockGoalieGameData(gameId);
    const client = createRpcFailureSupabase(gameId, false);
    const req: any = {
      method: "GET",
      query: { gameId: String(gameId) },
      supabase: client.supabase,
    };
    const res = createMockRes();

    await gameHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedRows: 4,
      failure: {
        kind: "transactional_game_stats_persistence_failure",
        code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
        phase: "persistence_rpc",
        gameId,
        requestedRows: 4,
        expectedTeamRows: 2,
        expectedSkaterRows: 1,
        expectedGoalieRows: 1,
        terminalError: {
          code: "42501",
          message: "transactional game-stat write denied",
        },
      },
    });
    expect(client.from).toHaveBeenCalledWith("players");
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("classifies missing direct-route teamGameStats as HTTP 500", async () => {
    const gameId = 2025020006;
    mockFinishedGameData(gameId, { rightRail: {} });
    const client = createStatsSupabase({ gameId, includeGamesQuery: false });
    const req: any = {
      method: "GET",
      query: { gameId: String(gameId) },
      supabase: client.supabase,
    };
    const res = createMockRes();

    await gameHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedRows: 2,
      failure: {
        kind: "team_game_stats_failure",
        code: "TEAM_GAME_STATS_FAILED",
        phase: "source_validation",
        gameId,
        requestedRows: 2,
      },
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("classifies a direct-route transactional RPC error as HTTP 500", async () => {
    const gameId = 2025020007;
    mockFinishedGameData(gameId);
    const client = createStatsSupabase({
      gameId,
      includeGamesQuery: false,
      rpcError: { code: "42501", message: "transactional write denied" },
    });
    const req: any = {
      method: "GET",
      query: { gameId: String(gameId) },
      supabase: client.supabase,
    };
    const res = createMockRes();

    await gameHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedRows: 4,
      failure: {
        kind: "transactional_game_stats_persistence_failure",
        code: "TRANSACTIONAL_GAME_STATS_PERSISTENCE_FAILED",
        phase: "persistence_rpc",
        gameId,
        expectedTeamRows: 2,
        expectedSkaterRows: 1,
        expectedGoalieRows: 1,
        terminalError: {
          code: "42501",
          message: "transactional write denied",
        },
      },
    });
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("classifies missing direct-route playerByGameStats as HTTP 500", async () => {
    const gameId = 2025020008;
    mockFinishedGameData(gameId, { boxscore: {} });
    const client = createStatsSupabase({ gameId, includeGamesQuery: false });
    const req: any = {
      method: "GET",
      query: { gameId: String(gameId) },
      supabase: client.supabase,
    };
    const res = createMockRes();

    await gameHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failure: {
        kind: "player_game_stats_source_failure",
        code: "PLAYER_GAME_STATS_SOURCE_INCOMPLETE",
        phase: "source_validation",
        gameId,
        missingBatches: ["skaters", "goalies"],
      },
    });
    expect(client.from).not.toHaveBeenCalledWith("players");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a direct landing-ID mismatch before any database write", async () => {
    const requestedGameId = 2025020024;
    const landingGameId = 2025020098;
    mockFinishedGameData(requestedGameId, { landingGameId });
    const client = createStatsSupabase({
      gameId: requestedGameId,
      includeGamesQuery: false,
    });
    const req: any = {
      method: "GET",
      query: { gameId: String(requestedGameId) },
      supabase: client.supabase,
    };
    const res = createMockRes();

    await gameHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      failedRows: 1,
      failure: {
        kind: "game_identity_mismatch",
        code: "GAME_IDENTITY_MISMATCH",
        gameId: requestedGameId,
        requestedGameId,
        landingGameId,
      },
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns caller validation as 400 without invoking an upstream dependency", async () => {
    const req: any = {
      method: "GET",
      query: { gameId: "2025020024.5" },
      supabase: { from: vi.fn() },
    };
    const res = createMockRes();

    await gameHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false });
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns an unclassified upstream failure as bounded HTTP 500", async () => {
    const gameId = 2025020025;
    getMock.mockRejectedValue(
      new Error("fetch failed while loading NHL landing"),
    );
    const req: any = {
      method: "GET",
      query: { gameId: String(gameId) },
      supabase: { from: vi.fn() },
    };
    const res = createMockRes();

    await gameHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      dependencyError: {
        kind: "dependency_error",
        classification: "transport_fetch_failure",
      },
    });
    expect(String(res.body.message).length).toBeLessThanOrEqual(320);
  });
});

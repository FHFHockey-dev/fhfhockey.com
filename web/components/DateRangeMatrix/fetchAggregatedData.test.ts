import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  queryLog: [] as any[],
  shiftResponses: [] as any[],
  playerResponses: [] as any[],
  skaterResponses: [] as any[],
  goalieResponses: [] as any[],
}));

vi.mock("lib/supabase", () => ({
  default: { from: mocks.from },
}));

import {
  CARD_STATS_FILTER_CHUNK_SIZE,
  PLAYER_FALLBACK_CHUNK_SIZE,
  SHIFT_CHART_PAGE_SIZE,
  fetchAggregatedData,
} from "./fetchAggregatedData";

function buildShiftQuery(log: any) {
  const query = {
    select(fields: string) {
      log.select = fields;
      return query;
    },
    eq(column: string, value: unknown) {
      log.eq.push([column, value]);
      return query;
    },
    gte(column: string, value: unknown) {
      log.gte.push([column, value]);
      return query;
    },
    lte(column: string, value: unknown) {
      log.lte.push([column, value]);
      return query;
    },
    in(column: string, values: number[]) {
      log.in.push([column, [...values]]);
      return query;
    },
    order(column: string, options: unknown) {
      log.order.push([column, options]);
      return query;
    },
    range(from: number, to: number) {
      log.range = [from, to];
      const response = mocks.shiftResponses.shift();
      if (!response) throw new Error("Unexpected shift-chart page request.");
      return Promise.resolve(response);
    },
  };
  return query;
}

function buildPlayerQuery(log: any) {
  let requestedIds: number[] = [];
  const query = {
    select(fields: string) {
      log.select = fields;
      return query;
    },
    in(column: string, values: number[]) {
      log.in.push([column, [...values]]);
      requestedIds = values;
      return query;
    },
    order(column: string, options: unknown) {
      log.order.push([column, options]);
      return query;
    },
    range(from: number, to: number) {
      log.range = [from, to];
      const response = mocks.playerResponses.shift() ?? {
        data: requestedIds.map((id) => ({
          id,
          fullName: `Player ${id}`,
          position: "C",
          sweater_number: id % 100,
        })),
        error: null,
      };
      return Promise.resolve(response);
    },
  };
  return query;
}

function buildCardStatsQuery(log: any, responses: any[]) {
  const query = {
    select(fields: string) {
      log.select = fields;
      return query;
    },
    in(column: string, values: number[]) {
      log.in.push([column, [...values]]);
      return query;
    },
    order(column: string, options: unknown) {
      log.order.push([column, options]);
      return query;
    },
    range(from: number, to: number) {
      log.range = [from, to];
      return Promise.resolve(
        responses.shift() ?? {
          data: [],
          error: null,
        },
      );
    },
  };
  return query;
}

function shiftRow(
  id: number,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    game_id: 100000 + id,
    game_type: "2",
    player_id: 97,
    player_first_name: "Connor",
    player_last_name: "McDavid",
    team_id: 22,
    team_abbreviation: "EDM",
    game_toi: "10:00",
    home_or_away: "home",
    opponent_team_abbreviation: "TOR",
    opponent_team_id: 10,
    display_position: "C",
    primary_position: "C",
    time_spent_with: {},
    percent_toi_with: {},
    time_spent_with_mixed: {},
    percent_toi_with_mixed: {},
    game_length: "60:00",
    line_combination: 1,
    pairing_combination: null,
    season_id: 20252026,
    player_type: "F",
    ...overrides,
  };
}

const request = {
  teamId: 22,
  seasonId: 20252026,
  startDate: "2026-03-01",
  endDate: "2026-04-01",
  seasonType: "regularSeason" as const,
  gameIds: [2025020101, 2025020102],
  homeOrAway: "home" as const,
  opponentTeamAbbreviation: "TOR",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryLog.length = 0;
  mocks.shiftResponses.length = 0;
  mocks.playerResponses.length = 0;
  mocks.skaterResponses.length = 0;
  mocks.goalieResponses.length = 0;
  mocks.from.mockImplementation((table: string) => {
    const log = {
      table,
      select: "",
      eq: [] as any[],
      gte: [] as any[],
      lte: [] as any[],
      order: [] as any[],
      range: null as [number, number] | null,
      in: [] as [string, number[]][],
    };
    mocks.queryLog.push(log);

    if (table === "shift_charts") return buildShiftQuery(log);
    if (table === "players") return buildPlayerQuery(log);
    if (table === "skatersGameStats") {
      return buildCardStatsQuery(log, mocks.skaterResponses);
    }
    if (table === "goaliesGameStats") {
      return buildCardStatsQuery(log, mocks.goalieResponses);
    }
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("fetchAggregatedData", () => {
  it("reads every deterministic page and stops after the first short page", async () => {
    const rows = Array.from({ length: SHIFT_CHART_PAGE_SIZE + 7 }, (_, index) =>
      shiftRow(index + 1),
    );
    mocks.shiftResponses.push(
      { data: rows.slice(0, SHIFT_CHART_PAGE_SIZE), error: null },
      { data: rows.slice(SHIFT_CHART_PAGE_SIZE), error: null },
    );

    const result = await fetchAggregatedData(request);

    expect(result.regularSeasonPlayersData[97].regularSeasonData.GP).toBe(
      SHIFT_CHART_PAGE_SIZE + 7,
    );
    const shiftQueries = mocks.queryLog.filter(
      (entry) => entry.table === "shift_charts",
    );
    expect(shiftQueries.map((entry) => entry.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(shiftQueries.map((entry) => entry.order)).toEqual([
      [["id", { ascending: true }]],
      [["id", { ascending: true }]],
    ]);
    expect(shiftQueries[0].eq).toEqual([
      ["team_id", 22],
      ["season_id", 20252026],
      ["game_type", "2"],
      ["home_or_away", "home"],
      ["opponent_team_abbreviation", "TOR"],
    ]);
    expect(shiftQueries[0].gte).toEqual([["game_date", "2026-03-01"]]);
    expect(shiftQueries[0].lte).toEqual([["game_date", "2026-04-01"]]);
    expect(shiftQueries.map((entry) => entry.in)).toEqual([
      [["game_id", [2025020101, 2025020102]]],
      [["game_id", [2025020101, 2025020102]]],
    ]);
    expect(mocks.from).not.toHaveBeenCalledWith("wgo_team_stats");
    expect(result.matchedGameIds).toEqual(
      Array.from(new Set(rows.map((row) => row.game_id))),
    );
  });

  it("rejects the complete request when a later page fails", async () => {
    mocks.shiftResponses.push(
      {
        data: Array.from({ length: SHIFT_CHART_PAGE_SIZE }, (_, index) =>
          shiftRow(index + 1),
        ),
        error: null,
      },
      { data: null, error: new Error("second page failed") },
    );

    await expect(fetchAggregatedData(request)).rejects.toThrow(
      "second page failed",
    );
    expect(mocks.from).not.toHaveBeenCalledWith("players");
  });

  it("server-selects playoffs while preserving the two-bucket result shape", async () => {
    mocks.shiftResponses.push({
      data: [shiftRow(1, { game_type: "3" })],
      error: null,
    });

    const result = await fetchAggregatedData({
      ...request,
      seasonType: "playoffs",
    });

    expect(result.regularSeasonPlayersData).toEqual({});
    expect(result.playoffPlayersData[97].playoffData.GP).toBe(1);
    const shiftQuery = mocks.queryLog.find(
      (entry) => entry.table === "shift_charts",
    );
    expect(shiftQuery.eq).toContainEqual(["game_type", "3"]);
  });

  it("rejects rows whose nullable player identity cannot be aggregated", async () => {
    mocks.shiftResponses.push({
      data: [shiftRow(1, { player_id: null })],
      error: null,
    });

    await expect(fetchAggregatedData(request)).rejects.toThrow(
      "missing a player identity",
    );
    expect(mocks.from).not.toHaveBeenCalledWith("players");
  });

  it.each([0, -1, 97.5])(
    "rejects invalid player identity %s before fallback or card queries",
    async (playerId) => {
      mocks.shiftResponses.push({
        data: [shiftRow(1, { player_id: playerId })],
        error: null,
      });

      await expect(fetchAggregatedData(request)).rejects.toThrow("invalid one");
      expect(mocks.from).not.toHaveBeenCalledWith("players");
      expect(mocks.from).not.toHaveBeenCalledWith("skatersGameStats");
      expect(mocks.from).not.toHaveBeenCalledWith("goaliesGameStats");
    },
  );

  it("chunks every player fallback lookup within the bounded ID limit", async () => {
    mocks.shiftResponses.push({
      data: Array.from({ length: 401 }, (_, index) =>
        shiftRow(index + 1, { player_id: index + 1 }),
      ),
      error: null,
    });

    const result = await fetchAggregatedData(request);

    expect(Object.keys(result.regularSeasonPlayersData)).toHaveLength(401);
    const fallbackQueries = mocks.queryLog.filter(
      (entry) => entry.table === "players",
    );
    expect(fallbackQueries.map((entry) => entry.in[0][1].length)).toEqual([
      PLAYER_FALLBACK_CHUNK_SIZE,
      PLAYER_FALLBACK_CHUNK_SIZE,
      1,
    ]);
    expect(fallbackQueries.map((entry) => entry.order)).toEqual([
      [["id", { ascending: true }]],
      [["id", { ascending: true }]],
      [["id", { ascending: true }]],
    ]);
    expect(fallbackQueries.map((entry) => entry.range)).toEqual([
      [0, 999],
      [0, 999],
      [0, 999],
    ]);
  });

  it("rejects instead of returning partial metadata when a later fallback chunk fails", async () => {
    mocks.shiftResponses.push({
      data: Array.from({ length: PLAYER_FALLBACK_CHUNK_SIZE + 1 }, (_, index) =>
        shiftRow(index + 1, { player_id: index + 1 }),
      ),
      error: null,
    });
    mocks.playerResponses.push(
      {
        data: Array.from(
          { length: PLAYER_FALLBACK_CHUNK_SIZE },
          (_, index) => ({
            id: index + 1,
            fullName: `Player ${index + 1}`,
            position: "C",
            sweater_number: null,
          }),
        ),
        error: null,
      },
      {
        data: null,
        error: new Error("fallback lookup failed"),
      },
    );

    await expect(fetchAggregatedData(request)).rejects.toThrow(
      "fallback lookup failed",
    );
    expect(
      mocks.queryLog.filter((entry) => entry.table === "players"),
    ).toHaveLength(2);
  });

  it("aggregates exact skater and goalie card stats from only the post-filter matched games", async () => {
    const firstGameId = 2025020101;
    const secondGameId = 2025020102;
    const unmatchedRequestedGameId = 2025020103;
    mocks.shiftResponses.push({
      data: [
        shiftRow(1, { game_id: firstGameId }),
        shiftRow(2, { game_id: secondGameId }),
        shiftRow(3, {
          game_id: firstGameId,
          player_id: 35,
          player_first_name: "Stuart",
          player_last_name: "Skinner",
          display_position: "G",
          primary_position: "G",
          player_type: "G",
          line_combination: null,
        }),
        shiftRow(4, {
          game_id: secondGameId,
          player_id: 35,
          player_first_name: "Stuart",
          player_last_name: "Skinner",
          display_position: "G",
          primary_position: "G",
          player_type: "G",
          line_combination: null,
        }),
      ],
      error: null,
    });
    mocks.skaterResponses.push({
      data: [
        {
          created_at: "2026-03-01T12:00:00.000Z",
          gameId: firstGameId,
          playerId: 97,
          goals: 1,
          assists: 2,
          points: 3,
          powerPlayPoints: 1,
          shots: 5,
          hits: 2,
          blockedShots: 1,
          plusMinus: 2,
        },
        {
          created_at: "2026-03-02T12:00:00.000Z",
          gameId: secondGameId,
          playerId: 97,
          goals: 2,
          assists: 1,
          points: 3,
          powerPlayPoints: 2,
          shots: 7,
          hits: 3,
          blockedShots: 2,
          plusMinus: -1,
        },
      ],
      error: null,
    });
    mocks.goalieResponses.push({
      data: [
        {
          created_at: "2026-03-01T12:00:00.000Z",
          gameId: firstGameId,
          playerId: 35,
          goalsAgainst: 2,
          saveShotsAgainst: "25/27",
          toi: "60:00",
        },
        {
          created_at: "2026-03-02T12:00:00.000Z",
          gameId: secondGameId,
          playerId: 35,
          goalsAgainst: 1,
          saveShotsAgainst: "30/31",
          toi: "60:00",
        },
      ],
      error: null,
    });

    const result = await fetchAggregatedData({
      ...request,
      gameIds: [firstGameId, secondGameId, unmatchedRequestedGameId],
    });

    expect(result.matchedGameIds).toEqual([firstGameId, secondGameId]);
    expect(result.cardStats.scopeGameIds).toEqual([firstGameId, secondGameId]);
    expect(result.cardStats.skatersByPlayerId[97]).toEqual({
      gamesPlayed: 2,
      goals: 3,
      assists: 3,
      points: 6,
      powerPlayPoints: 3,
      shots: 12,
      hits: 5,
      blockedShots: 3,
      plusMinus: 1,
    });
    expect(result.cardStats.goaliesByPlayerId[35]).toEqual({
      gamesPlayed: 2,
      saves: 55,
      savePercentage: 55 / 58,
      goalsAgainstAverage: 1.5,
    });

    const skaterQuery = mocks.queryLog.find(
      (entry) => entry.table === "skatersGameStats",
    );
    const goalieQuery = mocks.queryLog.find(
      (entry) => entry.table === "goaliesGameStats",
    );
    for (const query of [skaterQuery, goalieQuery]) {
      expect(query.in[0]).toEqual(["gameId", [firstGameId, secondGameId]]);
      expect(query.in[0][1]).not.toContain(unmatchedRequestedGameId);
      expect(
        query.in.every(
          ([, values]: [string, number[]]) =>
            values.length <= CARD_STATS_FILTER_CHUNK_SIZE,
        ),
      ).toBe(true);
      expect(query.order).toEqual([
        ["gameId", { ascending: true }],
        ["playerId", { ascending: true }],
        ["created_at", { ascending: true }],
      ]);
      expect(query.range).toEqual([0, 999]);
    }
    expect(skaterQuery.in[1]).toEqual(["playerId", [97]]);
    expect(goalieQuery.in[1]).toEqual(["playerId", [35]]);
  });

  it("keeps an injured player's stats to only their appearances inside a sparse matched scope", async () => {
    const gameIds = [2025020101, 2025020102, 2025020103];
    mocks.shiftResponses.push({
      data: [
        shiftRow(1, { game_id: gameIds[0], player_id: 98 }),
        shiftRow(2, { game_id: gameIds[1], player_id: 98 }),
        shiftRow(3, { game_id: gameIds[2], player_id: 98 }),
        shiftRow(4, { game_id: gameIds[2], player_id: 97 }),
      ],
      error: null,
    });
    const statsRow = (gameId: number, playerId: number) => ({
      created_at: `2026-03-${String(gameId % 100).padStart(2, "0")}T12:00:00.000Z`,
      gameId,
      playerId,
      goals: 0,
      assists: 0,
      points: 0,
      powerPlayPoints: 0,
      shots: 0,
      hits: 0,
      blockedShots: 0,
      plusMinus: 0,
    });
    mocks.skaterResponses.push({
      data: [
        ...gameIds.map((gameId) => statsRow(gameId, 98)),
        {
          ...statsRow(gameIds[2], 97),
          goals: 2,
          points: 2,
          shots: 6,
        },
      ],
      error: null,
    });

    const result = await fetchAggregatedData({ ...request, gameIds });

    expect(result.cardStats.scopeGameIds).toEqual(gameIds);
    expect(result.cardStats.skatersByPlayerId[97]).toEqual({
      gamesPlayed: 1,
      goals: 2,
      assists: 0,
      points: 2,
      powerPlayPoints: 0,
      shots: 6,
      hits: 0,
      blockedShots: 0,
      plusMinus: 0,
    });
    const skaterQuery = mocks.queryLog.find(
      (entry) => entry.table === "skatersGameStats",
    );
    expect(skaterQuery.in).toContainEqual(["gameId", gameIds]);
  });

  it("leaves semantically contradictory skater and goalie rows unavailable", async () => {
    const gameId = 2025020101;
    mocks.shiftResponses.push({
      data: [
        shiftRow(1, { game_id: gameId, player_id: 97 }),
        shiftRow(2, {
          game_id: gameId,
          player_id: 35,
          display_position: "G",
          primary_position: "G",
          player_type: "G",
          line_combination: null,
        }),
        shiftRow(3, {
          game_id: gameId,
          player_id: 36,
          display_position: "G",
          primary_position: "G",
          player_type: "G",
          line_combination: null,
        }),
      ],
      error: null,
    });
    mocks.skaterResponses.push({
      data: [
        {
          created_at: "2026-03-01T12:00:00.000Z",
          gameId,
          playerId: 97,
          goals: 1,
          assists: 0,
          points: 9,
          powerPlayPoints: 8,
          shots: 5,
          hits: 0,
          blockedShots: 0,
          plusMinus: 0,
        },
      ],
      error: null,
    });
    mocks.goalieResponses.push({
      data: [
        {
          created_at: "2026-03-01T12:00:00.000Z",
          gameId,
          playerId: 35,
          goalsAgainst: 7,
          saveShotsAgainst: "25/27",
          toi: "60:00",
        },
        {
          created_at: "2026-03-01T12:00:00.000Z",
          gameId,
          playerId: 36,
          goalsAgainst: 2,
          saveShotsAgainst: "25/27",
          toi: "60:99",
        },
      ],
      error: null,
    });

    const result = await fetchAggregatedData({ ...request, gameIds: [gameId] });

    expect(result.cardStats.skatersByPlayerId).not.toHaveProperty("97");
    expect(result.cardStats.goaliesByPlayerId).not.toHaveProperty("35");
    expect(result.cardStats.goaliesByPlayerId).not.toHaveProperty("36");
  });

  it("leaves missing, duplicate, and invalid coverage unavailable instead of fabricating zeros", async () => {
    const firstGameId = 2025020101;
    const secondGameId = 2025020102;
    mocks.shiftResponses.push({
      data: [
        shiftRow(1, { game_id: firstGameId, player_id: 97 }),
        shiftRow(2, { game_id: secondGameId, player_id: 97 }),
        shiftRow(3, { game_id: firstGameId, player_id: 98 }),
        shiftRow(4, { game_id: secondGameId, player_id: 98 }),
        shiftRow(5, { game_id: firstGameId, player_id: 99 }),
        shiftRow(6, { game_id: secondGameId, player_id: 99 }),
        shiftRow(7, { game_id: firstGameId, player_id: 100 }),
        shiftRow(8, { game_id: secondGameId, player_id: 100 }),
      ],
      error: null,
    });
    const zeroRow = (gameId: number, playerId: number, created_at: string) => ({
      created_at,
      gameId,
      playerId,
      goals: 0,
      assists: 0,
      points: 0,
      powerPlayPoints: 0,
      shots: 0,
      hits: 0,
      blockedShots: 0,
      plusMinus: 0,
    });
    mocks.skaterResponses.push({
      data: [
        zeroRow(firstGameId, 97, "2026-03-01T12:00:00.000Z"),
        zeroRow(firstGameId, 98, "2026-03-01T12:00:00.000Z"),
        zeroRow(firstGameId, 98, "2026-03-01T12:01:00.000Z"),
        zeroRow(secondGameId, 98, "2026-03-02T12:00:00.000Z"),
        zeroRow(firstGameId, 99, "2026-03-01T12:00:00.000Z"),
        zeroRow(secondGameId, 99, "2026-03-02T12:00:00.000Z"),
        {
          ...zeroRow(firstGameId, 100, "2026-03-01T12:00:00.000Z"),
          goals: null,
        },
        zeroRow(secondGameId, 100, "2026-03-02T12:00:00.000Z"),
      ],
      error: null,
    });

    const result = await fetchAggregatedData({
      ...request,
      gameIds: [firstGameId, secondGameId],
    });

    expect(result.cardStats.skatersByPlayerId).not.toHaveProperty("97");
    expect(result.cardStats.skatersByPlayerId).not.toHaveProperty("98");
    expect(result.cardStats.skatersByPlayerId).not.toHaveProperty("100");
    expect(result.cardStats.skatersByPlayerId[99]).toEqual({
      gamesPlayed: 2,
      goals: 0,
      assists: 0,
      points: 0,
      powerPlayPoints: 0,
      shots: 0,
      hits: 0,
      blockedShots: 0,
      plusMinus: 0,
    });
  });

  it("rejects the complete request when a later card-stat page fails", async () => {
    const scopedGameId = 2025020101;
    mocks.shiftResponses.push({
      data: [shiftRow(1, { game_id: scopedGameId })],
      error: null,
    });
    mocks.skaterResponses.push(
      {
        data: Array.from({ length: SHIFT_CHART_PAGE_SIZE }, (_, index) => ({
          created_at: `2026-03-01T12:${String(index % 60).padStart(2, "0")}:00.000Z`,
          gameId: scopedGameId,
          playerId: 97,
          goals: 0,
          assists: 0,
          points: 0,
          powerPlayPoints: 0,
          shots: 0,
          hits: 0,
          blockedShots: 0,
          plusMinus: 0,
        })),
        error: null,
      },
      { data: null, error: new Error("card-stat second page failed") },
    );

    await expect(
      fetchAggregatedData({ ...request, gameIds: [scopedGameId] }),
    ).rejects.toThrow("card-stat second page failed");

    const skaterQueries = mocks.queryLog.filter(
      (entry) => entry.table === "skatersGameStats",
    );
    expect(skaterQueries.map((entry) => entry.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(skaterQueries.every((entry) => entry.order.length === 3)).toBe(true);
  });

  it("fails before querying when team, season, or date ownership is invalid", async () => {
    await expect(
      fetchAggregatedData({ ...request, teamId: 0 }),
    ).rejects.toThrow("valid team ID");
    await expect(
      fetchAggregatedData({ ...request, seasonId: 0 }),
    ).rejects.toThrow("valid season ID");
    await expect(
      fetchAggregatedData({
        ...request,
        startDate: "2026-04-02",
        endDate: "2026-04-01",
      }),
    ).rejects.toThrow("valid matrix date range");
    await expect(
      fetchAggregatedData({ ...request, gameIds: [] }),
    ).rejects.toThrow("valid fixed game-ID scope");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

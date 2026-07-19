import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  buildShiftStrengthUpsertsMock,
  fetchPbpGameMock,
  fetchShiftRowsMock,
  hasCompleteStoredPbpGameMock,
  isCompleteFinalPbpPayloadMock,
  replaceShiftStrengthRowsForGameMock,
  upsertPbpGameAndPlaysMock,
  state,
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  buildShiftStrengthUpsertsMock: vi.fn(),
  fetchPbpGameMock: vi.fn(),
  fetchShiftRowsMock: vi.fn(),
  hasCompleteStoredPbpGameMock: vi.fn(),
  isCompleteFinalPbpPayloadMock: vi.fn(),
  replaceShiftStrengthRowsForGameMock: vi.fn(),
  upsertPbpGameAndPlaysMock: vi.fn(),
  state: {
    pbpComplete: new Set<number>(),
    pbpEventIds: new Map<number, number[]>(),
    shiftComplete: new Set<number>(),
    storedShiftRows: new Map<number, any[]>(),
  },
}));

vi.mock("lib/projections/ingest/pbp", () => ({
  buildExpectedPbpSourceEvidence: (payload: any) => ({
    game: {
      id: payload.id,
      date: payload.gameDate,
      hometeamid: payload.homeTeam.id,
      awayteamid: payload.awayTeam.id,
      type: payload.gameType,
      season: String(payload.season),
      hometeamabbrev: payload.homeTeam.abbrev,
      awayteamabbrev: payload.awayTeam.abbrev,
      hometeamscore: payload.homeTeam.score,
      awayteamscore: payload.awayTeam.score,
    },
    eventIds: payload.plays.map((play: any) => play.eventId),
  }),
  fetchPbpGame: fetchPbpGameMock,
  isCompleteFinalPbpPayload: isCompleteFinalPbpPayloadMock,
  upsertPbpGameAndPlays: upsertPbpGameAndPlaysMock,
}));

vi.mock("lib/projections/pbpCompletenessServer", () => ({
  hasCompleteStoredPbpGame: hasCompleteStoredPbpGameMock,
}));

vi.mock("lib/projections/ingest/shifts", () => ({
  buildShiftStrengthUpserts: buildShiftStrengthUpsertsMock,
  fetchAllNhleShiftChartsForGame: fetchShiftRowsMock,
  replaceShiftStrengthRowsForGame: replaceShiftStrengthRowsForGameMock,
}));

const games = Array.from({ length: 7 }, (_, index) => ({
  id: 101 + index,
  date: "2026-03-20",
}));

function pbpPayload(gameId: number) {
  return {
    id: gameId,
    season: 20252026,
    gameType: 2,
    gameState: "OFF",
    gameDate: "2026-03-20",
    startTimeUTC: "2026-03-20T23:00:00Z",
    awayTeam: {
      id: 2,
      abbrev: "BBB",
      commonName: { default: "B" },
      score: 1,
    },
    homeTeam: {
      id: 1,
      abbrev: "AAA",
      commonName: { default: "A" },
      score: 2,
    },
    plays: [
      { eventId: 1, periodDescriptor: { number: 1 } },
      {
        eventId: 2,
        typeDescKey: "game-end",
        periodDescriptor: { number: 3 },
      },
    ],
  };
}

function sourceShiftRows(gameId: number) {
  return [
    {
      gameId,
      playerId: gameId * 10 + 1,
      teamId: 1,
      teamAbbrev: "AAA",
      firstName: "Home",
      lastName: "Player",
      period: 1,
      startTime: "0:00",
      endTime: "0:30",
      duration: "0:30",
      typeCode: 517,
    },
    {
      gameId,
      playerId: gameId * 10 + 2,
      teamId: 2,
      teamAbbrev: "BBB",
      firstName: "Away",
      lastName: "Player",
      period: 1,
      startTime: "0:00",
      endTime: "0:30",
      duration: "0:30",
      typeCode: 517,
    },
    {
      gameId,
      playerId: gameId * 10 + 1,
      teamId: 1,
      teamAbbrev: "AAA",
      firstName: "Home",
      lastName: "Player",
      period: 1,
      startTime: "0:30",
      endTime: "1:00",
      duration: "0:30",
      typeCode: 517,
    },
  ];
}

function completeStoredShiftRows(gameId: number) {
  const playerRows = Array.from(
    new Map(
      sourceShiftRows(gameId).map((shift) => [shift.playerId, shift]),
    ).values(),
  );
  return playerRows.map((shift, index) => {
    const home = shift.teamId === 1;
    return {
      id: gameId * 100 + index,
      game_id: gameId,
      player_id: shift.playerId,
      team_id: shift.teamId,
      opponent_team_id: home ? 2 : 1,
      season_id: 20252026,
      game_date: "2026-03-20",
      game_type: "2",
      home_or_away: home ? "home" : "away",
      team_abbreviation: home ? "AAA" : "BBB",
      opponent_team_abbreviation: home ? "BBB" : "AAA",
      total_es_toi: "0:30",
      total_pp_toi: "0:00",
      total_pk_toi: "0:00",
    };
  });
}

function completeStoredPbp(gameId: number) {
  return {
    id: gameId,
    date: "2026-03-20",
    hometeamid: 1,
    awayteamid: 2,
    type: 2,
    season: "20252026",
    hometeamabbrev: "AAA",
    awayteamabbrev: "BBB",
    hometeamscore: 2,
    awayteamscore: 1,
  };
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      if (table === "games") {
        const query: any = {
          select: vi.fn(() => query),
          gte: vi.fn(() => query),
          lte: vi.fn(() => query),
          order: vi.fn(() => query),
          range: vi.fn(async () => ({ data: games, error: null })),
        };
        return query;
      }

      if (table === "pbp_games") {
        let gameId = -1;
        const query: any = {
          select: vi.fn(() => query),
          eq: vi.fn((_column: string, value: number) => {
            gameId = value;
            return query;
          }),
          maybeSingle: vi.fn(async () => ({
            data: state.pbpComplete.has(gameId)
              ? completeStoredPbp(gameId)
              : { id: gameId },
            error: null,
          })),
        };
        return query;
      }

      if (table === "pbp_plays") {
        let gameId = -1;
        const query: any = {
          count: 0,
          error: null,
          select: vi.fn(() => query),
          eq: vi.fn((column: string, value: number | string) => {
            if (column === "gameid") {
              gameId = Number(value);
              query.count = state.pbpComplete.has(gameId) ? 2 : 0;
              return query;
            }
            if (column === "typedesckey") {
              return Promise.resolve({
                count: state.pbpComplete.has(gameId) ? 1 : 0,
                error: null,
              });
            }
            return query;
          }),
        };
        return query;
      }

      if (table === "shift_charts") {
        let gameId = -1;
        const query: any = {
          select: vi.fn(() => query),
          eq: vi.fn((_column: string, value: number) => {
            gameId = value;
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(async () => ({
            data:
              state.storedShiftRows.get(gameId) ??
              (state.shiftComplete.has(gameId)
                ? completeStoredShiftRows(gameId)
                : []),
            error: null,
          })),
        };
        return query;
      }

      return { insert: auditInsertMock };
    }),
  },
}));

import handler, {
  previousUtcDate,
} from "../../../../../pages/api/v1/db/ingest-projection-inputs";

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

describe("/api/v1/db/ingest-projection-inputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.pbpComplete.clear();
    state.pbpEventIds.clear();
    state.shiftComplete.clear();
    state.storedShiftRows.clear();
    fetchPbpGameMock.mockImplementation(async (gameId: number) =>
      pbpPayload(gameId),
    );
    isCompleteFinalPbpPayloadMock.mockReturnValue(true);
    hasCompleteStoredPbpGameMock.mockImplementation(
      async (gameId: number, expected?: { eventIds: number[] }) => {
        if (!state.pbpComplete.has(gameId)) return false;
        if (!expected) return true;
        return (
          JSON.stringify(state.pbpEventIds.get(gameId) ?? []) ===
          JSON.stringify(expected.eventIds)
        );
      },
    );
    fetchShiftRowsMock.mockImplementation(async (gameId: number) =>
      sourceShiftRows(gameId),
    );
    upsertPbpGameAndPlaysMock.mockImplementation(async (payload: any) => {
      state.pbpComplete.add(payload.id);
      state.pbpEventIds.set(
        payload.id,
        payload.plays.map((play: any) => play.eventId),
      );
      return { playsUpserted: 5 };
    });
    buildShiftStrengthUpsertsMock.mockImplementation(
      (gameId: number, _pbp: any, rows: any[]) =>
        Array.from(new Set(rows.map((row) => row.playerId))).map(
          (playerId) => ({
            game_id: gameId,
            player_id: playerId,
          }),
        ),
    );
    replaceShiftStrengthRowsForGameMock.mockImplementation(
      async (gameId: number) => {
        state.shiftComplete.add(gameId);
        state.storedShiftRows.delete(gameId);
        return { rowsUpserted: 2 };
      },
    );
  });

  it("reconciles every same-date game by default instead of truncating at six", async () => {
    games.forEach((game) => {
      state.pbpComplete.add(game.id);
      state.shiftComplete.add(game.id);
    });
    const req: any = {
      method: "POST",
      query: { startDate: "2026-03-20", endDate: "2026-03-20" },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      maxGames: null,
      gamesTotal: 7,
      nextGameId: null,
      gamesProcessed: 7,
      skipped: 0,
      pbpGamesUpserted: 7,
      shiftRowsUpserted: 14,
    });
    expect(fetchPbpGameMock).toHaveBeenCalledTimes(7);
    expect(fetchShiftRowsMock).toHaveBeenCalledTimes(7);
    expect(upsertPbpGameAndPlaysMock).toHaveBeenCalledTimes(7);
    expect(replaceShiftStrengthRowsForGameMock).toHaveBeenCalledTimes(7);
  });

  it("uses the previous UTC date for an empty scheduled request", () => {
    expect(previousUtcDate(new Date("2026-03-20T09:45:00Z"))).toBe(
      "2026-03-19",
    );
  });

  it("accepts the returned game cursor and continues deterministically", async () => {
    games.forEach((game) => {
      state.pbpComplete.add(game.id);
      state.shiftComplete.add(game.id);
    });
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        resumeFromGameId: "105",
        maxGames: "2",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fetchPbpGameMock.mock.calls.map(([gameId]) => gameId)).toEqual([
      105, 106,
    ]);
    expect(res.body.nextGameId).toBe(107);
  });

  it("refreshes a PBP shell and reuses one canonical source payload", async () => {
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchPbpGameMock).toHaveBeenCalledTimes(1);
    expect(upsertPbpGameAndPlaysMock).toHaveBeenCalledWith(pbpPayload(101));
    expect(buildShiftStrengthUpsertsMock).toHaveBeenCalledWith(
      101,
      pbpPayload(101),
      sourceShiftRows(101),
    );
    expect(replaceShiftStrengthRowsForGameMock).toHaveBeenCalledWith(
      101,
      expect.arrayContaining([
        expect.objectContaining({ game_id: 101, player_id: 1011 }),
      ]),
    );
  });

  it("repairs a DRM-only partial row instead of accepting any row", async () => {
    state.pbpComplete.add(101);
    state.storedShiftRows.set(101, [
      {
        ...completeStoredShiftRows(101)[0],
        total_pk_toi: null,
      },
    ]);
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(upsertPbpGameAndPlaysMock).toHaveBeenCalledTimes(1);
    expect(replaceShiftStrengthRowsForGameMock).toHaveBeenCalledTimes(1);
    expect(res.body.shiftRowsUpserted).toBe(2);
  });

  it("refreshes complete stored PBP and shifts from one authoritative source snapshot", async () => {
    state.pbpComplete.add(101);
    state.shiftComplete.add(101);
    const corrected = {
      ...pbpPayload(101),
      plays: [
        { eventId: 1, typeDescKey: "shot-on-goal" },
        { eventId: 3, typeDescKey: "goal" },
        { eventId: 4, typeDescKey: "game-end" },
      ],
    };
    fetchPbpGameMock.mockResolvedValueOnce(corrected);
    upsertPbpGameAndPlaysMock.mockImplementationOnce(async (payload: any) => {
      state.pbpComplete.add(payload.id);
      state.pbpEventIds.set(
        payload.id,
        payload.plays.map((play: any) => play.eventId),
      );
      return { playsUpserted: payload.plays.length };
    });
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(upsertPbpGameAndPlaysMock).toHaveBeenCalledWith(corrected);
    expect(buildShiftStrengthUpsertsMock).toHaveBeenCalledWith(
      101,
      corrected,
      sourceShiftRows(101),
    );
    expect(replaceShiftStrengthRowsForGameMock).toHaveBeenCalledWith(
      101,
      expect.arrayContaining([
        expect.objectContaining({ game_id: 101, player_id: 1011 }),
      ]),
    );
    expect(res.body).toMatchObject({
      success: true,
      gamesProcessed: 1,
      skipped: 0,
      pbpGamesUpserted: 1,
      pbpPlaysUpserted: 3,
      shiftRowsUpserted: 2,
      rowsUpserted: 6,
    });
  });

  it("records the failing source stage without advancing success", async () => {
    fetchPbpGameMock.mockRejectedValueOnce(new Error("upstream fetch failed"));
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.errors[0]).toMatchObject({
      gameId: 101,
      date: "2026-03-20",
      stage: "fetch_pbp",
      message: "upstream fetch failed",
    });
    expect(res.body.nextGameId).toBe(101);
  });

  it("rejects a nonfinal PBP payload before any persistence", async () => {
    isCompleteFinalPbpPayloadMock.mockReturnValueOnce(false);
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.errors[0]).toMatchObject({
      gameId: 101,
      stage: "fetch_pbp",
      message: "PBP is not final and complete for game 101",
    });
    expect(res.body.nextGameId).toBe(101);
    expect(upsertPbpGameAndPlaysMock).not.toHaveBeenCalled();
    expect(buildShiftStrengthUpsertsMock).not.toHaveBeenCalled();
    expect(replaceShiftStrengthRowsForGameMock).not.toHaveBeenCalled();
  });

  it("validates the complete shift payload before replacing stored PBP", async () => {
    buildShiftStrengthUpsertsMock.mockImplementationOnce(() => {
      throw new Error("shift timeline is incomplete");
    });
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({
      success: false,
      nextGameId: 101,
      errors: [
        expect.objectContaining({
          gameId: 101,
          stage: "precheck_shifts",
          message: "shift timeline is incomplete",
        }),
      ],
    });
    expect(upsertPbpGameAndPlaysMock).not.toHaveBeenCalled();
    expect(replaceShiftStrengthRowsForGameMock).not.toHaveBeenCalled();
  });

  it("does not mutate PBP when the shift source is unavailable", async () => {
    fetchShiftRowsMock.mockRejectedValueOnce(
      new Error("shift source unavailable"),
    );
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body.errors[0]).toMatchObject({
      gameId: 101,
      stage: "fetch_shifts",
      message: "shift source unavailable",
    });
    expect(upsertPbpGameAndPlaysMock).not.toHaveBeenCalled();
    expect(replaceShiftStrengthRowsForGameMock).not.toHaveBeenCalled();
  });

  it("requires exact stored event identity parity after PBP replacement", async () => {
    upsertPbpGameAndPlaysMock.mockResolvedValueOnce({ playsUpserted: 2 });
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(hasCompleteStoredPbpGameMock).toHaveBeenLastCalledWith(
      101,
      expect.objectContaining({ eventIds: [1, 2] }),
    );
    expect(res.body.errors[0]).toMatchObject({
      gameId: 101,
      stage: "upsert_pbp",
      message: "PBP post-write verification failed for game 101",
    });
    expect(replaceShiftStrengthRowsForGameMock).not.toHaveBeenCalled();
  });
});

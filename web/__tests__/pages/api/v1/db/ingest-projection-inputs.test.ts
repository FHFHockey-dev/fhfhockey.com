import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

const {
  auditInsertMock,
  acquireProjectionPipelineLeaseMock,
  advanceProjectionPipelineLeaseMock,
  buildProjectionPipelineOperationKeyMock,
  buildProjectionInputRpcPayloadMock,
  buildShiftStrengthUpsertsMock,
  captureProjectionRawSourceSnapshotsMock,
  fetchPbpGameMock,
  fetchShiftRowsMock,
  hasCompleteStoredPbpGameMock,
  isCompleteFinalPbpPayloadMock,
  persistProjectionGameInputsMock,
  readProjectionInputManifestMock,
  readOldestProjectionPipelineBacklogMock,
  finishProjectionPipelineLeaseMock,
  state,
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  acquireProjectionPipelineLeaseMock: vi.fn(),
  advanceProjectionPipelineLeaseMock: vi.fn(),
  buildProjectionPipelineOperationKeyMock: vi.fn(),
  buildProjectionInputRpcPayloadMock: vi.fn(),
  buildShiftStrengthUpsertsMock: vi.fn(),
  captureProjectionRawSourceSnapshotsMock: vi.fn(),
  fetchPbpGameMock: vi.fn(),
  fetchShiftRowsMock: vi.fn(),
  hasCompleteStoredPbpGameMock: vi.fn(),
  isCompleteFinalPbpPayloadMock: vi.fn(),
  persistProjectionGameInputsMock: vi.fn(),
  readProjectionInputManifestMock: vi.fn(),
  readOldestProjectionPipelineBacklogMock: vi.fn(),
  finishProjectionPipelineLeaseMock: vi.fn(),
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
}));

vi.mock("lib/projections/pbpCompletenessServer", () => ({
  hasCompleteStoredPbpGame: hasCompleteStoredPbpGameMock,
}));

vi.mock("lib/projections/ingest/shifts", () => ({
  buildShiftStrengthUpserts: buildShiftStrengthUpsertsMock,
  fetchAllNhleShiftChartsSnapshotForGame: fetchShiftRowsMock,
}));

vi.mock("lib/projections/ingest/rawSnapshotPersistence", () => ({
  captureProjectionRawSourceSnapshots: captureProjectionRawSourceSnapshotsMock,
}));

vi.mock("lib/projections/ingest/projectionInputPersistence", () => ({
  buildProjectionInputRpcPayload: buildProjectionInputRpcPayloadMock,
  persistProjectionGameInputs: persistProjectionGameInputsMock,
  readProjectionInputManifest: readProjectionInputManifestMock,
}));

vi.mock("lib/projections/projectionPipelineState", () => ({
  acquireProjectionPipelineLease: acquireProjectionPipelineLeaseMock,
  advanceProjectionPipelineLease: advanceProjectionPipelineLeaseMock,
  buildProjectionPipelineOperationKey: buildProjectionPipelineOperationKeyMock,
  finishProjectionPipelineLease: finishProjectionPipelineLeaseMock,
  readOldestProjectionPipelineBacklog: readOldestProjectionPipelineBacklogMock,
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
      shiftNumber: 1,
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
      shiftNumber: 1,
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
      shiftNumber: 2,
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
          or: vi.fn(() => query),
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
    readOldestProjectionPipelineBacklogMock.mockResolvedValue(null);
    buildProjectionPipelineOperationKeyMock.mockImplementation(
      ({ startDate, endDate, force }: any) =>
        `${force ? "force" : "canonical"}:${startDate}:${endDate}`,
    );
    acquireProjectionPipelineLeaseMock.mockImplementation(
      async (args: any) => ({
        pipelineKey: "projection_input_ingest",
        scopeKey: "completed_game_slates",
        operationKey: args.operationKey,
        revision: 1,
        status: "running",
        cursorGameId: null,
        cursorDate: args.initialCursorDate,
        rangeStartDate: args.rangeStartDate,
        rangeEndDate: args.rangeEndDate,
        leaseOwner: "scheduled-test-owner",
        leaseExpiresAt: "2026-07-20T10:10:00.000Z",
        lastError: null,
        updatedAt: "2026-07-20T10:00:00.000Z",
      }),
    );
    advanceProjectionPipelineLeaseMock.mockImplementation(
      async ({ lease, nextCursorDate, nextCursorGameId }: any) => ({
        ...lease,
        revision: lease.revision + 1,
        cursorDate: nextCursorDate,
        cursorGameId: nextCursorGameId,
      }),
    );
    finishProjectionPipelineLeaseMock.mockImplementation(
      async ({ lease, outcome }: any) => ({
        ...lease,
        revision: lease.revision + 1,
        status: outcome,
        leaseOwner: null,
        leaseExpiresAt: null,
      }),
    );
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
    fetchShiftRowsMock.mockImplementation(async (gameId: number) => {
      const rows = sourceShiftRows(gameId);
      return {
        rows,
        rawPayload: { total: rows.length, data: rows, source: "json-api" },
      };
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
    readProjectionInputManifestMock.mockResolvedValue(null);
    captureProjectionRawSourceSnapshotsMock.mockImplementation(
      async ({ gameId }: any) => ({
        gameId,
        pbp: {
          rawPayloadId: gameId * 10 + 1,
          snapshotVersion: 3,
          payloadHash: "c".repeat(64),
        },
        shifts: {
          rawPayloadId: gameId * 10 + 2,
          snapshotVersion: 4,
          payloadHash: "d".repeat(64),
        },
      }),
    );
    buildProjectionInputRpcPayloadMock.mockImplementation((args: any) => ({
      ...args,
      inputFingerprint: `fingerprint-${args.gameId}`,
      playRows: args.pbp.plays,
      strengthRows: args.strengthRows,
    }));
    persistProjectionGameInputsMock.mockImplementation(
      async ({ payload }: any) => {
        state.pbpComplete.add(payload.gameId);
        state.pbpEventIds.set(
          payload.gameId,
          payload.pbp.plays.map((play: any) => play.eventId),
        );
        state.shiftComplete.add(payload.gameId);
        state.storedShiftRows.delete(payload.gameId);
        return {
          gameId: payload.gameId,
          inputStatus: "complete",
          inputFingerprint: payload.inputFingerprint,
          inputVersion: 1,
          playCount: payload.playRows.length,
          strengthCount: payload.strengthRows.length,
          prunedPlayRows: 0,
          prunedStrengthRows: 0,
          idempotent: false,
          completedAt: "2026-07-20T10:00:00.000Z",
        };
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
      gamesVerified: 7,
      gamesIdempotent: 0,
      pbpPlaysVerified: 14,
      shiftRowsVerified: 14,
      rowsVerified: 35,
      pbpPlaysPruned: 0,
      shiftRowsPruned: 0,
      rowsPruned: 0,
      shiftRowsUpserted: 14,
    });
    expect(fetchPbpGameMock).toHaveBeenCalledTimes(7);
    expect(fetchShiftRowsMock).toHaveBeenCalledTimes(7);
    expect(readProjectionInputManifestMock).toHaveBeenCalledTimes(7);
    expect(captureProjectionRawSourceSnapshotsMock).toHaveBeenCalledTimes(7);
    expect(buildProjectionInputRpcPayloadMock).toHaveBeenCalledTimes(7);
    expect(persistProjectionGameInputsMock).toHaveBeenCalledTimes(7);
  });

  it("uses the previous UTC date for an empty scheduled request", () => {
    expect(previousUtcDate(new Date("2026-03-20T09:45:00Z"))).toBe(
      "2026-03-19",
    );
  });

  it.each([
    ["2026-02-30", "2026-03-01"],
    ["not-a-date", "2026-03-01"],
    ["2026-03-21", "2026-03-20"],
  ])(
    "rejects invalid calendar range %s through %s before source work",
    async (startDate, endDate) => {
      const req: any = {
        method: "POST",
        query: { startDate, endDate },
        body: {},
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        errors: [
          expect.objectContaining({
            stage: "list_games",
            message: "Invalid startDate/endDate range",
          }),
        ],
      });
      expect(fetchPbpGameMock).not.toHaveBeenCalled();
      expect(fetchShiftRowsMock).not.toHaveBeenCalled();
      expect(captureProjectionRawSourceSnapshotsMock).not.toHaveBeenCalled();
      expect(persistProjectionGameInputsMock).not.toHaveBeenCalled();
    },
  );

  it("durably advances every default scheduled game before completing its lease", async () => {
    const req: any = { method: "POST", query: {}, body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(acquireProjectionPipelineLeaseMock).toHaveBeenCalledTimes(1);
    expect(advanceProjectionPipelineLeaseMock).toHaveBeenCalledTimes(6);
    expect(
      advanceProjectionPipelineLeaseMock.mock.calls.map(
        ([call]) => call.nextCursorGameId,
      ),
    ).toEqual([102, 103, 104, 105, 106, 107]);
    expect(finishProjectionPipelineLeaseMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "complete" }),
    );
  });

  it("resumes the oldest failed scheduled slate after the UTC date changes", async () => {
    readOldestProjectionPipelineBacklogMock.mockResolvedValueOnce({
      operationKey: "canonical:2026-03-20:2026-03-20",
      rangeStartDate: "2026-03-20",
      rangeEndDate: "2026-03-20",
      cursorDate: "2026-03-20",
      cursorGameId: 103,
      status: "failed",
    });
    acquireProjectionPipelineLeaseMock.mockImplementationOnce(
      async (args: any) => ({
        pipelineKey: "projection_input_ingest",
        scopeKey: "completed_game_slates",
        operationKey: args.operationKey,
        revision: 8,
        status: "running",
        cursorGameId: 103,
        cursorDate: "2026-03-20",
        rangeStartDate: args.rangeStartDate,
        rangeEndDate: args.rangeEndDate,
        leaseOwner: "scheduled-test-owner",
        leaseExpiresAt: "2026-07-20T10:10:00.000Z",
        lastError: null,
        updatedAt: "2026-07-20T10:00:00.000Z",
      }),
    );
    const req: any = { method: "POST", query: {}, body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(readOldestProjectionPipelineBacklogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        throughDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(buildProjectionPipelineOperationKeyMock).not.toHaveBeenCalled();
    expect(acquireProjectionPipelineLeaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationKey: "canonical:2026-03-20:2026-03-20",
        rangeStartDate: "2026-03-20",
        rangeEndDate: "2026-03-20",
        initialCursorDate: "2026-03-20",
      }),
    );
    expect(fetchPbpGameMock.mock.calls[0]?.[0]).toBe(103);
    expect(res.body).toMatchObject({
      startDate: "2026-03-20",
      endDate: "2026-03-20",
      resumeFromDate: "2026-03-20",
      gamesProcessed: 5,
    });
  });

  it("retains the exact scheduled game cursor when a later game fails", async () => {
    fetchPbpGameMock.mockImplementation(async (gameId: number) => {
      if (gameId === 103) throw new Error("bounded test failure");
      return pbpPayload(gameId);
    });
    const req: any = { method: "POST", query: {}, body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({
      success: false,
      nextGameId: 103,
      lastCompletedGameId: 102,
    });
    expect(advanceProjectionPipelineLeaseMock).toHaveBeenCalledTimes(2);
    expect(finishProjectionPipelineLeaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        failureCode: "projection_input_failed",
        lease: expect.objectContaining({ cursorGameId: 103 }),
      }),
    );
  });

  it("fails closed at the exact scheduled cursor on a Gamecenter 404", async () => {
    fetchPbpGameMock.mockImplementation(async (gameId: number) => {
      if (gameId === 103) {
        throw new Error(
          `NHL API HTTP 404 Not Found: /gamecenter/${gameId}/play-by-play`,
        );
      }
      return pbpPayload(gameId);
    });
    const req: any = { method: "POST", query: {}, body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({
      success: false,
      skipped: 0,
      skipReasons: { gamecenterFeedUnavailable: 0 },
      nextGameId: 103,
      lastCompletedGameId: 102,
      errors: [
        expect.objectContaining({
          gameId: 103,
          stage: "fetch_pbp",
          message: "NHL API HTTP 404 Not Found: /gamecenter/103/play-by-play",
        }),
      ],
    });
    expect(advanceProjectionPipelineLeaseMock).toHaveBeenCalledTimes(2);
    expect(finishProjectionPipelineLeaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        failureCode: "projection_input_failed",
        lease: expect.objectContaining({ cursorGameId: 103 }),
      }),
    );
  });

  it("preserves explicit historical Gamecenter 404 skips", async () => {
    fetchPbpGameMock.mockRejectedValueOnce(
      new Error("NHL API HTTP 404 Not Found: /gamecenter/101/play-by-play"),
    );
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "2",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({
      success: true,
      gamesProcessed: 1,
      skipped: 1,
      skipReasons: { gamecenterFeedUnavailable: 1 },
      lastCompletedGameId: 102,
      errors: [],
    });
    expect(fetchPbpGameMock.mock.calls.map(([gameId]) => gameId)).toEqual([
      101, 102,
    ]);
    expect(acquireProjectionPipelineLeaseMock).not.toHaveBeenCalled();
    expect(advanceProjectionPipelineLeaseMock).not.toHaveBeenCalled();
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
    expect(buildShiftStrengthUpsertsMock).toHaveBeenCalledWith(
      101,
      pbpPayload(101),
      sourceShiftRows(101),
    );
    expect(buildProjectionInputRpcPayloadMock).toHaveBeenCalledWith({
      gameId: 101,
      pbp: pbpPayload(101),
      shiftSourceRows: sourceShiftRows(101),
      strengthRows: expect.arrayContaining([
        expect.objectContaining({ game_id: 101, player_id: 1011 }),
      ]),
      rawSnapshots: {
        gameId: 101,
        pbp: {
          rawPayloadId: 1011,
          snapshotVersion: 3,
          payloadHash: "c".repeat(64),
        },
        shifts: {
          rawPayloadId: 1012,
          snapshotVersion: 4,
          payloadHash: "d".repeat(64),
        },
      },
      expectedCurrentInputFingerprint: null,
    });
    expect(persistProjectionGameInputsMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed before normalized persistence when raw snapshot capture fails", async () => {
    captureProjectionRawSourceSnapshotsMock.mockRejectedValueOnce(
      new Error("PROJECTION_RAW_SNAPSHOT_NOT_CURRENT"),
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

    expect(res.body).toMatchObject({
      success: false,
      gamesProcessed: 0,
      nextGameId: 101,
      errors: [
        expect.objectContaining({
          gameId: 101,
          stage: "capture_raw_sources",
          message: "PROJECTION_RAW_SNAPSHOT_NOT_CURRENT",
        }),
      ],
    });
    expect(persistProjectionGameInputsMock).not.toHaveBeenCalled();
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

    expect(persistProjectionGameInputsMock).toHaveBeenCalledTimes(1);
    expect(res.body.shiftRowsUpserted).toBe(2);
  });

  it("passes the current manifest fingerprint into the atomic CAS payload", async () => {
    const currentFingerprint = "a".repeat(64);
    readProjectionInputManifestMock.mockResolvedValueOnce({
      inputFingerprint: currentFingerprint,
      inputVersion: 7,
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

    expect(buildProjectionInputRpcPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 101,
        expectedCurrentInputFingerprint: currentFingerprint,
      }),
    );
    expect(persistProjectionGameInputsMock).toHaveBeenCalledTimes(1);
  });

  it("reports idempotent receipts as verified without mutation attempts", async () => {
    state.pbpComplete.add(101);
    state.pbpEventIds.set(101, [1, 2]);
    state.shiftComplete.add(101);
    persistProjectionGameInputsMock.mockResolvedValueOnce({
      gameId: 101,
      inputStatus: "complete",
      inputFingerprint: "fingerprint-101",
      inputVersion: 1,
      playCount: 2,
      strengthCount: 2,
      prunedPlayRows: 0,
      prunedStrengthRows: 0,
      idempotent: true,
      completedAt: "2026-07-20T10:00:00.000Z",
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
      success: true,
      gamesProcessed: 1,
      pbpGamesUpserted: 0,
      pbpPlaysUpserted: 0,
      shiftRowsUpserted: 0,
      rowsUpserted: 0,
      gamesVerified: 1,
      gamesIdempotent: 1,
      pbpPlaysVerified: 2,
      shiftRowsVerified: 2,
      rowsVerified: 5,
      pbpPlaysPruned: 0,
      shiftRowsPruned: 0,
      rowsPruned: 0,
    });
  });

  it("preserves verified and pruned evidence for mutating receipts", async () => {
    state.pbpComplete.add(101);
    state.pbpEventIds.set(101, [1, 2]);
    state.shiftComplete.add(101);
    persistProjectionGameInputsMock.mockResolvedValueOnce({
      gameId: 101,
      inputStatus: "complete",
      inputFingerprint: "fingerprint-101",
      inputVersion: 2,
      playCount: 2,
      strengthCount: 2,
      prunedPlayRows: 3,
      prunedStrengthRows: 1,
      idempotent: false,
      completedAt: "2026-07-20T10:00:00.000Z",
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
      success: true,
      pbpGamesUpserted: 1,
      pbpPlaysUpserted: 2,
      shiftRowsUpserted: 2,
      rowsUpserted: 5,
      gamesVerified: 1,
      gamesIdempotent: 0,
      pbpPlaysVerified: 2,
      shiftRowsVerified: 2,
      rowsVerified: 5,
      pbpPlaysPruned: 3,
      shiftRowsPruned: 1,
      rowsPruned: 4,
    });
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

    expect(buildShiftStrengthUpsertsMock).toHaveBeenCalledWith(
      101,
      corrected,
      sourceShiftRows(101),
    );
    expect(buildProjectionInputRpcPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 101, pbp: corrected }),
    );
    expect(persistProjectionGameInputsMock).toHaveBeenCalledTimes(1);
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
    expect(buildShiftStrengthUpsertsMock).not.toHaveBeenCalled();
    expect(persistProjectionGameInputsMock).not.toHaveBeenCalled();
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
    expect(readProjectionInputManifestMock).not.toHaveBeenCalled();
    expect(persistProjectionGameInputsMock).not.toHaveBeenCalled();
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
    expect(readProjectionInputManifestMock).not.toHaveBeenCalled();
    expect(persistProjectionGameInputsMock).not.toHaveBeenCalled();
  });

  it("requires exact stored event identity parity after PBP replacement", async () => {
    persistProjectionGameInputsMock.mockResolvedValueOnce({
      gameId: 101,
      inputStatus: "complete",
      inputFingerprint: "fingerprint-101",
      inputVersion: 1,
      playCount: 2,
      strengthCount: 2,
      prunedPlayRows: 0,
      prunedStrengthRows: 0,
      idempotent: false,
      completedAt: "2026-07-20T10:00:00.000Z",
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

    expect(hasCompleteStoredPbpGameMock).toHaveBeenLastCalledWith(
      101,
      expect.objectContaining({ eventIds: [1, 2] }),
    );
    expect(res.body.errors[0]).toMatchObject({
      gameId: 101,
      stage: "verify_pbp",
      message: "PBP post-write verification failed for game 101",
    });
  });

  it("holds the game cursor when the atomic input RPC fails", async () => {
    persistProjectionGameInputsMock.mockRejectedValueOnce(
      new Error("transaction rejected"),
    );
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "2",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({
      success: false,
      gamesProcessed: 0,
      lastCompletedGameId: null,
      nextGameId: 101,
      errors: [
        expect.objectContaining({
          gameId: 101,
          stage: "persist_inputs",
          message: "transaction rejected",
        }),
      ],
    });
    expect(persistProjectionGameInputsMock).toHaveBeenCalledTimes(1);
  });

  it("holds the game cursor when the current manifest cannot be read", async () => {
    readProjectionInputManifestMock.mockRejectedValueOnce(
      new Error("manifest unavailable"),
    );
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        resumeFromGameId: "103",
        maxGames: "2",
      },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({
      success: false,
      gamesProcessed: 0,
      lastCompletedGameId: null,
      nextGameId: 103,
      errors: [
        expect.objectContaining({
          gameId: 103,
          stage: "persist_inputs",
          message: "manifest unavailable",
        }),
      ],
    });
    expect(persistProjectionGameInputsMock).not.toHaveBeenCalled();
  });
});

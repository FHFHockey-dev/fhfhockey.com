import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  fetchAllSupabasePagesMock,
  getCurrentSeasonMock,
  selectPendingRelationshipGameIdsMock,
  serviceFromMock,
  yahooPositionsRangeMock,
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn(),
  fetchAllSupabasePagesMock: vi.fn(),
  getCurrentSeasonMock: vi.fn(),
  selectPendingRelationshipGameIdsMock: vi.fn(),
  serviceFromMock: vi.fn(),
  yahooPositionsRangeMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: serviceFromMock,
  },
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock,
}));
vi.mock("lib/supabase/pagination", () => ({
  fetchAllSupabasePages: fetchAllSupabasePagesMock,
}));
vi.mock("lib/projections/shiftChartRelationshipPayload", () => ({
  buildShiftChartRelationshipUpsert: vi.fn(),
}));
vi.mock("lib/projections/ingest/shifts", async () => {
  const fetchAllNhleShiftChartsForGame = vi.fn();
  const { fetchPbpGame } = await import("lib/projections/ingest/pbp");
  return {
    buildShiftRelationshipStrengthSegments: vi.fn(),
    fetchAllNhleShiftChartsForGame,
    // The route reads the stored snapshots; these stand in for them.
    readStoredProjectionPbp: vi.fn((gameId: number) => fetchPbpGame(gameId)),
    readStoredProjectionShiftSnapshot: vi.fn(async (gameId: number) => {
      const rows = await fetchAllNhleShiftChartsForGame(gameId);
      return {
        rows,
        rawPayload: { total: rows.length, data: rows, source: "json-api" },
        source: "json-api",
        htmlFallbackError: null,
      };
    }),
  };
});
vi.mock("lib/projections/ingest/projectionInputPersistence", () => ({
  buildProjectionPbpSourceHash: vi.fn(),
  buildProjectionShiftSourceHash: vi.fn(),
}));
vi.mock("lib/projections/ingest/pbp", () => ({
  fetchPbpGame: vi.fn(),
  isCompleteFinalPbpPayload: vi.fn(),
}));
vi.mock("lib/projections/relationshipMaterialization", () => ({
  persistShiftChartRelationships: vi.fn(),
  selectPendingRelationshipGameIds: selectPendingRelationshipGameIdsMock,
}));
vi.mock("lib/projections/gameLength", () => ({
  formatCompletedPbpGameLength: vi.fn(),
  normalizeNhlGameType: vi.fn(),
}));

import { formatCompletedPbpGameLength } from "lib/projections/gameLength";
import {
  fetchPbpGame,
  isCompleteFinalPbpPayload,
} from "lib/projections/ingest/pbp";
import {
  buildShiftRelationshipStrengthSegments,
  fetchAllNhleShiftChartsForGame,
  readStoredProjectionShiftSnapshot,
} from "lib/projections/ingest/shifts";
import { persistShiftChartRelationships } from "lib/projections/relationshipMaterialization";
import { buildShiftChartRelationshipUpsert } from "lib/projections/shiftChartRelationshipPayload";
import directShiftChartsHandler from "../../../../../pages/api/v1/db/shift-charts";
import updateShiftsHandler from "../../../../../pages/api/v1/db/update-shifts";

function createMockRes() {
  return {
    body: null as unknown,
    headersSent: false,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  } as any;
}

describe("shift-chart cron audit truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditInsertMock.mockResolvedValue({ error: null });
    fetchAllSupabasePagesMock.mockResolvedValue([]);
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });
    selectPendingRelationshipGameIdsMock.mockReturnValue([]);
    yahooPositionsRangeMock.mockResolvedValue({ data: [], error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "cron_job_audit") {
        return { insert: auditInsertMock };
      }
      if (table === "yahoo_positions") {
        return {
          select: () => ({
            order: () => ({ range: yahooPositionsRangeMock }),
          }),
        };
      }
      throw new Error(`Unexpected service-role table: ${table}`);
    });
  });

  it.each([
    {
      name: "unsupported method",
      method: "GET",
      query: {},
      statusCode: 405,
      message: "Method not allowed. Use POST.",
    },
    {
      name: "invalid game identity",
      method: "POST",
      query: { gameId: "invalid" },
      statusCode: 400,
      message: "Invalid gameId.",
    },
    {
      name: "invalid batch size",
      method: "POST",
      query: { maxGames: "invalid" },
      statusCode: 400,
      message: "Invalid maxGames.",
    },
  ])(
    "records $name as an error audit",
    async ({ method, query, statusCode, message }) => {
      const req = {
        method,
        query,
        url: "/api/v1/db/shift-charts",
      } as any;
      const res = createMockRes();

      await directShiftChartsHandler(req, res);

      expect(res.statusCode).toBe(statusCode);
      expect(res.body).toEqual({ message, success: false });
      expect(auditInsertMock).toHaveBeenCalledOnce();
      expect(auditInsertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          job_name: "update-shift-charts",
          status: "error",
          rows_affected: 0,
          details: expect.objectContaining({
            statusCode,
            error: message,
            response: { message, success: false },
          }),
        }),
      ]);
    },
  );

  it("records success when two same-name players share a team", async () => {
    const gameId = 2026020101;
    const hash = "a".repeat(64);
    const shift = (playerId: number) => ({
      gameId,
      playerId,
      teamId: 23,
      teamAbbrev: "VAN",
      firstName: "Elias",
      lastName: "Pettersson",
      shiftNumber: 1,
      period: 1,
      startTime: "00:00",
      endTime: "00:45",
      duration: "00:45",
      typeCode: 517,
    });
    const rosterSpot = (playerId: number, positionCode: string) => ({
      game_id: gameId,
      player_id: playerId,
      team_id: 23,
      position_code: positionCode,
      source_play_by_play_hash: hash,
    });
    yahooPositionsRangeMock.mockResolvedValue({
      data: [
        ["427.p.7520", "C,LW", "C"],
        ["477.p.32762", "D", "D"],
        ["477.p.7520", "C", "C"],
      ].map(([player_key, display_position, primary_position]) => ({
        player_key,
        full_name: "Elias Pettersson",
        display_position,
        primary_position,
      })),
      error: null,
    });
    const defaultFrom = serviceFromMock.getMockImplementation()!;
    serviceFromMock.mockImplementation((table: string) =>
      table === "projection_game_materialization_status"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    game_id: gameId,
                    input_status: "complete",
                    pbp_raw_payload_hash: hash,
                  },
                  error: null,
                }),
              }),
            }),
          }
        : defaultFrom(table),
    );
    fetchAllSupabasePagesMock.mockResolvedValue([
      rosterSpot(8480012, "C"),
      rosterSpot(8483678, "D"),
    ]);
    vi.mocked(fetchPbpGame).mockResolvedValue({
      id: gameId,
      season: 20262027,
      gameType: 2,
      gameDate: "2026-10-15",
      homeTeam: { id: 23, abbrev: "VAN" },
      awayTeam: { id: 22, abbrev: "EDM" },
    } as any);
    vi.mocked(isCompleteFinalPbpPayload).mockReturnValue(true);
    vi.mocked(fetchAllNhleShiftChartsForGame).mockResolvedValue([
      shift(8480012),
      shift(8483678),
    ]);
    vi.mocked(buildShiftRelationshipStrengthSegments).mockImplementation(
      (_gameId, _pbp, rows) =>
        rows.map((row) => ({
          playerId: row.playerId,
          shiftNumber: row.shiftNumber,
          period: row.period,
          startTime: row.startTime,
          endTime: row.endTime,
          duration: row.duration ?? "00:00",
          strength: "es" as const,
        })),
    );
    vi.mocked(formatCompletedPbpGameLength).mockReturnValue("60:00");
    vi.mocked(buildShiftChartRelationshipUpsert).mockImplementation(
      (row: any) => row,
    );
    vi.mocked(persistShiftChartRelationships).mockResolvedValue({
      relationshipRows: 2,
      idempotent: false,
      prunedRows: 0,
    } as any);
    const req = {
      method: "POST",
      query: { gameId: String(gameId) },
      url: `/api/v1/db/shift-charts?gameId=${gameId}`,
    } as any;
    const res = createMockRes();

    await directShiftChartsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        unmatchedNames: [],
        positionFallbackNames: ["Elias Pettersson"],
        rowsAffected: 2,
      }),
    );
    const positions = vi
      .mocked(buildShiftChartRelationshipUpsert)
      .mock.calls.map(([row]: any[]) => [
        row.player_id,
        row.primary_position,
        row.player_type,
      ]);
    expect(positions).toEqual(
      expect.arrayContaining([
        [8480012, "C", "F"],
        [8483678, "D", "D"],
      ]),
    );
    expect(auditInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        job_name: "update-shift-charts",
        status: "success",
        rows_affected: 2,
      }),
    ]);
  });

  it.each([
    {
      gameId: 2026010007,
      gameType: 1,
      statusCode: 200,
      body: {
        success: true,
        skippedGames: [
          { gameId: 2026010007, reason: "preseason_without_roster_spots" },
        ],
      },
    },
    {
      gameId: 2026020007,
      gameType: 2,
      statusCode: 500,
      body: {
        success: false,
        message: "Invalid relationship roster scope for game 2026020007",
      },
    },
  ])(
    "handles an empty roster scope for game type $gameType",
    async ({ gameId, gameType, statusCode, body }) => {
      const hash = "b".repeat(64);
      const defaultFrom = serviceFromMock.getMockImplementation()!;
      serviceFromMock.mockImplementation((table: string) =>
        table === "projection_game_materialization_status"
          ? {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      game_id: gameId,
                      input_status: "complete",
                      pbp_raw_payload_hash: hash,
                    },
                    error: null,
                  }),
                }),
              }),
            }
          : defaultFrom(table),
      );
      vi.mocked(fetchPbpGame).mockResolvedValue({
        id: gameId,
        season: 20262027,
        gameType,
        gameDate: "2026-09-21",
        homeTeam: { id: 23, abbrev: "VAN" },
        awayTeam: { id: 22, abbrev: "EDM" },
      } as any);
      vi.mocked(isCompleteFinalPbpPayload).mockReturnValue(true);
      vi.mocked(fetchAllNhleShiftChartsForGame).mockResolvedValue([
        { gameId, playerId: 8480012, teamId: 23, typeCode: 517 } as any,
      ]);
      const req = {
        method: "POST",
        query: { gameId: String(gameId) },
        url: `/api/v1/db/shift-charts?gameId=${gameId}`,
      } as any;
      const res = createMockRes();

      await directShiftChartsHandler(req, res);

      expect(res.statusCode).toBe(statusCode);
      expect(res.body).toEqual(expect.objectContaining(body));
      expect(persistShiftChartRelationships).not.toHaveBeenCalled();
    },
  );

  describe("per-game skip isolation", () => {
    const hash = "c".repeat(64);
    let statusGameId = 0;

    function arrangeQueue(args: {
      queue: number[];
      emptyFeeds?: number[];
      persistErrors?: Record<number, string>;
    }) {
      selectPendingRelationshipGameIdsMock.mockReturnValue(args.queue);
      const defaultFrom = serviceFromMock.getMockImplementation()!;
      serviceFromMock.mockImplementation((table: string) => {
        if (table === "games") return { select: vi.fn() };
        if (table === "projection_game_materialization_status") {
          return {
            select: () => ({
              eq: (_column: string, gameId: number) => ({
                maybeSingle: async () => {
                  statusGameId = gameId;
                  return {
                    data: {
                      game_id: gameId,
                      input_status: "complete",
                      pbp_raw_payload_hash: hash,
                    },
                    error: null,
                  };
                },
              }),
            }),
          };
        }
        return defaultFrom(table);
      });
      fetchAllSupabasePagesMock.mockImplementation(async () =>
        statusGameId === 0
          ? []
          : [
              {
                game_id: statusGameId,
                player_id: 8480012,
                team_id: 23,
                position_code: "C",
                source_play_by_play_hash: hash,
              },
            ],
      );
      vi.mocked(fetchAllNhleShiftChartsForGame).mockImplementation(
        async (gameId: number) =>
          args.emptyFeeds?.includes(gameId)
            ? []
            : ([
                {
                  gameId,
                  playerId: 8480012,
                  teamId: 23,
                  firstName: "Test",
                  lastName: "Center",
                  shiftNumber: 1,
                  period: 1,
                  startTime: "00:00",
                  endTime: "00:45",
                  duration: "00:45",
                  typeCode: 517,
                },
              ] as any),
      );
      vi.mocked(fetchPbpGame).mockImplementation(
        async (gameId: number) =>
          ({
            id: gameId,
            season: 20252026,
            gameType: 2,
            gameDate: "2026-10-01",
            homeTeam: { id: 23, abbrev: "VAN" },
            awayTeam: { id: 22, abbrev: "EDM" },
          }) as any,
      );
      vi.mocked(isCompleteFinalPbpPayload).mockReturnValue(true);
      vi.mocked(buildShiftRelationshipStrengthSegments).mockImplementation(
        (_gameId, _pbp, rows) =>
          rows.map((row) => ({
            playerId: row.playerId,
            shiftNumber: row.shiftNumber,
            period: row.period,
            startTime: row.startTime,
            endTime: row.endTime,
            duration: row.duration ?? "00:00",
            strength: "es" as const,
          })),
      );
      vi.mocked(formatCompletedPbpGameLength).mockReturnValue("60:00");
      vi.mocked(buildShiftChartRelationshipUpsert).mockImplementation(
        (row: any) => row,
      );
      vi.mocked(persistShiftChartRelationships).mockImplementation(
        async ({ gameId }: any) => {
          const message = args.persistErrors?.[gameId];
          if (message) throw new Error(message);
          return { relationshipRows: 1, idempotent: false, prunedRows: 0 } as any;
        },
      );
    }

    async function run(maxGames: number) {
      const req = {
        method: "POST",
        query: { maxGames: String(maxGames) },
        url: `/api/v1/db/shift-charts?maxGames=${maxGames}`,
      } as any;
      const res = createMockRes();
      await directShiftChartsHandler(req, res);
      return res;
    }

    beforeEach(() => {
      statusGameId = 0;
    });

    it("skips empty feeds and stale fingerprints without counting them against maxGames", async () => {
      arrangeQueue({
        queue: [2026020006, 2026020007, 2026020002, 2026020003, 2026020054, 2026020055, 2026020056],
        emptyFeeds: [2026020006, 2026020007],
        persistErrors: {
          2026020002:
            "Shift source fingerprint does not match projection inputs for game 2026020002",
          2026020003:
            "PBP source fingerprint does not match projection inputs for game 2026020003",
        },
      });

      const res = await run(2);

      expect(selectPendingRelationshipGameIdsMock).toHaveBeenCalledWith(
        expect.objectContaining({ maxGames: 2 + 64 }),
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          gamesProcessed: 2,
          rowsAffected: 2,
          skipBudgetReached: false,
          failedGame: null,
          skippedGames: [
            { gameId: 2026020006, reason: "shift_feed_unavailable" },
            { gameId: 2026020007, reason: "shift_feed_unavailable" },
            { gameId: 2026020002, reason: "projection_inputs_stale" },
            { gameId: 2026020003, reason: "projection_inputs_stale" },
          ],
        }),
      );
      // PBP is read first: an empty JSON feed needs it for the HTML fallback.
      expect(vi.mocked(fetchPbpGame).mock.calls.map(([id]) => id)).toEqual([
        2026020006, 2026020007, 2026020002, 2026020003, 2026020054, 2026020055,
      ]);
      expect(
        vi.mocked(persistShiftChartRelationships).mock.calls.map(
          ([args]: any[]) => args.gameId,
        ),
      ).toEqual([2026020002, 2026020003, 2026020054, 2026020055]);
      expect(fetchAllNhleShiftChartsForGame).not.toHaveBeenCalledWith(2026020056);
      expect(auditInsertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          status: "success",
          details: expect.objectContaining({
            context: expect.objectContaining({
              skippedGames: expect.arrayContaining([
                { gameId: 2026020002, reason: "projection_inputs_stale" },
              ]),
            }),
          }),
        }),
      ]);
    });

    it("skips a game whose raw snapshot head moved after ingest and continues", async () => {
      arrangeQueue({
        queue: [2026020006, 2026020054],
        persistErrors: { 2026020006: "SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE" },
      });

      const res = await run(16);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          gamesProcessed: 1,
          processedGames: [{ gameId: 2026020054, shiftSource: "json-api" }],
          skippedGames: [
            { gameId: 2026020006, reason: "projection_raw_snapshot_stale" },
          ],
        }),
      );
    });

    it("keeps other relationship guards fail-closed and reports the failed game", async () => {
      arrangeQueue({
        queue: [2026020006, 2026020054, 2026020055],
        emptyFeeds: [2026020006],
        persistErrors: {
          2026020054:
            "Raw PBP snapshot does not match relationship roster for game 2026020054",
        },
      });

      const res = await run(16);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: false,
          gamesProcessed: 0,
          skippedGames: [{ gameId: 2026020006, reason: "shift_feed_unavailable" }],
          failedGame: {
            gameId: 2026020054,
            message:
              "Raw PBP snapshot does not match relationship roster for game 2026020054",
          },
        }),
      );
      expect(fetchAllNhleShiftChartsForGame).not.toHaveBeenCalledWith(2026020055);
      expect(auditInsertMock).toHaveBeenCalledWith([
        expect.objectContaining({ status: "error" }),
      ]);
    });

    it("records the HTML report source and the reason an empty feed was skipped", async () => {
      arrangeQueue({ queue: [2026020010, 2026020011] });
      const delegate = vi
        .mocked(readStoredProjectionShiftSnapshot)
        .getMockImplementation()!;
      vi.mocked(readStoredProjectionShiftSnapshot)
        .mockImplementationOnce(async (gameId: number) => {
          const snapshot = await delegate(gameId);
          return { ...snapshot, source: "htmlreports" } as any;
        })
        .mockImplementationOnce(async () => ({
          rows: [],
          rawPayload: { total: 0, data: [], source: "json-api" },
          source: "json-api",
          htmlFallbackError:
            "HTML shift reports are unavailable for game 2026020011",
        }));

      const res = await run(16);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          processedGames: [{ gameId: 2026020010, shiftSource: "htmlreports" }],
          skippedGames: [
            {
              gameId: 2026020011,
              reason: "shift_feed_unavailable",
              detail: "HTML shift reports are unavailable for game 2026020011",
            },
          ],
        }),
      );
      expect(readStoredProjectionShiftSnapshot).toHaveBeenCalledWith(2026020010);
    });

    it("stops at the skip budget so a run of empty feeds stays bounded", async () => {
      const queue = Array.from({ length: 80 }, (_, index) => 2026020006 + index);
      arrangeQueue({ queue, emptyFeeds: queue });

      const res = await run(16);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          gamesProcessed: 0,
          skipBudgetReached: true,
        }),
      );
      expect((res.body as any).skippedGames).toHaveLength(64);
      expect(fetchAllNhleShiftChartsForGame).toHaveBeenCalledTimes(64);
      expect(fetchPbpGame).toHaveBeenCalledTimes(64);
    });
  });

  it("lets the compatibility adapter own exactly one success audit row", async () => {
    const req = {
      method: "GET",
      query: {},
      url: "/api/v1/db/update-shifts?action=all",
    } as any;
    const res = createMockRes();

    await updateShiftsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        rowsAffected: 0,
        rowsVerified: 0,
        rowsPruned: 0,
      }),
    );
    expect(auditInsertMock).toHaveBeenCalledOnce();
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        job_name: "update-shift-charts",
        status: "success",
        rows_affected: 0,
        details: expect.objectContaining({
          method: "POST",
          url: "/api/v1/db/update-shifts?action=all",
          statusCode: 200,
          failedRows: null,
        }),
      }),
    );
  });

  it("lets the compatibility adapter own exactly one truthful failure audit row", async () => {
    const req = {
      method: "GET",
      query: { gameId: "invalid" },
      url: "/api/v1/db/update-shifts?action=all&gameId=invalid",
    } as any;
    const res = createMockRes();

    await updateShiftsHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: "Invalid gameId.",
      success: false,
    });
    expect(auditInsertMock).toHaveBeenCalledOnce();
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        job_name: "update-shift-charts",
        status: "failure",
        rows_affected: null,
        details: expect.objectContaining({
          method: "POST",
          url: "/api/v1/db/update-shifts?action=all&gameId=invalid",
          statusCode: 400,
          failedRows: null,
        }),
      }),
    );
  });
});

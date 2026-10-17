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
vi.mock("lib/projections/ingest/shifts", () => ({
  buildShiftRelationshipStrengthSegments: vi.fn(),
  fetchAllNhleShiftChartsForGame: vi.fn(),
}));
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

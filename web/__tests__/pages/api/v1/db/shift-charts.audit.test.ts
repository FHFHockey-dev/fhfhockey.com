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

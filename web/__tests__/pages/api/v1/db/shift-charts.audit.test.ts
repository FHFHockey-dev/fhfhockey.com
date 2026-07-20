import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditInsertMock, serviceFromMock } = vi.hoisted(() => ({
  auditInsertMock: vi.fn(),
  serviceFromMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: serviceFromMock,
  },
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("lib/NHL/server", () => ({ getCurrentSeason: vi.fn() }));
vi.mock("lib/supabase/pagination", () => ({
  fetchAllSupabasePages: vi.fn(),
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
  selectPendingRelationshipGameIds: vi.fn(),
}));
vi.mock("lib/projections/gameLength", () => ({
  formatCompletedPbpGameLength: vi.fn(),
  normalizeNhlGameType: vi.fn(),
}));

import handler from "../../../../../pages/api/v1/db/shift-charts";

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
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "cron_job_audit") {
        return { insert: auditInsertMock };
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

      await handler(req, res);

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
});

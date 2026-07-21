import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  buildShiftRelationshipStrengthSegments: vi.fn(),
  fetchAllNhleShiftChartsForGame: vi.fn(),
  fetchPbpGame: vi.fn(),
  from: vi.fn(),
  getCurrentSeason: vi.fn(),
  isCompleteFinalPbpPayload: vi.fn(),
  persistShiftChartRelationships: vi.fn(),
  selectPendingRelationshipGameIds: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: mocks.from,
  },
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: mocks.getCurrentSeason,
}));

vi.mock("lib/projections/shiftChartRelationshipPayload", () => ({
  buildShiftChartRelationshipUpsert: vi.fn(),
}));

vi.mock("lib/projections/ingest/shifts", () => ({
  buildShiftRelationshipStrengthSegments:
    mocks.buildShiftRelationshipStrengthSegments,
  fetchAllNhleShiftChartsForGame: mocks.fetchAllNhleShiftChartsForGame,
}));

vi.mock("lib/projections/ingest/projectionInputPersistence", () => ({
  buildProjectionPbpSourceHash: vi.fn(),
  buildProjectionShiftSourceHash: vi.fn(),
}));

vi.mock("lib/projections/ingest/pbp", () => ({
  fetchPbpGame: mocks.fetchPbpGame,
  isCompleteFinalPbpPayload: mocks.isCompleteFinalPbpPayload,
}));

vi.mock(
  "lib/projections/relationshipMaterialization",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("lib/projections/relationshipMaterialization")
      >();
    mocks.selectPendingRelationshipGameIds.mockImplementation(
      actual.selectPendingRelationshipGameIds,
    );
    return {
      ...actual,
      persistShiftChartRelationships: mocks.persistShiftChartRelationships,
      selectPendingRelationshipGameIds: mocks.selectPendingRelationshipGameIds,
    };
  },
);

vi.mock("lib/projections/gameLength", () => ({
  formatCompletedPbpGameLength: vi.fn(),
  normalizeNhlGameType: vi.fn(),
}));

import handler from "../../../../../pages/api/v1/db/shift-charts";

const LATEST_STARTED_SEASON_ID = 20252026;
const GAME_ID = 2025020001;
const INPUT_FINGERPRINT = "1".repeat(64);

type QueryBuilder = {
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

function createPagedQuery(rows: readonly unknown[]): QueryBuilder {
  const query = {} as QueryBuilder;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.range = vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, to + 1),
    error: null,
  }));
  return query;
}

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

describe("shift-chart scheduled relationship queue", () => {
  let games: unknown[];
  let statuses: unknown[];
  let gamesQuery: QueryBuilder;
  let statusesQuery: QueryBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    games = [];
    statuses = [];
    gamesQuery = createPagedQuery(games);
    statusesQuery = createPagedQuery(statuses);

    mocks.getCurrentSeason.mockResolvedValue({
      seasonId: LATEST_STARTED_SEASON_ID,
      regularSeasonStartDate: "2025-10-07",
      regularSeasonEndDate: "2026-04-16",
      seasonEndDate: "2026-06-25",
    });
    mocks.auditInsert.mockResolvedValue({ error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "yahoo_positions") return createPagedQuery([]);
      if (table === "games") return gamesQuery;
      if (table === "projection_game_materialization_status") {
        return statusesQuery;
      }
      if (table === "cron_job_audit") {
        return { insert: mocks.auditInsert };
      }
      throw new Error(`Unexpected service-role table: ${table}`);
    });
  });

  it("uses the authoritative latest-started season for an implicit offseason run", async () => {
    const req = {
      method: "POST",
      query: {},
      url: "/api/v1/db/shift-charts",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        targetGameId: null,
      }),
    );
    expect(mocks.getCurrentSeason).toHaveBeenCalledOnce();
    expect(gamesQuery.eq).toHaveBeenCalledWith(
      "seasonId",
      LATEST_STARTED_SEASON_ID,
    );
    expect(statusesQuery.eq).toHaveBeenCalledWith("input_status", "complete");
    expect(mocks.selectPendingRelationshipGameIds).toHaveBeenCalledWith({
      games: [],
      statuses: [],
      maxGames: 16,
    });
    expect(mocks.fetchPbpGame).not.toHaveBeenCalled();
  });

  it("queues a completed relationship produced by an older algorithm through the shared route path", async () => {
    games.push({ id: GAME_ID, date: "2025-10-07" });
    statuses.push({
      game_id: GAME_ID,
      input_status: "complete",
      input_fingerprint: INPUT_FINGERPRINT,
      relationship_status: "complete",
      relationship_input_fingerprint: INPUT_FINGERPRINT,
      relationship_algorithm_version: "shift_relationship_materializer_v2",
    });
    mocks.fetchPbpGame.mockResolvedValue({
      id: GAME_ID,
      season: LATEST_STARTED_SEASON_ID,
    });
    mocks.isCompleteFinalPbpPayload.mockReturnValue(false);

    const req = {
      method: "POST",
      query: { maxGames: "1" },
      url: "/api/v1/db/shift-charts?maxGames=1",
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(mocks.selectPendingRelationshipGameIds).toHaveBeenCalledWith({
      games: [{ id: GAME_ID, date: "2025-10-07" }],
      statuses: [
        expect.objectContaining({
          game_id: GAME_ID,
          relationship_status: "complete",
          relationship_algorithm_version: "shift_relationship_materializer_v2",
        }),
      ],
      maxGames: 1,
    });
    expect(
      mocks.selectPendingRelationshipGameIds.mock.results[0]?.value,
    ).toEqual([GAME_ID]);
    expect(mocks.fetchPbpGame).toHaveBeenCalledOnce();
    expect(mocks.fetchPbpGame).toHaveBeenCalledWith(GAME_ID);
    expect(mocks.fetchAllNhleShiftChartsForGame).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: `PBP is not final and complete for game ${GAME_ID}`,
        success: false,
      }),
    );
  });
});

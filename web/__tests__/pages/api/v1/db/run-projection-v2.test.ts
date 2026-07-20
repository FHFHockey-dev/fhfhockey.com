import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditInsertMock, gamesEqMock, gamesSelectMock } = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  gamesEqMock: vi.fn(),
  gamesSelectMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock,
    })),
  },
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      if (table === "games") {
        gamesEqMock.mockResolvedValue({
          data: null,
          error: {
            message:
              "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title></html>",
          },
        });
        gamesSelectMock.mockReturnValue({
          eq: gamesEqMock,
        });
        return {
          select: gamesSelectMock,
        };
      }

      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
    }),
  },
}));

vi.mock("lib/projections/run-forge-projections", () => ({
  runProjectionV2ForDate: vi.fn(),
}));

import handler, {
  buildProjectionDerivedGate,
  buildProjectionInputIngestGate,
  parseProjectionGameIds,
  summarizeSkaterFreshnessCoverage,
  summarizeGoalieRosterAssignments,
} from "../../../../../pages/api/v1/db/run-projection-v2";

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

describe("/api/v1/db/run-projection-v2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes a bounded single-date game batch without duplicate ids", () => {
    expect(
      parseProjectionGameIds("2025020101, 2025020102,2025020101,bad,-1"),
    ).toEqual([2025020101, 2025020102]);
  });

  it("normalizes html upstream dependency failures into structured payloads", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error:
        "Upstream dependency returned an HTML error page instead of structured JSON.",
      dependencyContract: {
        version: "rolling-forge-operator-order-v2",
        currentStage: {
          id: "projection_execution",
          order: 8,
        },
        prerequisiteStages: [
          expect.objectContaining({
            id: "rolling_player_recompute",
            order: 4,
          }),
          expect.objectContaining({
            id: "projection_derived_build",
            order: 7,
          }),
        ],
      },
      compatibilityInventory: {
        version: "forge-compatibility-inventory-v2",
        removedShim: {
          legacyModulePath: "web/lib/projections/runProjectionV2.ts",
          canonicalModulePath: "web/lib/projections/run-forge-projections.ts",
          status: "removed",
        },
        duplicateReaders: expect.arrayContaining([
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/players",
            legacyRoute: "/api/v1/projections/players",
          }),
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/goalies",
            legacyRoute: "/api/v1/projections/goalies",
          }),
        ]),
      },
      dependencyError: {
        kind: "dependency_error",
        classification: "html_upstream_response",
        source: "supabase_or_proxy",
        htmlLike: true,
      },
      observability: {
        dataQualityWarnings: [
          expect.objectContaining({
            code: "dependency_error",
            message:
              "Upstream dependency returned an HTML error page instead of structured JSON.",
          }),
        ],
      },
      scanSummary: {
        surface: "projection_run_operator",
        requestedDate: "2026-03-20",
        activeDataDate: "2026-03-20",
        fallbackApplied: false,
        status: "blocked",
        rowCounts: {
          gamesProcessed: 0,
          playerRowsUpserted: 0,
          teamRowsUpserted: 0,
          goalieRowsUpserted: 0,
        },
        blockingIssueCount: 1,
      },
    });
  });

  it("uses season rosters instead of current players.team_id to evaluate goalie assignment drift", () => {
    const result = summarizeGoalieRosterAssignments({
      latestGoaliesByTeam: new Map([
        [6, [101, 202]],
        [7, [101]],
      ]),
      goaliePlayers: [
        { id: 101, position: "G" },
        { id: 202, position: "G" },
      ],
      goalieRosters: [
        { playerId: 101, teamId: 6 },
        { playerId: 101, teamId: 7 },
        { playerId: 202, teamId: 8 },
      ],
    });

    expect(result).toEqual({
      goalieCandidatesChecked: 2,
      mismatchedAssignments: 1,
      nonGoaliePositionRows: 0,
    });
  });

  it("fails when even one actual PBP game lacks complete shift coverage", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 5,
        invalidShiftGames: 0,
        shiftRows: 191,
      }),
    ).toMatchObject({
      status: "FAIL",
      detail:
        "scheduled_recent_games=10, actual_pbp_games=6, shifted_actual_games=5, invalid_shift_games=0, shift_coverage=0.83, shift_rows=191",
    });
  });

  it("passes only when every actual PBP game has complete shift coverage", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 6,
        invalidShiftGames: 0,
        shiftRows: 220,
      }),
    ).toMatchObject({
      status: "PASS",
      detail:
        "scheduled_recent_games=10, actual_pbp_games=6, shifted_actual_games=6, invalid_shift_games=0, shift_coverage=1.00, shift_rows=220",
    });
  });

  it("fails projection ingest coverage when actual PBP games lack shift coverage", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 3,
        invalidShiftGames: 0,
        shiftRows: 120,
      }),
    ).toMatchObject({
      status: "FAIL",
      action:
        "Run /api/v1/db/ingest-projection-inputs for recent actual game dates.",
    });
  });

  it("fails closed when scheduled recent games have no terminal PBP evidence", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 8,
        actualPbpGames: 0,
        shiftedActualGames: 0,
        invalidShiftGames: 0,
        shiftRows: 0,
      }),
    ).toMatchObject({
      status: "FAIL",
      action: expect.stringContaining("complete terminal PBP evidence"),
    });
  });

  it("fails projection ingest coverage when any persisted shift game is invalid", () => {
    expect(
      buildProjectionInputIngestGate({
        scheduledRecentGames: 10,
        actualPbpGames: 6,
        shiftedActualGames: 6,
        invalidShiftGames: 1,
        shiftRows: 220,
      }),
    ).toMatchObject({ status: "FAIL" });
  });

  it("treats projection-derived freshness as not applicable on a zero-game slate", () => {
    expect(
      buildProjectionDerivedGate({
        scheduledGameCount: 0,
        playerLatest: null,
        teamLatest: null,
        goalieLatest: null,
      }),
    ).toEqual({
      gate_key: "projection_derived_v2",
      status: "PASS",
      detail:
        "No scheduled games on requested date; projection-derived freshness is not applicable.",
      action: "None.",
    });
  });

  it("retains the projection-derived blocker when a scheduled slate lacks inputs", () => {
    expect(
      buildProjectionDerivedGate({
        scheduledGameCount: 1,
        playerLatest: null,
        teamLatest: "2026-03-19",
        goalieLatest: "2026-03-19",
      }),
    ).toMatchObject({
      gate_key: "projection_derived_v2",
      status: "FAIL",
      detail:
        "player_latest=none, team_latest=2026-03-19, goalie_latest=2026-03-19",
    });
  });

  it("separates missing, stale, thin-role, and derived skater freshness failures", () => {
    const result = summarizeSkaterFreshnessCoverage({
      asOfDate: "2026-03-30",
      scheduledTeamIds: [1, 2, 3],
      recentLineCombosByTeam: new Map([
        [
          1,
          [
            {
              gameId: 101,
              forwards: Array.from({ length: 12 }, (_, index) => index + 1),
              defensemen: Array.from({ length: 6 }, (_, index) => index + 20),
              games: { date: "2026-03-29" },
            },
          ],
        ],
        [
          2,
          [
            {
              gameId: 102,
              forwards: [31, 32, 33, 34, 35, 36],
              defensemen: [41, 42],
              games: { date: "2026-03-01" },
            },
          ],
        ],
      ]),
      teamsWithRecentDerivedRows: new Set([1, 2]),
    });

    expect(result).toEqual({
      missingLineComboTeams: 1,
      softStaleLineComboTeams: 0,
      hardStaleLineComboTeams: 1,
      insufficientRoleCoverageTeams: 2,
      missingRecentDerivedTeams: 1,
    });
  });
});

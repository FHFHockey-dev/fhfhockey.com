import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditInsertMock, gamesEqMock, gamesSelectMock } = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  gamesEqMock: vi.fn(),
  gamesSelectMock: vi.fn()
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      if (table === "games") {
        gamesEqMock.mockResolvedValue({
          data: null,
          error: {
            message:
              "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title></html>"
          }
        });
        gamesSelectMock.mockReturnValue({
          eq: gamesEqMock
        });
        return {
          select: gamesSelectMock
        };
      }

      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          lt: vi.fn().mockResolvedValue({ data: [], error: null })
        }))
      };
    })
  }
}));

vi.mock("lib/projections/run-forge-projections", () => ({
  runProjectionV2ForDate: vi.fn()
}));

import handler, {
  summarizeGoalieRosterAssignments
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
    }
  };
  return res;
}

describe("/api/v1/db/run-projection-v2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes html upstream dependency failures into structured payloads", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error:
        "Upstream dependency returned an HTML error page instead of structured JSON.",
      dependencyContract: {
        version: "rolling-forge-operator-order-v1",
        currentStage: {
          id: "projection_execution",
          order: 7
        },
        prerequisiteStages: [
          expect.objectContaining({
            id: "rolling_player_recompute",
            order: 4
          }),
          expect.objectContaining({
            id: "projection_derived_build",
            order: 6
          })
        ]
      },
      compatibilityInventory: {
        version: "forge-compatibility-inventory-v2",
        removedShim: {
          legacyModulePath: "web/lib/projections/runProjectionV2.ts",
          canonicalModulePath: "web/lib/projections/run-forge-projections.ts",
          status: "removed"
        },
        duplicateReaders: expect.arrayContaining([
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/players",
            legacyRoute: "/api/v1/projections/players"
          }),
          expect.objectContaining({
            canonicalRoute: "/api/v1/forge/goalies",
            legacyRoute: "/api/v1/projections/goalies"
          })
        ])
      },
      dependencyError: {
        kind: "dependency_error",
        classification: "html_upstream_response",
        source: "supabase_or_proxy",
        htmlLike: true
      },
      observability: {
        dataQualityWarnings: [
          expect.objectContaining({
            code: "dependency_error",
            message:
              "Upstream dependency returned an HTML error page instead of structured JSON."
          })
        ]
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
          goalieRowsUpserted: 0
        },
        blockingIssueCount: 1
      }
    });
  });

  it("uses season rosters instead of current players.team_id to evaluate goalie assignment drift", () => {
    const result = summarizeGoalieRosterAssignments({
      latestGoaliesByTeam: new Map([
        [6, [101, 202]],
        [7, [101]]
      ]),
      goaliePlayers: [
        { id: 101, position: "G" },
        { id: 202, position: "G" }
      ],
      goalieRosters: [
        { playerId: 101, teamId: 6 },
        { playerId: 101, teamId: 7 },
        { playerId: 202, teamId: 8 }
      ]
    });

    expect(result).toEqual({
      goalieCandidatesChecked: 2,
      mismatchedAssignments: 1,
      nonGoaliePositionRows: 0
    });
  });
});

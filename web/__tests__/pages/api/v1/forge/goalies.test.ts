import { describe, expect, it, vi, beforeEach } from "vitest";
const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

vi.mock("pages/api/v1/projections/_helpers", async () => {
  const actual = await vi.importActual<any>("pages/api/v1/projections/_helpers");
  return {
    ...actual,
    requireLatestSucceededRunId: vi.fn(async () => "run-123")
  };
});

type QueryResult = {
  data?: any;
  count?: number;
  error: null;
};

function createQueryBuilder(resolver: () => QueryResult) {
  const state = {
    isHeadCount: false
  };
  const builder: any = {
    select(_columns: string, options?: { head?: boolean }) {
      state.isHeadCount = Boolean(options?.head);
      return builder;
    },
    eq() {
      return builder;
    },
    lte() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      const out = resolver();
      const data = Array.isArray(out.data) ? (out.data[0] ?? null) : out.data ?? null;
      return Promise.resolve({ data, error: out.error });
    },
    then(resolve: (value: any) => any) {
      const out = resolver();
      if (state.isHeadCount) {
        return Promise.resolve(resolve({ count: out.count ?? 0, error: out.error }));
      }
      return Promise.resolve(resolve({ data: out.data ?? [], error: out.error }));
    }
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import handler from "../../../../../pages/api/v1/forge/goalies";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("/api/v1/forge/goalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              goalie_id: 8474593,
              team_id: 1,
              opponent_team_id: 2,
              players: { fullName: "Jacob Markstrom" },
              teams: { name: "Devils", abbreviation: "NJD" },
              opponent: { name: "Islanders", abbreviation: "NYI" },
              starter_probability: 0.61,
              proj_shots_against: 27.2,
              proj_saves: 24.1,
              proj_goals_allowed: 3.1,
              proj_win_prob: 0.53,
              proj_shutout_prob: 0.05,
              uncertainty: {
                model: {
                  save_pct: 0.892,
                  volatility_index: 1.18,
                  blowup_risk: 0.22,
                  confidence_tier: "MEDIUM",
                  quality_tier: "ABOVE_AVERAGE",
                  reliability_tier: "MODERATE",
                  recommendation: "START",
                  scenario_metadata: {
                    model_version: "starter-scenario-v1",
                    top2_scenario_count: 2
                  },
                  starter_selection: {
                    scenario_projection_count: 2
                  }
                }
              }
            }
          ],
          error: null
        }));
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: {
            run_id: "run-123",
            as_of_date: "2026-02-07",
            status: "succeeded",
            created_at: "2026-02-07T10:05:00.000Z",
            metrics: {
              goalie_rows: 32
            }
          },
          error: null
        }));
      }
      if (table === "games") {
        return createQueryBuilder(() => ({
          count: 8,
          error: null
        }));
      }
      if (table === "forge_projection_calibration_daily") {
        return createQueryBuilder(() => ({
          data: {
            date: "2026-02-06",
            projection_date: "2026-02-07",
            metrics: {
              probability: {
                starter_probability: { brier_score: 0.19 },
                win_probability: { brier_score: 0.21 },
                shutout_probability: { brier_score: 0.07 }
              },
              intervals: {
                saves: { p10_p90_hit_rate: 0.79 },
                goals_allowed: { p10_p90_hit_rate: 0.75 }
              },
              stats: {
                saves: { rolling_30d: { player_count: 142, mae: 3.88 } },
                goals_against: { rolling_30d: { mae: 1.22 } }
              }
            }
          },
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
  });

  it("returns stable response shape with model/scenario/calibration metadata", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        horizon: "1"
      }
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-123",
      asOfDate: "2026-02-07",
      requestedDate: "2026-02-07",
      fallbackApplied: false,
      scanSummary: {
        surface: "forge_goalies_reader",
        requestedDate: "2026-02-07",
        activeDataDate: "2026-02-07",
        fallbackApplied: false,
        status: "ready",
        rowCounts: {
          returned: 1,
          requested: 1,
          scheduledGamesOnDate: 8
        },
        blockingIssueCount: 0
      },
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalRoute: "/api/v1/forge/goalies",
        legacyRoute: "/api/v1/projections/goalies",
        status: "canonical_preferred",
        goalieStartTable: {
          decisionVersion: "goalie-start-ownership-v1",
          table: "goalie_start_projections",
          decision: "retain_shared_table_name_for_now",
          canonicalWriterRoute: "/api/v1/db/update-goalie-projections-v2",
          canonicalWriterStatus: "single_writer",
          renameDeferred: true
        }
      },
      serving: {
        requestedDate: "2026-02-07",
        resolvedDate: "2026-02-07",
        fallbackApplied: false,
        isSameDay: true,
        state: "same_day",
        strategy: "requested_date"
      },
      modelVersion: "starter-scenario-v1",
      scenarioCount: 2,
      calibrationHints: {
        starterBrier: 0.19,
        winBrier: 0.21,
        shutoutBrier: 0.07
      },
      diagnostics: {
        requested: expect.any(Object),
        resolved: expect.any(Object),
        fallback: expect.any(Object),
        emptyResultAnalysis: expect.any(Object),
        notes: expect.any(Array)
      }
    });
    expect(res.body.data[0]).toMatchObject({
      goalie_id: 8474593,
      goalie_name: "Jacob Markstrom",
      starter_probability: 0.61
    });

    expect(res.body).toMatchSnapshot();
  });

  it("normalizes opposing likely-starter win probabilities to sum to 100% per matchup", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              goalie_id: 1001,
              team_id: 1,
              opponent_team_id: 2,
              players: { fullName: "Goalie A" },
              teams: { name: "Team A", abbreviation: "TMA" },
              opponent: { name: "Team B", abbreviation: "TMB" },
              starter_probability: 0.62,
              proj_shots_against: 28.1,
              proj_saves: 25.2,
              proj_goals_allowed: 2.9,
              proj_win_prob: 0.384,
              proj_shutout_prob: 0.04,
              uncertainty: {}
            },
            {
              goalie_id: 1002,
              team_id: 2,
              opponent_team_id: 1,
              players: { fullName: "Goalie B" },
              teams: { name: "Team B", abbreviation: "TMB" },
              opponent: { name: "Team A", abbreviation: "TMA" },
              starter_probability: 0.58,
              proj_shots_against: 29.4,
              proj_saves: 26.1,
              proj_goals_allowed: 3.3,
              proj_win_prob: 0.419,
              proj_shutout_prob: 0.03,
              uncertainty: {}
            }
          ],
          error: null
        }));
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: {
            run_id: "run-123",
            as_of_date: "2026-02-07",
            status: "succeeded",
            created_at: "2026-02-07T10:05:00.000Z",
            metrics: { goalie_rows: 2 }
          },
          error: null
        }));
      }
      if (table === "games") {
        return createQueryBuilder(() => ({ count: 1, error: null }));
      }
      if (table === "forge_projection_calibration_daily") {
        return createQueryBuilder(() => ({ data: null, error: null }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        horizon: "1"
      }
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const sum = res.body.data.reduce(
      (acc: number, row: any) => acc + Number(row.proj_win_prob ?? 0),
      0
    );
    expect(sum).toBeCloseTo(1, 4);
    expect(res.body.diagnostics.notes.join(" ")).toContain(
      "Normalized likely-starter win probabilities"
    );
  });

  it("falls back to the latest prior date with goalie rows when requested date has no data", async () => {
    let projectionQueryCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") {
        projectionQueryCount += 1;
        if (projectionQueryCount === 1) {
          return createQueryBuilder(() => ({ data: [], error: null }));
        }
        if (projectionQueryCount === 2) {
          return createQueryBuilder(() => ({
            data: { run_id: "run-122", as_of_date: "2026-02-06" },
            error: null
          }));
        }
        return createQueryBuilder(() => ({
          data: [
            {
              goalie_id: 5555,
              team_id: 3,
              opponent_team_id: 4,
              players: { fullName: "Fallback Goalie" },
              teams: { name: "Team C", abbreviation: "TMC" },
              opponent: { name: "Team D", abbreviation: "TMD" },
              starter_probability: 0.64,
              proj_shots_against: 26.8,
              proj_saves: 24.4,
              proj_goals_allowed: 2.4,
              proj_win_prob: 0.57,
              proj_shutout_prob: 0.08,
              uncertainty: {}
            }
          ],
          error: null
        }));
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: {
            run_id: "run-123",
            as_of_date: "2026-02-07",
            status: "succeeded",
            created_at: "2026-02-07T10:05:00.000Z",
            metrics: { goalie_rows: 0 }
          },
          error: null
        }));
      }
      if (table === "games") {
        return createQueryBuilder(() => ({ count: 6, error: null }));
      }
      if (table === "forge_projection_calibration_daily") {
        return createQueryBuilder(() => ({ data: null, error: null }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        horizon: "1"
      }
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.fallbackApplied).toBe(true);
    expect(res.body.runId).toBe("run-122");
    expect(res.body.asOfDate).toBe("2026-02-06");
    expect(res.body.serving).toMatchObject({
      requestedDate: "2026-02-07",
      resolvedDate: "2026-02-06",
      fallbackApplied: true,
      isSameDay: false,
      state: "fallback",
      strategy: "latest_available_with_data"
    });
    expect(res.body.scanSummary).toMatchObject({
      surface: "forge_goalies_reader",
      requestedDate: "2026-02-07",
      activeDataDate: "2026-02-06",
      fallbackApplied: true,
      status: "ready",
      rowCounts: {
        returned: 1,
        requested: 0,
        scheduledGamesOnDate: 6
      },
      blockingIssueCount: 0
    });
    expect(res.body.compatibilityInventory).toMatchObject({
      inventoryVersion: "forge-compatibility-inventory-v2",
      canonicalRoute: "/api/v1/forge/goalies",
      legacyRoute: "/api/v1/projections/goalies",
      status: "canonical_preferred",
      goalieStartTable: {
        decisionVersion: "goalie-start-ownership-v1",
        table: "goalie_start_projections",
        decision: "retain_shared_table_name_for_now",
        canonicalWriterRoute: "/api/v1/db/update-goalie-projections-v2",
        canonicalWriterStatus: "single_writer",
        renameDeferred: true
      }
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      goalie_id: 5555,
      goalie_name: "Fallback Goalie"
    });
    expect(res.body.diagnostics.fallback).toMatchObject({
      enabled: true,
      applied: true,
      candidateRunId: "run-122",
      candidateAsOfDate: "2026-02-06",
      candidateRowCount: 1
    });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "lib/projections/calibrationEligibility";
import { requireLatestSucceededRunId } from "lib/projections/apiHelpers";
const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

vi.mock("lib/projections/apiHelpers", async () => {
  const actual = await vi.importActual<any>("lib/projections/apiHelpers");
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

function createQueryBuilder(resolver: () => QueryResult, onEq?: (column: string, value: unknown) => void,
  onNot?: (column: string, operator: string, value: unknown) => void) {
  const state = {
    isHeadCount: false
  };
  const builder: any = {
    select(_columns: string, options?: { head?: boolean }) {
      state.isHeadCount = Boolean(options?.head);
      return builder;
    },
    eq(column: string, value: unknown) {
      onEq?.(column, value);
      return builder;
    },
    lte() {
      return builder;
    },
    not(column: string, operator: string, value: unknown) {
      onNot?.(column, operator, value);
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
  it.each([true, false])("preserves released fallback after requested-date 404 with native-only contract=%s", async qualified => {
    vi.mocked(requireLatestSucceededRunId).mockRejectedValueOnce(Object.assign(new Error("missing requested date"), { statusCode: 404 }));
    const prior = fromMock.getMockImplementation()!;
    let projectionReads = 0;
    const summaryReads: string[] = [];
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections" && ++projectionReads === 1) {
        return createQueryBuilder(() => ({ data: { run_id: "run-122", as_of_date: "2026-02-06" }, error: null }));
      }
      if (table === "forge_runs") {
        let selectedRunId = "";
        return createQueryBuilder(() => {
          summaryReads.push(selectedRunId);
          return { data: { run_id: selectedRunId, as_of_date: "2026-02-06", status: "succeeded",
            metrics: { input_provenance: { external_fantasy_input_contract: qualified
              ? FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT : undefined } } }, error: null };
        }, (column, value) => { if (column === "run_id") selectedRunId = String(value); });
      }
      return prior(table);
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(summaryReads).toEqual([]);
    expect(res.body).toMatchObject({ runId: "run-122", asOfDate: "2026-02-06", fallbackApplied: true });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.diagnostics.requested.runId).toBeNull();
  });

  it.each(["fallback", "explicit"])("retains released legacy rows for selected %s runs without claiming native qualification", async mode => {
    const prior = fromMock.getMockImplementation()!;
    let projectionReads = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections" && mode === "fallback") {
        projectionReads++;
        if (projectionReads === 1) return createQueryBuilder(() => ({ data: [], error: null }));
        if (projectionReads === 2) return createQueryBuilder(() => ({ data: { run_id: "run-122", as_of_date: "2026-02-06" }, error: null }));
      }
      if (table === "forge_runs") {
        let selectedRunId = "run-123";
        return createQueryBuilder(() => ({ data: { run_id: selectedRunId, status: "succeeded", git_sha: "a".repeat(40),
          metrics: { input_provenance: { external_fantasy_input_contract: "external_inputs_allowed" } } }, error: null }),
        (column, value) => { if (column === "run_id") selectedRunId = String(value); });
      }
      return prior(table);
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07", ...(mode === "explicit"
      ? { runId: "11111111-1111-4111-8111-111111111111" } : {}) } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.runId).toBe(mode === "explicit" ? "11111111-1111-4111-8111-111111111111" : "run-122");
  });
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
              goalie_rows: 32,
              input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT }
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
        strategy: "requested_date",
        gapDays: 0,
        severity: "none",
        status: "requested_date",
        message: null
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
            metrics: { goalie_rows: 2, input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } }
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

  it.each([
    { name: "one goalie", wins: [null, 0.419] },
    { name: "both goalies", wins: [null, null] },
  ])("keeps a null win probability unknown for $name without normalizing the matchup", async ({ wins }) => {
    const goalie = (id: number, team: number, opponent: number, win: number | null) => ({
      goalie_id: id, team_id: team, opponent_team_id: opponent, players: { fullName: `Goalie ${id}` },
      teams: { name: `Team ${team}`, abbreviation: `T${team}` }, opponent: { name: `Team ${opponent}`, abbreviation: `T${opponent}` },
      starter_probability: 0.6, proj_shots_against: 28, proj_saves: 25, proj_goals_allowed: 3,
      proj_win_prob: win, proj_shutout_prob: 0.04, uncertainty: {} });
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") {
        return createQueryBuilder(() => ({ data: [goalie(1001, 1, 2, wins[0]), goalie(1002, 2, 1, wins[1])], error: null }));
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({ data: { run_id: "run-123", as_of_date: "2026-02-07", status: "succeeded",
          created_at: "2026-02-07T10:05:00.000Z", metrics: { goalie_rows: 2,
            input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } }, error: null }));
      }
      if (table === "games") return createQueryBuilder(() => ({ count: 1, error: null }));
      if (table === "forge_projection_calibration_daily") return createQueryBuilder(() => ({ data: null, error: null }));
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07", horizon: "1" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.map((row: any) => row.proj_win_prob)).toEqual(wins);
    expect(res.body.diagnostics.notes.join(" ")).not.toContain("Normalized likely-starter win probabilities");
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
        let selectedRunId = "run-123";
        return createQueryBuilder(() => ({
          data: {
            run_id: selectedRunId,
            as_of_date: selectedRunId === "run-122" ? "2026-02-06" : "2026-02-07",
            status: "succeeded",
            created_at: "2026-02-07T10:05:00.000Z",
            metrics: { goalie_rows: 0, input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } }
          },
          error: null
        }), (column, value) => { if (column === "run_id") selectedRunId = String(value); });
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
      strategy: "latest_available_with_data",
      gapDays: 1,
      severity: "error",
      status: "blocked",
      message:
        "Goalie projections is serving 2026-02-06 even though 6 games were scheduled on requested date 2026-02-07. Treat this module as degraded until same-day data is available."
    });
    expect(res.body.scanSummary).toMatchObject({
      surface: "forge_goalies_reader",
      requestedDate: "2026-02-07",
      activeDataDate: "2026-02-06",
      fallbackApplied: true,
      status: "partial",
      rowCounts: {
        returned: 1,
        requested: 0,
        scheduledGamesOnDate: 6
      },
      blockingIssueCount: 1
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
  it("skips failed and running runs when choosing the fallback goalie run", async () => {
    const scanRows = [
      { run_id: "run-failed", as_of_date: "2026-02-06", forge_runs: { status: "failed" } },
      { run_id: "run-running", as_of_date: "2026-02-06", forge_runs: { status: "running" } },
      { run_id: "run-121", as_of_date: "2026-02-05", forge_runs: { status: "succeeded" } }
    ];
    const prior = fromMock.getMockImplementation()!;
    let projectionReads = 0;
    const readRunIds: string[] = [];
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") {
        projectionReads++;
        if (projectionReads === 1) return createQueryBuilder(() => ({ data: [], error: null }));
        if (projectionReads === 2) {
          let runStatus: unknown;
          return createQueryBuilder(
            () => ({ data: scanRows.filter(row => runStatus === undefined || row.forge_runs.status === runStatus), error: null }),
            (column, value) => { if (column === "forge_runs.status") runStatus = value; }
          );
        }
        return createQueryBuilder(() => ({ data: [{ goalie_id: 5555, team_id: 3, opponent_team_id: 4,
          players: { fullName: "Fallback Goalie" }, starter_probability: 0.6, uncertainty: {} }], error: null }),
        (column, value) => { if (column === "run_id") readRunIds.push(String(value)); });
      }
      if (table === "forge_runs") {
        let selectedRunId = "";
        return createQueryBuilder(() => ({ data: { run_id: selectedRunId, status: "succeeded",
          metrics: { input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } }, error: null }),
        (column, value) => { if (column === "run_id") selectedRunId = String(value); });
      }
      return prior(table);
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ runId: "run-121", asOfDate: "2026-02-05", fallbackApplied: true });
    expect(readRunIds).toEqual(["run-121"]);
  });

  it.each([null, "local:unknown", `local:${"b".repeat(40)}`])("rejects an explicit off-release run %j with a clear 422", async gitSha => {
    const prior = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => table === "forge_runs"
      ? createQueryBuilder(() => ({ data: { run_id: "11111111-1111-4111-8111-111111111111", as_of_date: "2026-02-07",
        status: "succeeded", git_sha: gitSha, metrics: { goalie_rows: 32,
          input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } }, error: null }))
      : prior(table));
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07", runId: "11111111-1111-4111-8111-111111111111" } } as any, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.data).toBeUndefined();
    expect(res.body.error).toContain("off the release path");
  });

  it("skips null-sha and local runs when choosing the fallback goalie run", async () => {
    const scanRows = [
      { run_id: "run-local", as_of_date: "2026-02-06", forge_runs: { status: "succeeded", git_sha: "local:unknown" } },
      { run_id: "run-null", as_of_date: "2026-02-06", forge_runs: { status: "succeeded", git_sha: null } },
      { run_id: "run-121", as_of_date: "2026-02-05", forge_runs: { status: "succeeded", git_sha: "a".repeat(40) } }
    ];
    const prior = fromMock.getMockImplementation()!;
    let projectionReads = 0;
    const readRunIds: string[] = [];
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") {
        projectionReads++;
        if (projectionReads === 1) return createQueryBuilder(() => ({ data: [], error: null }));
        if (projectionReads === 2) {
          const filters: Array<(sha: string | null) => boolean> = [];
          return createQueryBuilder(
            () => ({ data: scanRows.filter(row => filters.every(keep => keep(row.forge_runs.git_sha))), error: null }),
            undefined,
            (column, operator, value) => {
              expect(column).toBe("forge_runs.git_sha");
              if (operator === "is" && value === null) filters.push(sha => sha !== null);
              else if (operator === "like" && value === "local:*") filters.push(sha => sha !== null && !sha.startsWith("local:"));
              else throw new Error(`unexpected filter ${operator} ${String(value)}`);
            }
          );
        }
        return createQueryBuilder(() => ({ data: [{ goalie_id: 5555, team_id: 3, opponent_team_id: 4,
          players: { fullName: "Fallback Goalie" }, starter_probability: 0.6, uncertainty: {} }], error: null }),
        (column, value) => { if (column === "run_id") readRunIds.push(String(value)); });
      }
      if (table === "forge_runs") {
        let selectedRunId = "";
        return createQueryBuilder(() => ({ data: { run_id: selectedRunId, status: "succeeded", git_sha: "a".repeat(40),
          metrics: { input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } }, error: null }),
        (column, value) => { if (column === "run_id") selectedRunId = String(value); });
      }
      return prior(table);
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);

    expect(readRunIds).toEqual(["run-121"]);
    expect(res.body).toMatchObject({ runId: "run-121", asOfDate: "2026-02-05", fallbackApplied: true });
  });
});

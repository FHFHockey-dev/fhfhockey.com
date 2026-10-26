import { beforeEach, describe, expect, it, vi } from "vitest";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "lib/projections/calibrationEligibility";
import { provenSnapshotRow, unprovenSnapshotRow } from "lib/projections/externalInputProof.fixtures";

const {
  fromMock,
  requireLatestSucceededRunIdMock,
  resolveLatestStartedSeasonIdForDateMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  requireLatestSucceededRunIdMock: vi.fn(),
  resolveLatestStartedSeasonIdForDateMock: vi.fn(),
}));

vi.mock("lib/projections/apiHelpers", async () => {
  const actual = await vi.importActual<any>(
    "lib/projections/apiHelpers",
  );
  // One mock behind both lookups; the first argument names which one the route called.
  return {
    ...actual,
    requireLatestSucceededRunId: (...args: unknown[]) => requireLatestSucceededRunIdMock("unguarded", ...args),
  };
});
vi.mock("lib/projections/externalInputProof", async () => ({
  ...await vi.importActual<any>("lib/projections/externalInputProof"),
  requireLatestExternalInputProvenRun: async (...args: unknown[]) => {
    const out = await requireLatestSucceededRunIdMock("proven", ...args);
    return typeof out === "string" ? { runId: out, proof: null } : out;
  },
}));

vi.mock("lib/NHL/server", async () => {
  const actual = await vi.importActual<any>("lib/NHL/server");
  return {
    ...actual,
    resolveLatestStartedSeasonIdForDate:
      resolveLatestStartedSeasonIdForDateMock,
  };
});

type QueryResult = {
  data?: any;
  count?: number;
  error: null;
};

function createQueryBuilder(
  resolver: () => QueryResult,
  onEq?: (column: string, value: unknown) => void,
  onSelect?: (columns: string) => void,
) {
  const state = {
    isHeadCount: false,
  };
  const builder: any = {
    select(columns: string, options?: { head?: boolean }) {
      onSelect?.(columns);
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
    gte() {
      return builder;
    },
    or() {
      return builder;
    },
    not() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    in() {
      return builder;
    },
    maybeSingle() {
      const out = resolver();
      const data = Array.isArray(out.data)
        ? (out.data[0] ?? null)
        : (out.data ?? null);
      return Promise.resolve({ data, error: out.error });
    },
    then(resolve: (value: any) => any) {
      const out = resolver();
      if (state.isHeadCount) {
        return Promise.resolve(
          resolve({ count: out.count ?? 0, error: out.error }),
        );
      }
      return Promise.resolve(
        resolve({ data: out.data ?? [], error: out.error }),
      );
    },
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock,
  },
}));

import handler from "../../../../../pages/api/v1/forge/players";

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
    },
  };
  return res;
}

let projectionSelectQueries: string[] = [];
// Runs whose captured snapshot carries no exclusion claim; every other run's snapshot proves it.
let unprovenRunIds = new Set<string>();
function snapshotBuilder() {
  const chain: any = { select: () => chain, eq: () => chain,
    in: (_column: string, ids: string[]) => Promise.resolve({ error: null,
      data: ids.map((id) => (unprovenRunIds.has(id) ? unprovenSnapshotRow(id) : provenSnapshotRow(id))) }) };
  return chain;
}

describe("/api/v1/forge/players", () => {
  it.each([undefined, "external_inputs_allowed"])("refuses a legacy fallback run whose snapshot lacks exclusion proof (metrics %s)", async contract => {
    requireLatestSucceededRunIdMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { statusCode: 404 }));
    unprovenRunIds = new Set(["fallback-external"]);
    const prior = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => table === "forge_runs" ? createQueryBuilder(() => ({
      data: [{ run_id: "fallback-external", as_of_date: "2026-02-06",
        metrics: { input_provenance: { external_fantasy_input_contract: contract } } }], error: null,
    })) : prior(table));
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.data).toBeUndefined();
    expect(fromMock.mock.calls.some(([table]) => table === "forge_player_projections")).toBe(false);
  });

  describe("external-input exclusion proof", () => {
    type ProofRun = { run_id: string; as_of_date: string; metrics: Record<string, unknown> };
    // The real latest-run lookups, over forge_runs rows filtered by the date bounds the reader sends.
    async function route(runs: ProofRun[]) {
      const actual = await vi.importActual<typeof import("lib/projections/apiHelpers")>("lib/projections/apiHelpers");
      const proof = await vi.importActual<typeof import("lib/projections/externalInputProof")>("lib/projections/externalInputProof");
      requireLatestSucceededRunIdMock.mockImplementation((kind: string, ...args: any[]) =>
        (kind === "proven" ? proof.requireLatestExternalInputProvenRun : actual.requireLatestSucceededRunId)(args[0], args[1]));
      const projectionRunIds: unknown[] = [];
      const prior = fromMock.getMockImplementation()!;
      fromMock.mockImplementation((table: string) => {
        if (table === "forge_runs") {
          const filters: Array<(row: ProofRun) => boolean> = [];
          const builder = createQueryBuilder(() => ({ data: runs.filter((row) => filters.every((keep) => keep(row))), error: null }),
            (column, value) => { if (column === "as_of_date") filters.push((row) => row.as_of_date === value); });
          builder.gte = (column: string, value: string) => { filters.push((row: any) => row[column] >= value); return builder; };
          builder.lte = (column: string, value: string) => { filters.push((row: any) => row[column] <= value); return builder; };
          return builder;
        }
        if (table === "forge_player_projections") {
          const builder = prior(table);
          const eq = builder.eq;
          builder.eq = (column: string, value: unknown) => {
            if (column === "run_id") projectionRunIds.push(value);
            return eq(column, value);
          };
          return builder;
        }
        return prior(table);
      });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
      return { res, projectionRunIds };
    }

    it("refuses an unproven legacy latest run, with no proven fallback, instead of serving its rows", async () => {
      unprovenRunIds = new Set(["legacy-run"]);
      const { res, projectionRunIds } = await route([{ run_id: "legacy-run", as_of_date: "2026-02-07", metrics: {} }]);
      expect(res.statusCode).toBe(404);
      expect(projectionRunIds).toEqual([]);
    });

    it("passes over unproven runs in a mixed window for the latest proven one", async () => {
      unprovenRunIds = new Set(["legacy-today", "legacy-yesterday"]);
      const { res, projectionRunIds } = await route([
        { run_id: "legacy-today", as_of_date: "2026-02-07", metrics: {} },
        { run_id: "legacy-yesterday", as_of_date: "2026-02-06", metrics: {} },
        { run_id: "clean-yesterday", as_of_date: "2026-02-06", metrics: {} },
      ]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ runId: "clean-yesterday", asOfDate: "2026-02-06", fallbackApplied: true });
      expect(res.body.diagnostics.runProof).toMatchObject({ runId: "clean-yesterday", basis: "captured_snapshot" });
      expect(projectionRunIds).not.toContain("legacy-today");
      expect(projectionRunIds).not.toContain("legacy-yesterday");
    });

    it("serves a clean run proven by its snapshot although run-start metrics carry no claim", async () => {
      const { res } = await route([{ run_id: "clean-run", as_of_date: "2026-02-07", metrics: {} }]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ runId: "clean-run", asOfDate: "2026-02-07", fallbackApplied: false });
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.diagnostics.runProof).toEqual({ runId: "clean-run", basis: "captured_snapshot", releaseSha: null, closureSha256: null });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    projectionSelectQueries = [];
    unprovenRunIds = new Set();
    requireLatestSucceededRunIdMock.mockResolvedValue("run-123");
    resolveLatestStartedSeasonIdForDateMock.mockResolvedValue(20252026);
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(
          () => ({
            data: [
              {
                player_id: 8478402,
                team_id: 8,
                players: { fullName: "Nick Suzuki", position: "C" },
                teams: {
                  id: 8,
                  abbreviation: "MTL",
                  name: "Montréal Canadiens",
                },
                proj_goals_es: 0.4,
                proj_goals_pp: 0.2,
                proj_goals_pk: 0,
                proj_assists_es: 0.5,
                proj_assists_pp: 0.1,
                proj_assists_pk: 0,
                proj_shots_es: 2.7,
                proj_shots_pp: 0.8,
                proj_shots_pk: 0,
                proj_hits: 0.6,
                proj_blocks: 0.4,
                uncertainty: {
                  model: {
                    skater_selection: {
                      source: "line_combinations",
                      es_role: "L1",
                      unit_tier: "PP1",
                      role_scenarios: {
                        scenario_metadata: {
                          model_version: "skater-role-scenario-v1",
                          scenario_count: 2,
                        },
                      },
                      pp_opportunity: {
                        allocated_player_pp_share: 0.62,
                        team_pp_target_seconds: 320,
                      },
                      opponent_goalie_context: {
                        goal_rate_multiplier: 1.04,
                        starter_certainty: 0.8,
                      },
                      team_level_context: { opponent_defense_edge: 0.12 },
                      rest_schedule: {
                        team_rest_days: 2,
                        opponent_rest_days: 1,
                        rest_delta: 1,
                      },
                    },
                  },
                  pts: { p10: 0, p50: 1, p90: 3 },
                },
              },
            ],
            count: 1,
            error: null,
          }),
          undefined,
          (columns) => projectionSelectQueries.push(columns),
        );
      }
      if (table === "seasons") {
        return createQueryBuilder(() => ({
          data: { id: 20252026 },
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({
          data: [{ playerId: 8478402 }],
          error: null,
        }));
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });
  });

  it("returns canonical skater aggregates from forge_player_projections", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        horizon: "1",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-123",
      asOfDate: "2026-02-07",
      requestedDate: "2026-02-07",
      requestedSeasonId: 20252026,
      resolvedSeasonId: 20252026,
      horizonGames: 1,
      fallbackApplied: false,
      degradedProjectionSummary: {
        degradedPlayerCount: 0,
        lineComboFallbackPlayerCount: 0,
        hardStaleLineComboPlayerCount: 0,
        missingLineComboPlayerCount: 0,
        softStaleLineComboPlayerCount: 0,
        skaterPoolRecoveryPlayerCount: 0,
        note: null,
      },
      scanSummary: {
        surface: "forge_players_reader",
        requestedDate: "2026-02-07",
        activeDataDate: "2026-02-07",
        fallbackApplied: false,
        status: "ready",
        rowCounts: {
          returned: 1,
        },
        blockingIssueCount: 0,
      },
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalRoute: "/api/v1/forge/players",
        legacyRoute: "/api/v1/projections/players",
        status: "canonical_preferred",
      },
      serving: {
        requestedDate: "2026-02-07",
        resolvedDate: "2026-02-07",
        fallbackApplied: false,
        isSameDay: true,
        state: "same_day",
        strategy: "requested_date",
      },
      modelMetadata: {
        modelVersion: "skater-role-scenario-v1",
        scenarioCount: 2,
        calibrationHints: null,
      },
      diagnostics: {
        state: "ready",
        returnedRows: 1,
        fallbackApplied: false,
      },
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      player_id: 8478402,
      player_name: "Nick Suzuki",
      team_name: "Montréal Canadiens",
      teamIdentity: {
        source: {
          id: 8,
          abbreviation: "MTL",
          name: "Montréal Canadiens",
        },
        canonical: {
          id: 8,
          abbreviation: "MTL",
          name: "Montréal Canadiens",
        },
      },
      position: "C",
      hit: 0.6,
      blk: 0.4,
      modelMetadata: {
        modelVersion: "skater-role-scenario-v1",
        scenarioCount: 2,
      },
      confidenceDrivers: {
        role: { evenStrength: "L1", unitTier: "PP1" },
        powerPlay: { allocatedShare: 0.62, teamTargetSeconds: 320 },
        matchup: {
          opponentGoalieGoalRateMultiplier: 1.04,
          opponentStarterCertainty: 0.8,
          opponentDefenseEdge: 0.12,
        },
        rest: { teamRestDays: 2, opponentRestDays: 1, restDelta: 1 },
      },
      projectionRange: {
        points: { floor: 0, typical: 1, ceiling: 3 },
      },
    });
    expect(res.body.data[0].g).toBeCloseTo(0.6, 6);
    expect(res.body.data[0].a).toBeCloseTo(0.6, 6);
    expect(res.body.data[0].pts).toBeCloseTo(1.2, 6);
    expect(res.body.data[0].ppp).toBeCloseTo(0.3, 6);
    expect(res.body.data[0].sog).toBeCloseTo(3.5, 6);
    expect(
      projectionSelectQueries.some(
        (columns) =>
          columns.includes("player_id,\n        team_id,") &&
          columns.includes("teams!team_id") &&
          columns.includes("id,") &&
          columns.includes("abbreviation,") &&
          columns.includes("name"),
      ),
    ).toBe(true);
  });

  it("serves unknown totals, not partial sums, when a modeled head is withheld", async () => {
    const prior = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: 8478403,
              team_id: 8,
              players: { fullName: "Masked Skater", position: "C" },
              teams: { id: 8, abbreviation: "MTL", name: "Montréal Canadiens" },
              proj_goals_es: 0.2,
              proj_goals_pp: null,
              proj_goals_pk: null,
              proj_assists_es: 0.3,
              proj_assists_pp: 0.1,
              proj_assists_pk: null,
              proj_shots_es: 2,
              proj_shots_pp: 0.5,
              proj_shots_pk: null,
              proj_hits: 0.6,
              proj_blocks: 0.4,
              uncertainty: {},
            },
          ],
          count: 1,
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({
          data: [{ playerId: 8478403 }],
          error: null,
        }));
      }
      return prior(table);
    });
    const res = createMockRes();

    await handler(
      { method: "GET", query: { date: "2026-02-07", horizon: "1" } } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    // A withheld PP goals head makes goals, points and PPP unknown; the
    // assists and shots heads are both known, so those totals still serve.
    expect(res.body.data[0]).toMatchObject({
      g: null,
      pts: null,
      ppp: null,
    });
    expect(res.body.data[0].a).toBeCloseTo(0.4, 6);
    expect(res.body.data[0].sog).toBeCloseTo(2.5, 6);
  });

  it.each([
    {
      seasonId: 20232024,
      date: "2024-04-06",
      source: { id: 53, abbreviation: "ARI", name: "Arizona Coyotes" },
    },
    {
      seasonId: 20242025,
      date: "2025-04-06",
      source: { id: 59, abbreviation: "UTA", name: "Utah Hockey Club" },
    },
    {
      seasonId: 20252026,
      date: "2026-04-06",
      source: { id: 68, abbreviation: "UTA", name: "Utah Mammoth" },
    },
  ])(
    "returns source $source.id/$source.abbreviation and canonical UTA/68 for $seasonId",
    async ({ seasonId, date, source }) => {
      resolveLatestStartedSeasonIdForDateMock.mockResolvedValue(seasonId);
      fromMock.mockImplementation((table: string) => {
        if (table === "forge_player_projections") {
          return createQueryBuilder(() => ({
            data: [
              {
                player_id: 8478402,
                team_id: source.id,
                players: { fullName: "Relocated Skater", position: "C" },
                teams: source,
                uncertainty: {},
              },
            ],
            error: null,
          }));
        }
        if (table === "rosters") {
          return createQueryBuilder(() => ({
            data: [{ playerId: 8478402 }],
            error: null,
          }));
        }
        if (table === "player_forecast_source_observations") return snapshotBuilder();
        return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
      });

      const res = createMockRes();
      await handler(
        { method: "GET", query: { date, horizon: "1" } } as any,
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.data[0]).toMatchObject({
        team_name: source.name,
        teamIdentity: {
          source,
          canonical: {
            id: 68,
            abbreviation: "UTA",
            name: "Utah Mammoth",
          },
        },
      });
      expect(res.body).toMatchObject({
        requestedSeasonId: seasonId,
        resolvedSeasonId: seasonId,
      });
      expect(resolveLatestStartedSeasonIdForDateMock).toHaveBeenCalledWith(
        date,
        expect.anything(),
      );
    },
  );

  it.each([
    {
      label: "a mismatched joined abbreviation",
      teamId: 53,
      joined: { id: 53, abbreviation: "UTA", name: "Arizona Coyotes" },
    },
    {
      label: "a mismatched joined id",
      teamId: 53,
      joined: { id: 59, abbreviation: "ARI", name: "Arizona Coyotes" },
    },
    {
      label: "a source id from the wrong season",
      teamId: 68,
      joined: { id: 68, abbreviation: "UTA", name: "Utah Mammoth" },
    },
  ])("fails closed for $label", async ({ teamId, joined }) => {
    resolveLatestStartedSeasonIdForDateMock.mockResolvedValue(20232024);
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: 8478402,
              team_id: teamId,
              players: { fullName: "Invalid Identity", position: "C" },
              teams: joined,
              uncertainty: {},
            },
          ],
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({
          data: [{ playerId: 8478402 }],
          error: null,
        }));
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });

    const res = createMockRes();
    await handler(
      { method: "GET", query: { date: "2024-04-06", horizon: "1" } } as any,
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: "FORGE_PLAYERS_UNAVAILABLE",
      scanSummary: { status: "blocked", blockingIssueCount: 1 },
    });
    expect(res.body.data).toBeUndefined();
  });

  it("reports fallback serving state when it serves the latest prior date with skater rows", async () => {
    let projectionQueryCount = 0;
    resolveLatestStartedSeasonIdForDateMock.mockImplementation(
      async (date: string) => (date === "2024-04-06" ? 20232024 : 20242025),
    );
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        projectionQueryCount += 1;
        if (projectionQueryCount === 1) {
          return createQueryBuilder(() => ({
            data: [],
            error: null,
          }));
        }
        if (projectionQueryCount === 2) {
          return createQueryBuilder(() => ({
            count: 1,
            error: null,
          }));
        }
        return createQueryBuilder(() => ({
          data: [
            {
              player_id: 8478402,
              team_id: 53,
              players: { fullName: "Fallback Skater", position: "C" },
              teams: {
                id: 53,
                abbreviation: "ARI",
                name: "Arizona Coyotes",
              },
              proj_goals_es: 0.3,
              proj_goals_pp: 0.1,
              proj_goals_pk: 0,
              proj_assists_es: 0.4,
              proj_assists_pp: 0.2,
              proj_assists_pk: 0,
              proj_shots_es: 2.1,
              proj_shots_pp: 0.7,
              proj_shots_pk: 0,
              proj_hits: 0.5,
              proj_blocks: 0.2,
              uncertainty: {
                model: {
                  skater_selection: {
                    fallback_path: {
                      used: true,
                      reason: "hard_stale",
                      fallback_candidate_count: 18,
                    },
                    line_combo_recency: {
                      days_stale: 24,
                      class: "HARD_STALE",
                    },
                    active_pool: {
                      fallback_recovery: {
                        path: "supplemental_fallback_plus_roster_union",
                      },
                    },
                  },
                },
              },
            },
          ],
          error: null,
        }));
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-122",
              as_of_date: "2024-04-06",
              metrics: { input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } },
            },
          ],
          error: null,
        }));
      }
      if (table === "seasons") {
        return createQueryBuilder(() => ({
          data: { id: 20252026 },
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({
          data: [{ playerId: 8478402 }],
          error: null,
        }));
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2024-04-08",
        horizon: "1",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-122",
      asOfDate: "2024-04-06",
      requestedDate: "2024-04-08",
      requestedSeasonId: 20242025,
      resolvedSeasonId: 20232024,
      fallbackApplied: true,
      degradedProjectionSummary: {
        degradedPlayerCount: 1,
        lineComboFallbackPlayerCount: 1,
        hardStaleLineComboPlayerCount: 1,
        missingLineComboPlayerCount: 0,
        softStaleLineComboPlayerCount: 0,
        skaterPoolRecoveryPlayerCount: 1,
        note: "1 projected skater is using fallback role context because line combinations were missing, empty, or hard stale.",
      },
      scanSummary: {
        surface: "forge_players_reader",
        requestedDate: "2024-04-08",
        activeDataDate: "2024-04-06",
        fallbackApplied: true,
        status: "ready",
        rowCounts: {
          returned: 1,
          degraded_projection_rows: 1,
          line_combo_fallback_rows: 1,
          skater_pool_recovery_rows: 1,
        },
        blockingIssueCount: 0,
      },
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalRoute: "/api/v1/forge/players",
        legacyRoute: "/api/v1/projections/players",
        status: "canonical_preferred",
      },
      serving: {
        requestedDate: "2024-04-08",
        resolvedDate: "2024-04-06",
        fallbackApplied: true,
        isSameDay: false,
        state: "fallback",
        strategy: "latest_available_with_data",
      },
    });
    expect(res.body.data[0]).toMatchObject({
      player_name: "Fallback Skater",
      team_name: "Arizona Coyotes",
      teamIdentity: {
        source: {
          id: 53,
          abbreviation: "ARI",
          name: "Arizona Coyotes",
        },
        canonical: {
          id: 68,
          abbreviation: "UTA",
          name: "Utah Mammoth",
        },
      },
      degradedProjectionContext: {
        usedLineComboFallback: true,
        lineComboFallbackReason: "hard_stale",
        lineComboRecencyClass: "HARD_STALE",
        lineComboDaysStale: 24,
        skaterPoolRecoveryPath: "supplemental_fallback_plus_roster_union",
        isDegraded: true,
        summary:
          "Fallback role context used because line combos were hard stale (24d stale).",
      },
    });
    expect(resolveLatestStartedSeasonIdForDateMock).toHaveBeenCalledWith(
      "2024-04-06",
      expect.anything(),
    );
    expect(resolveLatestStartedSeasonIdForDateMock).toHaveBeenCalledWith(
      "2024-04-08",
      expect.anything(),
    );
  });

  it("serves a same-date weekly run when the newest same-date run only owns horizon one", async () => {
    let projectionQueryCount = 0;
    const horizonFilters: unknown[] = [];
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        projectionQueryCount += 1;
        const result =
          projectionQueryCount === 1
            ? { data: [], error: null }
            : projectionQueryCount === 2
              ? { count: 0, error: null }
              : projectionQueryCount === 3
                ? { count: 1, error: null }
                : {
                    data: [
                      {
                        player_id: 8478402,
                        team_id: 8,
                        players: { fullName: "Weekly Skater", position: "C" },
                        teams: {
                          id: 8,
                          abbreviation: "MTL",
                          name: "Montréal Canadiens",
                        },
                        proj_goals_es: 1.2,
                        proj_goals_pp: 0.4,
                        proj_goals_pk: 0,
                        proj_assists_es: 1.4,
                        proj_assists_pp: 0.6,
                        proj_assists_pk: 0,
                        proj_shots_es: 10,
                        proj_shots_pp: 3,
                        proj_shots_pk: 0,
                        proj_hits: 2,
                        proj_blocks: 1,
                        uncertainty: {},
                      },
                    ],
                    error: null,
                  };
        return createQueryBuilder(
          () => result,
          (column, value) => {
            if (column === "horizon_games") horizonFilters.push(value);
          },
        );
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [
            { run_id: "daily-run", as_of_date: "2026-02-07", metrics: { input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } },
            { run_id: "weekly-run", as_of_date: "2026-02-07", metrics: { input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } },
          ],
          error: null,
        }));
      }
      if (table === "seasons") {
        return createQueryBuilder(() => ({
          data: { id: 20252026 },
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({
          data: [{ playerId: 8478402 }],
          error: null,
        }));
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });
    requireLatestSucceededRunIdMock.mockResolvedValue("daily-run");

    const res = createMockRes();
    await handler(
      { method: "GET", query: { date: "2026-02-07", horizon: "5" } } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "weekly-run",
      asOfDate: "2026-02-07",
      horizonGames: 5,
      fallbackApplied: false,
      diagnostics: {
        state: "ready",
        missingRequestedHorizon: false,
      },
    });
    expect(res.body.data[0].player_name).toBe("Weekly Skater");
    expect(horizonFilters).toEqual([5, 5, 5, 5]);
  });

  it("reports a blocked contract instead of a healthy empty when only horizon one exists", async () => {
    let projectionQueryCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        projectionQueryCount += 1;
        return createQueryBuilder(() =>
          projectionQueryCount === 4
            ? { count: 1, error: null }
            : projectionQueryCount === 1
              ? { data: [], error: null }
              : { count: 0, error: null },
        );
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [{ run_id: "daily-run", as_of_date: "2026-02-07", metrics: { input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } }],
          error: null,
        }));
      }
      if (table === "seasons") {
        return createQueryBuilder(() => ({
          data: { id: 20252026 },
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({ data: [], error: null }));
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });
    requireLatestSucceededRunIdMock.mockResolvedValue("daily-run");

    const res = createMockRes();
    await handler(
      { method: "GET", query: { date: "2026-02-07", horizon: "5" } } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "daily-run",
      horizonGames: 5,
      data: [],
      scanSummary: {
        status: "blocked",
        blockingIssueCount: 1,
        rowCounts: { missing_requested_horizon: 1 },
      },
      diagnostics: {
        state: "blocked",
        missingRequestedHorizon: true,
        fallbackReason:
          "requested horizon has no genuine output while one-game output exists",
      },
    });
    expect(res.body.diagnostics.message).toContain(
      "one-game output exists but is not relabeled or scaled",
    );
  });
  describe("legacy fallback run selection (A-02)", () => {
    const qualified = {
      input_provenance: {
        external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
      },
    };
    type RunRow = {
      run_id: string;
      as_of_date: string;
      git_sha?: string | null;
      metrics: Record<string, unknown>;
    };

    // Applies the run filters the reader sends, so excluded runs never return.
    function installRuns(runs: RunRow[], scheduledGames = 0) {
      const projectionRunIds: unknown[] = [];
      const prior = fromMock.getMockImplementation()!;
      fromMock.mockImplementation((table: string) => {
        if (table === "forge_runs") {
          const filters: Array<(row: RunRow) => boolean> = [];
          const builder = createQueryBuilder(() => ({
            data: runs.filter((row) => filters.every((keep) => keep(row))),
            error: null,
          }));
          builder.gte = (column: string, value: string) => {
            filters.push((row: any) => row[column] >= value);
            return builder;
          };
          builder.lte = (column: string, value: string) => {
            filters.push((row: any) => row[column] <= value);
            return builder;
          };
          builder.or = (expression: string) => {
            expect(expression).toBe("git_sha.is.null,git_sha.not.like.local:*");
            filters.push((row) => !row.git_sha?.startsWith("local:"));
            return builder;
          };
          builder.not = (column: string, operator: string, value: unknown) => {
            expect(column).toBe("git_sha");
            if (operator === "is" && value === null) filters.push((row) => row.git_sha != null);
            else if (operator === "like" && value === "local:*") {
              filters.push((row) => row.git_sha != null && !row.git_sha.startsWith("local:"));
            } else throw new Error(`unexpected filter ${operator} ${String(value)}`);
            return builder;
          };
          return builder;
        }
        if (table === "games") {
          return createQueryBuilder(() => ({ count: scheduledGames, error: null }));
        }
        if (table === "forge_player_projections") {
          const builder = prior(table);
          const eq = builder.eq;
          builder.eq = (column: string, value: unknown) => {
            if (column === "run_id") projectionRunIds.push(value);
            return eq(column, value);
          };
          return builder;
        }
        return prior(table);
      });
      return projectionRunIds;
    }

    beforeEach(() => {
      requireLatestSucceededRunIdMock.mockRejectedValue(
        Object.assign(new Error("missing"), { statusCode: 404 }),
      );
    });

    it("does not serve a 20-day-old latest succeeded run as ready", async () => {
      const projectionRunIds = installRuns([
        { run_id: "stale-run", as_of_date: "2026-09-29", git_sha: "abc123", metrics: qualified },
      ]);
      const res = createMockRes();
      await handler(
        { method: "GET", query: { date: "2026-10-19" } } as any,
        res,
      );

      expect(res.statusCode).toBe(404);
      expect(res.body.data).toBeUndefined();
      expect(res.body.scanSummary).toMatchObject({
        status: "blocked",
        activeDataDate: null,
      });
      expect(projectionRunIds).not.toContain("stale-run");
    });

    it("prefers the full-slate run over a later single-game, local or null-sha run", async () => {
      const projectionRunIds = installRuns([
        {
          run_id: "null-sha-run",
          as_of_date: "2026-10-18",
          git_sha: null,
          metrics: { ...qualified, execution_scope: { requested_game_ids: [] } },
        },
        { run_id: "local-run", as_of_date: "2026-10-18", git_sha: `local:${"a".repeat(64)}`, metrics: qualified },
        {
          run_id: "scoped-run",
          as_of_date: "2026-10-18",
          git_sha: "abc123",
          metrics: { ...qualified, execution_scope: { requested_game_ids: [2026020101] } },
        },
        {
          run_id: "full-run",
          as_of_date: "2026-10-18",
          git_sha: "abc123",
          metrics: { ...qualified, execution_scope: { requested_game_ids: [] } },
        },
      ]);
      const res = createMockRes();
      await handler(
        { method: "GET", query: { date: "2026-10-19" } } as any,
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        runId: "full-run",
        asOfDate: "2026-10-18",
        fallbackApplied: true,
        serving: { status: "fallback_recent", severity: "warn", gapDays: 1 },
        scanSummary: { status: "ready", blockingIssueCount: 0 },
      });
      expect(projectionRunIds).not.toContain("local-run");
      expect(projectionRunIds).not.toContain("null-sha-run");
      expect(projectionRunIds).not.toContain("scoped-run");
    });

    it("flags a recent fallback as blocked serving when the requested date had games", async () => {
      installRuns(
        [{ run_id: "yesterday-run", as_of_date: "2026-10-18", git_sha: "abc123", metrics: qualified }],
        6,
      );
      const res = createMockRes();
      await handler(
        { method: "GET", query: { date: "2026-10-19" } } as any,
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        runId: "yesterday-run",
        serving: {
          status: "blocked",
          severity: "error",
          requestedScheduledGames: 6,
        },
        scanSummary: { status: "partial", blockingIssueCount: 1 },
      });
      expect(res.body.diagnostics.message).toContain("6 games were scheduled");
    });
  });
});

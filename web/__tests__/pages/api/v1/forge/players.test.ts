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
    countExact: false,
    range: null as [number, number] | null,
  };
  const builder: any = {
    select(columns: string, options?: { head?: boolean; count?: string }) {
      onSelect?.(columns);
      state.isHeadCount = Boolean(options?.head);
      state.countExact = options?.count === "exact";
      return builder;
    },
    // Paged reads (`pages`): a row window, with the total count of the unwindowed rows.
    range(from: number, to: number) {
      state.range = [from, to];
      return builder;
    },
    abortSignal() {
      return builder;
    },
    gt() {
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
      // PostgREST returns at most 1,000 rows to a read without a range (the hosted row cap).
      const rows = Array.isArray(out.data) && !state.range ? out.data.slice(0, 1000) : out.data ?? [];
      if (state.countExact && Array.isArray(out.data)) {
        return Promise.resolve(resolve({ error: out.error, count: out.data.length,
          data: state.range ? out.data.slice(state.range[0], state.range[1] + 1) : rows }));
      }
      return Promise.resolve(
        resolve({ data: rows, error: out.error }),
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
  const weeklyRow = {
    player_id: 8478402,
    team_id: 8,
    players: { fullName: "Weekly Skater", position: "C" },
    teams: { id: 8, abbreviation: "MTL", name: "Montréal Canadiens" },
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
  };
  it.each([undefined, "external_inputs_allowed"])("never serves another date's run, even one whose snapshot lacks exclusion proof (metrics %s)", async contract => {
    requireLatestSucceededRunIdMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { statusCode: 404 }));
    unprovenRunIds = new Set(["fallback-external"]);
    const prior = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => table === "forge_runs" ? createQueryBuilder(() => ({
      data: [{ run_id: "fallback-external", as_of_date: "2026-02-06",
        metrics: { input_provenance: { external_fantasy_input_contract: contract } } }], error: null,
    })) : prior(table));
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ runId: null, asOfDate: "2026-02-07", reason: "no_proven_run_for_date", data: [] });
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
          const eq = builder.eq, inIds = builder.in;
          builder.eq = (column: string, value: unknown) => {
            if (column === "run_id") projectionRunIds.push(value);
            return eq(column, value);
          };
          builder.in = (column: string, values: unknown[]) => {
            if (column === "run_id") projectionRunIds.push(...values);
            return inIds(column, values);
          };
          return builder;
        }
        return prior(table);
      });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
      return { res, projectionRunIds };
    }

    it("refuses an unproven latest run instead of serving its rows: the date is empty, with the reason", async () => {
      unprovenRunIds = new Set(["legacy-run"]);
      const { res, projectionRunIds } = await route([{ run_id: "legacy-run", as_of_date: "2026-02-07", metrics: {} }]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ runId: null, reason: "no_proven_run_for_date", data: [] });
      expect(projectionRunIds).toEqual([]);
    });

    it("passes over a date's unproven runs, and never serves a neighboring date's proven run (H6)", async () => {
      unprovenRunIds = new Set(["legacy-today", "legacy-yesterday"]);
      const { res, projectionRunIds } = await route([
        { run_id: "legacy-today", as_of_date: "2026-02-07", metrics: {} },
        { run_id: "legacy-yesterday", as_of_date: "2026-02-06", metrics: {} },
        { run_id: "clean-yesterday", as_of_date: "2026-02-06", metrics: {} },
        { run_id: "clean-tomorrow", as_of_date: "2026-02-08", metrics: {} },
      ]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ runId: null, asOfDate: "2026-02-07", requestedDate: "2026-02-07",
        fallbackApplied: false, reason: "no_proven_run_for_date", data: [],
        diagnostics: { state: "empty", reason: "no_proven_run_for_date", runProof: null } });
      expect(projectionRunIds).toEqual([]);
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
                run_id: "fixture-run",
                game_id: 2025020001,
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
          data: [{ playerId: 8478402, teamId: 8 }],
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
              run_id: "fixture-run",
              game_id: 2025020001,
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
          data: [{ playerId: 8478403, teamId: 8 }],
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

  it("withholds totals that need a missing PK head on an all-situations row (AF-05)", async () => {
    const prior = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "fixture-run", game_id: 2025020001, player_id: 8478403, team_id: 8,
              players: { fullName: "Missing PK Goals", position: "C" },
              teams: { id: 8, abbreviation: "MTL", name: "Montréal Canadiens" },
              proj_goals_es: 0.2, proj_goals_pp: 0.1, proj_goals_pk: null,
              proj_assists_es: 0.3, proj_assists_pp: 0.15, proj_assists_pk: 0.01,
              proj_shots_es: 2, proj_shots_pp: 0.5, proj_shots_pk: 0.2,
              proj_hits: 0.6, proj_blocks: 0.4,
              uncertainty: { model: { skater_selection: { strength_accounting: {
                version: "forge-skater-strength-buckets-v1", es_definition: "even_strength", pk_status: "modeled" } } } },
            },
          ],
          count: 1,
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({ data: [{ playerId: 8478403, teamId: 8 }], error: null }));
      }
      return prior(table);
    });
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-02-07", horizon: "1" } } as any, res);

    expect(res.statusCode).toBe(200);
    // ES .2 + PP .1 is not served as goals when the PK goals head is missing.
    expect(res.body.data[0]).toMatchObject({ g: null, pts: null, pk_status: "modeled" });
    expect(res.body.data[0].a).toBeCloseTo(0.46, 6);
    expect(res.body.data[0].sog).toBeCloseTo(2.7, 6);
    expect(res.body.data[0].ppp).toBeCloseTo(0.25, 6);
  });

  it("passes availability and time away through and labels if-plays lines (decision 132, L9c)", async () => {
    const prior = fromMock.getMockImplementation()!;
    const availability = {
      version: "forge-skater-coverage-v1", game_id: 2025020777, state: "uncertain", line_conditioning: "if_plays",
      expected_for_game: null, participation_probability: null, participation_qualified: false,
      label: "day-to-day: participation probability not qualified", event_type: "DTD", event_id: 9,
    };
    const timeAway = { version: "forge-time-away-v1", last_game_date: "2026-01-20", days_away: 18, status: "away",
      line_basis: "last_active_games", decay: { status: "unvalidated", applied: false, mean_ratio: null, dispersion_ratio: null, uncertainty: "widened_unquantified" } };
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "fixture-run", game_id: 2025020001, player_id: 8478403, team_id: 8,
              players: { fullName: "Day To Day", position: "C" },
              teams: { id: 8, abbreviation: "MTL", name: "Montréal Canadiens" },
              proj_goals_es: 0.2, proj_goals_pp: 0.05, proj_goals_pk: null,
              proj_assists_es: 0.3, proj_assists_pp: 0.1, proj_assists_pk: null,
              proj_shots_es: 2, proj_shots_pp: 0.5, proj_shots_pk: null,
              proj_hits: 1, proj_blocks: 0.5,
              uncertainty: { availability, time_away: timeAway },
            },
          ],
          count: 1,
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({ data: [{ playerId: 8478403, teamId: 8 }], error: null }));
      }
      return prior(table);
    });
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-02-07", horizon: "1" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      availability: { state: "uncertain", game_id: 2025020777, expected_for_game: null,
        label: "day-to-day: participation probability not qualified" },
      time_away: { status: "away", days_away: 18, decay: { status: "unvalidated", applied: false } },
      line_conditioning: "if_plays",
      line_label: "If he plays · day-to-day: participation probability not qualified",
    });
  });

  it("keeps missing hits/blocks unknown and labels an unknown PK bucket (W3-2 D3; L9a ticket)", async () => {
    const prior = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "fixture-run",
              game_id: 2025020001,
              player_id: 8478403,
              team_id: 8,
              players: { fullName: "No Physical Line", position: "C" },
              teams: { id: 8, abbreviation: "MTL", name: "Montréal Canadiens" },
              proj_goals_es: 0.2, proj_goals_pp: 0.05, proj_goals_pk: 0.01,
              proj_assists_es: 0.3, proj_assists_pp: 0.1, proj_assists_pk: null,
              proj_shots_es: 2, proj_shots_pp: 0.5, proj_shots_pk: null,
              proj_hits: null,
              proj_blocks: null,
              uncertainty: { model: { skater_selection: { strength_accounting: { pk_status: "unknown_team_pk_exposure" } } } },
            },
          ],
          count: 1,
          error: null,
        }));
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({ data: [{ playerId: 8478403, teamId: 8 }], error: null }));
      }
      return prior(table);
    });
    const res = createMockRes();

    await handler({ method: "GET", query: { date: "2026-02-07", horizon: "1" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0]).toMatchObject({ hit: null, blk: null, pk_status: "unknown_team_pk_exposure" });
    // A known PK goals head is summed (ES + PP + PK).
    expect(res.body.data[0].g).toBeCloseTo(0.26, 6);
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
                run_id: "fixture-run",
                game_id: 2025020001,
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
            data: [{ playerId: 8478402, teamId: 8 }],
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
              run_id: "fixture-run",
              game_id: 2025020001,
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
          data: [{ playerId: 8478402, teamId: 8 }],
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

  it("serves the requested date's degraded role context and canonical team identity", async () => {
    requireLatestSucceededRunIdMock.mockResolvedValue("run-122");
    resolveLatestStartedSeasonIdForDateMock.mockImplementation(
      async (date: string) => (date === "2024-04-06" ? 20232024 : 20242025),
    );
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "fixture-run",
              game_id: 2025020001,
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
          data: [{ playerId: 8478402, teamId: 8 }],
          error: null,
        }));
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2024-04-06",
        horizon: "1",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-122",
      asOfDate: "2024-04-06",
      requestedDate: "2024-04-06",
      requestedSeasonId: 20232024,
      resolvedSeasonId: 20232024,
      fallbackApplied: false,
      reason: null,
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
        requestedDate: "2024-04-06",
        activeDataDate: "2024-04-06",
        fallbackApplied: false,
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
        requestedDate: "2024-04-06",
        resolvedDate: "2024-04-06",
        fallbackApplied: false,
        isSameDay: true,
        strategy: "requested_date",
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
  });

  it("selects the requested horizon's run for a multi-game request (L3)", async () => {
    const horizonFilters: unknown[] = [];
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        return createQueryBuilder(
          () => ({ data: [{ ...weeklyRow, run_id: "weekly-run", game_id: 2026020500 }], error: null }),
          (column, value) => {
            if (column === "horizon_games") horizonFilters.push(value);
          },
        );
      }
      if (table === "rosters") {
        return createQueryBuilder(() => ({ data: [{ playerId: 8478402, teamId: 8 }], error: null }));
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });
    requireLatestSucceededRunIdMock.mockImplementation(async (_kind: string, _date: string, horizon: number) =>
      horizon === 5 ? "weekly-run" : "daily-run");

    const res = createMockRes();
    await handler(
      { method: "GET", query: { date: "2026-02-07", horizon: "5" } } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(requireLatestSucceededRunIdMock).toHaveBeenCalledWith("proven", "2026-02-07", 5);
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
    expect(horizonFilters).toEqual([5]);
  });

  it("reports a blocked contract, found through the real lookup, when the date has only a one-game run", async () => {
    const actual = await vi.importActual<typeof import("lib/projections/externalInputProof")>("lib/projections/externalInputProof");
    requireLatestSucceededRunIdMock.mockImplementation((_kind: string, ...args: any[]) =>
      actual.requireLatestExternalInputProvenRun(args[0], args[1]));
    const horizonOf = (expression: string) => Number(/horizon_games\.eq\.(\d+)/.exec(expression)?.[1]);
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        let horizon: unknown = null;
        return createQueryBuilder(
          () => ({ count: horizon === 1 ? 1 : 0, data: [], error: null }),
          (column, value) => { if (column === "horizon_games") horizon = value; },
        );
      }
      if (table === "forge_runs") {
        // Only an h1 run exists for the date: the h5 lookup finds nothing.
        let horizon = 1;
        const builder = createQueryBuilder(() => ({ data: horizon === 1 ? [{ run_id: "daily-run" }] : [], error: null }));
        builder.or = (expression: string) => { horizon = horizonOf(expression); return builder; };
        return builder;
      }
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });

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
      reason: null,
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

  describe("per-game runs, paged reads and empty dates (audit 2026-11-16 H3, H5, H6, L3)", () => {
    const SLATE_GAMES = Array.from({ length: 11 }, (_, index) => 2026020300 + index);
    const RERUN_GAME = SLATE_GAMES[8];
    const skater = (runId: string, gameId: number, playerId: number) => ({ ...weeklyRow, run_id: runId, game_id: gameId,
      player_id: playerId, players: { fullName: `${runId} ${playerId}`, position: "C" } });
    type RunRow = { run_id: string; as_of_date: string; execution_scope?: unknown; scope_key?: string };

    // forge_runs rows filtered by the date the reader sends; projections by the run ids it reads.
    function install(args: { runs: RunRow[]; projections: Array<Record<string, any>>; rosters?: Array<Record<string, any>>;
      gamesOnDate?: number; gamesAfterDate?: number }) {
      const projectionRunIds: unknown[] = [];
      fromMock.mockImplementation((table: string) => {
        if (table === "forge_runs") {
          let date: unknown;
          return createQueryBuilder(() => ({ data: args.runs.filter((row) => row.as_of_date === date), error: null }),
            (column, value) => { if (column === "as_of_date") date = value; });
        }
        if (table === "forge_player_projections") {
          let ids: unknown[] = [];
          const builder = createQueryBuilder(() => ({ data: args.projections.filter((row) => ids.includes(row.run_id)), error: null }));
          builder.in = (column: string, values: unknown[]) => {
            if (column === "run_id") { ids = values; projectionRunIds.push(...values); }
            return builder;
          };
          return builder;
        }
        if (table === "rosters") {
          return createQueryBuilder(() => ({ data: args.rosters ?? [...new Set(args.projections.map((row) => row.player_id))]
            .map((playerId) => ({ playerId, teamId: 8 })), error: null }));
        }
        if (table === "games") {
          let after = false;
          const builder = createQueryBuilder(() => ({ count: after ? args.gamesAfterDate ?? 0 : args.gamesOnDate ?? 0, error: null }));
          builder.gt = () => { after = true; return builder; };
          return builder;
        }
        if (table === "player_forecast_source_observations") return snapshotBuilder();
        return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
      });
      return projectionRunIds;
    }

    beforeEach(async () => {
      const actual = await vi.importActual<typeof import("lib/projections/externalInputProof")>("lib/projections/externalInputProof");
      requireLatestSucceededRunIdMock.mockImplementation((_kind: string, ...args: any[]) =>
        actual.requireLatestExternalInputProvenRun(args[0], args[1]));
    });

    it("serves all 11 games when a later single-game rerun exists, the rerun only for its own game (H3)", async () => {
      // The full slate: 36 skaters per game. The rerun of one game projects 35 of its players, one of them new.
      const slate = SLATE_GAMES.flatMap((gameId) => Array.from({ length: 36 }, (_, index) => skater("slate-run", gameId, gameId * 100 + index)));
      const rerun = [...Array.from({ length: 34 }, (_, index) => skater("rerun", RERUN_GAME, RERUN_GAME * 100 + index)),
        skater("rerun", RERUN_GAME, 9_000_001)];
      const projectionRunIds = install({
        runs: [
          { run_id: "rerun", as_of_date: "2026-11-12", execution_scope: { mode: "selected_games", requested_game_ids: [RERUN_GAME] },
            scope_key: `h1:${RERUN_GAME}` },
          { run_id: "slate-run", as_of_date: "2026-11-12", execution_scope: { mode: "full_slate", requested_game_ids: [] }, scope_key: "h1:full" },
          { run_id: "older-slate-run", as_of_date: "2026-11-12", scope_key: "h1:full" },
        ],
        projections: [...slate, ...rerun, skater("older-slate-run", SLATE_GAMES[0], 7_000_001)],
        gamesOnDate: 11,
      });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-11-12" } } as any, res);

      expect(res.statusCode).toBe(200);
      expect(projectionRunIds).toEqual(["slate-run", "rerun"]);
      expect(res.body).toMatchObject({ runId: "slate-run", asOfDate: "2026-11-12", reason: null,
        diagnostics: { state: "ready", gameRuns: [{ runId: "rerun", gameIds: [RERUN_GAME], basis: "captured_snapshot" }] } });
      const rows = res.body.data as Array<{ player_id: number; player_name: string }>;
      expect(rows).toHaveLength(10 * 36 + 35);
      const gameOf = (row: { player_id: number }) => row.player_id === 9_000_001 ? RERUN_GAME : Math.floor(row.player_id / 100);
      expect(new Set(rows.map(gameOf)).size).toBe(11);
      // The rerun's game comes only from the rerun: the slate run's line for the player it dropped is not kept.
      expect(rows.filter((row) => gameOf(row) === RERUN_GAME).every((row) => row.player_name.startsWith("rerun "))).toBe(true);
      expect(rows.some((row) => row.player_id === RERUN_GAME * 100 + 35)).toBe(false);
      expect(rows.some((row) => row.player_id === 7_000_001)).toBe(false);
    });

    it("keeps every projected skater when the season has 1,200 current roster rows (H5)", async () => {
      const projections = [skater("slate-run", SLATE_GAMES[0], 101), skater("slate-run", SLATE_GAMES[0], 1_150)];
      const rosters = Array.from({ length: 1_200 }, (_, index) => ({ playerId: index + 1, teamId: 8 }));
      install({ runs: [{ run_id: "slate-run", as_of_date: "2026-11-12" }], projections, rosters, gamesOnDate: 11 });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-11-12" } } as any, res);

      expect(res.statusCode).toBe(200);
      // Player 1,150 is outside the first 1,000 roster rows: an unpaged read would have dropped him.
      expect(res.body.data.map((row: any) => row.player_id).sort((a: number, b: number) => a - b)).toEqual([101, 1_150]);
      const rosterReads = fromMock.mock.calls.filter(([table]) => table === "rosters");
      expect(rosterReads).toHaveLength(2);
    });

    it.each([
      ["a scheduled date with no proven run", 6, 40, "no_proven_run_for_date", "FORGE skater projections are not available for the 2026-11-16 slate.", 1],
      ["a verified off-day", 0, 40, "no_games", "No NHL games are scheduled on 2026-11-16.", 0],
      ["a date whose schedule is not stored", 0, 0, "no_proven_run_for_date", "FORGE skater projections are not available for the 2026-11-16 slate.", 0],
    ])("serves %s empty, with its reason, and never a neighboring date's rows (H6)", async (_label, gamesOnDate, gamesAfterDate, reason, message, blocking) => {
      const projectionRunIds = install({
        runs: [{ run_id: "yesterday", as_of_date: "2026-11-15" }, { run_id: "tomorrow", as_of_date: "2026-11-17" }],
        projections: [skater("yesterday", 2026020200, 1), skater("tomorrow", 2026020400, 2)],
        gamesOnDate, gamesAfterDate,
      });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-11-16" } } as any, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ runId: null, asOfDate: "2026-11-16", requestedDate: "2026-11-16", fallbackApplied: false,
        reason, message, data: [], serving: { resolvedDate: "2026-11-16", strategy: "requested_date" },
        scanSummary: { status: "empty", blockingIssueCount: blocking },
        diagnostics: { state: "empty", reason, message } });
      expect(projectionRunIds).toEqual([]);
    });

    it("serves an exact-date proven run's rows", async () => {
      install({ runs: [{ run_id: "today", as_of_date: "2026-11-16" }, { run_id: "yesterday", as_of_date: "2026-11-15" }],
        projections: [skater("today", 2026020200, 1), skater("yesterday", 2026020100, 2)], gamesOnDate: 1 });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-11-16" } } as any, res);
      expect(res.body).toMatchObject({ runId: "today", asOfDate: "2026-11-16", reason: null, message: null });
      expect(res.body.data.map((row: any) => row.player_id)).toEqual([1]);
    });

    it("defaults the date to the Eastern-time slate, not the UTC date (L3)", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-17T03:30:00Z"));
      try {
        install({ runs: [{ run_id: "et-slate", as_of_date: "2026-11-16" }], projections: [skater("et-slate", 2026020200, 1)] });
        const res = createMockRes();
        await handler({ method: "GET", query: {} } as any, res);
        expect(res.body).toMatchObject({ runId: "et-slate", requestedDate: "2026-11-16" });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

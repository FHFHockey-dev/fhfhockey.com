import { beforeEach, describe, expect, it, vi } from "vitest";

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
  return {
    ...actual,
    requireLatestSucceededRunId: requireLatestSucceededRunIdMock,
  };
});

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
    order() {
      return builder;
    },
    limit() {
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

describe("/api/v1/forge/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectionSelectQueries = [];
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
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });

    const res = createMockRes();
    await handler(
      { method: "GET", query: { date: "2024-04-06", horizon: "1" } } as any,
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: "Projection team identity is invalid for the resolved season.",
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
      return createQueryBuilder(() => ({ data: [], count: 0, error: null }));
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2024-10-07",
        horizon: "1",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-122",
      asOfDate: "2024-04-06",
      requestedDate: "2024-10-07",
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
        requestedDate: "2024-10-07",
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
        requestedDate: "2024-10-07",
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
      "2024-10-07",
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
            { run_id: "daily-run", as_of_date: "2026-02-07" },
            { run_id: "weekly-run", as_of_date: "2026-02-07" },
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
          data: [{ run_id: "daily-run", as_of_date: "2026-02-07" }],
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
});

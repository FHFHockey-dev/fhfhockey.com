import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultTeamLandingFilterState } from "./teamStatsFilters";
import {
  applyOfficialRowOverrides,
  parseTeamLandingApiRequest,
  queryTeamStatsLanding,
  sortTeamStatsRows,
} from "./teamStatsQueries";
import {
  buildTeamStatsLandingApiPath,
  createEmptyTeamStatsLandingResponse,
} from "./teamStatsLandingApi";

type MockSummaryRow = {
  game_id: number;
  season_id: number;
  game_type: number;
  game_date: string;
  team_id: number;
  opponent_team_id: number;
  venue: "home" | "away";
  is_home: boolean;
  strength: string;
  score_state: string;
  toi_seconds: number | null;
  wins: number;
  losses: number;
  otl: number;
  row_wins: number;
  points: number;
  cf: number;
  ca: number;
  ff: number;
  fa: number;
  sf: number;
  sa: number;
  gf: number;
  ga: number;
  xgf: number;
  xga: number;
  scf: number;
  sca: number;
  scsf: number;
  scsa: number;
  scgf: number;
  scga: number;
  hdcf: number;
  hdca: number;
  hdsf: number;
  hdsa: number;
  hdgf: number;
  hdga: number;
  mdcf: number;
  mdca: number;
  mdsf: number;
  mdsa: number;
  mdgf: number;
  mdga: number;
  ldcf: number;
  ldca: number;
  ldsf: number;
  ldsa: number;
  ldgf: number;
  ldga: number;
};

function createSummaryRow(overrides: Partial<MockSummaryRow>): MockSummaryRow {
  return {
    game_id: 1,
    season_id: 20252026,
    game_type: 2,
    game_date: "2025-10-10",
    team_id: 1,
    opponent_team_id: 2,
    venue: "home",
    is_home: true,
    strength: "fiveOnFive",
    score_state: "allScores",
    toi_seconds: 3600,
    wins: 1,
    losses: 0,
    otl: 0,
    row_wins: 1,
    points: 2,
    cf: 60,
    ca: 40,
    ff: 45,
    fa: 35,
    sf: 30,
    sa: 20,
    gf: 3,
    ga: 2,
    xgf: 2.8,
    xga: 1.7,
    scf: 20,
    sca: 15,
    scsf: 12,
    scsa: 10,
    scgf: 2,
    scga: 1,
    hdcf: 8,
    hdca: 6,
    hdsf: 5,
    hdsa: 4,
    hdgf: 1,
    hdga: 1,
    mdcf: 7,
    mdca: 5,
    mdsf: 4,
    mdsa: 3,
    mdgf: 1,
    mdga: 0,
    ldcf: 5,
    ldca: 4,
    ldsf: 3,
    ldsa: 2,
    ldgf: 0,
    ldga: 0,
    ...overrides,
  };
}

function createMockSupabase(args: {
  summaryRows: MockSummaryRow[];
  teams?: Array<{ id: number; abbreviation: string | null }>;
}) {
  const teams = args.teams ?? [];
  let summaryPageRequests = 0;

  return {
    from(table: string) {
      if (table === "team_underlying_stats_summary") {
        const eqFilters = new Map<string, unknown>();
        const gteFilters = new Map<string, number | string>();
        const lteFilters = new Map<string, number | string>();
        const orders: Array<{ column: keyof MockSummaryRow; ascending: boolean }> = [];

        return {
          select() {
            return this;
          },
          gte(column: string, value: number | string) {
            gteFilters.set(column, value);
            return this;
          },
          lte(column: string, value: number | string) {
            lteFilters.set(column, value);
            return this;
          },
          eq(column: string, value: unknown) {
            eqFilters.set(column, value);
            return this;
          },
          order(column: keyof MockSummaryRow, options?: { ascending?: boolean }) {
            orders.push({ column, ascending: options?.ascending ?? true });
            return this;
          },
          async range(from: number, to: number) {
            summaryPageRequests += 1;
            const filtered = args.summaryRows.filter((row) => {
              for (const [column, value] of eqFilters.entries()) {
                if (row[column as keyof MockSummaryRow] !== value) {
                  return false;
                }
              }

              for (const [column, value] of gteFilters.entries()) {
                const rowValue = row[column as keyof MockSummaryRow] as number | string;
                if (rowValue < value) {
                  return false;
                }
              }

              for (const [column, value] of lteFilters.entries()) {
                const rowValue = row[column as keyof MockSummaryRow] as number | string;
                if (rowValue > value) {
                  return false;
                }
              }

              return true;
            });
            // Postgres leaves rows that tie on every ORDER BY key in no fixed
            // order, so alternate tie order between page requests.
            const tieOrdered =
              summaryPageRequests % 2 === 0 ? [...filtered].reverse() : filtered;
            const sorted = [...tieOrdered].sort((left, right) => {
              for (const { column, ascending } of orders) {
                const leftValue = left[column] as number | string;
                const rightValue = right[column] as number | string;
                if (leftValue === rightValue) continue;
                const direction = leftValue < rightValue ? -1 : 1;
                return ascending ? direction : -direction;
              }
              return 0;
            });

            return {
              data: sorted.slice(from, to + 1),
              error: null,
            };
          },
        };
      }

      if (table === "teams") {
        return {
          select() {
            return {
              async in(_column: string, ids: number[]) {
                return {
                  data: teams.filter((team) => ids.includes(team.id)),
                  error: null,
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("teamStatsQueries", () => {
  it("builds the dedicated team landing api path", () => {
    const state = createDefaultTeamLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 100,
    });

    state.primary.displayMode = "rates";
    state.expandable.teamId = 5;
    state.expandable.againstTeamId = 7;
    state.view.sort = { sortKey: "cfPer60", direction: "desc" };
    state.view.pagination = { page: 2, pageSize: 100 };

    expect(buildTeamStatsLandingApiPath(state)).toBe(
      "/api/v1/underlying-stats/teams?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&displayMode=rates&teamId=5&againstTeamId=7&venue=all&scope=none&sortKey=cfPer60&sortDirection=desc&page=2&pageSize=100"
    );
  });

  it("returns an empty server-sorted response envelope", () => {
    const state = createDefaultTeamLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 50,
    });

    state.primary.displayMode = "rates";
    state.view.sort = { sortKey: "xgfPct", direction: "desc" };
    state.view.pagination = { page: 3, pageSize: 50 };

    expect(createEmptyTeamStatsLandingResponse(state)).toMatchObject({
      family: "rates",
      rows: [],
      sort: {
        sortKey: "xgfPct",
        direction: "desc",
      },
      pagination: {
        page: 3,
        pageSize: 50,
        totalRows: 0,
        totalPages: 0,
      },
      placeholder: true,
    });
  });

  it("rejects invalid date-range requests before query execution", () => {
    const result = parseTeamLandingApiRequest({
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      scope: "dateRange",
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      error: {
        error: "Invalid team stats filter combination.",
        issues: ["dateRangeOrder"],
      },
    });
  });

  it("aggregates counts rows by team and derives rate metrics from toi", async () => {
    const state = createDefaultTeamLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 50,
    });
    state.primary.displayMode = "rates";
    state.view.sort = { sortKey: "cfPer60", direction: "desc" };

    const supabase = createMockSupabase({
      summaryRows: [
        createSummaryRow({
          game_id: 1002,
          game_date: "2025-10-12",
          team_id: 1,
          opponent_team_id: 9,
          toi_seconds: 3600,
          cf: 60,
          ca: 40,
          sf: 30,
          sa: 20,
          gf: 3,
          ga: 2,
          xgf: 2.8,
          xga: 1.7,
        }),
        createSummaryRow({
          game_id: 1001,
          game_date: "2025-10-10",
          team_id: 1,
          opponent_team_id: 8,
          toi_seconds: 1800,
          wins: 0,
          losses: 1,
          row_wins: 0,
          points: 0,
          cf: 20,
          ca: 10,
          sf: 8,
          sa: 6,
          gf: 1,
          ga: 1,
          xgf: 1.1,
          xga: 0.7,
        }),
        createSummaryRow({
          game_id: 1003,
          game_date: "2025-10-14",
          team_id: 3,
          opponent_team_id: 9,
          toi_seconds: 3600,
          cf: 40,
          ca: 30,
          sf: 18,
          sa: 15,
          gf: 2,
          ga: 1,
          xgf: 1.9,
          xga: 1.3,
        }),
      ],
      teams: [
        { id: 1, abbreviation: "FLA" },
        { id: 3, abbreviation: "TBL" },
      ],
    });

    const response = await queryTeamStatsLanding({
      state,
      supabase: supabase as never,
    });

    expect(response.family).toBe("rates");
    expect(response.pagination.totalRows).toBe(2);
    expect(response.rows[0]).toMatchObject({
      rank: 1,
      teamId: 1,
      teamLabel: "FLA",
      gamesPlayed: 2,
      toiSeconds: 5400,
      toiPerGameSeconds: 2700,
      cfPer60: 53.333333333333336,
      sfPct: 0.59375,
      shPct: 0.10526315789473684,
      svPct: 0.8846153846153846,
      pdo: 98.98785425101214,
    });
    expect(response.rows[1]).toMatchObject({
      rank: 2,
      teamId: 3,
      teamLabel: "TBL",
      cfPer60: 40,
    });
  });

  it("applies opponent semantics without special-case query paths", async () => {
    const baseState = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026 });
    baseState.view.sort = { sortKey: "teamLabel", direction: "asc" };

    const supabase = createMockSupabase({
      summaryRows: [
        createSummaryRow({ game_id: 2001, team_id: 1, opponent_team_id: 9, game_date: "2025-10-20" }),
        createSummaryRow({ game_id: 2002, team_id: 3, opponent_team_id: 9, game_date: "2025-10-21" }),
        createSummaryRow({ game_id: 2003, team_id: 1, opponent_team_id: 7, game_date: "2025-10-22" }),
      ],
      teams: [
        { id: 1, abbreviation: "FLA" },
        { id: 3, abbreviation: "TBL" },
      ],
    });

    const opponentOnlyState = {
      ...baseState,
      expandable: {
        ...baseState.expandable,
        againstTeamId: 9,
      },
    };
    const opponentOnly = await queryTeamStatsLanding({
      state: opponentOnlyState,
      supabase: supabase as never,
    });

    expect(opponentOnly.rows.map((row) => row.teamLabel)).toEqual(["FLA", "TBL"]);

    const teamAndOpponentState = {
      ...baseState,
      expandable: {
        ...baseState.expandable,
        teamId: 1,
        againstTeamId: 9,
      },
    };
    const teamAndOpponent = await queryTeamStatsLanding({
      state: teamAndOpponentState,
      supabase: supabase as never,
    });

    expect(teamAndOpponent.rows).toHaveLength(1);
    expect(teamAndOpponent.rows[0]).toMatchObject({
      teamId: 1,
      teamLabel: "FLA",
      gamesPlayed: 1,
    });
  });

  it("pages league-wide summary rows without dropping or repeating a team-game", async () => {
    const state = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026 });
    state.primary.displayMode = "counts";
    state.view.sort = { sortKey: "teamLabel", direction: "asc" };

    // One extra row ahead of 500 two-team games puts game 500's pair on both
    // sides of the 1,000-row page boundary.
    const summaryRows = [
      createSummaryRow({
        game_id: 3000,
        game_date: "2026-04-30",
        team_id: 1,
        opponent_team_id: 3,
      }),
    ];
    for (let index = 0; index < 500; index += 1) {
      const gameId = 2000 + index;
      const gameDate = new Date(Date.UTC(2025, 9, 1) + index * 3600 * 1000)
        .toISOString()
        .slice(0, 13);
      summaryRows.push(
        createSummaryRow({ game_id: gameId, game_date: gameDate, team_id: 1, opponent_team_id: 2 }),
        createSummaryRow({ game_id: gameId, game_date: gameDate, team_id: 2, opponent_team_id: 1 }),
      );
    }

    const response = await queryTeamStatsLanding({
      state,
      supabase: createMockSupabase({
        summaryRows,
        teams: [
          { id: 1, abbreviation: "FLA" },
          { id: 2, abbreviation: "BOS" },
        ],
      }) as never,
    });

    expect(
      Object.fromEntries(response.rows.map((row) => [row.teamLabel, row.gamesPlayed])),
    ).toEqual({ BOS: 500, FLA: 501 });
  });

  it("ignores zero-sample placeholder rows when aggregating team results", async () => {
    const state = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026 });
    state.primary.displayMode = "counts";
    state.view.sort = { sortKey: "points", direction: "desc" };

    const supabase = createMockSupabase({
      summaryRows: [
        createSummaryRow({
          game_id: 3001,
          game_date: "2025-11-01",
          team_id: 1,
          opponent_team_id: 9,
          toi_seconds: 1800,
          wins: 1,
          losses: 0,
          otl: 0,
          row_wins: 1,
          points: 2,
          cf: 20,
          ca: 10,
        }),
        createSummaryRow({
          game_id: 3002,
          game_date: "2025-11-03",
          team_id: 1,
          opponent_team_id: 8,
          toi_seconds: 0,
          wins: 1,
          losses: 0,
          otl: 0,
          row_wins: 1,
          points: 2,
          cf: 0,
          ca: 0,
          ff: 0,
          fa: 0,
          sf: 0,
          sa: 0,
          gf: 0,
          ga: 0,
          xgf: 0,
          xga: 0,
          scf: 0,
          sca: 0,
          scsf: 0,
          scsa: 0,
          scgf: 0,
          scga: 0,
          hdcf: 0,
          hdca: 0,
          hdsf: 0,
          hdsa: 0,
          hdgf: 0,
          hdga: 0,
          mdcf: 0,
          mdca: 0,
          mdsf: 0,
          mdsa: 0,
          mdgf: 0,
          mdga: 0,
          ldcf: 0,
          ldca: 0,
          ldsf: 0,
          ldsa: 0,
          ldgf: 0,
          ldga: 0,
        }),
        createSummaryRow({
          game_id: 3003,
          game_date: "2025-11-04",
          team_id: 3,
          opponent_team_id: 7,
          toi_seconds: 0,
          wins: 1,
          losses: 0,
          otl: 0,
          row_wins: 1,
          points: 2,
          cf: 0,
          ca: 0,
          ff: 0,
          fa: 0,
          sf: 0,
          sa: 0,
          gf: 0,
          ga: 0,
          xgf: 0,
          xga: 0,
          scf: 0,
          sca: 0,
          scsf: 0,
          scsa: 0,
          scgf: 0,
          scga: 0,
          hdcf: 0,
          hdca: 0,
          hdsf: 0,
          hdsa: 0,
          hdgf: 0,
          hdga: 0,
          mdcf: 0,
          mdca: 0,
          mdsf: 0,
          mdsa: 0,
          mdgf: 0,
          mdga: 0,
          ldcf: 0,
          ldca: 0,
          ldsf: 0,
          ldsa: 0,
          ldgf: 0,
          ldga: 0,
        }),
      ],
      teams: [
        { id: 1, abbreviation: "FLA" },
        { id: 3, abbreviation: "TBL" },
      ],
    });

    const response = await queryTeamStatsLanding({
      state,
      supabase: supabase as never,
    });

    expect(response.pagination.totalRows).toBe(1);
    expect(response.rows).toHaveLength(1);
    // Decision 92: under the default 5v5 split the record columns are hidden.
    expect(response.rows[0]).toMatchObject({
      teamId: 1,
      teamLabel: "FLA",
      gamesPlayed: 1,
      toiSeconds: 1800,
      points: null,
      wins: null,
      rowWins: null,
    });
  });
});

describe("applyOfficialRowOverrides", () => {
  const row = {
    teamId: 8,
    gamesPlayed: 3,
    toiSeconds: 10800,
    toiPerGameSeconds: 3600,
    wins: 1,
    losses: 1,
    otl: 1,
    gf: 7,
    ga: 11,
    sf: 80,
    sa: 90,
  } as never;
  const official = (gamesPlayed: number) => ({
    seasonSummaryByTeamId: new Map([
      [8, { teamId: 8, gamesPlayed, wins: 3, losses: 3, otLosses: 1, points: 7, goalsFor: 20, goalsAgainst: 25 }],
    ]),
    fiveOnFiveByTeamId: new Map([[8, { teamId: 8, gamesPlayed, satFor: 400, satAgainst: 380 }]]),
    shotTypeByTeamId: new Map(),
  }) as never;
  const stateFor = (strength: string) => {
    const state = createDefaultTeamLandingFilterState();
    return { ...state, primary: { ...state.primary, strength } } as never;
  };

  it.each(["allStrengths", "fiveOnFive"])(
    "keeps native %s values when official totals cover more games",
    (strength) => {
      const result = applyOfficialRowOverrides({ row, state: stateFor(strength), official: official(7) });
      expect(result).toEqual(row);
    }
  );

  it("applies official all-strength totals when game coverage matches", () => {
    const result = applyOfficialRowOverrides({
      row,
      state: stateFor("allStrengths"),
      official: official(3),
    });
    expect(result).toMatchObject({ gamesPlayed: 3, wins: 3, gf: 20, ga: 25 });
  });
});

describe("sortTeamStatsRows (W2-P0-7, rule 20)", () => {
  const rows = [
    { teamId: 1, teamLabel: "AAA", shPct: null },
    { teamId: 2, teamLabel: "BBB", shPct: 0.3 },
    { teamId: 3, teamLabel: "CCC", shPct: 0 },
    { teamId: 4, teamLabel: "DDD", shPct: 0.3 },
  ] as never[];

  it("puts nulls last in both directions with a stable tie-break", () => {
    expect(
      sortTeamStatsRows(rows, { sortKey: "shPct", direction: "desc" }).map((row: any) => row.teamLabel)
    ).toEqual(["BBB", "DDD", "CCC", "AAA"]);
    expect(
      sortTeamStatsRows(rows, { sortKey: "shPct", direction: "asc" }).map((row: any) => row.teamLabel)
    ).toEqual(["CCC", "BBB", "DDD", "AAA"]);
    expect(
      sortTeamStatsRows([...rows].reverse(), { sortKey: "shPct", direction: "desc" }).map(
        (row: any) => row.teamLabel
      )
    ).toEqual(["BBB", "DDD", "CCC", "AAA"]);
  });

  it("orders an all-null column by team label", () => {
    const allNull = rows.map((row: any) => ({ ...row, shPct: null })) as never[];
    expect(
      sortTeamStatsRows(allNull, { sortKey: "shPct", direction: "desc" }).map((row: any) => row.teamLabel)
    ).toEqual(["AAA", "BBB", "CCC", "DDD"]);
  });
});

describe("queryTeamStatsLanding season coverage (rule 19, contract nhl-game-state-v1)", () => {
  type GameRow = {
    id: number;
    seasonId: number;
    type: number;
    date: string;
    startTime: string;
    game_state: string | null;
    game_schedule_state: string | null;
    game_state_observed_at: string | null;
  };
  const game = (overrides: Partial<GameRow> & Pick<GameRow, "id">): GameRow => ({
    seasonId: 20252026,
    type: 2,
    date: "2026-04-01",
    startTime: "2026-04-01T23:00:00.000Z",
    game_state: null,
    game_schedule_state: null,
    game_state_observed_at: null,
    ...overrides,
  });
  // Both tables answer row pages (range) and exact head counts (awaited builder).
  const coverageClient = (games: GameRow[], summaryCount: number) => ({
    from(table: string) {
      const rows: Array<Record<string, unknown>> = table === "games" ? games : [];
      if (table !== "games" && table !== "team_underlying_stats_summary") {
        throw new Error(`Unexpected table: ${table}`);
      }
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      const matching = () => rows.filter((row) => filters.every((keep) => keep(row)));
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        lt: (column: string, value: string) => {
          filters.push((row) => String(row[column]) < value);
          return builder;
        },
        lte: (column: string, value: string) => {
          filters.push((row) => String(row[column]) <= value);
          return builder;
        },
        gte: (column: string, value: string) => {
          filters.push((row) => String(row[column]) >= value);
          return builder;
        },
        order: () => builder,
        range: async (from: number, to: number) => ({
          data: matching().slice(from, to + 1),
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data: null,
            error: null,
            count: table === "games" ? matching().length : summaryCount,
          }),
      };
      return builder;
    },
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts a game as completed by its stored state: a LIVE late game dated before today is not", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-04-03T03:30:00.000Z"));
    const supabase = coverageClient(
      [
        game({ id: 1, game_state: "FINAL", game_schedule_state: "OK",
          game_state_observed_at: "2026-04-02T02:00:00.000Z" }),
        // 10 pm ET start on Apr 2: dated before UTC today but still being played.
        game({ id: 2, date: "2026-04-02", startTime: "2026-04-03T02:00:00.000Z", game_state: "LIVE",
          game_schedule_state: "OK", game_state_observed_at: "2026-04-03T03:20:00.000Z" }),
        // No stored state: the labelled start + 8 h fallback decides.
        game({ id: 3 }),
        // Postponed: never completed.
        game({ id: 4, date: "2026-04-02", startTime: "2026-04-02T23:00:00.000Z", game_state: "FUT",
          game_schedule_state: "PPD", game_state_observed_at: "2026-04-02T20:00:00.000Z" }),
        game({ id: 5, date: "2026-04-03", startTime: "2026-04-03T23:00:00.000Z", game_state: "FUT",
          game_schedule_state: "OK", game_state_observed_at: "2026-04-03T03:00:00.000Z" }),
      ],
      2
    );
    const state = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026, pageSize: 50 });

    const response = await queryTeamStatsLanding({ state, supabase: supabase as never });

    expect(response.coverage).toEqual({ completedGames: 2, summarizedGames: 1 });
  });
});

describe("queryTeamStatsLanding reader contracts", () => {
  const allSituations = () => {
    const state = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026, pageSize: 2 });
    state.primary.strength = "allStrengths";
    state.primary.displayMode = "counts";
    return state;
  };
  const allRow = (overrides: Partial<MockSummaryRow>) =>
    createSummaryRow({ strength: "allStrengths", ...overrides });

  it("sorts nulls last before paginating, so page 1 is never all nulls (W2-P0-7)", async () => {
    const state = allSituations();
    state.view.sort = { sortKey: "shPct", direction: "desc" };
    const supabase = createMockSupabase({
      summaryRows: [
        allRow({ game_id: 1, team_id: 1, sf: 0, gf: 0 }),
        allRow({ game_id: 2, team_id: 2, sf: 10, gf: 1 }),
        allRow({ game_id: 3, team_id: 3, sf: 10, gf: 3 }),
      ],
      teams: [
        { id: 1, abbreviation: "AAA" },
        { id: 2, abbreviation: "BBB" },
        { id: 3, abbreviation: "CCC" },
      ],
    });
    const response = await queryTeamStatsLanding({ state, supabase: supabase as never });
    expect(response.rows.map((row) => row.teamLabel)).toEqual(["CCC", "BBB"]);
    expect(response.pagination.totalRows).toBe(3);
  });

  it("selects each team's own last N games by date, not league game id (decision 95)", async () => {
    const state = allSituations();
    state.expandable.scope = { kind: "gameRange", value: 1 };
    const supabase = createMockSupabase({
      summaryRows: [
        // Team 1: id 200 is dated Nov 9, id 100 is dated Nov 10 (the later game).
        allRow({ game_id: 200, game_date: "2025-11-09", team_id: 1, cf: 5 }),
        allRow({ game_id: 100, game_date: "2025-11-10", team_id: 1, cf: 50 }),
        // Team 2 played only earlier; it keeps its own last game.
        allRow({ game_id: 50, game_date: "2025-11-01", team_id: 2, cf: 7 }),
      ],
      teams: [
        { id: 1, abbreviation: "AAA" },
        { id: 2, abbreviation: "BBB" },
      ],
    });
    state.view.pagination = { page: 1, pageSize: 50 };
    const response = await queryTeamStatsLanding({ state, supabase: supabase as never });
    const byTeam = new Map(response.rows.map((row) => [row.teamId, row]));
    expect(byTeam.get(1)).toMatchObject({ gamesPlayed: 1, cf: 50 });
    expect(byTeam.get(2)).toMatchObject({ gamesPlayed: 1, cf: 7 });
  });

  it("drops an unresolved game from the record and the point-% denominator (W2-3 D12)", async () => {
    const state = allSituations();
    const supabase = createMockSupabase({
      summaryRows: [
        allRow({ game_id: 1, team_id: 1, wins: 1, losses: 0, otl: 0, row_wins: 1, points: 2 }),
        allRow({ game_id: 2, team_id: 1, wins: 0, losses: 0, otl: 0, row_wins: 0, points: 0 }),
      ],
      teams: [{ id: 1, abbreviation: "AAA" }],
    });
    const response = await queryTeamStatsLanding({ state, supabase: supabase as never });
    expect(response.rows[0]).toMatchObject({ gamesPlayed: 2, points: 2, pointPct: 1, unresolvedGames: 1 });
  });

  it("keeps a window rate unknown when one game's ice time is unknown (W2-3 DR3, rule 13)", async () => {
    const state = allSituations();
    state.primary.displayMode = "rates";
    const supabase = createMockSupabase({
      summaryRows: [
        allRow({ game_id: 1, team_id: 1, toi_seconds: 1200, cf: 1 }),
        allRow({ game_id: 2, team_id: 1, toi_seconds: null as never, cf: 1 }),
      ],
      teams: [{ id: 1, abbreviation: "AAA" }],
    });
    const response = await queryTeamStatsLanding({ state, supabase: supabase as never });
    expect(response.rows[0]).toMatchObject({ toiSeconds: null, cfPer60: null, toiPerGameSeconds: null });
  });

  it("gives tied sort values one competition rank (W2-3 D17)", async () => {
    const state = allSituations();
    state.view.sort = { sortKey: "cf", direction: "desc" };
    state.view.pagination = { page: 1, pageSize: 50 };
    const supabase = createMockSupabase({
      summaryRows: [
        allRow({ game_id: 1, team_id: 1, cf: 10 }),
        allRow({ game_id: 2, team_id: 2, cf: 10 }),
        allRow({ game_id: 3, team_id: 3, cf: 5 }),
      ],
      teams: [
        { id: 1, abbreviation: "AAA" },
        { id: 2, abbreviation: "BBB" },
        { id: 3, abbreviation: "CCC" },
      ],
    });
    const response = await queryTeamStatsLanding({ state, supabase: supabase as never });
    expect(response.rows.map((row) => [row.teamLabel, row.rank])).toEqual([
      ["AAA", 1],
      ["BBB", 1],
      ["CCC", 3],
    ]);
  });
});

describe("applyOfficialRowOverrides source mixing (W2-2 D12)", () => {
  it("never pairs official 5v5 shots for with native shots against", () => {
    const state = createDefaultTeamLandingFilterState();
    // Native 5v5: SF 5, SA 4, GF 1. Official 5v5 reports 6 shots for over the same games.
    const nativeRow = {
      teamId: 8,
      gamesPlayed: 3,
      toiSeconds: 9000,
      cf: 50,
      ca: 40,
      ff: 40,
      fa: 30,
      sf: 5,
      sa: 4,
      gf: 1,
      ga: 1,
      sfPct: 5 / 9,
      shPct: 0.2,
      svPct: 0.75,
    } as never;
    const result = applyOfficialRowOverrides({
      row: nativeRow,
      state: { ...state, primary: { ...state.primary, strength: "fiveOnFive" } } as never,
      official: {
        seasonSummaryByTeamId: new Map(),
        fiveOnFiveByTeamId: new Map([
          [8, { teamId: 8, gamesPlayed: 3, satFor: 52, satAgainst: 41, usatFor: 41, usatAgainst: 31, shots5v5: 6 }],
        ]),
        shotTypeByTeamId: new Map(),
      } as never,
    });
    // Mixed: 6 / (6 + 4) = 0.6. Same-source native: 5 / 9.
    expect(result).toMatchObject({ cf: 52, ca: 41, sf: 5, sfPct: 5 / 9, shPct: 0.2, officialOverlay: "fiveOnFive" });
  });
});

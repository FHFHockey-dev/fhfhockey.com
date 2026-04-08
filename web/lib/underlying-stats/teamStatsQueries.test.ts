import { describe, expect, it } from "vitest";

import { createDefaultTeamLandingFilterState } from "./teamStatsFilters";
import {
  parseTeamLandingApiRequest,
  queryTeamStatsLanding,
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
  toi_seconds: number;
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

  return {
    from(table: string) {
      if (table === "team_underlying_stats_summary") {
        const eqFilters = new Map<string, unknown>();
        const gteFilters = new Map<string, number | string>();
        const lteFilters = new Map<string, number | string>();

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
          order() {
            return this;
          },
          async range(from: number, to: number) {
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

            return {
              data: filtered.slice(from, to + 1),
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
    expect(response.rows[0]).toMatchObject({
      teamId: 1,
      teamLabel: "FLA",
      gamesPlayed: 1,
      toiSeconds: 1800,
      points: 2,
      wins: 1,
      rowWins: 1,
    });
  });
});
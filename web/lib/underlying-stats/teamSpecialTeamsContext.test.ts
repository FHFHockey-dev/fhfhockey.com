import { describe, expect, it } from "vitest";

import {
  fetchUnderlyingStatsTeamSpecialTeamsContext,
  poolTeamSpecialTeams,
  rankSpecialTeamsCompetition,
  type WgoSpecialTeamsGameRow,
} from "./teamSpecialTeamsContext";

const game = (
  overrides: Partial<WgoSpecialTeamsGameRow>
): WgoSpecialTeamsGameRow => ({
  team_id: 1,
  franchise_name: null,
  date: "2026-10-10",
  game_id: 2026020001,
  season_id: 20262027,
  power_play_goals_for: 0,
  pp_opportunities: 0,
  pp_goals_against: 0,
  times_shorthanded: 0,
  power_play_pct: null,
  penalty_kill_pct: null,
  ...overrides,
});

describe("poolTeamSpecialTeams (W2-P0-6, decision 20 pooled by opportunity)", () => {
  it("pools Σ PPG ÷ Σ PPO and 1 − Σ PPGA ÷ Σ TSH, not the mean of game percentages", () => {
    // Game A: 1/1 PP, 0/1 PK goals; game B: 0/4 PP, 2/4 PK goals.
    // Pooled PP = 1/5 = 0.2; mean of game PP% = (1 + 0)/2 = 0.5.
    // Pooled PK = 1 − 2/5 = 0.6; mean of game PK% = (1 + 0.5)/2 = 0.75.
    const pooled = poolTeamSpecialTeams([
      game({ game_id: 2026020001, power_play_goals_for: 1, pp_opportunities: 1, pp_goals_against: 0, times_shorthanded: 1 }),
      game({ game_id: 2026020002, power_play_goals_for: 0, pp_opportunities: 4, pp_goals_against: 2, times_shorthanded: 4 }),
    ]);
    expect(pooled.ppPct).toBeCloseTo(0.2, 10);
    expect(pooled.pkPct).toBeCloseTo(0.6, 10);
    expect(pooled.ppOpportunities).toBe(5);
    expect(pooled.timesShorthanded).toBe(5);
    expect(pooled.games).toBe(2);
  });

  it("keeps an unknown game count unknown instead of zero", () => {
    const pooled = poolTeamSpecialTeams([
      game({ game_id: 2026020001, power_play_goals_for: 1, pp_opportunities: 3, pp_goals_against: 1, times_shorthanded: 2 }),
      game({ game_id: 2026020002, power_play_goals_for: null, pp_opportunities: 2, pp_goals_against: 0, times_shorthanded: null }),
    ]);
    expect(pooled.ppPct).toBeNull();
    expect(pooled.pkPct).toBeNull();
  });

  it("returns null, not 0, with no opportunities or no games", () => {
    expect(poolTeamSpecialTeams([]).ppPct).toBeNull();
    expect(poolTeamSpecialTeams([game({})]).ppPct).toBeNull();
    expect(poolTeamSpecialTeams([game({})]).pkPct).toBeNull();
  });

  it("counts a game once when the table repeats it", () => {
    const row = game({ power_play_goals_for: 1, pp_opportunities: 2, pp_goals_against: 0, times_shorthanded: 1 });
    expect(poolTeamSpecialTeams([row, { ...row }]).ppOpportunities).toBe(2);
  });
});

describe("rankSpecialTeamsCompetition (PR-U5, rule 20)", () => {
  it("gives tied teams the same competition rank, independent of input order, nulls unranked", () => {
    const values = new Map<string, number | null>([
      ["AAA", 0.2],
      ["BBB", 0.25],
      ["CCC", 0.2],
      ["DDD", null],
      ["EEE", 0.1],
    ]);
    const ranks = rankSpecialTeamsCompetition(values);
    expect(Object.fromEntries(ranks)).toEqual({ BBB: 1, AAA: 2, CCC: 2, EEE: 4, DDD: null });
    const reversed = rankSpecialTeamsCompetition(new Map([...values.entries()].reverse()));
    expect(Object.fromEntries(reversed)).toEqual(Object.fromEntries(ranks));
  });
});

type QueryLog = { table: string; filters: Array<[string, string, unknown]> };

function mockSupabase(tables: Record<string, unknown[]>, log: QueryLog[]) {
  return {
    from(table: string) {
      const entry: QueryLog = { table, filters: [] };
      log.push(entry);
      let rows = [...(tables[table] ?? [])] as Array<Record<string, unknown>>;
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          entry.filters.push(["eq", column, value]);
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        lte: (column: string, value: any) => {
          entry.filters.push(["lte", column, value]);
          rows = rows.filter((row) => (row[column] as any) <= value);
          return builder;
        },
        gte: (column: string, value: any) => {
          entry.filters.push(["gte", column, value]);
          rows = rows.filter((row) => (row[column] as any) >= value);
          return builder;
        },
        order: (column: string, options?: { ascending?: boolean }) => {
          const sign = options?.ascending === false ? -1 : 1;
          rows = [...rows].sort((left, right) =>
            (left[column] as any) < (right[column] as any)
              ? -sign
              : (left[column] as any) > (right[column] as any)
                ? sign
                : 0
          );
          return builder;
        },
        limit: (count: number) => {
          rows = rows.slice(0, count);
          return builder;
        },
        range: (from: number, to: number) =>
          Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return builder;
    },
  } as any;
}

describe("fetchUnderlyingStatsTeamSpecialTeamsContext (served landing PP%/PK%)", () => {
  const seasons = [
    { id: 20252026, startDate: "2025-10-07", endDate: "2026-06-20", regularSeasonEndDate: "2026-04-16" },
    { id: 20262027, startDate: "2026-10-06", endDate: "2027-06-20", regularSeasonEndDate: "2027-04-15" },
  ];
  const teams = [
    { id: 1, abbreviation: "NJD", name: "New Jersey Devils" },
    { id: 2, abbreviation: "NYI", name: "New York Islanders" },
    { id: 3, abbreviation: "NYR", name: "New York Rangers" },
  ];
  const wgoRows = [
    // NJD: latest game 0/0 PP (null power_play_pct), season 2/8.
    game({ team_id: 1, date: "2026-10-12", game_id: 2026020030, power_play_goals_for: 0, pp_opportunities: 0, pp_goals_against: 0, times_shorthanded: 0, power_play_pct: null, penalty_kill_pct: null }),
    game({ team_id: 1, date: "2026-10-10", game_id: 2026020010, power_play_goals_for: 2, pp_opportunities: 8, pp_goals_against: 1, times_shorthanded: 4, power_play_pct: 0.25, penalty_kill_pct: 0.75 }),
    // NYI: one game this season, 1/2 PP.
    game({ team_id: 2, date: "2026-10-11", game_id: 2026020020, power_play_goals_for: 1, pp_opportunities: 2, pp_goals_against: 0, times_shorthanded: 3, power_play_pct: 0.5, penalty_kill_pct: 1 }),
    // NYR: no game yet this season; last season's game must not be borrowed.
    game({ team_id: 3, date: "2026-04-10", game_id: 2025021300, season_id: 20252026, power_play_goals_for: 3, pp_opportunities: 3, pp_goals_against: 0, times_shorthanded: 2, power_play_pct: 1, penalty_kill_pct: 1 }),
  ];

  it("serves pooled season-to-date rates, null for no data, competition ranks", async () => {
    const log: QueryLog[] = [];
    const supabase = mockSupabase({ wgo_team_stats: wgoRows, teams, seasons }, log);
    const context = await fetchUnderlyingStatsTeamSpecialTeamsContext("2026-10-12", supabase);

    // Current code: NJD reads its latest game (null → 0, ranked last); fixed: 2/8 = 25%.
    expect(context.get("NJD")?.ppPct).toBeCloseTo(25, 10);
    expect(context.get("NJD")?.pkPct).toBeCloseTo(75, 10);
    expect(context.get("NYI")?.ppPct).toBeCloseTo(50, 10);
    expect(context.get("NYI")?.ppRank).toBe(1);
    expect(context.get("NJD")?.ppRank).toBe(2);
    // NYR has no game in 2026-27: unknown, not last season's 100%.
    expect(context.get("NYR")?.ppPct ?? null).toBeNull();
    expect(context.get("NYR")?.ppRank ?? null).toBeNull();
    expect(
      log.some(
        (entry) =>
          entry.table === "wgo_team_stats" &&
          entry.filters.some(([, column, value]) => column === "season_id" && value === 20262027)
      )
    ).toBe(true);
  });
});

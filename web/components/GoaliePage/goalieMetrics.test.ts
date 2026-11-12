import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GoalieRanking } from "./goalieTypes";
import {
  GOALIE_ADVANCED_STRENGTH_OPTIONS,
  applyGoalieValueTiers,
  buildGoalieAdvancedMetricsRows,
  buildGoalieMetricsGroups,
  buildGoalieValueTierMap,
  buildGoalieVarianceAverages,
  fetchGoalieAdvancedMetricsRows,
  formatGoalieVarianceValue,
  getGoalieLeaderboardColumns,
} from "./goalieMetrics";
import {
  formatAdvancedMetricNumber,
  formatAdvancedMetricPercent,
  sortAdvancedMetricRows,
} from "./GoalieAdvancedMetricsTable";
import GoalieAdvancedMetricsTable from "./GoalieAdvancedMetricsTable";
import GoalieLeaderboard from "./GoalieLeaderboard";

const makeGoalie = (
  playerId: number,
  overrides: Partial<GoalieRanking>,
): GoalieRanking =>
  ({
    playerId,
    goalieFullName: `Goalie ${playerId}`,
    team: "FLA",
    totalPoints: 10,
    weekCounts: { Elite: 1, Good: 1, Average: 1, Bad: 0, Abysmal: 0 },
    totalGamesPlayed: 5,
    totalGamesStarted: 4,
    totalWins: 3,
    totalLosses: 1,
    totalOtLosses: 0,
    totalSaves: 120,
    totalShotsAgainst: 130,
    totalGoalsAgainst: 10,
    totalShutouts: 1,
    totalTimeOnIce: 300,
    overallSavePct: 0.923,
    overallGaa: 2.0,
    averageFantasyPointsPerGame: 15,
    fantasyPointsAboveAverage: 1,
    wowVariance: 3,
    gogVariance: 2,
    percentGoodWeeks: 50,
    percentAcceptableWeeks: 75,
    averagePercentileRank: 60,
    ...overrides,
  }) as GoalieRanking;

describe("getGoalieLeaderboardColumns", () => {
  it("keeps the variance columns sortable in relative mode", () => {
    const columns = getGoalieLeaderboardColumns("relative");
    const wowColumn = columns.find((column) => column.label === "WoW Δ vs Avg");
    const gameColumn = columns.find(
      (column) => column.label === "Game Δ vs Avg",
    );

    expect(wowColumn?.sortKey).toBe("wowVariance");
    expect(gameColumn?.sortKey).toBe("gogVariance");
    expect(wowColumn?.infoTitle).toContain("filtered average");
    expect(gameColumn?.infoTitle).toContain("filtered average");
  });

  it("sorts Value Tier by the computed tier score", () => {
    const columns = getGoalieLeaderboardColumns("raw");
    const tierColumn = columns.find((column) => column.label === "Value Tier");

    expect(tierColumn?.sortKey).toBe("valueTierScore");
  });
});

describe("goalie relative variance helpers", () => {
  it("computes filtered averages for the two variance columns only", () => {
    const averages = buildGoalieVarianceAverages([
      makeGoalie(1, { wowVariance: 2, gogVariance: 4 }),
      makeGoalie(2, { wowVariance: 4, gogVariance: 8 }),
      makeGoalie(3, { wowVariance: undefined, gogVariance: undefined }),
    ]);

    expect(averages).toEqual({
      wowVariance: 3,
      gogVariance: 6,
    });
  });

  it("formats raw and relative variance values with stable missing fallback", () => {
    expect(formatGoalieVarianceValue(4, 3, "raw")).toBe("4.00");
    expect(formatGoalieVarianceValue(4, 3, "relative")).toBe("+1.00");
    expect(formatGoalieVarianceValue(2, 3, "relative")).toBe("-1.00");
    expect(formatGoalieVarianceValue(undefined, 3, "relative")).toBe("N/A");
    expect(formatGoalieVarianceValue(2, null, "relative")).toBe("N/A");
  });
});

describe("buildGoalieValueTierMap", () => {
  it("is deterministic for the same filtered population", () => {
    const goalies = [
      makeGoalie(1, {
        averageFantasyPointsPerGame: 19,
        fantasyPointsAboveAverage: 4,
        wowVariance: 1.4,
        gogVariance: 1.1,
        totalGamesPlayed: 8,
        totalGamesStarted: 7,
        totalPoints: 28,
      }),
      makeGoalie(2, {
        averageFantasyPointsPerGame: 15,
        fantasyPointsAboveAverage: 1,
        wowVariance: 3.2,
        gogVariance: 2.4,
        totalGamesPlayed: 5,
        totalGamesStarted: 4,
        totalPoints: 16,
      }),
      makeGoalie(3, {
        averageFantasyPointsPerGame: 9,
        fantasyPointsAboveAverage: -3,
        wowVariance: 5.1,
        gogVariance: 3.8,
        totalGamesPlayed: 3,
        totalGamesStarted: 2,
        totalPoints: 7,
      }),
    ];

    // Floor lowered to 1 start (decision 98) so goalie 2 (4 GS) is tiered.
    const first = buildGoalieValueTierMap(goalies, [], 1);
    const second = buildGoalieValueTierMap(goalies, [], 1);

    expect(first.get(2)).toBeDefined();
    expect(first.get(2)).toEqual(second.get(2));
  });

  it("changes the score when the filtered population changes", () => {
    const fullPopulation = [
      makeGoalie(1, {
        averageFantasyPointsPerGame: 19,
        fantasyPointsAboveAverage: 4,
        wowVariance: 1.4,
        gogVariance: 1.1,
        totalGamesPlayed: 8,
        totalGamesStarted: 7,
        totalPoints: 28,
      }),
      makeGoalie(2, {
        averageFantasyPointsPerGame: 15,
        fantasyPointsAboveAverage: 1,
        wowVariance: 3.2,
        gogVariance: 2.4,
        totalGamesPlayed: 5,
        totalGamesStarted: 4,
        totalPoints: 16,
      }),
      makeGoalie(3, {
        averageFantasyPointsPerGame: 9,
        fantasyPointsAboveAverage: -3,
        wowVariance: 5.1,
        gogVariance: 3.8,
        totalGamesPlayed: 3,
        totalGamesStarted: 2,
        totalPoints: 7,
      }),
    ];

    const subsetPopulation = fullPopulation.slice(0, 2);
    // Floor lowered to 1 start (decision 98) so goalies 2 and 3 are tiered.
    const fullScore = buildGoalieValueTierMap(fullPopulation, [], 1).get(2)?.score;
    const subsetScore = buildGoalieValueTierMap(subsetPopulation, [], 1).get(2)?.score;

    expect(fullScore).not.toBe(subsetScore);
  });

  it("uses QS% in start-confidence scoring when advanced metrics are available", () => {
    const goalies = [
      makeGoalie(1, {
        averageFantasyPointsPerGame: 14,
        fantasyPointsAboveAverage: 0,
        wowVariance: 2,
        gogVariance: 2,
        totalGamesPlayed: 5,
        totalGamesStarted: 5,
        percentAcceptableWeeks: 60,
        totalTimeOnIce: 300,
      }),
      makeGoalie(2, {
        averageFantasyPointsPerGame: 14,
        fantasyPointsAboveAverage: 0,
        wowVariance: 2,
        gogVariance: 2,
        totalGamesPlayed: 5,
        totalGamesStarted: 5,
        percentAcceptableWeeks: 60,
        totalTimeOnIce: 300,
      }),
    ];

    const withoutAdvanced = buildGoalieValueTierMap(goalies);
    const withAdvanced = buildGoalieValueTierMap(goalies, [
      {
        playerId: 1,
        goalieName: "Goalie 1",
        gamesPlayed: 5,
        gamesStarted: 5,
        qualityStartsPct: 1,
        strengths: {} as never,
      },
      {
        playerId: 2,
        goalieName: "Goalie 2",
        gamesPlayed: 5,
        gamesStarted: 5,
        qualityStartsPct: 0.2,
        strengths: {} as never,
      },
    ]);

    expect(withAdvanced.get(1)?.score).toBeGreaterThan(
      withoutAdvanced.get(1)?.score ?? 0,
    );
    expect(withAdvanced.get(2)?.score).toBeLessThan(
      withoutAdvanced.get(2)?.score ?? 100,
    );
  });

  it("applies tier label and numeric score to ranking rows", () => {
    const [goalie] = applyGoalieValueTiers([
      makeGoalie(1, {
        averageFantasyPointsPerGame: 19,
        fantasyPointsAboveAverage: 4,
        wowVariance: 1.4,
        gogVariance: 1.1,
        totalGamesPlayed: 8,
        totalGamesStarted: 7,
        totalTimeOnIce: 420,
      }),
    ]);

    expect(goalie.valueTier).toMatch(/^Tier [1-5]$/);
    expect(goalie.valueTierScore).toEqual(expect.any(Number));
  });
});

describe("buildGoalieMetricsGroups", () => {
  it("returns the four metrics cards with directionally honest helper copy", () => {
    const groups = buildGoalieMetricsGroups([
      makeGoalie(1, {
        averageFantasyPointsPerGame: 19,
        fantasyPointsAboveAverage: 4,
        wowVariance: 1.4,
        gogVariance: 1.1,
        totalGamesPlayed: 8,
        totalGamesStarted: 7,
        totalTimeOnIce: 420,
        totalPoints: 28,
        percentGoodWeeks: 80,
      }),
      makeGoalie(2, {
        averageFantasyPointsPerGame: 15,
        fantasyPointsAboveAverage: 1,
        wowVariance: 3.2,
        gogVariance: 2.4,
        totalGamesPlayed: 5,
        totalGamesStarted: 4,
        totalTimeOnIce: 300,
        totalPoints: 16,
        percentGoodWeeks: 50,
      }),
    ]);

    expect(groups).toHaveLength(4);
    expect(groups[1].rows[0].metricLabelTitle).toContain(
      "Lower combined standard deviation is better",
    );
    expect(groups[2].rows[0].metricLabelTitle).toContain(
      "Higher workload suggests",
    );
  });
});

describe("buildGoalieAdvancedMetricsRows", () => {
  it("exposes the documented strength prefixes and labels", () => {
    expect(GOALIE_ADVANCED_STRENGTH_OPTIONS).toEqual([
      { value: "all", label: "All Situations", prefix: "nst_all_counts" },
      { value: "5v5", label: "5v5", prefix: "nst_5v5_counts" },
      { value: "ev", label: "Even Strength", prefix: "nst_ev_counts" },
      { value: "pk", label: "PK", prefix: "nst_pk_counts" },
      { value: "pp", label: "PP", prefix: "nst_pp_counts" },
    ]);
  });

  it("aggregates goalie stats rows and preserves missing advanced values as null", () => {
    const rows = buildGoalieAdvancedMetricsRows([
      {
        player_id: 1,
        player_name: "Goalie 1",
        games_played: 1,
        games_started: 1,
        quality_start: 1,
        nst_all_counts_toi: 60,
        nst_all_counts_gsaa: 2,
        nst_all_counts_xg_against: 3,
        nst_all_counts_hd_shots_against: 6,
        nst_all_counts_shots_against: 30,
        nst_all_counts_rebound_attempts_against: 4,
        nst_all_counts_rush_attempts_against: 2,
        nst_all_counts_avg_shot_distance: 34,
        nst_all_counts_avg_goal_distance: 18,
        nst_all_counts_goals_against: 2,
      },
      {
        player_id: 1,
        player_name: "Goalie 1",
        games_played: 1,
        games_started: 1,
        quality_start: 0,
        nst_all_counts_toi: 30,
        nst_all_counts_gsaa: null,
        nst_all_counts_xg_against: 1,
        nst_all_counts_hd_shots_against: 2,
        nst_all_counts_shots_against: 10,
        nst_all_counts_rebound_attempts_against: 1,
        nst_all_counts_rush_attempts_against: 1,
        nst_all_counts_avg_shot_distance: 42,
        nst_all_counts_avg_goal_distance: 24,
        nst_all_counts_goals_against: 1,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].qualityStartsPct).toBe(0.5);
    // Decision 10: a lone goalie is the whole league here, so GSAA at the
    // window aggregate is 0 (the old sum of per-game NST GSAA gave 2).
    expect(rows[0].strengths.all.gsaa).toBeCloseTo(0, 10);
    expect(rows[0].strengths.all.xgAgainst).toBe(4);
    expect(rows[0].strengths.all.xgAgainstPer60).toBeCloseTo(2.67, 2);
    expect(rows[0].strengths.all.shotsAgainstPer60).toBeCloseTo(26.67, 2);
    expect(rows[0].strengths.all.avgShotDistance).toBe(36);
    expect(rows[0].strengths.all.avgGoalDistance).toBe(20);
    expect(rows[0].strengths["5v5"].gsaa).toBeNull();
    expect(rows[0].strengths["5v5"].shotsAgainstPer60).toBeNull();
  });
});

describe("sortAdvancedMetricRows", () => {
  it("formats advanced metric numbers and missing values safely", () => {
    expect(formatAdvancedMetricNumber(1.234)).toBe("1.23");
    expect(formatAdvancedMetricNumber(null)).toBe("N/A");
    expect(formatAdvancedMetricNumber(Number.NaN)).toBe("N/A");
    expect(formatAdvancedMetricPercent(0.625)).toBe("62.5%");
    expect(formatAdvancedMetricPercent(undefined as never)).toBe("N/A");
  });

  it("sorts advanced metric rows while keeping missing values last", () => {
    const rows = buildGoalieAdvancedMetricsRows([
      {
        player_id: 1,
        player_name: "Goalie 1",
        games_played: 1,
        games_started: 1,
        nst_all_counts_toi: 60,
        nst_all_counts_xg_against: null,
      },
      {
        player_id: 2,
        player_name: "Goalie 2",
        games_played: 1,
        games_started: 1,
        nst_all_counts_toi: 60,
        nst_all_counts_xg_against: 1,
      },
      {
        player_id: 3,
        player_name: "Goalie 3",
        games_played: 1,
        games_started: 1,
        nst_all_counts_toi: 60,
        nst_all_counts_xg_against: 3,
      },
    ]);

    expect(
      sortAdvancedMetricRows(rows, "xgAgainst", "descending", "all").map(
        (row) => row.playerId,
      ),
    ).toEqual([3, 2, 1]);
    expect(
      sortAdvancedMetricRows(rows, "xgAgainst", "ascending", "all").map(
        (row) => row.playerId,
      ),
    ).toEqual([2, 3, 1]);
  });
});

describe("goalie sortable table semantics", () => {
  it("renders native sort buttons and active aria-sort state", () => {
    const leaderboardMarkup = renderToStaticMarkup(
      React.createElement(GoalieLeaderboard, {
        goalieRankings: [makeGoalie(1, {})],
        sortConfig: { key: "totalPoints", direction: "descending" },
        requestSort: () => undefined,
      }),
    );
    const advancedMarkup = renderToStaticMarkup(
      React.createElement(GoalieAdvancedMetricsTable, { rows: [] }),
    );

    expect(leaderboardMarkup).toContain("<button");
    expect(leaderboardMarkup).toContain('aria-sort="descending"');
    expect(advancedMarkup).toContain("<button");
    expect(advancedMarkup).toContain('aria-sort="descending"');
  });
});

// W2-2 D6 / decision 10: GSAA = SA x (1 - league SV%) - GA over the window.
// League SA 100, GA 8 -> SV .920. Goalie 1: 50 x .08 - 5 = -1; goalie 2:
// 50 x .08 - 3 = +1. The per-game NST values sum to -0.5 and +0.9.
describe("advanced goalie GSAA at the window aggregate", () => {
  const game = (
    playerId: number,
    shots: number,
    goals: number,
    nstGsaa: number,
  ) => ({
    player_id: playerId,
    player_name: `Goalie ${playerId}`,
    games_played: 1,
    games_started: 1,
    quality_start: 1,
    nst_all_counts_toi: 60,
    nst_all_counts_shots_against: shots,
    nst_all_counts_goals_against: goals,
    nst_all_counts_gsaa: nstGsaa,
    nst_all_counts_xg_against: 2,
  });

  it("computes GSAA from pooled SA and GA against the window's league SV%", () => {
    const rows = buildGoalieAdvancedMetricsRows([
      game(1, 30, 2, 0.7),
      game(1, 20, 3, -1.2),
      game(2, 25, 1, 0.8),
      game(2, 25, 2, 0.1),
    ]);
    const byId = new Map(rows.map((row) => [row.playerId, row]));
    expect(byId.get(1)?.strengths.all.gsaa).toBeCloseTo(-1, 10);
    expect(byId.get(2)?.strengths.all.gsaa).toBeCloseTo(1, 10);

    const markup = renderToStaticMarkup(
      React.createElement(GoalieAdvancedMetricsTable, {
        rows,
        strength: "all",
      }),
    );
    expect(markup).toContain("-1.00");
    expect(markup).not.toContain("-0.50");
  });

  it("leaves GSAA unknown when a game lacks shots or goals against", () => {
    const rows = buildGoalieAdvancedMetricsRows([
      game(1, 30, 2, 0.7),
      { ...game(1, 20, 3, -1.2), nst_all_counts_goals_against: null },
      game(2, 25, 1, 0.8),
    ]);
    expect(rows.find((row) => row.playerId === 1)?.strengths.all.gsaa).toBeNull();
  });
});

// PR-U2: two 60-minute starts, xGA [3, null], QS [1, null]. Full-window values
// are unknown; the old reader showed xGA/60 1.5 and QS% 0.5.
describe("advanced goalie coverage", () => {
  it("keeps xGA/60 and QS% unknown when one start is missing them", () => {
    const [row] = buildGoalieAdvancedMetricsRows([
      {
        player_id: 7,
        player_name: "Goalie 7",
        games_played: 1,
        games_started: 1,
        quality_start: 1,
        nst_all_counts_toi: 60,
        nst_all_counts_xg_against: 3,
      },
      {
        player_id: 7,
        player_name: "Goalie 7",
        games_played: 1,
        games_started: 1,
        quality_start: null,
        nst_all_counts_toi: 60,
        nst_all_counts_xg_against: null,
      },
    ]);
    expect(row.strengths.all.xgAgainstPer60).toBeNull();
    expect(row.qualityStartsPct).toBeNull();
  });
});

// PR-U1: the advanced rows follow the applied window and are paged.
describe("fetchGoalieAdvancedMetricsRows", () => {
  it("filters by season and window and pages until a short page", async () => {
    const calls: Array<Array<[string, unknown[]]>> = [];
    const pages = [
      [{ player_id: 1 }, { player_id: 2 }],
      [{ player_id: 3 }],
    ];
    const client = {
      from: (table: string) => {
        const log: Array<[string, unknown[]]> = [["from", [table]]];
        calls.push(log);
        const builder: Record<string, unknown> = {};
        for (const method of ["select", "eq", "gte", "lte", "order"]) {
          builder[method] = (...args: unknown[]) => {
            log.push([method, args]);
            return builder;
          };
        }
        builder.range = (...args: unknown[]) => {
          log.push(["range", args]);
          return Promise.resolve({ data: pages[calls.length - 1], error: null });
        };
        return builder;
      },
    };

    const rows = await fetchGoalieAdvancedMetricsRows(
      client,
      20252026,
      { startDate: "2025-11-03", endDate: "2025-11-09" },
      2,
    );

    expect(rows.map((row) => row.player_id)).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        ["eq", ["season_id", 20252026]],
        ["gte", ["date", "2025-11-03"]],
        ["lte", ["date", "2025-11-09"]],
        ["range", [0, 1]],
      ]),
    );
    expect(calls[1]).toEqual(expect.arrayContaining([["range", [2, 3]]]));
  });
});

// W2-2 D9 / decision 98: a single game or week has unknown spread, and the
// value tier needs the (user-lowerable) start floor.
describe("value tier sample floor", () => {
  const regulars = [7, 6, 5].map((starts, index) =>
    makeGoalie(index + 1, {
      averageFantasyPointsPerGame: 10 + index,
      fantasyPointsAboveAverage: index - 1,
      wowVariance: 2 + index,
      gogVariance: 3 + index,
      totalGamesPlayed: starts,
      totalGamesStarted: starts,
    }),
  );
  const singleton = makeGoalie(9, {
    averageFantasyPointsPerGame: 25,
    fantasyPointsAboveAverage: 12,
    wowVariance: null,
    gogVariance: null,
    totalGamesPlayed: 1,
    totalGamesStarted: 1,
    totalTimeOnIce: 60,
  });

  it("never tiers a one-game goalie, even with the floor lowered to 1", () => {
    for (const floor of [undefined, 1]) {
      const tiered = applyGoalieValueTiers([...regulars, singleton], [], floor);
      const goalie = tiered.find((entry) => entry.playerId === 9)!;
      expect(goalie.valueTier).toBeUndefined();
      expect(goalie.valueTierInsufficientSample).toBe(true);
    }
  });

  it("tiers a 4-start goalie only after the floor is lowered to 4", () => {
    const fourStarts = makeGoalie(4, { totalGamesPlayed: 4, totalGamesStarted: 4 });
    const atDefault = applyGoalieValueTiers([...regulars, fourStarts]);
    expect(atDefault.find((g) => g.playerId === 4)?.valueTier).toBeUndefined();
    const lowered = applyGoalieValueTiers([...regulars, fourStarts], [], 4);
    expect(lowered.find((g) => g.playerId === 4)?.valueTier).toMatch(/^Tier [1-5]$/);
  });

  it("renders insufficient sample and graded weeks on the leaderboard", () => {
    const tiered = applyGoalieValueTiers([
      ...regulars.map((goalie) => ({ ...goalie, eligibleWeeks: 3 })),
      { ...singleton, eligibleWeeks: 1 },
    ]);
    const markup = renderToStaticMarkup(
      React.createElement(GoalieLeaderboard, { goalieRankings: tiered }),
    );
    expect(markup).toContain("Insufficient sample");
    expect(markup).toContain(">Wks");
  });
});

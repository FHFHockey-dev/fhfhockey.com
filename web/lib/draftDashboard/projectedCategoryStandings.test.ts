import { describe, expect, it } from "vitest";

import { aggregateTeamCategoryTotals, rankTeamCategories } from "./categoryStandings";
import { categoryStandingsLeader, projectCategoryStandings } from "./projectedCategoryStandings";

const skater = (stats: Record<string, number>) => ({
  displayPosition: "C",
  combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])),
});
const goalie = (stats: Record<string, number>) => ({ ...skater(stats), displayPosition: "G" });

describe("projected category standings (decision 114)", () => {
  it("ranks starting-slot totals per category with shared points for ties and ratio-aware GAA", () => {
    const totals = (players: ReturnType<typeof skater>[]) =>
      Object.fromEntries(
        Object.entries(aggregateTeamCategoryTotals(players, ["GOALS", "GOALS_AGAINST_AVERAGE"])).map(
          ([key, aggregate]) => [key, aggregate.value],
        ),
      );
    // GAA from team totals: A 100 GA / 50 h = 2.0, B 150 / 50 h = 3.0, C 2.5.
    const teams = [
      { teamId: "A", starterTotals: totals([skater({ GOALS: 30 }), goalie({ GOALS_AGAINST_GOALIE: 100, TOTAL_TOI: 180000 })]) },
      { teamId: "B", starterTotals: totals([skater({ GOALS: 30 }), goalie({ GOALS_AGAINST_GOALIE: 150, TOTAL_TOI: 180000 })]) },
      { teamId: "C", starterTotals: totals([skater({ GOALS: 20 }), goalie({ GOALS_AGAINST_GOALIE: 125, TOTAL_TOI: 180000 })]) },
    ];
    const result = projectCategoryStandings(teams, { GOALS: 1, GOALS_AGAINST_AVERAGE: 1 });

    expect(result.complete).toBe(true);
    // GOALS: A and B share 3 and 2 → 2.5 each; C 1. GAA (lower better): A 3, C 2, B 1.
    expect(result.standings.map((team) => [team.teamId, team.points])).toEqual([
      ["A", 5.5],
      ["B", 3.5],
      ["C", 3],
    ]);
    expect(categoryStandingsLeader(result)).toEqual({ teamId: "A", points: 5.5, tiedWith: ["A"] });
  });

  it("withholds standings and the winner when a team's category total is unknown", () => {
    const teams = [
      { teamId: "A", starterTotals: { GOALS: 30 } },
      { teamId: "B", starterTotals: { GOALS: null } },
    ];
    const result = projectCategoryStandings(teams, { GOALS: 1 });
    expect(result.complete).toBe(false);
    expect(result.unknownCategories).toEqual(["GOALS"]);
    expect(result.standings.every((team) => team.points === null)).toBe(true);
    expect(categoryStandingsLeader(result)).toBeNull();
  });
});

describe("category standings readers (audit BC W1-12 D6, W2-5 §4.2)", () => {
  it("honours a reversed category weight in standings the same way the category score does", () => {
    const ranks = rankTeamCategories(
      [
        { teamId: "low", categoryTotals: { GOALS_AGAINST_AVERAGE: 2 } },
        { teamId: "high", categoryTotals: { GOALS_AGAINST_AVERAGE: 4 } },
      ],
      { GOALS_AGAINST_AVERAGE: -1 },
      "categories",
    );
    expect(ranks.high.GOALS_AGAINST_AVERAGE).toBe(1);
    expect(ranks.low.GOALS_AGAINST_AVERAGE).toBe(2);
  });

  it("keeps a team counting total unknown when a skater's projection is missing", () => {
    const totals = aggregateTeamCategoryTotals(
      [skater({ GOALS: 30 }), skater({}), goalie({ WINS_GOALIE: 20 })],
      ["GOALS", "WINS_GOALIE"],
    );
    expect(totals.GOALS).toEqual({ value: null, quality: "unavailable" });
    // Goalies do not carry skater categories: their absence is not missing data.
    expect(totals.WINS_GOALIE).toEqual({ value: 20, quality: "exact-from-projected-inputs" });
  });
});

import { validateDraftSettings } from "./settingsValidation";

describe("settings validation accepts a league's reversed category direction (BC W1-12 D6)", () => {
  it("does not reject a negative category weight that every reader treats as reversed", () => {
    const result = validateDraftSettings({
      settings: {
        teamCount: 2,
        draftOrder: ["Team 1", "Team 2"],
        leagueType: "categories",
        scoringCategories: { GOALS: 1 },
        categoryWeights: { GOALS: 1, GOALS_AGAINST_AVERAGE: -1 },
        rosterConfig: { C: 1, G: 1, bench: 1, utility: 0 },
        draftOrderMode: "snake",
      },
      myTeamId: "Team 1",
      goalieScoring: { WINS_GOALIE: 4 },
      skaterSources: { dtz_skaters: { isSelected: true, weight: 1 } },
      goalieSources: { dtz_goalies: { isSelected: true, weight: 1 } },
    } as any);
    expect(result.domains.scoring).toBe(true);
  });
});

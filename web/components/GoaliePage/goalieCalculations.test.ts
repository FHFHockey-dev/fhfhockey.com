import { describe, expect, it } from "vitest";

import type { GoalieWeeklyAggregate, LeagueWeeklyAverage } from "./goalieTypes";
import {
  buildGoalieConsistencySummary,
  buildLeagueWeeklyAverage,
  calculateGoalieRankings,
  calculateStandardDeviation,
  calculateWeeklyRanking,
  classifyGoalieWeekPercentage,
  isGoalieWeekEligible,
} from "./goalieCalculations";

const baseGoalieWeekStat = {
  weekly_gp: 2,
  weekly_gs: 2,
  weekly_wins: 2,
  weekly_losses: 0,
  weekly_ot_losses: 0,
  weekly_saves: 64,
  weekly_sa: 66,
  weekly_ga: 2,
  weekly_so: 1,
  weekly_toi_seconds: 2400,
  weekly_sv_pct: 0.97,
  weekly_gaa: 0.3,
  weekly_saves_per_60: null,
  weekly_sa_per_60: null,
} as GoalieWeeklyAggregate;

const baseLeagueAverage = {
  avg_league_weekly_gp: 1,
  avg_league_weekly_gs: 1,
  avg_league_weekly_wins: 1,
  avg_league_weekly_losses: 1,
  avg_league_weekly_ot_losses: 0,
  avg_league_weekly_saves: 30,
  avg_league_weekly_sa: 32,
  avg_league_weekly_ga: 3,
  avg_league_weekly_so: 0,
  avg_league_weekly_toi_seconds: 1800,
  avg_league_weekly_sv_pct: 0.9,
  avg_league_weekly_gaa: 2.5,
  avg_league_weekly_saves_per_60: 0,
  avg_league_weekly_sa_per_60: 0,
} as LeagueWeeklyAverage;

describe("calculateStandardDeviation", () => {
  it("uses sample standard deviation", () => {
    expect(calculateStandardDeviation([1, 2, 3, 4])).toBeCloseTo(1.29099, 5);
  });

  // W2-2 D9: one game or week has no observed spread; 0 read as "perfectly consistent".
  it("is unknown (null) for one or zero samples", () => {
    expect(calculateStandardDeviation([])).toBeNull();
    expect(calculateStandardDeviation([5])).toBeNull();
  });
});

describe("calculateWeeklyRanking", () => {
  const goalieWeekStat = baseGoalieWeekStat;
  const leagueAverage = baseLeagueAverage;

  const statColumns = [
    {
      label: "W",
      value: "wins",
      dbFieldGoalie: "weekly_wins",
      dbFieldAverage: "avg_league_weekly_wins",
    },
    {
      label: "GA",
      value: "goalsAgainst",
      dbFieldGoalie: "weekly_ga",
      dbFieldAverage: "avg_league_weekly_ga",
    },
  ] as const;

  it("returns the strongest possible ranking when every selected stat beats average", () => {
    const result = calculateWeeklyRanking(
      goalieWeekStat,
      leagueAverage,
      ["wins", "goalsAgainst"],
      statColumns as unknown as never,
    );

    expect(result).toEqual({
      ranking: "Elite",
      percentage: 100,
      points: 20,
    });
  });

  it("falls back to Average when no stats are selected", () => {
    expect(
      calculateWeeklyRanking(
        goalieWeekStat,
        leagueAverage,
        [],
        statColumns as unknown as never,
      ),
    ).toEqual({
      ranking: "Average",
      percentage: 0,
      points: 5,
    });
  });
});

describe("strong-v1 weekly goalie contract", () => {
  it("requires a start and at least 20 minutes before classifying a week", () => {
    expect(isGoalieWeekEligible(baseGoalieWeekStat)).toBe(true);
    expect(
      isGoalieWeekEligible({
        ...baseGoalieWeekStat,
        weekly_gs: 0,
        weekly_toi_seconds: 2400,
      }),
    ).toBe(false);
    expect(
      isGoalieWeekEligible({
        ...baseGoalieWeekStat,
        weekly_gs: 1,
        weekly_toi_seconds: 1199,
      }),
    ).toBe(false);
  });

  it("returns the requested bands at their exact comparison boundaries", () => {
    expect([80, 60, 45, 30, 29.9].map(classifyGoalieWeekPercentage)).toEqual([
      "Elite",
      "Good",
      "Average",
      "Bad",
      "Abysmal",
    ]);
  });

  it("summarizes stability, starts per week, and common weekly records", () => {
    const summary = buildGoalieConsistencySummary(
      [
        {
          ranking: "Elite",
          weeklyStats: {
            ...baseGoalieWeekStat,
            weekly_gs: 5,
            weekly_wins: 3,
            weekly_losses: 1,
            weekly_ot_losses: 1,
          },
        },
        {
          ranking: "Good",
          weeklyStats: {
            ...baseGoalieWeekStat,
            weekly_gs: 3,
            weekly_wins: 2,
            weekly_losses: 1,
            weekly_ot_losses: 0,
          },
        },
        {
          ranking: "Good",
          weeklyStats: {
            ...baseGoalieWeekStat,
            weekly_gs: 1,
            weekly_wins: 1,
            weekly_losses: 0,
            weekly_ot_losses: 0,
          },
        },
        {
          ranking: "Elite",
          weeklyStats: {
            ...baseGoalieWeekStat,
            weekly_gs: 5,
            weekly_wins: 3,
            weekly_losses: 2,
            weekly_ot_losses: 0,
          },
        },
      ],
      1,
    );

    expect(summary.eligibleWeeks).toBe(4);
    expect(summary.unclassifiedWeeks).toBe(1);
    expect(summary.consistencyScore).toBe(75);
    expect(summary.averageStartsPerWeek).toBe(3.5);
    expect(summary.weeklyRecordPatterns).toEqual([
      { record: "3-2", wins: 3, losses: 2, count: 2 },
      { record: "2-1", wins: 2, losses: 1, count: 1 },
      { record: "1-0", wins: 1, losses: 0, count: 1 },
    ]);
  });
});

// W2-2 D8 / decision 97 / PR-U4, proven at the leaderboard builder: weekly
// NHL API rows -> starter week bar -> calculateGoalieRankings week counts.
describe("goalie week tiers against the starter week bar", () => {
  const savesColumn = [
    {
      label: "SV",
      value: "saves",
      dbFieldGoalie: "weekly_saves",
      dbFieldAverage: "avg_league_weekly_saves",
    },
    {
      label: "SV%",
      value: "savePct",
      dbFieldGoalie: "weekly_sv_pct",
      dbFieldAverage: "avg_league_weekly_sv_pct",
    },
  ] as never;
  const settings = { goalAgainst: -1, save: 0.2, shutout: 3, win: 4 };
  const apiRow = (saves: number, gamesStarted: number, timeOnIce: number) => ({
    gamesPlayed: 1,
    gamesStarted,
    wins: 0,
    losses: 0,
    otLosses: 0,
    saves,
    shotsAgainst: saves + 2,
    goalsAgainst: 2,
    shutouts: 0,
    timeOnIce,
  });
  const weekRow = (goalieId: number, saves: number, svPct: number | null) =>
    ({
      ...baseGoalieWeekStat,
      week: 1,
      goalie_id: goalieId,
      goalie_name: `Goalie ${goalieId}`,
      weekly_gs: 1,
      weekly_toi_seconds: 3600,
      weekly_saves: saves,
      weekly_sv_pct: svPct,
    }) as GoalieWeeklyAggregate;
  const gameRow = (goalieId: number, saves: number) => ({
    goalie_id: goalieId,
    goalie_name: `Goalie ${goalieId}`,
    date: "2025-10-08",
    games_played: 1,
    games_started: 1,
    saves,
    goals_against: 2,
    shots_against: saves + 2,
    time_on_ice: 3600,
  });
  const rank = (
    weekRows: GoalieWeeklyAggregate[],
    league: LeagueWeeklyAverage | null,
    statKeys: string[],
  ) =>
    calculateGoalieRankings(
      weekRows,
      league ? [league] : [],
      weekRows.map((row) => gameRow(row.goalie_id!, row.weekly_saves ?? 0)) as never,
      statKeys as never,
      savesColumn,
      1,
      1,
      settings,
    );

  it("builds the bar from starters only, so a relief stint does not lower it", () => {
    // Starters 28 and 24 saves average 26; a 600 s relief stint with 2 saves
    // would pull the all-goalie mean to 18 and make 24 saves look better.
    const league = buildLeagueWeeklyAverage(
      [apiRow(28, 1, 3600), apiRow(24, 1, 3600), apiRow(2, 0, 600)],
      1,
      "2025",
    );
    expect(league?.avg_league_weekly_saves).toBe(26);

    const [goalie] = rank([weekRow(2, 24, 0.9)], league, ["saves"]);
    expect(goalie.weekCounts.Abysmal).toBe(1);
    expect(goalie.weekCounts.Elite).toBe(0);
  });

  it("gives a tie half credit, so an all-tied week is Average", () => {
    const league = buildLeagueWeeklyAverage(
      [apiRow(26, 1, 3600), apiRow(26, 1, 3600)],
      1,
      "2025",
    );
    const [goalie] = rank([weekRow(1, 26, 0.9)], league, ["saves"]);
    expect(goalie.weekCounts).toMatchObject({ Average: 1, Elite: 0, Abysmal: 0 });
    expect(goalie.eligibleWeeks).toBe(1);
  });

  it("leaves a week with no comparable stat unclassified, not Abysmal", () => {
    const league = buildLeagueWeeklyAverage(
      [apiRow(26, 1, 3600), apiRow(20, 1, 3600)],
      1,
      "2025",
    );
    const [goalie] = rank([weekRow(1, 26, null)], league, ["savePct"]);
    expect(goalie.weekCounts.Abysmal).toBe(0);
    expect(goalie.unclassifiedWeeks).toBe(1);
    expect(goalie.eligibleWeeks).toBe(0);
    expect(goalie.totalPoints).toBe(0);
  });

  it("returns an unknown SV% bar for a starter population with no shots", () => {
    const league = buildLeagueWeeklyAverage(
      [{ ...apiRow(0, 1, 3600), shotsAgainst: 0, goalsAgainst: 0 }],
      1,
      "2025",
    );
    expect(league?.avg_league_weekly_sv_pct).toBeNull();
  });
});

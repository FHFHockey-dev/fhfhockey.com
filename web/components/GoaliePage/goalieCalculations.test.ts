import { describe, expect, it } from "vitest";

import type { GoalieWeeklyAggregate, LeagueWeeklyAverage } from "./goalieTypes";
import {
  buildGoalieConsistencySummary,
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

  it("returns zero for one or zero samples", () => {
    expect(calculateStandardDeviation([])).toBe(0);
    expect(calculateStandardDeviation([5])).toBe(0);
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

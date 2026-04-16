import { describe, expect, it } from "vitest";

import {
  buildSkaterAdvancedMetricsRows,
  buildSkaterMetricsRows,
  withSkaterMetricsBucketAverages,
  withSkaterValueOverviewBucketAverages
} from "./skaterMetrics";
import type {
  SkaterBucket,
  SkaterGameRow,
  SkaterValueOverviewRow,
  SkaterWeeklyAggregate
} from "./skaterTypes";

const bucket: SkaterBucket = {
  key: "ownership-30-39",
  label: "30-39%",
  kind: "ownership",
  sortOrder: 30
};

const weeklyAggregates: SkaterWeeklyAggregate[] = [
  {
    playerId: 1,
    playerName: "Skater A",
    team: "BOS",
    position: "C",
    week: { key: "2025:1", startDate: "2025-10-06", endDate: "2025-10-12" },
    gamesPlayed: 2,
    fantasyPoints: 10,
    fantasyPointsPerGame: 5,
    ownershipAverage: 34,
    adp: 25,
    percentDrafted: 0.9,
    bucket
  }
];

const gameRows: SkaterGameRow[] = [
  {
    player_id: 1,
    player_name: "Skater A",
    team_abbrev: "BOS",
    date: "2025-10-06",
    games_played: 1,
    goals: 1,
    assists: 1,
    points: 2,
    shots: 5,
    pp_goals: 1,
    pp_assists: 0,
    pp_points: 1,
    pp_toi: 120,
    hits: 2,
    blocked_shots: 1,
    penalty_minutes: 2,
    plus_minus: 1,
    toi_per_game: 1200,
    individual_sat_for_per_60: 8
  },
  {
    player_id: 1,
    player_name: "Skater A",
    team_abbrev: "BOS",
    date: "2025-10-08",
    games_played: 1,
    goals: 0,
    assists: 2,
    points: 2,
    shots: 3,
    pp_goals: 0,
    pp_assists: 1,
    pp_points: 1,
    pp_toi: 180,
    hits: 1,
    blocked_shots: 2,
    penalty_minutes: 0,
    plus_minus: -1,
    toi_per_game: 1080,
    individual_sat_for_per_60: 10
  }
];

describe("buildSkaterMetricsRows", () => {
  it("aggregates standard skater metrics", () => {
    const rows = buildSkaterMetricsRows(gameRows, weeklyAggregates, "ownership");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerName: "Skater A",
      team: "BOS",
      valuation: 34,
      gamesPlayed: 2,
      goals: 1,
      assists: 3,
      points: 4,
      shots: 8,
      powerPlayGoals: 1,
      powerPlayAssists: 1,
      powerPlayPoints: 2,
      hits: 3,
      blocks: 3,
      penaltyMinutes: 2,
      plusMinus: 0
    });
    expect(rows[0].averageTimeOnIce).toBe(1140);
    expect(rows[0].shootingPercentage).toBeCloseTo(0.125);
  });

  it("adds metrics bucket average rows", () => {
    const rows = withSkaterMetricsBucketAverages(
      buildSkaterMetricsRows(gameRows, weeklyAggregates, "ownership")
    );

    expect(rows.some((row) => row.rowType === "bucket-average")).toBe(true);
  });
});

describe("buildSkaterAdvancedMetricsRows", () => {
  it("calculates per-60 values and leaves unavailable NST values null", () => {
    const rows = buildSkaterAdvancedMetricsRows(
      gameRows,
      weeklyAggregates,
      "ownership"
    );

    expect(rows[0].pointsPer60).toBeCloseTo(6.32, 2);
    expect(rows[0].corsiForPer60).toBe(9);
    expect(rows[0].individualPointPercentage).toBeNull();
    expect(rows[0].individualExpectedGoalsPer60).toBeNull();
  });
});

describe("withSkaterValueOverviewBucketAverages", () => {
  it("adds value overview bucket average rows", () => {
    const valueRows: SkaterValueOverviewRow[] = [
      {
        rowType: "player",
        playerId: 1,
        playerName: "Skater A",
        team: "BOS",
        tier: bucket.label,
        valuation: 34,
        valuationLabel: "OWN%",
        bucket,
        weekCounts: {
          Elite: 1,
          Quality: 0,
          Average: 1,
          Bad: 0,
          "Really Bad": 0
        },
        percentOkWeeks: 100,
        percentGoodWeeks: 50,
        weeklyVariance: 1,
        gameToGameVariance: 2,
        averageFantasyPointsPerGame: 5,
        averageFantasyPointsPerWeek: 10,
        fantasyPointsAboveAverage: 2,
        gamesPlayed: 2,
        totalFantasyPoints: 20
      }
    ];

    expect(
      withSkaterValueOverviewBucketAverages(valueRows).some(
        (row) => row.rowType === "bucket-average"
      )
    ).toBe(true);
  });
});


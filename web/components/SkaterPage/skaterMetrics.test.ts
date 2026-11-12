import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildSkaterAdvancedMetricsRows,
  buildSkaterMetricsRows,
  withSkaterMetricsBucketAverages,
  withSkaterValueOverviewBucketAverages
} from "./skaterMetrics";
import { resolveTableRows } from "./SkaterTable";
import SkaterTable from "./SkaterTable";
import SkaterAdvancedMetricsTable from "./SkaterAdvancedMetricsTable";
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
  it("calculates per-60 values from pooled counts and TOI", () => {
    const rows = buildSkaterAdvancedMetricsRows(
      gameRows,
      weeklyAggregates,
      "ownership"
    );

    expect(rows[0].pointsPer60).toBeCloseTo(6.32, 2);
  });

  // W2-P0-8 / decision 73: two games with unequal 5v5 TOI. Attempts are
  // 8 x 600/3600 = 1.333 and 20 x 1200/3600 = 6.667, so pooled iCF/60 is
  // 8 / 1800 s x 3600 = 16; the mean of game rates would be 14.
  const icfRows: SkaterGameRow[] = [
    {
      ...gameRows[0],
      individual_sat_for_per_60: 8,
      toi_per_game_5v5: 600
    },
    {
      ...gameRows[1],
      individual_sat_for_per_60: 20,
      toi_per_game_5v5: 1200
    }
  ];

  it("pools individual attempts over matched 5v5 TOI and renders iCF/60 (5v5)", () => {
    const rows = buildSkaterAdvancedMetricsRows(
      icfRows,
      weeklyAggregates,
      "ownership"
    );
    expect(rows[0].individualCorsiForPer60At5v5).toBeCloseTo(16, 10);

    const markup = renderToStaticMarkup(
      React.createElement(SkaterAdvancedMetricsTable, { rows })
    );
    expect(markup).toContain("iCF/60 (5v5)");
    expect(markup).toContain("<td>16.00</td>");
    expect(markup).not.toContain(">CF/60");
    expect(markup).not.toContain("IPP");
    expect(markup).not.toContain("iXG/60");
  });

  it("shows iCF/60 as unknown when one game lacks 5v5 TOI", () => {
    const rows = buildSkaterAdvancedMetricsRows(
      [icfRows[0], { ...icfRows[1], toi_per_game_5v5: null }],
      weeklyAggregates,
      "ownership"
    );
    expect(rows[0].individualCorsiForPer60At5v5).toBeNull();
  });

  // W2-3 A3: two one-goal games, TOI 1,200 s and unknown. The rate over the
  // full window is unknown; keeping both goals over 1,200 s gives 6 G/60.
  it("leaves per-60 rates unknown when a game's TOI is unknown", () => {
    const rows = buildSkaterAdvancedMetricsRows(
      [
        { ...gameRows[0], goals: 1, toi_per_game: 1200 },
        { ...gameRows[1], goals: 1, toi_per_game: null }
      ],
      weeklyAggregates,
      "ownership"
    );
    expect(rows[0].goalsPer60).toBeNull();
    expect(rows[0].pointsPer60).toBeNull();

    const markup = renderToStaticMarkup(
      React.createElement(SkaterAdvancedMetricsTable, { rows })
    );
    expect(markup).not.toContain("<td>6.00</td>");
  });

  it("leaves a per-60 rate unknown when a game's count is unknown", () => {
    const rows = buildSkaterAdvancedMetricsRows(
      [
        { ...gameRows[0], hits: 3 },
        { ...gameRows[1], hits: null }
      ],
      weeklyAggregates,
      "ownership"
    );
    expect(rows[0].hitsPer60).toBeNull();
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

  it("sorts each week-rating column independently and keeps bucket averages attached", () => {
    const baseRow: SkaterValueOverviewRow = {
      rowType: "player",
      playerId: 1,
      playerName: "Elite-heavy",
      team: "BOS",
      tier: bucket.label,
      valuation: 34,
      valuationLabel: "OWN%",
      bucket,
      weekCounts: {
        Elite: 5,
        Quality: 1,
        Average: 0,
        Bad: 0,
        "Really Bad": 0
      },
      percentOkWeeks: 100,
      percentGoodWeeks: 100,
      weeklyVariance: 1,
      gameToGameVariance: 1,
      averageFantasyPointsPerGame: 5,
      averageFantasyPointsPerWeek: 10,
      fantasyPointsAboveAverage: 2,
      gamesPlayed: 6,
      totalFantasyPoints: 60
    };
    const rows = withSkaterValueOverviewBucketAverages([
      baseRow,
      {
        ...baseRow,
        playerId: 2,
        playerName: "Quality-heavy",
        weekCounts: { ...baseRow.weekCounts, Elite: 1, Quality: 4 }
      }
    ]);

    const sorted = resolveTableRows(
      rows,
      "weekCounts.Quality",
      "descending"
    ).sortedRows;

    expect(sorted.map((row) => row.playerName)).toEqual([
      "Quality-heavy",
      "Elite-heavy",
      "30-39% Avg"
    ]);
  });

  it("uses keyboard-operable sort buttons and formats advanced ownership as a percent", () => {
    const advancedRows = buildSkaterAdvancedMetricsRows(
      gameRows,
      weeklyAggregates,
      "ownership"
    );
    const tableMarkup = renderToStaticMarkup(
      React.createElement(SkaterTable, {
        rows: [],
        variant: "value",
        sortKey: "weekCounts.Quality",
        sortDirection: "descending",
        onSort: () => undefined
      })
    );
    const advancedMarkup = renderToStaticMarkup(
      React.createElement(SkaterAdvancedMetricsTable, {
        rows: advancedRows
      })
    );

    expect(tableMarkup).toContain('<button');
    expect(tableMarkup).toContain('aria-sort="descending"');
    expect(advancedMarkup).toContain("34.0%");
  });
});

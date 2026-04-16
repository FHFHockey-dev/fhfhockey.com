import { describe, expect, it } from "vitest";

import {
  buildSkaterBucketWeeklyAverages,
  buildSkaterValueOverviewRows,
  buildSkaterWeeklyAggregates,
  calculateSkaterGameFantasyPoints,
  calculateWeeklyOwnershipAverage,
  classifySkaterWeek,
  getAdpBucket,
  getOwnershipBucket,
  getWeeklyOwnershipValue
} from "./skaterCalculations";
import {
  DEFAULT_SELECTED_SKATER_SCORING_KEYS,
  DEFAULT_SKATER_SCORING_SETTINGS
} from "./skaterMetrics";
import type {
  SkaterBucketWeeklyAverage,
  SkaterGameRow,
  SkaterGameWithFantasyPoints,
  SkaterWeek,
  YahooSkaterRow
} from "./skaterTypes";

const week: SkaterWeek = {
  key: "2025:1",
  season: "2025",
  weekNumber: 1,
  startDate: "2025-10-06",
  endDate: "2025-10-12"
};

describe("calculateSkaterGameFantasyPoints", () => {
  it("uses default selected skater scoring categories", () => {
    const row = {
      goals: 1,
      assists: 2,
      pp_points: 1,
      shots: 5,
      hits: 3,
      blocked_shots: 2
    } as SkaterGameRow;

    expect(
      calculateSkaterGameFantasyPoints(
        row,
        DEFAULT_SKATER_SCORING_SETTINGS,
        DEFAULT_SELECTED_SKATER_SCORING_KEYS
      )
    ).toBeCloseTo(10.1);
  });

  it("supports custom scoring categories and point values", () => {
    expect(
      calculateSkaterGameFantasyPoints(
        { penalty_minutes: 4, plus_minus: -1 } as SkaterGameRow,
        { PENALTY_MINUTES: 0.5, PLUS_MINUS: 1 },
        ["PENALTY_MINUTES", "PLUS_MINUS"]
      )
    ).toBe(1);
  });
});

describe("ownership buckets", () => {
  it("averages ownership timeline entries inside a week", () => {
    expect(
      calculateWeeklyOwnershipAverage(
        [
          { date: "2025-10-05", value: 20 },
          { date: "2025-10-06", value: 30 },
          { date: "2025-10-08", value: 40 },
          { date: "2025-10-13", value: 80 }
        ],
        week
      )
    ).toBe(35);
  });

  it("falls back to closest prior ownership and then current ownership", () => {
    expect(
      getWeeklyOwnershipValue(
        {
          player_id: "1",
          ownership_timeline: [{ date: "2025-10-05", value: 22 }],
          percent_ownership: 55
        },
        week
      )
    ).toBe(22);

    expect(
      getWeeklyOwnershipValue(
        {
          player_id: "1",
          ownership_timeline: [],
          percent_ownership: 55
        },
        week
      )
    ).toBe(55);
  });

  it("handles ownership bucket boundaries", () => {
    expect(getOwnershipBucket(0).label).toBe("0-9%");
    expect(getOwnershipBucket(9).label).toBe("0-9%");
    expect(getOwnershipBucket(10).label).toBe("10-19%");
    expect(getOwnershipBucket(99).label).toBe("90-100%");
    expect(getOwnershipBucket(100).label).toBe("90-100%");
  });
});

describe("ADP buckets", () => {
  it("converts ADP to 12-team round buckets", () => {
    expect(getAdpBucket(1, 1).label).toBe("1st Rd");
    expect(getAdpBucket(13, 1).label).toBe("2nd Rd");
    expect(getAdpBucket(25, 1).label).toBe("3rd Rd");
  });

  it("labels missing ADP as WW and low percent drafted as LOW %D", () => {
    expect(getAdpBucket(null, null).label).toBe("WW");
    expect(getAdpBucket(8, 0.4, 0.5).label).toBe("LOW %D");
  });
});

describe("weekly aggregation and ratings", () => {
  const yahooRows: YahooSkaterRow[] = [
    {
      player_id: "1",
      ownership_timeline: [{ date: "2025-10-06", value: 31 }],
      draft_analysis: { average_pick: "25", percent_drafted: "0.9" }
    },
    {
      player_id: "2",
      ownership_timeline: [{ date: "2025-10-06", value: 32 }],
      draft_analysis: { average_pick: "26", percent_drafted: "0.9" }
    },
    {
      player_id: "3",
      ownership_timeline: [{ date: "2025-10-06", value: 33 }],
      draft_analysis: { average_pick: "27", percent_drafted: "0.9" }
    }
  ];

  it("aggregates weekly fantasy points and bucket averages", () => {
    const rows: SkaterGameWithFantasyPoints[] = [
      {
        player_id: 1,
        player_name: "A",
        date: "2025-10-06",
        games_played: 1,
        fantasyPoints: 12
      },
      {
        player_id: 1,
        player_name: "A",
        date: "2025-10-08",
        games_played: 1,
        fantasyPoints: 8
      },
      {
        player_id: 2,
        player_name: "B",
        date: "2025-10-06",
        games_played: 1,
        fantasyPoints: 10
      },
      {
        player_id: 3,
        player_name: "C",
        date: "2025-10-06",
        games_played: 1,
        fantasyPoints: 16
      }
    ];

    const aggregates = buildSkaterWeeklyAggregates(rows, {
      valuationMode: "ownership",
      yahooRows,
      matchupWeeks: [week]
    });
    const averages = buildSkaterBucketWeeklyAverages(aggregates);

    expect(aggregates.find((row) => row.playerId === 1)).toMatchObject({
      gamesPlayed: 2,
      fantasyPoints: 20,
      fantasyPointsPerGame: 10
    });
    expect(averages[0]).toMatchObject({
      playerCount: 3,
      averageFantasyPoints: expect.any(Number)
    });
  });

  it("classifies weeks using standard deviation bands", () => {
    const average = {
      playerCount: 3,
      averageFantasyPoints: 10,
      weeklyStandardDeviation: 2
    } as SkaterBucketWeeklyAverage;

    expect(classifySkaterWeek(13, average)).toBe("Elite");
    expect(classifySkaterWeek(11, average)).toBe("Quality");
    expect(classifySkaterWeek(10, average)).toBe("Average");
    expect(classifySkaterWeek(9, average)).toBe("Bad");
    expect(classifySkaterWeek(7, average)).toBe("Really Bad");
  });

  it("falls back to Average for low-sample buckets", () => {
    const average = {
      playerCount: 2,
      averageFantasyPoints: 10,
      weeklyStandardDeviation: 2
    } as SkaterBucketWeeklyAverage;

    expect(classifySkaterWeek(99, average)).toBe("Average");
  });

  it("assembles value overview rows", () => {
    const rows = buildSkaterValueOverviewRows(
      [
        {
          player_id: 1,
          player_name: "A",
          date: "2025-10-06",
          games_played: 1,
          goals: 1
        },
        {
          player_id: 2,
          player_name: "B",
          date: "2025-10-06",
          games_played: 1,
          goals: 0
        },
        {
          player_id: 3,
          player_name: "C",
          date: "2025-10-06",
          games_played: 1,
          goals: 2
        }
      ],
      {
        valuationMode: "adp",
        scoringSettings: { GOALS: 3 },
        selectedScoringKeys: ["GOALS"],
        yahooRows,
        matchupWeeks: [week],
        minimumPercentDrafted: 0.5,
        averageComparisonBasis: "weekly"
      }
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      rowType: "player",
      valuationLabel: "ADP",
      gamesPlayed: 1
    });
  });
});

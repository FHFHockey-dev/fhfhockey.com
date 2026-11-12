import { describe, expect, it } from "vitest";

import type { RatingWeightsConfig, RawStatsCollection } from "components/WiGO/types";
import {
  calculatePlayerRatings,
  WIGO_RATING_MIN_COHORT_PEERS,
  wigoPositionGroup,
  wigoSpecialTeamsCohortOptions,
  type WigoPositionGroup
} from "./calculateWigoRatings";

const TEST_WEIGHTS: RatingWeightsConfig = {
  as: {
    offense: [{ stat: "total_points_per_60", weight: 1, higherIsBetter: true }],
    defense: [{ stat: "xga_per_60", weight: 1, higherIsBetter: false }]
  },
  es: {
    offense: [{ stat: "total_points_per_60", weight: 1, higherIsBetter: true }],
    defense: [{ stat: "xga_per_60", weight: 1, higherIsBetter: false }]
  },
  pp: {
    offense: [{ stat: "gf_per_60", weight: 1, higherIsBetter: true }],
    defense: []
  },
  pk: {
    offense: [],
    defense: [{ stat: "ga_per_60", weight: 1, higherIsBetter: false }]
  }
};

describe("calculatePlayerRatings", () => {
  it("keeps the selected player in the cohort when minGp excludes them", () => {
    const rawStats: RawStatsCollection = {
      as: {
        offense: [
          { player_id: 1, season: 20242025, gp: 5, toi_seconds: 500, total_points_per_60: 4 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, total_points_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, total_points_per_60: 1 }
        ],
        defense: [
          { player_id: 1, season: 20242025, gp: 5, toi_seconds: 500, xga_per_60: 1 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, xga_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, xga_per_60: 3 }
        ]
      },
      es: {
        offense: [
          { player_id: 1, season: 20242025, gp: 5, toi_seconds: 500, total_points_per_60: 4 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, total_points_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, total_points_per_60: 1 }
        ],
        defense: [
          { player_id: 1, season: 20242025, gp: 5, toi_seconds: 500, xga_per_60: 1 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, xga_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, xga_per_60: 3 }
        ]
      },
      pp: {
        offense: [
          { player_id: 1, season: 20242025, gp: 2, toi_seconds: 100, gf_per_60: 8 },
          { player_id: 2, season: 20242025, gp: 10, toi_seconds: 50, gf_per_60: 4 }
        ],
        defense: []
      },
      pk: {
        offense: [],
        defense: [
          { player_id: 1, season: 20242025, gp: 1, toi_seconds: 50, ga_per_60: 1 },
          { player_id: 2, season: 20242025, gp: 10, toi_seconds: 50, ga_per_60: 2 }
        ]
      }
    };

    const ratings = calculatePlayerRatings(
      1,
      rawStats,
      TEST_WEIGHTS,
      { enabled: false, minGPThreshold: 10 },
      10
    );

    expect(ratings?.offense.as).toBeCloseTo(83.33, 2);
    expect(ratings?.defense.as).toBeCloseTo(83.33, 2);
    expect(ratings?.overall.st).toBeCloseTo(75, 2);
    expect(ratings?.overall.final).toBeCloseTo(80.56, 2);
  });

  it("regresses low-gp percentiles toward the finalized qualified cohort", () => {
    const rawStats: RawStatsCollection = {
      as: {
        offense: [
          { player_id: 1, season: 20242025, gp: 4, toi_seconds: 400, total_points_per_60: 10 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 900, total_points_per_60: 9 },
          { player_id: 3, season: 20242025, gp: 13, toi_seconds: 950, total_points_per_60: 8 },
          { player_id: 4, season: 20242025, gp: 14, toi_seconds: 980, total_points_per_60: 7 }
        ],
        defense: []
      }
    };

    const ratings = calculatePlayerRatings(
      1,
      rawStats,
      {
        as: {
          offense: [
            { stat: "total_points_per_60", weight: 1, higherIsBetter: true }
          ],
          defense: []
        }
      },
      { enabled: true, minGPThreshold: 10 },
      0
    );

    expect(ratings?._debug?.percentiles?.as?.total_points_per_60).toBeCloseTo(
      87.5,
      2
    );
    expect(
      ratings?._debug?.regressedPercentiles?.as?.total_points_per_60
    ).toBeCloseTo(57.5, 2);
    expect(ratings?.offense.as).toBeCloseTo(57.5, 2);
  });

  it("withholds ratings instead of reporting 50.0 when too few other players qualify", () => {
    const cohort = (size: number) => Array.from({ length: size }, (_, index) => ({
      player_id: index + 1, season: 20252026, gp: 12, toi_seconds: 900,
      total_points_per_60: index + 1, xga_per_60: index + 1, gf_per_60: index + 1, ga_per_60: index + 1
    }));
    const stats = (size: number): RawStatsCollection => ({
      as: { offense: cohort(size), defense: cohort(size) },
      es: { offense: cohort(size), defense: cohort(size) },
      pp: { offense: cohort(size), defense: [] },
      pk: { offense: [], defense: cohort(size) }
    });

    // Target alone: the old behaviour reported 50.0 for every rating.
    const alone = calculatePlayerRatings(1, stats(1), TEST_WEIGHTS, undefined, 10, WIGO_RATING_MIN_COHORT_PEERS);
    expect(alone?.offense.as).toBeNull();
    expect(alone?.defense.pk).toBeNull();
    expect(alone?.overall.final).toBeNull();
    expect(calculatePlayerRatings(1, stats(1), TEST_WEIGHTS, undefined, 10)?.offense.as).toBe(50);

    // One peer short of the minimum still withholds; at the minimum the percentile is real.
    expect(calculatePlayerRatings(1, stats(WIGO_RATING_MIN_COHORT_PEERS), TEST_WEIGHTS, undefined, 10, WIGO_RATING_MIN_COHORT_PEERS)?.offense.as).toBeNull();
    const enough = calculatePlayerRatings(1, stats(WIGO_RATING_MIN_COHORT_PEERS + 1), TEST_WEIGHTS, undefined, 10, WIGO_RATING_MIN_COHORT_PEERS);
    expect(enough?.offense.as).toBeLessThan(10);
    expect(enough?.defense.as).toBeGreaterThan(90);
  });

  const row = (player_id: number, extra: Record<string, number | null>, gp = 20, toi_seconds = 36000) =>
    ({ player_id, season: 20252026, gp, toi_seconds, ...extra });

  it("withholds a rating with a missing weighted stat and reports its weight coverage (A3)", () => {
    const weights: RatingWeightsConfig = {
      es: {
        offense: [
          { stat: "total_points_per_60", weight: 25, higherIsBetter: true },
          { stat: "ixg_per_60", weight: 75, higherIsBetter: true }
        ],
        defense: []
      }
    };
    // Nobody has ixG/60, so 75 of 100 weight units have no percentile.
    const rawStats: RawStatsCollection = {
      es: {
        offense: [1, 2, 3, 4].map((id) => row(id, { total_points_per_60: 5 - id, ixg_per_60: null })),
        defense: []
      }
    };
    const ratings = calculatePlayerRatings(1, rawStats, weights, { enabled: false, minGPThreshold: 10 }, 0);
    // Before the fix: 87.5, the points percentile alone, rescaled over 25 units.
    expect(ratings?.offense.es).toBeNull();
    expect(ratings?.coverage.offense.es).toEqual({ available: 25, total: 100 });

    const full: RawStatsCollection = {
      es: {
        offense: [1, 2, 3, 4].map((id) => row(id, { total_points_per_60: 5 - id, ixg_per_60: 5 - id })),
        defense: []
      }
    };
    const fullRatings = calculatePlayerRatings(1, full, weights, { enabled: false, minGPThreshold: 10 }, 0);
    // Mid-rank top of four: (3 + 0.5) / 4 = 87.5 on both stats.
    expect(fullRatings?.offense.es).toBeCloseTo(87.5, 6);
    expect(fullRatings?.coverage.offense.es).toEqual({ available: 100, total: 100 });
  });

  it("gives no overall rating from one side alone (D9)", () => {
    const rawStats: RawStatsCollection = {
      es: {
        offense: [1, 2, 3].map((id) => row(id, { total_points_per_60: 4 - id })),
        defense: [1, 2, 3].map((id) => row(id, { xga_per_60: null }))
      }
    };
    const ratings = calculatePlayerRatings(1, rawStats, TEST_WEIGHTS, { enabled: false, minGPThreshold: 10 }, 0);
    expect(ratings?.offense.es).toBeCloseTo(83.33, 2);
    expect(ratings?.defense.es).toBeNull();
    expect(ratings?.overall.es).toBeNull();
  });

  it("leaves special teams unknown when a side with ice time has no rating, and weights by ice time otherwise", () => {
    const pp = [1, 2, 3].map((id) => row(id, { gf_per_60: 4 - id }, 20, 6000));
    const unknownPk: RawStatsCollection = {
      pp: { offense: pp, defense: [] },
      pk: { offense: [], defense: [1, 2, 3].map((id) => row(id, { ga_per_60: null }, 20, 3000)) }
    };
    const missing = calculatePlayerRatings(1, unknownPk, TEST_WEIGHTS, { enabled: false, minGPThreshold: 10 }, 0);
    expect(missing?.offense.pp).toBeCloseTo(83.33, 2);
    // Before the fix: 83.33, PP offense standing in for special teams.
    expect(missing?.overall.st).toBeNull();

    const known: RawStatsCollection = {
      pp: { offense: pp, defense: [] },
      pk: { offense: [], defense: [1, 2, 3].map((id) => row(id, { ga_per_60: id }, 20, 3000)) }
    };
    const both = calculatePlayerRatings(1, known, TEST_WEIGHTS, { enabled: false, minGPThreshold: 10 }, 0);
    // 6000 s PP at 83.33 and 3000 s PK at 83.33.
    expect(both?.overall.st).toBeCloseTo((83.333 * 6000 + 83.333 * 3000) / 9000, 2);
  });

  it("ranks PP against a minutes floor, not games, and forwards and defensemen apart (decision 81)", () => {
    const groups = new Map<number, WigoPositionGroup>([
      [1, "D"], [2, "D"], [3, "D"], [4, "F"], [5, "F"], [6, "D"]
    ]);
    // Every row clears 10 GP; minutes decide. Player 6 has 20 PP min (below 30).
    const pp: RawStatsCollection = {
      pp: {
        offense: [
          row(1, { gf_per_60: 5 }, 40, 50 * 60),
          row(2, { gf_per_60: 4 }, 40, 50 * 60),
          row(3, { gf_per_60: 9 }, 40, 25 * 60), // D under the floor: out of the cohort
          row(4, { gf_per_60: 9 }, 40, 200 * 60), // forwards: a separate cohort
          row(5, { gf_per_60: 8 }, 40, 200 * 60),
          row(6, { gf_per_60: 12 }, 40, 20 * 60)
        ],
        defense: []
      }
    };
    const options = wigoSpecialTeamsCohortOptions(groups, { pp: 30, pk: 30 });
    const d1 = calculatePlayerRatings(1, pp, TEST_WEIGHTS, { enabled: false, minGPThreshold: 10 }, 10, 0, options);
    // D cohort over 30 min: players 1 and 2 → (1 + 0.5) / 2 = 75. Pooled by games (all six) it was 25.
    expect(d1?._debug?.percentiles?.pp?.gf_per_60).toBeCloseTo(75, 6);
    // Below the floor: insufficient sample, not a ranked 12.0 GF/60.
    const d6 = calculatePlayerRatings(6, pp, TEST_WEIGHTS, { enabled: false, minGPThreshold: 10 }, 10, 0, options);
    expect(d6?.offense.pp).toBeNull();
    // Unknown position: cannot be placed in F or D, so unranked.
    const unknown = calculatePlayerRatings(1, pp, TEST_WEIGHTS, { enabled: false, minGPThreshold: 10 }, 10, 0,
      wigoSpecialTeamsCohortOptions(new Map([[2, "D"]]), { pp: 30, pk: 30 }));
    expect(unknown?.offense.pp).toBeNull();
    // Lowering the floor to 20 min brings players 3 and 6 into the D cohort.
    const lowered = calculatePlayerRatings(6, pp, TEST_WEIGHTS, { enabled: false, minGPThreshold: 10 }, 10, 0,
      wigoSpecialTeamsCohortOptions(groups, { pp: 20, pk: 30 }));
    expect(lowered?._debug?.percentiles?.pp?.gf_per_60).toBeCloseTo(87.5, 6);
  });

  it("maps WGO position codes to F and D", () => {
    expect(["C", "L", "R", "LW", "RW"].map(wigoPositionGroup)).toEqual(["F", "F", "F", "F", "F"]);
    expect(wigoPositionGroup("D")).toBe("D");
    expect(wigoPositionGroup("G")).toBeNull();
    expect(wigoPositionGroup(null)).toBeNull();
  });
});

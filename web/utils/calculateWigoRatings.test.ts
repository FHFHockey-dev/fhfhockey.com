import { describe, expect, it } from "vitest";

import type { RatingWeightsConfig, RawStatsCollection } from "components/WiGO/types";
import { calculatePlayerRatings } from "./calculateWigoRatings";

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
});

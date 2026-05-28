import { describe, expect, it } from "vitest";

import {
  buildQotQocFeatureRows,
  buildQotQocPlayerRatings,
  validateQotQocLeakage,
} from "./qotQoc";

describe("buildQotQocPlayerRatings", () => {
  it("builds offensive and defensive percentiles within position and TOI buckets", () => {
    const ratings = buildQotQocPlayerRatings([
      { playerId: 1, positionGroup: "forward", toiSeconds: 100, offensiveMetric: 1, defensiveMetric: 2 },
      { playerId: 2, positionGroup: "forward", toiSeconds: 200, offensiveMetric: 2, defensiveMetric: 1 },
      { playerId: 3, positionGroup: "forward", toiSeconds: 300, offensiveMetric: 3, defensiveMetric: 3 },
      { playerId: 4, positionGroup: "forward", toiSeconds: 400, offensiveMetric: 4, defensiveMetric: 4 },
      { playerId: 5, positionGroup: "forward", toiSeconds: 500, offensiveMetric: 5, defensiveMetric: 6 },
      { playerId: 6, positionGroup: "forward", toiSeconds: 600, offensiveMetric: 6, defensiveMetric: 5 },
      { playerId: 7, positionGroup: "defense", toiSeconds: 600, offensiveMetric: 1, defensiveMetric: 10 },
      { playerId: 8, positionGroup: "defense", toiSeconds: 700, offensiveMetric: 2, defensiveMetric: 8 },
      { playerId: 9, positionGroup: "defense", toiSeconds: 800, offensiveMetric: 3, defensiveMetric: 9 },
    ]);

    expect(ratings.find((row) => row.player_id === 1)).toMatchObject({
      position_group: "forward",
      toi_bucket: "low",
      offensive_percentile: 0,
      defensive_percentile: 1,
    });
    expect(ratings.find((row) => row.player_id === 2)).toMatchObject({
      position_group: "forward",
      toi_bucket: "low",
      offensive_percentile: 1,
      defensive_percentile: 0,
    });
    expect(ratings.find((row) => row.player_id === 9)).toMatchObject({
      position_group: "defense",
      toi_bucket: "high",
      offensive_percentile: 1,
      defensive_percentile: 1,
    });
  });

  it("filters invalid rows and handles singleton comparable groups", () => {
    const ratings = buildQotQocPlayerRatings([
      { playerId: 1, positionGroup: "forward", toiSeconds: 100, offensiveMetric: 1, defensiveMetric: 2 },
      { playerId: Number.NaN, positionGroup: "forward", toiSeconds: 100, offensiveMetric: 1, defensiveMetric: 2 },
      { playerId: 2, positionGroup: "forward", toiSeconds: -1, offensiveMetric: 1, defensiveMetric: 2 },
    ]);

    expect(ratings).toEqual([
      expect.objectContaining({
        player_id: 1,
        offensive_percentile: 1,
        defensive_percentile: 1,
      }),
    ]);
  });

  it("builds player-game, unit-game, and rolling QoT/QoC overlap features", () => {
    const ratings = buildQotQocPlayerRatings([
      { playerId: 1, positionGroup: "forward", toiSeconds: 100, offensiveMetric: 1, defensiveMetric: 1 },
      { playerId: 2, positionGroup: "forward", toiSeconds: 200, offensiveMetric: 2, defensiveMetric: 2 },
      { playerId: 3, positionGroup: "forward", toiSeconds: 300, offensiveMetric: 3, defensiveMetric: 3 },
      { playerId: 4, positionGroup: "defense", toiSeconds: 100, offensiveMetric: 1, defensiveMetric: 3 },
      { playerId: 5, positionGroup: "defense", toiSeconds: 200, offensiveMetric: 3, defensiveMetric: 1 },
      { playerId: 6, positionGroup: "forward", toiSeconds: 400, offensiveMetric: 6, defensiveMetric: 6 },
      { playerId: 7, positionGroup: "forward", toiSeconds: 500, offensiveMetric: 5, defensiveMetric: 5 },
      { playerId: 8, positionGroup: "forward", toiSeconds: 600, offensiveMetric: 4, defensiveMetric: 4 },
      { playerId: 9, positionGroup: "defense", toiSeconds: 300, offensiveMetric: 2, defensiveMetric: 2 },
      { playerId: 10, positionGroup: "defense", toiSeconds: 400, offensiveMetric: 4, defensiveMetric: 4 },
    ]);

    const result = buildQotQocFeatureRows({
      version: "qotqoc-v1",
      ratingSnapshotDate: "2026-05-27",
      generatedAt: "2026-05-27T20:00:00.000Z",
      rollingWindows: [2],
      ratings,
      stints: [
        {
          gameId: 2025020001,
          seasonId: 20252026,
          gameDate: "2025-10-07",
          period: 1,
          startSecond: 0,
          endSecond: 30,
          durationSeconds: 30,
          teams: [
            { teamId: 10, playerIds: [1, 2, 3, 4, 5] },
            { teamId: 20, playerIds: [6, 7, 8, 9, 10] },
          ],
          onIcePlayerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
      ],
    });

    expect(result.playerGameRows).toHaveLength(10);
    expect(result.playerGameRows.find((row) => row.player_id === 1)).toMatchObject({
      qot_qoc_version: "qotqoc-v1",
      team_id: 10,
      source_scope: "postgame_shift_overlap",
      feature_availability: "postgame_descriptive",
      toi_overlap_seconds: 30,
      teammate_count_weighted: 4,
      opponent_count_weighted: 5,
    });
    expect(result.unitGameRows).toContainEqual(
      expect.objectContaining({
        team_id: 10,
        unit_type: "line",
        unit_key: "1-2-3",
        player_ids: [1, 2, 3],
      })
    );
    expect(result.unitGameRows).toContainEqual(
      expect.objectContaining({
        team_id: 10,
        unit_type: "pair",
        unit_key: "4-5",
        player_ids: [4, 5],
      })
    );
    expect(result.playerRollingRows.find((row) => row.player_id === 1)).toMatchObject({
      as_of_game_id: 2025020001,
      window_games: 2,
      games_count: 1,
      toi_overlap_seconds: 30,
    });
  });

  it("blocks postgame QoT/QoC overlap features from pregame usage", () => {
    expect(
      validateQotQocLeakage({
        featureAvailability: "postgame_descriptive",
        usageMode: "pregame",
      })
    ).toMatchObject({
      passed: false,
      blocking_reasons: [
        "postgame_shift_overlap_qot_qoc_is_not_pregame_safe",
        "same_game_teammate_opponent_overlap_leakage",
      ],
    });

    expect(
      validateQotQocLeakage({
        featureAvailability: "postgame_descriptive",
        usageMode: "postgame_descriptive",
      })
    ).toMatchObject({ passed: true, blocking_reasons: [] });
  });
});

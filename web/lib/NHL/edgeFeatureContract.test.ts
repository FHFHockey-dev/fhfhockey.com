import { describe, expect, it } from "vitest";

import {
  buildNhlEdgeFeatureJoinPlan,
  getNhlEdgeFeatureContractByEntity,
  getNhlEdgeFeatureContracts,
  validateNhlEdgeSnapshotFreshness,
} from "./edgeFeatureContract";

describe("edgeFeatureContract", () => {
  it("maps every model-usable EDGE contract to entity, grain, table, and freshness semantics", () => {
    expect(getNhlEdgeFeatureContracts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: "skater",
          table: "nhl_edge_skater_metrics_daily",
          grain: ["snapshot_date", "season_id", "game_type", "player_id"],
          freshnessRule: "snapshot_date_lte_as_of_date",
          availability: "pregame_safe_with_freshness",
        }),
        expect.objectContaining({
          entity: "goalie",
          table: "nhl_edge_goalie_metrics_daily",
          fields: expect.arrayContaining(["high_danger_save_pct"]),
        }),
      ])
    );
  });

  it("builds pregame-safe join plans through the leakage registry", () => {
    expect(
      buildNhlEdgeFeatureJoinPlan({
        entity: "team",
        seasonId: 20252026,
        gameType: 2,
        asOfDate: "2026-05-27",
      })
    ).toMatchObject({
      table: "nhl_edge_team_metrics_daily",
      joinKeys: ["team_id"],
      requiredFilters: {
        season_id: 20252026,
        game_type: 2,
        snapshot_date_lte: "2026-05-27",
      },
      leakage: {
        passed: true,
        warnings: ["nhl_edge_metrics:requires_as_of_freshness_validation"],
      },
    });
  });

  it("keeps leaderboard contracts out of model join plans", () => {
    expect(getNhlEdgeFeatureContractByEntity("skater_shot_location_leader")).toMatchObject({
      modelUse: "display_or_leaderboard_only",
    });
    expect(() =>
      buildNhlEdgeFeatureJoinPlan({
        entity: "skater_shot_location_leader" as never,
        seasonId: 20252026,
        gameType: 2,
        asOfDate: "2026-05-27",
      })
    ).toThrow(/No model-usable NHL EDGE feature contract/);
  });

  it("validates stale, future, missing, and current snapshots", () => {
    expect(
      validateNhlEdgeSnapshotFreshness({
        snapshotDate: "2026-05-20",
        asOfDate: "2026-05-27",
      })
    ).toEqual({ passed: true, ageDays: 7, blockingReasons: [] });
    expect(
      validateNhlEdgeSnapshotFreshness({
        snapshotDate: "2026-05-01",
        asOfDate: "2026-05-27",
      })
    ).toMatchObject({ passed: false, blockingReasons: ["edge_snapshot_stale"] });
    expect(
      validateNhlEdgeSnapshotFreshness({
        snapshotDate: "2026-05-28",
        asOfDate: "2026-05-27",
      })
    ).toMatchObject({ passed: false, blockingReasons: ["edge_snapshot_after_as_of_date"] });
    expect(
      validateNhlEdgeSnapshotFreshness({
        snapshotDate: null,
        asOfDate: "2026-05-27",
      })
    ).toMatchObject({ passed: false, blockingReasons: ["missing_edge_snapshot_date"] });
  });
});

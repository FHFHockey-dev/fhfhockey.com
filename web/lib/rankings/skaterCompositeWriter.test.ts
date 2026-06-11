import { describe, expect, it } from "vitest";

import type { ContextualRankingApiRow } from "./rankingTypes";
import {
  buildSkaterCompositeRatingRow,
  calculateArchetypeScores,
  calculateDefenseRating,
  calculateMcmScore,
  calculateOffenseRating,
  resolveBeastTier,
  type SkaterCompositeBuildRequest,
} from "./skaterCompositeWriter";

const request: SkaterCompositeBuildRequest = {
  season: 20252026,
  asOfDate: null,
  window: "season",
  position: "all",
  deployment: "all",
  strength: "5v5",
  minGp: 1,
  minToiSeconds: 300,
  teamId: null,
  peerGroupType: "all_skaters",
  limit: 25,
};

const baseRow: ContextualRankingApiRow = {
  entity: {
    id: 8478402,
    name: "Test Skater",
    position: "C",
    positionGroup: "forward",
    imageUrl: null,
  },
  team: {
    id: 14,
    abbreviation: "TBL",
    name: "Tampa Bay Lightning",
  },
  deployment: {
    ev: "L1",
    pp: "PP1",
    pk: null,
    confidence: "high",
  },
  sample: {
    gamesPlayed: 20,
    toiSeconds: 24000,
    toiPerGameSeconds: 1200,
    confidence: "high",
    minimumSampleMet: true,
  },
  metric: {
    key: "points_per_60",
    value: 3.2,
    formattedValue: "3.20",
    rawRank: 1,
    percentile: 95,
    qualifiedPeerCount: 100,
  },
  peerGroup: {
    type: "all_skaters",
    key: "all_skaters",
  },
  tags: [],
  warnings: [],
  explanationItems: [],
};

const strongPercentiles = {
  goals_per_60: 90,
  points_per_60: 95,
  ixg_per_60: 88,
  shot_attempts_per_60: 84,
  sog_per_60: 82,
  primary_assists_per_60: 76,
  assists_per_60: 80,
  expected_shooting_percentage: 70,
  sax_percentage: 68,
  goals_above_expected: 72,
  xga_per_60: 85,
  on_ice_xgf_percentage: 82,
  on_ice_gf_percentage: 78,
  blocks_per_60: 65,
  hits_per_60: 81,
};

const sourceFreshness = [
  {
    metricKey: "points_per_60" as const,
    snapshotDate: "2026-03-01",
    snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
    unavailable: false,
    reason: null,
  },
  {
    metricKey: "sax_percentage" as const,
    snapshotDate: null,
    snapshotUpdatedAt: null,
    unavailable: true,
    reason: "Metric unavailable in this context.",
  },
];

describe("skaterCompositeWriter", () => {
  it("calculates bounded percentile-based composite scores", () => {
    expect(calculateOffenseRating(strongPercentiles)).toBe(83.88);
    expect(calculateDefenseRating(strongPercentiles)).toBe(79.25);
    expect(calculateMcmScore(strongPercentiles)).toBe(86.23);
    expect(calculateArchetypeScores(strongPercentiles)).toMatchObject({
      shootFirstScore: 77.3,
      passFirstScore: 71.2,
      playDriverScore: 81,
    });
  });

  it("resolves BEAST tiers from transparent multi-category gates", () => {
    expect(resolveBeastTier(strongPercentiles, calculateMcmScore(strongPercentiles))).toBe(
      "BEAST",
    );
    expect(
      resolveBeastTier(
        {
          sog_per_60: 61,
          hits_per_60: 62,
          blocks_per_60: 10,
          goals_per_60: 65,
        },
        null,
      ),
    ).toBe("MCM Watch");
  });

  it("builds an upsert row with methodology, provenance, and missing luck status", () => {
    const row = buildSkaterCompositeRatingRow({
      request,
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
    });

    expect(row).toMatchObject({
      player_id: 8478402,
      team_id: 14,
      season_id: 20252026,
      snapshot_date: "2026-03-01",
      window_type: "season",
      window_size: 0,
      window_semantics: "season_to_date",
      strength_state: "5v5",
      peer_group_type: "all_skaters",
      peer_group_key: "all_skaters",
      position_group: "forward",
      deployment_bucket: "all",
      offense_rating_overall: 83.88,
      defense_rating_overall: 79.25,
      mcm_score: 86.23,
      beast_tier: "BEAST",
      results_luck_index: null,
      methodology_version: "contextual_composites_v1",
    });
    expect(row.tags).toEqual(["play_driver", "BEAST"]);
    expect(JSON.stringify(row.components_json)).toContain("not_computed");
    expect(JSON.stringify(row.components_json)).toContain("player_baselines");
    expect(row.components_json).toMatchObject({
      resultsLuck: {
        signalComponents: [
          { key: "goals_above_expected", weight: 0.35 },
          { key: "sax_percentage", weight: 0.25 },
          { key: "ipp", weight: 0.2 },
          { key: "on_ice_shooting_context", weight: 0.2 },
        ],
        baselineProvenance: {
          baselineSource: "unavailable",
          baselineSnapshotDate: null,
          baselineWindowExcluded: false,
          baselineWeight: 0,
          peerBaselineValue: null,
          currentWindow: "season",
          warnings: [
            "baseline_not_persisted",
            "selected_window_exclusion_not_verified",
          ],
        },
      },
    });
    expect(JSON.stringify(row.provenance)).toContain("contextual_composites_v1");
    expect(row.provenance).toMatchObject({
      sourceFreshness,
    });
  });

  it("writes Results Luck only when source provenance passes the publish gate", () => {
    const row = buildSkaterCompositeRatingRow({
      request: { ...request, window: "last5" },
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
      resultsLuckSource: {
        playerId: 8478402,
        gameDate: "2026-03-01",
        strengthState: "5v5",
        baselineProvenance: {
          baselineSource: "player_non_overlapping",
          baselineSnapshotDate: "2026-03-01",
          baselineWindowExcluded: true,
          baselineWeight: 1,
          peerBaselineValue: null,
          warnings: [],
        },
        components: [
          {
            key: "goals_above_expected",
            semantics: "signed_difference",
            currentValue: 1.2,
            baselineValue: 0.2,
            scale: 2,
            weight: 0.35,
          },
          {
            key: "sax_percentage",
            semantics: "signed_difference",
            currentValue: 6,
            baselineValue: 2,
            scale: 10,
            weight: 0.25,
          },
          {
            key: "ipp",
            semantics: "ratio",
            currentValue: 0.72,
            baselineValue: 0.6,
            weight: 0.2,
          },
          {
            key: "on_ice_shooting_context",
            semantics: "contextual_on_ice",
            currentValue: 12,
            baselineValue: 10,
            scale: 10,
            weight: 0.2,
          },
        ],
      },
    });

    expect(row.results_luck_index).toBe(135.5);
    expect(row.components_json).toMatchObject({
      resultsLuck: {
        status: "computed",
        reason: null,
        baselineProvenance: {
          baselineSource: "player_non_overlapping",
          baselineWindowExcluded: true,
        },
        score: {
          canPublish: true,
          indexValue: 135.5,
        },
      },
    });
  });

  it("keeps Results Luck null when source provenance fails the publish gate", () => {
    const row = buildSkaterCompositeRatingRow({
      request: { ...request, window: "last5" },
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
      resultsLuckSource: {
        playerId: 8478402,
        gameDate: "2026-03-01",
        strengthState: "5v5",
        baselineProvenance: {
          baselineSource: "peer_fallback",
          baselineSnapshotDate: "2026-03-01",
          baselineWindowExcluded: false,
          baselineWeight: 0,
          peerBaselineValue: 100,
          warnings: ["selected_window_exclusion_not_verified"],
        },
        components: [
          {
            key: "ipp",
            semantics: "ratio",
            currentValue: 0.72,
            baselineValue: 0.6,
            weight: 1,
          },
        ],
      },
    });

    expect(row.results_luck_index).toBeNull();
    expect(row.components_json).toMatchObject({
      resultsLuck: {
        status: "not_computed",
        baselineProvenance: {
          baselineSource: "peer_fallback",
          baselineWindowExcluded: false,
        },
        score: {
          canPublish: false,
          indexValue: 120,
        },
      },
    });
  });

  it("writes deployment ratings when the request is scoped to a deployment bucket", () => {
    const row = buildSkaterCompositeRatingRow({
      request: { ...request, deployment: "L1", peerGroupType: "deployment" },
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: null,
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
    });

    expect(row.offense_rating_overall).toBeNull();
    expect(row.defense_rating_overall).toBeNull();
    expect(row.peer_group_type).toBe("deployment");
    expect(row.peer_group_key).toBe("L1");
    expect(row.deployment_bucket).toBe("L1");
    expect(row.offense_rating_deployment).toBe(83.88);
    expect(row.defense_rating_deployment).toBe(79.25);
  });
});

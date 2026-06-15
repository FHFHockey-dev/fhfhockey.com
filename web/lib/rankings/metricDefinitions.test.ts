import { describe, expect, it } from "vitest";

import {
  AVAILABLE_CONTEXTUAL_RANKING_METRIC_KEYS,
  CONTEXTUAL_RANKING_METRIC_DEFINITIONS,
  getContextualRankingMetricDefinition,
} from "./metricDefinitions";

describe("metricDefinitions", () => {
  it("publishes shot attempts only through the selected-window ICF rolling family", () => {
    const definition = getContextualRankingMetricDefinition(
      "shot_attempts_per_60",
    );

    expect(definition?.availabilityStatus).toBe("available");
    expect(AVAILABLE_CONTEXTUAL_RANKING_METRIC_KEYS).toContain(
      "shot_attempts_per_60",
    );
    expect(definition?.sourceTable).toBe("rolling_player_game_metrics");
    expect(definition?.sourceFields).toContain(
      "shot_attempts_per_60_{window}",
    );
    expect(definition?.sourceFields).not.toContain(
      "rolling_player_game_metrics.cf_*",
    );
    expect(definition?.sourceFields).not.toContain(
      "wgo_skater_stats.sat_for",
    );
    expect(definition?.metadata).toMatchObject({
      semanticSource: "nst_icf",
      windowSource: "player_last_n_games_played",
    });
    expect(definition?.denominatorKey).toBe("toi_seconds");
    expect(definition?.denominatorDescription).toMatch(/TOI seconds/);
    expect(definition?.methodologyVersion).toBe("contextual_rankings_v1");
  });

  it("publishes denominator, sample, methodology, and source quality metadata for every metric", () => {
    for (const definition of CONTEXTUAL_RANKING_METRIC_DEFINITIONS) {
      expect(definition.applicableStrengthStates.length).toBeGreaterThan(0);
      expect(definition.denominatorKey).not.toBe("");
      expect(definition.denominatorDescription).not.toBe("");
      expect(definition.sampleRequirements.minimumGp).toBeGreaterThanOrEqual(0);
      expect(definition.sampleRequirements.minimumToiSeconds).toBeGreaterThanOrEqual(0);
      expect(definition.sampleRequirements.windowSource).not.toBe("");
      expect(definition.methodologyVersion).toBe("contextual_rankings_v1");
      expect(Array.isArray(definition.sourceQualityFlags)).toBe(true);
    }

    expect(
      getContextualRankingMetricDefinition("hits_per_60")?.sourceQualityFlags,
    ).toContain("rink_scorekeeper_sensitive_unadjusted");
    expect(
      getContextualRankingMetricDefinition("blocks_per_60")?.sourceQualityFlags,
    ).toContain("rink_scorekeeper_sensitive_unadjusted");
    expect(
      getContextualRankingMetricDefinition("mcm_score")?.sourceQualityFlags,
    ).toContain("rink_scorekeeper_sensitive_unadjusted");
    expect(
      getContextualRankingMetricDefinition("beast_tier")?.sourceQualityFlags,
    ).toContain("rink_scorekeeper_sensitive_unadjusted");
  });

  it("keeps xG shot-quality metrics available and denominator-matched to unblocked attempts", () => {
    const ixg = getContextualRankingMetricDefinition("ixg_per_60");
    const expectedShooting = getContextualRankingMetricDefinition(
      "expected_shooting_percentage",
    );
    const sax = getContextualRankingMetricDefinition("sax_percentage");

    expect(ixg?.availabilityStatus).toBe("available");
    expect(ixg?.sourceTable).toBe("rolling_player_game_metrics");
    expect(ixg?.sourceTable).not.toBe("expected_goals");
    expect(ixg?.sourceFields.join(" ")).not.toContain("expected_goals");
    expect(ixg?.metadata).toMatchObject({
      xgSemantic: "shot_quality_probability_sum",
      xgShotUniverse: "fenwick_unblocked",
      sourceExcludes: ["expected_goals"],
    });
    expect(expectedShooting?.availabilityStatus).toBe("available");
    expect(expectedShooting?.denominatorKey).toBe(
      "individual_unblocked_attempts",
    );
    expect(expectedShooting?.sourceTable).toBe("rolling_player_game_metrics");
    expect(expectedShooting?.sourceFields).toContain(
      "rolling_player_game_metrics.shot_attempts_per_60_total_{window}",
    );
    expect(expectedShooting?.sourceQualityFlags).toContain(
      "fenwick_xg_denominator_matched",
    );
    expect(sax?.denominatorKey).toBe("individual_unblocked_attempts");
    expect(sax?.availabilityStatus).toBe("available");
    expect(sax?.sourceQualityFlags).toContain(
      "fenwick_xg_denominator_matched",
    );
  });

  it("publishes penalties taken as a selected-window lower-is-better rolling metric", () => {
    const definition = getContextualRankingMetricDefinition(
      "penalties_taken_per_60",
    );

    expect(definition?.availabilityStatus).toBe("available");
    expect(definition?.higherIsBetter).toBe(false);
    expect(definition?.sourceTable).toBe("rolling_player_game_metrics");
    expect(definition?.sourceFields).toContain(
      "rolling_player_game_metrics.penalties_taken_per_60_{window}",
    );
    expect(definition?.metadata).toMatchObject({
      numeratorSource: "NST total_penalties",
    });
  });

  it("keeps PP points source-pending until verified ranking rows exist", () => {
    const definition = getContextualRankingMetricDefinition("pp_points_per_60");

    expect(definition?.availabilityStatus).toBe("unavailable");
    expect(definition?.defaultStrengthState).toBe("pp");
    expect(definition?.applicableStrengthStates).toEqual(["pp"]);
    expect(definition?.sourceTable).toBeNull();
    expect(definition?.sourceQualityFlags).toContain("source_pending");
    expect(definition?.metadata).toMatchObject({
      sourcePendingReason:
        "MCM methodology includes PP points, but the current contextual ranking surface has no verified pp_points_per_60 metric rows.",
    });
  });

  it("publishes offense and defensive impact as live composite metric contracts", () => {
    const offense = getContextualRankingMetricDefinition("offense_rating");
    const defense = getContextualRankingMetricDefinition("defense_rating");

    expect(offense?.availabilityStatus).toBe("available");
    expect(offense?.sourceTable).toBe("skater_composite_ratings");
    expect(offense?.denominatorKey).toBe("component_percentiles");
    expect(offense?.sourceFields).toContain(
      "skater_composite_ratings.offense_rating_overall",
    );
    expect(defense?.availabilityStatus).toBe("available");
    expect(defense?.displayName).toBe("Defensive Impact");
    expect(defense?.sourceTable).toBe("skater_composite_ratings");
    expect(defense?.denominatorKey).toBe("component_percentiles");
    expect(defense?.sourceQualityFlags).toContain(
      "context_influenced_unadjusted_on_ice",
    );
  });

  it("labels raw on-ice defensive metrics as context influenced until adjusted models exist", () => {
    const xga = getContextualRankingMetricDefinition("xga_per_60");
    const onIceGf = getContextualRankingMetricDefinition("on_ice_gf_percentage");
    const onIceXgf = getContextualRankingMetricDefinition(
      "on_ice_xgf_percentage",
    );

    expect(xga?.availabilityStatus).toBe("available");
    expect(xga?.defaultStrengthState).toBe("5v5");
    expect(xga?.applicableStrengthStates).toEqual(["5v5"]);
    expect(xga?.sourceTable).toBe("rolling_player_game_metrics");
    expect(xga?.metadata).toMatchObject({
      labelScope: "Defensive Impact in Context",
    });
    expect(xga?.metadata?.caveat).toMatch(/teammates/);
    expect(xga?.metadata?.caveat).toMatch(/opponents/);
    expect(xga?.metadata?.caveat).toMatch(/score state/);
    expect(xga?.sourceQualityFlags).toContain(
      "context_influenced_unadjusted_on_ice",
    );
    expect(onIceGf?.availabilityStatus).toBe("available");
    expect(onIceGf?.defaultStrengthState).toBe("ev");
    expect(onIceGf?.applicableStrengthStates).toEqual(["5v5", "ev"]);
    expect(onIceGf?.sourceTable).toBe("rolling_player_game_metrics");
    expect(onIceGf?.sourceQualityFlags).toContain(
      "context_influenced_unadjusted_on_ice",
    );
    expect(onIceXgf?.availabilityStatus).toBe("available");
    expect(onIceXgf?.applicableStrengthStates).toEqual(["5v5"]);
    expect(onIceXgf?.sourceTable).toBe("rolling_player_game_metrics");
    expect(onIceXgf?.sourceQualityFlags).toContain(
      "context_influenced_unadjusted_on_ice",
    );
  });
});

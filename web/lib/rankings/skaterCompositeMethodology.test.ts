import { describe, expect, it } from "vitest";

import {
  BEAST_TIER_GATES,
  DEFENSE_RATING_CONTRACT,
  MCM_COMPONENTS,
  MCM_SCORE_CONTRACT,
  OFFENSE_RATING_CONTRACT,
  RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT,
  RESULTS_LUCK_INDEX_CONTRACT,
  RESULTS_LUCK_SIGNAL_COMPONENTS,
  SKATER_ARCHETYPE_TAG_CONTRACTS,
  SKATER_COMPOSITE_SOURCE_TABLE,
} from "./skaterCompositeMethodology";

describe("skaterCompositeMethodology", () => {
  it("defines offense and defense ratings as percentile contracts", () => {
    expect(SKATER_COMPOSITE_SOURCE_TABLE).toBe("skater_composite_ratings");
    expect(OFFENSE_RATING_CONTRACT.scale).toBe("percentile_0_to_100");
    expect(OFFENSE_RATING_CONTRACT.formula).toContain("scoring_rate_score");
    expect(OFFENSE_RATING_CONTRACT.components.chance_creation_score).toContain(
      "ixg_per_60",
    );

    expect(DEFENSE_RATING_CONTRACT.scale).toBe("percentile_0_to_100");
    expect(DEFENSE_RATING_CONTRACT.components.suppression_score).toContain(
      "xga_per_60",
    );
    expect(DEFENSE_RATING_CONTRACT.sourceQualityFlags).toContain(
      "context_influenced_unadjusted_on_ice",
    );
    expect(DEFENSE_RATING_CONTRACT.caveats.join(" ")).toMatch(/teammates/);
  });

  it("locks MCM and BEAST around multi-category gates", () => {
    expect(MCM_COMPONENTS.riff).toEqual([
      "sog_per_60",
      "hits_per_60",
      "blocks_per_60",
    ]);
    expect(MCM_SCORE_CONTRACT.formula).toContain("average(top_2");
    expect(MCM_SCORE_CONTRACT.requiredOutputFields).toContain("visible_thresholds");

    const beastPlus = BEAST_TIER_GATES[0];
    expect(beastPlus.tier).toBe("BEAST+");
    expect(beastPlus.riffThresholds).toEqual({ count: 3, percentile: 80 });
    expect(beastPlus.scoringThresholds).toEqual({ count: 2, percentile: 75 });
    expect(beastPlus.minimumMcmScore).toBe(88);

    const watch = BEAST_TIER_GATES.at(-1);
    expect(watch?.tier).toBe("MCM Watch");
    expect(watch?.minimumMcmScore).toBeNull();
  });

  it("documents transparent archetype tags and a non-overlapping luck baseline", () => {
    const playDriver = SKATER_ARCHETYPE_TAG_CONTRACTS.find(
      (tag) => tag.key === "play_driver",
    );
    expect(playDriver?.components).toContain("on_ice_xgf_percentage");
    expect(playDriver?.rule).toMatch(/percentile/);

    expect(RESULTS_LUCK_INDEX_CONTRACT.centeredAt).toBe(100);
    expect(RESULTS_LUCK_INDEX_CONTRACT.baseline).toMatch(/excludes/);
    expect(RESULTS_LUCK_SIGNAL_COMPONENTS.map((component) => component.key)).toEqual([
      "goals_above_expected",
      "sax_percentage",
      "ipp",
      "on_ice_shooting_context",
    ]);
    expect(
      RESULTS_LUCK_SIGNAL_COMPONENTS.reduce(
        (sum, component) => sum + component.weight,
        0,
      ),
    ).toBe(1);
    expect(
      RESULTS_LUCK_SIGNAL_COMPONENTS.find((component) => component.key === "ipp")
        ?.sourceFields,
    ).toContain("ipp_points_{window}");
    expect(
      RESULTS_LUCK_SIGNAL_COMPONENTS.find(
        (component) => component.key === "on_ice_shooting_context",
      )?.sourceFields,
    ).toContain("on_ice_sh_pct_{window}");
    expect(RESULTS_LUCK_INDEX_CONTRACT.minimumSampleRules.join(" ")).toMatch(
      /non-overlapping baseline/,
    );
    expect(RESULTS_LUCK_INDEX_CONTRACT.interpretationBands[0]).toMatchObject({
      label: "Running hot",
      min: 120,
    });
    expect(RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT.storageTable).toBe(
      "skater_composite_ratings",
    );
    expect(
      RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT.requiredProvenanceFields,
    ).toContain("baselineWindowExcluded");
    expect(
      RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT.blockedSourceTables[0],
    ).toMatchObject({
      table: "player_baselines",
    });
  });
});

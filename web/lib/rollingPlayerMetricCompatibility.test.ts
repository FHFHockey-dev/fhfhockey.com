import { describe, expect, it } from "vitest";

import {
  __testables,
  canonicalOrLegacyFinite,
  canonicalOrLegacyNullable,
  describeLegacyFieldLifecycle,
  getCompatibilityFieldOrder,
  getCompatibilityOnlyLegacyFamily,
  interpretLegacyGpSemanticType,
  isAuthoritativeLegacyField,
  isCompatibilityOnlyLegacyField,
  resolveFiniteCompatibilityValue,
  resolveNullableCompatibilityValue
} from "./rollingPlayerMetricCompatibility";

describe("rollingPlayerMetricCompatibility", () => {
  it("treats ratio, weighted-rate, and availability families as canonical-first", () => {
    expect(__testables.getCompatibilityPreference("ratio")).toBe("canonical_first");
    expect(__testables.getCompatibilityPreference("weighted_rate")).toBe(
      "canonical_first"
    );
    expect(__testables.getCompatibilityPreference("availability")).toBe(
      "canonical_first"
    );

    expect(resolveFiniteCompatibilityValue("ratio", 8.5, 7.2)).toBe(8.5);
    expect(resolveFiniteCompatibilityValue("weighted_rate", 8.5, 7.2)).toBe(8.5);
    expect(resolveNullableCompatibilityValue("availability", null, 0.7)).toBe(0.7);
  });

  it("keeps additive and TOI families legacy-first where avg versus total semantics still matter", () => {
    expect(__testables.getCompatibilityPreference("additive_average")).toBe(
      "legacy_first"
    );
    expect(__testables.getCompatibilityPreference("additive_total")).toBe(
      "legacy_first"
    );
    expect(__testables.getCompatibilityPreference("toi_average")).toBe("legacy_first");
    expect(__testables.getCompatibilityPreference("toi_total")).toBe("legacy_first");

    expect(resolveFiniteCompatibilityValue("additive_average", 0.8, 0.6)).toBe(0.6);
    expect(resolveFiniteCompatibilityValue("toi_average", 1100, 900)).toBe(900);
    expect(resolveNullableCompatibilityValue("additive_total", 10, null)).toBe(10);
  });

  it("returns field order aligned with family preference for later consumer migrations", () => {
    expect(
      getCompatibilityFieldOrder({
        family: "weighted_rate",
        canonicalField: "sog_per_60_last5",
        legacyField: "sog_per_60_avg_last5"
      })
    ).toEqual(["sog_per_60_last5", "sog_per_60_avg_last5"]);

    expect(
      getCompatibilityFieldOrder({
        family: "additive_average",
        canonicalField: "goals_last5",
        legacyField: "goals_avg_last5"
      })
    ).toEqual(["goals_avg_last5", "goals_last5"]);
  });

  it("keeps the existing convenience wrappers canonical-first for current weighted-rate callers", () => {
    expect(canonicalOrLegacyFinite(8.5, 7.2)).toBe(8.5);
    expect(canonicalOrLegacyFinite(null, 7.2)).toBe(7.2);
    expect(canonicalOrLegacyFinite(undefined, 7.2)).toBe(7.2);
    expect(canonicalOrLegacyFinite(Number.NaN, 7.2)).toBe(7.2);

    expect(canonicalOrLegacyNullable(8.5, 7.2)).toBe(8.5);
    expect(canonicalOrLegacyNullable(null, 7.2)).toBe(7.2);
    expect(canonicalOrLegacyNullable(undefined, 7.2)).toBe(7.2);
  });

  it("exposes gp_semantic_type-aware interpretation for legacy GP compatibility fields", () => {
    expect(interpretLegacyGpSemanticType("availability")).toEqual({
      semanticType: "availability",
      numeratorMeaning: "games played",
      denominatorMeaning: "team games available",
      percentMeaning: "availability percent"
    });

    expect(interpretLegacyGpSemanticType("participation")).toEqual({
      semanticType: "participation",
      numeratorMeaning: "games with positive split-strength participation",
      denominatorMeaning: "team games available",
      percentMeaning: "participation percent"
    });

    expect(interpretLegacyGpSemanticType(null)).toEqual({
      semanticType: "unknown",
      numeratorMeaning: "legacy GP numerator with unresolved semantic type",
      denominatorMeaning: "legacy GP denominator with unresolved semantic type",
      percentMeaning: "legacy GP percent with unresolved semantic type"
    });
  });

  it("classifies pass-2 compatibility-only legacy fields for stage-1 alias freeze", () => {
    expect(getCompatibilityOnlyLegacyFamily("shooting_pct_avg_last5")).toBe("ratio");
    expect(getCompatibilityOnlyLegacyFamily("sog_per_60_total_last10")).toBe(
      "weighted_rate"
    );
    expect(getCompatibilityOnlyLegacyFamily("gp_pct_avg_season")).toBe("gp");

    expect(isCompatibilityOnlyLegacyField("shooting_pct_total_all")).toBe(true);
    expect(isCompatibilityOnlyLegacyField("hits_per_60_avg_last20")).toBe(true);
    expect(isCompatibilityOnlyLegacyField("gp_pct_total_career")).toBe(true);

    expect(describeLegacyFieldLifecycle("shooting_pct_avg_last5")).toEqual({
      family: "ratio",
      classification: "compatibility_only_freeze_candidate",
      stage: "stage_1_alias_freeze",
      guidance:
        "Keep writing for compatibility, prevent new reader adoption, and route surviving reads through compatibility helpers until later cleanup."
    });
  });

  it("does not classify additive or TOI legacy surfaces as alias-freeze candidates", () => {
    expect(getCompatibilityOnlyLegacyFamily("goals_avg_last5")).toBe(null);
    expect(getCompatibilityOnlyLegacyFamily("goals_total_last5")).toBe(null);
    expect(getCompatibilityOnlyLegacyFamily("toi_seconds_avg_last5")).toBe(null);
    expect(getCompatibilityOnlyLegacyFamily("games_played")).toBe(null);
    expect(getCompatibilityOnlyLegacyFamily("season_availability_pct")).toBe(null);

    expect(isCompatibilityOnlyLegacyField("goals_avg_last5")).toBe(false);
    expect(isCompatibilityOnlyLegacyField("toi_seconds_avg_last5")).toBe(false);
    expect(isCompatibilityOnlyLegacyField("penalties_drawn_avg_last5")).toBe(false);
    expect(isCompatibilityOnlyLegacyField("pp_toi_seconds_avg_last5")).toBe(false);
    expect(isCompatibilityOnlyLegacyField("penalties_drawn_per_60_avg_last5")).toBe(
      true
    );

    expect(isAuthoritativeLegacyField("goals_avg_last5")).toBe(true);
    expect(isAuthoritativeLegacyField("toi_seconds_avg_last5")).toBe(true);
    expect(isAuthoritativeLegacyField("penalties_drawn_avg_last5")).toBe(true);
    expect(isAuthoritativeLegacyField("pp_toi_seconds_avg_last5")).toBe(true);
    expect(isAuthoritativeLegacyField("penalties_drawn_per_60_avg_last5")).toBe(
      false
    );
    expect(isAuthoritativeLegacyField("gp_pct_avg_last5")).toBe(false);

    expect(describeLegacyFieldLifecycle("goals_avg_last5")).toEqual({
      family: null,
      classification: "active_or_authoritative_surface",
      stage: null,
      guidance:
        "Field is not in the pass-2 compatibility-only legacy freeze set."
    });
  });
});

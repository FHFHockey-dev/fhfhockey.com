export type RollingMetricCompatibilityFamily =
  | "ratio"
  | "weighted_rate"
  | "availability"
  | "additive_average"
  | "additive_total"
  | "toi_average"
  | "toi_total";

export type GpSemanticType = "availability" | "participation";

type CompatibilityPreference = "canonical_first" | "legacy_first";
type LegacyCompatibilityOnlyFamily = "ratio" | "weighted_rate" | "gp";

const LEGACY_RATIO_FIELD_RE =
  /^(shooting_pct|expected_sh_pct|primary_points_pct|ipp|oz_start_pct|pp_share_pct|on_ice_sh_pct|on_ice_sv_pct|pdo|cf_pct|ff_pct)_(avg|total)_(all|last3|last5|last10|last20|season|3ya|career)$/;
const LEGACY_WEIGHTED_RATE_FIELD_RE =
  /^[a-z0-9_]+_per_60_(avg|total)_(all|last3|last5|last10|last20|season|3ya|career)$/;
const LEGACY_GP_FIELD_RE =
  /^gp_pct_(avg|total)_(all|last3|last5|last10|last20|season|3ya|career)$/;

const CANONICAL_FIRST_FAMILIES = new Set<RollingMetricCompatibilityFamily>([
  "ratio",
  "weighted_rate",
  "availability"
]);

function getCompatibilityPreference(
  family: RollingMetricCompatibilityFamily
): CompatibilityPreference {
  return CANONICAL_FIRST_FAMILIES.has(family)
    ? "canonical_first"
    : "legacy_first";
}

function pickOrderedValues<T>(
  family: RollingMetricCompatibilityFamily,
  canonical: T,
  legacy: T
): [T, T] {
  return getCompatibilityPreference(family) === "canonical_first"
    ? [canonical, legacy]
    : [legacy, canonical];
}

export function getCompatibilityFieldOrder(args: {
  family: RollingMetricCompatibilityFamily;
  canonicalField: string | null | undefined;
  legacyField: string | null | undefined;
}): string[] {
  const ordered = pickOrderedValues(
    args.family,
    args.canonicalField ?? null,
    args.legacyField ?? null
  );
  return ordered.filter((field): field is string => typeof field === "string" && field.length > 0);
}

export function getCompatibilityOnlyLegacyFamily(
  field: string | null | undefined
): LegacyCompatibilityOnlyFamily | null {
  if (typeof field !== "string" || field.length === 0) {
    return null;
  }

  if (LEGACY_RATIO_FIELD_RE.test(field)) {
    return "ratio";
  }

  if (LEGACY_WEIGHTED_RATE_FIELD_RE.test(field)) {
    return "weighted_rate";
  }

  if (LEGACY_GP_FIELD_RE.test(field)) {
    return "gp";
  }

  return null;
}

export function isCompatibilityOnlyLegacyField(
  field: string | null | undefined
): boolean {
  return getCompatibilityOnlyLegacyFamily(field) !== null;
}

export function isAuthoritativeLegacyField(
  field: string | null | undefined
): boolean {
  if (typeof field !== "string" || field.length === 0) {
    return false;
  }

  const isLegacyShape =
    field.includes("_avg_") ||
    field.includes("_total_") ||
    field.startsWith("gp_pct_");

  return isLegacyShape && !isCompatibilityOnlyLegacyField(field);
}

export function describeLegacyFieldLifecycle(
  field: string | null | undefined
): {
  family: LegacyCompatibilityOnlyFamily | null;
  classification:
    | "compatibility_only_freeze_candidate"
    | "active_or_authoritative_surface";
  stage: "stage_1_alias_freeze" | null;
  guidance: string;
} {
  const family = getCompatibilityOnlyLegacyFamily(field);
  if (family === null) {
    return {
      family: null,
      classification: "active_or_authoritative_surface",
      stage: null,
      guidance:
        "Field is not in the pass-2 compatibility-only legacy freeze set."
    };
  }

  return {
    family,
    classification: "compatibility_only_freeze_candidate",
    stage: "stage_1_alias_freeze",
    guidance:
      "Keep writing for compatibility, prevent new reader adoption, and route surviving reads through compatibility helpers until later cleanup."
  };
}

export function resolveFiniteCompatibilityValue(
  family: RollingMetricCompatibilityFamily,
  canonical: number | null | undefined,
  legacy: number | null | undefined
): number | null | undefined {
  const [preferred, fallback] = pickOrderedValues(family, canonical, legacy);
  return typeof preferred === "number" && Number.isFinite(preferred)
    ? preferred
    : fallback;
}

export function resolveNullableCompatibilityValue(
  family: RollingMetricCompatibilityFamily,
  canonical: number | null | undefined,
  legacy: number | null | undefined
): number | null | undefined {
  const [preferred, fallback] = pickOrderedValues(family, canonical, legacy);
  return preferred ?? fallback;
}

export function canonicalOrLegacyFinite(
  canonical: number | null | undefined,
  legacy: number | null | undefined
): number | null | undefined {
  return resolveFiniteCompatibilityValue("weighted_rate", canonical, legacy);
}

export function canonicalOrLegacyNullable(
  canonical: number | null | undefined,
  legacy: number | null | undefined
): number | null | undefined {
  return resolveNullableCompatibilityValue("weighted_rate", canonical, legacy);
}

export function interpretLegacyGpSemanticType(
  semanticType: string | null | undefined
): {
  semanticType: GpSemanticType | "unknown";
  numeratorMeaning: string;
  denominatorMeaning: string;
  percentMeaning: string;
} {
  if (semanticType === "availability") {
    return {
      semanticType,
      numeratorMeaning: "games played",
      denominatorMeaning: "team games available",
      percentMeaning: "availability percent"
    };
  }

  if (semanticType === "participation") {
    return {
      semanticType,
      numeratorMeaning: "games with positive split-strength participation",
      denominatorMeaning: "team games available",
      percentMeaning: "participation percent"
    };
  }

  return {
    semanticType: "unknown",
    numeratorMeaning: "legacy GP numerator with unresolved semantic type",
    denominatorMeaning: "legacy GP denominator with unresolved semantic type",
    percentMeaning: "legacy GP percent with unresolved semantic type"
  };
}

export const __testables = {
  getCompatibilityPreference
};

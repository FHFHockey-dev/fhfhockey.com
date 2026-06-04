import type { NhlShotFeatureRow } from "../supabase/Upserts/nhlShotFeatureBuilder";

export type XgSelectedFeatureGroup = "numeric" | "boolean" | "categorical";

export type XgSelectedFeatures = Record<XgSelectedFeatureGroup, string[]>;

export type XgFeatureMissingnessPolicy = {
  missingKey: "fail";
  numericNullEncoding: "zero";
  booleanNullEncoding: "false";
  categoricalNullEncoding: "all_zero";
  maxAllowedNullRateDrift: number;
  maxAllowedCategoricalUnknownRate: number;
  minScoringRowsForDriftCheck: number;
};

export type XgFeatureCoverageEntry = {
  feature: string;
  featureGroup: XgSelectedFeatureGroup;
  rowCount: number;
  missingKeyCount: number;
  nullCount: number;
  populatedCount: number;
  nullRate: number;
  populatedRate: number;
  categoricalLevels?: string[];
};

export type XgFeatureCoverageProfile = {
  rowCount: number;
  policy: XgFeatureMissingnessPolicy;
  features: Record<string, XgFeatureCoverageEntry>;
  blockingReasons: string[];
  warnings: string[];
};

export type XgScoringFeatureCoverageIssue = {
  code: "feature_null_rate_drift" | "categorical_unknown_rate";
  feature: string;
  featureGroup: XgSelectedFeatureGroup;
  trainingRate: number;
  scoringRate: number;
  allowedRate: number;
  message: string;
};

export const DEFAULT_XG_FEATURE_MISSINGNESS_POLICY: XgFeatureMissingnessPolicy = {
  missingKey: "fail",
  numericNullEncoding: "zero",
  booleanNullEncoding: "false",
  categoricalNullEncoding: "all_zero",
  maxAllowedNullRateDrift: 0.25,
  maxAllowedCategoricalUnknownRate: 0.05,
  minScoringRowsForDriftCheck: 1000,
};

function hasOwnKey(row: NhlShotFeatureRow, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function normalizeCategoricalValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isFeatureValueNull(
  value: unknown,
  featureGroup: XgSelectedFeatureGroup
): boolean {
  if (featureGroup === "numeric") {
    return typeof value !== "number" || !Number.isFinite(value);
  }

  if (featureGroup === "boolean") {
    return typeof value !== "boolean";
  }

  return normalizeCategoricalValue(value) == null;
}

function roundRate(value: number): number {
  return Number(value.toFixed(6));
}

function selectedFeatureEntries(selectedFeatures: XgSelectedFeatures): Array<{
  feature: string;
  featureGroup: XgSelectedFeatureGroup;
}> {
  return (["numeric", "boolean", "categorical"] as XgSelectedFeatureGroup[]).flatMap(
    (featureGroup) =>
      selectedFeatures[featureGroup].map((feature) => ({
        feature,
        featureGroup,
      }))
  );
}

export function buildXgFeatureCoverageProfile(args: {
  rows: NhlShotFeatureRow[];
  selectedFeatures: XgSelectedFeatures;
  policy?: Partial<XgFeatureMissingnessPolicy>;
}): XgFeatureCoverageProfile {
  const policy = {
    ...DEFAULT_XG_FEATURE_MISSINGNESS_POLICY,
    ...args.policy,
  };
  const features: Record<string, XgFeatureCoverageEntry> = {};
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  for (const { feature, featureGroup } of selectedFeatureEntries(args.selectedFeatures)) {
    let missingKeyCount = 0;
    let nullCount = 0;
    let populatedCount = 0;
    const categoricalLevels = new Set<string>();

    for (const row of args.rows) {
      if (!hasOwnKey(row, feature)) {
        missingKeyCount += 1;
        nullCount += 1;
        continue;
      }

      const value = (row as Record<string, unknown>)[feature];
      if (isFeatureValueNull(value, featureGroup)) {
        nullCount += 1;
        continue;
      }

      populatedCount += 1;
      if (featureGroup === "categorical") {
        const categoricalValue = normalizeCategoricalValue(value);
        if (categoricalValue != null) categoricalLevels.add(categoricalValue);
      }
    }

    const rowCount = args.rows.length;
    const entry: XgFeatureCoverageEntry = {
      feature,
      featureGroup,
      rowCount,
      missingKeyCount,
      nullCount,
      populatedCount,
      nullRate: rowCount > 0 ? roundRate(nullCount / rowCount) : 1,
      populatedRate: rowCount > 0 ? roundRate(populatedCount / rowCount) : 0,
      ...(featureGroup === "categorical"
        ? { categoricalLevels: Array.from(categoricalLevels).sort() }
        : {}),
    };
    features[feature] = entry;

    if (missingKeyCount > 0) {
      blockingReasons.push(
        `Selected ${featureGroup} feature "${feature}" is absent from ${missingKeyCount}/${rowCount} training rows.`
      );
    }

    if (rowCount > 0 && populatedCount === 0) {
      blockingReasons.push(
        `Selected ${featureGroup} feature "${feature}" is entirely unpopulated in the training rows.`
      );
    } else if (entry.nullRate >= 0.5) {
      warnings.push(
        `Selected ${featureGroup} feature "${feature}" has training null rate ${entry.nullRate}.`
      );
    }
  }

  return {
    rowCount: args.rows.length,
    policy,
    features,
    blockingReasons,
    warnings,
  };
}

export function auditScoringRowsAgainstFeatureCoverage(args: {
  rows: NhlShotFeatureRow[];
  trainingProfile?: XgFeatureCoverageProfile | null;
  selectedFeatures: XgSelectedFeatures;
}): XgScoringFeatureCoverageIssue[] {
  const trainingProfile = args.trainingProfile;
  if (!trainingProfile) return [];
  if (args.rows.length < trainingProfile.policy.minScoringRowsForDriftCheck) return [];

  const scoringProfile = buildXgFeatureCoverageProfile({
    rows: args.rows,
    selectedFeatures: args.selectedFeatures,
    policy: trainingProfile.policy,
  });
  const issues: XgScoringFeatureCoverageIssue[] = [];

  for (const [feature, scoringEntry] of Object.entries(scoringProfile.features)) {
    const trainingEntry = trainingProfile.features[feature];
    if (!trainingEntry) continue;

    const nullRateDelta = Math.abs(scoringEntry.nullRate - trainingEntry.nullRate);
    if (nullRateDelta > trainingProfile.policy.maxAllowedNullRateDrift) {
      issues.push({
        code: "feature_null_rate_drift",
        feature,
        featureGroup: scoringEntry.featureGroup,
        trainingRate: trainingEntry.nullRate,
        scoringRate: scoringEntry.nullRate,
        allowedRate: trainingProfile.policy.maxAllowedNullRateDrift,
        message:
          `Selected feature "${feature}" scoring null rate ${scoringEntry.nullRate} ` +
          `differs from training null rate ${trainingEntry.nullRate} by ${roundRate(nullRateDelta)}.`
      });
    }

    if (scoringEntry.featureGroup !== "categorical") continue;

    const knownLevels = new Set(trainingEntry.categoricalLevels ?? []);
    const unknownCount = args.rows.filter((row) => {
      const value = normalizeCategoricalValue((row as Record<string, unknown>)[feature]);
      return value != null && !knownLevels.has(value);
    }).length;
    const unknownRate = args.rows.length > 0 ? roundRate(unknownCount / args.rows.length) : 0;

    if (unknownRate > trainingProfile.policy.maxAllowedCategoricalUnknownRate) {
      issues.push({
        code: "categorical_unknown_rate",
        feature,
        featureGroup: "categorical",
        trainingRate: 0,
        scoringRate: unknownRate,
        allowedRate: trainingProfile.policy.maxAllowedCategoricalUnknownRate,
        message:
          `Selected categorical feature "${feature}" has scoring unknown-level rate ${unknownRate}.`
      });
    }
  }

  return issues;
}

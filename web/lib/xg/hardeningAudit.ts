import { evaluateProbabilityMetrics, type ProbabilityLabel, type ProbabilityMetrics } from "./calibration";

export type XgHardeningShot = {
  gameId: number;
  eventId: number;
  prediction: number;
  label: ProbabilityLabel;
  rinkId: string | null;
  isPlayoff: boolean;
  strengthState: string | null;
  scoreState: string | null;
  shotEventType: string;
  isEmptyNet: boolean;
};

export type XgCalibrationAxis = "rink" | "playoff" | "strength_state" | "score_state";

export type XgSegmentCalibrationRow = {
  axis: XgCalibrationAxis;
  value: string;
  metrics: ProbabilityMetrics;
  expectedCalibrationError: number | null;
  maximumCalibrationGap: number | null;
  status: "sufficient" | "insufficient";
  warnings: string[];
};

export type XgCalibrationAudit = {
  minimumSampleSize: number;
  binCount: number;
  overall: ProbabilityMetrics;
  segments: XgSegmentCalibrationRow[];
};

export type XgBenchmarkKey =
  | "all_situations_unblocked"
  | "five_on_five_non_empty_net_unblocked";

export type XgBenchmarkSurface = {
  key: XgBenchmarkKey;
  label: string;
  definition: {
    eventUniverse: "unblocked_shot_attempts";
    strengthUniverse: "all" | "5v5";
    emptyNetPolicy: "included" | "excluded";
    scoreStatePolicy: "unadjusted_observed";
  };
  metrics: ProbabilityMetrics;
};

export type XgExternalTaxonomy = {
  provider: "Natural Stat Trick" | "MoneyPuck" | "Evolving-Hockey";
  verification: "primary_source_verified" | "provider_verification_required";
  sourceUrl: string | null;
  accessedOn: "2026-07-12";
  eventUniverse: string;
  strengthTaxonomy: string;
  rinkAdjustment: string;
  flurryTreatment: string;
  reboundTreatment: string;
  emptyNetTreatment: string;
  calibrationContract: string;
  comparisonRule: "taxonomy_alignment_required_before_failure_classification";
};

const EPSILON = 1e-9;
const FIVE_ON_FIVE_STATES = new Set(["5v5", "5-on-5", "0505"]);

function round(value: number | null): number | null {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(6));
}

function clipProbability(value: number): number {
  return Math.min(1 - EPSILON, Math.max(EPSILON, Number.isFinite(value) ? value : 0.5));
}

function calibrationGaps(
  rows: XgHardeningShot[],
  binCount: number,
): { expectedCalibrationError: number | null; maximumCalibrationGap: number | null } {
  if (rows.length === 0) {
    return { expectedCalibrationError: null, maximumCalibrationGap: null };
  }
  const bins = Array.from({ length: binCount }, () => [] as XgHardeningShot[]);
  for (const row of rows) {
    const index = Math.min(binCount - 1, Math.floor(clipProbability(row.prediction) * binCount));
    bins[index]!.push(row);
  }
  let weightedGap = 0;
  let maximumGap = 0;
  for (const bin of bins) {
    if (bin.length === 0) continue;
    const metrics = evaluateProbabilityMetrics(bin);
    if (metrics.goalRate == null || metrics.averagePrediction == null) continue;
    const gap = Math.abs(metrics.goalRate - metrics.averagePrediction);
    weightedGap += gap * (bin.length / rows.length);
    maximumGap = Math.max(maximumGap, gap);
  }
  return {
    expectedCalibrationError: round(weightedGap),
    maximumCalibrationGap: round(maximumGap),
  };
}

function axisValue(row: XgHardeningShot, axis: XgCalibrationAxis): string {
  if (axis === "rink") return row.rinkId?.trim() || "unknown";
  if (axis === "playoff") return row.isPlayoff ? "playoff" : "regular_season";
  if (axis === "strength_state") return row.strengthState?.trim() || "unknown";
  return row.scoreState?.trim() || "unknown";
}

export function buildXgSegmentCalibrationAudit(
  rows: XgHardeningShot[],
  options: { minimumSampleSize?: number; binCount?: number } = {},
): XgCalibrationAudit {
  const minimumSampleSize = Math.max(1, options.minimumSampleSize ?? 100);
  const binCount = Math.max(2, options.binCount ?? 10);
  const segments: XgSegmentCalibrationRow[] = [];

  for (const axis of ["rink", "playoff", "strength_state", "score_state"] as const) {
    const groups = new Map<string, XgHardeningShot[]>();
    for (const row of rows) {
      const value = axisValue(row, axis);
      groups.set(value, [...(groups.get(value) ?? []), row]);
    }
    for (const [value, group] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
      const metrics = evaluateProbabilityMetrics(group);
      const warnings: string[] = [];
      if (group.length < minimumSampleSize) {
        warnings.push(`Sample size ${group.length} is below minimum ${minimumSampleSize}.`);
      }
      if (metrics.goalCount === 0 || metrics.goalCount === metrics.exampleCount) {
        warnings.push("Segment contains only one label class; probability-quality estimates are unstable.");
      }
      segments.push({
        axis,
        value,
        metrics,
        ...calibrationGaps(group, binCount),
        status: warnings.length > 0 ? "insufficient" : "sufficient",
        warnings,
      });
    }
  }

  return {
    minimumSampleSize,
    binCount,
    overall: evaluateProbabilityMetrics(rows),
    segments,
  };
}

function isUnblocked(row: XgHardeningShot): boolean {
  return row.shotEventType !== "blocked-shot" && row.shotEventType !== "blocked_shot";
}

export function buildXgInternalBenchmarkSurfaces(rows: XgHardeningShot[]): XgBenchmarkSurface[] {
  const allSituations = rows.filter(isUnblocked);
  const fiveOnFive = allSituations.filter(
    (row) => !row.isEmptyNet && FIVE_ON_FIVE_STATES.has(row.strengthState?.toLowerCase() ?? ""),
  );
  return [
    {
      key: "all_situations_unblocked",
      label: "All-situations unblocked xG",
      definition: {
        eventUniverse: "unblocked_shot_attempts",
        strengthUniverse: "all",
        emptyNetPolicy: "included",
        scoreStatePolicy: "unadjusted_observed",
      },
      metrics: evaluateProbabilityMetrics(allSituations),
    },
    {
      key: "five_on_five_non_empty_net_unblocked",
      label: "5v5 non-empty-net unblocked xG",
      definition: {
        eventUniverse: "unblocked_shot_attempts",
        strengthUniverse: "5v5",
        emptyNetPolicy: "excluded",
        scoreStatePolicy: "unadjusted_observed",
      },
      metrics: evaluateProbabilityMetrics(fiveOnFive),
    },
  ];
}

export const XG_EXTERNAL_TAXONOMY: readonly XgExternalTaxonomy[] = [
  {
    provider: "MoneyPuck",
    verification: "primary_source_verified",
    sourceUrl: "https://www.moneypuck.com/about.htm",
    accessedOn: "2026-07-12",
    eventUniverse: "Unblocked shot attempts; blocked attempts are excluded from downloadable shot data.",
    strengthTaxonomy: "All manpower situations are available and must be filtered explicitly for a matched comparison.",
    rinkAdjustment: "Download data documents arena-adjusted coordinates and distances.",
    flurryTreatment: "Publishes raw and flurry-adjusted xG; later shots are discounted by prior non-scoring probability.",
    reboundTreatment: "Rebound context enters the shot model; separate expected-rebound, freeze, and created-xG outputs also exist.",
    emptyNetTreatment: "Empty-net status is a model variable; comparison exports must state whether those rows are excluded.",
    calibrationContract: "Gradient-boosted shot-goal probability; public methodology does not establish parity with FHFH calibration bins.",
    comparisonRule: "taxonomy_alignment_required_before_failure_classification",
  },
  {
    provider: "Evolving-Hockey",
    verification: "primary_source_verified",
    sourceUrl: "https://evolving-hockey.com/blog/a-new-expected-goals-model-for-predicting-goals-in-the-nhl/",
    accessedOn: "2026-07-12",
    eventUniverse: "Public methodology defines the target over Fenwick/unblocked shot attempts.",
    strengthTaxonomy: "Provider surfaces must be matched by strength state before comparison.",
    rinkAdjustment: "Not proven by the inspected public methodology; provider verification required for a rink-matched benchmark.",
    flurryTreatment: "Not proven by the inspected public methodology; do not assume equivalence.",
    reboundTreatment: "Feature treatment may differ and must be mapped from the provider contract before row-level comparison.",
    emptyNetTreatment: "Must be verified for the selected export/surface.",
    calibrationContract: "Binary shot-to-goal classification; calibration/version details must be matched to the selected release.",
    comparisonRule: "taxonomy_alignment_required_before_failure_classification",
  },
  {
    provider: "Natural Stat Trick",
    verification: "provider_verification_required",
    sourceUrl: null,
    accessedOn: "2026-07-12",
    eventUniverse: "Repository overlap surfaces exist, but current public methodology was inaccessible to automated verification.",
    strengthTaxonomy: "Match the exact NST situation/table contract; never infer from an all-situations total.",
    rinkAdjustment: "Unverified for the intended comparison surface.",
    flurryTreatment: "Unverified for the intended comparison surface.",
    reboundTreatment: "Unverified for the intended comparison surface.",
    emptyNetTreatment: "Unverified for the intended comparison surface.",
    calibrationContract: "Unverified; frozen parity rows are not a substitute for current provider methodology.",
    comparisonRule: "taxonomy_alignment_required_before_failure_classification",
  },
] as const;


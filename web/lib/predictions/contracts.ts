export type PredictionFallbackFlags = Record<string, boolean>;

export type PredictionWarning = {
  code: string;
  message: string;
  source?: string;
};

export type PredictionTopFactor = {
  key: string;
  label: string;
  direction: "positive" | "negative" | "neutral";
  weight?: number | null;
  value?: number | string | null;
};

export type PredictionCalibrationSummary = {
  metricWindow?: string | null;
  logLoss?: number | null;
  brierScore?: number | null;
  intervalCoverage?: number | null;
  calibrationMaxGap?: number | null;
};

export type FreshnessDegradedState =
  | "fresh"
  | "fallback"
  | "stale"
  | "missing"
  | "blocked"
  | "current_only";

export type SourceFreshnessContract = {
  source: string;
  requestedDate: string | null;
  effectiveDate: string | null;
  sourceDate: string | null;
  staleThresholdDays: number;
  ageDays: number | null;
  stale: boolean;
  fallbackApplied: boolean;
  fallbackReason: string | null;
  degradedState: FreshnessDegradedState;
  label: string;
};

export type PredictionMetadataContract = {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  asOfDate: string;
  sourceCutoffs: SourceFreshnessContract[];
  warnings: PredictionWarning[];
  topFactors: PredictionTopFactor[];
  calibration: PredictionCalibrationSummary | null;
  fallbackFlags: PredictionFallbackFlags;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateOnly(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  if (DATE_ONLY_PATTERN.test(value)) return value;

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function diffDateOnlyDays(laterDate: string | null, earlierDate: string | null): number | null {
  if (!laterDate || !earlierDate) return null;
  const later = Date.parse(`${laterDate}T00:00:00.000Z`);
  const earlier = Date.parse(`${earlierDate}T00:00:00.000Z`);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.max(0, Math.floor((later - earlier) / 86_400_000));
}

export function buildSourceFreshnessContract(input: {
  source: string;
  requestedDate: string | null | undefined;
  effectiveDate?: string | null;
  sourceDate: string | null | undefined;
  staleThresholdDays?: number;
  fallbackReason?: string | null;
  currentOnly?: boolean;
  blocked?: boolean;
}): SourceFreshnessContract {
  const requestedDate = normalizeDateOnly(input.requestedDate);
  const sourceDate = normalizeDateOnly(input.sourceDate);
  const effectiveDate = normalizeDateOnly(input.effectiveDate) ?? sourceDate;
  const staleThresholdDays = Math.max(0, input.staleThresholdDays ?? 14);
  const ageDays = diffDateOnlyDays(requestedDate, sourceDate);
  const missing = sourceDate == null;
  const stale = missing || (ageDays != null && ageDays > staleThresholdDays);
  const fallbackApplied = Boolean(input.fallbackReason);

  let degradedState: FreshnessDegradedState = "fresh";
  if (input.blocked) {
    degradedState = "blocked";
  } else if (input.currentOnly) {
    degradedState = "current_only";
  } else if (missing) {
    degradedState = "missing";
  } else if (stale) {
    degradedState = "stale";
  } else if (fallbackApplied) {
    degradedState = "fallback";
  }

  const label =
    degradedState === "fresh"
      ? "Fresh"
      : degradedState === "current_only"
        ? "Current-state only"
        : degradedState === "fallback"
          ? "Fallback"
          : degradedState === "stale"
            ? "Stale"
            : degradedState === "blocked"
              ? "Blocked"
              : "Missing";

  return {
    source: input.source,
    requestedDate,
    effectiveDate,
    sourceDate,
    staleThresholdDays,
    ageDays,
    stale,
    fallbackApplied,
    fallbackReason: input.fallbackReason ?? null,
    degradedState,
    label,
  };
}

export function buildPredictionMetadataContract(input: {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  asOfDate: string;
  sourceCutoffs?: SourceFreshnessContract[];
  warnings?: PredictionWarning[];
  topFactors?: PredictionTopFactor[];
  calibration?: PredictionCalibrationSummary | null;
  fallbackFlags?: PredictionFallbackFlags;
}): PredictionMetadataContract {
  return {
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    featureSetVersion: input.featureSetVersion,
    asOfDate: input.asOfDate,
    sourceCutoffs: input.sourceCutoffs ?? [],
    warnings: input.warnings ?? [],
    topFactors: input.topFactors ?? [],
    calibration: input.calibration ?? null,
    fallbackFlags: input.fallbackFlags ?? {},
  };
}

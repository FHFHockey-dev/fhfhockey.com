import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

type RawPlay = {
  eventId?: number | string | null;
  sortOrder?: number | string | null;
  typeDescKey?: string | null;
};

type RawPlayByPlayPayload = {
  id?: number | string | null;
  plays?: RawPlay[] | null;
};

export type EventTypeCountMismatch = {
  typeDescKey: string;
  rawCount: number;
  normalizedCount: number;
};

export type NormalizedEventValidationResult = {
  gameId: number | null;
  rawEventCount: number;
  normalizedEventCount: number;
  matchingEventIdCount: number;
  missingNormalizedEventIds: number[];
  extraNormalizedEventIds: number[];
  duplicateNormalizedEventIds: number[];
  duplicateNormalizedSortOrders: number[];
  rawTypeCounts: Record<string, number>;
  normalizedTypeCounts: Record<string, number>;
  typeCountMismatches: EventTypeCountMismatch[];
  passed: boolean;
};

export type NormalizedEventValidationSummary = {
  totalGames: number;
  passedGames: number;
  failedGames: number;
  failedGameIds: number[];
  results: NormalizedEventValidationResult[];
};

export type ParityMetricClassification =
  | "exact"
  | "close approximation"
  | "unsupported";

export type ParityMetricMismatch = {
  metric: string;
  classification: ParityMetricClassification;
  severity: "error" | "warning";
  legacyValue: number | null;
  newValue: number | null;
  absDiff: number | null;
  tolerance: number | null;
  reason: "missing-in-new" | "missing-in-legacy" | "value-drift";
};

export type ParitySampleComparison = {
  family: string;
  entityType: "skater" | "goalie" | "team";
  entityId: number;
  sampleKey: string;
  comparedMetrics: string[];
  mismatches: ParityMetricMismatch[];
  passed: boolean;
  hasWarnings: boolean;
};

export type ParitySampleComparisonSummary = {
  totalSamples: number;
  passedSamples: number;
  failedSamples: number;
  warningSamples: number;
  failedSampleKeys: string[];
  warningSampleKeys: string[];
  results: ParitySampleComparison[];
};

export type ReleaseParityMismatchDisposition =
  | "blocking-failure"
  | "approved-exception"
  | "warning";

export type ReleaseParityMismatch = {
  family: string;
  entityType: "skater" | "goalie" | "team";
  entityId: number;
  sampleKey: string;
  metric: string;
  classification: ParityMetricClassification;
  severity: "error" | "warning";
  legacyValue: number | null;
  newValue: number | null;
  absDiff: number | null;
  tolerance: number | null;
  reason: "missing-in-new" | "missing-in-legacy" | "value-drift";
  disposition: ReleaseParityMismatchDisposition;
  rationale: string;
};

export type ReleaseParityDispositionSummary = {
  totalMismatchCount: number;
  blockingFailureCount: number;
  approvedExceptionCount: number;
  warningCount: number;
  blockingFailureSampleCount: number;
  approvedExceptionSampleCount: number;
  warningSampleCount: number;
  blockingFailureSampleKeys: string[];
  approvedExceptionSampleKeys: string[];
  warningSampleKeys: string[];
  blockingFailureByFamily: Record<string, number>;
  approvedExceptionByFamily: Record<string, number>;
  warningByFamily: Record<string, number>;
  blockingFailureByMetric: Record<string, number>;
  approvedExceptionByMetric: Record<string, number>;
  warningByMetric: Record<string, number>;
  blockingFailures: ReleaseParityMismatch[];
  approvedExceptions: ReleaseParityMismatch[];
  warnings: ReleaseParityMismatch[];
};

const UNKNOWN_TYPE_KEY = "__unknown__";
const EXACT_NUMERIC_TOLERANCE = 1e-6;
const APPROX_PERCENT_TOLERANCE = 0.02;
const APPROX_RATE_TOLERANCE = 0.25;
const APPROX_XG_TOLERANCE = 0.15;
const APPROX_COUNT_TOLERANCE = 1;

const PARITY_IGNORED_KEYS = new Set([
  "player_id",
  "season",
  "date_scraped",
  "gp",
]);

const APPROXIMATE_METRICS = new Set([
  "ixg",
  "ixg_per_60",
  "xgf",
  "xga",
  "xgf_pct",
  "xgf_per_60",
  "xga_per_60",
  "xg_against",
  "xg_against_per_60",
  "iscfs",
  "iscfs_per_60",
  "scf",
  "sca",
  "scf_pct",
  "scf_per_60",
  "sca_per_60",
  "hdcf",
  "hdca",
  "hdcf_pct",
  "hdcf_per_60",
  "hdca_per_60",
  "hdgf",
  "hdga",
  "hdgf_pct",
  "mdcf",
  "mdca",
  "mdcf_pct",
  "mdcf_per_60",
  "mdca_per_60",
  "mdgf",
  "mdga",
  "mdgf_pct",
  "ldcf",
  "ldca",
  "ldcf_pct",
  "ldcf_per_60",
  "ldca_per_60",
  "ldgf",
  "ldga",
  "ldgf_pct",
  "rush_attempts",
  "rush_attempts_per_60",
  "rebounds_created",
  "rebounds_created_per_60",
  "rush_attempts_against",
  "rush_attempts_against_per_60",
  "rebound_attempts_against",
  "rebound_attempts_against_per_60",
  "avg_shot_distance",
  "avg_goal_distance",
  "hd_shots_against",
  "hd_saves",
  "hd_sv_percentage",
  "hd_gaa",
  "hd_gsaa",
  "hd_shots_against_per_60",
  "hd_saves_per_60",
  "hd_gsaa_per_60",
  "md_shots_against",
  "md_saves",
  "md_goals_against",
  "md_sv_percentage",
  "md_gaa",
  "md_gsaa",
  "md_shots_against_per_60",
  "md_saves_per_60",
  "md_gsaa_per_60",
  "ld_shots_against",
  "ld_saves",
  "ld_goals_against",
  "ld_sv_percentage",
  "ld_gaa",
  "ld_gsaa",
  "ld_shots_against_per_60",
  "ld_saves_per_60",
  "ld_gsaa_per_60",
  "gsaa",
  "gsaa_per_60",
]);

const APPROVED_ON_ICE_FAMILIES = new Set([
  "nst_gamelog_as_counts_oi",
  "nst_gamelog_as_rates_oi",
]);

const APPROVED_INDIVIDUAL_EXACT_METRICS = new Set([
  "toi",
  "shots",
  "icf",
  "iff",
  "shots_blocked",
  "faceoffs_won",
  "faceoffs_lost",
  "pim",
  "total_penalties",
  "minor_penalties",
  "major_penalties",
  "misconduct_penalties",
  "hits",
  "hits_taken",
  "giveaways",
  "takeaways",
]);

function normalizeTypeKey(typeDescKey: string | null | undefined): string {
  const normalized = typeDescKey?.trim();
  return normalized && normalized.length > 0 ? normalized : UNKNOWN_TYPE_KEY;
}

function countByType<T>(
  rows: T[],
  getTypeDescKey: (row: T) => string | null | undefined
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const typeKey = normalizeTypeKey(getTypeDescKey(row));
    acc[typeKey] = (acc[typeKey] ?? 0) + 1;
    return acc;
  }, {});
}

function findDuplicates(values: Array<number | null | undefined>): number[] {
  const counts = new Map<number, number>();

  for (const value of values) {
    if (value == null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a - b);
}

function sortNumeric(values: Iterable<number>): number[] {
  return Array.from(values).sort((a, b) => a - b);
}

function classifyParityMetric(metric: string): ParityMetricClassification {
  return APPROXIMATE_METRICS.has(metric) ? "close approximation" : "exact";
}

function getToleranceForMetric(
  metric: string,
  classification: ParityMetricClassification
): number {
  if (classification === "exact") {
    return EXACT_NUMERIC_TOLERANCE;
  }

  if (
    metric.endsWith("_pct") ||
    metric.endsWith("_percentage") ||
    metric === "pdo" ||
    metric === "ipp"
  ) {
    return APPROX_PERCENT_TOLERANCE;
  }

  if (
    metric.endsWith("_per_60") ||
    metric === "gaa" ||
    metric === "hd_gaa" ||
    metric === "md_gaa" ||
    metric === "ld_gaa" ||
    metric.startsWith("avg_")
  ) {
    return APPROX_RATE_TOLERANCE;
  }

  if (metric.includes("xg")) {
    return APPROX_XG_TOLERANCE;
  }

  return APPROX_COUNT_TOLERANCE;
}

function isComparableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toComparableInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^-?\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return null;
}

function buildSampleKey(
  family: string,
  entityType: "skater" | "goalie" | "team",
  entityId: number,
  sampleKey: string
): string {
  return `${family}:${entityType}:${entityId}:${sampleKey}`;
}

export function validateNormalizedEventsAgainstRawPlayByPlay(
  rawPayload: RawPlayByPlayPayload,
  normalizedEvents: ParsedNhlPbpEvent[]
): NormalizedEventValidationResult {
  const rawPlays = rawPayload.plays ?? [];
  const rawEventIds = new Set(
    rawPlays
      .map((play) => toComparableInteger(play.eventId))
      .filter((eventId): eventId is number => eventId != null)
  );
  const normalizedEventIds = new Set(
    normalizedEvents
      .map((event) => toComparableInteger(event.event_id))
      .filter((eventId): eventId is number => eventId != null)
  );

  const missingNormalizedEventIds = sortNumeric(
    Array.from(rawEventIds).filter((eventId) => !normalizedEventIds.has(eventId))
  );
  const extraNormalizedEventIds = sortNumeric(
    Array.from(normalizedEventIds).filter((eventId) => !rawEventIds.has(eventId))
  );
  const rawTypeCounts = countByType(rawPlays, (play) => play.typeDescKey);
  const normalizedTypeCounts = countByType(
    normalizedEvents,
    (event) => event.type_desc_key
  );
  const allTypeKeys = new Set([
    ...Object.keys(rawTypeCounts),
    ...Object.keys(normalizedTypeCounts),
  ]);
  const typeCountMismatches = Array.from(allTypeKeys)
    .map((typeDescKey) => ({
      typeDescKey,
      rawCount: rawTypeCounts[typeDescKey] ?? 0,
      normalizedCount: normalizedTypeCounts[typeDescKey] ?? 0,
    }))
    .filter((row) => row.rawCount !== row.normalizedCount)
    .sort((a, b) => a.typeDescKey.localeCompare(b.typeDescKey));
  const duplicateNormalizedEventIds = findDuplicates(
    normalizedEvents.map((event) => toComparableInteger(event.event_id))
  );
  const duplicateNormalizedSortOrders = findDuplicates(
    normalizedEvents.map((event) => toComparableInteger(event.sort_order))
  );

  return {
    gameId:
      toComparableInteger(rawPayload.id) ??
      toComparableInteger(normalizedEvents[0]?.game_id) ??
      null,
    rawEventCount: rawPlays.length,
    normalizedEventCount: normalizedEvents.length,
    matchingEventIdCount: Array.from(rawEventIds).filter((eventId) =>
      normalizedEventIds.has(eventId)
    ).length,
    missingNormalizedEventIds,
    extraNormalizedEventIds,
    duplicateNormalizedEventIds,
    duplicateNormalizedSortOrders,
    rawTypeCounts,
    normalizedTypeCounts,
    typeCountMismatches,
    passed:
      rawPlays.length === normalizedEvents.length &&
      missingNormalizedEventIds.length === 0 &&
      extraNormalizedEventIds.length === 0 &&
      duplicateNormalizedEventIds.length === 0 &&
      duplicateNormalizedSortOrders.length === 0 &&
      typeCountMismatches.length === 0,
  };
}

export function summarizeNormalizedEventValidationResults(
  results: NormalizedEventValidationResult[]
): NormalizedEventValidationSummary {
  const failedGameIds = results
    .filter((result) => !result.passed && result.gameId != null)
    .map((result) => result.gameId as number);

  return {
    totalGames: results.length,
    passedGames: results.filter((result) => result.passed).length,
    failedGames: results.filter((result) => !result.passed).length,
    failedGameIds: sortNumeric(failedGameIds),
    results,
  };
}

export function validateNormalizedEventBatchAgainstRawPayloads(
  rows: Array<{
    rawPayload: RawPlayByPlayPayload;
    normalizedEvents: ParsedNhlPbpEvent[];
  }>
): NormalizedEventValidationSummary {
  return summarizeNormalizedEventValidationResults(
    rows.map(({ rawPayload, normalizedEvents }) =>
      validateNormalizedEventsAgainstRawPlayByPlay(rawPayload, normalizedEvents)
    )
  );
}

export function compareLegacyAndNhlParitySample(args: {
  family: string;
  entityType: "skater" | "goalie" | "team";
  entityId: number;
  sampleKey: string;
  legacyRow: Record<string, unknown>;
  newRow: Record<string, unknown>;
}): ParitySampleComparison {
  const metrics = Object.keys(args.legacyRow)
    .filter((key) => !PARITY_IGNORED_KEYS.has(key))
    .filter(
      (key) =>
        isComparableNumber(args.legacyRow[key]) || args.legacyRow[key] == null
    )
    .sort();
  const mismatches: ParityMetricMismatch[] = [];

  for (const metric of metrics) {
    const classification = classifyParityMetric(metric);
    if (classification === "unsupported") continue;

    const legacyValue = isComparableNumber(args.legacyRow[metric])
      ? (args.legacyRow[metric] as number)
      : null;
    const newValue = isComparableNumber(args.newRow[metric])
      ? (args.newRow[metric] as number)
      : null;

    if (legacyValue == null && newValue == null) {
      continue;
    }

    if (legacyValue == null || newValue == null) {
      mismatches.push({
        metric,
        classification,
        severity: "error",
        legacyValue,
        newValue,
        absDiff: null,
        tolerance: null,
        reason: legacyValue == null ? "missing-in-legacy" : "missing-in-new",
      });
      continue;
    }

    const absDiff = Math.abs(legacyValue - newValue);
    const tolerance = getToleranceForMetric(metric, classification);
    if (absDiff > tolerance) {
      mismatches.push({
        metric,
        classification,
        severity: classification === "exact" ? "error" : "warning",
        legacyValue,
        newValue,
        absDiff,
        tolerance,
        reason: "value-drift",
      });
    }
  }

  return {
    family: args.family,
    entityType: args.entityType,
    entityId: args.entityId,
    sampleKey: buildSampleKey(
      args.family,
      args.entityType,
      args.entityId,
      args.sampleKey
    ),
    comparedMetrics: metrics,
    mismatches,
    passed: !mismatches.some((mismatch) => mismatch.severity === "error"),
    hasWarnings: mismatches.some((mismatch) => mismatch.severity === "warning"),
  };
}

export function summarizeParitySampleComparisons(
  results: ParitySampleComparison[]
): ParitySampleComparisonSummary {
  return {
    totalSamples: results.length,
    passedSamples: results.filter((result) => result.passed).length,
    failedSamples: results.filter((result) => !result.passed).length,
    warningSamples: results.filter((result) => result.hasWarnings).length,
    failedSampleKeys: results
      .filter((result) => !result.passed)
      .map((result) => result.sampleKey)
      .sort(),
    warningSampleKeys: results
      .filter((result) => result.hasWarnings)
      .map((result) => result.sampleKey)
      .sort(),
    results,
  };
}

export function compareLegacyAndNhlParitySamples(
  rows: Array<{
    family: string;
    entityType: "skater" | "goalie" | "team";
    entityId: number;
    sampleKey: string;
    legacyRow: Record<string, unknown>;
    newRow: Record<string, unknown>;
  }>
): ParitySampleComparisonSummary {
  return summarizeParitySampleComparisons(
    rows.map((row) => compareLegacyAndNhlParitySample(row))
  );
}

function incrementCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function classifyParityMismatchForRelease(
  sample: Pick<
    ParitySampleComparison,
    "family" | "entityType" | "entityId" | "sampleKey"
  >,
  mismatch: ParityMetricMismatch
): ReleaseParityMismatch {
  if (mismatch.severity === "warning") {
    return {
      ...sample,
      ...mismatch,
      disposition: "warning",
      rationale: "Approximation drift remains visible but is not an exact-count release blocker.",
    };
  }

  if (APPROVED_ON_ICE_FAMILIES.has(sample.family)) {
    return {
      ...sample,
      ...mismatch,
      disposition: "approved-exception",
      rationale:
        "Approved NHL-correctness divergence for on-ice and zone-start parity surfaces.",
    };
  }

  if (mismatch.metric === "toi") {
    return {
      ...sample,
      ...mismatch,
      disposition: "approved-exception",
      rationale:
        "Approved NHL-correctness divergence where corrected NHL-derived TOI can differ from frozen NST.",
    };
  }

  if (
    sample.family === "nst_gamelog_as_counts" &&
    APPROVED_INDIVIDUAL_EXACT_METRICS.has(mismatch.metric)
  ) {
    return {
      ...sample,
      ...mismatch,
      disposition: "approved-exception",
      rationale:
        "Approved NHL-correctness divergence for residual individual exact-count event credit or classification.",
    };
  }

  return {
    ...sample,
    ...mismatch,
    disposition: "blocking-failure",
    rationale:
      "Unapproved parity drift that still counts as a release-blocking failure until reconciled or explicitly exceptioned.",
  };
}

export function summarizeParityReleaseDisposition(
  summary: ParitySampleComparisonSummary | null
): ReleaseParityDispositionSummary {
  if (!summary) {
    return {
      totalMismatchCount: 0,
      blockingFailureCount: 0,
      approvedExceptionCount: 0,
      warningCount: 0,
      blockingFailureSampleCount: 0,
      approvedExceptionSampleCount: 0,
      warningSampleCount: 0,
      blockingFailureSampleKeys: [],
      approvedExceptionSampleKeys: [],
      warningSampleKeys: [],
      blockingFailureByFamily: {},
      approvedExceptionByFamily: {},
      warningByFamily: {},
      blockingFailureByMetric: {},
      approvedExceptionByMetric: {},
      warningByMetric: {},
      blockingFailures: [],
      approvedExceptions: [],
      warnings: [],
    };
  }

  const blockingFailures: ReleaseParityMismatch[] = [];
  const approvedExceptions: ReleaseParityMismatch[] = [];
  const warnings: ReleaseParityMismatch[] = [];

  for (const sample of summary.results) {
    for (const mismatch of sample.mismatches) {
      const classified = classifyParityMismatchForRelease(sample, mismatch);
      if (classified.disposition === "blocking-failure") {
        blockingFailures.push(classified);
      } else if (classified.disposition === "approved-exception") {
        approvedExceptions.push(classified);
      } else {
        warnings.push(classified);
      }
    }
  }

  const blockingFailureByFamily: Record<string, number> = {};
  const approvedExceptionByFamily: Record<string, number> = {};
  const warningByFamily: Record<string, number> = {};
  const blockingFailureByMetric: Record<string, number> = {};
  const approvedExceptionByMetric: Record<string, number> = {};
  const warningByMetric: Record<string, number> = {};

  for (const mismatch of blockingFailures) {
    incrementCount(blockingFailureByFamily, mismatch.family);
    incrementCount(blockingFailureByMetric, mismatch.metric);
  }

  for (const mismatch of approvedExceptions) {
    incrementCount(approvedExceptionByFamily, mismatch.family);
    incrementCount(approvedExceptionByMetric, mismatch.metric);
  }

  for (const mismatch of warnings) {
    incrementCount(warningByFamily, mismatch.family);
    incrementCount(warningByMetric, mismatch.metric);
  }

  const sortCounts = (counts: Record<string, number>): Record<string, number> =>
    Object.fromEntries(
      Object.entries(counts).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
      )
    );

  const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort();

  return {
    totalMismatchCount:
      blockingFailures.length + approvedExceptions.length + warnings.length,
    blockingFailureCount: blockingFailures.length,
    approvedExceptionCount: approvedExceptions.length,
    warningCount: warnings.length,
    blockingFailureSampleCount: uniqueSorted(
      blockingFailures.map((mismatch) => mismatch.sampleKey)
    ).length,
    approvedExceptionSampleCount: uniqueSorted(
      approvedExceptions.map((mismatch) => mismatch.sampleKey)
    ).length,
    warningSampleCount: uniqueSorted(warnings.map((mismatch) => mismatch.sampleKey))
      .length,
    blockingFailureSampleKeys: uniqueSorted(
      blockingFailures.map((mismatch) => mismatch.sampleKey)
    ),
    approvedExceptionSampleKeys: uniqueSorted(
      approvedExceptions.map((mismatch) => mismatch.sampleKey)
    ),
    warningSampleKeys: uniqueSorted(warnings.map((mismatch) => mismatch.sampleKey)),
    blockingFailureByFamily: sortCounts(blockingFailureByFamily),
    approvedExceptionByFamily: sortCounts(approvedExceptionByFamily),
    warningByFamily: sortCounts(warningByFamily),
    blockingFailureByMetric: sortCounts(blockingFailureByMetric),
    approvedExceptionByMetric: sortCounts(approvedExceptionByMetric),
    warningByMetric: sortCounts(warningByMetric),
    blockingFailures,
    approvedExceptions,
    warnings,
  };
}

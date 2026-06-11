import type { SkaterWindowAggregate } from "./skaterWindowAggregation";

export type ResultsLuckBaselineSource =
  | "player_non_overlapping"
  | "player_peer_blend"
  | "peer_fallback"
  | "unavailable";

export type ResultsLuckIndexResult = {
  currentValue: number | null;
  baselineValue: number | null;
  indexValue: number | null;
  playerBaselineValue: number | null;
  peerBaselineValue: number | null;
  baselineWeight: number;
  baselineNumerator: number | null;
  baselineDenominator: number | null;
  currentWindowExcluded: boolean;
  source: ResultsLuckBaselineSource;
  warnings: string[];
};

export const DEFAULT_RESULTS_LUCK_MINIMUM_BASELINE_TOI_SECONDS = 1200;
export const DEFAULT_RESULTS_LUCK_SIGNED_COMPONENT_SCALE = 1;

export type ResultsLuckComponentSemantics =
  | "signed_difference"
  | "ratio"
  | "contextual_on_ice";

export type ResultsLuckSignalComponentInput = {
  key: string;
  weight: number;
  semantics: ResultsLuckComponentSemantics;
  currentValue: number | null;
  baselineValue: number | null;
  scale?: number;
};

export type ResultsLuckBaselineProvenance = {
  baselineSource: string;
  baselineSnapshotDate: string | null;
  baselineWindowExcluded: boolean;
  baselineWeight: number;
  peerBaselineValue: number | null;
  warnings: string[];
};

export type ComponentAwareResultsLuckResult = {
  indexValue: number | null;
  componentScores: Array<{
    key: string;
    weight: number;
    semantics: ResultsLuckComponentSemantics;
    currentValue: number | null;
    baselineValue: number | null;
    componentIndex: number | null;
    warnings: string[];
  }>;
  totalUsableWeight: number;
  canPublish: boolean;
  warnings: string[];
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function ratePer60(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Number(((numerator / denominator) * 3600).toFixed(6));
}

function aggregateValue(aggregate: SkaterWindowAggregate) {
  return (
    finiteNumber(aggregate.rawValue) ??
    ratePer60(
      finiteNumber(aggregate.numerator),
      finiteNumber(aggregate.denominator),
    )
  );
}

function seasonTotalsForBaseline(aggregate: SkaterWindowAggregate) {
  const numerator = finiteNumber(aggregate.numerator);
  const denominator =
    finiteNumber(aggregate.denominator) ?? finiteNumber(aggregate.toiSeconds);
  const gamesPlayed = finiteNumber(aggregate.gamesPlayed);
  const usesAverageSeasonNumerator = aggregate.sourceFields.some((field) =>
    field.endsWith("_avg_season"),
  );

  return {
    numerator:
      numerator != null && usesAverageSeasonNumerator && gamesPlayed != null
        ? Number((numerator * gamesPlayed).toFixed(6))
        : numerator,
    denominator:
      denominator != null && usesAverageSeasonNumerator
        ? finiteNumber(aggregate.toiSeconds) ?? denominator
        : denominator,
  };
}

function calculateIndex(currentValue: number | null, baselineValue: number | null) {
  if (currentValue == null || baselineValue == null || baselineValue <= 0) {
    return null;
  }
  return Number(((currentValue / baselineValue) * 100).toFixed(6));
}

function clampResultsLuckIndex(value: number) {
  return Math.min(200, Math.max(0, Number(value.toFixed(6))));
}

function componentIndexFor(args: ResultsLuckSignalComponentInput): {
  value: number | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const current = finiteNumber(args.currentValue);
  const baseline = finiteNumber(args.baselineValue);

  if (current == null || baseline == null) {
    warnings.push("missing_component_value");
    return { value: null, warnings };
  }

  if (args.semantics === "ratio") {
    if (baseline <= 0) {
      warnings.push("non_positive_ratio_baseline");
      return { value: null, warnings };
    }
    return {
      value: clampResultsLuckIndex((current / baseline) * 100),
      warnings,
    };
  }

  const scale = finiteNumber(args.scale) ?? DEFAULT_RESULTS_LUCK_SIGNED_COMPONENT_SCALE;
  if (scale <= 0) {
    warnings.push("non_positive_signed_component_scale");
    return { value: null, warnings };
  }

  return {
    value: clampResultsLuckIndex(100 + ((current - baseline) / scale) * 100),
    warnings,
  };
}

export function calculateComponentAwareResultsLuckIndex(args: {
  components: ResultsLuckSignalComponentInput[];
  baselineProvenance: ResultsLuckBaselineProvenance;
  currentWindow: SkaterWindowAggregate["window"];
}): ComponentAwareResultsLuckResult {
  const componentScores = args.components.map((component) => {
    const result = componentIndexFor(component);
    return {
      key: component.key,
      weight: component.weight,
      semantics: component.semantics,
      currentValue: finiteNumber(component.currentValue),
      baselineValue: finiteNumber(component.baselineValue),
      componentIndex: result.value,
      warnings: result.warnings,
    };
  });
  const usable = componentScores.filter(
    (component) =>
      component.componentIndex != null &&
      Number.isFinite(component.weight) &&
      component.weight > 0,
  );
  const totalUsableWeight = usable.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  const totalExpectedWeight = args.components
    .filter((component) => Number.isFinite(component.weight) && component.weight > 0)
    .reduce((sum, component) => sum + component.weight, 0);
  const indexValue =
    totalUsableWeight > 0
      ? Number(
          (
            usable.reduce(
              (sum, component) =>
                sum + (component.componentIndex ?? 0) * component.weight,
              0,
            ) / totalUsableWeight
          ).toFixed(6),
        )
      : null;
  const warnings = componentScores.flatMap((component) =>
    component.warnings.map((warning) => `${component.key}:${warning}`),
  );

  if (!args.baselineProvenance.baselineWindowExcluded) {
    warnings.push("baseline_window_not_excluded");
  }
  if (totalExpectedWeight > 0 && totalUsableWeight < totalExpectedWeight) {
    warnings.push("incomplete_component_coverage");
  }
  warnings.push(...args.baselineProvenance.warnings);

  return {
    indexValue,
    componentScores,
    totalUsableWeight,
    canPublish:
      indexValue != null &&
      totalExpectedWeight > 0 &&
      totalUsableWeight >= totalExpectedWeight &&
      (args.baselineProvenance.baselineWindowExcluded ||
        (args.currentWindow === "season" &&
          args.baselineProvenance.baselineSource === "peer_fallback")),
    warnings,
  };
}

export function canPersistComponentAwareResultsLuckIndex(
  result: ComponentAwareResultsLuckResult,
) {
  return result.canPublish && result.indexValue != null;
}

export function canPersistResultsLuckIndex(args: {
  result: ResultsLuckIndexResult;
  currentWindow: SkaterWindowAggregate["window"];
}) {
  if (args.result.indexValue == null) return false;
  if (args.result.currentWindowExcluded) return true;
  return args.currentWindow === "season" && args.result.source === "peer_fallback";
}

export function calculateNonOverlappingResultsLuckIndex(args: {
  current: SkaterWindowAggregate;
  season: SkaterWindowAggregate | null;
  peerBaselineValue?: number | null;
  minimumBaselineToiSeconds?: number;
}): ResultsLuckIndexResult {
  const warnings: string[] = [];
  const currentValue = aggregateValue(args.current);
  const peerBaselineValue = finiteNumber(args.peerBaselineValue);
  const minimumBaselineToiSeconds =
    args.minimumBaselineToiSeconds ??
    DEFAULT_RESULTS_LUCK_MINIMUM_BASELINE_TOI_SECONDS;

  if (args.current.window === "season") {
    warnings.push("season_window_has_no_non_overlapping_baseline");
    return {
      currentValue,
      baselineValue: peerBaselineValue,
      indexValue: calculateIndex(currentValue, peerBaselineValue),
      playerBaselineValue: null,
      peerBaselineValue,
      baselineWeight: 0,
      baselineNumerator: null,
      baselineDenominator: null,
      currentWindowExcluded: false,
      source: peerBaselineValue == null ? "unavailable" : "peer_fallback",
      warnings,
    };
  }

  if (
    !args.season ||
    args.season.playerId !== args.current.playerId ||
    args.season.metricKey !== args.current.metricKey ||
    args.season.strengthState !== args.current.strengthState ||
    args.season.window !== "season"
  ) {
    warnings.push("missing_matching_season_baseline");
    return {
      currentValue,
      baselineValue: peerBaselineValue,
      indexValue: calculateIndex(currentValue, peerBaselineValue),
      playerBaselineValue: null,
      peerBaselineValue,
      baselineWeight: 0,
      baselineNumerator: null,
      baselineDenominator: null,
      currentWindowExcluded: false,
      source: peerBaselineValue == null ? "unavailable" : "peer_fallback",
      warnings,
    };
  }

  const seasonTotals = seasonTotalsForBaseline(args.season);
  const currentNumerator = finiteNumber(args.current.numerator);
  const currentDenominator =
    finiteNumber(args.current.denominator) ?? finiteNumber(args.current.toiSeconds);
  const baselineNumerator =
    seasonTotals.numerator != null && currentNumerator != null
      ? Number((seasonTotals.numerator - currentNumerator).toFixed(6))
      : null;
  const baselineDenominator =
    seasonTotals.denominator != null && currentDenominator != null
      ? Number((seasonTotals.denominator - currentDenominator).toFixed(6))
      : null;
  const playerBaselineValue = ratePer60(baselineNumerator, baselineDenominator);

  if (
    playerBaselineValue == null ||
    baselineDenominator == null ||
    baselineDenominator <= 0
  ) {
    warnings.push("insufficient_player_baseline_after_current_window_exclusion");
    return {
      currentValue,
      baselineValue: peerBaselineValue,
      indexValue: calculateIndex(currentValue, peerBaselineValue),
      playerBaselineValue: null,
      peerBaselineValue,
      baselineWeight: 0,
      baselineNumerator,
      baselineDenominator,
      currentWindowExcluded: true,
      source: peerBaselineValue == null ? "unavailable" : "peer_fallback",
      warnings,
    };
  }

  const baselineWeight = clamp01(
    baselineDenominator / minimumBaselineToiSeconds,
  );
  const shouldBlend =
    peerBaselineValue != null && baselineWeight < 1 && minimumBaselineToiSeconds > 0;
  const baselineValue = shouldBlend
    ? Number(
        (
          playerBaselineValue * baselineWeight +
          peerBaselineValue * (1 - baselineWeight)
        ).toFixed(6),
      )
    : playerBaselineValue;

  if (shouldBlend) warnings.push("player_baseline_blended_with_peer_average");

  return {
    currentValue,
    baselineValue,
    indexValue: calculateIndex(currentValue, baselineValue),
    playerBaselineValue,
    peerBaselineValue,
    baselineWeight,
    baselineNumerator,
    baselineDenominator,
    currentWindowExcluded: true,
    source: shouldBlend ? "player_peer_blend" : "player_non_overlapping",
    warnings,
  };
}

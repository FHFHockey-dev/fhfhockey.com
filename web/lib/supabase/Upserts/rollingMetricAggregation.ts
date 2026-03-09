export type RollingWindow = 3 | 5 | 10 | 20;

export const DEFAULT_ROLLING_WINDOWS: RollingWindow[] = [3, 5, 10, 20];

export type RatioComponents = {
  numerator: number | null | undefined;
  denominator: number | null | undefined;
  secondaryNumerator?: number | null | undefined;
  secondaryDenominator?: number | null | undefined;
};

export type RatioAggregationSpec = {
  scale?: number;
  combine?: "primary" | "sum";
  outputScale?: number;
  zeroWhenNoDenominator?: boolean;
  zeroWhenSecondaryNoDenominator?: boolean;
};

type NormalizedRatioComponents = {
  numerator: number;
  denominator: number;
  secondaryNumerator: number;
  secondaryDenominator: number;
};

type RatioTotals = {
  numerator: number;
  denominator: number;
  secondaryNumerator: number;
  secondaryDenominator: number;
  count: number;
};

type RatioWindowTotals = RatioTotals & {
  values: NormalizedRatioComponents[];
};

type RatioSeasonBucket = RatioTotals;

export type RatioRollingAccumulator = {
  totals: RatioTotals;
  windows: Record<RollingWindow, RatioWindowTotals>;
};

export type HistoricalRatioAccumulator = {
  bySeason: Map<number, RatioSeasonBucket>;
};

export type HistoricalRatioSnapshot = {
  season: number | null;
  threeYear: number | null;
  career: number | null;
};

function createRatioTotals(): RatioTotals {
  return {
    numerator: 0,
    denominator: 0,
    secondaryNumerator: 0,
    secondaryDenominator: 0,
    count: 0
  };
}

function normalizeComponent(value: number | null | undefined): number {
  if (value == null) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasAnyDenominator(components: NormalizedRatioComponents): boolean {
  return components.denominator > 0 || components.secondaryDenominator > 0;
}

function getSeasonWindowKey(season: number): number {
  if (!Number.isFinite(season)) return season;
  return season >= 10000000 ? Math.floor(season / 10000) : season;
}

function computeRatioValue(
  totals: RatioTotals,
  spec: RatioAggregationSpec
): number | null {
  const scale = spec.scale ?? 1;
  const combine = spec.combine ?? "primary";
  const outputScale = spec.outputScale ?? 1;

  const primary =
    totals.denominator > 0
      ? (totals.numerator / totals.denominator) * scale
      : spec.zeroWhenNoDenominator
        ? 0
        : null;

  if (combine === "primary") {
    return primary == null ? null : Number((primary * outputScale).toFixed(6));
  }

  const secondary =
    totals.secondaryDenominator > 0
      ? (totals.secondaryNumerator / totals.secondaryDenominator) * scale
      : spec.zeroWhenSecondaryNoDenominator
        ? 0
        : null;

  if (primary == null || secondary == null) return null;
  return Number(((primary + secondary) * outputScale).toFixed(6));
}

export function createRatioRollingAccumulator(
  windows: RollingWindow[] = DEFAULT_ROLLING_WINDOWS
): RatioRollingAccumulator {
  const windowMap = windows.reduce<Record<RollingWindow, RatioWindowTotals>>(
    (acc, window) => {
      acc[window] = {
        ...createRatioTotals(),
        values: []
      };
      return acc;
    },
    {} as Record<RollingWindow, RatioWindowTotals>
  );

  return {
    totals: createRatioTotals(),
    windows: windowMap
  };
}

export function updateRatioRollingAccumulator(
  acc: RatioRollingAccumulator,
  components: RatioComponents | null | undefined,
  windows: RollingWindow[] = DEFAULT_ROLLING_WINDOWS
): void {
  if (!components) return;

  const normalized: NormalizedRatioComponents = {
    numerator: normalizeComponent(components.numerator),
    denominator: normalizeComponent(components.denominator),
    secondaryNumerator: normalizeComponent(components.secondaryNumerator),
    secondaryDenominator: normalizeComponent(components.secondaryDenominator)
  };

  if (!hasAnyDenominator(normalized)) {
    return;
  }

  acc.totals.numerator += normalized.numerator;
  acc.totals.denominator += normalized.denominator;
  acc.totals.secondaryNumerator += normalized.secondaryNumerator;
  acc.totals.secondaryDenominator += normalized.secondaryDenominator;
  acc.totals.count += 1;

  windows.forEach((windowSize) => {
    const window = acc.windows[windowSize];
    window.values.push(normalized);
    window.numerator += normalized.numerator;
    window.denominator += normalized.denominator;
    window.secondaryNumerator += normalized.secondaryNumerator;
    window.secondaryDenominator += normalized.secondaryDenominator;
    window.count += 1;

    if (window.values.length > windowSize) {
      const removed = window.values.shift();
      if (removed) {
        window.numerator -= removed.numerator;
        window.denominator -= removed.denominator;
        window.secondaryNumerator -= removed.secondaryNumerator;
        window.secondaryDenominator -= removed.secondaryDenominator;
        window.count -= 1;
      }
    }
  });
}

export function getRatioRollingSnapshot(
  acc: RatioRollingAccumulator,
  spec: RatioAggregationSpec,
  windows: RollingWindow[] = DEFAULT_ROLLING_WINDOWS
): {
  all: number | null;
  windows: Record<RollingWindow, number | null>;
} {
  const snapshot = windows.reduce<Record<RollingWindow, number | null>>(
    (result, windowSize) => {
      result[windowSize] = computeRatioValue(acc.windows[windowSize], spec);
      return result;
    },
    {} as Record<RollingWindow, number | null>
  );

  return {
    all: computeRatioValue(acc.totals, spec),
    windows: snapshot
  };
}

export function createHistoricalRatioAccumulator(): HistoricalRatioAccumulator {
  return {
    bySeason: new Map()
  };
}

export function updateHistoricalRatioAccumulator(
  acc: HistoricalRatioAccumulator,
  season: number,
  components: RatioComponents | null | undefined
): void {
  if (!components) return;

  const normalized: NormalizedRatioComponents = {
    numerator: normalizeComponent(components.numerator),
    denominator: normalizeComponent(components.denominator),
    secondaryNumerator: normalizeComponent(components.secondaryNumerator),
    secondaryDenominator: normalizeComponent(components.secondaryDenominator)
  };

  if (!hasAnyDenominator(normalized)) {
    return;
  }

  const bucket = acc.bySeason.get(season) ?? createRatioTotals();
  bucket.numerator += normalized.numerator;
  bucket.denominator += normalized.denominator;
  bucket.secondaryNumerator += normalized.secondaryNumerator;
  bucket.secondaryDenominator += normalized.secondaryDenominator;
  bucket.count += 1;
  acc.bySeason.set(season, bucket);
}

export function getHistoricalRatioSnapshot(
  acc: HistoricalRatioAccumulator,
  currentSeason: number,
  spec: RatioAggregationSpec
): HistoricalRatioSnapshot {
  const currentSeasonKey = getSeasonWindowKey(currentSeason);
  const seasonBucket = acc.bySeason.get(currentSeason) ?? null;
  const threeYearBucket = createRatioTotals();
  const careerBucket = createRatioTotals();

  for (const [season, bucket] of acc.bySeason.entries()) {
    const seasonKey = getSeasonWindowKey(season);
    if (seasonKey >= currentSeasonKey - 2 && seasonKey <= currentSeasonKey) {
      threeYearBucket.numerator += bucket.numerator;
      threeYearBucket.denominator += bucket.denominator;
      threeYearBucket.secondaryNumerator += bucket.secondaryNumerator;
      threeYearBucket.secondaryDenominator += bucket.secondaryDenominator;
      threeYearBucket.count += bucket.count;
    }

    careerBucket.numerator += bucket.numerator;
    careerBucket.denominator += bucket.denominator;
    careerBucket.secondaryNumerator += bucket.secondaryNumerator;
    careerBucket.secondaryDenominator += bucket.secondaryDenominator;
    careerBucket.count += bucket.count;
  }

  return {
    season: seasonBucket ? computeRatioValue(seasonBucket, spec) : null,
    threeYear: computeRatioValue(threeYearBucket, spec),
    career: computeRatioValue(careerBucket, spec)
  };
}

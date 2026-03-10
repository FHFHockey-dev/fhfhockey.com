import type { RatioComponents } from "./rollingMetricAggregation";

export function resolvePer60Components(args: {
  rawValue: number | null | undefined;
  toiSeconds: number | null | undefined;
  per60Rate?: number | null | undefined;
}): RatioComponents | null {
  const toiSeconds =
    args.toiSeconds != null && Number.isFinite(args.toiSeconds)
      ? Number(args.toiSeconds)
      : null;
  if (toiSeconds == null || toiSeconds <= 0) {
    return null;
  }

  if (args.rawValue != null && Number.isFinite(args.rawValue)) {
    return {
      numerator: Number(args.rawValue),
      denominator: toiSeconds
    };
  }

  if (args.per60Rate != null && Number.isFinite(args.per60Rate)) {
    return {
      numerator: (Number(args.per60Rate) * toiSeconds) / 3600,
      denominator: toiSeconds
    };
  }

  return null;
}

export function resolveShareComponents(args: {
  numeratorValue: number | null | undefined;
  share: number | null | undefined;
}): RatioComponents | null {
  const numeratorValue =
    args.numeratorValue != null && Number.isFinite(args.numeratorValue)
      ? Number(args.numeratorValue)
      : null;
  const share =
    args.share != null && Number.isFinite(args.share) ? Number(args.share) : null;

  if (numeratorValue == null || numeratorValue < 0 || share == null || share <= 0) {
    return null;
  }

  return {
    numerator: numeratorValue,
    denominator: numeratorValue / share
  };
}

export function resolvePreferredShareComponents(args: {
  primaryNumeratorValue: number | null | undefined;
  primaryShare: number | null | undefined;
  fallbackNumeratorValue?: number | null | undefined;
  fallbackShare?: number | null | undefined;
}): RatioComponents | null {
  return (
    resolveShareComponents({
      numeratorValue: args.primaryNumeratorValue,
      share: args.primaryShare
    }) ??
    resolveShareComponents({
      numeratorValue: args.fallbackNumeratorValue,
      share: args.fallbackShare
    })
  );
}

export function resolveIxgValue(args: {
  strength: "all" | "ev" | "pp" | "pk";
  countsIxg: number | null | undefined;
  wgoIxg: number | null | undefined;
}): number | null {
  if (args.countsIxg != null && Number.isFinite(args.countsIxg)) {
    return Number(args.countsIxg);
  }

  if (args.strength === "all" && args.wgoIxg != null && Number.isFinite(args.wgoIxg)) {
    return Number(args.wgoIxg);
  }

  return null;
}

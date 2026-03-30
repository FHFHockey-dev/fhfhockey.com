import {
  TREND_BAND_METRIC_PRIORITY,
  TREND_BAND_WINDOW_PRIORITY
} from "../constants/projection-weights";
import type {
  SkaterTrendAdjustment,
  SustainabilityTrendBandRow
} from "../types/run-forge-projections.types";
import { daysBetweenDates, parseDateOnly } from "./date-utils";
import { clamp, finiteOrNull } from "./number-utils";

const metricPriority = new Map<string, number>(
  TREND_BAND_METRIC_PRIORITY.map((metric, idx) => [metric, idx])
);
const windowPriority = new Map<string, number>(
  TREND_BAND_WINDOW_PRIORITY.map((windowCode, idx) => [windowCode, idx])
);

export type TrendBandRecencyClass = "fresh" | "soft_stale" | "hard_stale";

export function classifyTrendBandRecency(ageDays: number): TrendBandRecencyClass {
  if (ageDays <= 7) return "fresh";
  if (ageDays <= 20) return "soft_stale";
  return "hard_stale";
}

export function computeTrendAdjustmentRecencyWeight(ageDays: number): number {
  if (ageDays <= 3) return 1;
  if (ageDays >= 21) return 0;
  return clamp(1 - ((ageDays - 3) / 18), 0, 1);
}

export function compareTrendBandRowsForSelection(
  a: SustainabilityTrendBandRow,
  b: SustainabilityTrendBandRow,
  asOfDate: string
): number {
  const ageA = Math.max(0, daysBetweenDates(asOfDate, a.snapshot_date));
  const ageB = Math.max(0, daysBetweenDates(asOfDate, b.snapshot_date));
  if (ageA !== ageB) return ageA - ageB;

  const metricDelta =
    (metricPriority.get(a.metric_key) ?? 99) -
    (metricPriority.get(b.metric_key) ?? 99);
  if (metricDelta !== 0) return metricDelta;

  const windowDelta =
    (windowPriority.get(a.window_code) ?? 99) -
    (windowPriority.get(b.window_code) ?? 99);
  if (windowDelta !== 0) return windowDelta;

  const dateA = parseDateOnly(a.snapshot_date) ?? "";
  const dateB = parseDateOnly(b.snapshot_date) ?? "";
  return dateB.localeCompare(dateA);
}

export function computeSkaterTrendAdjustment(args: {
  row: SustainabilityTrendBandRow;
  asOfDate: string;
}): SkaterTrendAdjustment | null {
  const value = finiteOrNull(args.row.value);
  const ciLower = finiteOrNull(args.row.ci_lower);
  const ciUpper = finiteOrNull(args.row.ci_upper);
  const snapshotDate = parseDateOnly(args.row.snapshot_date);
  if (value == null || ciLower == null || ciUpper == null || !snapshotDate) {
    return null;
  }

  const lower = Math.min(ciLower, ciUpper);
  const upper = Math.max(ciLower, ciUpper);
  const bandWidth = Math.max(upper - lower, 1e-4);
  let signedDistance = 0;
  if (value > upper) {
    signedDistance = (value - upper) / bandWidth;
  } else if (value < lower) {
    signedDistance = -((lower - value) / bandWidth);
  }

  const boundedDistance = clamp(signedDistance, -2, 2);
  const nEff = finiteOrNull(args.row.n_eff);
  const nEffWeight = nEff == null ? 0.6 : clamp(nEff / 8, 0.35, 1);
  const ageDays = Math.max(0, daysBetweenDates(args.asOfDate, snapshotDate));
  const recencyClass = classifyTrendBandRecency(ageDays);
  const recencyWeight = computeTrendAdjustmentRecencyWeight(ageDays);
  const confidence = clamp(nEffWeight * recencyWeight, 0, 1);

  if (Math.abs(boundedDistance) < 1e-6 || confidence <= 1e-6) {
    const effectState =
      Math.abs(boundedDistance) < 1e-6
        ? "within_band_neutral"
        : "neutralized_by_recency";
    return {
      metricKey: args.row.metric_key,
      windowCode: args.row.window_code,
      snapshotDate,
      ageDays,
      recencyClass,
      effectState,
      value,
      ciLower: lower,
      ciUpper: upper,
      nEff,
      confidence:
        effectState === "within_band_neutral" ? Number(confidence.toFixed(4)) : 0,
      signedDistance: 0,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      uncertaintyVolatilityMultiplier: 1
    };
  }

  const weightedSignal = boundedDistance * confidence;

  return {
    metricKey: args.row.metric_key,
    windowCode: args.row.window_code,
    snapshotDate,
    ageDays,
    recencyClass,
    effectState: "applied",
    value,
    ciLower: lower,
    ciUpper: upper,
    nEff,
    confidence: Number(confidence.toFixed(4)),
    signedDistance: Number(weightedSignal.toFixed(4)),
    shotRateMultiplier: Number(clamp(1 + weightedSignal * 0.08, 0.88, 1.12).toFixed(4)),
    goalRateMultiplier: Number(clamp(1 + weightedSignal * 0.1, 0.86, 1.14).toFixed(4)),
    assistRateMultiplier: Number(clamp(1 + weightedSignal * 0.08, 0.88, 1.12).toFixed(4)),
    uncertaintyVolatilityMultiplier: Number(
      (1 + clamp(Math.abs(weightedSignal) * 0.45, 0, 0.55)).toFixed(4)
    )
  };
}

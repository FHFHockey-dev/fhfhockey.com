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

/**
 * Decision 26: the band reader regresses toward the band (above-band form is expected to come back
 * down; never momentum), with a size fitted and validated first (L7 owns the band redesign). Until a
 * fitted size is supplied the reader is inert: it reports the distance but moves no rate.
 * `fittedRegressionSize` is the share of the band-relative excess expected NOT to persist, per unit
 * of weighted band distance; it comes from L7's validated fit, never a default here.
 */
export type TrendBandReaderMode =
  | { mode: "inert" }
  | { mode: "regress_toward_band"; fittedRegressionSize: number; fitVersion: string };

export function resolveTrendBandReaderMode(env: Record<string, string | undefined> = process.env): TrendBandReaderMode {
  const size = Number(env.FORGE_TREND_BAND_REGRESSION_SIZE);
  const version = env.FORGE_TREND_BAND_REGRESSION_FIT_VERSION?.trim();
  return env.FORGE_TREND_BAND_READER === "regress_toward_band" && Number.isFinite(size) && size > 0 && size <= 1 && version
    ? { mode: "regress_toward_band", fittedRegressionSize: size, fitVersion: version }
    : { mode: "inert" };
}

export function computeSkaterTrendAdjustment(args: {
  row: SustainabilityTrendBandRow;
  asOfDate: string;
  reader?: TrendBandReaderMode;
}): SkaterTrendAdjustment | null {
  const reader = args.reader ?? resolveTrendBandReaderMode();
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
  if (reader.mode === "inert") {
    return {
      metricKey: args.row.metric_key,
      windowCode: args.row.window_code,
      snapshotDate,
      ageDays,
      recencyClass,
      effectState: "inert_pending_fitted_regression",
      value,
      ciLower: lower,
      ciUpper: upper,
      nEff,
      confidence: Number(confidence.toFixed(4)),
      signedDistance: Number(weightedSignal.toFixed(4)),
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      uncertaintyVolatilityMultiplier: 1
    };
  }
  // Toward the band: above-band (positive distance) lowers the rates, below-band raises them.
  const toward = (scale: number) =>
    Number(Math.max(0, 1 - reader.fittedRegressionSize * weightedSignal * scale).toFixed(4));

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
    shotRateMultiplier: toward(1),
    goalRateMultiplier: toward(1),
    assistRateMultiplier: toward(1),
    // The band is not evidence of extra volatility until that is fitted too.
    uncertaintyVolatilityMultiplier: 1,
    regressionFitVersion: reader.fitVersion
  };
}

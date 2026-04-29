import { describe, expect, it } from "vitest";

import {
  PREGAME_PREDICTION_REFRESH_POLICY,
  buildPredictionHealthChecks,
  buildWalkForwardSplits,
  decidePromotion,
} from "./workflow";

describe("game prediction workflow", () => {
  it("defines repeated same-day pregame refresh windows", () => {
    expect(PREGAME_PREDICTION_REFRESH_POLICY).toMatchObject({
      allowMultipleSameDayRefreshes: true,
      route: "/api/v1/game-predictions/generate",
      scoringRoute: "/api/v1/game-predictions/score",
    });
    expect(PREGAME_PREDICTION_REFRESH_POLICY.windowsBeforeStartHours).toEqual([24, 6, 1]);
  });

  it("builds walk-forward splits without random shuffling", () => {
    const examples = [
      { snapshotDate: "2026-01-05", id: 5 },
      { snapshotDate: "2026-01-01", id: 1 },
      { snapshotDate: "2026-01-02", id: 2 },
      { snapshotDate: "2026-01-03", id: 3 },
      { snapshotDate: "2026-01-04", id: 4 },
    ];
    const splits = buildWalkForwardSplits(examples, 2, 1);

    expect(splits).toHaveLength(3);
    expect(splits[0].train.map((row) => row.id)).toEqual([1, 2]);
    expect(splits[0].validation.map((row) => row.id)).toEqual([3]);
    expect(splits[1].train.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("requires meaningful metric improvement before promotion", () => {
    expect(
      decidePromotion({
        current: { logLoss: 0.66, brierScore: 0.23, calibrationMaxGap: 0.04, evaluatedGames: 300 },
        candidate: { logLoss: 0.655, brierScore: 0.228, calibrationMaxGap: 0.03, evaluatedGames: 300 },
      })
    ).toEqual({ promote: true, reasons: [] });

    const rejected = decidePromotion({
      current: { logLoss: 0.66, brierScore: 0.23, calibrationMaxGap: 0.04, evaluatedGames: 300 },
      candidate: { logLoss: 0.659, brierScore: 0.24, calibrationMaxGap: 0.08, evaluatedGames: 20 },
    });

    expect(rejected.promote).toBe(false);
    expect(rejected.reasons.length).toBeGreaterThan(1);
  });

  it("reports workflow health warnings", () => {
    expect(
      buildPredictionHealthChecks({
        staleSourceCount: 0,
        missingPredictionCount: 0,
        failedJobCount: 0,
        staleModelAgeDays: 2,
        recentLogLoss: 0.66,
        referenceLogLoss: 0.65,
      })
    ).toEqual([{ status: "pass", code: "healthy", message: "No prediction workflow health warnings detected." }]);

    const checks = buildPredictionHealthChecks({
      staleSourceCount: 1,
      missingPredictionCount: 2,
      failedJobCount: 1,
      staleModelAgeDays: 21,
      recentLogLoss: 0.69,
      referenceLogLoss: 0.65,
    });

    expect(checks.map((check) => check.code)).toEqual([
      "stale_sources",
      "missing_predictions",
      "failed_jobs",
      "stale_model",
      "metric_degradation",
    ]);
  });
});

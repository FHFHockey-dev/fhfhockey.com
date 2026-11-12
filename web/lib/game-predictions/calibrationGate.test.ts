import { describe, expect, it } from "vitest";

import {
  buildConfidenceCalibrationBuckets,
  calibrationMaxGapFromBuckets,
  type PredictionCandlestick,
} from "./accountability";

// BC W1-10 B (D8): a fixed empirical max-gap rule fails a calibrated
// forecaster by chance. The gate statistic is the largest bin gap beyond the
// bin's 95% sampling band, over bins with enough decided games.

function candles(count: number, probability: number, correctCount: number): PredictionCandlestick[] {
  return Array.from({ length: count }, (_, index) => {
    const correct = index < correctCount;
    return {
      gameId: index + 1, snapshotDate: "2026-01-10", startTime: null,
      homeTeamId: 1, awayTeamId: 2, homeTeamAbbreviation: "A", awayTeamAbbreviation: "B",
      openHomeWinProbability: probability, lowHomeWinProbability: probability,
      highHomeWinProbability: probability, finalHomeWinProbability: probability,
      actualHomeWinProbability: correct ? 1 : 0, probabilitySpread: 0, predictionCount: 1,
      finalPredictionId: null, finalPredictionCutoffAt: "2026-01-10T22:00:00Z",
      predictedWinnerTeamId: 1, actualWinnerTeamId: correct ? 1 : 2,
      predictedWinnerCorrect: correct, homeScore: correct ? 3 : 1, awayScore: correct ? 1 : 3,
    };
  });
}

describe("calibration gate statistic", () => {
  it("does not flag a single miss at 85% (old rule: gap .85)", () => {
    expect(calibrationMaxGapFromBuckets(buildConfidenceCalibrationBuckets(candles(1, 0.85, 0)))).toBeNull();
  });

  it("is zero for an exactly calibrated bin", () => {
    expect(calibrationMaxGapFromBuckets(buildConfidenceCalibrationBuckets(candles(100, 0.7, 70)))).toBe(0);
  });

  it("does not flag a gap inside the sampling band", () => {
    // 100 games at 70%, 63 right: gap .07 < 1.96 * sqrt(.21 / 100) = .0898.
    expect(calibrationMaxGapFromBuckets(buildConfidenceCalibrationBuckets(candles(100, 0.7, 63)))).toBe(0);
  });

  it("measures a real miscalibration beyond the band", () => {
    // 200 games at 70%, 100 right: gap .2, band 1.96 * sqrt(.21 / 200) = .06351.
    const gap = calibrationMaxGapFromBuckets(buildConfidenceCalibrationBuckets(candles(200, 0.7, 100)));
    expect(gap).toBeCloseTo(0.2 - 1.96 * Math.sqrt(0.21 / 200), 6);
  });
});

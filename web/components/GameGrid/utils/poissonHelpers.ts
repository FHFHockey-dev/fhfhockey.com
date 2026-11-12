// components/GameGrid/utils/poissonHelpers.ts

import { poissonProbability } from "./poisson";
import {
  finalWinProbabilitiesFromRegulation,
  type FinalWinProbabilities
} from "lib/game-predictions/overtimeRule";

/**
 * Regulation score grid for two independent Poisson rates (home goals on the
 * rows, away goals on the columns). The diagonal keeps the regulation-tie mass;
 * overtime is resolved only through the shared rule (decision 45) in
 * `matrixFinalWinProbabilities`. Invalid (negative, NaN, infinite) rates give
 * null rather than a fabricated 0-0 certainty (BC W1-10 A).
 */
export const generateProbabilityMatrixWithTieBreaker = (
  homeLambda: number,
  awayLambda: number,
  maxGoals: number = 10
): number[][] | null => {
  if (
    ![homeLambda, awayLambda].every(
      (lambda) => Number.isFinite(lambda) && lambda >= 0
    )
  ) {
    return null;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= maxGoals; i++) {
    matrix[i] = [];
    for (let j = 0; j <= maxGoals; j++) {
      matrix[i][j] =
        poissonProbability(i, homeLambda) * poissonProbability(j, awayLambda);
    }
  }
  return matrix;
};

/** Final (OT/SO included) win probabilities from the grid, via the shared OT rule. */
export const matrixFinalWinProbabilities = (
  matrix: number[][]
): FinalWinProbabilities | null => {
  let homeRegulationWin = 0;
  let awayRegulationWin = 0;
  let regulationTie = 0;
  matrix.forEach((row, i) =>
    row.forEach((p, j) => {
      if (i > j) homeRegulationWin += p;
      else if (i < j) awayRegulationWin += p;
      else regulationTie += p;
    })
  );
  return finalWinProbabilitiesFromRegulation({
    homeRegulationWin,
    awayRegulationWin,
    regulationTie
  });
};

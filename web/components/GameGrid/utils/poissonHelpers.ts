// components/GameGrid/utils/poissonHelpers.ts

import { poissonProbability } from "./poisson";

// Function to generate probability matrix with tie-breaker
export const generateProbabilityMatrixWithTieBreaker = (
  homeLambda: number,
  awayLambda: number,
  maxGoals: number = 10
): number[][] => {
  const matrix: number[][] = [];

  // First pass: calculate probabilities
  for (let i = 0; i <= maxGoals; i++) {
    matrix[i] = [];
    for (let j = 0; j <= maxGoals; j++) {
      // i: home team goals (Y-axis)
      // j: away team goals (X-axis)
      const homeProb = poissonProbability(i, homeLambda); // Home team scoring i goals
      const awayProb = poissonProbability(j, awayLambda); // Away team scoring j goals
      matrix[i][j] = homeProb * awayProb;
    }
  }

  // Sum probabilities for home wins, away wins, and draws
  let homeWinProb = 0;
  let awayWinProb = 0;
  let drawProb = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      if (i > j) {
        // Home team wins
        homeWinProb += matrix[i][j];
      } else if (i < j) {
        // Away team wins
        awayWinProb += matrix[i][j];
      } else {
        // Draw
        drawProb += matrix[i][j];
      }
    }
  }

  // Calculate redistribution ratios based on Lambdas
  const totalWinProb = homeWinProb + awayWinProb;
  const homeWinRatio = homeWinProb / totalWinProb;
  const awayWinRatio = awayWinProb / totalWinProb;

  // Redistribute draw probabilities
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      if (i === j) {
        const originalProb = matrix[i][j];
        matrix[i][j] = 0;
        // Redistribute draw probability proportionally
        matrix[i][j] += originalProb * homeWinRatio;
        matrix[i][j] += originalProb * awayWinRatio;
      }
    }
  }

  return matrix;
};

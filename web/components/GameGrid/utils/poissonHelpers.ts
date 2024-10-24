// components/GameGrid/utils/poissonHelpers.ts

import { poissonProbability } from "./poisson";

// Function to generate probability matrix with tie-breaker
export const generateProbabilityMatrixWithTieBreaker = (
  homeLambda: number,
  awayLambda: number,
  maxGoals: number = 10
): number[][] => {
  const matrix: number[][] = [];
  let totalNonDrawProb = 0;

  // First pass: calculate probabilities and sum non-draw probabilities
  for (let i = 0; i <= maxGoals; i++) {
    matrix[i] = [];
    for (let j = 0; j <= maxGoals; j++) {
      const homeProb = poissonProbability(j, homeLambda); // Home team on X-axis
      const awayProb = poissonProbability(i, awayLambda); // Away team on Y-axis
      matrix[i][j] = homeProb * awayProb;
      if (i !== j) {
        totalNonDrawProb += matrix[i][j];
      }
    }
  }

  // Second pass: calculate draw probabilities
  let drawProb = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      if (i === j) {
        drawProb += matrix[i][j];
      }
    }
  }

  // Calculate redistribution ratios based on Lambdas
  const totalLambda = homeLambda + awayLambda;
  const homeWinRatio = homeLambda / totalLambda;
  const awayWinRatio = awayLambda / totalLambda;

  // Third pass: redistribute draw probabilities
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      if (i === j) {
        // Remove ties
        const originalProb = matrix[i][j];
        matrix[i][j] = 0;

        // Redistribute
        matrix[i][j] += homeWinRatio * originalProb;
        matrix[j][i] += awayWinRatio * originalProb;
      }
    }
  }

  return matrix;
};

// lib/supabase/utils/skoScore.js

/**
 * Calculates the Sko score by applying weights to z-scores.
 * @param {object} zScores - Object containing z-scores for various stats.
 * @param {object} statWeights - Object containing weights for each stat.
 * @returns {string} - The calculated Sko score rounded to two decimal places.
 */
function calculateSkoScore(zScores, statWeights) {
  let skoScore = 0;
  let totalWeight = 0;

  Object.keys(zScores).forEach((stat) => {
    const weight = statWeights[stat] || 0; // Default to 0 if weight not found
    skoScore += zScores[stat] * weight;
    totalWeight += weight;
  });

  // Avoid division by zero
  const normalizedSkoScore = totalWeight > 0 ? skoScore / totalWeight : 0;

  return normalizedSkoScore.toFixed(2);
}

/**
 * Assesses the sustainability of a performance based on the Sko score and p-value.
 * @param {number} skoScore - The Sko score (z-score based).
 * @param {number} pValue - The average p-value across stats.
 * @param {number} significanceLevel - The significance level for p-value (default is 0.05).
 * @returns {string} - Sustainability assessment ('Sustainable', 'Unsustainable (Above Average)', 'Unsustainable (Below Average)').
 */
function assessSustainability(skoScore, pValue, significanceLevel = 0.05) {
  if (pValue < significanceLevel) {
    return skoScore > 0
      ? "Unsustainable (Above Average)"
      : "Unsustainable (Below Average)";
  } else {
    return "Sustainable";
  }
}

/**
 * Calculates the Sko score for a specific period by comparing game stats to period averages.
 * @param {object} gameStats - The current game stats.
 * @param {object} perGameAverages - The per-game averages for different periods.
 * @param {object} stdDevs - The standard deviations for different periods.
 * @param {string} period - The period identifier ('three', 'two', 'last', 'weight').
 * @param {object} statWeights - The weights assigned to each stat.
 * @returns {string} - The calculated Sko score for the period, rounded to two decimal places.
 */
function calculatePeriodSkoScore(
  gameStats,
  perGameAverages,
  stdDevs,
  period,
  statWeights
) {
  const periodAverages = perGameAverages[period];
  const periodStdDevs = stdDevs[period];

  if (!periodAverages || !periodStdDevs) {
    console.warn(`Insufficient data for period: ${period}. Returning 0.`);
    return "0.00";
  }

  let skoScore = 0;
  let totalWeight = 0;

  Object.keys(statWeights).forEach((stat) => {
    const gameStat = gameStats[stat] || 0;
    const avgStat = periodAverages[stat] || 0;
    const stdDevStat = periodStdDevs[stat] || 1; // Prevent division by zero
    const zScore = (gameStat - avgStat) / stdDevStat;
    const weight = statWeights[stat] || 0;
    skoScore += zScore * weight;
    totalWeight += weight;
  });

  const normalizedSkoScore = totalWeight > 0 ? skoScore / totalWeight : 0;
  return normalizedSkoScore.toFixed(2);
}

module.exports = {
  calculateSkoScore,
  assessSustainability,
  calculatePeriodSkoScore, // Export the new function
};

// lib/supabase/utils/bayesianInference.js

const { normal } = require("jstat"); // Ensure jstat is installed: npm install jstat

/**
 * Updates Bayesian parameters for a stat using observed data.
 * Assumes Normal-Normal conjugacy.
 * @param {object} prior - The prior parameters { mean, variance }.
 * @param {number} observation - The new observed stat value.
 * @param {number} observationVariance - The variance of the observation.
 * @returns {object} - The updated posterior parameters { mean, variance }.
 */
function bayesianUpdate(prior, observation, observationVariance = 1) {
  const priorPrecision = 1 / prior.variance;
  const observationPrecision = 1 / observationVariance;

  const posteriorPrecision = priorPrecision + observationPrecision;
  const posteriorMean =
    (prior.mean * priorPrecision + observation * observationPrecision) /
    posteriorPrecision;
  const posteriorVariance = 1 / posteriorPrecision;

  return { mean: posteriorMean, variance: posteriorVariance };
}

/**
 * Calculates the probability (p-value) of observing a z-score as extreme or more extreme.
 * @param {number} zScore - The z-score.
 * @returns {number} - Two-tailed p-value.
 */
function calculateProbability(zScore) {
  // Two-tailed p-value
  const pValue = 2 * (1 - normal.cdf(Math.abs(zScore), 0, 1));
  return pValue;
}

module.exports = {
  bayesianUpdate,
  calculateProbability,
};

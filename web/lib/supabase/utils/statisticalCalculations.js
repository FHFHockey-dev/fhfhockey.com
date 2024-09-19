// lib/supabase/utils/statisticalCalculations.js

/**
 * Calculates the mean of an array.
 * @param {number[]} arr - Array of numbers.
 * @returns {number} - Mean value.
 */
function mean(arr) {
  return arr.length > 0
    ? arr.reduce((sum, val) => sum + val, 0) / arr.length
    : 0;
}

/**
 * Calculates the standard deviation of an array.
 * @param {number[]} arr - Array of numbers.
 * @returns {number} - Standard deviation.
 */
function stdDev(arr) {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(
    arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length
  );
}

module.exports = {
  mean,
  stdDev,
};

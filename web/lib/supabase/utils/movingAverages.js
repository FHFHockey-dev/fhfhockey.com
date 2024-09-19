// lib/supabase/utils/movingAverages.js

/**
 * Calculates the rolling average for a given stat over the game queue.
 * @param {Array} gameQueue - Array of recent game stats.
 * @param {string} stat - The stat to calculate the average for.
 * @returns {number} - Rolling average.
 */
function calculateRollingAverage(gameQueue, stat) {
  const sum = gameQueue.reduce((acc, game) => acc + (game[stat] || 0), 0);
  return gameQueue.length > 0 ? sum / gameQueue.length : 0;
}

/**
 * Calculates the Exponential Moving Average (EMA) for a stat.
 * @param {number|null} previousEMA - The previous EMA value. If null, initializes with current stat.
 * @param {number} currentStat - The current game stat value.
 * @param {number} alpha - Smoothing factor (default is 0.3).
 * @returns {number} - Updated EMA.
 */
function calculateEMA(previousEMA, currentStat, alpha = 0.3) {
  if (previousEMA === null || isNaN(previousEMA)) return currentStat;
  return alpha * currentStat + (1 - alpha) * previousEMA;
}

module.exports = {
  calculateRollingAverage,
  calculateEMA,
};

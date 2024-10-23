// pages/api/v1/db/update-expected-goals/utils.ts

/**
 * Calculates the Poisson probability for a given number of events (k) and expected events (lambda).
 * @param k - Number of events.
 * @param lambda - Expected number of events.
 */
export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0 || isNaN(lambda)) {
    return k === 0 ? 1 : 0;
  }
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

const factorialMemo: { [key: number]: number } = {};

/**
 * Calculates the factorial of a number with memoization for optimization.
 * @param n - The number to calculate the factorial for.
 */
function factorial(n: number): number {
  if (n === 0) return 1;
  if (factorialMemo[n]) return factorialMemo[n];
  let result = 1;
  for (let i = 1; i <= n; i++) {
    result *= i;
  }
  factorialMemo[n] = result;
  return result;
}

// components/GameGrid/utils/poisson.ts

export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0 || isNaN(lambda)) {
    return k === 0 ? 1 : 0;
  }
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

const factorialMemo: { [key: number]: number } = {};

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

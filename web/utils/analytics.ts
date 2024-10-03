// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\utils\analytics.ts

// Bayesian Updating function
interface Prior {
  mean: number;
  variance: number;
}

interface BayesianResult {
  mean: number;
  variance: number;
}

export const calculateBayesianUpdate = (
  prior: Prior,
  observation: number,
  observationVariance: number
): BayesianResult => {
  const precisionPrior = 1 / prior.variance;
  const precisionObservation = 1 / observationVariance;

  const updatedMean =
    (precisionPrior * prior.mean + precisionObservation * observation) /
    (precisionPrior + precisionObservation);

  const updatedVariance = 1 / (precisionPrior + precisionObservation);

  return { mean: updatedMean, variance: updatedVariance };
};

// Calculate Exponential Moving Average
export const calculateEMA = (
  data: number[],
  windowSize: number,
  smoothingFactor: number = 2
): number[] => {
  const ema: number[] = [];
  const alpha = smoothingFactor / (windowSize + 1);

  ema[0] = data[0]; // Initialize EMA with the first data point

  for (let i = 1; i < data.length; i++) {
    ema[i] = alpha * data[i] + (1 - alpha) * ema[i - 1];
  }

  return ema;
};

// Calculate Rolling Average
export const calculateRollingAverage = (
  data: number[],
  windowSize: number
): number[] => {
  const rollingAverage: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      rollingAverage.push(0); // Not enough data to calculate average
      continue;
    }

    const window = data.slice(i - windowSize + 1, i + 1);
    const sum = window.reduce((acc, val) => acc + val, 0);
    const avg = sum / windowSize;
    rollingAverage.push(avg);
  }

  return rollingAverage;
};

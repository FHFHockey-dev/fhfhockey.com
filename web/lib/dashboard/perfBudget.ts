export type EndpointBudget = {
  endpoint: string;
  maxPayloadBytes: number;
  targetP95Ms: number;
};

export type BudgetEvaluation = {
  endpoint: string;
  payloadBytes: number;
  maxPayloadBytes: number;
  withinBudget: boolean;
};

export const DASHBOARD_ENDPOINT_BUDGETS: EndpointBudget[] = [
  { endpoint: "/api/team-ratings", maxPayloadBytes: 120_000, targetP95Ms: 800 },
  { endpoint: "/api/v1/forge/goalies", maxPayloadBytes: 220_000, targetP95Ms: 800 },
  { endpoint: "/api/v1/start-chart", maxPayloadBytes: 300_000, targetP95Ms: 900 },
  { endpoint: "/api/v1/trends/team-ctpi", maxPayloadBytes: 180_000, targetP95Ms: 800 },
  { endpoint: "/api/v1/trends/skater-power", maxPayloadBytes: 280_000, targetP95Ms: 900 },
  {
    endpoint: "/api/v1/sustainability/trends",
    maxPayloadBytes: 140_000,
    targetP95Ms: 850
  }
];

export const estimateJsonSizeBytes = (value: unknown): number => {
  try {
    const json = JSON.stringify(value);
    return Buffer.byteLength(json, "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

export const evaluatePayloadBudget = (
  endpoint: string,
  payload: unknown,
  budgets = DASHBOARD_ENDPOINT_BUDGETS
): BudgetEvaluation => {
  const budget = budgets.find((entry) => entry.endpoint === endpoint);
  const payloadBytes = estimateJsonSizeBytes(payload);

  if (!budget) {
    return {
      endpoint,
      payloadBytes,
      maxPayloadBytes: Number.POSITIVE_INFINITY,
      withinBudget: true
    };
  }

  return {
    endpoint,
    payloadBytes,
    maxPayloadBytes: budget.maxPayloadBytes,
    withinBudget: payloadBytes <= budget.maxPayloadBytes
  };
};

export const topHeavyBudgets = (
  evaluations: BudgetEvaluation[]
): BudgetEvaluation[] => {
  return [...evaluations].sort((a, b) => b.payloadBytes - a.payloadBytes);
};

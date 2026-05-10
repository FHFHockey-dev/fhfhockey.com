export type ProjectionGateMetric = {
  key: string;
  value: number | null;
  max?: number;
  min?: number;
  required?: boolean;
};

export type ProjectionPromotionGateResult = {
  status: "pass" | "warn" | "fail";
  failures: string[];
  warnings: string[];
};

export type ShadowComparisonInput = {
  baselineMae: number | null;
  candidateMae: number | null;
  minImprovementPct?: number;
};

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function evaluateProjectionPromotionGates(
  metrics: ProjectionGateMetric[]
): ProjectionPromotionGateResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const metric of metrics) {
    const value = finite(metric.value);
    if (value == null) {
      const message = `${metric.key} is missing`;
      if (metric.required ?? true) failures.push(message);
      else warnings.push(message);
      continue;
    }
    if (metric.max != null && value > metric.max) {
      failures.push(`${metric.key}=${value} exceeds max ${metric.max}`);
    }
    if (metric.min != null && value < metric.min) {
      failures.push(`${metric.key}=${value} below min ${metric.min}`);
    }
  }

  return {
    status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    failures,
    warnings
  };
}

export function evaluateShadowModeImprovement(
  input: ShadowComparisonInput
): {
  status: "pass" | "warn" | "fail";
  improvementPct: number | null;
  message: string;
} {
  const baselineMae = finite(input.baselineMae);
  const candidateMae = finite(input.candidateMae);
  const minImprovementPct = input.minImprovementPct ?? 0;
  if (baselineMae == null || candidateMae == null || baselineMae <= 0) {
    return {
      status: "fail",
      improvementPct: null,
      message: "Shadow comparison is missing valid baseline or candidate MAE."
    };
  }
  const improvementPct = Number(
    (((baselineMae - candidateMae) / baselineMae) * 100).toFixed(4)
  );
  if (improvementPct < 0) {
    return {
      status: "fail",
      improvementPct,
      message: `Candidate regressed by ${Math.abs(improvementPct).toFixed(2)}%.`
    };
  }
  if (improvementPct < minImprovementPct) {
    return {
      status: "warn",
      improvementPct,
      message: `Candidate improved by ${improvementPct.toFixed(2)}%, below ${minImprovementPct.toFixed(2)}% target.`
    };
  }
  return {
    status: "pass",
    improvementPct,
    message: `Candidate improved MAE by ${improvementPct.toFixed(2)}%.`
  };
}

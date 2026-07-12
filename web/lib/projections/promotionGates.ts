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

export type HoldoutComparisonSample = {
  actual: number;
  candidate: number;
  currentBaseline: number | null;
  naivePrior: number | null;
};

export type HoldoutMetricSummary = {
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
};

export type HoldoutComparatorReport = {
  comparator: "current_baseline" | "naive_prior";
  status: "ready" | "insufficient_data";
  candidate: HoldoutMetricSummary;
  baseline: HoldoutMetricSummary;
  maeDelta: number | null;
  rmseDelta: number | null;
  maeImprovementPct: number | null;
};

export type HoldoutComparisonReport = {
  status: "ready" | "insufficient_data";
  receivedSampleCount: number;
  minimumSampleCount: number;
  comparisons: {
    currentBaseline: HoldoutComparatorReport;
    naivePrior: HoldoutComparatorReport;
  };
};

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function evaluateProjectionPromotionGates(
  metrics: ProjectionGateMetric[],
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
    status:
      failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    failures,
    warnings,
  };
}

export function evaluateShadowModeImprovement(input: ShadowComparisonInput): {
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
      message: "Shadow comparison is missing valid baseline or candidate MAE.",
    };
  }
  const improvementPct = Number(
    (((baselineMae - candidateMae) / baselineMae) * 100).toFixed(4),
  );
  if (improvementPct < 0) {
    return {
      status: "fail",
      improvementPct,
      message: `Candidate regressed by ${Math.abs(improvementPct).toFixed(2)}%.`,
    };
  }
  if (improvementPct < minImprovementPct) {
    return {
      status: "warn",
      improvementPct,
      message: `Candidate improved by ${improvementPct.toFixed(2)}%, below ${minImprovementPct.toFixed(2)}% target.`,
    };
  }
  return {
    status: "pass",
    improvementPct,
    message: `Candidate improved MAE by ${improvementPct.toFixed(2)}%.`,
  };
}

function summarizeHoldoutMetric(
  samples: Array<{ predicted: number; actual: number }>,
): HoldoutMetricSummary {
  if (samples.length === 0) {
    return { sampleCount: 0, mae: null, rmse: null };
  }
  const errorAbs = samples.reduce(
    (sum, sample) => sum + Math.abs(sample.predicted - sample.actual),
    0,
  );
  const errorSq = samples.reduce(
    (sum, sample) => sum + Math.pow(sample.predicted - sample.actual, 2),
    0,
  );
  return {
    sampleCount: samples.length,
    mae: Number((errorAbs / samples.length).toFixed(4)),
    rmse: Number(Math.sqrt(errorSq / samples.length).toFixed(4)),
  };
}

function buildComparatorReport(args: {
  comparator: HoldoutComparatorReport["comparator"];
  samples: HoldoutComparisonSample[];
  readBaseline: (sample: HoldoutComparisonSample) => number | null;
  minimumSampleCount: number;
}): HoldoutComparatorReport {
  const eligible = args.samples.flatMap((sample) => {
    const actual = finite(sample.actual);
    const candidate = finite(sample.candidate);
    const baseline = finite(args.readBaseline(sample));
    return actual == null || candidate == null || baseline == null
      ? []
      : [{ actual, candidate, baseline }];
  });
  const candidate = summarizeHoldoutMetric(
    eligible.map((sample) => ({
      predicted: sample.candidate,
      actual: sample.actual,
    })),
  );
  const baseline = summarizeHoldoutMetric(
    eligible.map((sample) => ({
      predicted: sample.baseline,
      actual: sample.actual,
    })),
  );
  const ready = eligible.length >= args.minimumSampleCount;
  const maeDelta =
    ready && candidate.mae != null && baseline.mae != null
      ? Number((candidate.mae - baseline.mae).toFixed(4))
      : null;
  const rmseDelta =
    ready && candidate.rmse != null && baseline.rmse != null
      ? Number((candidate.rmse - baseline.rmse).toFixed(4))
      : null;
  const maeImprovementPct =
    ready && candidate.mae != null && baseline.mae != null && baseline.mae > 0
      ? Number(
          (((baseline.mae - candidate.mae) / baseline.mae) * 100).toFixed(4),
        )
      : null;
  return {
    comparator: args.comparator,
    status: ready ? "ready" : "insufficient_data",
    candidate,
    baseline,
    maeDelta,
    rmseDelta,
    maeImprovementPct,
  };
}

export function buildHoldoutComparisonReport(
  samples: HoldoutComparisonSample[],
  options: { minimumSampleCount?: number } = {},
): HoldoutComparisonReport {
  const minimumSampleCount = Math.max(1, options.minimumSampleCount ?? 30);
  const currentBaseline = buildComparatorReport({
    comparator: "current_baseline",
    samples,
    readBaseline: (sample) => sample.currentBaseline,
    minimumSampleCount,
  });
  const naivePrior = buildComparatorReport({
    comparator: "naive_prior",
    samples,
    readBaseline: (sample) => sample.naivePrior,
    minimumSampleCount,
  });
  return {
    status:
      currentBaseline.status === "ready" && naivePrior.status === "ready"
        ? "ready"
        : "insufficient_data",
    receivedSampleCount: samples.length,
    minimumSampleCount,
    comparisons: { currentBaseline, naivePrior },
  };
}

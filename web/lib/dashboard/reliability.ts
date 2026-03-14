export type ReliabilitySeverity = "warn" | "error";

export type ReliabilityIssue = {
  source: string;
  severity: ReliabilitySeverity;
  message: string;
};

export type ReliabilityAuditResult = {
  ok: boolean;
  issues: ReliabilityIssue[];
};

export type ModuleRuntimeState = {
  source: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  stale: boolean;
};

export type FallbackSignal = {
  source: string;
  requestedDate: string | null;
  resolvedDate: string | null;
  fallbackApplied?: boolean | null;
};

const isDate = (value: string | null): boolean => {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

export const evaluateFallbackReliability = (
  signals: FallbackSignal[]
): ReliabilityAuditResult => {
  const issues: ReliabilityIssue[] = [];

  signals.forEach((signal) => {
    if (!isDate(signal.requestedDate) || !isDate(signal.resolvedDate)) {
      issues.push({
        source: signal.source,
        severity: "warn",
        message: "Missing requested/resolved date context"
      });
      return;
    }

    if (
      signal.requestedDate !== signal.resolvedDate &&
      signal.fallbackApplied === false
    ) {
      issues.push({
        source: signal.source,
        severity: "error",
        message:
          "Resolved date differs from requested date without fallbackApplied=true"
      });
    }
  });

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues
  };
};

export const evaluateModuleRuntimeReliability = (
  states: ModuleRuntimeState[]
): ReliabilityAuditResult => {
  const issues: ReliabilityIssue[] = [];

  states.forEach((state) => {
    if (state.loading && state.error) {
      issues.push({
        source: state.source,
        severity: "error",
        message: "Module is simultaneously loading and erroring"
      });
    }

    if (state.error && !state.empty) {
      issues.push({
        source: state.source,
        severity: "warn",
        message: "Module in degraded mode: error present while retaining stale data"
      });
    }

    if (!state.loading && !state.error && state.empty) {
      issues.push({
        source: state.source,
        severity: "warn",
        message: "Module returned empty data; verify if this is expected for selected date"
      });
    }

    if (state.stale && state.error) {
      issues.push({
        source: state.source,
        severity: "warn",
        message: "Module stale and erroring; ensure stale banner and retry affordance are visible"
      });
    }
  });

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues
  };
};

export const mergeReliabilityResults = (
  ...results: ReliabilityAuditResult[]
): ReliabilityAuditResult => {
  const issues = results.flatMap((result) => result.issues);
  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues
  };
};

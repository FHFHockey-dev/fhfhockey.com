export interface NstRateLimitWindow {
  label: "5m_burst" | "1h_standard";
  windowMs: number;
  maxRequests: number;
}

export interface NstRequestPlanInput {
  requestCount: number;
  intervalMs: number;
}

export interface NstRateLimitAssessment {
  requestCount: number;
  intervalMs: number;
  isCompliant: boolean;
  windowCounts: Array<{
    label: NstRateLimitWindow["label"];
    windowMs: number;
    maxRequests: number;
    projectedRequests: number;
    compliant: boolean;
  }>;
}

export const NST_RATE_LIMIT_WINDOWS: readonly NstRateLimitWindow[] = [
  { label: "5m_burst", windowMs: 300_000, maxRequests: 80 },
  { label: "1h_standard", windowMs: 3_600_000, maxRequests: 180 }
] as const;

export const NST_BURST_INTERVAL_MS = 0;
export const NST_TOKENS_PER_PAGE = 10;
export const NST_STANDARD_TOKEN_CAP = 1_800;
export const NST_STANDARD_TOKEN_REFRESH = 150;
export const NST_BURST_TOKEN_CAP = 800;
export const NST_PAGES_PER_STANDARD_TOKEN_CAP =
  NST_STANDARD_TOKEN_CAP / NST_TOKENS_PER_PAGE;
export const NST_PAGES_PER_STANDARD_TOKEN_REFRESH =
  NST_STANDARD_TOKEN_REFRESH / NST_TOKENS_PER_PAGE;
export const NST_PAGES_PER_BURST_TOKEN_CAP =
  NST_BURST_TOKEN_CAP / NST_TOKENS_PER_PAGE;

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function getProjectedRequestsInWindow(
  requestCount: number,
  intervalMs: number,
  windowMs: number
): number {
  if (requestCount <= 0) {
    return 0;
  }

  if (intervalMs <= 0) {
    return requestCount;
  }

  // Request zero starts at t=0, so a fixed cadence can fit floor(window/interval)+1
  // requests into a window of length `windowMs`.
  return Math.min(requestCount, Math.floor(windowMs / intervalMs) + 1);
}

export function assessNstRequestPlan(
  input: NstRequestPlanInput
): NstRateLimitAssessment {
  const requestCount = normalizeNonNegativeInteger(input.requestCount);
  const intervalMs = normalizeNonNegativeInteger(input.intervalMs);

  const windowCounts = NST_RATE_LIMIT_WINDOWS.map((window) => {
    const projectedRequests = getProjectedRequestsInWindow(
      requestCount,
      intervalMs,
      window.windowMs
    );

    return {
      label: window.label,
      windowMs: window.windowMs,
      maxRequests: window.maxRequests,
      projectedRequests,
      compliant: projectedRequests <= window.maxRequests
    };
  });

  return {
    requestCount,
    intervalMs,
    isCompliant: windowCounts.every((window) => window.compliant),
    windowCounts
  };
}

export function canBurstNstRequests(requestCount: number): boolean {
  return assessNstRequestPlan({
    requestCount,
    intervalMs: NST_BURST_INTERVAL_MS
  }).isCompliant;
}

export function selectNstSafeInterval(
  requestCount: number,
  candidateIntervalsMs: readonly number[]
): NstRateLimitAssessment | null {
  for (const candidateIntervalMs of candidateIntervalsMs) {
    const assessment = assessNstRequestPlan({
      requestCount,
      intervalMs: candidateIntervalMs
    });

    if (assessment.isCompliant) {
      return assessment;
    }
  }

  return null;
}

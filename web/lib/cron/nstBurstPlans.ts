import {
  assessNstRequestPlan,
  selectNstSafeInterval
} from "./nstRateLimitPolicy";

export const NST_SMALL_DATE_BURST_MAX_DATES = 2;
export const NST_SAFE_INTERVAL_MS = 21_000;
export const NST_GOALIES_REQUEST_INTERVAL_MS = NST_SAFE_INTERVAL_MS;
export const DEFAULT_MAX_PENDING_URLS_PER_RUN = 20;
export const GOALIE_URLS_PER_DATE = 10;

function resolveSharedSmallDateBurstPlan(options: {
  queuedDates: number;
  requestCount: number;
  safeIntervalMs?: number;
  explicitRequestIntervalMs?: number;
}) {
  const safeIntervalMs = options.safeIntervalMs ?? NST_SAFE_INTERVAL_MS;
  const burstEligibleByDateCount =
    options.queuedDates <= NST_SMALL_DATE_BURST_MAX_DATES;
  const candidateIntervalsMs =
    options.explicitRequestIntervalMs !== undefined
      ? [options.explicitRequestIntervalMs, safeIntervalMs]
      : burstEligibleByDateCount
        ? [0, safeIntervalMs]
        : [safeIntervalMs];

  const selectedPlan = selectNstSafeInterval(
    options.requestCount,
    candidateIntervalsMs
  );
  const assessment =
    selectedPlan ??
    assessNstRequestPlan({
      requestCount: options.requestCount,
      intervalMs: safeIntervalMs
    });

  return {
    requestCount: options.requestCount,
    queuedDates: options.queuedDates,
    requestIntervalMs: assessment.intervalMs,
    burstAllowed: assessment.intervalMs === 0,
    burstEligibleByDateCount,
    usedExplicitInterval:
      options.explicitRequestIntervalMs !== undefined &&
      assessment.intervalMs === options.explicitRequestIntervalMs,
    explicitIntervalRejected:
      options.explicitRequestIntervalMs !== undefined &&
      assessment.intervalMs !== options.explicitRequestIntervalMs,
    assessment
  };
}

export function resolveGoalieNstRequestPlan(options: {
  queuedDates: number;
  totalQueuedUrls: number;
  maxPendingUrls: number;
  explicitRequestIntervalMs?: number;
}) {
  const requestCountBudget = Math.min(
    options.totalQueuedUrls,
    options.maxPendingUrls
  );
  const sharedPlan = resolveSharedSmallDateBurstPlan({
    queuedDates: options.queuedDates,
    requestCount: requestCountBudget,
    safeIntervalMs: NST_GOALIES_REQUEST_INTERVAL_MS,
    explicitRequestIntervalMs: options.explicitRequestIntervalMs
  });

  return {
    queuedDates: options.queuedDates,
    totalQueuedUrls: options.totalQueuedUrls,
    urlsPerDate: GOALIE_URLS_PER_DATE,
    requestCountBudget,
    requestIntervalMs: sharedPlan.requestIntervalMs,
    burstAllowed: sharedPlan.burstAllowed,
    burstEligibleByDateCount: sharedPlan.burstEligibleByDateCount,
    usedExplicitInterval: sharedPlan.usedExplicitInterval,
    explicitIntervalRejected: sharedPlan.explicitIntervalRejected,
    assessment: sharedPlan.assessment
  };
}

export const NST_TEAM_DAILY_BURST_INTERVAL_MS = 0;
export const NST_TEAM_DAILY_SAFE_INTERVAL_MS = NST_SAFE_INTERVAL_MS;
export const TEAM_DAILY_URLS_PER_DATE = 8;

export function resolveTeamDailyNstRequestPlan(targetDates: string[]) {
  const requestCount = targetDates.length * TEAM_DAILY_URLS_PER_DATE;
  const sharedPlan = resolveSharedSmallDateBurstPlan({
    queuedDates: targetDates.length,
    requestCount,
    safeIntervalMs: NST_TEAM_DAILY_SAFE_INTERVAL_MS
  });

  return {
    totalDates: targetDates.length,
    urlsPerDate: TEAM_DAILY_URLS_PER_DATE,
    requestCount,
    requestIntervalMs: sharedPlan.requestIntervalMs,
    burstAllowed: sharedPlan.burstAllowed,
    burstEligibleByDateCount: sharedPlan.burstEligibleByDateCount,
    assessment: sharedPlan.assessment
  };
}

export const NST_TEAM_STATS_SAFE_INTERVAL_MS = 21_000;

export function resolveNstTeamStatsRequestPlan(options: {
  queuedDates: number;
  dateRequestCount: number;
  seasonRequestCount: number;
}) {
  const requestCount = options.dateRequestCount + options.seasonRequestCount;
  const sharedPlan = resolveSharedSmallDateBurstPlan({
    queuedDates: options.queuedDates,
    requestCount,
    safeIntervalMs: NST_TEAM_STATS_SAFE_INTERVAL_MS
  });

  return {
    requestCount,
    queuedDates: options.queuedDates,
    dateRequestCount: options.dateRequestCount,
    seasonRequestCount: options.seasonRequestCount,
    requestIntervalMs: sharedPlan.requestIntervalMs,
    burstAllowed: sharedPlan.burstAllowed,
    burstEligibleByDateCount: sharedPlan.burstEligibleByDateCount,
    assessment: sharedPlan.assessment
  };
}

export function resolveNstCurrentSeasonRequestPlan(options: {
  queuedDates: number;
  requestCount: number;
}) {
  return resolveSharedSmallDateBurstPlan({
    queuedDates: options.queuedDates,
    requestCount: options.requestCount,
    safeIntervalMs: NST_SAFE_INTERVAL_MS
  });
}

export function resolveNstGamelogRequestPlan(options: {
  queuedDates: number;
  requestCount: number;
}) {
  return resolveSharedSmallDateBurstPlan({
    queuedDates: options.queuedDates,
    requestCount: options.requestCount,
    safeIntervalMs: NST_SAFE_INTERVAL_MS
  });
}

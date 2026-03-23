import {
  assessNstRequestPlan,
  selectNstSafeInterval
} from "./nstRateLimitPolicy";

export const NST_GOALIES_REQUEST_INTERVAL_MS = 22000;
export const DEFAULT_MAX_PENDING_URLS_PER_RUN = 8;
export const GOALIE_URLS_PER_DATE = 10;

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
  const candidateIntervalsMs =
    options.explicitRequestIntervalMs !== undefined
      ? [options.explicitRequestIntervalMs, NST_GOALIES_REQUEST_INTERVAL_MS]
      : [0, NST_GOALIES_REQUEST_INTERVAL_MS];

  const selectedPlan = selectNstSafeInterval(
    requestCountBudget,
    candidateIntervalsMs
  );
  const assessment =
    selectedPlan ??
    assessNstRequestPlan({
      requestCount: requestCountBudget,
      intervalMs: NST_GOALIES_REQUEST_INTERVAL_MS
    });

  return {
    queuedDates: options.queuedDates,
    totalQueuedUrls: options.totalQueuedUrls,
    urlsPerDate: GOALIE_URLS_PER_DATE,
    requestCountBudget,
    requestIntervalMs: assessment.intervalMs,
    burstAllowed: assessment.intervalMs === 0,
    usedExplicitInterval:
      options.explicitRequestIntervalMs !== undefined &&
      assessment.intervalMs === options.explicitRequestIntervalMs,
    explicitIntervalRejected:
      options.explicitRequestIntervalMs !== undefined &&
      assessment.intervalMs !== options.explicitRequestIntervalMs,
    assessment
  };
}

export const NST_TEAM_DAILY_BURST_INTERVAL_MS = 0;
export const NST_TEAM_DAILY_SMALL_INTERVAL_MS = 3000;
export const NST_TEAM_DAILY_MULTI_DATE_INTERVAL_MS = 30000;
export const TEAM_DAILY_URLS_PER_DATE = 8;

export function resolveTeamDailyNstRequestPlan(targetDates: string[]) {
  const requestCount = targetDates.length * TEAM_DAILY_URLS_PER_DATE;
  const assessment =
    selectNstSafeInterval(requestCount, [
      NST_TEAM_DAILY_BURST_INTERVAL_MS,
      NST_TEAM_DAILY_SMALL_INTERVAL_MS,
      NST_TEAM_DAILY_MULTI_DATE_INTERVAL_MS
    ]) ?? {
      requestCount,
      intervalMs: NST_TEAM_DAILY_MULTI_DATE_INTERVAL_MS,
      isCompliant: false,
      windowCounts: []
    };

  return {
    totalDates: targetDates.length,
    urlsPerDate: TEAM_DAILY_URLS_PER_DATE,
    requestCount,
    requestIntervalMs: assessment.intervalMs,
    burstAllowed: assessment.intervalMs === NST_TEAM_DAILY_BURST_INTERVAL_MS,
    assessment
  };
}

export const NST_TEAM_STATS_SAFE_INTERVAL_MS = 21_000;

export function resolveNstTeamStatsRequestPlan(options: {
  dateRequestCount: number;
  seasonRequestCount: number;
}) {
  const requestCount = options.dateRequestCount + options.seasonRequestCount;
  const assessment =
    selectNstSafeInterval(requestCount, [0, NST_TEAM_STATS_SAFE_INTERVAL_MS]) ?? {
      requestCount,
      intervalMs: NST_TEAM_STATS_SAFE_INTERVAL_MS,
      isCompliant: false,
      windowCounts: []
    };

  return {
    requestCount,
    dateRequestCount: options.dateRequestCount,
    seasonRequestCount: options.seasonRequestCount,
    requestIntervalMs: assessment.intervalMs,
    burstAllowed: assessment.intervalMs === 0,
    assessment
  };
}

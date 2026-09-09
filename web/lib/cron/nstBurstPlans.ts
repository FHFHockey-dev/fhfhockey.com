import {
  assessNstRequestPlan,
  canBurstNstRequests,
  selectNstSafeInterval
} from "./nstRateLimitPolicy";
import { getNstCronBurstClearance } from "./nstCoordination";

export const NST_SAFE_INTERVAL_MS = 21_000;
export const NST_GOALIES_REQUEST_INTERVAL_MS = NST_SAFE_INTERVAL_MS;
export const DEFAULT_MAX_PENDING_URLS_PER_RUN = 20;
export const NST_STRICT_MAX_URLS_PER_RUN = 6;
export const GOALIE_URLS_PER_DATE = 10;

function resolveSharedSmallDateBurstPlan(options: {
  jobName: string;
  queuedDates: number;
  requestCount: number;
  safeIntervalMs?: number;
  explicitRequestIntervalMs?: number;
}) {
  const safeIntervalMs = options.safeIntervalMs ?? NST_SAFE_INTERVAL_MS;
  const burstEligibleByRequestCount = canBurstNstRequests(
    options.requestCount
  );
  const scheduleClearance = getNstCronBurstClearance(options.jobName);
  const burstAllowedByPolicy =
    burstEligibleByRequestCount && scheduleClearance.allowed;
  const candidateIntervalsMs =
    options.explicitRequestIntervalMs !== undefined
      ? burstAllowedByPolicy ||
        options.explicitRequestIntervalMs >= safeIntervalMs
        ? [options.explicitRequestIntervalMs, safeIntervalMs]
        : [safeIntervalMs]
      : burstAllowedByPolicy
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
    burstEligibleByRequestCount,
    scheduleClearance,
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
    jobName: "update-nst-goalies",
    queuedDates: options.queuedDates,
    requestCount: options.totalQueuedUrls,
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
    burstEligibleByRequestCount: sharedPlan.burstEligibleByRequestCount,
    scheduleClearance: sharedPlan.scheduleClearance,
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
    jobName: "update-nst-team-daily-incremental",
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
    burstEligibleByRequestCount: sharedPlan.burstEligibleByRequestCount,
    scheduleClearance: sharedPlan.scheduleClearance,
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
    jobName: "update-nst-team-stats-all",
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
    burstEligibleByRequestCount: sharedPlan.burstEligibleByRequestCount,
    scheduleClearance: sharedPlan.scheduleClearance,
    assessment: sharedPlan.assessment
  };
}

export function resolveNstCurrentSeasonRequestPlan(options: {
  queuedDates: number;
  requestCount: number;
}) {
  return resolveSharedSmallDateBurstPlan({
    jobName: "update-nst-current-season",
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
    jobName: "update-nst-gamelog",
    queuedDates: options.queuedDates,
    requestCount: options.requestCount,
    safeIntervalMs: NST_SAFE_INTERVAL_MS
  });
}

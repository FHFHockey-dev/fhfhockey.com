import { isDirectNstJob } from "lib/cron/nstClassification";
import {
  NST_RATE_LIMIT_WINDOWS,
  NST_PAGES_PER_BURST_TOKEN_CAP
} from "lib/cron/nstRateLimitPolicy";

export type NstCoordinationPolicy = {
  coordinationScope: "shared_nst_key";
  maxConcurrentJobs: 1;
  minSpacingAfterCompletionMs: number;
  burstWindowMs: number;
  standardWindowMs: number;
  burstPageCap: number;
  note: string;
};

export const NST_MIN_CRON_BURST_GAP_MS = 10 * 60 * 1000;

export const NST_ACTIVE_DIRECT_CRON_STARTS = [
  { jobName: "update-nst-gamelog", minuteOfDayUtc: 7 * 60 + 25 },
  { jobName: "update-nst-goalies", minuteOfDayUtc: 8 * 60 + 30 },
  { jobName: "update-nst-current-season", minuteOfDayUtc: 8 * 60 + 45 },
  { jobName: "update-nst-team-daily-incremental", minuteOfDayUtc: 9 * 60 + 55 },
  { jobName: "update-nst-team-stats-all", minuteOfDayUtc: 10 * 60 + 55 }
] as const;

export function getNstCronBurstClearance(jobName: string) {
  const index = NST_ACTIVE_DIRECT_CRON_STARTS.findIndex(
    (job) => job.jobName === jobName
  );
  if (index < 0) {
    return {
      allowed: false,
      previousGapMs: 0,
      nextGapMs: 0
    };
  }

  const dayMinutes = 24 * 60;
  const current = NST_ACTIVE_DIRECT_CRON_STARTS[index].minuteOfDayUtc;
  const previous =
    NST_ACTIVE_DIRECT_CRON_STARTS[
      (index - 1 + NST_ACTIVE_DIRECT_CRON_STARTS.length) %
        NST_ACTIVE_DIRECT_CRON_STARTS.length
    ].minuteOfDayUtc;
  const next =
    NST_ACTIVE_DIRECT_CRON_STARTS[
      (index + 1) % NST_ACTIVE_DIRECT_CRON_STARTS.length
    ].minuteOfDayUtc;
  const previousGapMs =
    ((current - previous + dayMinutes) % dayMinutes) * 60_000;
  const nextGapMs = ((next - current + dayMinutes) % dayMinutes) * 60_000;

  return {
    allowed:
      previousGapMs >= NST_MIN_CRON_BURST_GAP_MS &&
      nextGapMs >= NST_MIN_CRON_BURST_GAP_MS,
    previousGapMs,
    nextGapMs
  };
}

const burstWindow = NST_RATE_LIMIT_WINDOWS.find(
  (window) => window.label === "5m_burst"
);
const standardWindow = NST_RATE_LIMIT_WINDOWS.find(
  (window) => window.label === "1h_standard"
);

export const NST_SHARED_KEY_SERIAL_SPACING_MS = NST_MIN_CRON_BURST_GAP_MS;

const DIRECT_NST_COORDINATION_POLICY: NstCoordinationPolicy = {
  coordinationScope: "shared_nst_key",
  maxConcurrentJobs: 1,
  minSpacingAfterCompletionMs: NST_SHARED_KEY_SERIAL_SPACING_MS,
  burstWindowMs: burstWindow?.windowMs ?? 300_000,
  standardWindowMs: standardWindow?.windowMs ?? 3_600_000,
  burstPageCap: NST_PAGES_PER_BURST_TOKEN_CAP,
  note:
    "Direct NST jobs share one key budget, so they must run serially and leave a 10-minute cooldown after each run before another direct NST job starts."
};

export function getNstCoordinationPolicy(
  jobName: string
): NstCoordinationPolicy | null {
  return isDirectNstJob(jobName) ? DIRECT_NST_COORDINATION_POLICY : null;
}

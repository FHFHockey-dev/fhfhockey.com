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

const burstWindow = NST_RATE_LIMIT_WINDOWS.find(
  (window) => window.label === "5m_burst"
);
const standardWindow = NST_RATE_LIMIT_WINDOWS.find(
  (window) => window.label === "1h_standard"
);

export const NST_SHARED_KEY_SERIAL_SPACING_MS = burstWindow?.windowMs ?? 300_000;

const DIRECT_NST_COORDINATION_POLICY: NstCoordinationPolicy = {
  coordinationScope: "shared_nst_key",
  maxConcurrentJobs: 1,
  minSpacingAfterCompletionMs: NST_SHARED_KEY_SERIAL_SPACING_MS,
  burstWindowMs: burstWindow?.windowMs ?? 300_000,
  standardWindowMs: standardWindow?.windowMs ?? 3_600_000,
  burstPageCap: NST_PAGES_PER_BURST_TOKEN_CAP,
  note:
    "Direct NST jobs share one key budget, so they must run serially and leave a 5-minute cooldown after each run before another direct NST job starts."
};

export function getNstCoordinationPolicy(
  jobName: string
): NstCoordinationPolicy | null {
  return isDirectNstJob(jobName) ? DIRECT_NST_COORDINATION_POLICY : null;
}

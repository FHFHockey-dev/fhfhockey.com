import { describe, expect, it } from "vitest";

import {
  parseCronInventoryFromMarkdown,
  readCronScheduleMarkdown
} from "lib/cron/cronInventory";
import {
  getNstCronBurstClearance,
  getNstCoordinationPolicy,
  NST_ACTIVE_DIRECT_CRON_STARTS,
  NST_MIN_CRON_BURST_GAP_MS,
  NST_SHARED_KEY_SERIAL_SPACING_MS
} from "lib/cron/nstCoordination";

describe("nstCoordination", () => {
  it("returns a shared-key serialization policy for direct NST jobs", () => {
    expect(getNstCoordinationPolicy("update-nst-gamelog")).toMatchObject({
      coordinationScope: "shared_nst_key",
      maxConcurrentJobs: 1,
      minSpacingAfterCompletionMs: 600_000,
      burstWindowMs: 300_000,
      standardWindowMs: 3_600_000,
      burstPageCap: 80
    });
    expect(NST_SHARED_KEY_SERIAL_SPACING_MS).toBe(600_000);
    expect(NST_MIN_CRON_BURST_GAP_MS).toBe(600_000);
  });

  it("confirms every active NST cron start has ten minutes of clearance", () => {
    for (const jobName of [
      "update-nst-gamelog",
      "update-nst-goalies",
      "update-nst-current-season",
      "update-nst-team-daily-incremental",
      "update-nst-team-stats-all"
    ]) {
      const clearance = getNstCronBurstClearance(jobName);
      expect(clearance.allowed).toBe(true);
      expect(clearance.previousGapMs).toBeGreaterThanOrEqual(600_000);
      expect(clearance.nextGapMs).toBeGreaterThanOrEqual(600_000);
    }
  });

  it("fails closed for a route without an audited cron slot", () => {
    expect(getNstCronBurstClearance("manual-nst-job").allowed).toBe(false);
  });

  it("keeps the burst-clearance schedule synchronized with the canonical inventory", async () => {
    const inventory = parseCronInventoryFromMarkdown(
      await readCronScheduleMarkdown()
    );
    const scheduledNstStarts = inventory
      .filter((job) => getNstCoordinationPolicy(job.name) !== null)
      .map((job) => ({
        jobName: job.name,
        minuteOfDayUtc: (job.utcHour ?? 0) * 60 + (job.utcMinute ?? 0)
      }));

    expect(scheduledNstStarts).toEqual(NST_ACTIVE_DIRECT_CRON_STARTS);
  });

  it("does not impose NST coordination on non-direct jobs", () => {
    expect(getNstCoordinationPolicy("update-games")).toBeNull();
  });
});

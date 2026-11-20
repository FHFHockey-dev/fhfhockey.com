import { describe, expect, it } from "vitest";

import {
  parseCronInventoryFromMarkdown,
  readCronScheduleMarkdown
} from "lib/cron/cronInventory";
import { assessNstRequestPlan } from "lib/cron/nstRateLimitPolicy";
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
      "update-nst-goalies",
      "update-nst-current-season",
      "update-nst-team-daily-incremental",
      "update-nst-team-stats-all",
      "blsh-native-capture"
    ]) {
      const clearance = getNstCronBurstClearance(jobName);
      expect(clearance.allowed).toBe(true);
      expect(clearance.previousGapMs).toBeGreaterThanOrEqual(600_000);
      expect(clearance.nextGapMs).toBeGreaterThanOrEqual(600_000);
    }
  });

  it("registers the BLSH 12:05 primary as the only BLSH NST start", () => {
    expect(NST_ACTIVE_DIRECT_CRON_STARTS.at(-1)).toEqual({
      jobName: "blsh-native-capture",
      minuteOfDayUtc: 12 * 60 + 5
    });
    expect(getNstCronBurstClearance("blsh-native-capture")).toEqual({
      allowed: true,
      previousGapMs: 130 * 60_000,
      nextGapMs: 1_225 * 60_000
    });
    expect(
      getNstCronBurstClearance("update-nst-team-daily-incremental").nextGapMs
    ).toBe(130 * 60_000);
    expect(getNstCronBurstClearance("update-nst-goalies").previousGapMs).toBe(
      1_225 * 60_000
    );
    // The 12:20 backup audits under the route's job name and is not a separate start.
    expect(getNstCronBurstClearance("blsh-native-capture-backup").allowed).toBe(
      false
    );
    expect(getNstCoordinationPolicy("blsh-native-capture")).not.toBeNull();
    // Its whole plan (2 URLs, 22 s apart) fits every shared window on its own.
    expect(
      assessNstRequestPlan({ requestCount: 2, intervalMs: 22_000 })
    ).toMatchObject({ isCompliant: true });
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

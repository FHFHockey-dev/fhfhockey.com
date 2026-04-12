import { describe, expect, it } from "vitest";

import {
  getNstCoordinationPolicy,
  NST_SHARED_KEY_SERIAL_SPACING_MS
} from "lib/cron/nstCoordination";

describe("nstCoordination", () => {
  it("returns a shared-key serialization policy for direct NST jobs", () => {
    expect(getNstCoordinationPolicy("update-nst-gamelog")).toMatchObject({
      coordinationScope: "shared_nst_key",
      maxConcurrentJobs: 1,
      minSpacingAfterCompletionMs: 300_000,
      burstWindowMs: 300_000,
      standardWindowMs: 3_600_000,
      burstPageCap: 80
    });
    expect(NST_SHARED_KEY_SERIAL_SPACING_MS).toBe(300_000);
  });

  it("does not impose NST coordination on non-direct jobs", () => {
    expect(getNstCoordinationPolicy("update-games")).toBeNull();
  });
});

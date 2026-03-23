import { describe, expect, it } from "vitest";

import {
  buildSlowJobWarning,
  isSlowJobDuration,
  SLOW_JOB_DENOTATION,
  SLOW_JOB_THRESHOLD_MS
} from "lib/cron/cronReportFlags";

describe("cronReportFlags", () => {
  it("flags only durations above the 4m30s optimization threshold", () => {
    expect(isSlowJobDuration(SLOW_JOB_THRESHOLD_MS)).toBe(false);
    expect(isSlowJobDuration(SLOW_JOB_THRESHOLD_MS + 1)).toBe(true);
  });

  it("builds a stable slow-job denotation payload", () => {
    expect(buildSlowJobWarning("update-nst-gamelog", 301_000)).toEqual({
      displayName: "update-nst-gamelog",
      durationMs: 301_000,
      timer: "05:01",
      denotation: SLOW_JOB_DENOTATION
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  buildCronJobTiming,
  hasCronJobTimingContract,
  hasCronTimingEnvelope,
  withCronJobTiming
} from "lib/cron/timingContract";

describe("timingContract", () => {
  it("builds canonical timing with raw ms and zero-padded MMSS", () => {
    const timing = buildCronJobTiming(
      "2026-03-20T11:00:00.000Z",
      "2026-03-20T11:01:05.900Z"
    );

    expect(timing).toEqual({
      startedAt: "2026-03-20T11:00:00.000Z",
      endedAt: "2026-03-20T11:01:05.900Z",
      durationMs: 65_900,
      timer: "01:05"
    });
  });

  it("wraps arbitrary payloads in a timing envelope", () => {
    const payload = withCronJobTiming(
      { success: true, rowsUpserted: 42 },
      "2026-03-20T11:00:00.000Z",
      "2026-03-20T11:00:09.000Z"
    );

    expect(payload).toEqual({
      success: true,
      rowsUpserted: 42,
      timing: {
        startedAt: "2026-03-20T11:00:00.000Z",
        endedAt: "2026-03-20T11:00:09.000Z",
        durationMs: 9_000,
        timer: "00:09"
      }
    });
  });

  it("validates timing contracts and envelopes", () => {
    const payload = {
      timing: {
        startedAt: "2026-03-20T11:00:00.000Z",
        endedAt: "2026-03-20T11:00:09.000Z",
        durationMs: 9_000,
        timer: "00:09"
      }
    };

    expect(hasCronJobTimingContract(payload.timing)).toBe(true);
    expect(hasCronTimingEnvelope(payload)).toBe(true);
    expect(
      hasCronJobTimingContract({
        startedAt: "invalid",
        endedAt: "2026-03-20T11:00:09.000Z",
        durationMs: 9_000,
        timer: "00:09"
      })
    ).toBe(false);
  });
});

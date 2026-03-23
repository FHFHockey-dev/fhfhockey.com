import { describe, expect, it } from "vitest";

import {
  extractAuditTimingRecord,
  parseTimingRecord
} from "lib/cron/cronReportTiming";

describe("cronReportTiming", () => {
  it("parses a canonical timing record and preserves an explicit source", () => {
    expect(
      parseTimingRecord(
        {
          startedAt: "2026-03-20T07:00:00.000Z",
          endedAt: "2026-03-20T07:01:26.000Z",
          durationMs: 86_000,
          timer: "01:26",
          source: "audit"
        },
        "response"
      )
    ).toEqual({
      startedAt: "2026-03-20T07:00:00.000Z",
      endedAt: "2026-03-20T07:01:26.000Z",
      durationMs: 86_000,
      timer: "01:26",
      source: "audit"
    });
  });

  it("falls back to response timing when audit details do not include top-level timing", () => {
    expect(
      extractAuditTimingRecord({
        response: JSON.stringify({
          success: true,
          timing: {
            startedAt: "2026-03-20T08:00:00.000Z",
            endedAt: "2026-03-20T08:02:05.000Z",
            durationMs: 125_000,
            timer: "02:05"
          }
        })
      })
    ).toEqual({
      startedAt: "2026-03-20T08:00:00.000Z",
      endedAt: "2026-03-20T08:02:05.000Z",
      durationMs: 125_000,
      timer: "02:05",
      source: "response"
    });
  });

  it("prefers explicit audit timing over nested response timing", () => {
    expect(
      extractAuditTimingRecord({
        timing: {
          startedAt: "2026-03-20T09:00:00.000Z",
          endedAt: "2026-03-20T09:00:30.000Z",
          durationMs: 30_000,
          timer: "00:30"
        },
        response: {
          success: true,
          timing: {
            startedAt: "2026-03-20T09:00:00.000Z",
            endedAt: "2026-03-20T09:05:00.000Z",
            durationMs: 300_000,
            timer: "05:00"
          }
        }
      })
    ).toEqual({
      startedAt: "2026-03-20T09:00:00.000Z",
      endedAt: "2026-03-20T09:00:30.000Z",
      durationMs: 30_000,
      timer: "00:30",
      source: "audit"
    });
  });
});

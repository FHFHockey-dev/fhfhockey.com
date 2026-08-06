import { describe, expect, it } from "vitest";

import {
  type NhlRawGamecenterIngestTelemetry,
  summarizeNhlRawGamecenterIngestResults,
} from "./nhlRawGamecenterTelemetry";

const observedCounts = {
  rosterCount: 10,
  eventCount: 20,
  shiftCount: 30,
  rawEndpointsStored: 4,
};

describe("summarizeNhlRawGamecenterIngestResults", () => {
  it("counts only normalized rows for a proven non-idempotent write", () => {
    expect(
      summarizeNhlRawGamecenterIngestResults([
        {
          ...observedCounts,
          idempotent: false,
        },
      ]),
    ).toEqual({
      rowsUpserted: 60,
      rowsVerified: 64,
    });
  });

  it("counts an exact replay as verified without reporting any writes", () => {
    expect(
      summarizeNhlRawGamecenterIngestResults([
        {
          ...observedCounts,
          idempotent: true,
        },
      ]),
    ).toEqual({
      rowsUpserted: 0,
      rowsVerified: 64,
    });
  });

  it("fails closed when a runtime result lacks non-idempotent proof", () => {
    const unprovenResult =
      observedCounts as unknown as NhlRawGamecenterIngestTelemetry;

    expect(summarizeNhlRawGamecenterIngestResults([unprovenResult])).toEqual({
      rowsUpserted: 0,
      rowsVerified: 64,
    });
  });
});

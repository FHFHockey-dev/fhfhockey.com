import { describe, expect, it } from "vitest";

import {
  assertExactStatsStatusAdvancement,
  getStatsStatusAdvancementFailureDetails,
  StatsStatusAdvancementError,
} from "lib/cron/statsStatusAdvancement";

async function captureRejection(callback: () => unknown): Promise<unknown> {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected status advancement assertion to reject.");
}

describe("assertExactStatsStatusAdvancement", () => {
  it("accepts only the exact returned game-ID set", () => {
    expect(
      assertExactStatsStatusAdvancement({
        phase: "stale_quarantine",
        expectedGameIds: [2025020002, 2025020001],
        data: [{ gameId: 2025020001 }, { gameId: 2025020002 }],
      }),
    ).toEqual([2025020001, 2025020002]);
  });

  it.each([
    ["zero rows", []],
    ["the wrong row", [{ gameId: 2025020099 }]],
    ["duplicate rows", [{ gameId: 2025020001 }, { gameId: 2025020001 }]],
  ])("rejects %s with bounded structured details", async (_label, data) => {
    const error = await captureRejection(() =>
      assertExactStatsStatusAdvancement({
        phase: "normal_completion",
        expectedGameIds: [2025020001],
        data,
      }),
    );

    expect(error).toBeInstanceOf(StatsStatusAdvancementError);
    expect(getStatsStatusAdvancementFailureDetails(error)).toMatchObject({
      kind: "stats_status_advancement_failure",
      code: "STATS_STATUS_ADVANCEMENT_FAILED",
      phase: "normal_completion",
      expectedGameIds: [2025020001],
      terminalError: { code: "STATUS_UPDATE_SET_MISMATCH" },
    });
  });

  it("sanitizes structured database errors before exposing status details", async () => {
    const error = await captureRejection(() =>
      assertExactStatsStatusAdvancement({
        phase: "normal_completion",
        expectedGameIds: [2025020001],
        data: [],
        error: {
          code: "42501",
          message:
            "status denied at https://example.test/private Bearer sensitive-token\ncontinued",
        },
      }),
    );

    expect(getStatsStatusAdvancementFailureDetails(error)).toMatchObject({
      terminalError: {
        code: "42501",
        message: "status denied at [redacted-url] Bearer [redacted] continued",
      },
    });
  });
});

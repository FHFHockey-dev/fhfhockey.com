import { describe, expect, it } from "vitest";

import {
  StatsPreWriteQuarantineError,
  getStatsPreWriteQuarantineFailureDetails,
  sanitizeCronDiagnostic,
} from "./statsUpdateSafety";

describe("stats update safety", () => {
  it("redacts HTML, URLs, bearer values, and control characters within a fixed bound", () => {
    const sanitized = sanitizeCronDiagnostic(
      `request failed at https://example.test/private Bearer sensitive-token\n${"x".repeat(400)}`,
    );
    expect(sanitized).toContain(
      "request failed at [redacted-url] Bearer [redacted]",
    );
    expect(sanitized).not.toContain("sensitive-token");
    expect(sanitized).not.toContain("https://example.test/private");
    expect(sanitized.length).toBeLessThanOrEqual(240);
    expect(
      sanitizeCronDiagnostic(
        "<!DOCTYPE html><html><body>private proxy response</body></html>",
      ),
    ).toBe("Upstream HTML response redacted.");
    expect(
      sanitizeCronDiagnostic(`https://example.test/${"x".repeat(400)}`).length,
    ).toBeLessThanOrEqual(240);
  });

  it("recognizes only the explicit pre-write quarantine error class", () => {
    const error = new StatsPreWriteQuarantineError({
      kind: "stats_pre_write_quarantine_failure",
      code: "STATS_PRE_WRITE_QUARANTINE_ELIGIBLE",
      phase: "pre_write_validation",
      gameId: 2024020001,
      requestedRows: 1,
      reason: "game_not_finished",
      message: "Game is not finished.",
    });

    expect(getStatsPreWriteQuarantineFailureDetails(error)).toMatchObject({
      gameId: 2024020001,
      reason: "game_not_finished",
    });
    expect(
      getStatsPreWriteQuarantineFailureDetails(
        new Error("generic failures are not quarantine eligible"),
      ),
    ).toBeNull();
  });
});

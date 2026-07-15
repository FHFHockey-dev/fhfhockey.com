import { describe, expect, it } from "vitest";

import { getYahooRefreshBlock, YahooRefreshError } from "./refresh";

describe("Yahoo refresh guard", () => {
  const now = new Date("2026-07-13T06:00:00.000Z");

  it("blocks queued and running refreshes", () => {
    expect(
      getYahooRefreshBlock(
        {
          status: "queued",
          cooldown_until: null,
          started_at: now.toISOString(),
          created_at: now.toISOString(),
        },
        now,
      ),
    ).toEqual(expect.objectContaining({ statusCode: 409 }));
    expect(
      getYahooRefreshBlock(
        {
          status: "running",
          cooldown_until: null,
          started_at: now.toISOString(),
          created_at: now.toISOString(),
        },
        now,
      ),
    ).toEqual(expect.objectContaining({ statusCode: 409 }));
  });

  it("returns a retry-after interval during cooldown", () => {
    const result = getYahooRefreshBlock(
      {
        status: "completed",
        cooldown_until: "2026-07-13T06:01:30.000Z",
        started_at: now.toISOString(),
        created_at: now.toISOString(),
      },
      now,
    );

    expect(result).toBeInstanceOf(YahooRefreshError);
    expect(result).toEqual(
      expect.objectContaining({ statusCode: 429, retryAfterSeconds: 90 }),
    );
  });

  it("allows a refresh when no run or expired cooldown exists", () => {
    expect(getYahooRefreshBlock(null, now)).toBeNull();
    expect(
      getYahooRefreshBlock(
        {
          status: "completed",
          cooldown_until: "2026-07-13T05:59:59.000Z",
          started_at: now.toISOString(),
          created_at: now.toISOString(),
        },
        now,
      ),
    ).toBeNull();
  });

  it("allows recovery of an abandoned in-flight run after fifteen minutes", () => {
    expect(
      getYahooRefreshBlock(
        {
          status: "running",
          cooldown_until: null,
          started_at: "2026-07-13T05:44:59.000Z",
          created_at: "2026-07-13T05:44:59.000Z",
        },
        now,
      ),
    ).toBeNull();
  });
});

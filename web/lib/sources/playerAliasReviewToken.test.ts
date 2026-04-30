import { afterEach, describe, expect, it } from "vitest";

import {
  createPlayerAliasReviewToken,
  verifyPlayerAliasReviewToken,
} from "./playerAliasReviewToken";

describe("player alias review tokens", () => {
  const originalSecret = process.env.PLAYER_ALIAS_REVIEW_TOKEN_SECRET;
  const originalCronSecret = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.PLAYER_ALIAS_REVIEW_TOKEN_SECRET = originalSecret;
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("creates an expiring token scoped to one unresolved name", () => {
    process.env.PLAYER_ALIAS_REVIEW_TOKEN_SECRET = "review-secret";
    delete process.env.CRON_SECRET;

    const token = createPlayerAliasReviewToken({
      unresolvedId: "unresolved-1",
      ttlSeconds: 60,
      nowMs: 1_000,
    });

    expect(token).toEqual(expect.any(String));
    expect(
      verifyPlayerAliasReviewToken({
        token,
        unresolvedId: "unresolved-1",
        nowMs: 30_000,
      })
    ).toBe(true);
    expect(
      verifyPlayerAliasReviewToken({
        token,
        unresolvedId: "unresolved-2",
        nowMs: 30_000,
      })
    ).toBe(false);
    expect(
      verifyPlayerAliasReviewToken({
        token,
        unresolvedId: "unresolved-1",
        nowMs: 120_000,
      })
    ).toBe(false);
  });
});

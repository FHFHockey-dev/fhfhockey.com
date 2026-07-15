import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS,
  draftPairwiseRateLimitConfig,
} from "./rateLimit";

describe("Draft Ranker pairwise rate configuration", () => {
  it("uses conservative launch defaults", () => {
    expect(draftPairwiseRateLimitConfig({})).toEqual(
      DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS,
    );
  });

  it("accepts bounded integer overrides", () => {
    expect(
      draftPairwiseRateLimitConfig({
        DRAFT_RANKER_QUEUE_HOURLY_LIMIT: "40",
        DRAFT_RANKER_QUEUE_DAILY_LIMIT: "200",
        DRAFT_RANKER_RESPONSE_MINUTE_LIMIT: "12",
        DRAFT_RANKER_RESPONSE_HOURLY_LIMIT: "80",
        DRAFT_RANKER_COMMUNITY_RESPONSE_TEN_MINUTE_LIMIT: "9",
        DRAFT_RANKER_SAME_PAIR_WEEKLY_LIMIT: "2",
      }),
    ).toEqual({
      queueHourlyLimit: 40,
      queueDailyLimit: 200,
      responseMinuteLimit: 12,
      responseHourlyLimit: 80,
      communityResponseTenMinuteLimit: 9,
      samePairWeeklyLimit: 2,
    });
  });

  it("fails safe to defaults for invalid or excessive overrides", () => {
    expect(
      draftPairwiseRateLimitConfig({
        DRAFT_RANKER_QUEUE_HOURLY_LIMIT: "0",
        DRAFT_RANKER_QUEUE_DAILY_LIMIT: "50001",
        DRAFT_RANKER_RESPONSE_MINUTE_LIMIT: "1.5",
        DRAFT_RANKER_RESPONSE_HOURLY_LIMIT: "many",
        DRAFT_RANKER_COMMUNITY_RESPONSE_TEN_MINUTE_LIMIT: "-1",
        DRAFT_RANKER_SAME_PAIR_WEEKLY_LIMIT: "1001",
      }),
    ).toEqual(DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS);
  });
});

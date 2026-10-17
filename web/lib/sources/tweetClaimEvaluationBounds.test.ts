// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { boundedTweetClaimEvaluationConfig } from "./tweetClaimEvaluationBounds";
afterEach(() => vi.unstubAllEnvs());
it("requires both finite end and count for a configured prospective cohort", () => {
  vi.stubEnv("TWEET_CLAIMS_EVALUATION_ID", "pilot"); vi.stubEnv("TWEET_CLAIMS_EVALUATION_START_AT", "2026-10-18T12:00:00Z");
  expect(() => boundedTweetClaimEvaluationConfig()).toThrow("immutable end");
  vi.stubEnv("TWEET_CLAIMS_EVALUATION_END_AT", "2026-10-19T12:00:00Z"); vi.stubEnv("TWEET_CLAIMS_EVALUATION_MAX_SAMPLES", "25");
  expect(boundedTweetClaimEvaluationConfig()).toMatchObject({ maxSamples: 25, endsAt: "2026-10-19T12:00:00Z" });
  vi.stubEnv("TWEET_CLAIMS_EVALUATION_MAX_SAMPLES", "1001"); expect(() => boundedTweetClaimEvaluationConfig()).toThrow("receipt budget");
});

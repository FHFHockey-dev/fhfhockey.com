// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { admitTweetClaimEvaluationIntake } from "./tweetClaimEvaluationIntake";
afterEach(() => vi.unstubAllEnvs());
it("uses the durable shared intake budget only in a configured shadow cohort", async () => {
  const db = { rpc: vi.fn(async (name: string) => ({ data: name.startsWith("reserve") ? { allowed: ["a"],status: "admitted" } : null,error: null })) };
  const events = [{ id: "a" },{ id: "b" }];
  expect((await admitTweetClaimEvaluationIntake(db,"line_source_ifttt_events",events)).events).toEqual(events); expect(db.rpc).not.toHaveBeenCalled();
  vi.stubEnv("TWEET_CLAIMS_MODE","shadow"); vi.stubEnv("TWEET_CLAIMS_EVALUATION_ID","bounded");
  vi.stubEnv("TWEET_CLAIMS_EVALUATION_START_AT","2026-10-17T12:00:00Z"); vi.stubEnv("TWEET_CLAIMS_EVALUATION_END_AT","2026-10-18T12:00:00Z");
  vi.stubEnv("TWEET_CLAIMS_EVALUATION_MAX_SAMPLES","2");
  expect(await admitTweetClaimEvaluationIntake(db,"line_source_ifttt_events",events)).toMatchObject({ active: true,events: [{ id: "a" }] });
  expect(db.rpc).toHaveBeenCalledWith("reserve_tweet_claim_evaluation_intake",{ p_id: "bounded",p_table: "line_source_ifttt_events",p_ids: ["a","b"] });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { type TweetClaimEnvelope } from "./tweetClaimExtraction";
import { datedTweetClaimBinding, tweetLegacyCoverage } from "./tweetClaimEvidence";
import { qualifiedFixture } from "./fixtures/tweetClaimQualificationFixture";


describe("dated identity and exact sink inventory", () => {
  it("verifies a lexical player/team/role using a retained official exact-game receipt known before publication", () => {
    const { claims, evidence } = qualifiedFixture();
    expect(datedTweetClaimBinding(claims[0]!, evidence)).toMatchObject({ status: "verified", role: "goalie", playerId: 8478499 });
  });
  it("abstains for hindsight, traded-team, non-goalie and ambiguous lexical evidence", () => {
    const { claims, evidence } = qualifiedFixture();
    for (const change of [{ knownAt: "2026-10-16T15:01:00Z" }, { teamId: 10 }, { role: "skater" as const }, { fullName: "Other Swayman" }]) {
      expect(datedTweetClaimBinding(claims[0]!, { ...evidence, identities: [{ ...evidence.identities[0]!, ...change }] }).status).toBe("pending");
    }
    const altered = structuredClone(claims[0]!) as TweetClaimEnvelope;
    altered.claimAnchor!.subjectSpan = { start: 4, end: 10, text: "Jeremy" };
    expect(datedTweetClaimBinding(altered, evidence).status).toBe("pending");
  });
  it("never upgrades missing/capped schemas or present partial sink rows to clear history", () => {
    const { evidence } = qualifiedFixture();
    expect(tweetLegacyCoverage(evidence).status).toBe("known_clear");
    expect(tweetLegacyCoverage({ ...evidence, history: undefined }).status).toBe("unknown");
    expect(tweetLegacyCoverage(evidence, ["2020-01-01T00:00:00Z"]).status).toBe("unknown");
    expect(tweetLegacyCoverage({ ...evidence, sinks: evidence.sinks.slice(1) }).status).toBe("unknown");
    expect(tweetLegacyCoverage({ ...evidence, sinks: evidence.sinks.map((s, i) => i ? s : { ...s, complete: false }) }).status).toBe("unknown");
    expect(tweetLegacyCoverage({ ...evidence, sinks: evidence.sinks.map((s, i) => i ? s : { ...s, rows: [{ event_key: "legacy", payload: { qualifier: "without" } }] }) })).toMatchObject({ status: "present" });
  });
});

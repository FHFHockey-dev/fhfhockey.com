// @vitest-environment node
import { describe, expect, it } from "vitest";
import { qualifiedFixture } from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import { explicitTweetClaimGameApplicability } from "../../../web/lib/sources/tweetClaimApplicability";
import { datedTweetClaimBinding } from "../../../web/lib/sources/tweetClaimEvidence";

const setup = () => {
  const f = qualifiedFixture(), claim = structuredClone(f.claims[0]!);
  const text = "BOS Jeremy Swayman starts on 2026-10-17.";
  const game = { ...f.game, date: "2026-10-17", startTime: "2026-10-17T23:00:00Z" };
  claim.source.rawText = text;
  claim.semantic = { ...claim.semantic, evidence: { start: 0, end: text.length, text } };
  const args = { game, teamId: 6, publishedAt: claim.semantic.original.publishedAt!, text, governingClause: claim.semantic.evidence };
  const proof = explicitTweetClaimGameApplicability(args);
  expect(proof).not.toBeNull();
  claim.gameApplicability = proof!;
  const evidence = { ...f.evidence, identities: f.evidence.identities.map(row => ({ ...row, date: game.date })) };
  return { claim, args, proof: proof!, evidence };
};

describe("independent explicit applicability safety negatives", () => {
  it.each(["2026-10-16T23:00:00Z", "2026-10-17T22:00:00Z"])("holds a proof when raw effectiveAt %s differs from its exact start", effectiveAt => {
    const { claim, evidence, proof } = setup();
    claim.semantic = { ...claim.semantic, effectiveAt };
    const result = datedTweetClaimBinding(claim, evidence);
    console.log("applicability clock result", JSON.stringify({ effectiveAt, proofStart: proof.startTime, result }));
    expect(result.status).toBe("pending");
  });
  it("rejects an oversized governing span even when slice clamps to the matching text", () => {
    const { args } = setup();
    const proof = explicitTweetClaimGameApplicability({ ...args, governingClause: { ...args.governingClause, end: 999 } });
    console.log("oversized applicability span", JSON.stringify(proof));
    expect(proof).toBeNull();
  });
  it.each(["publication", "start"] as const)("rejects timezone-less %s clocks in source-date receipts", field => {
    const { args } = setup();
    const altered = field === "publication" ? { ...args, publishedAt: args.publishedAt.replace(/Z$/, "") }
      : { ...args, game: { ...args.game, startTime: args.game.startTime.replace(/Z$/, "") } };
    const proof = explicitTweetClaimGameApplicability(altered);
    console.log("timezone-less applicability", JSON.stringify({ field, proof }));
    expect(proof).toBeNull();
  });
});

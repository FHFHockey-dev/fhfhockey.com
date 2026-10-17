// @vitest-environment node
import { describe, expect, it } from "vitest";
import { tweetClaimContentHash,type TweetClaimEnvelope } from "./tweetClaimExtraction";
import { datedTweetClaimBinding, tweetLegacyCoverage } from "./tweetClaimEvidence";
import { qualifiedFixture } from "./fixtures/tweetClaimQualificationFixture";
import { explicitTweetClaimGameApplicability } from "./tweetClaimApplicability";


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
  it("accepts an explicitly dated future-game clause only with matching retained date and source-time identity",()=>{
    const f=qualifiedFixture(),claim=structuredClone(f.claims[0]!),text="BOS Jeremy Swayman starts on 2026-10-17.";
    const game={...f.game,date:"2026-10-17",startTime:"2026-10-17T23:00:00Z"};
    claim.source.rawText=text;claim.semantic={...claim.semantic,evidence:{start:0,end:text.length,text}};
    const proof=explicitTweetClaimGameApplicability({game,teamId:6,publishedAt:claim.semantic.original.publishedAt!,text,governingClause:claim.semantic.evidence});
    expect(proof).not.toBeNull();claim.gameApplicability=proof!;
    const evidence={...f.evidence,identities:f.evidence.identities.map(row=>({...row,date:game.date}))};
    expect(datedTweetClaimBinding(claim,evidence)).toMatchObject({status:"verified",scopeDate:"2026-10-17"});
    const without=structuredClone(claim);delete without.gameApplicability;
    expect(datedTweetClaimBinding(without,evidence).status).toBe("pending");
    expect(tweetClaimContentHash(claim)).not.toBe(tweetClaimContentHash(without));
    for(const change of [{date:"2026-10-16"},{gameId:900013},{teamId:12},{publishedAt:"2026-10-15T15:00:00Z"},
      {startTime:"2026-10-16T23:00:00Z"},{governingClause:{...claim.semantic.evidence,start:1}}]){
      expect(datedTweetClaimBinding({...claim,gameApplicability:{...proof!,...change}},evidence)).toMatchObject({status:"pending",reason:"explicit_game_date_evidence_invalid"});
    }
    expect(datedTweetClaimBinding(claim,{...evidence,identities:evidence.identities.map(row=>({...row,knownAt:"2026-10-16T15:01:00Z"}))}).status).toBe("pending");
    expect(datedTweetClaimBinding(claim,f.evidence).status).toBe("pending");
    for(const unproved of ["BOS Jeremy Swayman starts tomorrow.","BOS Jeremy Swayman starts on 2026-10-16 or 2026-10-17."]){
      expect(explicitTweetClaimGameApplicability({game,teamId:6,publishedAt:claim.semantic.original.publishedAt!,text:unproved,
        governingClause:{start:0,end:unproved.length,text:unproved}})).toBeNull();
    }
  });
});

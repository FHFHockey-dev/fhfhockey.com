// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createLunaEvaluationBatch } from "../fixtures/tweetLunaEvaluation";
import type { NextApiRequest, NextApiResponse } from "next";
import { extractDurableTweetClaims, type TweetClaimEnvelope } from "../tweetClaimExtraction";
import { mapTweetDecisionReview } from "../tweetDecisionReviewMapping";
import { createHostedLunaHandler } from "./handler";
import type { HostedLunaStore } from "./store";
import { identityDigest } from "../playerIdentitySnapshot";
import { validateHostedLunaJob } from "./contract";
import { prepareHostedLunaDraft } from "./prepareDraft";

const ID = "f40f38e5-03dd-4f70-a0a2-7934a49fc5c6";
function material() {
  const input = structuredClone(createLunaEvaluationBatch().content.entries[3]!.input);
  const receipt = structuredClone(input.packet.receiptSnapshot);
  receipt.id = "00000000-0000-4000-8000-000000000001";
  receipt.eventId = "00000000-0000-4000-8000-000000000002";
  const source: any = { tweetId: receipt.inputRow.tweet_id, sourceUrl: receipt.inputRow.link_to_tweet,
    rawText: receipt.inputRow.text, rawPayload: receipt.inputRow.raw_payload,
    tweetPostedAt: receipt.inputRow.tweet_created_at, observedAt: receipt.receivedAt };
  return { jobId: ID.toUpperCase(), receipt, source, claims: [] as TweetClaimEnvelope[], identity: input.identity!,
    statements: [], extractionVersion: input.extractionVersion, provenanceRef: "synthetic-private-receipt; unverified",
    preparedAt: "2026-11-05T00:00:00Z" };
}

describe("prospective hosted draft preparation", () => {
  it("defaults off before accessing material", () => {
    const args = { get material(): never { throw new Error("must not read"); } };
    expect(prepareHostedLunaDraft(args)).toMatchObject({ status: "disabled", draft: null, canEnqueue: false });
  });
  it("prepares an immutable, exact synthetic envelope for review only", () => {
    const m = material(), before = structuredClone(m);
    const result = prepareHostedLunaDraft({ enabled: true, material: m });
    expect(result.status).toBe("prepared_for_owner_review");
    if (result.status !== "prepared_for_owner_review") throw new Error("expected draft");
    expect(result).toMatchObject({ canEnqueue: false, providerDispatchEnabled: false, canPublish: false,
      canWriteAliases: false, canChangeStatus: false, sourceAuthenticated: false });
    expect(result.draft.envelope.id).toBe(ID);
    const validated = validateHostedLunaJob(result.draft.envelope, ID);
    expect(validated).toMatchObject({ decisions: false, referenceMode: "rules-and-synthetic-only" });
    expect(validated.packet.receiptSnapshot).toEqual(m.receipt);
    expect(result.draftHash).toBe(identityDigest(result.draft));
    expect(result.draft.reviewRequirements).toContain("owner_staging_approval_required");
    expect(Object.isFrozen(result.draft.envelope)).toBe(true);
    expect(m).toEqual(before);
  });
  it("never turns a provenance label or caller approval flag into authority", () => {
    const m = material(); m.provenanceRef = "webhook-secret-accepted; verified:true";
    const result = prepareHostedLunaDraft({ enabled: true, material: m, approved: true } as any);
    expect(result).toMatchObject({ status: "prepared_for_owner_review", sourceAuthenticated: false,
      canEnqueue: false, providerDispatchEnabled: false });
    if (result.status !== "prepared_for_owner_review") throw new Error("expected draft");
    expect(result.draft.reviewRequirements).toHaveLength(4);
  });
  it("preserves nonempty unresolved claim holds in a prepared draft", () => {
    const m = material();
    m.claims = extractDurableTweetClaims({ source: m.source, game: null, interpretedAt: m.preparedAt });
    expect(m.claims).toHaveLength(1);
    const before = structuredClone(m.claims);
    const result = prepareHostedLunaDraft({ enabled: true, material: m });
    expect(result.status).toBe("prepared_for_owner_review");
    if (result.status !== "prepared_for_owner_review") throw new Error("expected draft");
    const input = validateHostedLunaJob(result.draft.envelope, ID);
    expect(input.packet.candidates).toHaveLength(1);
    expect(input.packet.candidates[0]).toMatchObject({ observationId: m.claims[0]!.semantic.id,
      evidence: m.claims[0]!.semantic.evidence,
      holds: expect.arrayContaining(["claim_anchor_missing", "canonical_player_binding_missing",
        "deterministic_support_unresolved", "scope_unresolved"]) });
    const mapped = mapTweetDecisionReview({ enabled: true, packet: input.packet,
      extractionVersion: input.extractionVersion, statements: input.statements });
    expect(mapped.status).toBe("mapped");
    if (mapped.status !== "mapped") throw new Error("expected mapping");
    expect(mapped.bindings).toHaveLength(0);
    expect(mapped.heldCandidates[0]!.reasons).toEqual(expect.arrayContaining(input.packet.candidates[0]!.holds));
    expect(m.claims).toEqual(before);
  });
  it("a prepared draft with malformed mention metadata is held by the worker before provider access", async () => {
    const m = material(); (m.identity.mentions[0] as any).kind = "invented-kind";
    const result = prepareHostedLunaDraft({ enabled: true, material: m });
    expect(result.status).toBe("prepared_for_owner_review");
    if (result.status !== "prepared_for_owner_review") throw new Error("expected draft");
    const reserve = vi.fn(async () => ({ status: "reserved" as const }));
    const finish = vi.fn(async () => undefined);
    const store: HostedLunaStore = { claim: vi.fn(async () => ({ status: "claimed" as const, job: result.draft.envelope })),
      admission: () => ({ reserve, settle: vi.fn(async () => undefined), uncertain: vi.fn(async () => undefined) }),
      finish, hold: vi.fn(async () => undefined) };
    const apiKey = vi.fn(() => "synthetic-unused-key"), fetcher = vi.fn<typeof fetch>();
    const secret = "synthetic-worker-secret-not-a-credential";
    const handler = createHostedLunaHandler({ enabled: () => true, workerSecret: () => secret,
      store: () => store, apiKey, fetch: fetcher, now: () => m.preparedAt });
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ method: "POST", headers: { authorization: `Bearer ${secret}` }, body: { jobId: ID } } as NextApiRequest,
      res as unknown as NextApiResponse);
    expect(finish).toHaveBeenCalledWith(ID, expect.objectContaining({ review: expect.objectContaining({
      status: "held", attempts: 0, holds: expect.arrayContaining(["identity_preparation_held"]),
    }), candidate: null }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "held", canPublish: false }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(reserve).not.toHaveBeenCalled(); expect(apiKey).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ["text mismatch", (m: ReturnType<typeof material>) => { m.source.rawText += " altered"; }],
    ["payload mismatch", (m: ReturnType<typeof material>) => { m.source.rawPayload = { altered: true }; }],
    ["receipt identity missing", (m: ReturnType<typeof material>) => { m.receipt.id = "old-post-id"; }],
    ["unbound URL", (m: ReturnType<typeof material>) => { m.source.sourceUrl = "https://x.com/Other/status/999"; }],
    ["unretained enrichment", (m: ReturnType<typeof material>) => { m.source.enrichedText = "different selected text"; }],
    ["missing publication", (m: ReturnType<typeof material>) => { m.source.tweetPostedAt = null; m.receipt.inputRow.tweet_created_at = null; }],
    ["later canonical evidence", (m: ReturnType<typeof material>) => { (m.identity.evidence as any).players.forEach((p: any) => { p.knownAt = m.preparedAt; }); }],
    ["retrospective identity", (m: ReturnType<typeof material>) => { m.identity.evaluation = { mode: "retrospective", sourcePublishedAt: m.source.tweetPostedAt, reviewedAt: m.preparedAt }; }],
    ["wrong publication binding", (m: ReturnType<typeof material>) => { m.identity.evaluation.sourcePublishedAt = "2026-10-15T00:00:00Z"; }],
    ["future asOf", (m: ReturnType<typeof material>) => { m.identity.asOf = "2027-01-01T00:00:00Z"; }],
    ["bad mention span", (m: ReturnType<typeof material>) => { m.identity.mentions[0]!.span.start++; }],
    ["duplicate mention", (m: ReturnType<typeof material>) => { m.identity.mentions.push(structuredClone(m.identity.mentions[0]!)); }],
    ["overlap with distinct IDs", (m: ReturnType<typeof material>) => {
      const mention = structuredClone(m.identity.mentions[0]!); mention.id = "distinct-overlap";
      mention.span.start += 6; mention.span.text = "Keeper"; m.identity.mentions.push(mention);
    }],
    ["zero mentions", (m: ReturnType<typeof material>) => { m.identity.mentions = []; }],
    ["33 otherwise valid mentions", (m: ReturnType<typeof material>) => {
      const text = Array(33).fill("Avery Keeper").join(" ");
      m.source.rawText = text; m.receipt.inputRow.text = text;
      m.source.rawPayload = { text }; m.receipt.inputRow.raw_payload = { text };
      m.identity.mentions = Array.from({ length: 33 }, (_, i) => ({ id: `subject-${i}`, kind: "name" as const,
        span: { start: i * 13, end: i * 13 + 12, text: "Avery Keeper" }, teamHint: null, positionHint: null }));
    }],
    ["preparation before receipt", (m: ReturnType<typeof material>) => {
      m.identity.asOf = m.source.tweetPostedAt; m.preparedAt = "2026-10-16T15:00:30Z";
    }],
    ["identity asOf before publication", (m: ReturnType<typeof material>) => { m.identity.asOf = "2026-10-16T14:59:59Z"; }],
    ["unbounded source", (m: ReturnType<typeof material>) => { m.source.rawPayload = { text: "x".repeat(512_001) }; }],
  ] as const)("holds %s without returning source data", (_name, change) => {
    const m = material(); change(m);
    expect(prepareHostedLunaDraft({ enabled: true, material: m })).toEqual({
      canEnqueue: false, providerDispatchEnabled: false, canPublish: false, canChangeStatus: false,
      canWriteAliases: false, sourceAuthenticated: false, status: "held", reason: "invalid_or_unresolved_draft", draft: null,
    });
  });
  it("detaches saved draft bytes from subsequent caller mutations", () => {
    const m = material(), result = prepareHostedLunaDraft({ enabled: true, material: m });
    if (result.status !== "prepared_for_owner_review") throw new Error("expected draft");
    const saved = JSON.stringify(result);
    m.receipt.inputRow.text = "changed"; m.identity.mentions[0]!.span.text = "changed";
    expect(JSON.stringify(result)).toBe(saved);
  });
});

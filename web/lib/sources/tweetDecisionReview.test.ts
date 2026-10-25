// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { qualifiedFixture } from "./fixtures/tweetClaimQualificationFixture";
import { extractDurableTweetClaims, TWEET_CLAIM_EXTRACTION_VERSION } from "./tweetClaimExtraction";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { prepareTweetReviewPacket, type TweetReviewPacket } from "./tweetReviewSidecar";
import { DECISION_REVIEW_BINDING_VERSION, DECISION_STATEMENT_VERSION, mapTweetDecisionReview, type DecisionStatementBinding, type MappedDecisionReview } from "./tweetDecisionReviewMapping";
import { validateTweetDecisionReviewResult } from "./tweetDecisionReviewResults";
import { createShadowAdapter, MODEL, type ReferenceRequest } from "./decisionsReference/adapter.mjs";

const NOW = "2026-10-16T15:02:00Z";
function fixture(prefix = "") {
  const f = qualifiedFixture();
  f.source.rawText = prefix + f.source.rawText;
  f.source.rawPayload = { text: f.source.rawText };
  f.source.metadata.interpretation.events = extractTweetPlayerEvents({ text: f.source.rawText,
    players: [{ playerId: 8478499, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", teamId: 6 }],
    publishedAt: f.source.tweetPostedAt, includeClaimAnchors: true });
  const receipt = { id: "00000000-0000-4000-8000-000000000001", eventTable: "line_source_ifttt_events" as const,
    eventId: "00000000-0000-4000-8000-000000000002", receivedAt: f.source.observedAt,
    inputRow: { tweet_id: f.source.tweetId, text: f.source.rawText, tweet_created_at: f.source.tweetPostedAt,
      link_to_tweet: f.source.sourceUrl, raw_payload: f.source.rawPayload } };
  return prepareTweetReviewPacket({ receipt, source: f.source, claims: extractDurableTweetClaims({ source: f.source, game: f.game, interpretedAt: f.asOf }) });
}
function statement(packet: TweetReviewPacket, index = 0): DecisionStatementBinding {
  const c = packet.candidates[index]!;
  return { version: DECISION_STATEMENT_VERSION, observationId: c.observationId, sourceId: packet.source.retainedSourceId,
    sourceTextVersionId: packet.source.sourceTextVersionId, extractionVersion: c.extractionVersion, playerId: c.canonicalPlayerIds[0]!,
    statement: "The source identifies Jeremy Swayman as the starting goalie for the game it discusses.",
    proposition: structuredClone({ fact: c.fact, scope: c.scope, modality: c.modality, effectiveAt: c.effectiveAt }), evidence: structuredClone(c.evidence) };
}
function map(packet = fixture(), statements = [statement(packet)]) {
  return mapTweetDecisionReview({ enabled: true, packet, statements, extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION });
}
function plan(packet = fixture(), statements = [statement(packet)]): MappedDecisionReview {
  const p = map(packet, statements); expect(p.status, JSON.stringify(p)).toBe("mapped");
  if (p.status !== "mapped") throw new Error("Fixture not mapped");
  return p;
}
function reply(request: ReferenceRequest): any {
  return { requestId: "offline-test-only", body: { model: MODEL, usage: { input_tokens: 1000 }, answers: request.questions.map(q =>
    q.type === "predicate" ? { name: q.name, type: q.type, probability: 0.8 } : { name: q.name, type: q.type,
      choice: q.choices![0]!.value, confidence: 0.7, probabilities: q.choices!.map((c, index) => ({ value: c.value, probability: index === 0 ? 1 : 0 })) }) } };
}
async function result(p: MappedDecisionReview, change?: (r: any) => void) {
  const a = createShadowAdapter({ config: { enabled: true, maxRequests: 2, maxInputTokens: 200000, maxEstimatedUsd: 1 },
    now: () => NOW, transport: async request => { const r = reply(request); change?.(r); return r; } });
  return { bindingVersion: DECISION_REVIEW_BINDING_VERSION, planHash: p.planHash, packetHash: p.packetHash, sidecar: await a.evaluate(p.input) as any };
}

describe("pure Decisions mapping", () => {
  it("is disabled before inspecting input and has no transport or write interface", () => {
    const access = vi.fn(() => { throw new Error("must not inspect disabled input"); });
    for (const enabled of [undefined, false, "false", 1]) {
      const args = Object.defineProperty({ enabled }, "packet", { get: access });
      expect(mapTweetDecisionReview(args as any)).toMatchObject({ status: "disabled", request: null, providerDispatchEnabled: false, canPublish: false });
    }
    expect(access).not.toHaveBeenCalled();
  });
  it("maps one explicit bound statement without generating prose, rekeying, mutation or caller-field forwarding", () => {
    const packet = fixture(), s = statement(packet), before = structuredClone({ packet, s });
    (s as any).secret = "not-forwarded";
    const p = plan(packet, [s]);
    expect(p.request.questions.map(q => q.name)).toEqual(["post_material_news", "claim_0_support", "claim_0_wording"]);
    expect(p.input.claims[0]).toEqual({ id: packet.candidates[0]!.observationId, sourceId: packet.source.retainedSourceId,
      playerId: "8478499", statement: s.statement, sourceSpan: { start: s.evidence.start, end: s.evidence.end, quote: s.evidence.text } });
    expect(p.input.source.authorId).toBe("x:handle:reporter"); expect(p.input.source.text).toBe(packet.source.text);
    expect(JSON.stringify(p.request)).not.toContain("not-forwarded");
    expect(packet).toEqual(before.packet); expect({ ...s, secret: undefined }).toEqual({ ...before.s, secret: undefined });
    expect(Object.isFrozen(p)).toBe(true); expect(Object.isFrozen(p.request.questions)).toBe(true);
    expect(p.providerDispatchEnabled).toBe(false);
  });
  it("maps zero-claim whole-post relevance only with provenance and an explicit extraction version", () => {
    const packet = fixture(); packet.candidates = []; packet.candidateCount = 0;
    const p = plan(packet, []); expect(p.request.questions).toHaveLength(1); expect(p.input.claims).toEqual([]);
    expect(mapTweetDecisionReview({ enabled: true, packet, extractionVersion: "" }).status).toBe("held");
  });
  it.each(["publishedAt", "author", "url", "originalPostId"])("holds missing original %s", key => {
    const packet = fixture(); (packet.source as any)[key] = null;
    expect(map(packet).status).toBe("held");
  });
  it("keeps explicit source holds and rejects timezone-less or source-after-ingestion clocks", () => {
    const held = fixture(); held.holds.push("publication_time_missing"); expect(map(held)).toMatchObject({ status: "held", reasons: expect.arrayContaining(["publication_time_missing"]) });
    const zone = fixture(); zone.source.ingestedAt = "2026-10-16T15:01:00"; expect(map(zone).status).toBe("held");
    const future = fixture(); future.source.publishedAt = "2026-10-16T15:03:00Z"; expect(map(future).status).toBe("held");
  });
  it("never substitutes a relay or a fabricated original account identity", () => {
    const relay = fixture(); relay.source.author = "gamedaylines"; expect(map(relay).status).toBe("held");
    const fabricated = fixture(); fabricated.source.provenance.attribution.original!.accountKey = "x:id:invented";
    expect(map(fabricated).status).toBe("held");
  });
  it("rejects changed source bytes, text-version and packet versions", () => {
    for (const key of ["text", "sourceTextVersionId"] as const) {
      const p = fixture(); p.source[key] = "changed"; expect(map(p).status).toBe("held");
    }
    const p = fixture(); (p as any).version = "future"; expect(map(p).status).toBe("held");
  });
  it.each([[], [8478499, 999], [8478499, 8478499]].map(ids => ({ ids })))("holds ambiguous/missing identities $ids without choosing one", ({ ids }) => {
    const p = fixture(); p.candidates[0]!.canonicalPlayerIds = ids;
    const m = map(p); expect(m).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["single_player_identity_required"]) }] });
    if (m.status === "mapped") expect(m.request.questions).toHaveLength(1);
  });
  it("keeps existing candidate holds, unsupported lineup facts and mismatched fact players unresolved", () => {
    const held = fixture(); held.candidates[0]!.holds.push("deterministic_support_unresolved");
    expect(map(held)).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["deterministic_support_unresolved"]) }] });
    const lineup = fixture(); (lineup.candidates[0] as any).fact = { kind: "lineup", situation: "pp", units: [{ slot: "PP1", playerIds: [8478499] }] };
    expect(map(lineup)).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["proposition_or_player_mismatch"]) }] });
    const wrong = fixture(); (wrong.candidates[0]!.fact as any).playerId = 999;
    expect(map(wrong)).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["proposition_or_player_mismatch"]) }] });
  });
  it("requires a statement, rejects duplicate bindings and records unmatched statements", () => {
    const p = fixture(), s = statement(p);
    expect(map(p, [])).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["statement_missing"]) }] });
    expect(map(p, [s, s])).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["ambiguous_statement_binding"]) }] });
    expect(map(p, [s, { ...s, observationId: "unknown-observation" }])).toMatchObject({ status: "mapped", unboundStatements: [{ observationId: "unknown-observation" }] });
  });
  it.each(["sourceId", "sourceTextVersionId", "extractionVersion", "version", "playerId", "proposition", "evidence"])("rejects wrong statement %s binding", key => {
    const p = fixture(), s = statement(p); (s as any)[key] = key === "playerId" ? 999 : "wrong";
    expect(map(p, [s])).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["statement_binding_mismatch"]) }] });
  });
  it("keeps duplicate native IDs and mixed extraction versions unknown", () => {
    const p = fixture(), c = p.candidates[0]!; p.candidates.push(structuredClone(c)); p.candidateCount = 2;
    const m = map(p, [statement(p)]); expect(m).toMatchObject({ status: "mapped", heldCandidates: expect.arrayContaining([{ candidateIndex: 0, observationId: c.observationId, reasons: expect.arrayContaining(["ambiguous_observation_identity"]) }]) });
    if (m.status === "mapped") expect(m.input.claims).toEqual([]);
    const mixed = fixture(); mixed.candidates[0]!.extractionVersion = "other-parser";
    expect(map(mixed)).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["claim_extraction_version_mismatch"]) }] });
  });
  it("checks exact UTF-16 offsets including surrogate boundaries", () => {
    const p = fixture("🏒 "); expect(plan(p).input.source.text).toContain("🏒");
    const bad = fixture("🏒 "); bad.candidates[0]!.evidence = { ...bad.candidates[0]!.evidence, start: bad.candidates[0]!.evidence.start - 1 };
    expect(map(bad)).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["invalid_exact_utf16_span"]) }] });
    const split = fixture("🏒 "); split.candidates[0]!.evidence = { start: 0, end: 1, text: split.source.text.slice(0, 1) };
    expect(map(split)).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["invalid_exact_utf16_span"]) }] });
  });
  it("retains overflow/byte-limit holds without truncating source or silently scoring a prefix", () => {
    const p = fixture(); p.candidateCount = 100; p.candidatesOmitted = "overflow"; p.holds.push("candidate_overflow");
    expect(map(p)).toMatchObject({ status: "held", candidateCount: 100, request: null });
    const normal = fixture(), s = statement(normal); s.statement = "x".repeat(35000); const before = structuredClone(normal);
    expect(map(normal, [s])).toMatchObject({ status: "held", reasons: ["reference_request_byte_limit"] }); expect(normal).toEqual(before);
  });
  it("does not confuse the first valid question index with an earlier held native candidate", () => {
    const p = fixture(), first = p.candidates[0]!; const second = { ...structuredClone(first), observationId: "test:second-observation" };
    first.holds.push("unresolved_fixture"); p.candidates.push(second); p.candidateCount = 2;
    const m = plan(p, [statement(p), statement(p, 1)]); expect(m.bindings[0]!.candidateIndex).toBe(1);
    expect(m.referenceAudit.claimBindings[0]).toMatchObject({ claimId: second.observationId, questionNames: ["claim_0_support", "claim_0_wording"] });
  });
  it("retains incompatible native fact/scope combinations rather than relabeling them", () => {
    const p = fixture(); p.candidates[0]!.scope = { kind: "session", teamId: 6, date: "2026-10-16", sessionId: "fixture", group: null };
    expect(map(p)).toMatchObject({ status: "mapped", heldCandidates: [{ reasons: expect.arrayContaining(["proposition_or_player_mismatch"]) }] });
  });
});

describe("reference result binding, never factual acceptance", () => {
  it("binds ordinary results to the exact statement while keeping uncalibrated review-only authority", async () => {
    const p = plan(), r = await result(p), before = structuredClone(r), out = validateTweetDecisionReviewResult(p, r);
    expect(out).toMatchObject({ status: "bound_review", canPublish: false, canChangeStatus: false, providerDispatchEnabled: false,
      sourceSupportMeaning: "assessment_of_supplied_statement_only", calibrationStatus: "uncalibrated_shadow_only",
      claims: [{ observationId: p.bindings[0]!.observationId, statement: p.input.claims[0]!.statement, support: { status: "scored" } }] });
    expect(out.reviewReasons).toContain("uncalibrated_shadow_only"); expect(r).toEqual(before);
    expect(out).not.toHaveProperty("fact"); expect(out).not.toHaveProperty("assignment");
  });
  it("retains zero-claim post assessment and all locally held candidates", async () => {
    const zero = fixture(); zero.candidates = []; zero.candidateCount = 0;
    const zeroPlan = plan(zero, []), zeroOut = validateTweetDecisionReviewResult(zeroPlan, await result(zeroPlan));
    expect(zeroOut).toMatchObject({ status: "bound_review", post: { status: "scored" }, claims: [] });
    expect(zeroOut.reviewReasons).toContain("zero_claim_post_requires_sampling_or_review");
    const packet = fixture(); packet.candidates[0]!.holds.push("deterministic_support_unresolved");
    const p = plan(packet), out = validateTweetDecisionReviewResult(p, await result(p));
    expect(out).toMatchObject({ status: "partial_or_unknown", post: { status: "scored" }, claims: [], heldCandidates: [{ reasons: expect.arrayContaining(["deterministic_support_unresolved"]) }] });
  });
  it.each(["planHash", "packetHash", "bindingVersion"])("rejects wrong application %s", async key => {
    const p = plan(), r = await result(p); (r as any)[key] = "wrong";
    expect(validateTweetDecisionReviewResult(p, r)).toMatchObject({ status: "unknown", reason: "application_binding_mismatch", post: { status: "unknown" } });
  });
  it.each(["sourceId", "sourceHash", "claimsHash", "evidenceHash", "requestHash", "idempotencyKey", "extractionVersion", "promptVersion", "modelRequested", "modelReturned", "asOf"])("rejects wrong reference %s", async key => {
    const p = plan(), r = await result(p); r.sidecar.audit[key] = "wrong";
    expect(validateTweetDecisionReviewResult(p, r)).toMatchObject({ status: "unknown", reason: "reference_binding_mismatch" });
  });
  it.each(["claimId", "sourceId", "playerId", "sourceSpan", "questionNames"])("rejects wrong claim audit %s", async key => {
    const p = plan(), r = await result(p); r.sidecar.audit.claimBindings[0][key] = "wrong";
    expect(validateTweetDecisionReviewResult(p, r)).toMatchObject({ status: "unknown", reason: "reference_binding_mismatch" });
  });
  it("rejects malformed, missing, future-version or incorrectly clocked audit envelopes", async () => {
    const p = plan(); expect(validateTweetDecisionReviewResult(p, null).status).toBe("unknown");
    const r = await result(p); r.sidecar.audit.createdAt = "2026-10-16T15:00:00Z";
    expect(validateTweetDecisionReviewResult(p, r)).toMatchObject({ status: "unknown", reason: "reference_clock_mismatch" });
    const cal = await result(p); cal.sidecar.audit.calibration = { version: "unreviewed" };
    expect(validateTweetDecisionReviewResult(p, cal)).toMatchObject({ status: "unknown", reason: "reference_binding_mismatch" });
  });
  it("keeps refusals, duplicate/missing answers and malformed probabilities unknown without erasing neighbors", async () => {
    const p = plan(), refusal = await result(p, r => { r.body.answers[1] = { name: "claim_0_support", type: "refusal" }; });
    expect(validateTweetDecisionReviewResult(p, refusal)).toMatchObject({ status: "partial_or_unknown", post: { status: "scored" }, claims: [{ support: { status: "unknown", reason: "refusal" }, wording: { status: "scored" } }] });
    const duplicate = await result(p); duplicate.sidecar.results.push(structuredClone(duplicate.sidecar.results[1]));
    expect(validateTweetDecisionReviewResult(p, duplicate)).toMatchObject({ claims: [{ support: { status: "unknown", reason: "missing_or_duplicate_answer" }, wording: { status: "scored" } }] });
    const missing = await result(p); missing.sidecar.results.splice(1, 1);
    expect(validateTweetDecisionReviewResult(p, missing)).toMatchObject({ claims: [{ support: { status: "unknown" }, wording: { status: "scored" } }] });
    const bad = await result(p); bad.sidecar.results[1].probabilities[0].probability = 2;
    expect(validateTweetDecisionReviewResult(p, bad)).toMatchObject({ claims: [{ support: { status: "unknown", reason: "invalid_choice_distribution" } }] });
  });
  it("rejects foreign question results and preserves budget uncertainty", async () => {
    const p = plan(), r = await result(p); r.sidecar.results.push({ name: "claim_999_support", status: "scored" });
    expect(validateTweetDecisionReviewResult(p, r)).toMatchObject({ status: "unknown", reason: "unexpected_answer_name" });
    const usage = await result(p, r => { delete r.body.usage; });
    expect(validateTweetDecisionReviewResult(p, usage)).toMatchObject({ status: "unknown", reason: "reference_budget_accounting_unresolved" });
  });
  it("default zero budgets cannot be mistaken for an executed assessment", async () => {
    const p = plan(), transport = vi.fn(async r => reply(r));
    const a = createShadowAdapter({ config: { enabled: true }, now: () => NOW, transport });
    const r = { bindingVersion: DECISION_REVIEW_BINDING_VERSION, planHash: p.planHash, packetHash: p.packetHash, sidecar: await a.evaluate(p.input) };
    expect(validateTweetDecisionReviewResult(p, r)).toMatchObject({ status: "unknown", reason: "reference_budget_exhausted" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("keeps a reference transport failure unknown without automatic retries", async () => {
    const p = plan(), transport = vi.fn(async () => { throw new Error("synthetic offline failure"); });
    const a = createShadowAdapter({ config: { enabled: true, maxRequests: 2, maxInputTokens: 200000, maxEstimatedUsd: 1 }, now: () => NOW, transport });
    const r = { bindingVersion: DECISION_REVIEW_BINDING_VERSION, planHash: p.planHash, packetHash: p.packetHash, sidecar: await a.evaluate(p.input) };
    expect(validateTweetDecisionReviewResult(p, r)).toMatchObject({ status: "unknown", reason: "reference_transport_or_response_error" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("no caller/model field can trigger a write or promote a status", async () => {
    const p = plan(), r = await result(p), write = vi.fn(); r.sidecar.publish = write; r.sidecar.canPublish = true; r.sidecar.assignment = { status: "confirmed" };
    const out = validateTweetDecisionReviewResult(p, r);
    expect(out.canPublish).toBe(false); expect(out.canChangeStatus).toBe(false); expect(out).not.toHaveProperty("assignment"); expect(write).not.toHaveBeenCalled();
  });
});

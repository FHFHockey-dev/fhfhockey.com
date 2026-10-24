// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { qualifiedFixture } from "./fixtures/tweetClaimQualificationFixture";
import library from "./fixtures/tweetLunaAdjudicatedLibrary.json";
import { extractDurableTweetClaims, TWEET_CLAIM_EXTRACTION_VERSION } from "./tweetClaimExtraction";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { prepareTweetReviewPacket } from "./tweetReviewSidecar";
import { DECISION_REFERENCE_SHA256, DECISION_STATEMENT_VERSION } from "./tweetDecisionReviewMapping";
import { runRetainedTweetLunaReview, type LunaReviewInput } from "./tweetLunaReview";
import { createLunaTransport, LUNA_MODEL, LUNA_RESERVATION_NANO_USD, priceLunaUsage } from "./tweetLunaTransport";
import { openLunaLocalAdmission } from "./tweetLunaLocalStore";
import { getPublicNewsClaimPresentation } from "lib/newsFeed";

const NOW = "2026-10-16T15:02:00Z";
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function fixture(text = "BOS Jeremy Swayman starts tonight."): LunaReviewInput {
  const f = qualifiedFixture(); f.source.rawText = text; f.source.rawPayload = { text };
  f.source.metadata.interpretation.events = extractTweetPlayerEvents({ text, publishedAt: f.source.tweetPostedAt, includeClaimAnchors: true,
    players: [{ playerId: 8478499, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", teamId: 6 }] });
  const packet = prepareTweetReviewPacket({ source: f.source,
    receipt: { id: "receipt-1", eventTable: "line_source_ifttt_events", eventId: "event-1", receivedAt: f.source.observedAt,
      inputRow: { tweet_id: f.source.tweetId, text, tweet_created_at: f.source.tweetPostedAt, link_to_tweet: f.source.sourceUrl, raw_payload: f.source.rawPayload } },
    claims: extractDurableTweetClaims({ source: f.source, game: f.game, interpretedAt: f.asOf }) });
  const statements: LunaReviewInput["statements"] = packet.candidates.map(c => ({ version: DECISION_STATEMENT_VERSION, observationId: c.observationId,
    sourceId: packet.source.retainedSourceId, sourceTextVersionId: packet.source.sourceTextVersionId, extractionVersion: c.extractionVersion,
    playerId: c.canonicalPlayerIds[0]!, statement: "The source identifies Jeremy Swayman as starting in the game it discusses.",
    proposition: structuredClone({ fact: c.fact, scope: c.scope, modality: c.modality, effectiveAt: c.effectiveAt }), evidence: c.evidence }));
  const start = text.indexOf("Jeremy Swayman");
  return { packet, statements, extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION, decisions: true, identity: {
    evidence: { version: "saved-public-player-evidence-v1", cohort: "synthetic-integration",
      players: [{ nhlId: 8478499, registryId: 1, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", provenance: "synthetic", knownAt: "2026-10-01T00:00:00Z" }],
      aliases: [], memberships: [], completeness: { status: "partial", scope: "one synthetic identity", omittedRecords: null }, truncated: false },
    evaluation: { mode: "causal_as_of", sourcePublishedAt: f.source.tweetPostedAt }, asOf: NOW,
    mentions: [{ id: "subject", kind: "name", span: { start, end: start + 14, text: "Jeremy Swayman" }, teamHint: null, positionHint: null }],
  } };
}
function harness(options: { mutate?: (body: any, endpoint: string, wire: any) => void; ledger?: Record<string, unknown>; timeout?: boolean; timeoutMs?: number; stopped?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "luna-integration-")); dirs.push(dir); const path = join(dir, "ledger.json");
  writeFileSync(path, JSON.stringify({ version: "luna-local-admission-v1", approvedPolicyId: "synthetic-no-paid-authority", enabled: true,
    blockedReason: null, expiresAt: "2026-10-17T00:00:00Z", capNanoUsd: 520_000_000, priorExposureNanoUsd: 0, maxCalls: 4, attempts: {}, ...options.ledger }));
  const fetcher = vi.fn(async (url: any, init: any) => {
    if (options.timeout) return new Promise<Response>(() => undefined);
    const wire = JSON.parse(init.body), endpoint = String(url).endsWith("responses") ? "responses" : "decisions";
    let body: any = { id: "response-fixture", model: LUNA_MODEL, usage: { input_tokens: 100, output_tokens: 50 } };
    if (endpoint === "responses") {
      const request = JSON.parse(wire.input);
      const identity = { version: request.version, requestHash: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
        directoryHash: request.directory.hash, occurrences: request.occurrences.map((o: any) => ({ occurrenceId: o.id,
          canonicalId: o.candidateSet.candidates[0]?.row.canonicalId ?? null, status: o.candidateSet.candidates.length ? "matched" : "missing",
          evidence: o.span, identityConfidence: "tentative" })) };
      const proposed = { identity, goalieStatuses: [] };
      body = { ...body, status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(proposed) }] }] };
    } else body.answers = wire.questions.map((q: any) => q.type === "predicate" ? { name: q.name, type: q.type, probability: 0.9 }
      : { name: q.name, type: q.type, choice: q.choices[0].value, confidence: 0.9,
        probabilities: q.choices.map((c: any, i: number) => ({ value: c.value, probability: i === 0 ? 1 : 0 })) });
    options.mutate?.(body, endpoint, wire);
    return new Response(JSON.stringify(body), { headers: { "x-request-id": `request-${endpoint}` } });
  });
  const key = vi.fn(() => "synthetic-key");
  const store = openLunaLocalAdmission(path, () => Date.parse(NOW));
  const transport = createLunaTransport({ enabled: true, stopped: () => options.stopped === true, apiKey: key, admission: store,
    fetch: fetcher as typeof fetch, timeoutMs: options.timeoutMs });
  return { path, fetcher, key, transport, store, ledger: () => JSON.parse(readFileSync(path, "utf8")),
    run: (input = fixture(), enabled = true) => runRetainedTweetLunaReview({ enabled, input, transport, now: () => NOW }) };
}
function changeProposal(body: any, endpoint: string, edit: (value: any) => void) {
  if (endpoint !== "responses") return;
  const value = JSON.parse(body.output[0].content[0].text); edit(value); body.output[0].content[0].text = JSON.stringify(value);
}

describe("bounded retained Luna caller", () => {
  it("defaults off before reading input or invoking transport", async () => {
    const h = harness(); const r = await h.run(fixture(), false);
    expect(r.status).toBe("disabled"); expect(h.fetcher).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled();
  });
  it("runs the real caller through mocked Responses then pinned Decisions without promoting facts", async () => {
    const h = harness(), input = fixture(), before = structuredClone(input); const r = await h.run(input);
    expect(r).toMatchObject({ status: "review_only", attempts: 2, canPublish: false, canChangeStatus: false, canWriteAliases: false,
      lineage: { author: input.packet.source.author, originalPostId: "1000" }, decisionReview: { status: "bound_review" } });
    expect(input).toEqual(before); expect(h.fetcher).toHaveBeenCalledTimes(2);
    for (const [, init] of h.fetcher.mock.calls) expect(init.redirect).toBe("error");
    const wire = JSON.parse(h.fetcher.mock.calls[0]![1].body);
    expect(wire).toMatchObject({ model: "gpt-6-luna", store: false, tools: [], max_output_tokens: 2048, prompt_cache_options: { mode: "explicit" } });
    expect(h.ledger().blockedReason).toBeNull();
  });
  it.each(["publishedAt", "author", "originalPostId"])("holds missing original %s before dispatch", async field => {
    const h = harness(), input = fixture(); (input.packet.source as any)[field] = null;
    expect((await h.run(input)).status).toBe("held"); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("rebuilds the snapshot for the exact source publication instant", async () => {
    const h = harness(), input = fixture(); input.identity!.evaluation.sourcePublishedAt = "2026-10-17T00:00:00Z";
    expect((await h.run(input)).status).toBe("held"); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("holds unavailable historical identity evidence without a paid request", async () => {
    const h = harness(), input = fixture(); (input.identity!.evidence as any).players[0].knownAt = NOW;
    expect((await h.run(input)).status).toBe("held"); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it.each(["id", "span", "authority"])("rejects injected %s and stops before downstream fan-out", async kind => {
    const h = harness({ mutate: (b, e) => changeProposal(b, e, v => {
      if (kind === "id") v.identity.occurrences[0].canonicalId = "nhl:999";
      if (kind === "span") v.identity.occurrences[0].evidence.start++;
      if (kind === "authority") v.identity.canPublish = true;
    }) });
    expect((await h.run()).status).toBe("held"); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps missing/ambiguous candidates as abstentions without paid widening", async () => {
    const h = harness({ mutate: (b, e) => changeProposal(b, e, v => { v.identity.occurrences[0].canonicalId = null; v.identity.occurrences[0].status = "needs_widening"; }) });
    const input = fixture(); input.decisions = false;
    expect((await h.run(input)).holds).toContain("identity_abstention_or_widening_requires_review"); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a forced choice across colliding surnames", async () => {
    const h = harness(), input = fixture("BOS Swayman starts tonight.");
    input.identity!.mentions[0]!.span = { start: 4, end: 11, text: "Swayman" };
    (input.identity!.evidence as any).players.push({ ...(input.identity!.evidence as any).players[0], nhlId: 999, registryId: 2, fullName: "Other Swayman" });
    expect((await h.run(input)).status).toBe("held"); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["confirmed", "ruled_out"])("rejects practice certainty inflation to %s", async status => {
    const input = fixture("Jeremy Swayman first off at morning skate."); input.decisions = false;
    const h = harness({ mutate: (b, e) => changeProposal(b, e, v => { v.goalieStatuses = [{ occurrenceId: "subject", canonicalId: "nhl:8478499", status,
      evidence: { start: 0, end: input.packet.source.text.length, text: input.packet.source.text } }]; }) });
    expect((await h.run(input)).status).toBe("held");
  });
  it.each(["projected", "likely", "unknown", "confirmed", "ruled_out"])("keeps proposed %s separate from applied start probabilities", async status => {
    const input = fixture(status === "ruled_out" ? "Jeremy Swayman will not start tonight." : undefined); input.decisions = false;
    const h = harness({ mutate: (b, e) => changeProposal(b, e, v => { v.goalieStatuses = [{ occurrenceId: "subject", canonicalId: "nhl:8478499", status,
      evidence: { start: 0, end: input.packet.source.text.length, text: input.packet.source.text } }]; }) });
    const r = await h.run(input); expect(r.goalieStatuses[0]).toMatchObject({ verified: false, gameId: null, appliedOverride: null,
      policyFloorAfterAcceptance: status === "likely" ? 0.8 : status === "projected" ? 0.65 : null });
  });
  it("reuses settled responses across processes without new dispatch", async () => {
    const h = harness(); const first = await h.run(), second = await h.run();
    expect(second.identity).toEqual(first.identity); expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(Object.keys(h.ledger().attempts)).toHaveLength(2);
  });
  it("keeps a retraction/version separate and applies neither interpretation", async () => {
    const h = harness(); const before = await h.run(), corrected = await h.run(fixture("Correction: Jeremy Swayman will not start tonight."));
    expect(before.reviewQueueKey).not.toBe(corrected.reviewQueueKey);
    expect(before.lineage?.originalPostId).toBe(corrected.lineage?.originalPostId);
    expect([before.canChangeStatus, corrected.canChangeStatus]).toEqual([false, false]);
  });
  it("rejects a confirmed proposal that contradicts explicit not-starting wording", async () => {
    const input = fixture("Jeremy Swayman will not start tonight."); input.decisions = false;
    const h = harness({ mutate: (b, e) => changeProposal(b, e, v => { v.goalieStatuses = [{ occurrenceId: "subject", canonicalId: "nhl:8478499", status: "confirmed",
      evidence: { start: 0, end: input.packet.source.text.length, text: input.packet.source.text } }]; }) });
    expect((await h.run(input)).status).toBe("held");
  });
  it("retains timeout reservation, blocks replay and performs no retries", async () => {
    const h = harness({ timeout: true, timeoutMs: 5 });
    expect((await h.run()).status).toBe("held"); await h.run();
    expect(h.fetcher).toHaveBeenCalledTimes(1); expect(h.ledger().blockedReason).toBe("unknown_billed_outcome");
    expect(Object.values(h.ledger().attempts)[0]).toMatchObject({ state: "uncertain", reservedNanoUsd: LUNA_RESERVATION_NANO_USD });
  });
  it("preserves the historical global stop regardless of apparent headroom", async () => {
    const h = harness({ ledger: { blockedReason: "unknown billed outcome", priorExposureNanoUsd: 262519843 } });
    expect((await h.run()).status).toBe("held"); expect(h.fetcher).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled();
  });
  it("enforces aggregate exposure before key lookup", async () => {
    const h = harness({ ledger: { priorExposureNanoUsd: 300_000_000 } });
    await h.run(); expect(h.fetcher).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled();
  });
  it("honors kill switch before admission or key lookup", async () => {
    const h = harness({ stopped: true }); await h.run(); expect(h.ledger().attempts).toEqual({}); expect(h.key).not.toHaveBeenCalled();
  });
  it("blocks unknown model billing without saving a successful receipt", async () => {
    const h = harness({ mutate: b => { b.model = "substituted"; } }); await h.run();
    expect(h.ledger().blockedReason).toBe("unknown_billed_outcome"); expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(Object.values(h.ledger().attempts)[0]).toMatchObject({ requestId: "request-responses", state: "uncertain" });
  });
  it("does not mistake review proposals for the homepage's versioned event contract", async () => {
    const input = fixture(), h = harness({ mutate: (b, e) => changeProposal(b, e, v => { v.goalieStatuses = [{ occurrenceId: "subject",
      canonicalId: "nhl:8478499", status: "projected", evidence: { start: 0, end: input.packet.source.text.length, text: input.packet.source.text } }]; }) });
    const r = await h.run(input);
    expect(r.goalieStatuses).toHaveLength(1);
    const presentation = getPublicNewsClaimPresentation({ headline: "Ignored model headline", blurb: input.packet.source.text,
      metadata: { interpretation: { version: r.version, events: r.goalieStatuses, unresolved: [] } } });
    expect(presentation.claims).toEqual([]); expect(presentation.unresolvedReason).toBeTruthy();
  });
  it("serializes admissions from independent store instances", async () => {
    const h = harness(), second = openLunaLocalAdmission(h.path, () => Date.parse(NOW));
    const results = await Promise.allSettled([h.store.reserve("one", LUNA_RESERVATION_NANO_USD), second.reserve("two", LUNA_RESERVATION_NANO_USD)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });
  it("reserves above the full-context long-rate regional ceiling", () => {
    expect(priceLunaUsage({ model: LUNA_MODEL, usage: { input_tokens: 1_050_000, output_tokens: 2048 } }, "responses")).toBeLessThan(LUNA_RESERVATION_NANO_USD);
  });
  it("preserves retained reference bytes", () => {
    expect(createHash("sha256").update(readFileSync("lib/sources/decisionsReference/adapter.mjs")).digest("hex")).toBe(DECISION_REFERENCE_SHA256);
  });
});

describe("provenance-preserving S01–S10 development library", () => {
  it.each(library.groups)("retains $sampleId source lineage and separates labels from facts", group => {
    expect(library.untouchedHoldout).toBe(false); expect(group.productionPublishable).toBe(false); expect(group.independentWorldTruth).toBeNull();
    expect(group.ownerAnnotations.length).toBeGreaterThan(0);
    for (const r of group.records) expect(createHash("sha256").update(r.text).digest("hex")).toBe(r.text_sha256);
    for (const claim of group.observedSourceClaims) {
      const r = group.records.find(r => r.record_id === claim.evidence.record_id)!;
      expect(r.text.slice(claim.evidence.utf16_start, claim.evidence.utf16_end)).toBe(claim.evidence.quote);
      expect(claim.label_authority).toBeTruthy();
    }
  });
});

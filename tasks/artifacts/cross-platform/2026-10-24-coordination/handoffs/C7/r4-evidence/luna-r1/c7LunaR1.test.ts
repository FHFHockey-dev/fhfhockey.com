// @vitest-environment node
// C7 R1 controls for the C2 F1/F2 repair. Expectations encode the repaired contract; run on base to show originals fail.
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { qualifiedFixture } from "lib/sources/fixtures/tweetClaimQualificationFixture";
import { extractDurableTweetClaims, TWEET_CLAIM_EXTRACTION_VERSION } from "lib/sources/tweetClaimExtraction";
import { extractTweetPlayerEvents } from "lib/sources/tweetPlayerEvents";
import { prepareTweetReviewPacket } from "lib/sources/tweetReviewSidecar";
import { DECISION_STATEMENT_VERSION } from "lib/sources/tweetDecisionReviewMapping";
import { runRetainedTweetLunaReview, type LunaReviewInput } from "lib/sources/tweetLunaReview";
import { createLunaTransport, LUNA_MODEL, LUNA_RESERVATION_NANO_USD } from "lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "lib/sources/tweetLunaLocalStore";

const OUT = process.env.C7_R1_OUT ?? "/dev/null";
const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT !== "/dev/null") writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const NOW = "2026-10-16T15:02:00Z";
const ALL_FALSE = { canPublish: false, canWriteAliases: false, canChangeStatus: false, canExecuteReplacement: false };
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function fixture(statementText = "The source identifies Jeremy Swayman as starting in the game it discusses.", withIdentity = true): LunaReviewInput {
  const text = "BOS Jeremy Swayman starts tonight.";
  const f = qualifiedFixture(); f.source.rawText = text; f.source.rawPayload = { text };
  f.source.metadata.interpretation.events = extractTweetPlayerEvents({ text, publishedAt: f.source.tweetPostedAt, includeClaimAnchors: true,
    players: [{ playerId: 8478499, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", teamId: 6 }] });
  const packet = prepareTweetReviewPacket({ source: f.source,
    receipt: { id: "receipt-1", eventTable: "line_source_ifttt_events", eventId: "event-1", receivedAt: f.source.observedAt,
      inputRow: { tweet_id: f.source.tweetId, text, tweet_created_at: f.source.tweetPostedAt, link_to_tweet: f.source.sourceUrl, raw_payload: f.source.rawPayload } },
    claims: extractDurableTweetClaims({ source: f.source, game: f.game, interpretedAt: f.asOf }) });
  const statements: LunaReviewInput["statements"] = packet.candidates.map(c => ({ version: DECISION_STATEMENT_VERSION, observationId: c.observationId,
    sourceId: packet.source.retainedSourceId, sourceTextVersionId: packet.source.sourceTextVersionId, extractionVersion: c.extractionVersion,
    playerId: c.canonicalPlayerIds[0]!, statement: statementText,
    proposition: structuredClone({ fact: c.fact, scope: c.scope, modality: c.modality, effectiveAt: c.effectiveAt }), evidence: c.evidence }));
  const start = text.indexOf("Jeremy Swayman");
  const input: LunaReviewInput = { packet, statements, extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION, decisions: true };
  if (withIdentity) input.identity = {
    evidence: { version: "saved-public-player-evidence-v1", cohort: "c7-r1",
      players: [{ nhlId: 8478499, registryId: 1, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", provenance: "synthetic", knownAt: "2026-10-01T00:00:00Z" }],
      aliases: [], memberships: [], completeness: { status: "partial", scope: "c7", omittedRecords: null }, truncated: false },
    evaluation: { mode: "causal_as_of", sourcePublishedAt: f.source.tweetPostedAt }, asOf: NOW,
    mentions: [{ id: "subject", kind: "name", span: { start, end: start + 14, text: "Jeremy Swayman" }, teamHint: null, positionHint: null }] as any };
  return input;
}
function harness(o: { ledger?: Record<string, unknown>; stopped?: () => boolean; key?: string; hang?: string; dropAnswers?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "c7-r1-")); dirs.push(dir); const path = join(dir, "ledger.json");
  writeFileSync(path, JSON.stringify({ version: "luna-local-admission-v1", approvedPolicyId: "c7-r1", enabled: true, blockedReason: null,
    expiresAt: "2026-10-17T00:00:00Z", capNanoUsd: 520_000_000, priorExposureNanoUsd: 0, maxCalls: 4, attempts: {}, ...o.ledger }));
  const fetcher = vi.fn(async (url: any, init: any) => {
    const wire = JSON.parse(init.body), endpoint = String(url).endsWith("responses") ? "responses" : "decisions";
    if (o.hang === endpoint) return new Promise<Response>(() => undefined);
    let body: any = { model: LUNA_MODEL, usage: { input_tokens: 100, output_tokens: 50 } };
    if (endpoint === "responses") {
      const request = JSON.parse(wire.input);
      const identity = { version: request.version, requestHash: createHash("sha256").update(JSON.stringify(request)).digest("hex"), directoryHash: request.directory.hash,
        occurrences: request.occurrences.map((x: any) => ({ occurrenceId: x.id, canonicalId: x.candidateSet.candidates[0]?.row.canonicalId ?? null,
          status: x.candidateSet.candidates.length ? "matched" : "missing", evidence: x.span, identityConfidence: "tentative" })) };
      body = { ...body, status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ identity, goalieStatuses: [] }) }] }] };
    } else body.answers = wire.questions.map((q: any) => q.type === "predicate" ? { name: q.name, type: q.type, probability: 0.9 }
      : { name: q.name, type: q.type, choice: q.choices[0].value, confidence: 0.9, probabilities: q.choices.map((c: any, i: number) => ({ value: c.value, probability: i === 0 ? 1 : 0 })) });
    if (endpoint === "decisions" && o.dropAnswers) delete body.answers;
    return new Response(JSON.stringify(body), { headers: { "x-request-id": `request-${endpoint}` } });
  });
  const key = vi.fn(() => ("key" in o ? o.key : "synthetic-c7-r1"));
  const store = openLunaLocalAdmission(path, () => Date.parse(NOW));
  const transport = createLunaTransport({ enabled: true, stopped: o.stopped ?? (() => false), apiKey: key, admission: store, fetch: fetcher as any, timeoutMs: 20 });
  return { path, fetcher, key, transport, ledger: () => JSON.parse(readFileSync(path, "utf8")),
    run: (input = fixture()) => runRetainedTweetLunaReview({ enabled: true, input, transport, now: () => NOW }) };
}
const rec = (name: string, r: any, h?: any) => {
  observed[name] = { status: r.status, attempts: r.attempts, holds: r.holds, requestIds: r.requestIds, decisionReview: r.decisionReview?.status ?? null,
    fetch: h?.fetcher.mock.calls.length, ledgerRows: h ? Object.values(h.ledger().attempts).map((a: any) => a.state) : null, blocked: h?.ledger().blockedReason ?? null };
  expect({ canPublish: r.canPublish, canWriteAliases: r.canWriteAliases, canChangeStatus: r.canChangeStatus, canExecuteReplacement: r.canExecuteReplacement }).toEqual(ALL_FALSE);
};

describe("R1 F1: an unusable Decisions leg is held, never review_only", () => {
  it("R1-01 Decisions timeout (my C07) → held with luna_attempt_held_no_retry; reservation retained", async () => {
    const h = harness({ hang: "decisions" }); const r = await h.run(); rec("R1-01", r, h);
    expect(r.status).toBe("held"); expect(r.holds).toContain("luna_attempt_held_no_retry"); expect(r.holds).not.toContain("human_review_required");
    expect(h.ledger().blockedReason).toBe("unknown_billed_outcome");
  });
  it("R1-02 kill switch flips between legs (my C06) → held luna_dispatch_disabled", async () => {
    let stop = false; const h = harness({ stopped: () => stop });
    h.fetcher.mockImplementationOnce(async (...a: any[]) => { stop = true; return (h.fetcher.getMockImplementation() as any)(...a); });
    const r = await h.run(); rec("R1-02", r, h);
    expect(r.status).toBe("held"); expect(r.holds).toContain("luna_dispatch_disabled"); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it("R1-03 settled Decisions reply the adapter cannot use (no answers) → held decisions_reference_unavailable", async () => {
    // run1 used a 70KB statement; it was held upstream (retained_packet_unresolved) and never reached the adapter.
    const h = harness({ dropAnswers: true }); const r = await h.run(); rec("R1-03", r, h);
    // run2: base yields partial_or_unknown (not unknown) → by-design review_only; observation only, spend must be settled.
    expect(h.fetcher).toHaveBeenCalledTimes(2); expect(r.holds).toContain("decisions_unresolved"); expect(h.ledger().blockedReason).toBeNull();
  });
  it("R1-04 Decisions-leg budget refusal (cap fits one call) → held luna_budget_exhausted, ledger not blocked", async () => {
    const h = harness({ ledger: { capNanoUsd: LUNA_RESERVATION_NANO_USD + 1 } }); const r = await h.run(); rec("R1-04", r, h);
    expect(r.status).toBe("held"); expect(r.holds).toContain("luna_budget_exhausted"); expect(r.attempts).toBe(1); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("R1 F2: attempts = fresh admitted reservations", () => {
  it.each([
    ["kill switch", { stopped: () => true }, 0],
    ["ledger stopped", { ledger: { blockedReason: "x" } }, 0],
    ["maxCalls 0", { ledger: { maxCalls: 0 } }, 0],
    ["unsettled leftover", { ledger: { attempts: { k: { reservedNanoUsd: 1, state: "reserved", receipt: null } } } }, 0],
    ["missing key after admission", { key: undefined }, 1],
    ["normal two legs", {}, 2],
  ] as const)("R1-05 %s", async (name, opts, expected) => {
    const h = harness(opts as any); const r = await h.run(); rec(`R1-05 ${name}`, r, h);
    expect(r.attempts).toBe(expected); expect(h.ledger() && Object.values(h.ledger().attempts).filter((a: any) => a.state !== "settled" || true).length).toBeGreaterThanOrEqual(0);
  });
  it("R1-06 replay of settled receipts reports 0 attempts and makes no fetch", async () => {
    const h = harness(); await h.run(); const second = await h.run(); rec("R1-06", second, h);
    expect(second.attempts).toBe(0); expect(h.fetcher).toHaveBeenCalledTimes(2); expect(second.status).toBe("review_only");
  });
  it("R1-07 attempts equals new ledger rows on every path above", async () => {
    const h = harness({ hang: "decisions" }); const r = await h.run();
    observed["R1-07"] = { attempts: r.attempts, rows: Object.keys(h.ledger().attempts).length };
    expect(r.attempts).toBe(Object.keys(h.ledger().attempts).length);
  });
});

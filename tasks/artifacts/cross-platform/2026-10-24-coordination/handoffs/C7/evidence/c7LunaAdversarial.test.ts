// @vitest-environment node
// C7 independent adversarial controls for LUNA-LOCAL. Reviewer-owned scratch; imports the real packet modules.
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { qualifiedFixture } from "lib/sources/fixtures/tweetClaimQualificationFixture";
import { extractDurableTweetClaims, TWEET_CLAIM_EXTRACTION_VERSION } from "lib/sources/tweetClaimExtraction";
import { extractTweetPlayerEvents } from "lib/sources/tweetPlayerEvents";
import { prepareTweetReviewPacket } from "lib/sources/tweetReviewSidecar";
import { DECISION_STATEMENT_VERSION } from "lib/sources/tweetDecisionReviewMapping";
import { runRetainedTweetLunaReview, LUNA_REVIEW_AUTHORITY, type LunaReviewInput } from "lib/sources/tweetLunaReview";
import { createLunaTransport, LUNA_MODEL, LUNA_RESERVATION_NANO_USD, priceLunaUsage } from "lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "lib/sources/tweetLunaLocalStore";

const OUT = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/out/controls-observed.json";
const observed: Record<string, unknown> = {};
afterAll(() => writeFileSync(OUT, JSON.stringify(observed, null, 2)));
const NOW = "2026-10-16T15:02:00Z";
const SWAY = { nhlId: 8478499, registryId: 1, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", provenance: "synthetic", knownAt: "2026-10-01T00:00:00Z" };
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function fixture(text = "BOS Jeremy Swayman starts tonight.", extraPlayers: any[] = [], extraMentions: string[] = []): LunaReviewInput {
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
  const mention = (name: string, id: string) => { const start = text.indexOf(name); return { id, kind: "name", span: { start, end: start + name.length, text: name }, teamHint: null, positionHint: null }; };
  return { packet, statements, extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION, decisions: true, identity: {
    evidence: { version: "saved-public-player-evidence-v1", cohort: "synthetic-c7", players: [SWAY, ...extraPlayers],
      aliases: [], memberships: [], completeness: { status: "partial", scope: "synthetic c7", omittedRecords: null }, truncated: false },
    evaluation: { mode: "causal_as_of", sourcePublishedAt: f.source.tweetPostedAt }, asOf: NOW,
    mentions: [mention("Jeremy Swayman", "subject"), ...extraMentions.map((n, i) => mention(n, `other${i}`))] as any,
  } };
}
function ledgerFile(extra: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "c7-luna-")); dirs.push(dir); const path = join(dir, "ledger.json");
  writeFileSync(path, JSON.stringify({ version: "luna-local-admission-v1", approvedPolicyId: "c7-synthetic-no-paid-authority", enabled: true,
    blockedReason: null, expiresAt: "2026-10-17T00:00:00Z", capNanoUsd: 520_000_000, priorExposureNanoUsd: 0, maxCalls: 4, attempts: {}, ...extra }));
  return path;
}
type Opts = { mutate?: (body: any, endpoint: string, wire: any) => void; status?: number; hang?: boolean | ((endpoint: string) => boolean);
  stopped?: () => boolean; key?: string | undefined; ledger?: Record<string, unknown>; path?: string; onFetch?: (endpoint: string) => void; raw?: (endpoint: string) => string };
function harness(o: Opts = {}) {
  const path = o.path ?? ledgerFile(o.ledger);
  const wires: any[] = [];
  const fetcher = vi.fn(async (url: any, init: any) => {
    const wire = JSON.parse(init.body), endpoint = String(url).endsWith("responses") ? "responses" : "decisions";
    wires.push({ endpoint, wire, init: { redirect: init.redirect, method: init.method } });
    o.onFetch?.(endpoint);
    if (typeof o.hang === "function" ? o.hang(endpoint) : o.hang) return new Promise<Response>(() => undefined);
    if (o.raw) return new Response(o.raw(endpoint), { status: o.status ?? 200, headers: { "x-request-id": `request-${endpoint}` } });
    let body: any = { id: "response-fixture", model: LUNA_MODEL, usage: { input_tokens: 100, output_tokens: 50 } };
    if (endpoint === "responses") {
      const request = JSON.parse(wire.input);
      const identity = { version: request.version, requestHash: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
        directoryHash: request.directory.hash, occurrences: request.occurrences.map((occ: any) => ({ occurrenceId: occ.id,
          canonicalId: occ.candidateSet.candidates[0]?.row.canonicalId ?? null, status: occ.candidateSet.candidates.length ? "matched" : "missing",
          evidence: occ.span, identityConfidence: "tentative" })) };
      body = { ...body, status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ identity, goalieStatuses: [] }) }] }] };
    } else body.answers = wire.questions.map((q: any) => q.type === "predicate" ? { name: q.name, type: q.type, probability: 0.9 }
      : { name: q.name, type: q.type, choice: q.choices[0].value, confidence: 0.9, probabilities: q.choices.map((c: any, i: number) => ({ value: c.value, probability: i === 0 ? 1 : 0 })) });
    o.mutate?.(body, endpoint, wire);
    return new Response(JSON.stringify(body), { status: o.status ?? 200, headers: { "x-request-id": `request-${endpoint}` } });
  });
  const key = vi.fn(() => ("key" in o ? o.key : "synthetic-c7-key"));
  const store = openLunaLocalAdmission(path, () => Date.parse(NOW));
  const transport = createLunaTransport({ enabled: true, stopped: o.stopped ?? (() => false), apiKey: key, admission: store, fetch: fetcher as typeof fetch, timeoutMs: 20 });
  return { path, fetcher, key, wires, transport, store, ledger: () => JSON.parse(readFileSync(path, "utf8")),
    run: (input = fixture(), enabled: any = true) => runRetainedTweetLunaReview({ enabled, input, transport, now: () => NOW }) };
}
function goalie(status: string, evidence?: { start: number; end: number; text: string }) {
  return (b: any, e: string, w: any) => { if (e !== "responses") return; const v = JSON.parse(b.output[0].content[0].text);
    const text = JSON.parse(w.input).source.text; v.goalieStatuses = [{ occurrenceId: "subject", canonicalId: "nhl:8478499", status, evidence: evidence ?? { start: 0, end: text.length, text } }];
    b.output[0].content[0].text = JSON.stringify(v); };
}
const flags = (r: any) => ({ canPublish: r.canPublish, canWriteAliases: r.canWriteAliases, canChangeStatus: r.canChangeStatus, canExecuteReplacement: r.canExecuteReplacement });
const ALL_FALSE = { canPublish: false, canWriteAliases: false, canChangeStatus: false, canExecuteReplacement: false };
function record(name: string, r: any, h?: ReturnType<typeof harness>, extra: Record<string, unknown> = {}) {
  const ledger = h && existsSync(h.path) ? h.ledger() : null;
  observed[name] = { status: r?.status, holds: r?.holds, attempts: r?.attempts, requestIds: r?.requestIds, flags: r ? flags(r) : null,
    fetchCalls: h?.fetcher.mock.calls.length, keyCalls: h?.key.mock.calls.length,
    ledger: ledger && { blockedReason: ledger.blockedReason, attempts: Object.values(ledger.attempts).map((a: any) => ({ state: a.state, reservedNanoUsd: a.reservedNanoUsd, charge: a.receipt?.chargeNanoUsd ?? null, requestId: a.requestId ?? null })) },
    ...extra };
  if (r) expect(flags(r)).toEqual(ALL_FALSE);
}

describe("C7 environment", () => {
  it("C01 network guard is active inside the forked worker", async () => {
    let message = "";
    try { await globalThis.fetch("https://api.openai.com/v1/responses"); } catch (e: any) { message = e.message; }
    observed.C01 = { fetchError: message }; expect(message).toBe("OFFLINE_LUNA_TEST_NETWORK_DENIED");
    expect(LUNA_REVIEW_AUTHORITY).toEqual(ALL_FALSE);
  });
});

describe("C7 disabled / zero-attempt paths", () => {
  it("C02 disabled never touches transport, key, admission or a missing ledger", async () => {
    const missing = join(mkdtempSync(join(tmpdir(), "c7-missing-")), "absent.json");
    const h = harness({ path: missing }); const r = await h.run(fixture(), false);
    record("C02", r, h, { ledgerCreated: existsSync(missing), lockCreated: existsSync(missing + ".lock") });
    expect(r.status).toBe("disabled"); expect(r.attempts).toBe(0); expect(h.fetcher).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled();
    expect(existsSync(missing)).toBe(false); expect(existsSync(missing + ".lock")).toBe(false);
  });
  it.each([["string true", "true"], ["1", 1], ["truthy object", {}]])("C03 enabled=%s is not enabled", async (_n, value) => {
    const h = harness(); const r = await h.run(fixture(), value);
    record(`C03 ${_n}`, r, h); expect(r.status).toBe("disabled"); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("C04 enabled without a transport holds with zero attempts", async () => {
    const r = await runRetainedTweetLunaReview({ enabled: true, input: fixture(), now: () => NOW });
    record("C04", r); expect(r.status).toBe("held"); expect(r.attempts).toBe(0); expect(r.holds).toContain("explicit_transport_required");
  });
  it("C05 kill switch on with dispatch: no fetch/key/admission (records reported attempts)", async () => {
    const h = harness({ stopped: () => true }); const r = await h.run();
    record("C05", r, h); expect(r.status).toBe("held"); expect(h.fetcher).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled();
    expect(h.ledger().attempts).toEqual({});
  });
  it("C06 kill switch flips on after Responses: Decisions not dispatched (records surfaced status)", async () => {
    let stop = false; const h = harness({ stopped: () => stop, onFetch: e => { if (e === "responses") stop = true; } }); const r = await h.run();
    record("C06", r, h); expect(h.fetcher).toHaveBeenCalledTimes(1); expect(h.ledger().blockedReason).toBeNull();
  });
});

describe("C7 uncertain-spend reservation", () => {
  it("C07 Decisions-leg timeout retains reservation and blocks ledger (records surfaced status)", async () => {
    const h = harness({ hang: e => e === "decisions" }); const r = await h.run();
    record("C07", r, h);
    expect(h.ledger().blockedReason).toBe("unknown_billed_outcome");
    expect(h.ledger().attempts && Object.values(h.ledger().attempts).some((a: any) => a.state === "uncertain" && a.reservedNanoUsd === LUNA_RESERVATION_NANO_USD)).toBe(true);
    const again = await h.run(); record("C07 rerun", again, h); expect(h.fetcher).toHaveBeenCalledTimes(2); expect(again.status).toBe("held");
  });
  it("C08 missing key after admission: no fetch, reservation held conservatively", async () => {
    const h = harness({ key: undefined }); const r = await h.run();
    record("C08", r, h); expect(h.fetcher).not.toHaveBeenCalled(); expect(r.status).toBe("held");
    expect(h.ledger().blockedReason).toBe("unknown_billed_outcome");
  });
  it.each(["reserved", "uncertain"])("C09 leftover %s row without blockedReason blocks new admission", async state => {
    const h = harness({ ledger: { attempts: { crashed: { reservedNanoUsd: LUNA_RESERVATION_NANO_USD, state, receipt: null } } } }); const r = await h.run();
    record(`C09 ${state}`, r, h); expect(h.fetcher).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled(); expect(r.holds).toContain("luna_unsettled_attempt");
  });
  it("C10 stale lock is never stolen; ledger bytes unchanged", async () => {
    const h = harness(); writeFileSync(h.path + ".lock", "stale"); const before = readFileSync(h.path, "utf8"); const r = await h.run();
    record("C10", r, h, { lockStillPresent: existsSync(h.path + ".lock"), ledgerUnchanged: readFileSync(h.path, "utf8") === before });
    expect(h.fetcher).not.toHaveBeenCalled(); expect(existsSync(h.path + ".lock")).toBe(true); expect(readFileSync(h.path, "utf8")).toBe(before);
  });
  it.each([["expired", { expiresAt: "2026-10-16T15:01:59Z" }], ["disabled ledger", { enabled: false }], ["maxCalls zero", { maxCalls: 0 }],
    ["cap below one reservation", { capNanoUsd: LUNA_RESERVATION_NANO_USD - 1 }]])("C11 %s admits nothing", async (name, ledger) => {
    const h = harness({ ledger }); const r = await h.run(); record(`C11 ${name}`, r, h);
    expect(h.fetcher).not.toHaveBeenCalled(); expect(h.key).not.toHaveBeenCalled(); expect(r.status).toBe("held");
  });
  it("C12 aggregate counts prior exposure + settled charges, not just reservations", async () => {
    const settled = { reservedNanoUsd: LUNA_RESERVATION_NANO_USD, state: "settled", receipt: { body: {}, requestId: "x", endpoint: "responses", chargeNanoUsd: 50_000_000 } };
    const h = harness({ ledger: { priorExposureNanoUsd: 262_519_843, capNanoUsd: 262_519_843 + 50_000_000 + LUNA_RESERVATION_NANO_USD - 1, attempts: { earlier: settled } } });
    const r = await h.run(); record("C12", r, h); expect(h.fetcher).not.toHaveBeenCalled(); expect(r.holds).toContain("luna_budget_exhausted");
  });
  it("C13 lock contention at settle: reservation never silently freed, next run blocked", async () => {
    let path = ""; const h = harness({ onFetch: () => writeFileSync(path + ".lock", "other-process") }); path = h.path;
    const r = await h.run(); const rowsAfter = Object.values(h.ledger().attempts).map((a: any) => a.state);
    rmSync(h.path + ".lock"); const again = await h.run();
    record("C13", r, h, { rowsAfterFirst: rowsAfter, rerunStatus: again.status, rerunHolds: again.holds });
    expect(r.status).toBe("held"); expect(rowsAfter).toEqual(["reserved"]); expect(again.holds).toContain("luna_unsettled_attempt"); expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["cached tokens", (b: any) => { b.usage.input_tokens_details = { cached_tokens: 10 }; }],
    ["priority tier", (b: any) => { b.service_tier = "priority"; }],
    ["dated model alias", (b: any) => { b.model = "gpt-6-luna-2026-10-01"; }],
    ["missing usage", (b: any) => { delete b.usage; }],
    ["output over cap", (b: any) => { b.usage.output_tokens = 2049; }],
    ["negative input", (b: any) => { b.usage.input_tokens = -1; }],
  ])("C14 unresolved billing (%s) is held uncertain, never settled", async (name, edit) => {
    const h = harness({ mutate: (b, e) => { if (e === "responses") edit(b); } }); const r = await h.run();
    record(`C14 ${name}`, r, h); expect(h.ledger().blockedReason).toBe("unknown_billed_outcome"); expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(Object.values(h.ledger().attempts).map((a: any) => a.state)).toEqual(["uncertain"]);
  });
  it("C15 oversize (>256KiB) and HTTP 500 responses are held uncertain", async () => {
    const big = harness({ raw: () => "x".repeat(262_145) }); const r1 = await big.run(); record("C15 oversize", r1, big);
    const err = harness({ status: 500 }); const r2 = await err.run(); record("C15 http500", r2, err);
    for (const h of [big, err]) { expect(h.ledger().blockedReason).toBe("unknown_billed_outcome"); expect(h.fetcher).toHaveBeenCalledTimes(1); }
  });
  it("C16 caller cannot widen the wire (tools/store/tokens/tier/extra fields)", async () => {
    const h = harness({ raw: () => "{}" });
    await h.transport("responses", { model: LUNA_MODEL, input: "x", tools: [{ type: "web_search" }], store: true, max_output_tokens: 100_000, service_tier: "priority", background: true } as any).catch(() => undefined);
    const wire = h.wires[0].wire; observed.C16 = { wireKeys: Object.keys(wire).sort(), tools: wire.tools, store: wire.store, max: wire.max_output_tokens, tier: wire.service_tier, redirect: h.wires[0].init.redirect };
    expect(wire).toMatchObject({ tools: [], store: false, max_output_tokens: 2048, service_tier: "default" }); expect(wire.background).toBeUndefined();
    expect(h.wires[0].init.redirect).toBe("error");
    await expect(h.transport("responses", { model: "gpt-5", input: "x" })).rejects.toThrow();
  });
  it("C17 provider error text and key never reach the review artifact", async () => {
    const path = ledgerFile(); const store = openLunaLocalAdmission(path, () => Date.parse(NOW));
    const transport = createLunaTransport({ enabled: true, stopped: () => false, apiKey: () => "sk-SENTINEL-C7", admission: store, timeoutMs: 20,
      fetch: (async () => { throw new Error("upstream said sk-SENTINEL-C7 BOS Jeremy Swayman"); }) as any });
    const r = await runRetainedTweetLunaReview({ enabled: true, input: fixture(), transport, now: () => NOW });
    const s = JSON.stringify(r); observed.C17 = { status: r.status, holds: r.holds, leaksKey: s.includes("sk-SENTINEL"), leaksUpstream: s.includes("upstream said") };
    expect(s.includes("sk-SENTINEL")).toBe(false); expect(s.includes("upstream said")).toBe(false);
  });
  it("C18 reservation ceiling arithmetic", () => {
    const max = priceLunaUsage({ model: LUNA_MODEL, usage: { input_tokens: 1_050_000, output_tokens: 2048 } }, "responses");
    const decisionsMax = priceLunaUsage({ model: LUNA_MODEL, usage: { input_tokens: 1_050_000, output_tokens: 999_999 } }, "decisions");
    observed.C18 = { responsesMaxNano: max, decisionsMaxNano: decisionsMax, reservation: LUNA_RESERVATION_NANO_USD };
    expect(max).toBeGreaterThanOrEqual(232_689_600); expect(max).toBeLessThanOrEqual(232_689_601); // run1: exact 232_689_600 expectation was reviewer error (float ceil rounds up) expect(max).toBeLessThanOrEqual(LUNA_RESERVATION_NANO_USD); expect(decisionsMax).toBeLessThanOrEqual(LUNA_RESERVATION_NANO_USD);
    expect(() => priceLunaUsage({ model: LUNA_MODEL, usage: { input_tokens: 1_050_001, output_tokens: 0 } }, "responses")).toThrow();
  });
});

describe("C7 source / time / occurrence binding", () => {
  it("C19 same source instant in another valid format is accepted; 1 ms later is held pre-dispatch", async () => {
    const ok = harness(), a = fixture(); a.identity!.evaluation.sourcePublishedAt = "2026-10-16T11:00:00.000-04:00";
    const r1 = await ok.run(a); record("C19 same-instant", r1, ok); expect(r1.status).toBe("review_only");
    const bad = harness(), b = fixture(); b.identity!.evaluation.sourcePublishedAt = "2026-10-16T15:00:00.001Z";
    const r2 = await bad.run(b); record("C19 +1ms", r2, bad); expect(r2.status).toBe("held"); expect(bad.fetcher).not.toHaveBeenCalled();
  });
  it.each([["asOf before publish", { asOf: "2026-10-16T14:59:59Z" }], ["asOf after now", { asOf: "2026-10-16T15:02:01Z" }]])("C20 %s held pre-dispatch", async (name, edit) => {
    const h = harness(), i = fixture(); Object.assign(i.identity!, edit); const r = await h.run(i);
    record(`C20 ${name}`, r, h); expect(r.status).toBe("held"); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("C21 review clock before ingestion is held pre-dispatch", async () => {
    const h = harness(); const r = await runRetainedTweetLunaReview({ enabled: true, input: fixture(), transport: h.transport, now: () => "2026-10-16T15:00:30Z" });
    record("C21", r, h); expect(r.status).toBe("held"); expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("C22 alias known after publish is excluded in causal mode; retrospective mode is explicitly marked", async () => {
    const late = { ...SWAY, knownAt: "2026-10-16T15:00:01Z" };
    const h1 = harness(), i1 = fixture(); (i1.identity!.evidence as any).players = [late]; const r1 = await h1.run(i1);
    record("C22 causal late", r1, h1); expect(r1.status).toBe("held"); expect(h1.fetcher).not.toHaveBeenCalled();
    const h2 = harness(), i2 = fixture(); (i2.identity!.evidence as any).players = [late]; i2.decisions = false;
    i2.identity!.evaluation = { mode: "retrospective", sourcePublishedAt: "2026-10-16T15:00:00Z", reviewedAt: "2026-10-16T15:01:30Z" } as any;
    const r2 = await h2.run(i2); record("C22 retrospective", r2, h2); expect(r2.holds).toContain("retrospective_development_evidence");
  });
  const KORPI = { nhlId: 8476914, registryId: 2, fullName: "Joonas Korpisalo", lastName: "Korpisalo", position: "G", provenance: "synthetic", knownAt: "2026-10-01T00:00:00Z" };
  const PASTA = { nhlId: 8477956, registryId: 3, fullName: "David Pastrnak", lastName: "Pastrnak", position: "R", provenance: "synthetic", knownAt: "2026-10-01T00:00:00Z" };
  it("C23 goalie evidence spanning another occurrence is rejected", async () => {
    const text = "BOS Jeremy Swayman starts tonight, Joonas Korpisalo backs up.";
    const i = fixture(text, [KORPI], ["Joonas Korpisalo"]); i.decisions = false;
    const h = harness({ mutate: goalie("confirmed") }); const r = await h.run(i);
    record("C23", r, h); expect(r.status).toBe("held"); expect(r.holds).toContain("goalie_subject_binding_invalid"); expect(r.goalieStatuses).toEqual([]);
  });
  it("C24 goalie status on a non-goalie subject is rejected", async () => {
    const text = "BOS Jeremy Swayman starts tonight, David Pastrnak skates."; // run2: text lacked the subject mention (reviewer error; held pre-dispatch)
    const i = fixture(text, [PASTA], ["David Pastrnak"]); i.decisions = false;
    const h = harness({ mutate: (b, e, w) => { if (e !== "responses") return; const v = JSON.parse(b.output[0].content[0].text);
      const s = text.indexOf("David"); v.goalieStatuses = [{ occurrenceId: "other0", canonicalId: "nhl:8477956", status: "projected", evidence: { start: s, end: s + 14, text: "David Pastrnak" } }];
      b.output[0].content[0].text = JSON.stringify(v); } });
    const r = await h.run(i); record("C24", r, h); expect(r.status).toBe("held"); expect(r.holds).toContain("goalie_subject_binding_invalid"); expect(r.goalieStatuses).toEqual([]);
  });
  it("C25 goalie canonicalId differing from the identity match is rejected; duplicate occurrence rejected", async () => {
    const i = fixture(); i.decisions = false;
    const h = harness({ mutate: (b, e, w) => { goalie("projected")(b, e, w); if (e !== "responses") return; const v = JSON.parse(b.output[0].content[0].text);
      v.goalieStatuses[0].canonicalId = "nhl:8476914"; b.output[0].content[0].text = JSON.stringify(v); } });
    const r = await h.run(i); record("C25 mismatch", r, h); expect(r.status).toBe("held");
    const d = harness({ mutate: (b, e, w) => { goalie("projected")(b, e, w); if (e !== "responses") return; const v = JSON.parse(b.output[0].content[0].text);
      v.goalieStatuses.push(v.goalieStatuses[0]); b.output[0].content[0].text = JSON.stringify(v); } });
    const r2 = await d.run(fixture()); record("C25 duplicate", r2, d); expect(r2.status).toBe("held");
  });
  it.each([["likely on not-starting wording", "likely", "Jeremy Swayman will not start tonight."],
    ["projected on ruled-out wording", "projected", "Jeremy Swayman ruled out tonight."]])("C26 %s (observation: soft statuses are not wording-checked)", async (name, status, text) => {
    const i = fixture(text); i.decisions = false; const h = harness({ mutate: goalie(status) }); const r = await h.run(i);
    record(`C26 ${name}`, r, h, { goalieStatuses: r.goalieStatuses.map((g: any) => ({ status: g.status, verified: g.verified, floor: g.policyFloorAfterAcceptance, appliedOverride: g.appliedOverride, holds: g.holds })) });
    for (const g of r.goalieStatuses as any[]) { expect(g.verified).toBe(false); expect(g.appliedOverride).toBeNull(); expect(g.holds).toContain("human_review_required"); }
  });
  it("C27 Decisions wire is identical with and without the Luna identity leg (proposals never become reviewer facts)", async () => {
    const withId = harness({ mutate: goalie("projected") }); await withId.run(fixture());
    const without = harness(), i = fixture(); delete i.identity; await without.run(i);
    const a = withId.wires.find(w => w.endpoint === "decisions")!.wire, b = without.wires.find(w => w.endpoint === "decisions")!.wire;
    observed.C27 = { identical: JSON.stringify(a) === JSON.stringify(b), decisionsWireKeys: Object.keys(a).sort() };
    expect(a).toEqual(b); expect(Object.keys(a).sort()).toEqual(["input", "model", "prompt_cache_options", "questions"]);
  });
});

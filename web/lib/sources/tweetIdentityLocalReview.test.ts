// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import https from "node:https";
import { evaluateLocalAliasIdentityReview } from "./tweetIdentityLocalReview";
import { offlineIdentityIndex, offlineIdentityReply, offlineIdentitySource } from "./fixtures/tweetIdentityOfflineFixture";
import type { AliasReviewName } from "./playerAliasReview";

const index = offlineIdentityIndex();
const input = (text = "Sparky remains out.", name = "Sparky") => ({ enabled: true, index, source: offlineIdentitySource(text),
  rows: [{ raw_name: name, context_text: text, team_id: null }] as AliasReviewName[] });
beforeEach(() => {
  const block = () => { throw new Error("local identity integration must remain offline"); };
  vi.stubGlobal("fetch", vi.fn(block));
  vi.spyOn(http, "request").mockImplementation(block); vi.spyOn(https, "request").mockImplementation(block);
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled(); expect(http.request).not.toHaveBeenCalled(); expect(https.request).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("local alias-review integration", () => {
  it("keeps the evaluation and model boundaries off before reading input/transport getters", async () => {
    const read = vi.fn(() => { throw new Error("disabled getter"); });
    const disabled = Object.defineProperties({ enabled: false }, { source: { get: read }, resolver: { get: read } });
    expect(await evaluateLocalAliasIdentityReview(disabled as never)).toMatchObject({ status: "disabled", attempts: 0 });
    const args = input(), resolver = Object.defineProperty({ enabled: false, kind: "mock" }, "transport", { get: read });
    expect(await evaluateLocalAliasIdentityReview({ ...args, resolver } as never)).toMatchObject({ status: "evaluated", modelMode: "not_run", attempts: 0 });
    expect(read).not.toHaveBeenCalled();
  });
  it("adapts the actual alias-review occurrence helper and unchanged baseline into a review-only proposal", async () => {
    const args = input(), before = structuredClone(args);
    const transport = vi.fn(async (request: Parameters<typeof offlineIdentityReply>[0]) => {
      expect(request.content.source.text).toBe(args.source.text);
      return offlineIdentityReply(request, () => ({ status: "matched", canonicalId: "nhl:1001" }));
    });
    const result = await evaluateLocalAliasIdentityReview({ ...args, resolver: { enabled: true, kind: "mock", transport } });
    expect(result).toMatchObject({ status: "evaluated", canPublish: false, canWriteAliases: false, canChangeStatus: false, modelMode: "mock", attempts: 1,
      occurrences: [{ baselineCandidateIds: [], baselineSelectedId: null, candidateIds: ["nhl:1001"], deterministicSelectedId: "nhl:1001",
        modelProposal: { canonicalId: "nhl:1001" }, origin: "existing_alias_occurrence" }] });
    expect(args).toEqual(before);
  });
  it("holds repeated unresolved names without choosing the first occurrence", async () => {
    const args = input("Sparky is out. Sparky could return.");
    expect(await evaluateLocalAliasIdentityReview(args)).toMatchObject({ status: "held", holds: [{ reason: "occurrence_not_uniquely_bound" }] });
    args.rows[0]!.metadata = { evidence: { start: 15, end: 21, text: "Sparky" } };
    expect(await evaluateLocalAliasIdentityReview(args)).toMatchObject({ status: "evaluated", occurrences: [{ span: { start: 15, end: 21 } }] });
  });
  it("keeps canonical acronym candidates separate from deterministic identity selection", async () => {
    const result = await evaluateLocalAliasIdentityReview(input("ESP practiced.", "ESP"));
    expect(result).toMatchObject({ status: "evaluated", modelMode: "not_run", attempts: 0,
      occurrences: [{ baselineCandidateIds: [], candidateIds: ["nhl:1004"], deterministicSelectedId: null, modelProposal: null }] });
  });
  it.each(["bad_span", "wrong_subject_span", "wrong_time", "wrong_text", "negative_span"])("holds malformed extraction before model dispatch: %s", async flaw => {
    const args = flaw === "wrong_subject_span" ? input("Sparky remains out. Milo North practiced.") : input();
    if (flaw === "bad_span") args.rows[0]!.metadata = { evidence: { start: 0, end: 6, text: "Wrong!" } };
    if (flaw === "negative_span") args.rows[0]!.metadata = { evidence: { start: -1, end: 6 } };
    if (flaw === "wrong_subject_span") args.rows[0]!.metadata = { evidence: { start: 20, end: 30, text: "Milo North" } };
    if (flaw === "wrong_time") args.rows[0]!.metadata = { sourcePublishedAt: "2026-10-15T00:00:00Z" };
    if (flaw === "wrong_text") args.rows[0]!.context_text = "different wrapper/quoted source";
    const transport = vi.fn();
    expect(await evaluateLocalAliasIdentityReview({ ...args, resolver: { enabled: true, kind: "mock", transport } })).toMatchObject({ status: "held", attempts: 0 });
    expect(transport).not.toHaveBeenCalled();
  });
  it("splits only a unique directory-backed chunk and retains exact Unicode compound-name offsets", async () => {
    const text = "🏒 Practice:\nÉmile St-Pierre — Luc Del Bel — Milo North", chunk = text.split("\n")[1]!;
    const args = input(text, chunk); args.rows[0]!.metadata = { reason: "invalid_extraction" };
    const result = await evaluateLocalAliasIdentityReview(args);
    expect(result.status).toBe("evaluated");
    expect(result.occurrences.map(o => [o.span.text, text.slice(o.span.start, o.span.end), o.origin])).toEqual(
      ["Émile St-Pierre", "Luc Del Bel", "Milo North"].map(name => [name, name, "unique_directory_segmentation"]));
    const unknown = input("Lomberg-Del Bel-Garland", "Lomberg-Del Bel-Garland"); unknown.rows[0]!.metadata = { reason: "invalid_extraction" };
    expect(await evaluateLocalAliasIdentityReview(unknown)).toMatchObject({ status: "held", holds: [{ reason: "unparsed_or_ambiguous_name_chunk" }] });
  });
  it("holds headings and leaves shared team/parser-role metadata outside the resolver", async () => {
    expect(await evaluateLocalAliasIdentityReview(input("Blackhawks lines", "Blackhawks lines"))).toMatchObject({ status: "held", holds: [{ reason: "heading_is_not_a_player" }] });
    const text = "T11 lines:\nVale practiced.", args = input(text, "Vale");
    args.rows[0]!.team_id = 11; args.rows[0]!.metadata = { situation: "es_defense" };
    const result = await evaluateLocalAliasIdentityReview(args);
    expect(result).toMatchObject({ status: "evaluated", notes: ["undated_team_hint_ignored", "parser_role_not_used_as_source_evidence"],
      occurrences: [{ deterministicSelectedId: null, candidateIds: ["nhl:1002", "nhl:1003"] }] });
  });
  it("uses only adjacent explicit position text and never infers a historical team", async () => {
    const args = input("G: Vale practiced.", "Vale");
    const result = await evaluateLocalAliasIdentityReview({ ...args, resolver: { enabled: true, kind: "mock", transport: async request => {
      expect(request.content.occurrences[0]!.positionHint).toEqual({ position: "G", evidence: { start: 0, end: 1, text: "G" } });
      expect(request.content.occurrences[0]!.teamHint).toBeNull();
      return offlineIdentityReply(request, () => ({ status: "matched", canonicalId: "nhl:1002" }));
    } } });
    expect(result.occurrences[0]!.modelProposal?.canonicalId).toBe("nhl:1002");
    const historical = input("Milo North practiced.", "Milo North"); historical.source.publishedAt = "2025-01-01T00:00:00Z"; historical.rows[0]!.team_id = 11;
    expect(await evaluateLocalAliasIdentityReview(historical)).toMatchObject({ occurrences: [{ activeMembership: "unknown" }], notes: ["undated_team_hint_ignored"] });
  });
  it.each(["G", "T1G", "@G:", "#G:"])("does not turn an initial/handle/hashtag into role evidence: %s", async prefix => {
    const args = input(`${prefix} Vale practiced.`, "Vale");
    const result = await evaluateLocalAliasIdentityReview({ ...args, resolver: { enabled: true, kind: "mock", transport: async request => {
      expect(request.content.occurrences[0]!.positionHint).toBeNull();
      return offlineIdentityReply(request, () => ({ status: "ambiguous", canonicalId: null }));
    } } });
    expect(result).toMatchObject({ occurrences: [{ deterministicSelectedId: null, modelProposal: { canonicalId: null } }] });
  });
  it("records schema/model failures as abstentions and refuses a provider mode", async () => {
    expect(await evaluateLocalAliasIdentityReview({ ...input(), resolver: { enabled: true, kind: "mock", transport: async () => ({ canPublish: true }) } }))
      .toMatchObject({ modelStatus: "held", modelReason: "invalid_or_failed_identity_response", occurrences: [{ modelProposal: null }] });
    const transport = vi.fn();
    expect(await evaluateLocalAliasIdentityReview({ ...input(), resolver: { enabled: true, kind: "provider", transport } } as never))
      .toMatchObject({ status: "held", reason: "paid_trial_preflight_not_integrated", attempts: 0 });
    expect(transport).not.toHaveBeenCalled();
  });
});

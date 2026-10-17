// @vitest-environment node
import { describe, expect, it } from "vitest";
import { qualifiedFixture } from "./fixtures/tweetClaimQualificationFixture";
import { extractDurableTweetClaims } from "./tweetClaimExtraction";
import { qualifyTweetClaimScope, resolveTweetClaimLineage } from "./tweetClaimLineage";

describe("immutable receipt lineage qualification", () => {
  it("converges verified relays to one exact lexical occurrence and one reviewable reservation", () => {
    const f = qualifiedFixture();
    const relay = extractDurableTweetClaims({ source: { ...f.source, tweetId: "2000", sourceUrl: "https://x.com/GameDayLines/status/2000",
      primaryTextSource: "quoted_oembed", quotedRawText: f.source.rawText, quotedTweetId: "1000", quotedAuthorHandle: "Reporter",
      quotedTweetUrl: f.source.sourceUrl }, game: f.game, interpretedAt: f.asOf });
    const q = qualifyTweetClaimScope(f.claims[0]!.scopeKey, [...f.claims, ...relay], f.evidence, [], f.asOf);
    expect(q.bindings).toHaveLength(2); expect(new Set(q.bindings.map(b => b.occurrenceId)).size).toBe(1);
    expect(q.plan.accepted).toBe(true); expect(q.plan.nextState.registry.claims).toHaveLength(1);
    expect(q.plan.reduction.actions).toHaveLength(1); expect(q.plan.reviewableEffects).toHaveLength(1);
    expect(q.noDispatch).toBe(true); expect(q.plan.dispatchInstructions).toEqual([]);
  });
  it("links a provisional receipt once exact original evidence arrives, keeping its raw observation", () => {
    const f = qualifiedFixture();
    const provisional = extractDurableTweetClaims({ source: { ...f.source, sourceUrl: "https://x.com/GameDayLines/status/1000" }, game: f.game, interpretedAt: f.asOf });
    const before = structuredClone(provisional);
    const initial = resolveTweetClaimLineage(provisional); expect(initial.resolved[0]!.root).toBeNull();
    const q = qualifyTweetClaimScope(f.claims[0]!.scopeKey, [...provisional, ...f.claims], f.evidence, [], f.asOf);
    expect(q.bindings).toHaveLength(2); expect(q.plan.nextState.registry.claims).toHaveLength(1);
    expect(provisional).toEqual(before);
  });
  it("does not merge an origin with changed source text/author or a fuzzy copied receipt", () => {
    const f = qualifiedFixture(), link = resolveTweetClaimLineage(f.claims).links[0]!;
    const conflicting = resolveTweetClaimLineage(f.claims, [{ ...link, author: "other" }]);
    expect(conflicting.resolved[0]!.hold).toBe("original_lineage_evidence_conflict");
    const copied = { ...f.claims[0]!, lineageKey: "receipt:copy", attribution: { ...f.claims[0]!.attribution, status: "pending" as const, originalTweetId: null } };
    expect(resolveTweetClaimLineage([copied], [link]).resolved[0]!.root).toBeNull();
  });
  it("suppresses reservations for partial legacy effects and missing identity proof", () => {
    const f = qualifiedFixture();
    const present = { ...f.evidence, sinks: f.evidence.sinks.map((s, i) => i ? s : { ...s, rows: [{ report_key: "old" }] }) };
    const q = qualifyTweetClaimScope(f.claims[0]!.scopeKey, f.claims, present, [], f.asOf);
    expect(q.legacy.status).toBe("present"); expect(q.plan.reviewableEffects).toEqual([]);
    const absent = qualifyTweetClaimScope(f.claims[0]!.scopeKey, f.claims, { ...f.evidence, identities: [] }, [], f.asOf);
    expect(absent.plan.reviewableEffects).toEqual([]); expect(absent.holds[0]!.reason).toContain("missing_at_source_time");
  });
  it("uses dated official evidence to resolve the current-membership-only hold while preserving the original derivation", () => {
    const f = qualifiedFixture();
    const claims = extractDurableTweetClaims({ source: { ...f.source, observedAt: "2026-10-16T22:01:00Z" }, game: f.game, interpretedAt: "2026-10-16T22:02:00Z" });
    expect(claims[0]!.semantic.support).toMatchObject({ status: "pending", reason: "source_time_identity_unverified" });
    const q = qualifyTweetClaimScope(claims[0]!.scopeKey, claims, { ...f.evidence, readAt: "2026-10-16T22:02:00Z" }, [], "2026-10-16T22:02:00Z");
    expect(q.plan.reviewableEffects).toHaveLength(1); expect(claims[0]!.semantic.support.status).toBe("pending");
  });
  it("retains canonical occurrence tokens, reservation clocks and old sink rows across reloads", () => {
    const f = qualifiedFixture(), first = qualifyTweetClaimScope(f.claims[0]!.scopeKey, f.claims, f.evidence, [], f.asOf);
    const next = qualifyTweetClaimScope(f.claims[0]!.scopeKey, f.claims, { ...f.evidence, readAt: "2026-10-16T15:03:00Z" }, first.lineage.links,
      "2026-10-16T15:03:00Z", { state: first.plan.nextState, sinks: first.legacy.retained, meanings: first.meanings });
    expect(next.plan.nextState.registry.effects).toEqual(first.plan.nextState.registry.effects);
    expect(next.plan.nextState.registry.claims).toEqual(first.plan.nextState.registry.claims);
    const priorRows = f.evidence.sinks.map((s, i) => i ? s : { ...s, rows: [{ effect: "retained-even-if-deleted-later" }] });
    const deleted = qualifyTweetClaimScope(f.claims[0]!.scopeKey, f.claims, f.evidence, [], f.asOf, { sinks: priorRows });
    expect(deleted.legacy.status).toBe("present"); expect(deleted.plan.reviewableEffects).toEqual([]);
  });
  it("blocks every material rebind of the same lexical occurrence, including a changed game scope", () => {
    const f = qualifiedFixture(), gameB = { ...f.game, id: f.game.id + 1 };
    const second = extractDurableTweetClaims({ source: { ...f.source, gameId: gameB.id }, game: gameB, interpretedAt: f.asOf });
    const evidence = { ...f.evidence, identities: [...f.evidence.identities, { ...f.evidence.identities[0]!, gameId: gameB.id,
      sourceUrl: `https://api-web.nhle.com/v1/gamecenter/${gameB.id}/play-by-play` }] };
    for (const scope of [f.claims[0]!.scopeKey, second[0]!.scopeKey]) {
      const q = qualifyTweetClaimScope(scope, [...f.claims, ...second], evidence, [], f.asOf);
      expect(q.globalDisputes).toHaveLength(1); expect(q.plan.reviewableEffects).toEqual([]);
    }
  });
});

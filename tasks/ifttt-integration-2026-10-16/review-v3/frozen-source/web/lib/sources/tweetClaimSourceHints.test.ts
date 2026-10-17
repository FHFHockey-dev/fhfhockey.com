// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { qualifiedFixture } from "./fixtures/tweetClaimQualificationFixture";
import { applyTweetClaimSourceHints } from "./tweetClaimSourceHints";
import { extractDurableTweetClaims } from "./tweetClaimExtraction";
import { qualifyTweetClaimScope } from "./tweetClaimLineage";
import type { TweetSourceCoverage } from "./tweetSourceDirectory";

export function hintFixture() {
  const f = qualifiedFixture();
  const coverage: TweetSourceCoverage = { id: "fixture-beat", account: { accountKey: "x:handle:reporter", accountId: null, handle: "reporter" },
    handleValidFrom: "2020-01-01T00:00:00Z", handleValidUntil: null, effectiveFrom: "2026-10-01T00:00:00Z", effectiveUntil: null,
    knownAt: "2026-10-10T00:00:00Z", teamIds: [6], leagues: ["NHL"], scope: "team", status: "verified", confidence: 1,
    evidence: { url: "https://example.test/fixture-beat", excerpt: "Fixture dated coverage", basis: "fixture-only verified assignment" } };
  const source = { ...f.source, team: null, gameId: null, rawText: "Jeremy Swayman starts tonight.", nhlFilterStatus: "rejected_ambiguous",
    nhlFilterReason: "no_single_nhl_team_match", detectedLeague: null,
    metadata: { interpretation: { ...f.source.metadata.interpretation, events: [], unresolved: [] } } };
  return { ...f, source, coverage };
}
describe("automated dated source-directory hints", () => {
  it("narrows an ambiguous source and reparses it against independent official dated roster evidence", async () => {
    const f = hintFixture(), original = structuredClone(f.source);
    const db = { rpc: vi.fn(async () => ({ data: f.evidence.identities, error: null })), from: (table: string) => {
      const result = { data: table === "teams" ? [{ id: 6,name: "Boston Bruins",abbreviation: "BOS" }] : [f.game], error: null };
      const query: any = { select: () => query,in: () => query,eq: () => query,or: () => query,limit: async () => result }; return query;
    } };
    const hinted = await applyTweetClaimSourceHints(db, [f.source], [f.coverage], [], f.asOf);
    expect(f.source).toEqual(original); expect(hinted.sources[0]!.team?.id).toBe(6);
    expect(hinted.sources[0]!.metadata?.tweetSourceDirectoryHint).toMatchObject({ entryIds: ["fixture-beat"],bindingAuthority: false });
    const claims = extractDurableTweetClaims({ source: hinted.sources[0]!,game: hinted.games[0]!,interpretedAt: f.asOf });
    expect(claims[0]!.semantic.support).toMatchObject({ status: "pending",reason: "source_time_team_not_explicit" });
    const q = qualifyTweetClaimScope(claims[0]!.scopeKey,claims,f.evidence,[],f.asOf);
    expect(q.plan.reviewableEffects).toHaveLength(1);
    expect(qualifyTweetClaimScope(claims[0]!.scopeKey,claims,{ ...f.evidence,identities: [] },[],f.asOf).plan.reviewableEffects).toEqual([]);
  });
  it("abstains on stale/multiple assignments and cannot manufacture missing official evidence", async () => {
    const f = hintFixture(), db = { from: vi.fn(),rpc: vi.fn() };
    for (const coverage of [{ ...f.coverage,effectiveUntil: f.source.tweetPostedAt },{ ...f.coverage,teamIds: [6,10] }]) {
      expect((await applyTweetClaimSourceHints(db,[f.source],[coverage],[],f.asOf)).sources[0]).toBe(f.source);
    }
    expect(db.from).not.toHaveBeenCalled();
  });
});

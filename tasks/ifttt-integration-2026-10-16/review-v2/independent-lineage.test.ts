// @vitest-environment node
import { describe, expect, it } from '../../../web/node_modules/vitest';
import { qualifiedFixture } from '../../../web/lib/sources/fixtures/tweetClaimQualificationFixture';
import { qualifyTweetClaimScope } from '../../../web/lib/sources/tweetClaimLineage';
import { extractDurableTweetClaims } from '../../../web/lib/sources/tweetClaimExtraction';
import { tweetLegacyCoverage } from '../../../web/lib/sources/tweetClaimEvidence';

describe('independent corrected-candidate safety', () => {
  it('holds one original lexical occurrence rebound to another qualified game scope', () => {
    const f = qualifiedFixture(), gameB = { ...f.game, id: f.game.id + 1 };
    const second = extractDurableTweetClaims({ source: { ...f.source, gameId: gameB.id }, game: gameB, interpretedAt: f.asOf });
    const evidence = { ...f.evidence, identities: [...f.evidence.identities, { ...f.evidence.identities[0]!, gameId: gameB.id,
      sourceUrl: `https://api-web.nhle.com/v1/gamecenter/${gameB.id}/play-by-play` }] };
    const all = [...f.claims, ...second];
    const a = qualifyTweetClaimScope(f.claims[0]!.scopeKey, all, evidence, [], f.asOf);
    const b = qualifyTweetClaimScope(second[0]!.scopeKey, all, evidence, [], f.asOf);
    expect(new Set(a.bindings.map(x => x.occurrenceId)).size).toBe(1);
    expect(new Set(b.bindings.map(x => x.occurrenceId)).size).toBe(1);
    expect(b.plan.reviewableEffects).toEqual([]);
  });
  it('does not refresh a retained r3 first-planning cutoff on an exact retry', () => {
    const f = qualifiedFixture();
    const first = qualifyTweetClaimScope(f.claims[0]!.scopeKey, f.claims, f.evidence, [], f.asOf);
    const laterAt = '2026-10-16T15:03:00Z';
    const next = qualifyTweetClaimScope(f.claims[0]!.scopeKey, f.claims, { ...f.evidence, readAt: laterAt }, first.lineage.links, laterAt);
    expect(first.plan.nextState.registry.effects).toHaveLength(1);
    expect(next.plan.nextState.registry.effects[0]!.effectKey).toBe(first.plan.nextState.registry.effects[0]!.effectKey);
    expect(next.plan.nextState.registry.effects[0]!.plannedAtAsOf).toBe(first.plan.nextState.registry.effects[0]!.plannedAtAsOf);
  });
  it('does not treat an explicitly incomplete newest history audit as complete absence proof', () => {
    const f = qualifiedFixture();
    const evidence: any = { ...f.evidence, history: { ...f.evidence.history, status: 'incomplete' } };
    expect(tweetLegacyCoverage(evidence, [f.source.tweetPostedAt]).status).toBe('unknown');
  });
});

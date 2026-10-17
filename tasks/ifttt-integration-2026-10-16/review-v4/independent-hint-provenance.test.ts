// @vitest-environment node
import { describe, expect, it, vi } from '../../../web/node_modules/vitest';
import { hintFixture } from '../../../web/lib/sources/tweetClaimSourceHints.test';
import { applyTweetClaimSourceHints } from '../../../web/lib/sources/tweetClaimSourceHints';
import { getPublicNewsSourceAttribution } from '../../../web/lib/newsFeed';
import { tweetClaimAttribution } from '../../../web/lib/sources/tweetSourceDirectory';

describe('independent hint and public provenance integration', () => {
  it('does not treat a partial incoming game cache as the complete team-date schedule', async () => {
    const f = hintFixture(), secondGame = { ...f.game, id: f.game.id + 1, startTime: '2026-10-16T20:00:00Z' };
    const gamesRead = vi.fn();
    const db = { rpc: vi.fn(async () => ({ data: f.evidence.identities, error: null })), from: (table: string) => {
      if (table === 'games') gamesRead();
      const result = { data: table === 'teams' ? [{ id: 6, name: 'Boston Bruins', abbreviation: 'BOS' }] : [f.game, secondGame], error: null };
      const query: any = { select: () => query, in: () => query, eq: () => query, or: () => query, limit: async () => result }; return query;
    } };
    const result = await applyTweetClaimSourceHints(db, [f.source], [f.coverage], [f.game], f.asOf);
    expect(result.sources[0]!.gameId).toBeNull();
  });
  it('suppresses a selected quote whose retained post ID contradicts its URL', () => {
    const source: any = { tweetId: '2000', sourceUrl: 'https://x.com/GameDayLines/status/2000', primaryTextSource: 'quoted_oembed',
      quotedTweetId: '999', quotedTweetUrl: 'https://x.com/Reporter/status/1000', quotedAuthorHandle: 'Reporter', tweetPostedAt: '2026-10-16T15:00:00Z' };
    expect(tweetClaimAttribution(source).status).toBe('pending');
    const item: any = { source_label: 'GameDayLines', source_account: 'GameDayLines', source_url: source.sourceUrl, tweet_url: source.sourceUrl,
      metadata: { primaryTextSource: source.primaryTextSource, quotedTweetId: source.quotedTweetId, quotedTweetUrl: source.quotedTweetUrl, quotedAuthorHandle: source.quotedAuthorHandle } };
    expect(getPublicNewsSourceAttribution({ item })).toEqual({ displayName: 'Original source pending', account: null, url: null });
  });
});

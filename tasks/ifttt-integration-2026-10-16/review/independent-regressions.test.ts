// @vitest-environment node
import { afterEach, describe, expect, it, vi } from '../../../web/node_modules/vitest';
import { extractDurableTweetClaims, tweetClaimContentHash } from '../../../web/lib/sources/tweetClaimExtraction';
import { extractTweetPlayerEvents } from '../../../web/lib/sources/tweetPlayerEvents';
import { retainTweetClaimScope } from '../../../web/lib/sources/tweetClaimRegistry';
import { captureForwardTweetClaimSample } from '../../../web/lib/sources/tweetClaimEvaluation';
import { getPublicNewsSourceAttribution } from '../../../web/lib/newsFeed';
import { readGameLines } from '../../../web/lib/lines/service';
import { lineTestDatabase } from '../../../web/lib/lines/testDatabase';
import { fixtureClaim, fixtureGame, fixtureNow } from '../../../web/lib/lines/testFixtures';

const publishedAt = '2026-10-17T15:00:00Z', asOf = '2026-10-17T15:02:00Z';
function claimFixture() {
  const text = 'BOS Hart starts tonight.';
  const source: any = { snapshotDate: '2026-10-17', team: { id: 6, name: 'Boston Bruins', abbreviation: 'BOS' }, gameId: 2026020099,
    tweetId: '100', sourceHandle: 'BeatWriter', sourceUrl: 'https://x.com/BeatWriter/status/100', rawText: text,
    tweetPostedAt: publishedAt, observedAt: '2026-10-17T15:01:00Z', nhlFilterStatus: 'accepted', detectedLeague: 'NHL',
    rawPayload: { evidence: 'original immutable raw bytes' },
    metadata: { interpretation: { version: 'fixture', units: [], unresolved: [], context: 'game', certainty: 'confirmed',
      identityContext: { basis: 'current_membership', sourcePublishedAt: publishedAt, eventRosterRevision: 'fixture' },
      events: extractTweetPlayerEvents({ text, players: [{ playerId: 100, fullName: 'Carter Hart', lastName: 'Hart', position: 'G', teamId: 6 }], publishedAt, includeClaimAnchors: true }) } } };
  return extractDurableTweetClaims({ source, game: { id: 2026020099, date: '2026-10-17', startTime: '2026-10-17T23:00:00Z', homeTeamId: 6, awayTeamId: 10 }, interpretedAt: asOf })[0]!;
}
function retainedRpc(claim: ReturnType<typeof claimFixture>) {
  return { rpc: vi.fn(async (name: string, args: any) => {
    if (name === 'read_tweet_claim_scope') return { data: { version: 1, observations: [claim], reviewedState: null }, error: null };
    if (name === 'commit_tweet_claim_scope') return { data: true, error: null };
    throw new Error('Unexpected RPC');
  }) };
}
afterEach(() => vi.unstubAllEnvs());
describe('independent immutable retries', () => {
  it('rejects a same-ID retry with altered retained raw payload', async () => {
    const first = claimFixture(), changed = structuredClone(first);
    changed.source.rawPayload = { evidence: 'different immutable raw bytes' };
    expect(tweetClaimContentHash(changed)).toBe(first.contentHash);
    await expect(retainTweetClaimScope(retainedRpc(first), [changed], asOf)).rejects.toThrow(/immutable|collision/i);
  });
  it('rejects a same-ID retry with different immutable alias membership', async () => {
    const first = claimFixture(), changed = structuredClone(first);
    changed.aliases.push({ key: 'event:foreign-key:100:0', version: 1 });
    expect(tweetClaimContentHash(changed)).toBe(first.contentHash);
    await expect(retainTweetClaimScope(retainedRpc(first), [changed], asOf)).rejects.toThrow(/immutable|collision/i);
  });
});

describe('independent original-source fallback suppression', () => {
  async function publicHistory(overrides: any) {
    vi.stubEnv('LINES_ENTRY_SERVING_ENABLED', 'true'); vi.stubEnv('LINES_OBSERVATIONS_ENABLED', 'true');
    const claim = fixtureClaim('review-provenance', overrides);
    const db = lineTestDatabase({
      games: [{ id: fixtureGame.id, date: fixtureGame.date, startTime: fixtureGame.scheduledStart, homeTeamId: 3, awayTeamId: 14, home: { abbreviation: 'NYR' }, away: { abbreviation: 'TBL' } }],
      line_game_state_observations: [{ game_id: fixtureGame.id, state_id: 'review-state', observed_at: fixtureNow, payload: fixtureGame }],
      line_claim_revisions: [{ team_id: 14, claim_id: claim.id, interpreted_at: claim.time.interpretedAt, payload: claim }],
    });
    return (await readGameLines(db, { teamId: 14, now: fixtureNow })).teams[0]!.history[0]!;
  }
  it('suppresses line attribution explicitly retained as unresolved despite a plausible URL', async () => {
    const claim = await publicHistory({ author: 'OtherWriter', sourceUrl: 'https://x.com/Reporter/status/123', originalIdentity: 'https://x.com/OtherWriter/status/999',
      provenance: { relayTweetId: '123', originalTweetId: null, attributionStatus: 'pending' } });
    expect({ author: claim.author, sourceUrl: claim.sourceUrl }).toEqual({ author: 'Original source pending', sourceUrl: null });
  });
  it('suppresses line placeholder author URLs', async () => {
    const claim = await publicHistory({ author: null, sourceUrl: 'https://x.com/null/status/123', originalIdentity: null });
    expect({ author: claim.author, sourceUrl: claim.sourceUrl }).toEqual({ author: 'Original source pending', sourceUrl: null });
  });
  it('suppresses a news byline that contradicts its URL author', () => {
    const item: any = { source_label: 'Other Writer', source_account: '@OtherWriter', source_url: 'https://x.com/Reporter/status/100', tweet_url: null, metadata: null };
    expect(getPublicNewsSourceAttribution({ item })).toEqual({ displayName: 'Original source pending', account: null, url: null });
  });
  it('requires quoted author agreement for a selected quoted claim', () => {
    const item: any = { source_label: 'GameDayLines', source_account: 'GameDayLines', source_url: 'https://x.com/GameDayLines/status/100', tweet_url: null,
      metadata: { primaryTextSource: 'quoted_oembed', quotedTweetUrl: 'https://x.com/Reporter/status/99' } };
    expect(getPublicNewsSourceAttribution({ item })).toEqual({ displayName: 'Original source pending', account: null, url: null });
  });
});


describe('independent forward-evaluation clocks', () => {
  it('rejects a receipt captured before its prospective cohort and source clocks', () => {
    const claim = claimFixture();
    const cohort = { id: 'future-review', startsAt: '2026-10-17T00:00:00Z', extractionVersion: claim.extractionVersion };
    expect(captureForwardTweetClaimSample([claim], cohort, '2026-10-16T15:00:00Z')).toBeNull();
  });
});

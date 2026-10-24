import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import receipt from './sources/fixtures/homepageNewsReceipt.json';
import HomepageStandingsInjuriesSection, { buildHomepageInjuryUpdates } from 'components/HomePage/HomepageStandingsInjuriesSection';
import { fetchNewsFeedItems, getPublicNewsClaimPresentation, getPublicNewsSourceAttribution, getPublicNewsReportTopic, sanitizePublicNewsFeedItem } from 'lib/newsFeed';
import { syncTweetPatternReviewItems } from '../pages/api/v1/db/tweet-pattern-review';
vi.mock('components/common/OptimizedImage', () => ({ default: ({alt}: {alt: string}) => <img alt={alt} /> }));
vi.mock('utils/adminOnlyMiddleware', () => ({ default: (handler: unknown) => handler }));
vi.mock('lib/sources/playerIdentity', () => ({ fetchPlayerIdentityDirectory: () => { throw new Error('Not used in sync regression'); } }));
vi.mock('lib/sources/linesCccIngestion', () => ({ fetchLinesCccTweetOEmbedAttempt: () => { throw new Error('Network forbidden'); } }));
vi.mock('lib/projections/rosterEvents', () => ({ buildRosterEventsFromReviewedTweet: () => { throw new Error('No roster mutation'); } }));
afterEach(cleanup);
const matches = receipt.pageProps.recentInjuryNews.matches;
const toItem = (r: typeof matches[number]) => ({...r, blurb:r.blurb_prefix, source_account:null,source_label:null,
  // Receipt gives prefixes, not full retained text or raw evidence. Never reconstruct missing evidence.
  metadata:{automation:{source:'tweet_news_phrase_dictionary',autoPublish:false,primaryRuleId:'manual-review'}},
  players:r.players.map(p=>({...p,player_name:p.name})),card_status:'published'} as any);
function fakeDb(sourceRows:any[]) {
  const writes:any[]=[];const selects:Record<string,string[]>={};
  return {writes, selects, db:{from(table:string) {
    let columns:string[]=[];
    const q:any={select(text:string){ columns=text.split(',').map(s=>s.trim());selects[table]=columns;return q;},order(){return q;},limit(){return q;},in(){return q;},upsert(rows:any[]){writes.push(...rows);return q;},then(resolve:any){
      const data=table==='lines_ccc'?sourceRows.map(row=>Object.fromEntries(columns.map(c=>[c,row[c]??null]))):[];
      return Promise.resolve(resolve({data,error:null}));
    }};return q;
  }}};
}
const baseRow:any={capture_key:'synthetic-retained-row',source:'GameDayNewsNHL',source_label:'tweet',source_handle:'KnownWrapper',author_name:null,snapshot_date:'2026-10-22',observed_at:matches[0].observed_at,tweet_id:matches[0].source_tweet_id,tweet_url:matches[0].tweet_url,source_url:matches[0].source_url,quoted_tweet_id:null,quoted_tweet_url:null,quoted_author_handle:null,quoted_author_name:null,team_id:54,team_abbreviation:'VGK',classification:'injury',nhl_filter_status:'accepted',nhl_filter_reason:null,keyword_hits:[],raw_text:matches[0].blurb_prefix,enriched_text:null,quoted_raw_text:null,quoted_enriched_text:null,raw_payload:{},primary_text_source:'ifttt_text',tweet_posted_label:matches[0].tweetPostedLabel,status:'observed'};
describe('review-only homepage compatibility proposal', () => {
  it('preserves all eleven distinct projections and both Marner posts', () => {
    const rows = buildHomepageInjuryUpdates({ injuries: [], recentInjuryNews: matches.map(toItem) });
    expect(rows).toHaveLength(11);
    expect(new Set(rows.map(row => row.key)).size).toBe(11);
    expect(rows.filter(row => row.description.startsWith('Mitch Marner'))).toHaveLength(4);
    for (const row of rows) {
      expect(row.player.id).toBeNull();
      expect(row.statusState).toBe('unknown');
      expect(row.status).not.toBe('Claim unavailable');
      expect(row.claimNote).toContain('not verified');
    }
    for (const row of matches) expect(getPublicNewsClaimPresentation(toItem(row)).claims).toEqual([]);
  });
  it('classifies EDM from the lineup passage and Marner as availability without injury inference', () => {
    const rows = buildHomepageInjuryUpdates({ injuries: [], recentInjuryNews: matches.map(toItem) });
    expect(rows.filter(row => row.team === 'EDM').map(row => row.status)).toEqual(['Lineup report', 'Lineup report', 'Lineup report']);
    expect(rows.filter(row => row.team === 'VGK').map(row => row.status)).toEqual(Array(4).fill('Availability report'));
  });
  it('does not invent an injury from the truncated Rust prefix', () => {
    const rust = matches.find(row => row.players[0].player_id === 8475810)!;
    expect(getPublicNewsReportTopic(toItem(rust))).toBe('Report');
  });
  it.each([
    ['Player has a lower-body injury.', 'Injury report'],
    ['No injury was reported.', 'Injury report'],
    ['A trade is being discussed, nothing completed.', 'Trade report'],
    ['The goal is to get him signed, if cap space permits.', 'Contract report'],
    ['Player was recalled.', 'Transaction report'],
    ['New practice lines today.', 'Lineup report'],
    ['Player will not play tonight.', 'Availability report'],
    ['Player injured; a trade remains possible.', 'Trade / Injury report'],
    ['Note from @Injury https://example.invalid/trade', 'Report'],
    ['A sign of improvement after practice.', 'Report'],
    ['The team released an interview.', 'Report'],
  ])('labels the passage topic without asserting completion: %s', (blurb, expected) => {
    expect(getPublicNewsReportTopic({blurb})).toBe(expected);
  });
  it('recovers explicit reporter handles from every receipt sibling without fabricating original links', () => {
    for (const row of matches) {
      const expected = row.blurb_prefix.match(/^RT (@[^:]+):/)![1];
      const source = getPublicNewsSourceAttribution({item: toItem(row)});
      expect(source).toEqual({displayName:null,account:expected,url:null});
      const once = sanitizePublicNewsFeedItem(toItem(row));
      const twice = sanitizePublicNewsFeedItem(once);
      expect(twice).toEqual(once);
      expect(twice.source_account).toBe(expected);
    }
  });
  it.each([
    ['According to @Reporter: the player is out.', '@Reporter'],
    ['Per @Reporter, the player is out.', '@Reporter'],
    ['The player is out (via @Reporter)', '@Reporter'],
    ['The player spoke with @Reporter after practice.', null],
    ['RT @Reporter: the player is out. via @OtherReporter', null],
    ['RT @GameDayLines: the player is out.', null],
  ])('requires explicit unambiguous attribution: %s', (blurb, account) => {
    expect(getPublicNewsSourceAttribution({item:{...toItem(matches[1]),blurb}}).account).toBe(account);
  });
  it('accepts an original link matching the explicit byline but never rewrites the wrapper ID', () => {
    const row = {...toItem(matches[0]),blurb:'RT @Reporter: Player out. https://x.com/Reporter/status/123'};
    expect(getPublicNewsSourceAttribution({item:row})).toEqual({displayName:null,account:'@Reporter',url:'https://x.com/Reporter/status/123'});
    expect(getPublicNewsSourceAttribution({item:{...row,blurb:row.blurb+' https://x.com/Reporter/status/124'}}).url).toBeNull();
  });
  it('retains linkless quoted-author evidence through repeated serialization without promoting claims', () => {
    const row = {...toItem(matches[1]),blurb:'A source passage.',metadata:{primaryTextSource:'quoted_oembed',quotedAuthorHandle:'Reporter',quotedAuthorName:'Original Reporter'}};
    const once = sanitizePublicNewsFeedItem(row);
    expect(once.source_account).toBe('@Reporter');
    expect(once.source_url).toBeNull();
    expect(sanitizePublicNewsFeedItem(once)).toEqual(once);
    expect(getPublicNewsClaimPresentation(once).claims).toEqual([]);
  });
  it('renders the original reporter visibly and keeps the unresolved meaning accessible', () => {
    render(<HomepageStandingsInjuriesSection standings={[]} injuries={[]} recentInjuryNews={[toItem(matches[0])]} snapshotGeneratedAt={null} standingsError={null} injuriesError={null} />);
    expect(screen.getByText('Availability report')).toBeTruthy();
    const reporter = screen.getByText('@DannyWebster21');
    expect(reporter.closest('tr')?.hidden).toBe(false);
    expect(screen.queryByText('Claim unavailable')).toBeNull();
    expect(screen.queryByRole('link', {name:/View original post/})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Expand update for —'}));
    expect(screen.getByText('Source text only; player and status are not verified.').closest('tr')?.hidden).toBe(false);
  });
  it.each([
    'https://twitter.com/i/web/status/123',
    'https://twitter.com.evil.invalid/FalseAuthor/status/123',
    'https://evilx.com/FalseAuthor/status/123',
    'https://x.com@evil.invalid/FalseAuthor/status/123',
    'javascript:alert(1)',
  ])('review writer rejects non-author URL evidence: %s', async source_url => {
    const f = fakeDb([{...baseRow, source_url, tweet_url:null}]);
    await syncTweetPatternReviewItems({supabase:f.db,perSourceLimit:1});
    expect(f.writes[0].source_handle).toBe('KnownWrapper');
    expect(f.writes[0].metadata.wrapperAuthorHandle).toBe('KnownWrapper');
  });
  it('review writer retains an actual direct author URL', async () => {
    const f = fakeDb([{...baseRow,source_url:'https://x.com/Reporter/status/123',tweet_url:null}]);
    await syncTweetPatternReviewItems({supabase:f.db,perSourceLimit:1});
    expect(f.writes[0].source_handle).toBe('Reporter');
  });
});

describe('retained quote author evidence', () => {
  const item = (metadata: Record<string, unknown>) => ({
    ...toItem(matches[1]), blurb: 'A quoted source passage.',
    metadata: { primaryTextSource: 'quoted_oembed', ...metadata },
  });
  const pending = {displayName:'Original source pending',account:null,url:null};
  const idOnlyUrl = 'https://x.com/i/web/status/123';
  it.each([idOnlyUrl, null])('rejects conflicting authors for one retained post, URL %s', quotedTweetUrl => {
    expect(getPublicNewsSourceAttribution({
      item: item({quotedAuthorHandle:'ReporterB',quotedTweetId:'123',quotedTweetUrl}),
      provenance:{metadata:{quotedAuthorHandle:'ReporterA',quotedTweetId:'123',quotedTweetUrl}},
    })).toEqual(pending);
  });
  it('accepts consistent authors after trimming @ and normalizing case', () => {
    expect(getPublicNewsSourceAttribution({
      item: item({quotedAuthorHandle:'reportera',quotedTweetId:'123',quotedTweetUrl:idOnlyUrl}),
      provenance:{metadata:{quotedAuthorHandle:'  @ReporterA  ',quotedTweetId:'123',quotedTweetUrl:idOnlyUrl}},
    })).toEqual({displayName:null,account:'@reportera',url:'https://x.com/reportera/status/123'});
  });
  it.each([
    ['999','123'],
    ['123','999'],
  ])('rejects conflicting retained post IDs %s / %s even with consistent authors', (provenanceId, itemId) => {
    expect(getPublicNewsSourceAttribution({
      item: item({quotedAuthorHandle:'ReporterA',quotedTweetId:itemId,quotedTweetUrl:idOnlyUrl}),
      provenance:{metadata:{quotedAuthorHandle:'ReporterA',quotedTweetId:provenanceId,quotedTweetUrl:idOnlyUrl}},
    })).toEqual(pending);
  });
  it.each(['provenance','item'])('rejects a conflicting author-bearing URL retained in %s metadata', location => {
    const first = {quotedAuthorHandle:'ReporterA',quotedTweetId:'123',quotedTweetUrl:location==='provenance'?'https://x.com/ReporterB/status/123':idOnlyUrl};
    const second = {quotedAuthorHandle:'ReporterA',quotedTweetId:'123',quotedTweetUrl:location==='item'?'https://x.com/ReporterB/status/123':idOnlyUrl};
    expect(getPublicNewsSourceAttribution({item:item(second),provenance:{quoted_tweet_url:idOnlyUrl,metadata:first}})).toEqual(pending);
  });
});

describe('loader to serialized homepage attribution', () => {
  const pending = {displayName:'Original source pending',account:null,url:null};
  const idOnlyUrl = 'https://x.com/i/web/status/123';
  const quoted = (handle: string, id = '123') => ({primaryTextSource:'quoted_oembed',quotedAuthorHandle:handle,quotedTweetId:id,quotedTweetUrl:idOnlyUrl});
  const raw = (metadata: any = null, blurb = 'A quoted source passage.') => ({...toItem(matches[1]),metadata,blurb});
  const json = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  async function load(item: any, provenance: any = null) {
    const rows:Record<string,any[]> = {
      news_feed_items:[item],
      tweet_pattern_review_items:provenance ? [{id:item.source_review_item_id,...provenance}] : [],
      news_feed_item_players:[],
    };
    const supabase = {from(table: string) {
      const q:any = {select(){return q;},order(){return q;},limit(){return q;},eq(){return q;},in(){return q;},then(resolve:any){return Promise.resolve(resolve({data:rows[table],error:null}));}};
      return q;
    }};
    return (await fetchNewsFeedItems({supabase,status:'published'}))[0];
  }
  function homepage(item: any) {
    return buildHomepageInjuryUpdates({injuries:[],recentInjuryNews:[json(item)]})[0];
  }
  it('keeps a rejected quoted author unresolved despite a matching RT fallback after serialization', async () => {
    const first = await load(raw(quoted('ReporterB'),'RT @ReporterB: Player is out tonight.'),{metadata:quoted('ReporterA')});
    expect(getPublicNewsSourceAttribution({item:first})).toEqual(pending);
    let current = json(first);
    for (let pass = 0; pass < 3; pass++) {
      current = json(sanitizePublicNewsFeedItem(current));
      expect(current.source_account).toBeNull();
      expect(current.source_url).toBeNull();
      expect(current).toEqual(json(first));
    }
    expect(current.source_attribution).toMatchObject({version:'public-news-source-v1',state:'conflict'});
    expect(homepage(current)).toMatchObject({sourceAttribution:'Original source pending',sourceUrl:null,player:{id:null},statusState:'unknown'});
    expect(getPublicNewsClaimPresentation(current).claims).toEqual([]);
  });
  it('retains valid linkless attribution supplied only by provenance through the actual homepage path', async () => {
    const first = await load(raw(),{metadata:{primaryTextSource:'quoted_oembed',quotedAuthorHandle:'ReporterA',quotedAuthorName:'Reporter A',rawLineageMarker:'not-public'}});
    expect(first.source_account).toBe('@ReporterA');
    expect(first.source_url).toBeNull();
    const second = json(sanitizePublicNewsFeedItem(json(first)));
    expect(second).toEqual(json(first));
    expect(second.source_attribution).toMatchObject({state:'resolved',basis:'quote',account:'@ReporterA',displayName:'Reporter A',url:null});
    expect(homepage(second)).toMatchObject({sourceAttribution:'@ReporterA',sourceUrl:null,player:{id:null}});
    expect(JSON.stringify(second)).not.toContain('rawLineageMarker');
    expect(getPublicNewsClaimPresentation(second).claims).toEqual([]);
  });
  it('does not revive a quote rejected for mismatched post IDs', async () => {
    const first = await load(raw(quoted('ReporterB'),'RT @ReporterB: Player is out tonight.'),{metadata:quoted('ReporterB','999')});
    expect(homepage(first).sourceAttribution).toBe('Original source pending');
    expect(json(sanitizePublicNewsFeedItem(json(first)))).toEqual(json(first));
  });
  it.each([
    ['RT @ReporterA: Player is out tonight.', null, null],
    ['A quoted source passage.', quoted('ReporterA'), 'https://x.com/ReporterA/status/123'],
  ])('preserves resolved attribution and original-link evidence: %s', async (blurb, metadata, url) => {
    const first = await load(raw(metadata,blurb));
    expect(homepage(first)).toMatchObject({sourceAttribution:'@ReporterA',sourceUrl:url});
    expect(json(sanitizePublicNewsFeedItem(json(first)))).toEqual(json(first));
  });
  it('does not accept an attribution marker in raw metadata or turn it into claim authority', async () => {
    const first = await load(raw({source_attribution:{version:'public-news-source-v1',state:'resolved',basis:'quote',account:'@Injected',displayName:null,url:null},accepted:true,automation:{accepted:true,playerEvents:[{playerId:123,kind:'injury'}]}}));
    expect(first.source_account).toBeNull();
    expect(getPublicNewsClaimPresentation(first).claims).toEqual([]);
    expect(JSON.stringify(first)).not.toContain('@Injected');
  });
  it('recomputes raw loader records instead of accepting a previously supplied display decision', async () => {
    const first = await load({...raw(),source_attribution:{version:'public-news-source-v1',state:'resolved',basis:'quote',account:'@Injected',displayName:null,url:null}},
      {metadata:{primaryTextSource:'quoted_oembed',quotedAuthorHandle:'ReporterA'}});
    expect(first.source_account).toBe('@ReporterA');
    expect(JSON.stringify(first)).not.toContain('@Injected');
  });
  it.each([
    {version:'unknown-version',state:'resolved',basis:'text',account:'@ReporterB',displayName:null,url:null},
    {version:'public-news-source-v1',state:'resolved',basis:'text',account:'@ReporterB',displayName:null,url:'javascript:alert(1)'},
  ])('fails closed for an unsupported or unsafe serialized display decision', source_attribution => {
    const first = sanitizePublicNewsFeedItem({...raw(null,'RT @ReporterB: Player is out tonight.'),source_attribution});
    expect(first.source_account).toBeNull();
    expect(first.source_url).toBeNull();
    expect(json(sanitizePublicNewsFeedItem(json(first)))).toEqual(json(first));
    expect(getPublicNewsClaimPresentation(first).claims).toEqual([]);
  });
});

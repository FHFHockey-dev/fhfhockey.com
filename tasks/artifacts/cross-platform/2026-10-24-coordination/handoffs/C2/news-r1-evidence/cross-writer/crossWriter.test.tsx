import { afterEach, describe, expect, it, vi } from 'vitest';
import receipt from '/private/tmp/fhfh-c2-isolated/web/lib/sources/fixtures/homepageNewsReceipt.json';
import HomepageStandingsInjuriesSection, { buildHomepageInjuryUpdates } from '/private/tmp/fhfh-c2-isolated/web/components/HomePage/HomepageStandingsInjuriesSection';
import { fetchNewsFeedItems, getPublicNewsClaimPresentation, getPublicNewsSourceAttribution, getPublicNewsReportTopic, sanitizePublicNewsFeedItem } from '/private/tmp/fhfh-c2-isolated/web/lib/newsFeed';
import { syncTweetPatternReviewItems } from '/private/tmp/fhfh-c2-isolated/web/pages/api/v1/db/tweet-pattern-review';
import { buildTweetNewsAutomationCandidate } from '/private/tmp/fhfh-c2-isolated/web/lib/sources/tweetNewsAutomation';
import { readNewsLineupPresentation } from '/private/tmp/fhfh-c2-isolated/web/lib/newsLineupPresentation';
vi.mock('/private/tmp/fhfh-c2-isolated/web/components/common/OptimizedImage', () => ({ default: ({alt}: {alt: string}) => <img alt={alt} /> }));
vi.mock('/private/tmp/fhfh-c2-isolated/web/utils/adminOnlyMiddleware', () => ({ default: (handler: unknown) => handler }));
vi.mock('/private/tmp/fhfh-c2-isolated/web/lib/sources/playerIdentity', async (original) => ({ ...await original<object>(), fetchPlayerIdentityDirectory: () => { throw new Error('Not used in sync regression'); } }));
vi.mock('/private/tmp/fhfh-c2-isolated/web/lib/sources/linesCccIngestion', () => ({ fetchLinesCccTweetOEmbedAttempt: () => { throw new Error('Network forbidden'); } }));
vi.mock('/private/tmp/fhfh-c2-isolated/web/lib/projections/rosterEvents', () => ({ buildRosterEventsFromReviewedTweet: () => { throw new Error('No roster mutation'); } }));
const matches = receipt.pageProps.recentInjuryNews.matches;
const toItem = (r: typeof matches[number]) => ({...r, blurb:r.blurb_prefix, source_account:null,source_label:null,
  // Receipt gives prefixes, not full retained text or raw evidence. Never reconstruct missing evidence.
  metadata:{automation:{source:'tweet_news_phrase_dictionary',autoPublish:false,primaryRuleId:'manual-review'}},
  players:r.players.map(p=>({...p,player_name:p.name})),card_status:'published'} as any);
function fakeDb(sourceRows:any[], sourceTable='lines_ccc', existingRows:any[]=[]) {
  const writes:any[]=[];const selects:Record<string,string[]>={};
  return {writes, selects, db:{from(table:string) {
    let columns:string[]=[];
    const q:any={select(text:string){ columns=text.split(',').map(s=>s.trim());selects[table]=columns;return q;},order(){return q;},limit(){return q;},in(){return q;},upsert(rows:any[]){writes.push(...rows);return q;},then(resolve:any){
      const rows=table===sourceTable?sourceRows:table==='tweet_pattern_review_items'?existingRows:[];
      // Faithful PostgREST projection, including `alias:column->key` JSON paths.
      const pick=(row:any,c:string)=>{const [alias,path=alias]=c.split(':');const [column,...keys]=path.split('->');return [alias,keys.reduce((v,k)=>v?.[k],row[column])??null];};
      const data=rows.map(row=>Object.fromEntries(columns.map(c=>pick(row,c))));
      return Promise.resolve(resolve({data,error:null}));
    }};return q;
  }}};
}
const baseRow:any={capture_key:'synthetic-retained-row',source:'GameDayNewsNHL',source_label:'tweet',source_handle:'KnownWrapper',author_name:null,snapshot_date:'2026-10-22',observed_at:matches[0].observed_at,tweet_id:matches[0].source_tweet_id,tweet_url:matches[0].tweet_url,source_url:matches[0].source_url,quoted_tweet_id:null,quoted_tweet_url:null,quoted_author_handle:null,quoted_author_name:null,team_id:54,team_abbreviation:'VGK',classification:'injury',nhl_filter_status:'accepted',nhl_filter_reason:null,keyword_hits:[],raw_text:matches[0].blurb_prefix,enriched_text:null,quoted_raw_text:null,quoted_enriched_text:null,raw_payload:{},primary_text_source:'ifttt_text',tweet_posted_label:matches[0].tweetPostedLabel,status:'observed'};
import { writeFileSync } from 'node:fs';
describe('C2 cross-writer public view dump', () => {
  const text = 'Victor Hedman will not play tonight.';
  const event = {playerId:8475167,playerName:'Victor Hedman',kind:'injury',state:'unknown',availability:'out',modality:'affirmative',evidence:{text,start:0,end:text.length}};
  // Would pass the public claim validator if it ever reached metadata.interpretation.
  const interpretation = {version:'2026-10-13.1',units:[],unresolved:[],events:[event]};
  const source = (metadata: any) => ({...baseRow,raw_text:text,team_id:14,team_abbreviation:'TBL',metadata:{rawLineageMarker:'not-public',temporalReview:{interpretation},...metadata}});
  const json = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  async function project(f: ReturnType<typeof fakeDb>) {
    await syncTweetPatternReviewItems({supabase:f.db,perSourceLimit:1});
    const review = {...f.writes[0],id:'review-retained-1'};
    const candidate = buildTweetNewsAutomationCandidate({row:review,players:[{id:8475167,fullName:'Victor Hedman',position:'D',team_id:14}],nowIso:'2026-10-22T12:00:00.000Z'})!;
    const item = {id:'news-retained-1',source_review_item_id:review.id,source_tweet_id:candidate.sourceTweetId,source_url:candidate.sourceUrl,tweet_url:candidate.tweetUrl,
      source_label:candidate.sourceLabel,source_account:candidate.sourceAccount,team_id:14,team_abbreviation:'TBL',headline:candidate.headline,blurb:candidate.blurb,
      category:candidate.category,subcategory:candidate.subcategory,card_status:'published',observed_at:candidate.observedAt,published_at:'2026-10-22T12:00:00.000Z',
      metadata:candidate.metadata,created_at:'2026-10-22T12:00:00.000Z',updated_at:'2026-10-22T12:00:00.000Z'};
    const rows:Record<string,any[]> = {news_feed_items:[item],tweet_pattern_review_items:[review],news_feed_item_players:[]};
    const supabase = {from(table: string) {
      const q:any = {select(){return q;},order(){return q;},limit(){return q;},eq(){return q;},in(){return q;},then(resolve:any){return Promise.resolve(resolve({data:rows[table],error:null}));}};
      return q;
    }};
    const loaded = json((await fetchNewsFeedItems({supabase,status:'published'}))[0]);
    // Everything the public reads: DTO, re-sanitized DTO, claim and lineup presentation, homepage row.
    const publicView = JSON.stringify([loaded, json(sanitizePublicNewsFeedItem(loaded)), getPublicNewsClaimPresentation(loaded),
      readNewsLineupPresentation({metadata:loaded.metadata,subcategory:loaded.subcategory}), buildHomepageInjuryUpdates({injuries:[],recentInjuryNews:[loaded]})]);
    return {review,item,loaded,publicView};
  }
  it.each(['lines_ccc','line_source_snapshots'])('dumps %s', async table => {
    const r = await project(fakeDb([source({interpretation})],table));
    writeFileSync(process.env.C2_DUMP_DIR + '/' + table + '.json', r.publicView);
  });
});

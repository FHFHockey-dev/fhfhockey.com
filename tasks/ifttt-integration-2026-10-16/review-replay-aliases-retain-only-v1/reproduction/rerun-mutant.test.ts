// @vitest-environment node
// Item 5 (outside the R21 diff): the every-10-minute /api/v1/db/replay-player-aliases cron (web/vercel.json) is gated only on
// TWEET_PIPELINE_INTERPRETATION_ENABLED, which the pilot requires. Under full pilot configuration it still POSTs a processor
// with tweetId + reprocess=true for a current-day unresolved name. Mocked DB/fetch only; no network; live route bytes.
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
const {db,calls}=vi.hoisted(()=>{
 const calls:unknown[][]=[];
 const table=(name:string)=>{let op='select';const q:any={};
  for(const m of ['select','like','in','lt','lte','gt','eq','is','order','limit'])q[m]=(...a:unknown[])=>{calls.push([name,m,...a]);return q;};
  q.update=(value:unknown)=>{op='update';calls.push([name,'update',value]);return q;};
  q.then=(resolve:any,reject:any)=>Promise.resolve(op==='update'?{error:null}:name==='tweet_pipeline_jobs'
   ?{data:[{job_key:'alias-replay:101',payload:{normalizedName:'synthetic skater',teamId:30,playerId:8400001,alias:'Synthetic',afterId:null}}],error:null}
   :{data:[{id:101,raw_name:'Synthetic Skater',tweet_id:'1979000000000000001',source:'gamedaygoalies',status:'pending',created_at:new Date().toISOString(),
     metadata:{sourceKey:'gamedaygoalies'}}],error:null}).then(resolve,reject);
  return q;};
 const db={from:(name:string)=>table(name),rpc:async(name:string,args:unknown)=>{calls.push(['rpc',name,args]);return {data:true,error:null};}};
 return {db,calls};
});
vi.mock('../../../../web/utils/adminOnlyMiddleware',()=>({default:(handler:any)=>async(req:any,res:any)=>{req.supabase=db;return handler(req,res);}}));
vi.mock('../../../../web/lib/supabase/server',()=>({default:db}));
vi.mock('../../../../web/lib/sources/tweetAttribution',()=>({retryTweetAttribution:async()=>({resolved:0,skipped:true})}));
vi.mock('../../../../web/lib/sources/lineSourceProcessing',()=>({fetchRosterEntriesByTeam:async()=>new Map([[30,[]]]),fetchPlayerNameAliases:async()=>[],
 applyPlayerNameAliasesToRosterMap:({rosterByTeam}:any)=>rosterByTeam,sendPlayerAliasReviewEmailForQueuedNames:async()=>null}));
vi.mock('../../../../web/lib/sources/playerIdentity',()=>({resolvePlayerIdentity:()=>({status:'matched',player:{playerId:8400001}}),rosterSeasonForDate:()=>20262027}));
const {eastern}=vi.hoisted(()=>({eastern:(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso))}));
vi.mock('../../../../web/lib/sources/projectedLineups',()=>({easternReportDate:eastern}));
vi.mock('../../../../web/lib/sources/linesCccIngestion',()=>({tweetPublicationFromUrl:()=>new Date().toISOString()}));
vi.mock('../../../../web/lib/sources/tweetInterpretation',()=>({tweetPipelineFlags:()=>({interpretation:process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED==='true',
 publishing:process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED==='true'&&process.env.TWEET_PIPELINE_PUBLISHING_ENABLED==='true'})}));
import replay from 'pages/api/v1/db/replay-player-aliases';
import {iftttIntakePilotConfigured} from '../../../../web/lib/sources/iftttIntakePolicy';

const policy=JSON.stringify({version:'ifttt-intake-v1',id:'synthetic-review',startsAt:'2026-10-16T00:00:00Z',endsAt:'2026-10-17T00:00:00Z',maxAttempts:5,maxReceipts:3,
 scopes:[{table:'line_source_ifttt_events',sourceGroup:'gdl_suite',sourceKey:'gamedaygoalies',sourceAccount:'gamedaygoalies'}]});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();calls.length=0;});
const runs:unknown[]=[];
describe('item 5: replay-player-aliases cron under pilot configuration',()=>{
 it.each([['active pilot',undefined],['env-stopped pilot',"true"]] as const)('%s: still requests a current-day reprocess=true processor run',async(label,stop)=>{
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','true');vi.stubEnv('IFTTT_INTAKE_POLICY',policy);vi.stubEnv('IFTTT_INTAKE_STOP',stop);
  vi.stubEnv('TWEET_CLAIMS_MODE','shadow');vi.stubEnv('TWEET_PIPELINE_INTERPRETATION_ENABLED','true');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://trusted.example');vi.stubEnv('CRON_SECRET','synthetic-review');
  const fetchMock=vi.fn(async()=>new Response('{}',{status:200}));vi.stubGlobal('fetch',fetchMock);
  const res:any={statusCode:200,body:null,status(code:number){this.statusCode=code;return this;},json(value:any){this.body=value;return this;},end(){return this;},setHeader(){return this;}};
  await replay({method:'GET',headers:{authorization:'Bearer synthetic-review'},query:{}} as any,res);
  expect(iftttIntakePilotConfigured()).toBe(true);
  const requests=(fetchMock.mock.calls as unknown as Array<[URL,RequestInit]>).map(([url,init])=>{const u=new URL(url);
   return {path:u.pathname,params:Object.fromEntries(u.searchParams),method:init.method};});
  runs.push({label,pilotConfigured:true,response:{status:res.statusCode,body:res.body},processorRequests:requests,
   meaning:'update-line-sources with tweetId and no evaluation cohort selects by tweet_id with no processing_status filter (update-line-sources.ts:99-112) and has no pilot check; this route is not covered by the R21 guard.'});
  writeFileSync(join(__dirname,`../evidence/reproduction/rerun-${process.env.MUTANT}.json`),JSON.stringify(runs,null,1)+'\n');
  expect(res.statusCode).toBe(200);expect(requests).toEqual([{path:'/api/v1/db/update-line-sources',method:'POST',
   params:{date:eastern(new Date().toISOString()),tweetId:'1979000000000000001',reprocess:'true',limit:'1',sourceKey:'gamedaygoalies'}}]);
 });
});

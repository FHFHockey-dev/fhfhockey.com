// @vitest-environment node
// Independent R21 review. Differential before/after checks with mocked fetch and a mocked Supabase client; no network.
// The "before" receiver is ../mutation/mutants/before/ (built from ../../scheduler-retain-only-v1/before/ by build-mutants.mjs).
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
const {dispatchMock,fromMock,rpcMock}=vi.hoisted(()=>({dispatchMock:vi.fn(),fromMock:vi.fn(),rpcMock:vi.fn()}));
vi.mock('../../../../web/lib/supabase/server',()=>({default:{from:fromMock,rpc:rpcMock}}));
vi.mock('../../../../web/lib/projections/starterBoardQueue',()=>({dispatchStarterBoardJobs:dispatchMock}));
import * as livePolicy from '../../../../web/lib/sources/iftttIntakePolicy';
import * as beforePolicy from '../../scheduler-retain-only-v1/before/iftttIntakePolicy';
import * as liveReceiver from '../../../../web/lib/sources/lineSourceIftttReceiver';
import * as beforeReceiver from '../mutation/mutants/before/lineSourceIftttReceiver';
import scheduler from '../../../../web/pages/api/internal/starter-board';

const inScope={table:'line_source_ifttt_events' as const,sourceGroup:'gdl_suite',sourceKey:'gamedaygoalies',sourceAccount:'gamedaygoalies'};
const outScope={...inScope,sourceKey:'gamedaylines',sourceAccount:'gamedaylines'};
const policyJson=JSON.stringify({version:'ifttt-intake-v1',id:'synthetic-review',startsAt:'2026-10-16T00:00:00Z',endsAt:'2026-10-17T00:00:00Z',maxAttempts:5,maxReceipts:3,scopes:[inScope]});
const PILOT=['IFTTT_RECEIPT_VARIANTS_ENABLED','IFTTT_INTAKE_POLICY','IFTTT_INTAKE_STOP','TWEET_CLAIMS_MODE','TWEET_PIPELINE_INTERPRETATION_ENABLED'] as const;
type Env=Partial<Record<(typeof PILOT)[number],string|undefined>>;
const setPilot=(env:Env)=>{for(const name of PILOT)vi.stubEnv(name,env[name]);};
const outcome=(fn:()=>unknown)=>{try{return {value:fn()};}catch(error:any){return {error:String(error?.message)};}};
const skipped={attempted:0,failed:0,results:[],skipped:'controlled_intake'};
const evidence=(name:string,value:unknown)=>writeFileSync(join(__dirname,'../evidence',name),JSON.stringify(value,null,1)+'\n');
async function retry(module:typeof liveReceiver){
 const fetchMock=vi.fn(async(_url:URL)=>new Response('{}',{status:200}));vi.stubGlobal('fetch',fetchMock);
 const value=await module.retryPendingLineSourceEvents();
 const calls=(fetchMock.mock.calls as unknown as Array<[URL]>).map(([url])=>{const u=new URL(url);return `${u.pathname}?${u.searchParams}`;});
 vi.unstubAllGlobals();return {value,calls};
}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});

describe('independent R21 review: shared predicate and scheduler retry guard',()=>{
 it('truth table: predicate equals the pre-fix receiver presence test; receivers unchanged; retries skipped exactly when configured',async()=>{
  vi.stubEnv('STARTER_BOARD_WORKER_ORIGIN','https://trusted.example');vi.stubEnv('CRON_SECRET','synthetic-review');
  const flags=[undefined,'','false','true','TRUE','0'],policies=[undefined,'',policyJson,'{bad'],stops=[undefined,'','false','true','typo'],
   modes=[undefined,'shadow'],interps=[undefined,'true'];
  const mismatches:unknown[]=[];const legacyCombos:Env[]=[];let combos=0,configured=0,controlledInScope=0,receiverThrows=0;
  for(const flag of flags)for(const policy of policies)for(const stop of stops)for(const mode of modes)for(const interp of interps){
   const env:Env={IFTTT_RECEIPT_VARIANTS_ENABLED:flag,IFTTT_INTAKE_POLICY:policy,IFTTT_INTAKE_STOP:stop,TWEET_CLAIMS_MODE:mode,TWEET_PIPELINE_INTERPRETATION_ENABLED:interp};
   setPilot(env);combos++;
   const predicate=livePolicy.iftttIntakePilotConfigured();
   for(const scope of [inScope,outScope]){
    const after=outcome(()=>livePolicy.iftttIntakeConfiguration(scope)),before=outcome(()=>beforePolicy.iftttIntakeConfiguration(scope));
    if(JSON.stringify(after)!==JSON.stringify(before))mismatches.push({env,scope:scope.sourceKey,kind:'receiver configuration',after,before});
    const beforeLegacy='value' in before&&(before.value as any).controlled===false;
    if(predicate!==!beforeLegacy)mismatches.push({env,scope:scope.sourceKey,kind:'predicate',predicate,before});
    if(scope===inScope&&'value' in after&&(after.value as any).controlled)controlledInScope++;
    if(scope===inScope&&'error' in after)receiverThrows++;
   }
   const live=await retry(liveReceiver),pre=await retry(beforeReceiver as unknown as typeof liveReceiver);
   if(pre.calls.length!==6)mismatches.push({env,kind:'before retry did not make 6 requests',pre});
   if(predicate){configured++;
    if(live.calls.length!==0||JSON.stringify(live.value)!==JSON.stringify(skipped))mismatches.push({env,kind:'configured retry',live});
   }else{legacyCombos.push(env);
    if(JSON.stringify(live)!==JSON.stringify(pre))mismatches.push({env,kind:'legacy retry differs',live,pre});
   }
  }
  expect(rpcMock).not.toHaveBeenCalled();expect(fromMock).not.toHaveBeenCalled();
  evidence('independent-truth-table.json',{dimensions:{IFTTT_RECEIPT_VARIANTS_ENABLED:flags,IFTTT_INTAKE_POLICY:['<absent>','""','<valid in-scope policy>','{bad'],
   IFTTT_INTAKE_STOP:stops,TWEET_CLAIMS_MODE:modes,TWEET_PIPELINE_INTERPRETATION_ENABLED:interps},combos,configured,legacy:legacyCombos.length,
   legacyCombos,inScopeControlled:controlledInScope,inScopeReceiverFailsClosed:receiverThrows,mismatches,
   meaning:'For every combination, iftttIntakePilotConfigured() equals the pre-fix "not legacy" test inside iftttIntakeConfiguration; after/before iftttIntakeConfiguration results (value or error) are identical for an in-scope and an out-of-scope receiver; the live retry makes 0 requests and returns the skipped marker exactly when configured, and is byte-identical to the pre-fix retry (6 requests, same URLs and result) otherwise.'});
  expect(mismatches).toEqual([]);
  expect(legacyCombos.every((env)=>[undefined,'false'].includes(env.IFTTT_RECEIPT_VARIANTS_ENABLED)&&env.IFTTT_INTAKE_POLICY===undefined
   &&[undefined,'false'].includes(env.IFTTT_INTAKE_STOP))).toBe(true);
  expect(legacyCombos).toHaveLength(2*1*2*2*2);
 });

 const pilotShapes:Array<[string,Env,Record<string,string>]>=[
  ['policy only',{IFTTT_INTAKE_POLICY:policyJson},{}],
  ['empty policy only',{IFTTT_INTAKE_POLICY:''},{}],
  ['flag "TRUE" only',{IFTTT_RECEIPT_VARIANTS_ENABLED:'TRUE'},{}],
  ['empty flag only',{IFTTT_RECEIPT_VARIANTS_ENABLED:''},{}],
  ['misspelled stop only',{IFTTT_INTAKE_STOP:'typo'},{}],
  ['empty stop only',{IFTTT_INTAKE_STOP:''},{}],
  ['full pilot with stop "false"',{IFTTT_RECEIPT_VARIANTS_ENABLED:'true',IFTTT_INTAKE_POLICY:policyJson,IFTTT_INTAKE_STOP:'false',TWEET_CLAIMS_MODE:'shadow',TWEET_PIPELINE_INTERPRETATION_ENABLED:'true'},{}],
  ['full pilot, capture via legacy START_CHART_GAME_REVISIONS',{IFTTT_RECEIPT_VARIANTS_ENABLED:'true',IFTTT_INTAKE_POLICY:policyJson,TWEET_CLAIMS_MODE:'shadow',TWEET_PIPELINE_INTERPRETATION_ENABLED:'true'},
   {START_CHART_GAME_REVISIONS:'true',STARTER_BOARD_CAPTURE_ENABLED:'<absent>'}],
  ['full pilot with compute on',{IFTTT_RECEIPT_VARIANTS_ENABLED:'true',IFTTT_INTAKE_POLICY:policyJson,TWEET_CLAIMS_MODE:'shadow',TWEET_PIPELINE_INTERPRETATION_ENABLED:'true'},
   {STARTER_BOARD_COMPUTE_ENABLED:'true'}],
 ];
 const schedulerRuns:unknown[]=[];
 it.each(pilotShapes)('scheduler with %s: 200, capture skipped, no processor request',async(_label,env,board)=>{
  setPilot(env);
  vi.stubEnv('STARTER_BOARD_SCHEDULER_ENABLED','true');vi.stubEnv('STARTER_BOARD_CAPTURE_ENABLED','true');vi.stubEnv('STARTER_BOARD_COMPUTE_ENABLED','false');
  for(const [name,value] of Object.entries(board))vi.stubEnv(name,value==='<absent>'?undefined:value);
  vi.stubEnv('STARTER_BOARD_WORKER_ORIGIN','https://trusted.example');vi.stubEnv('CRON_SECRET','synthetic-review');
  rpcMock.mockResolvedValue({data:null,error:null});dispatchMock.mockResolvedValue({dispatched:2,failed:0,results:[]});
  const fetchMock=vi.fn(async()=>new Response('{}',{status:200}));vi.stubGlobal('fetch',fetchMock);
  const res:any={statusCode:0,body:null,setHeader(){return this;},status(code:number){this.statusCode=code;return this;},json(value:any){this.body=value;return this;},end(){return this;}};
  await scheduler({method:'GET',headers:{authorization:'Bearer synthetic-review'},query:{}} as any,res);
  schedulerRuns.push({label:_label,status:res.statusCode,body:res.body,processorRequests:fetchMock.mock.calls.length});
  evidence('independent-scheduler-pilot-shapes.json',schedulerRuns);
  expect(res.statusCode).toBe(200);expect(res.body.capture).toEqual(skipped);expect(fetchMock).not.toHaveBeenCalled();
  if(board.STARTER_BOARD_COMPUTE_ENABLED==='true'){expect(res.body).toMatchObject({mode:'compute',dispatched:2});expect(dispatchMock).toHaveBeenCalledOnce();}
  else{expect(res.body.mode).toBe('capture-only');expect(dispatchMock).not.toHaveBeenCalled();}
 });
});

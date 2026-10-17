// @vitest-environment node
// R21 demonstration: the accepted pilot is "retain-only", but the minute scheduler's
// capture retry has no controlled-intake guard. Mocked fetch/RPC only; no network.
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
const {rpcMock,dispatchMock}=vi.hoisted(()=>({rpcMock:vi.fn(),dispatchMock:vi.fn()}));
vi.mock('lib/supabase/server',()=>({default:{from:vi.fn(),rpc:(...args:unknown[])=>{const query:any={abortSignal:()=>query,then:(resolve:any,reject:any)=>Promise.resolve(rpcMock(...args)).then(resolve,reject)};return query;}}}));
vi.mock('lib/projections/starterBoardQueue',()=>({dispatchStarterBoardJobs:dispatchMock}));
import scheduler from '../../../web/pages/api/internal/starter-board';

const policy={version:'ifttt-intake-v1',id:'synthetic-r21',startsAt:'2026-10-16T00:00:00Z',endsAt:'2026-10-17T00:00:00Z',maxAttempts:5,maxReceipts:3,
 scopes:[{table:'line_source_ifttt_events',sourceGroup:'gdl_suite',sourceKey:'gamedaygoalies',sourceAccount:'gamedaygoalies'}]};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('independent R21: controlled pilot configuration and the starter-board capture retry',()=>{
 it.each([['scheduler+capture on',true,6],['capture explicitly off',false,0]] as const)('%s → %s processor requests for current-day pending rows',async(_label,capture,expected)=>{
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','true');vi.stubEnv('IFTTT_INTAKE_POLICY',JSON.stringify(policy));
  vi.stubEnv('TWEET_CLAIMS_MODE','shadow');vi.stubEnv('TWEET_PIPELINE_INTERPRETATION_ENABLED','true');
  vi.stubEnv('STARTER_BOARD_SCHEDULER_ENABLED','true');vi.stubEnv('STARTER_BOARD_CAPTURE_ENABLED',String(capture));vi.stubEnv('STARTER_BOARD_COMPUTE_ENABLED','false');
  vi.stubEnv('STARTER_BOARD_WORKER_ORIGIN','https://trusted.example');vi.stubEnv('CRON_SECRET','synthetic-scheduler');
  vi.stubEnv('TWEET_CLAIMS_EVALUATION_ID',undefined);vi.stubEnv('TWEET_CLAIMS_EVALUATION_START_AT',undefined);
  const request=vi.fn(async()=>new Response('{}',{status:200}));vi.stubGlobal('fetch',request);
  const res:any={statusCode:0,body:null,setHeader(){return this;},status(code:number){this.statusCode=code;return this;},json(value:any){this.body=value;return this;},end(){return this;}};
  await scheduler({method:'GET',headers:{authorization:'Bearer synthetic-scheduler'},query:{}} as any,res);
  const calls=(request.mock.calls as unknown as Array<[URL]>).map(([url])=>{const u=new URL(url);return [u.pathname,u.searchParams.get('sourceKey'),u.searchParams.get('currentDayOnly')];});
  expect(calls).toHaveLength(expected);expect(rpcMock).not.toHaveBeenCalled();
  if(capture)writeFileSync(join(__dirname,'evidence/independent-R21-scheduler-processes-pilot-sources.json'),JSON.stringify({
   env:{pilot:'IFTTT_RECEIPT_VARIANTS_ENABLED=true, IFTTT_INTAKE_POLICY=<synthetic>, TWEET_CLAIMS_MODE=shadow, TWEET_PIPELINE_INTERPRETATION_ENABLED=true',
    starterBoard:'SCHEDULER=true, CAPTURE=true, COMPUTE=false',evaluationCohort:'absent'},response:{status:res.statusCode,body:res.body},processorRequests:calls,
   meaning:'Without an evaluation cohort, update-line-sources/update-lines-ccc select every current-day pending raw row for the requested source, including rows retained by the controlled pilot.'},null,2)+'\n');
 });
});

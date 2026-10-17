// @vitest-environment node
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {retainIftttRawReceipt,reconcileIftttRawReceipt} from '../../../web/lib/sources/iftttReceiptRetention';
import {IFTTT_RPC_DEADLINES,IftttIntakeOutcomeUnknown} from '../../../web/lib/sources/iftttRpcDeadline';
const {createClient}=createRequire(join(__dirname,'../../../web/package.json'))('@supabase/supabase-js');
const policy:any={version:'ifttt-intake-v1',id:'synthetic',startsAt:'2026-10-16T00:00:00Z',endsAt:'2026-10-17T00:00:00Z',maxAttempts:5,maxReceipts:2,scopes:[{table:'line_source_ifttt_events',sourceGroup:'fixture',sourceKey:'reporter',sourceAccount:'reporter'}]};
const row={source:'ifttt',source_group:'fixture',source_key:'reporter',source_account:'Reporter',username:'Reporter',tweet_id:'6100',text:'Player will not play.',link_to_tweet:'https://x.com/Reporter/status/6100',tweet_created_at:'2026-10-16T00:00:00Z',raw_payload:{original:'Player will not play.'},processing_status:'pending',updated_at:'2026-10-16T00:00:00Z'};
const {updated_at:_updated,processing_status:_status,...inputRow}=row;
const receipt={version:'ifttt-receipt-v1',table:'line_source_ifttt_events',eventId:'00000000-0000-4000-8000-000000000001',receiptId:'00000000-0000-4000-8000-000000000002',baselineId:null,classification:'canonical',outcome:'duplicate',requiresReview:false,receivedAt:'2026-10-16T00:00:01Z',inputRow};
const reply=(data:any)=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
const write=()=>reply({version:'ifttt-intake-v1',policyId:policy.id,status:'retained',receipt});
const read=(extra:any={})=>reply({version:'ifttt-intake-reconciliation-v1',policyId:policy.id,status:'committed',receipt,...extra});
const client=(fetch:any)=>createClient('https://ifttt-rpc-fixture.invalid','synthetic-not-a-credential',{global:{fetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const args=(db:any)=>({db,table:'line_source_ifttt_events' as const,scope:policy.scopes[0],policy,row});
const path=(url:any)=>new URL(String(url)).pathname.split('/').at(-1);
afterEach(()=>vi.useRealTimers());
describe('actual installed SDK with an injected transport (no HTTP listener/network)',()=>{
 it('attaches a real AbortSignal and sends one normal write only',async()=>{
  const fetch=vi.fn(async(_url:any,init:any)=>{expect(init.signal).toBeInstanceOf(AbortSignal);return write();});
  const result=await retainIftttRawReceipt(args(client(fetch)));expect(result.id).toBe(receipt.receiptId);expect(fetch).toHaveBeenCalledOnce();expect(path(fetch.mock.calls[0][0])).toBe('retain_bounded_ifttt_raw_receipt');
 });
 it('known admission refusal performs no speculative read or second mutation',async()=>{
  const fetch=vi.fn(async()=>reply({version:'ifttt-intake-v1',policyId:policy.id,status:'attempt_cap'}));
  await expect(retainIftttRawReceipt(args(client(fetch)))).rejects.toThrow('attempt_cap');expect(fetch).toHaveBeenCalledOnce();
 });
 it('committed write reply lost in transport is acknowledged only by an exact read',async()=>{
  const fetch=vi.fn(async(url:any,init:any)=>{if(path(url)==='retain_bounded_ifttt_raw_receipt')throw new Error('synthetic committed reply lost');expect(init.method).toBe('POST');expect(JSON.parse(init.body).p_row).toEqual(row);return read();});
  expect(await retainIftttRawReceipt(args(client(fetch)))).toMatchObject({id:receipt.receiptId,reconciled:true});expect(fetch.mock.calls.map(c=>path(c[0]))).toEqual(['retain_bounded_ifttt_raw_receipt','reconcile_ifttt_raw_receipt']);
 });
 it('bounds an abort-ignoring write at6s then reads exact committed evidence once',async()=>{
  vi.useFakeTimers();let signal:AbortSignal;const fetch=vi.fn((url:any,init:any)=>{if(path(url)==='retain_bounded_ifttt_raw_receipt'){signal=init.signal;return new Promise(()=>{});}return Promise.resolve(read());});
  const pending=retainIftttRawReceipt(args(client(fetch)));await vi.advanceTimersByTimeAsync(IFTTT_RPC_DEADLINES.writeMs+1);
  expect(await pending).toMatchObject({reconciled:true,id:receipt.receiptId});expect(signal!.aborted).toBe(true);expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('bounds both waits at8s total and reports unknown when both transports ignore abort',async()=>{
  vi.useFakeTimers();const signals:AbortSignal[]=[];const fetch=vi.fn((_url:any,init:any)=>{signals.push(init.signal);return new Promise(()=>{});});
  const observed=retainIftttRawReceipt(args(client(fetch))).then(value=>({value,error:null}),error=>({value:null,error}));
  await vi.advanceTimersByTimeAsync(IFTTT_RPC_DEADLINES.writeMs+IFTTT_RPC_DEADLINES.readMs+1);const result=await observed;
  expect(result.error).toBeInstanceOf(IftttIntakeOutcomeUnknown);expect(signals.map(s=>s.aborted)).toEqual([true,true]);expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('missing evidence stays unknown if a timed-out write commits later; later recovery is read-only',async()=>{
  vi.useFakeTimers();let finish!:(response:Response)=>void,committed=false;
  const fetch=vi.fn((url:any)=>path(url)==='retain_bounded_ifttt_raw_receipt'?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(read(committed?{}:{status:'unresolved',receipt:undefined})));
  const observed=retainIftttRawReceipt(args(client(fetch))).catch(error=>error);await vi.advanceTimersByTimeAsync(IFTTT_RPC_DEADLINES.writeMs+1);expect(await observed).toBeInstanceOf(IftttIntakeOutcomeUnknown);
  committed=true;finish(write());await vi.advanceTimersByTimeAsync(0);expect(fetch).toHaveBeenCalledTimes(2);
  expect(await reconcileIftttRawReceipt(args(client(fetch)))).toMatchObject({id:receipt.receiptId,reconciled:true});expect(fetch.mock.calls.map(c=>path(c[0]))).toEqual(['retain_bounded_ifttt_raw_receipt','reconcile_ifttt_raw_receipt','reconcile_ifttt_raw_receipt']);
 });
 it('a stalled success response body is bounded then reconciled without another write',async()=>{
  vi.useFakeTimers();const fetch=vi.fn((url:any)=>path(url)==='retain_bounded_ifttt_raw_receipt'?Promise.resolve({ok:true,status:200,statusText:'OK',headers:new Headers(),text:()=>new Promise(()=>{})}):Promise.resolve(read()));
  const pending=retainIftttRawReceipt(args(client(fetch)));await vi.advanceTimersByTimeAsync(IFTTT_RPC_DEADLINES.writeMs+1);expect(await pending).toMatchObject({reconciled:true});expect(fetch).toHaveBeenCalledTimes(2);
 });
 it.each(['policy','payload','receipt'])('a conflicting %s read cannot acknowledge a lost write',async fault=>{
  const fetch=vi.fn(async(url:any)=>{if(path(url)==='retain_bounded_ifttt_raw_receipt')throw new Error('lost');return fault==='policy'?read({policyId:'different'}):fault==='payload'?read({receipt:{...receipt,inputRow:{...inputRow,raw_payload:{original:'Player will play.'}}}}):read({receipt:{...receipt,requiresReview:true}});});
  await expect(retainIftttRawReceipt(args(client(fetch)))).rejects.toBeInstanceOf(IftttIntakeOutcomeUnknown);expect(fetch).toHaveBeenCalledTimes(2);
 });
});

// @vitest-environment node
// Independent review cases for rpc-deadline-reconciliation-v1. Synthetic data only:
// a loopback HTTP listener for the SDK transport and a private PG17 cluster.
import {execFile} from 'node:child_process';
import {createServer,type Server} from 'node:http';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import type {AddressInfo} from 'node:net';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {reconcileIftttRawReceipt,retainIftttRawReceipt} from '../../../web/lib/sources/iftttReceiptRetention';
import {IFTTT_RPC_DEADLINES,IftttIntakeOutcomeUnknown} from '../../../web/lib/sources/iftttRpcDeadline';
const requireWeb=createRequire(join(__dirname,'../../../web/package.json'));
const {createClient}=requireWeb('@supabase/supabase-js');
const {Client}=requireWeb('pg') as typeof import('pg');
const evidence=(name:string,value:unknown)=>writeFileSync(join(__dirname,'evidence',`independent-${name}.json`),JSON.stringify(value,null,2)+'\n');
const WRITE='retain_bounded_ifttt_raw_receipt',READ='reconcile_ifttt_raw_receipt';

const scopes=(['line_source_ifttt_events','lines_ccc_ifttt_events'] as const).flatMap(table=>['fixture-reporter','source-a','source-b'].map(sourceKey=>({table,sourceGroup:'fixture',sourceKey,sourceAccount:'reporter'})));
const lineRow=(sourceKey='source-a',tweetId='7100')=>({source:'ifttt',source_group:'fixture',source_key:sourceKey,source_account:'Reporter',username:'Reporter',
 text:'Synthetic reporter post for deadline review.',link_to_tweet:`https://x.com/Reporter/status/${tweetId}`,tweet_id:tweetId,tweet_embed_code:null,
 tweet_created_at:'2026-10-16T12:00:00.000Z',created_at_label:'2026-10-16T12:00:00Z',processing_status:'pending',
 raw_payload:{text:'Synthetic reporter post for deadline review.',link_to_tweet:`https://x.com/Reporter/status/${tweetId}`},updated_at:'2026-10-16T12:00:01.000Z'});

describe('independent: installed supabase-js over a real loopback HTTP socket',()=>{
 type Seen={path:string,body:any,closed:boolean,finished:boolean};
 const policy:any={version:'ifttt-intake-v1',id:'synthetic-loopback',startsAt:'2026-10-16T00:00:00Z',endsAt:'2026-10-17T00:00:00Z',maxAttempts:5,maxReceipts:5,scopes};
 const row=lineRow();const {updated_at:_u,processing_status:_p,...inputRow}=row;
 const receipt={version:'ifttt-receipt-v1',table:'line_source_ifttt_events',eventId:'00000000-0000-4000-8000-00000000a001',receiptId:'00000000-0000-4000-8000-00000000a002',
  baselineId:null,classification:'canonical',outcome:'duplicate',requiresReview:false,receivedAt:'2026-10-16T12:00:02Z',inputRow};
 let server:Server,url='',mode:{write:'stall-body'|'stall-headers'|'http-500',read:'committed'|'unresolved'|'stall-headers'}={write:'stall-body',read:'committed'};
 const seen:Seen[]=[];
 beforeAll(async()=>{
  server=createServer((req,res)=>{
   const path=new URL(req.url!,'http://127.0.0.1').pathname.split('/').at(-1)!,entry:Seen={path,body:null,closed:false,finished:false};seen.push(entry);
   res.on('close',()=>{entry.closed=true;entry.finished=res.writableFinished;});
   let text='';req.on('data',chunk=>{text+=chunk;});req.on('end',()=>{
    entry.body=JSON.parse(text);const behaviour=path===WRITE?mode.write:mode.read;
    if(behaviour==='stall-headers')return;
    if(behaviour==='stall-body'){res.writeHead(200,{'content-type':'application/json'});res.write('{"version":"ifttt-intake-v1",');return;}
    if(behaviour==='http-500'){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({code:'57014',details:null,hint:null,message:'canceling statement due to statement timeout'}));return;}
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({version:'ifttt-intake-reconciliation-v1',policyId:policy.id,status:behaviour,...(behaviour==='committed'?{receipt}:{})}));
   });
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 });
 beforeEach(()=>{seen.length=0;});
 afterAll(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const call=()=>{const db=createClient(url,'synthetic-not-a-credential',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return retainIftttRawReceipt({db,table:'line_source_ifttt_events',row,policy,scope:scopes[1]});};
 it('a stalled 200 body is torn down at the write deadline and acknowledged only by one exact read',async()=>{
  mode={write:'stall-body',read:'committed'};const start=performance.now(),result=await call(),elapsed=performance.now()-start;
  await vi.waitFor(()=>expect(seen.every(entry=>entry.closed)).toBe(true),{timeout:2000,interval:20});
  expect(result).toMatchObject({id:receipt.receiptId,reconciled:true});expect(elapsed).toBeGreaterThanOrEqual(IFTTT_RPC_DEADLINES.writeMs-100);expect(elapsed).toBeLessThan(IFTTT_RPC_DEADLINES.writeMs+1500);
  expect(seen.map(entry=>entry.path)).toEqual([WRITE,READ]);expect(seen[0]).toMatchObject({closed:true,finished:false});expect(seen[1].body).toEqual(seen[0].body);expect(seen[0].body.p_row).toEqual(row);
  evidence('loopback-stalled-body',{elapsed,deadlines:IFTTT_RPC_DEADLINES,requests:seen,result});
 },15000);
 it('two stalled sockets are both closed and the outcome is unknown at about write+read deadlines',async()=>{
  mode={write:'stall-headers',read:'stall-headers'};const start=performance.now(),error=await call().then(()=>null,failure=>failure),elapsed=performance.now()-start;
  await vi.waitFor(()=>expect(seen.every(entry=>entry.closed)).toBe(true),{timeout:2000,interval:20});
  expect(error).toBeInstanceOf(IftttIntakeOutcomeUnknown);const total=IFTTT_RPC_DEADLINES.writeMs+IFTTT_RPC_DEADLINES.readMs;
  expect(elapsed).toBeGreaterThanOrEqual(total-100);expect(elapsed).toBeLessThan(total+1500);
  expect(seen.map(entry=>[entry.path,entry.closed,entry.finished])).toEqual([[WRITE,true,false],[READ,true,false]]);
  evidence('loopback-both-stalled',{elapsed,deadlines:IFTTT_RPC_DEADLINES,requests:seen,error:{name:error.constructor.name,message:error.message}});
 },15000);
 it('a server statement-timeout error is not treated as rollback: one read, then unknown, never a second write',async()=>{
  mode={write:'http-500',read:'unresolved'};const error=await call().then(()=>null,failure=>failure);
  expect(error).toBeInstanceOf(IftttIntakeOutcomeUnknown);expect(seen.map(entry=>entry.path)).toEqual([WRITE,READ]);
  evidence('loopback-server-timeout-error',{requests:seen,error:{name:error.constructor.name,message:error.message}});
 });
});

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))('independent: catalog-derived PostgREST-style calls on private PG17',()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};
 for(const key of Object.keys(env))if(key.startsWith('PG'))delete env[key];
 let root='',socket='',started=false,policy:any;
 const connect=async()=>{const c=new Client({host:socket,port:65449,user:'ifttt_deadline_review',database:'postgres',password:'',ssl:false,connectionTimeoutMillis:2000});await c.connect();return c;};
 const sql=async(text:string,values:any[]=[])=>{const c=await connect();try{return (await c.query(text,values)).rows;}finally{await c.end();}};
 // Models PostgREST v12+ for an RPC: READ ONLY for non-volatile functions; hoist the
 // function's own statement_timeout via a separate set_config before the main query.
 const postgrest=async(name:string,args:{p_policy:any,p_scope:any,p_row:any},timeZone='UTC')=>{
  const c=await connect();
  try{
   const meta=(await c.query('select provolatile,proconfig from pg_proc where oid=to_regprocedure($1)',[`public.${name}(jsonb,jsonb,jsonb)`])).rows[0];
   const readOnly=meta.provolatile!=='v',hoisted=(meta.proconfig??[]).map((s:string)=>s.split('=')).filter(([key]:string[])=>key==='statement_timeout');
   await c.query(`begin isolation level read committed${readOnly?' read only':''}`);
   await c.query("select set_config('role','service_role',true),set_config('timezone',$1,true)",[timeZone]);
   for(const [key,value] of hoisted)await c.query('select set_config($1,$2,true)',[key,value]);
   const start=performance.now();
   try{const result=(await c.query(`select public.${name}($1,$2,$3) result`,[JSON.stringify(args.p_policy),JSON.stringify(args.p_scope),JSON.stringify(args.p_row)])).rows[0].result;
    await c.query('commit');return {result,readOnly,hoisted,elapsed:performance.now()-start};}
   catch(error:any){await c.query('rollback').catch(()=>undefined);error.elapsed=performance.now()-start;error.readOnly=readOnly;error.hoisted=hoisted;throw error;}
  }finally{await c.end();}
 };
 const db=(timeZone='UTC')=>({rpc:(name:string,args:any)=>{const query:any={abortSignal:()=>query,
  then:(resolve:any,reject:any)=>postgrest(name,args,timeZone).then(r=>({data:r.result,error:null}),(e:any)=>({data:null,error:{message:e.message,code:e.code}})).then(resolve,reject)};return query;}});
 const state=async()=>{const c=await connect();try{await c.query("set timezone='UTC'");return (await c.query(`select jsonb_build_object(
  'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by policy_id),'[]') from public.ifttt_intake_policies p),
  'admissions',(select coalesce(jsonb_agg(to_jsonb(r) order by policy_id,receipt_id),'[]') from public.ifttt_intake_receipts r),
  'variants',(select coalesce(jsonb_agg(to_jsonb(v) order by receipt_id),'[]') from public.ifttt_raw_receipt_variants v),
  'raw',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.line_source_ifttt_events r),
  'ccc',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.lines_ccc_ifttt_events r)) s`)).rows[0].s;}finally{await c.end();}};
 const args=(row:any=lineRow(),scope:any=scopes[1])=>({p_policy:policy,p_scope:scope,p_row:row});
 const ts=(row:any=lineRow(),scope:any=scopes[1],timeZone='UTC')=>({db:db(timeZone),table:scope.table,row,policy,scope});
 beforeAll(async()=>{
  root=mkdtempSync('/tmp/fhf-ifttt-deadline-review-');socket=join(root,'socket');mkdirSync(socket,{mode:0o700});
  await exec(join(bin,'initdb'),['-D',join(root,'data'),'--no-locale','--encoding=UTF8','--auth-local=trust','--auth-host=reject','-U','ifttt_deadline_review'],{env});
  await exec(join(bin,'pg_ctl'),['-D',join(root,'data'),'-l',join(root,'server.log'),'-w','-t','10','-o',`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65449`,'start'],{env});started=true;
  await sql('create role service_role bypassrls;create role anon;create role authenticated');
 },20000);
 afterAll(async()=>{if(started)await exec(join(bin,'pg_ctl'),['-D',join(root,'data'),'-w','-t','10','stop','-m','fast'],{env});if(root)rmSync(root,{recursive:true,force:true});});
 beforeEach(async()=>{
  await sql('drop schema public cascade;create schema public;grant usage on schema public to service_role');
  const baseline=readFileSync(join(__dirname,'dependency-snapshot/supabase/migrations/20260716112908_production_schema_baseline.sql'),'utf8');
  for(const table of ['line_source_ifttt_events','lines_ccc_ifttt_events']){
   const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))![0],unique=baseline.match(new RegExp(`CREATE UNIQUE INDEX [^;]+ ON public\\.${table} [^;]+;`))![0];
   await sql(ddl+unique+`;alter table public.${table} add primary key(id);alter table public.${table} enable row level security;grant select,insert,update on public.${table} to service_role`);
  }
  for(const file of ['../receiver-variant-retention-v2/supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql','../receiver-intake-bounds-v2/supabase/migrations/20261016085537_ifttt_bounded_receipt_intake.sql','supabase/migrations/20261016092509_ifttt_rpc_deadline_reconciliation.sql'])
   await sql(readFileSync(join(__dirname,file),'utf8'));
  policy={version:'ifttt-intake-v1',id:'synthetic-deadline-review',startsAt:new Date(Date.now()+100).toISOString(),endsAt:new Date(Date.now()+120000).toISOString(),maxAttempts:50,maxReceipts:50,scopes};
  await sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify(policy)]);
  await vi.waitFor(async()=>expect((await sql("select clock_timestamp()>=($1::jsonb->>'startsAt')::timestamptz ready",[JSON.stringify(policy)]))[0].ready).toBe(true),{interval:20});
 });

 it('write is a hoisted-5s read-write call; reconciliation is a hoisted-1s READ ONLY call that allocates no transaction id',async()=>{
  const written=await retainIftttRawReceipt(ts());expect(written).toMatchObject({classification:'canonical',outcome:'retained'});
  const before=await state(),read=await postgrest(READ,args());
  expect(read).toMatchObject({readOnly:true,hoisted:[['statement_timeout','1s']]});expect(read.result).toMatchObject({status:'committed',receipt:{receiptId:written.id}});
  const c=await connect();let xid:unknown;
  try{await c.query('begin');await c.query("select set_config('role','service_role',true)");
   await c.query(`select public.${READ}($1,$2,$3)`,[JSON.stringify(policy),JSON.stringify(scopes[1]),JSON.stringify(lineRow())]);
   xid=(await c.query('select txid_current_if_assigned() xid')).rows[0].xid;await c.query('rollback');}finally{await c.end();}
  expect(xid).toBeNull();expect(await state()).toEqual(before);
  const writeMeta=(await sql("select provolatile,prosecdef,proconfig from pg_proc where proname=$1",[WRITE]))[0];
  expect(writeMeta).toMatchObject({provolatile:'v',prosecdef:true});expect(writeMeta.proconfig).toEqual(expect.arrayContaining(['lock_timeout=2s','statement_timeout=5s']));
  evidence('catalog-hoist-and-readonly',{written,read,readWriteTransactionXidAfterReconcile:xid,writeMeta});
 });
 it('the catalog-derived 5s hoist cancels a stalled write and the whole attempt (including its charge) rolls back',async()=>{
  await sql("create function public.review_sleep() returns trigger language plpgsql as $$begin perform pg_sleep(6);return new;end$$;create trigger review_sleep before insert on public.ifttt_raw_receipt_variants for each row execute function public.review_sleep()");
  const before=await state(),error=await postgrest(WRITE,args()).then(()=>null,failure=>failure);
  expect(error).toMatchObject({code:'57014',readOnly:false,hoisted:[['statement_timeout','5s']]});expect(error.elapsed).toBeGreaterThan(4800);expect(error.elapsed).toBeLessThan(6000);
  expect(await state()).toEqual(before);expect((await postgrest(READ,args())).result.status).toBe('unresolved');
  evidence('catalog-hoist-cancellation',{error:{code:error.code,message:error.message,elapsed:error.elapsed,hoisted:error.hoisted},stateUnchanged:true});
 },15000);
 it('an in-flight write is read as unresolved without blocking on its locks, then committed after its late commit',async()=>{
  await sql("create function public.review_hold() returns trigger language plpgsql as $$begin perform pg_advisory_xact_lock(62017,1);return new;end$$;create trigger review_hold before insert on public.ifttt_raw_receipt_variants for each row execute function public.review_hold()");
  const holder=await connect();await holder.query('select pg_advisory_lock(62017,1)');let writing:Promise<any>|undefined;
  try{
   const before=await state();writing=postgrest(WRITE,args());
   await vi.waitFor(async()=>expect(Number((await holder.query("select count(*) n from pg_locks where locktype='advisory' and classid=62017 and objid=1 and not granted")).rows[0].n)).toBe(1),{timeout:1500,interval:10});
   const read=await postgrest(READ,args()),tsRead=await reconcileIftttRawReceipt(ts()).then(()=>null,failure=>failure);
   expect(read.result.status).toBe('unresolved');expect(read.elapsed).toBeLessThan(500);expect(tsRead).toBeInstanceOf(IftttIntakeOutcomeUnknown);expect(await state()).toEqual(before);
   await holder.query('select pg_advisory_unlock(62017,1)');const written=await writing;writing=undefined;
   expect(written.result).toMatchObject({status:'retained',receipt:{classification:'canonical'}});
   const after=await postgrest(READ,args());expect(after.result).toMatchObject({status:'committed',receipt:{receiptId:written.result.receipt.receiptId}});
   evidence('inflight-read-nonblocking',{inflightRead:read,writeResult:written.result,lateRead:after.result});
  }finally{await holder.query('select pg_advisory_unlock_all()');await holder.end();if(writing)await writing.catch(()=>undefined);}
 });
 it('a session TimeZone mismatch fails closed on reconciliation; an exact retry under another TimeZone becomes a held variant (SQL6 observation)',async()=>{
  const written=await retainIftttRawReceipt(ts(lineRow(),scopes[1],'UTC'));const before=await state();
  const chicago=await postgrest(READ,args(),'America/Chicago'),utc=await postgrest(READ,args(),'UTC');
  expect(chicago.result.status).toBe('unresolved');expect(utc.result).toMatchObject({status:'committed',receipt:{receiptId:written.id}});expect(await state()).toEqual(before);
  const retry=await retainIftttRawReceipt(ts(lineRow(),scopes[1],'America/Chicago'));
  expect(retry).toMatchObject({classification:'same_post_variant',outcome:'retained',requiresReview:true});expect(retry.id).not.toBe(written.id);
  const variants=(await state()).variants;expect(variants).toHaveLength(2);expect(variants.map((v:any)=>v.input_row.tweet_created_at).sort()).toEqual(['2026-10-16T07:00:00-05:00','2026-10-16T12:00:00+00:00']);
  evidence('timezone-sensitivity',{reconcileChicago:chicago.result,reconcileUtc:utc.result,exactRetryUnderChicago:retry,variants});
 });
 it('a legacy raw carrier with no controlled admission is never acknowledged',async()=>{
  const row=lineRow();const {updated_at:_u,...legacy}=row;
  await sql(`set role service_role;insert into public.line_source_ifttt_events(${Object.keys(legacy).join(',')}) select ${Object.keys(legacy).join(',')} from jsonb_populate_record(null::public.line_source_ifttt_events,'${JSON.stringify(legacy).replace(/'/g,"''")}'::jsonb)`);
  const before=await state();expect(before.raw).toHaveLength(1);expect(before.variants).toEqual([]);
  expect((await postgrest(READ,args(row))).result.status).toBe('unresolved');
  expect(await reconcileIftttRawReceipt(ts(row)).then(()=>null,failure=>failure)).toBeInstanceOf(IftttIntakeOutcomeUnknown);expect(await state()).toEqual(before);
 });
 it('a committed receipt cannot be borrowed by another source key or by the CCC table for the same post',async()=>{
  const written=await retainIftttRawReceipt(ts());const before=await state();
  const otherKey=await postgrest(READ,args(lineRow('source-b'),scopes[2]));
  const {source_group:_g,source_key:_k,...cccRow}=lineRow();const ccc=await postgrest(READ,args(cccRow,scopes[4]));
  expect(otherKey.result.status).toBe('unresolved');expect(ccc.result.status).toBe('unresolved');expect(await state()).toEqual(before);
  expect((await postgrest(READ,args())).result).toMatchObject({status:'committed',receipt:{receiptId:written.id}});
 });
});

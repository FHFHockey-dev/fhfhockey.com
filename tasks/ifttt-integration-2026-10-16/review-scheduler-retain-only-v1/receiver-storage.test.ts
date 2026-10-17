// @vitest-environment node
import {execFile} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
const {Client}=createRequire(join(__dirname,'../../../web/package.json'))('pg') as typeof import('pg');
const bridge=vi.hoisted(()=>({store:null as null|((table:string,row:any,options?:any)=>Promise<any>),rpc:null as null|((name:string,args:any)=>Promise<any>)}));
vi.mock('lib/supabase/server',()=>({default:{rpc:(name:string,args:any)=>{const query={abortSignal:(_signal:AbortSignal)=>query,then:(resolve:any,reject:any)=>bridge.rpc!(name,args).then(resolve,reject)};return query;},from:(table:string)=>({insert:(row:any)=>bridge.store!(table,row),upsert:(row:any,options:any)=>bridge.store!(table,row,options)})}}));
import {createLineSourceIftttReceiver} from 'lib/sources/lineSourceIftttReceiver';
import fixtureSupabase from 'lib/supabase/server';
import {reconcileIftttRawReceipt} from '../../../web/lib/sources/iftttReceiptRetention';

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))('variant-aware receiver with actual raw/archive RPC storage',()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};
 for(const key of Object.keys(env))if(key.startsWith('PG'))delete env[key];
 let root:string,socket:string,started=false,loseRpcReply=false,storageFailure=false;
 let policy:any;

 let gate:Promise<void>|null=null;const storeCalls:any[]=[];
 const tables=['line_source_ifttt_events','lines_ccc_ifttt_events'] as const;
 const scopes=tables.flatMap(table=>['fixture-reporter','source-a','source-b'].map(sourceKey=>({table,sourceGroup:'fixture',sourceKey,sourceAccount:'reporter'})));
 const enable=()=>{vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','true');vi.stubEnv('IFTTT_INTAKE_POLICY',JSON.stringify(policy));vi.stubEnv('TWEET_CLAIMS_MODE','shadow');vi.stubEnv('TWEET_PIPELINE_INTERPRETATION_ENABLED','true');};
 const legacy=()=>{vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','false');vi.stubEnv('IFTTT_INTAKE_POLICY',undefined);};
 const sql=async(text:string,values:any[]=[],role=true)=>{
  const c=new Client({host:socket,port:65448,user:'ifttt_receiver_test',database:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:2000});
  await c.connect();try{if(role)await c.query('set role service_role');return (await c.query(text,values)).rows;}finally{await c.end();}
 };
 const rpcSql=async(name:string,args:any)=>{
  const c=new Client({host:socket,port:65448,user:'ifttt_receiver_test',database:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:2000});
  await c.connect();try{await c.query('begin'+(name==='reconcile_ifttt_raw_receipt'?' read only':''));await c.query('set local role service_role');await c.query(`set local statement_timeout='${name==='reconcile_ifttt_raw_receipt'?'1s':'5s'}'`);const result=await c.query(`select public.${name}($1,$2,$3) receipt`,[JSON.stringify(args.p_policy),JSON.stringify(args.p_scope),JSON.stringify(args.p_row)]);await c.query('commit');return result.rows;}finally{await c.end();}
 };
 const handler=(table:typeof tables[number]='line_source_ifttt_events',key='fixture-reporter')=>createLineSourceIftttReceiver({sourceGroup:'fixture',sourceKey:key,sourceAccount:'Reporter',secretEnvVar:'IFTTT_LOCAL_RECEIVER_FIXTURE_SECRET',eventTable:table});
 const body={source_account:'Reporter',username:'Reporter',text:'Player will not play tonight.',link_to_tweet:'https://x.com/Reporter/status/6100',created_at:'2026-10-16T12:00:00Z'};
 const req=(input:any=body)=>({method:'POST',headers:{'x-fhfh-ifttt-secret':'synthetic-local-secret'},query:{process:'false'},body:input}) as any;
 const response=(lose=false)=>({statusCode:null as number|null,body:null as any,setHeader(){return this;},status(code:number){this.statusCode=code;return this;},json(value:any){if(lose)throw new Error('synthetic response lost after commit');this.body=value;return this;}}) as any;
 const rows=(table:typeof tables[number]='line_source_ifttt_events')=>sql(`select to_jsonb(r) body from public.${table} r order by id`);
 beforeAll(async()=>{
  root=mkdtempSync('/tmp/fhf-ifttt-receiver-');socket=join(root,'socket');mkdirSync(socket,{mode:0o700});
  await exec(join(bin,'initdb'),['-D',join(root,'data'),'--no-locale','--encoding=UTF8','--auth-local=trust','--auth-host=reject','-U','ifttt_receiver_test'],{env});
  await exec(join(bin,'pg_ctl'),['-D',join(root,'data'),'-l',join(root,'server.log'),'-w','-t','10','-o',`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65448`,'start'],{env});started=true;
  await sql('create role service_role bypassrls;create role anon;create role authenticated',[],false);
 },20000);
 beforeEach(async()=>{
  enable();vi.stubEnv('IFTTT_LOCAL_RECEIVER_FIXTURE_SECRET','synthetic-local-secret');vi.stubEnv('STARTER_BOARD_CAPTURE_ENABLED','false');
  vi.stubEnv('IFTTT_INTAKE_STOP',undefined);loseRpcReply=false;storageFailure=false;gate=null;storeCalls.length=0;
  await sql('drop schema public cascade;create schema public;grant usage on schema public to service_role',[],false);
  const baseline=readFileSync(join(__dirname,'dependency-snapshot/supabase/migrations/20260716112908_production_schema_baseline.sql'),'utf8');
  for(const table of tables){
   const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))![0];
   const unique=baseline.match(new RegExp(`CREATE UNIQUE INDEX [^;]+ ON public\\.${table} [^;]+;`))![0];
   await sql(ddl+unique+`;alter table public.${table} add primary key(id);alter table public.${table} enable row level security;grant select,insert,update on public.${table} to service_role`,[],false);
  }
  await sql(readFileSync(join(__dirname,'../receiver-variant-retention-v2/supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql'),'utf8'),[],false);
  await sql(readFileSync(join(__dirname,'../receiver-intake-bounds-v2/supabase/migrations/20261016085537_ifttt_bounded_receipt_intake.sql'),'utf8'),[],false);
  await sql(readFileSync(join(__dirname,'supabase/migrations/20261016092509_ifttt_rpc_deadline_reconciliation.sql'),'utf8'),[],false);
  policy={version:'ifttt-intake-v1',id:'synthetic-local-policy',startsAt:new Date(Date.now()+100).toISOString(),endsAt:new Date(Date.now()+60000).toISOString(),maxAttempts:1000,maxReceipts:1000,scopes};
  await sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify(policy)],false);
  await vi.waitFor(async()=>expect((await sql("select clock_timestamp()>=($1::jsonb->>'startsAt')::timestamptz ready",[JSON.stringify(policy)]))[0].ready).toBe(true),{interval:20});
  enable();
  bridge.rpc=async(name,args)=>{
   if(!['retain_bounded_ifttt_raw_receipt','reconcile_ifttt_raw_receipt'].includes(name))throw new Error('Unexpected receiver RPC');
   storeCalls.push({name,args});if(gate)await gate;
   if(storageFailure)return {error:{message:'synthetic storage unavailable'},data:null};
   let receipt:any;
   try { receipt=(await rpcSql(name,args))[0].receipt; }
   catch(error:any){writeFileSync(join(__dirname,`evidence/rpc-diagnostic-${name}.json`),JSON.stringify({message:error.message,code:error.code,where:error.where},null,2)+'\n');throw error;}
   if(loseRpcReply&&name==='retain_bounded_ifttt_raw_receipt'){loseRpcReply=false;return {error:{message:'synthetic committed RPC reply lost'},data:null};}
   return {error:null,data:receipt};
  };
  bridge.store=async(table,row,options)=>{
   if(!tables.includes(table as any))throw new Error('Unexpected local receiver table');
   storeCalls.push({table,row,options});if(gate)await gate;
   if(storageFailure)return {error:{message:'synthetic storage unavailable'}};
   const entries=Object.entries(row),ident=(key:string)=>{if(!/^[a-z_]+$/.test(key))throw new Error('Unexpected column');return `"${key}"`;};
   const expectedConflict=table==='line_source_ifttt_events'?'source_key,tweet_id':'tweet_id';
   if(options&&(options.onConflict!==expectedConflict||options.ignoreDuplicates!==true))throw new Error('Unmodeled PostgREST option');
   await sql(`insert into public.${table}(${entries.map(([key])=>ident(key)).join(',')}) values(${entries.map((_,i)=>`$${i+1}`).join(',')})${options?` on conflict(${expectedConflict}) do nothing`:''}`,entries.map(([key,value])=>key==='raw_payload'?JSON.stringify(value):value));
   if(loseRpcReply){loseRpcReply=false;return {error:{message:'synthetic committed storage reply lost'}};}
   return {error:null};
  };
 });
 afterAll(async()=>{bridge.store=null;bridge.rpc=null;vi.unstubAllEnvs();if(started)await exec(join(bin,'pg_ctl'),['-D',join(root,'data'),'-w','-t','10','stop','-m','fast'],{env});if(root)rmSync(root,{recursive:true,force:true});});
 it('does not send success before the raw write settles and preserves the exact original body',async()=>{
  let release!:()=>void;gate=new Promise(resolve=>{release=resolve;});const res=response(),pending=handler()(req(),res);
  await vi.waitFor(()=>expect(storeCalls).toHaveLength(1));expect(res.statusCode).toBeNull();expect(await rows()).toEqual([]);
  release();await pending;expect(res.statusCode).toBe(200);expect(res.body.processingStatus).toBe('pending');
  expect((await rows())[0].body).toMatchObject({tweet_id:'6100',processing_status:'pending',raw_payload:body});
 });
 it('storage rejection returns500 and retains no raw row',async()=>{
  storageFailure=true;const res=response();await handler()(req(),res);expect(res.statusCode).toBe(500);expect(await rows()).toEqual([]);
 });
 it.each(tables)('%s committed reply loss reconciles read-only; exact-key later request preserves one immutable retained row',async table=>{
  loseRpcReply=true;const first=response();await handler(table)(req(),first);expect(first.statusCode).toBe(200);expect(first.body.receipt.reconciled).toBe(true);const committed=await rows(table);expect(committed).toHaveLength(1);
  const retry=response();await handler(table)(req(),retry);expect(retry.statusCode).toBe(200);expect(await rows(table)).toEqual(committed);
 });
 it('HTTP response loss after a successful write leaves one raw row for a safe same-key retry',async()=>{
  await expect(handler()(req(),response(true))).rejects.toThrow('response lost');const committed=await rows();expect(committed).toHaveLength(1);
  const retry=response();await handler()(req(),retry);expect(retry.statusCode).toBe(200);expect(await rows()).toEqual(committed);
 });
 it.each(tables)('%s concurrent duplicate delivery stores one row and both local handlers return200',async table=>{
  const a=response(),b=response();await Promise.all([handler(table)(req(),a),handler(table)(req(),b)]);expect([a.statusCode,b.statusCode]).toEqual([200,200]);expect(await rows(table)).toHaveLength(1);
 });
 it('a processed raw receipt retried at the same key preserves status, payload and first receipt clock',async()=>{
  await handler()(req(),response());await sql("update public.line_source_ifttt_events set processing_status='processed',raw_payload=raw_payload||'{\"retainedMarker\":true}'::jsonb");
  const processed=await rows();await handler()(req(),response());expect(await rows()).toEqual(processed);
 });
 it('separate configured generic source keys can retain the same post independently',async()=>{
  await handler('line_source_ifttt_events','source-a')(req(),response());await handler('line_source_ifttt_events','source-b')(req(),response());
  expect((await rows()).map(row=>row.body.source_key).sort()).toEqual(['source-a','source-b']);
 });
 it('retains a changed body at the same key as immutable held evidence and preserves the canonical row',async()=>{
  await handler()(req(),response());const first=await rows();const changed={...body,text:'Player will play tomorrow.'},res=response();await handler()(req(changed),res);
  const after=await rows(),receipts=await sql("select to_jsonb(r) body from public.ifttt_raw_receipt_variants r order by retained_at");
  expect(res.statusCode).toBe(200);expect(after).toEqual(first);expect(receipts).toHaveLength(2);
  expect(receipts[0].body.input_row.raw_payload).toEqual(body);expect(receipts[1].body.input_row.raw_payload).toEqual(changed);
  expect(receipts[1].body).toMatchObject({classification:'same_post_variant',baseline_id:receipts[0].body.receipt_id});
  expect(res.body.receipt).toMatchObject({classification:'same_post_variant',requiresReview:true,outcome:'retained'});
  expect(res.body.processingStatus).toBe('held_for_review');
  writeFileSync(join(__dirname,'evidence/same-key-variant-retained.json'),JSON.stringify({first,changedRequest:changed,result:res.body,after,receipts},null,2)+'\n');
 });
 it('controlled intake rejects missing identity without the legacy insert bypass',async()=>{
  const input={...body,link_to_tweet:undefined};delete input.link_to_tweet;
  const res=response();await handler()(req(input),res);expect(res.statusCode).toBe(400);expect(await rows()).toEqual([]);expect(storeCalls).toHaveLength(0);
 });
 const archive=()=>sql("select to_jsonb(r) body from public.ifttt_raw_receipt_variants r order by retained_at,receipt_id");
 const all=async()=>({raw:await rows(),ccc:await rows('lines_ccc_ifttt_events'),archive:await archive()});
 const changed={...body,text:'Player will play tomorrow.'};
 it.each(tables)('%s exact variant retries reuse one held receipt without resetting the canonical row',async table=>{
  await handler(table)(req(),response());const firstRaw=await rows(table);const a=response();await handler(table)(req(changed),a);
  const firstArchive=await archive(),b=response();await handler(table)(req(changed),b);
  expect(b.body.receipt).toEqual({...a.body.receipt,outcome:'duplicate'});expect(await archive()).toEqual(firstArchive);expect(await rows(table)).toEqual(firstRaw);
 });
 it('JSON property order is an exact retry while original text whitespace is retained',async()=>{
  const input={...body,text:'  Player will not play tonight.  '};const a=response();await handler()(req(input),a);const first=await archive();
  const reordered=Object.fromEntries(Object.entries(input).reverse()),b=response();await handler()(req(reordered),b);
  expect(b.body.receipt).toEqual({...a.body.receipt,outcome:'duplicate'});expect(await archive()).toEqual(first);expect(first[0].body.input_row.raw_payload.text).toBe(input.text);
 });
 it('concurrent distinct variants produce one canonical carrier and one held version, never two raw actions',async()=>{
  const a=response(),b=response();await Promise.all([handler()(req(body),a),handler()(req(changed),b)]);
  expect([a.statusCode,b.statusCode]).toEqual([200,200]);expect([a.body.receipt.requiresReview,b.body.receipt.requiresReview].sort()).toEqual([false,true]);
  const retained=await archive();expect(retained).toHaveLength(2);expect(await rows()).toHaveLength(1);
  expect(retained.map(r=>r.body.input_row.raw_payload.text).sort()).toEqual([body.text,changed.text].sort());
 });
 it.each(['extraGameId','author','link'])('changed %s provenance stays a variant of the same post, not a new independent carrier',async kind=>{
  await handler()(req(),response());const canonical=await rows();
  const input=kind==='extraGameId'?{...body,gameId:900013}:kind==='author'?{...body,username:'Other writer',source_account:'OtherWriter'}:{...body,link_to_tweet:'https://x.com/OtherWriter/status/6100'};
  const res=response();await handler()(req(input),res);expect(res.body.receipt).toMatchObject({classification:'same_post_variant',requiresReview:true});
  expect(await rows()).toEqual(canonical);expect((await archive())[1].body.input_row.raw_payload).toEqual(input);
 });
 it('a variant commit with lost RPC reply is read-only reconciled to its same held identity',async()=>{
  await handler()(req(),response());loseRpcReply=true;const first=response();await handler()(req(changed),first);
  expect(first.statusCode).toBe(200);expect(first.body.receipt.reconciled).toBe(true);const committed=await all(),retry=response();await handler()(req(changed),retry);
  expect(retry.statusCode).toBe(200);expect(retry.body.receipt).toMatchObject({classification:'same_post_variant',outcome:'duplicate',requiresReview:true});expect(await all()).toEqual(committed);
 });
 it('a variant HTTP response loss cannot duplicate immutable evidence on retry',async()=>{
  await handler()(req(),response());await expect(handler()(req(changed),response(true))).rejects.toThrow('response lost');const committed=await all();
  const retry=response();await handler()(req(changed),retry);expect(retry.statusCode).toBe(200);expect(await all()).toEqual(committed);
 });
 it('a held variant never invokes the configured processor even with process=true and capture enabled',async()=>{
  await handler()(req(),response());vi.stubEnv('STARTER_BOARD_CAPTURE_ENABLED','true');const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy);
  try{
   const configured=createLineSourceIftttReceiver({sourceGroup:'fixture',sourceKey:'fixture-reporter',sourceAccount:'Reporter',secretEnvVar:'IFTTT_LOCAL_RECEIVER_FIXTURE_SECRET',processorPath:'/api/v1/db/update-line-sources'});
   const request=req(changed);request.query={process:'true'};const res=response();await configured(request,res);
   expect(res.statusCode).toBe(200);expect(res.body.receipt.requiresReview).toBe(true);expect(res.body.processor).toBeUndefined();expect(fetchSpy).not.toHaveBeenCalled();expect(await rows()).toHaveLength(1);
  }finally{vi.unstubAllGlobals();}
 });
 it('first archive-write failure rolls back the raw insert and permits a clean later retry',async()=>{
  await sql("create function public.fixture_reject_receipt() returns trigger language plpgsql as $$begin raise exception 'injected receipt write failure';end$$;create trigger fixture_reject_receipt before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_reject_receipt()",[],false);
  const failed=response();await handler()(req(),failed);expect(failed.statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});
  await sql('drop trigger fixture_reject_receipt on public.ifttt_raw_receipt_variants;drop function public.fixture_reject_receipt()',[],false);
  const retry=response();await handler()(req(),retry);expect(retry.statusCode).toBe(200);expect(await archive()).toHaveLength(1);
 });
 it('late variant failure rolls back legacy-baseline archiving and leaves the preexisting processed row unchanged',async()=>{
  legacy();await handler()(req(),response());await sql("update public.line_source_ifttt_events set processing_status='processed'");const before=await all();
  enable();
  await sql("create function public.fixture_reject_variant() returns trigger language plpgsql as $$begin if new.classification='same_post_variant' then raise exception 'injected variant failure';end if;return new;end$$;create trigger fixture_reject_variant before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_reject_variant()",[],false);
  const failed=response();await handler()(req(changed),failed);expect(failed.statusCode).toBe(500);expect(await all()).toEqual(before);
  await sql('drop trigger fixture_reject_variant on public.ifttt_raw_receipt_variants;drop function public.fixture_reject_variant()',[],false);
  const retry=response();await handler()(req(changed),retry);expect(retry.body.receipt.requiresReview).toBe(true);expect(await rows()).toEqual(before.raw);expect(await archive()).toHaveLength(2);
 });
 it('post-insert trigger raw rewrites are detected inside the RPC and roll both stores back',async()=>{
  await sql("create function public.fixture_rewrite_canonical() returns trigger language plpgsql as $$begin update public.line_source_ifttt_events set source_account='rewritten';return new;end$$;create trigger fixture_rewrite_canonical after insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_rewrite_canonical()",[],false);
  const res=response();await handler()(req(),res);expect(res.statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});
 });
 it('a receipt trigger cannot certify a rewritten retained clock',async()=>{
  await sql("create function public.fixture_rewrite_receipt_clock() returns trigger language plpgsql as $$begin new.retained_at=new.retained_at+interval '1 microsecond';return new;end$$;create trigger fixture_rewrite_receipt_clock before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_rewrite_receipt_clock()",[],false);
  const res=response();await handler()(req(),res);expect(res.statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});
 });
 it.each(['array','oversized','table','id','processing','missing-id'])('the SQL %s input guard rejects without any retained or raw write',async kind=>{
  await handler()(req(),response());const row=storeCalls[0].args.p_row,before=await all();
  const input=kind==='array'?[]:kind==='oversized'?{...row,raw_payload:{text:'x'.repeat(65537)}}:kind==='id'?{...row,id:'00000000-0000-4000-8000-000000000001'}:kind==='processing'?{...row,processing_status:'processed'}:kind==='missing-id'?{...row,tweet_id:null}:row;
  await expect(sql('select public.retain_ifttt_raw_receipt($1,$2)',[kind==='table'?'players': 'line_source_ifttt_events',JSON.stringify(input)],false)).rejects.toThrow('Invalid bounded');expect(await all()).toEqual(before);
 });
 it.each(['update','delete'])('service role cannot %s the immutable receipt evidence',async operation=>{
  await handler()(req(),response());const before=await all();
  await expect(sql(operation==='update'?"update public.ifttt_raw_receipt_variants set input_row='{}'":"delete from public.ifttt_raw_receipt_variants")).rejects.toThrow('permission denied');expect(await all()).toEqual(before);
 });
 it.each(['anon','authenticated'])('%s cannot call the retention RPC',async role=>{
  await expect(sql(`set role ${role};select public.retain_ifttt_raw_receipt('line_source_ifttt_events','{}')`,[],false)).rejects.toThrow('permission denied');expect(await all()).toEqual({raw:[],ccc:[],archive:[]});
 });
 it('service cannot bypass the bounded gateway with a direct archive INSERT',async()=>{
  await handler()(req(),response());const baseline=(await archive())[0].body,before=await all();
  await expect(sql("insert into public.ifttt_raw_receipt_variants values(gen_random_uuid(),'line_source_ifttt_events',$1,$2,'same_post_variant','{}',encode(sha256(convert_to('{}','UTF8')),'hex'),clock_timestamp(),clock_timestamp())",[baseline.event_id,baseline.receipt_id])).rejects.toThrow('permission denied');expect(await all()).toEqual(before);
 });
 it('flag-off keeps the existing receiver path and does not require the staged relation or RPC',async()=>{
  legacy();const res=response();await handler()(req(),res);
  expect(res.statusCode).toBe(200);expect(res.body.receipt).toBeUndefined();expect(storeCalls[0].options).toEqual({onConflict:'source_key,tweet_id',ignoreDuplicates:true});expect(await archive()).toEqual([]);
 });
 it('legacy raw markers are preserved and uncertain input equivalence is held rather than stripped or overwritten',async()=>{
  legacy();await handler()(req(),response());await sql("update public.line_source_ifttt_events set raw_payload=raw_payload||'{\"tweetClaimShadow\":{\"delivery\":\"not_requested\"}}'::jsonb,processing_status='processed'");const before=await rows();
  enable();const res=response();await handler()(req(),res);
  expect(res.body.receipt).toMatchObject({classification:'same_post_variant',requiresReview:true});expect(await rows()).toEqual(before);expect(await archive()).toHaveLength(2);
 });
 it('a mismatched normal reply is replaced only by exact committed read-only evidence',async()=>{
  const actual=bridge.rpc!;bridge.rpc=async(name,args)=>{const result=await actual(name,args);return name==='retain_bounded_ifttt_raw_receipt'?{...result,data:{...result.data,receipt:{...result.data.receipt,requiresReview:true}}}:result;};
  const res=response();await handler()(req(),res);expect(res.statusCode).toBe(200);expect(res.body.receipt.reconciled).toBe(true);expect(storeCalls.map(c=>c.name)).toEqual(['retain_bounded_ifttt_raw_receipt','reconcile_ifttt_raw_receipt']);expect(await archive()).toHaveLength(1);
 });

 it.each(['exact retry','changed variant'])('independent R19 %s cannot rewrite the canonical raw row in the conflict INSERT trigger',async mode=>{
  await handler()(req(),response());const before=await all();
  await sql("create function public.reviewer_raw_conflict_mutation() returns trigger language plpgsql as $$begin update public.line_source_ifttt_events set received_at=received_at+interval '1 microsecond' where source_key=new.source_key and tweet_id=new.tweet_id;return new;end$$;create trigger reviewer_raw_conflict_mutation before insert on public.line_source_ifttt_events for each row execute function public.reviewer_raw_conflict_mutation()",[],false);
  const res=response();await handler()(req(mode==='exact retry'?body:changed),res);const after=await all();
  writeFileSync(join(__dirname,`evidence/R19-${mode.replaceAll(' ','-')}.json`),JSON.stringify({mode,before,result:{statusCode:res.statusCode,body:res.body},after,storeCalls},null,2)+'\n');
  expect(after.raw,'Retaining a same-key receipt cannot commit an intra-RPC rewrite of the prior canonical raw receipt clock').toEqual(before.raw);
  // A correct implementation may avoid the conflicting INSERT entirely or
  // detect its mutation and roll back; both preserve the same contract.
  if(res.statusCode===500)expect(await archive()).toEqual(before.archive);
  else{
   expect(res.statusCode).toBe(200);
   expect(res.body.receipt.requiresReview).toBe(mode==='changed variant');
   if(mode==='exact retry'){expect(await archive()).toEqual(before.archive);expect(res.body.receipt.id).toBe(before.archive[0].body.receipt_id);}
   else{expect(await archive()).toHaveLength(2);expect(res.body.processingStatus).toBe('held_for_review');}
  }
 });
 it.each(tables)('%s a first-insert raw clock rewrite fails exact prebuilt row postconditions',async table=>{
  await sql(`create function public.fixture_first_clock_rewrite() returns trigger language plpgsql as $$begin new.received_at=new.received_at+interval '1 microsecond';return new;end$$;create trigger fixture_first_clock_rewrite before insert on public.${table} for each row execute function public.fixture_first_clock_rewrite()`,[],false);
  const res=response();await handler(table)(req(),res);expect(res.statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});
 });
 it.each(['exact retry','changed variant'])('CCC R19 %s skips INSERT triggers and preserves every prior raw field',async mode=>{
  await handler('lines_ccc_ifttt_events')(req(),response());const before=await all();
  await sql("create function public.fixture_ccc_conflict_mutation() returns trigger language plpgsql as $$begin update public.lines_ccc_ifttt_events set received_at=received_at+interval '1 microsecond' where tweet_id=new.tweet_id;return new;end$$;create trigger fixture_ccc_conflict_mutation before insert on public.lines_ccc_ifttt_events for each row execute function public.fixture_ccc_conflict_mutation()",[],false);
  const res=response();await handler('lines_ccc_ifttt_events')(req(mode==='exact retry'?body:changed),res);
  expect(res.statusCode).toBe(200);expect((await all()).ccc).toEqual(before.ccc);expect(res.body.receipt.requiresReview).toBe(mode==='changed variant');
 });
 it.each(tables)('%s uncooperative absent-key race rolls back conflict-trigger changes and a fresh request reconciles',async table=>{
  const controller=new Client({host:socket,port:65448,user:'ifttt_receiver_test',database:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:2000});await controller.connect();
  const condition=table==='line_source_ifttt_events'?'source_key=new.source_key and tweet_id=new.tweet_id':'tweet_id=new.tweet_id';
  await sql(`create function public.fixture_absent_key_race() returns trigger language plpgsql as $$begin if new.username='Reporter' then perform pg_advisory_xact_lock(62016,1);update public.${table} set received_at=received_at+interval '1 microsecond' where ${condition};end if;return new;end$$;create trigger fixture_absent_key_race before insert on public.${table} for each row execute function public.fixture_absent_key_race()`,[],false);
  await controller.query('select pg_advisory_lock(62016,1)');const res=response(),pending=handler(table)(req(),res);
  try{
   // This observation proves the RPC read the key as absent and is paused in
   // its BEFORE INSERT trigger; the direct writer does not take the RPC lock.
   await vi.waitFor(async()=>expect(Number((await controller.query("select count(*) n from pg_locks where locktype='advisory' and classid=62016 and objid=1 and objsubid=2 and not granted")).rows[0].n)).toBe(1),{timeout:1200,interval:20});
   const sourceColumns=table==='line_source_ifttt_events'?',source_group,source_key':'',sourceValues=table==='line_source_ifttt_events'?",'fixture','fixture-reporter'":'';
   await sql(`insert into public.${table}(source,source_account,username,text,link_to_tweet,tweet_id,tweet_created_at,created_at_label,processing_status,raw_payload,received_at${sourceColumns}) values('ifttt','Reporter','Competing',$1,$2,'6100',$3::text::timestamptz,$3::text,'pending',$4,$5${sourceValues})`,[changed.text,changed.link_to_tweet,changed.created_at,JSON.stringify(changed),new Date(Date.now()-1000).toISOString()]);
   const competing=await rows(table);expect(competing).toHaveLength(1);
   await controller.query('select pg_advisory_unlock(62016,1)');await pending;
   expect(res.statusCode).toBe(500);expect(await rows(table)).toEqual(competing);expect(await archive()).toEqual([]);
   // The trigger remains installed. The fresh request now sees and locks the
   // existing row, skips INSERT entirely and retains the changed input as held.
   const retry=response();await handler(table)(req(),retry);expect(retry.statusCode).toBe(200);expect(retry.body.receipt.requiresReview).toBe(true);
   expect(await rows(table)).toEqual(competing);expect(await archive()).toHaveLength(2);
   writeFileSync(join(__dirname,`evidence/absent-race-${table}.json`),JSON.stringify({competing,firstResult:{statusCode:res.statusCode,body:res.body},retry:retry.body,after:await all()},null,2)+'\n');
  }finally{await controller.query('select pg_advisory_unlock_all()');await controller.end();await pending;}
 });
 const register=async(overrides:any={})=>{
  policy={...policy,id:'synthetic-'+Math.random().toString(36).slice(2),startsAt:new Date(Date.now()+100).toISOString(),endsAt:new Date(Date.now()+60000).toISOString(),...overrides};
  await sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify(policy)],false);
  await vi.waitFor(async()=>expect((await sql("select clock_timestamp()>=($1::jsonb->>'startsAt')::timestamptz ready",[JSON.stringify(policy)]))[0].ready).toBe(true),{interval:20});enable();return policy;
 };
 const intake=()=>sql('select to_jsonb(p) body from public.ifttt_intake_policies p where policy_id=$1',[policy.id]);
 const admissions=()=>sql('select to_jsonb(r) body from public.ifttt_intake_receipts r where policy_id=$1 order by receipt_id',[policy.id]);
 const invoke=async(input:any=body)=>{const res=response();await handler()(req(input),res);return res;};
 it('operator registration is immutable and service cannot register, reset, widen or resume',async()=>{
  const first=await intake();expect((await sql('select public.register_ifttt_intake_policy($1) p',[JSON.stringify(policy)],false))[0].p).toEqual(first[0].body);
  await expect(sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify({...policy,maxAttempts:2000})],false)).rejects.toThrow('frozen');
  await expect(sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify(policy)])).rejects.toThrow('permission denied');
  await expect(sql('update public.ifttt_intake_policies set attempts=0')).rejects.toThrow('permission denied');
  await expect(sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify({...policy,id:'late-registration',startsAt:'2020-01-01T00:00:00Z'})],false)).rejects.toThrow('future');
  expect(await intake()).toEqual(first);
 });
 it('attempt cap includes exact duplicate deliveries without consuming another receipt slot',async()=>{
  await register({maxAttempts:2,maxReceipts:1});const a=await invoke(),b=await invoke(),c=await invoke();
  expect([a.statusCode,b.statusCode,c.statusCode]).toEqual([200,200,500]);expect(b.body.receipt.id).toBe(a.body.receipt.id);
  expect(await rows()).toHaveLength(1);expect(await archive()).toHaveLength(1);expect(await admissions()).toHaveLength(1);expect((await intake())[0].body.attempts).toBe(2);
 });
 it('a receipt cap rolls back new variants but allows exact admitted retries',async()=>{
  await register({maxAttempts:5,maxReceipts:1});const a=await invoke(),before=await all(),b=await invoke(changed),c=await invoke();
  expect([a.statusCode,b.statusCode,c.statusCode]).toEqual([200,500,200]);expect(c.body.receipt.id).toBe(a.body.receipt.id);expect(await all()).toEqual(before);
  expect((await intake())[0].body.attempts).toBe(3);expect(await admissions()).toHaveLength(1);
 });
 it('a first legacy variant requires both baseline and variant slots atomically',async()=>{
  legacy();await invoke();const before=await all();await register({maxAttempts:3,maxReceipts:1});
  expect((await invoke(changed)).statusCode).toBe(500);expect(await all()).toEqual(before);expect(await admissions()).toEqual([]);expect((await intake())[0].body.attempts).toBe(1);
 });
 it('a two-slot legacy variant preserves the original body and idempotently admits both immutable versions',async()=>{
  legacy();await invoke();const before=await rows();await register({maxAttempts:3,maxReceipts:2});
  const a=await invoke(changed),b=await invoke(changed);expect([a.statusCode,b.statusCode]).toEqual([200,200]);expect(b.body.receipt.id).toBe(a.body.receipt.id);
  expect(await rows()).toEqual(before);expect(await admissions()).toHaveLength(2);expect((await archive()).map(r=>r.body.input_row.raw_payload.text).sort()).toEqual([body.text,changed.text].sort());
 });
 it('concurrent distinct posts cannot exceed either shared budget',async()=>{
  await register({maxAttempts:3,maxReceipts:2});const results=await Promise.all([1,2,3,4,5].map(n=>invoke({...body,link_to_tweet:`https://x.com/Reporter/status/${6100+n}`})));
  expect(results.filter(r=>r.statusCode===200)).toHaveLength(2);expect(await rows()).toHaveLength(2);expect(await archive()).toHaveLength(2);expect(await admissions()).toHaveLength(2);expect((await intake())[0].body.attempts).toBe(3);
 });
 it('lost RPC reply reconciles without another attempt; a later explicit request reuses admission',async()=>{
  await register({maxAttempts:3,maxReceipts:1});loseRpcReply=true;const first=await invoke();expect(first.statusCode).toBe(200);expect(first.body.receipt.reconciled).toBe(true);expect((await intake())[0].body.attempts).toBe(1);const before=await all(),a=await invoke();
  expect(a.statusCode).toBe(200);expect(a.body.receipt.outcome).toBe('duplicate');expect(await all()).toEqual(before);expect(await admissions()).toHaveLength(1);expect((await intake())[0].body.attempts).toBe(2);
 });
 it('an ordinary archive failure consumes attempt headroom and permits one clean later retry',async()=>{
  await register({maxAttempts:2,maxReceipts:1});await sql("create function public.fixture_archive_fail() returns trigger language plpgsql as $$begin raise exception 'injected';end$$;create trigger fixture_archive_fail before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_archive_fail()",[],false);
  expect((await invoke()).statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});expect((await intake())[0].body.attempts).toBe(1);
  await sql('drop trigger fixture_archive_fail on public.ifttt_raw_receipt_variants',[],false);expect((await invoke()).statusCode).toBe(200);expect((await invoke()).statusCode).toBe(500);expect(await admissions()).toHaveLength(1);
 });
 it('server clocks reject not-started and expired policies without charging or retaining',async()=>{
  policy={...policy,id:'future-policy',startsAt:new Date(Date.now()+200).toISOString(),endsAt:new Date(Date.now()+400).toISOString()};
  await sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify(policy)],false);enable();expect((await invoke()).statusCode).toBe(500);expect((await intake())[0].body.attempts).toBe(0);
  await vi.waitFor(async()=>expect((await sql("select clock_timestamp()>=($1::jsonb->>'endsAt')::timestamptz ready",[JSON.stringify(policy)]))[0].ready).toBe(true),{interval:20});
  vi.useFakeTimers();vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));try{expect((await invoke()).statusCode).toBe(500);}finally{vi.useRealTimers();}
  expect((await intake())[0].body.attempts).toBe(0);expect(await rows()).toEqual([]);
 });
 it('expiry during archive work rolls back raw, archive and admissions while charging the attempt',async()=>{
  await register({endsAt:new Date(Date.now()+450).toISOString()});
  await sql("create function public.fixture_slow_archive() returns trigger language plpgsql as $$begin perform pg_sleep(0.5);return new;end$$;create trigger fixture_slow_archive before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_slow_archive()",[],false);
  expect((await invoke()).statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});expect(await admissions()).toEqual([]);expect((await intake())[0].body.attempts).toBe(1);
 });
 it('durable stop is monotonic, repeatable and rejects subsequent intake without quota or evidence changes',async()=>{
  await invoke();const before=await all(),maps=await admissions();const first=(await sql('select public.stop_ifttt_intake_policy($1,$2) p',[policy.id,'synthetic stop']))[0].p;
  expect((await sql('select public.stop_ifttt_intake_policy($1,$2) p',[policy.id,'repeat']))[0].p).toEqual(first);expect((await invoke(changed)).statusCode).toBe(500);expect(await all()).toEqual(before);expect(await admissions()).toEqual(maps);expect((await intake())[0].body.attempts).toBe(1);
  await expect(sql('update public.ifttt_intake_policies set stopped_at=null,stop_reason=null where policy_id=$1',[policy.id],false)).rejects.toThrow('resumed');
 });
 it.each(['missing-policy','mismatch','scope'])('database denies %s even if application preflight is bypassed',async fault=>{
  const res=await invoke(),row=storeCalls[0].args.p_row,before=await all(),p=fault==='missing-policy'?{...policy,id:'unregistered'}:fault==='mismatch'?{...policy,maxAttempts:999}:policy;
  const scope=fault==='scope'?{...scopes[0],sourceKey:'not-approved'}:scopes[0];
  const result=(await sql('select public.retain_bounded_ifttt_raw_receipt($1,$2,$3) r',[JSON.stringify(p),JSON.stringify(scope),JSON.stringify(row)]))[0].r;
  expect(result.status).toBe(fault==='missing-policy'?'missing_policy':fault==='mismatch'?'policy_mismatch':'scope_denied');expect(res.statusCode).toBe(200);expect(await all()).toEqual(before);expect((await intake())[0].body.attempts).toBe(1);
 });
 it.each(['flag-off','bad-policy','stop','scope'])('actual handler %s fails closed without mutation or legacy fallback',async fault=>{
  if(fault==='flag-off')vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','false');
  if(fault==='bad-policy')vi.stubEnv('IFTTT_INTAKE_POLICY','{}');
  if(fault==='stop')vi.stubEnv('IFTTT_INTAKE_STOP','true');
  if(fault==='scope')vi.stubEnv('IFTTT_INTAKE_POLICY',JSON.stringify({...policy,scopes:[{...scopes[0],sourceKey:'other'}]}));
  expect((await invoke()).statusCode).toBe(503);expect(storeCalls).toHaveLength(0);expect(await rows()).toEqual([]);
 });
 it('service cannot bypass the bounded gateway by calling the old core',async()=>{
  await expect(sql("select public.retain_ifttt_raw_receipt('line_source_ifttt_events','{}')")).rejects.toThrow('permission denied');expect(await rows()).toEqual([]);
 });
 it.each(['anon','authenticated'])('%s cannot call bounded retention or stop',async role=>{
  await expect(sql(`set role ${role};select public.retain_bounded_ifttt_raw_receipt('{}','{}','{}')`,[],false)).rejects.toThrow('permission denied');
  await expect(sql(`set role ${role};select public.stop_ifttt_intake_policy('x','stop')`,[],false)).rejects.toThrow('permission denied');
 });
 it('canonical pilot intake never fans out to a processor even if process and capture are enabled',async()=>{
  vi.stubEnv('STARTER_BOARD_CAPTURE_ENABLED','true');const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy);
  try{const request=req();request.query={process:'true'};const res=response();const configured=createLineSourceIftttReceiver({sourceGroup:'fixture',sourceKey:'fixture-reporter',sourceAccount:'Reporter',secretEnvVar:'IFTTT_LOCAL_RECEIVER_FIXTURE_SECRET',processorPath:'/api/v1/db/update-line-sources'});await configured(request,res);expect(res.statusCode).toBe(200);expect(res.body.processor).toBeUndefined();expect(fetchSpy).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}
 });
 it('admission-trigger raw rewrite is caught after the core and rolls back all retained work',async()=>{
  await sql("create function public.fixture_admission_rewrite() returns trigger language plpgsql as $$begin update public.line_source_ifttt_events set received_at=received_at+interval '1 microsecond';return new;end$$;create trigger fixture_admission_rewrite after insert on public.ifttt_intake_receipts for each row execute function public.fixture_admission_rewrite()",[],false);
  expect((await invoke()).statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});expect(await admissions()).toEqual([]);expect((await intake())[0].body.attempts).toBe(1);
  await sql('drop trigger fixture_admission_rewrite on public.ifttt_intake_receipts',[],false);expect((await invoke()).statusCode).toBe(200);
 });
 it('quota-update trigger cannot alter an existing raw row before the core snapshot',async()=>{
  await invoke();const before=await all(),p=await intake();await sql("create function public.fixture_quota_rewrite() returns trigger language plpgsql as $$begin update public.line_source_ifttt_events set received_at=received_at+interval '1 microsecond';return new;end$$;create trigger fixture_quota_rewrite after update on public.ifttt_intake_policies for each row execute function public.fixture_quota_rewrite()",[],false);
  expect((await invoke(changed)).statusCode).toBe(500);expect(await all()).toEqual(before);expect(await intake()).toEqual(p);
 });
 it('complete admission row mismatch rolls back even newly added fixture columns',async()=>{
  await sql("alter table public.ifttt_intake_receipts add column fixture_extra text;create function public.fixture_map_rewrite() returns trigger language plpgsql as $$begin new.fixture_extra='rewritten';return new;end$$;create trigger fixture_map_rewrite before insert on public.ifttt_intake_receipts for each row execute function public.fixture_map_rewrite()",[],false);
  expect((await invoke()).statusCode).toBe(500);expect(await all()).toEqual({raw:[],ccc:[],archive:[]});expect(await admissions()).toEqual([]);expect((await intake())[0].body.attempts).toBe(1);
 });

 it.each(['successful retry','receipt-cap refusal'])('independent R20 %s cannot admit over-budget IDs from a quota UPDATE trigger',async mode=>{
  expect((await invoke()).statusCode).toBe(200);expect((await invoke(changed)).statusCode).toBe(200);
  expect(await archive()).toHaveLength(2);
  await register({maxAttempts:3,maxReceipts:1});
  const before={data:await all(),policy:await intake(),admissions:await admissions()};expect(before.admissions).toEqual([]);
  await sql("create function public.reviewer_counter_admissions() returns trigger language plpgsql as $$begin insert into public.ifttt_intake_receipts(policy_id,receipt_id,admitted_at) select new.policy_id,receipt_id,clock_timestamp() from public.ifttt_raw_receipt_variants;return new;end$$;create trigger reviewer_counter_admissions after update on public.ifttt_intake_policies for each row when(new.attempts>old.attempts) execute function public.reviewer_counter_admissions()",[],false);
  const res=await invoke(mode==='successful retry'?body:{...body,text:'Third synthetic same-post variant.'});
  const after={data:await all(),policy:await intake(),admissions:await admissions()};
  writeFileSync(join(__dirname,`evidence/R20-${mode.replaceAll(' ','-')}.json`),JSON.stringify({mode,policy,before,result:{statusCode:res.statusCode,body:res.body},after,storeCalls},null,2)+'\n');
  expect(after.admissions.length,'The same RPC cannot commit more stable receipt admissions than its explicit maxReceipts, even on a failed retention path').toBeLessThanOrEqual(policy.maxReceipts);
  expect(after.data).toEqual(before.data);
  if(res.statusCode===500)expect(after.admissions).toEqual(before.admissions);
  else{expect(res.statusCode).toBe(200);expect(after.admissions).toHaveLength(1);expect(after.admissions[0].body.receipt_id).toBe(res.body.receipt.id);}
 }); it('R20 even an under-cap injected admission rolls back the complete faulty attempt and recovers cleanly',async()=>{
  await invoke();await register({maxAttempts:3,maxReceipts:2});const before={data:await all(),policy:await intake(),admissions:await admissions()};
  await sql("create function public.fixture_counter_admission() returns trigger language plpgsql as $$begin insert into public.ifttt_intake_receipts(policy_id,receipt_id,admitted_at) select new.policy_id,receipt_id,clock_timestamp() from public.ifttt_raw_receipt_variants;return new;end$$;create trigger fixture_counter_admission after update on public.ifttt_intake_policies for each row when(new.attempts>old.attempts) execute function public.fixture_counter_admission()",[],false);
  expect((await invoke()).statusCode).toBe(500);expect({data:await all(),policy:await intake(),admissions:await admissions()}).toEqual(before);
  await sql('drop trigger fixture_counter_admission on public.ifttt_intake_policies',[],false);expect((await invoke()).statusCode).toBe(200);expect(await admissions()).toHaveLength(1);expect((await intake())[0].body.attempts).toBe(1);
 });
 it('stop cannot silently insert admissions through its own policy UPDATE trigger',async()=>{
  await invoke();await register({maxAttempts:3,maxReceipts:1});const before={data:await all(),policy:await intake(),admissions:await admissions()};
  await sql("create function public.fixture_stop_admission() returns trigger language plpgsql as $$begin insert into public.ifttt_intake_receipts(policy_id,receipt_id,admitted_at) select new.policy_id,receipt_id,clock_timestamp() from public.ifttt_raw_receipt_variants;return new;end$$;create trigger fixture_stop_admission after update on public.ifttt_intake_policies for each row when(new.stopped_at is not null) execute function public.fixture_stop_admission()",[],false);
  await expect(sql('select public.stop_ifttt_intake_policy($1,$2)',[policy.id,'synthetic stop'])).rejects.toThrow('rewrote admissions');expect({data:await all(),policy:await intake(),admissions:await admissions()}).toEqual(before);
  await sql('drop trigger fixture_stop_admission on public.ifttt_intake_policies',[],false);expect((await sql('select public.stop_ifttt_intake_policy($1,$2) p',[policy.id,'synthetic stop']))[0].p.stopped_at).not.toBeNull();expect(await admissions()).toEqual([]);
 });
 it('new owner registration cannot silently inherit admissions from an INSERT trigger',async()=>{
  await invoke();const before=await all();const next={...policy,id:'synthetic-registration-fault',startsAt:new Date(Date.now()+10000).toISOString()};
  await sql("create function public.fixture_register_admission() returns trigger language plpgsql as $$begin insert into public.ifttt_intake_receipts(policy_id,receipt_id,admitted_at) select new.policy_id,receipt_id,clock_timestamp() from public.ifttt_raw_receipt_variants;return new;end$$;create trigger fixture_register_admission after insert on public.ifttt_intake_policies for each row execute function public.fixture_register_admission()",[],false);
  await expect(sql('select public.register_ifttt_intake_policy($1)',[JSON.stringify(next)],false)).rejects.toThrow('already has admissions');expect(await sql('select * from public.ifttt_intake_policies where policy_id=$1',[next.id])).toEqual([]);expect(await sql('select * from public.ifttt_intake_receipts where policy_id=$1',[next.id])).toEqual([]);expect(await all()).toEqual(before);
  await sql('drop trigger fixture_register_admission on public.ifttt_intake_policies',[],false);expect((await sql('select public.register_ifttt_intake_policy($1) p',[JSON.stringify(next)],false))[0].p.attempts).toBe(0);
 });
 const readArgs=()=>storeCalls.find(c=>c.name==='retain_bounded_ifttt_raw_receipt').args;
 const readState=async()=> (await rpcSql('reconcile_ifttt_raw_receipt',readArgs()))[0].receipt;
 it('SQL8 reconciliation is stable/invoker with1s metadata; write has5s hoist metadata; reads do not charge quota',async()=>{
  await invoke();const before={data:await all(),policy:await intake(),maps:await admissions()};
  const functions=await sql("select proname,provolatile,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname in ('retain_bounded_ifttt_raw_receipt','reconcile_ifttt_raw_receipt') order by proname");
  expect(functions[0]).toMatchObject({proname:'reconcile_ifttt_raw_receipt',provolatile:'s',prosecdef:false});expect(functions[0].proconfig).toContain('statement_timeout=1s');expect(functions[1].proconfig).toContain('statement_timeout=5s');
  expect((await readState()).status).toBe('committed');expect((await readState()).status).toBe('committed');expect({data:await all(),policy:await intake(),maps:await admissions()}).toEqual(before);
 });
 it.each(['policy','scope','payload','unadmitted-policy'])('read-only reconciliation holds %s mismatches without mutation',async fault=>{
  await invoke();const input=readArgs();if(fault==='unadmitted-policy'){await register();input.p_policy=policy;}
  const before={data:await all(),policy:await intake(),maps:await admissions()};
  const args={...input,p_policy:fault==='policy'?{...input.p_policy,maxAttempts:999}:input.p_policy,p_scope:fault==='scope'?{...input.p_scope,sourceKey:'other'}:input.p_scope,p_row:fault==='payload'?{...input.p_row,raw_payload:{changed:true}}:input.p_row};
  expect((await rpcSql('reconcile_ifttt_raw_receipt',args))[0].receipt.status).toBe('unresolved');expect({data:await all(),policy:await intake(),maps:await admissions()}).toEqual(before);
 });
 it('already committed held evidence remains readable after stop and expiry without a new admission',async()=>{
  await register({endsAt:new Date(Date.now()+500).toISOString()});await invoke();const a=await invoke(changed);expect(a.statusCode).toBe(200);
  const args=storeCalls.filter(c=>c.name==='retain_bounded_ifttt_raw_receipt').at(-1).args;
  await sql('select public.stop_ifttt_intake_policy($1,$2)',[policy.id,'synthetic stop']);await vi.waitFor(async()=>expect((await sql("select clock_timestamp()>=($1::jsonb->>'endsAt')::timestamptz ready",[JSON.stringify(policy)]))[0].ready).toBe(true),{interval:20});
  const before={data:await all(),policy:await intake(),maps:await admissions()},read=(await rpcSql('reconcile_ifttt_raw_receipt',args))[0].receipt;
  expect(read.status).toBe('committed');expect(read.receipt.receiptId).toBe(a.body.receipt.id);expect(read.receipt.requiresReview).toBe(true);expect({data:await all(),policy:await intake(),maps:await admissions()}).toEqual(before);
 });
 it.each(['anon','authenticated'])('%s cannot execute reconciliation',async role=>{
  await expect(sql(`set role ${role};select public.reconcile_ifttt_raw_receipt('{}','{}','{}')`,[],false)).rejects.toThrow('permission denied');
 });
 it('a real5s pre-query statement deadline cancels retained work and leaves unknown transport outcome rather than a write retry',async()=>{
  await sql("create function public.fixture_statement_sleep() returns trigger language plpgsql as $$begin perform pg_sleep(6);return new;end$$;create trigger fixture_statement_sleep before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_statement_sleep()",[],false);
  const before={data:await all(),policy:await intake(),maps:await admissions()},start=performance.now(),res=await invoke(),elapsed=performance.now()-start;
  const error=JSON.parse(readFileSync(join(__dirname,'evidence/rpc-diagnostic-retain_bounded_ifttt_raw_receipt.json'),'utf8'));
  expect(error.code).toBe('57014');expect(elapsed).toBeGreaterThan(4800);expect(elapsed).toBeLessThan(6500);expect(res.statusCode).toBe(500);expect(res.body.outcome).toBe('unknown');expect(storeCalls.map(c=>c.name)).toEqual(['retain_bounded_ifttt_raw_receipt','reconcile_ifttt_raw_receipt']);expect({data:await all(),policy:await intake(),maps:await admissions()}).toEqual(before);
  writeFileSync(join(__dirname,'evidence/real-prequery-statement-deadline.json'),JSON.stringify({scope:'Actual PostgreSQL; fixture explicitly sets timeout BEFORE main query to model documented PostgREST hoisting, not an actual PostgREST run',elapsed,error,before,after:{data:await all(),policy:await intake(),maps:await admissions()},response:res.body},null,2)+'\n');
 },10000);
 it('negative control: function-only SET does not prove a timer for an already running direct-PG statement',async()=>{
  await sql("alter function public.retain_bounded_ifttt_raw_receipt(jsonb,jsonb,jsonb) set statement_timeout='20ms';create function public.fixture_statement_negative() returns trigger language plpgsql as $$begin perform pg_sleep(0.1);return new;end$$;create trigger fixture_statement_negative before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_statement_negative()",[],false);
  const row={source:'ifttt',source_group:'fixture',source_key:'fixture-reporter',source_account:'Reporter',username:'Reporter',text:body.text,link_to_tweet:body.link_to_tweet,tweet_id:'6100',tweet_embed_code:null,tweet_created_at:body.created_at,created_at_label:body.created_at,processing_status:'pending',raw_payload:body,updated_at:new Date().toISOString()},start=performance.now();
  const result=(await sql('select public.retain_bounded_ifttt_raw_receipt($1,$2,$3) r',[JSON.stringify(policy),JSON.stringify(scopes[0]),JSON.stringify(row)]))[0].r,elapsed=performance.now()-start;
  expect(result.status).toBe('retained');expect(elapsed).toBeGreaterThan(80);writeFileSync(join(__dirname,'evidence/function-setting-negative-control.json'),JSON.stringify({functionSetting:'20ms',topLevelSetting:'0/default fixture connection',elapsed,status:result.status,conclusion:'A function proconfig value alone is not an already-running direct PG statement timer; actual PostgREST hoisting remains a deployed proof gate'},null,2)+'\n');
 });
 it('actual late commit after client deadline is not called rollback; later recovery performs only one read',async()=>{
  const controller=new Client({host:socket,port:65448,user:'ifttt_receiver_test',database:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:2000});await controller.connect();
  await sql("create function public.fixture_late_commit() returns trigger language plpgsql as $$begin perform pg_advisory_xact_lock(62016,2);return new;end$$;create trigger fixture_late_commit before insert on public.ifttt_raw_receipt_variants for each row execute function public.fixture_late_commit()",[],false);await controller.query('select pg_advisory_lock(62016,2)');
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});const res=response(),pending=handler()(req(),res);
  try{
   await vi.waitFor(async()=>expect(Number((await controller.query("select count(*) n from pg_locks where locktype='advisory' and classid=62016 and objid=2 and objsubid=2 and not granted")).rows[0].n)).toBe(1),{timeout:1000,interval:20});
   await vi.advanceTimersByTimeAsync(6001);await pending;expect(res.statusCode).toBe(500);expect(res.body.outcome).toBe('unknown');expect(await rows()).toEqual([]);
   await controller.query('select pg_advisory_unlock(62016,2)');await vi.waitFor(async()=>expect(await archive()).toHaveLength(1),{timeout:1000,interval:20});
   const before={data:await all(),policy:await intake(),maps:await admissions()},input=readArgs();
   const recovered=await reconcileIftttRawReceipt({db:fixtureSupabase as any,table:'line_source_ifttt_events',scope:input.p_scope,policy:input.p_policy,row:input.p_row});
   expect(recovered).toMatchObject({reconciled:true,id:before.maps[0].body.receipt_id});expect(storeCalls.map(c=>c.name)).toEqual(['retain_bounded_ifttt_raw_receipt','reconcile_ifttt_raw_receipt','reconcile_ifttt_raw_receipt']);expect({data:await all(),policy:await intake(),maps:await admissions()}).toEqual(before);
   writeFileSync(join(__dirname,'evidence/actual-late-commit-read-only-recovery.json'),JSON.stringify({firstResponse:res.body,readbackBeforeRecovery:before,recovered,after:{data:await all(),policy:await intake(),maps:await admissions()},calls:storeCalls.map(c=>c.name),scope:'Fake client timer with observed actual PG in-flight lock; fixture transport intentionally ignores abort. Original DB transaction later committed; no write retry.'},null,2)+'\n');
  }finally{vi.useRealTimers();await controller.query('select pg_advisory_unlock_all()');await controller.end();await pending;}
 });

});

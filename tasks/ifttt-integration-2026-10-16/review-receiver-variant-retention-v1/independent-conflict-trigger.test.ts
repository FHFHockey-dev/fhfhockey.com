// @vitest-environment node
import {execFile} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
const {Client}=createRequire(join(__dirname,'../../../web/package.json'))('pg') as typeof import('pg');
const bridge=vi.hoisted(()=>({store:null as null|((table:string,row:any,options?:any)=>Promise<any>),rpc:null as null|((name:string,args:any)=>Promise<any>)}));
vi.mock('lib/supabase/server',()=>({default:{rpc:(name:string,args:any)=>bridge.rpc!(name,args),from:(table:string)=>({insert:(row:any)=>bridge.store!(table,row),upsert:(row:any,options:any)=>bridge.store!(table,row,options)})}}));
import {createLineSourceIftttReceiver} from 'lib/sources/lineSourceIftttReceiver';

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))('variant-aware receiver with actual raw/archive RPC storage',()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};
 for(const key of Object.keys(env))if(key.startsWith('PG'))delete env[key];
 let root:string,socket:string,started=false,loseRpcReply=false,storageFailure=false;
 let gate:Promise<void>|null=null;const storeCalls:any[]=[];
 const tables=['line_source_ifttt_events','lines_ccc_ifttt_events'] as const;
 const sql=async(text:string,values:any[]=[],role=true)=>{
  const c=new Client({host:socket,port:65448,user:'ifttt_receiver_test',database:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:2000});
  await c.connect();try{if(role)await c.query('set role service_role');return (await c.query(text,values)).rows;}finally{await c.end();}
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
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','true');vi.stubEnv('IFTTT_LOCAL_RECEIVER_FIXTURE_SECRET','synthetic-local-secret');vi.stubEnv('STARTER_BOARD_CAPTURE_ENABLED','false');
  loseRpcReply=false;storageFailure=false;gate=null;storeCalls.length=0;
  await sql('drop schema public cascade;create schema public;grant usage on schema public to service_role',[],false);
  const baseline=readFileSync(join(__dirname,'dependency-snapshot/supabase/migrations/20260716112908_production_schema_baseline.sql'),'utf8');
  for(const table of tables){
   const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))![0];
   const unique=baseline.match(new RegExp(`CREATE UNIQUE INDEX [^;]+ ON public\\.${table} [^;]+;`))![0];
   await sql(ddl+unique+`;alter table public.${table} add primary key(id);alter table public.${table} enable row level security;grant select,insert,update on public.${table} to service_role`,[],false);
  }
  await sql(readFileSync(join(__dirname,'supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql'),'utf8'),[],false);
  bridge.rpc=async(name,args)=>{
   if(name!=='retain_ifttt_raw_receipt')throw new Error('Unexpected receiver RPC');
   storeCalls.push({name,args});if(gate)await gate;
   if(storageFailure)return {error:{message:'synthetic storage unavailable'},data:null};
   let receipt:any;
   try { receipt=(await sql('select public.retain_ifttt_raw_receipt($1,$2) receipt',[args.p_table,JSON.stringify(args.p_row)]))[0].receipt; }
   catch(error:any){writeFileSync(join(__dirname,'evidence/rpc-diagnostic-error.json'),JSON.stringify({message:error.message,code:error.code,where:error.where},null,2)+'\n');throw error;}
   if(loseRpcReply){loseRpcReply=false;return {error:{message:'synthetic committed RPC reply lost'},data:null};}
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
 it.each(tables)('%s committed storage reply loss returns500; exact-key retry preserves one immutable retained row',async table=>{
  loseRpcReply=true;const first=response();await handler(table)(req(),first);expect(first.statusCode).toBe(500);const committed=await rows(table);expect(committed).toHaveLength(1);
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
 it('missing post identity preserves separate text-only receipts rather than deduplicating by text',async()=>{
  const input={...body,link_to_tweet:undefined};delete input.link_to_tweet;
  await handler()(req(input),response());await handler()(req(input),response());const retained=await rows();expect(retained).toHaveLength(2);expect(retained.every(row=>row.body.tweet_id===null)).toBe(true);
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
 it('a variant commit with lost RPC reply is retained and an exact retry returns its same held identity',async()=>{
  await handler()(req(),response());loseRpcReply=true;const first=response();await handler()(req(changed),first);
  expect(first.statusCode).toBe(500);const committed=await all(),retry=response();await handler()(req(changed),retry);
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
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','false');await handler()(req(),response());await sql("update public.line_source_ifttt_events set processing_status='processed'");const before=await all();
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','true');
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
  await expect(sql('select public.retain_ifttt_raw_receipt($1,$2)',[kind==='table'?'players': 'line_source_ifttt_events',JSON.stringify(input)])).rejects.toThrow('Invalid bounded');expect(await all()).toEqual(before);
 });
 it.each(['update','delete'])('service role cannot %s the immutable receipt evidence',async operation=>{
  await handler()(req(),response());const before=await all();
  await expect(sql(operation==='update'?"update public.ifttt_raw_receipt_variants set input_row='{}'":"delete from public.ifttt_raw_receipt_variants")).rejects.toThrow('permission denied');expect(await all()).toEqual(before);
 });
 it.each(['anon','authenticated'])('%s cannot call the retention RPC',async role=>{
  await expect(sql(`set role ${role};select public.retain_ifttt_raw_receipt('line_source_ifttt_events','{}')`,[],false)).rejects.toThrow('permission denied');expect(await all()).toEqual({raw:[],ccc:[],archive:[]});
 });
 it('a permitted direct INSERT cannot invent a variant without source binding and its canonical baseline',async()=>{
  await handler()(req(),response());const baseline=(await archive())[0].body,before=await all();
  await expect(sql("insert into public.ifttt_raw_receipt_variants values(gen_random_uuid(),'line_source_ifttt_events',$1,$2,'same_post_variant','{}',encode(sha256(convert_to('{}','UTF8')),'hex'),clock_timestamp(),clock_timestamp())",[baseline.event_id,baseline.receipt_id])).rejects.toThrow('identity or clock mismatch');expect(await all()).toEqual(before);
 });
 it('flag-off keeps the existing receiver path and does not require the staged relation or RPC',async()=>{
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','false');const res=response();await handler()(req(),res);
  expect(res.statusCode).toBe(200);expect(res.body.receipt).toBeUndefined();expect(storeCalls[0].options).toEqual({onConflict:'source_key,tweet_id',ignoreDuplicates:true});expect(await archive()).toEqual([]);
 });
 it('legacy raw markers are preserved and uncertain input equivalence is held rather than stripped or overwritten',async()=>{
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','false');await handler()(req(),response());await sql("update public.line_source_ifttt_events set raw_payload=raw_payload||'{\"tweetClaimShadow\":{\"delivery\":\"not_requested\"}}'::jsonb,processing_status='processed'");const before=await rows();
  vi.stubEnv('IFTTT_RECEIPT_VARIANTS_ENABLED','true');const res=response();await handler()(req(),res);
  expect(res.body.receipt).toMatchObject({classification:'same_post_variant',requiresReview:true});expect(await rows()).toEqual(before);expect(await archive()).toHaveLength(2);
 });
 it('a mismatched normal RPC response fails closed without another mutation or processor request',async()=>{
  const actual=bridge.rpc!;bridge.rpc=async(name,args)=>{const result=await actual(name,args);return {...result,data:{...result.data,requiresReview:true}};};
  const res=response();await handler()(req(),res);expect(res.statusCode).toBe(500);expect(storeCalls).toHaveLength(1);expect(await archive()).toHaveLength(1);
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
});

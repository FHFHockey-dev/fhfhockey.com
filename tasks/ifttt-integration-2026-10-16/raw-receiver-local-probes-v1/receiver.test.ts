// @vitest-environment node
import {execFile} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
const {Client}=createRequire(join(__dirname,'../../../web/package.json'))('pg') as typeof import('pg');
const bridge=vi.hoisted(()=>({store:null as null|((table:string,row:any,options?:any)=>Promise<any>)}));
vi.mock('lib/supabase/server',()=>({default:{from:(table:string)=>({insert:(row:any)=>bridge.store!(table,row),upsert:(row:any,options:any)=>bridge.store!(table,row,options)})}}));
import {createLineSourceIftttReceiver} from 'lib/sources/lineSourceIftttReceiver';

describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))('unchanged receiver and actual raw schemas with a local SQL adapter',()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};
 for(const key of Object.keys(env))if(key.startsWith('PG'))delete env[key];
 let root:string,socket:string,started=false,loseCommitReply=false,storageFailure=false;
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
  await sql('create role service_role bypassrls',[],false);
 },20000);
 beforeEach(async()=>{
  vi.stubEnv('IFTTT_LOCAL_RECEIVER_FIXTURE_SECRET','synthetic-local-secret');vi.stubEnv('STARTER_BOARD_CAPTURE_ENABLED','false');
  loseCommitReply=false;storageFailure=false;gate=null;storeCalls.length=0;
  await sql('drop schema public cascade;create schema public;grant usage on schema public to service_role',[],false);
  const baseline=readFileSync(join(__dirname,'snapshot/supabase/migrations/20260716112908_production_schema_baseline.sql'),'utf8');
  for(const table of tables){
   const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))![0];
   const unique=baseline.match(new RegExp(`CREATE UNIQUE INDEX [^;]+ ON public\\.${table} [^;]+;`))![0];
   await sql(ddl+unique+`;alter table public.${table} add primary key(id);alter table public.${table} enable row level security;grant select,insert,update on public.${table} to service_role`,[],false);
  }
  bridge.store=async(table,row,options)=>{
   if(!tables.includes(table as any))throw new Error('Unexpected local receiver table');
   storeCalls.push({table,row,options});if(gate)await gate;
   if(storageFailure)return {error:{message:'synthetic storage unavailable'}};
   const entries=Object.entries(row),ident=(key:string)=>{if(!/^[a-z_]+$/.test(key))throw new Error('Unexpected column');return `"${key}"`;};
   const expectedConflict=table==='line_source_ifttt_events'?'source_key,tweet_id':'tweet_id';
   if(options&&(options.onConflict!==expectedConflict||options.ignoreDuplicates!==true))throw new Error('Unmodeled PostgREST option');
   await sql(`insert into public.${table}(${entries.map(([key])=>ident(key)).join(',')}) values(${entries.map((_,i)=>`$${i+1}`).join(',')})${options?` on conflict(${expectedConflict}) do nothing`:''}`,entries.map(([key,value])=>key==='raw_payload'?JSON.stringify(value):value));
   if(loseCommitReply){loseCommitReply=false;return {error:{message:'synthetic committed storage reply lost'}};}
   return {error:null};
  };
 });
 afterAll(async()=>{bridge.store=null;vi.unstubAllEnvs();if(started)await exec(join(bin,'pg_ctl'),['-D',join(root,'data'),'-w','-t','10','stop','-m','fast'],{env});if(root)rmSync(root,{recursive:true,force:true});});
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
  loseCommitReply=true;const first=response();await handler(table)(req(),first);expect(first.statusCode).toBe(500);const committed=await rows(table);expect(committed).toHaveLength(1);
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
 it('characterizes same-key changed-body loss: success retains the first body, without archiving the new variant',async()=>{
  await handler()(req(),response());const first=await rows();const changed={...body,text:'Player will play tomorrow.'},res=response();await handler()(req(changed),res);
  const after=await rows();expect(res.statusCode).toBe(200);expect(after).toEqual(first);expect(after[0].body.raw_payload).not.toEqual(changed);
  writeFileSync(join(__dirname,'evidence/same-key-variant-boundary.json'),JSON.stringify({first,changedRequest:changed,result:res.body,after,scope:'Unchanged local handler + explicit SQL adapter, not hosted PostgREST'},null,2)+'\n');
 });
 it('missing post identity preserves separate text-only receipts rather than deduplicating by text',async()=>{
  const input={...body,link_to_tweet:undefined};delete input.link_to_tweet;
  await handler()(req(input),response());await handler()(req(input),response());const retained=await rows();expect(retained).toHaveLength(2);expect(retained.every(row=>row.body.tweet_id===null)).toBe(true);
 });
});

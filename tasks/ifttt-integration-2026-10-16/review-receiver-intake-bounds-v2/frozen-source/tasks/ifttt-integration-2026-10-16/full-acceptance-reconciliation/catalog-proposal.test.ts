// @vitest-environment node
import {execFile} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from "node:fs";
import {createRequire} from "node:module";
import {join} from "node:path";
import {promisify} from "node:util";
import {afterAll,beforeAll,beforeEach,describe,expect,it} from "vitest";
const {Client}=createRequire(join(__dirname,"../../../web/package.json"))("pg") as typeof import("pg");
const proposal=readFileSync(join(__dirname,"catalog-prerequisites-proposal.sql"),"utf8"),names=[...proposal.matchAll(/\('([a-z_]+)'\)/g)].map(m=>m[1]!);
describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("unexecuted hosted proposal tested only on private PG",()=>{
 const exec=promisify(execFile),bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};for(const k of Object.keys(env))if(k.startsWith("PG"))delete env[k];
 let root:string,socket:string,started=false;
 const sql=async(text:string)=>{const db=new Client({host:socket,port:65444,user:"ifttt_catalog_test",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});
  await db.connect();try{return await db.query(text);}finally{await db.end();}};
 const read=async()=>{const result:any=await sql(proposal);return result.find((r:any)=>r.rows?.[0]?.evidence).rows[0].evidence;};
 beforeAll(async()=>{
  root=mkdtempSync(join("/tmp","fhf-ifttt-cat-"));socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
  await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_catalog_test"],{env});
  await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65444`,"start"],{env});started=true;
  await sql("create role service_role;create role anon;create role authenticated");
 },20000);
 beforeEach(async()=>{
  expect(new Set(names).size).toBe(23);await sql("drop schema public cascade;create schema public;create table fixture_audit(id int)");
  for(const name of names)await sql(`create table public.${name}(id bigint primary key,payload text);insert into public.${name} values(1,'SEALED_PRIVATE_FIXTURE_VALUE')`);
  for(const name of ["capture_starter_board_lineup","capture_starter_board_goalies","enqueue_player_forecast_job","claim_tweet_pipeline_job","append_line_decisions"])
   await sql(`create function public.${name}() returns int language plpgsql as $$begin insert into fixture_audit values(1);return 1;end$$`);
 });
 afterAll(async()=>{if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});if(root)rmSync(root,{recursive:true,force:true});});
 it("returns bounded catalog fingerprints without stored values, bodies or invoking write helpers",async()=>{
  const e=await read();expect(e.guard).toBeNull();expect(e.data).toMatchObject({relationCount:23,missingCount:0,functionCount:5});
  expect(Buffer.byteLength(JSON.stringify(e))).toBeLessThanOrEqual(8192);
  expect(JSON.stringify(e)).not.toContain("SEALED_PRIVATE_FIXTURE_VALUE");expect(JSON.stringify(e)).not.toContain("insert into fixture_audit");
  for(const r of e.data.relations)expect(r.shapeHash).toMatch(/^[a-f0-9]{32}$/);
  expect((await sql("select count(*)::int n from fixture_audit")).rows).toEqual([{n:0}]);
 });
 it("reports an absent prerequisite without inferring compatible or empty history",async()=>{
  await sql("drop table public.line_source_captures");const e=await read();expect(e.guard).toBeNull();expect(e.data.missingCount).toBe(1);
  expect(e.data.relations.find((r:any)=>r.name==="line_source_captures").exists).toBe(false);
 });
 it("withholds payload when the named function overload bound is exceeded",async()=>{
  for(let i=1;i<=17;i++)await sql(`create function public.claim_tweet_pipeline_job(${Array.from({length:i},(_,n)=>`arg${n} integer`).join(",")}) returns int language sql as 'select 1'`);
  const e=await read();expect(e.guard).toBe("size_or_function_limit");expect(e.functionCount).toBe(22);expect(e.data).toBeUndefined();
 });
 it("withholds oversized catalog payload while remaining inside the function-count bound",async()=>{
  await sql(`create function public.capture_starter_board_lineup(${Array.from({length:100},(_,n)=>`very_long_catalog_only_parameter_name_${String(n).padStart(3,"0")}_abcdefghijkl integer`).join(",")}) returns int language sql as 'select 1'`);
  const e=await read();expect(e.guard).toBe("size_or_function_limit");expect(e.functionCount).toBe(6);expect(e.dataBytes).toBeGreaterThan(7900);expect(e.data).toBeUndefined();
  expect(Buffer.byteLength(JSON.stringify(e))).toBeLessThanOrEqual(8192);
 });
});

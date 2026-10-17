// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtempSync,mkdirSync,readFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Client } from "../../../web/node_modules/pg";
import { afterAll,beforeAll,describe,expect,it } from "../../../web/node_modules/vitest";

const exec=promisify(execFile),relations=readFileSync(join(__dirname,"schema-relations.sql"),"utf8"),objects=readFileSync(join(__dirname,"schema-objects.sql"),"utf8");
const presence=readFileSync(join(__dirname,"schema-presence-v2.sql"),"utf8");
describe.runIf(Boolean(process.env.IFTTT_POSTGRES_BIN))("proposed catalog reads on private disposable storage",()=>{
  const bin=process.env.IFTTT_POSTGRES_BIN!,env={...process.env};
  for(const key of Object.keys(env))if(key.startsWith("PG"))delete env[key];
  let root:string,socket:string,started=false;
  const sql=async(text:string)=>{const c=new Client({host:socket,port:65439,user:"ifttt_test",database:"postgres",password:"",ssl:false,options:"",connectionTimeoutMillis:2000});await c.connect();try{return await c.query(text);}finally{await c.end();}};
  const read=async(text:string)=>{const results:any=await sql(text);return results.find((r:any)=>r.rows?.[0]?.evidence)?.rows[0].evidence;};
  const names=[...relations.matchAll(/\('([^']+)'\)/g)].map(m=>m[1]!);
  beforeAll(async()=>{
    root=mkdtempSync(join(tmpdir(),"fhfh-ifttt-metadata-pg-"));socket=join(root,"socket");mkdirSync(socket,{mode:0o700});
    await exec(join(bin,"initdb"),["-D",join(root,"data"),"--no-locale","--encoding=UTF8","--auth-local=trust","--auth-host=reject","-U","ifttt_test"],{env});
    await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-l",join(root,"server.log"),"-w","-t","10","-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65439`,"start"],{env});started=true;
    expect(names).toHaveLength(20);
    await sql("create role anon;create role authenticated;create role service_role;create table fixture_audit(id int);");
    for(const name of names)await sql(`create table public.${name}(id bigint primary key,payload text);insert into public.${name} values(1,'VERY_PRIVATE_FIXTURE_PAYLOAD');`);
    for(const name of ["capture_starter_board_goalies","capture_starter_board_lineup","enqueue_player_forecast_job","append_line_decisions","claim_tweet_pipeline_job"])
      await sql(`create function public.${name}() returns int language plpgsql as $$ begin insert into fixture_audit values(1); return 1; end $$;`);
  },20000);
  afterAll(async()=>{if(started)await exec(join(bin,"pg_ctl"),["-D",join(root,"data"),"-w","-t","10","stop","-m","fast"],{env});if(root)rmSync(root,{recursive:true,force:true});});
  it("returns bounded catalog metadata without reading values or invoking SELECT write helpers",async()=>{
    for(const text of [relations,objects]){
      const evidence=await read(text);expect(evidence.guard).toBeNull();expect(Buffer.byteLength(JSON.stringify(evidence))).toBeLessThanOrEqual(24576);
      expect(JSON.stringify(evidence)).not.toContain("VERY_PRIVATE_FIXTURE_PAYLOAD");expect(JSON.stringify(evidence)).not.toContain("insert into fixture_audit");
    }
    const result:any=await sql("select count(*)::int n from fixture_audit");expect(result.rows).toEqual([{n:0}]);
  });
  it("returns only a guard when relation columns exceed the finite bound",async()=>{
    for(let i=0;i<65;i++)await sql(`alter table line_source_ifttt_events add column fixture_${i} text`);
    const evidence=await read(relations);expect(evidence.guard).toBe("size_or_column_limit");expect(evidence.data).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(evidence))).toBeLessThanOrEqual(24576);
  });
  it("returns only a guard when catalog objects exceed the finite bound",async()=>{
    for(let i=0;i<70;i++)await sql(`create index fixture_${i} on line_source_ifttt_events(id)`);
    const evidence=await read(objects);expect(evidence.guard).toBe("size_or_row_limit");expect(evidence.data).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(evidence))).toBeLessThanOrEqual(24576);
  });
  it("identifies five missing allowlisted relations within 8 KiB despite wide schemas, without values or helper calls",async()=>{
    const missing=names.slice(-5);
    for(const name of missing)await sql(`drop table public.${name}`);
    const evidence=await read(presence);
    expect(evidence.guard).toBeNull();expect(evidence.data.rowCount).toBe(20);expect(evidence.data.missingCount).toBe(5);
    expect(evidence.data.records.filter((r:any)=>!r.exists).map((r:any)=>r.name).sort()).toEqual([...missing].sort());
    expect(Buffer.byteLength(JSON.stringify(evidence))).toBeLessThanOrEqual(8192);
    expect(JSON.stringify(evidence)).not.toContain("VERY_PRIVATE_FIXTURE_PAYLOAD");
    expect(JSON.stringify(evidence)).not.toContain("insert into fixture_audit");
    const result:any=await sql("select count(*)::int n from fixture_audit");expect(result.rows).toEqual([{n:0}]);
    console.log("presence-v2-local-bytes",Buffer.byteLength(JSON.stringify(evidence)),"sql-reported-dataBytes",evidence.dataBytes);
  });
});

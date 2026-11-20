#!/usr/bin/env python3
"""Disposable Unix-socket-only PostgreSQL 15 proof, with local Storage metadata stubs."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from hashlib import sha256
from base64 import b64encode
import json
import os
from pathlib import Path
import subprocess
import tempfile
from threading import Barrier
from time import monotonic, sleep
from uuid import uuid4
from importlib.util import module_from_spec, spec_from_file_location

import psycopg2

spec = spec_from_file_location("context_test",Path(__file__).with_name("blsh_request_context_custody.py"))
context = module_from_spec(spec)
spec.loader.exec_module(context)
sql, rpc, refused = context.sql,context.rpc,context.refused
DAY="2026-11-21"
CLOCK="2026-11-22T12:45:05.000Z"
DEP="dpl_fixture"
GIT="f"*40
IDS=[2026020301,2026020302]
SCHEDULE=sha256(b"schedule").hexdigest()

def exercise(socket):
    def connect(role):
        con=psycopg2.connect(host=socket,port=5432,dbname="postgres",user=role)
        con.autocommit=True
        return con
    with closing(connect("postgres")) as admin:
        sql(admin,"""create role anon login; create role authenticated login; create role service_role bypassrls login;
            create role custody_owner login; grant create,usage on schema public to custody_owner;
            create schema storage authorization custody_owner;""")
    with closing(connect("custody_owner")) as own, closing(connect("service_role")) as svc:
        sql(own,"""alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
            alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
            create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
            create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
            alter table storage.objects enable row level security;
            grant usage on schema storage to anon,authenticated,service_role;
            grant all on storage.objects, storage.buckets to service_role;
            grant select,insert on storage.objects to anon,authenticated;
            create policy other_storage on storage.objects for all using(true) with check(true);""")
        for name in ["20261116000000_blsh_native_capture_v6.sql","20261118131414_blsh_request_context_custody.sql","20261118155445_blsh_official_pilot.sql",
                     "20261120143000_blsh_official_pilot_redate_20261121.sql"]:
            sql(own,(context.MIGRATIONS/name).read_text())
        def storage(path,size,bucket):
            sql(own,"insert into storage.objects values(%s,%s,jsonb_build_object('size',%s))",(bucket,path,size))
        def native(day,count=20,commit=GIT):
            rid=str(uuid4())
            sql(own,"""insert into public.blsh_capture_runs(run_id,pipeline,source_date,state,deployment,manifest_sha256,closed_at)
                values(%s,'native-v6',%s,'packet_complete_pending_review',%s,%s,'2026-11-22 12:10:00Z')""",
                (rid,day,json.dumps(dict(deploymentId=DEP,gitCommitSha=commit)),context.H))
            for i,name in enumerate(context.NATIVE[:count],1):
                path=f"native-v6/{day}/{rid}/{name}"
                storage(path,1,"blsh-native-packets")
                sql(own,"insert into blsh_capture_objects(run_id,ordinal,path,bytes,sha256) values(%s,%s,%s,1,%s)",(rid,i,path,SCHEDULE if i==6 else context.H))
            return [day,rid,context.H,DEP,GIT,SCHEDULE,IDS]
        claim=lambda conn,pins: rpc(conn,"blsh_official_claim_v1",*pins)
        # Change a test-only clock row from a separate transaction while the RPC is blocked.
        sql(own,"create table official_fixture_clock(at_utc timestamptz not null); revoke all on official_fixture_clock from public,anon,authenticated,service_role")
        sql(own,"insert into official_fixture_clock values (%s)",(CLOCK,))
        sql(own,"""create or replace function public.blsh_official_clock_v1() returns timestamptz language sql volatile set search_path='' as $$
            select at_utc from public.official_fixture_clock $$""")
        def clock(at):
            sql(own,"update public.official_fixture_clock set at_utc=%s",(at,))
        clock(CLOCK)
        def blocked_write(operation, table, after, error=None, *, after_write=False, uncommitted_claim=None):
            # An owner-only trigger barrier also exercises the final check after DML.
            with closing(connect("custody_owner")) as blocker, ThreadPoolExecutor(max_workers=1) as pool:
                if after_write:
                    sql(own,"""create function public.official_fixture_wait() returns trigger language plpgsql as $$
                        begin perform pg_advisory_xact_lock(112145); return new; end $$""")
                    sql(own,f"create trigger official_fixture_wait after insert or update on public.{table} for each row execute function public.official_fixture_wait()")
                sql(blocker,"begin")
                if uncommitted_claim is not None: assert claim(blocker,uncommitted_claim)["claimed"]
                elif after_write: sql(blocker,"select pg_advisory_xact_lock(112145)")
                else: sql(blocker,f"lock table public.{table} in share mode")
                future=pool.submit(operation)
                try:
                    until=monotonic()+4
                    while not sql(own,"select %s=any(pg_blocking_pids(%s))",(blocker.get_backend_pid(),svc.get_backend_pid())):
                        assert monotonic()<until,"waiting RPC did not reach its lock"
                        sleep(.01)
                    clock(after)
                finally:
                    sql(blocker,"rollback" if uncommitted_claim is not None else "commit")
                try:
                    if error is None: return future.result()
                    refused(future.result,error)
                finally:
                    if after_write:
                        sql(own,f"drop trigger official_fixture_wait on public.{table}; drop function public.official_fixture_wait()")
                    clock(CLOCK)
        # Exercise exceptional sources without consuming the single pilot date.
        sql(own,"begin");short=native(DAY,count=19)
        refused(lambda:claim(own,short),"context_native_index_or_storage_invalid")
        sql(own,"rollback")
        sql(own,"begin");nullable=native(DAY,commit=None)
        assert claim(own,nullable)["claimed"]
        sql(own,"rollback")
        pins=native(DAY)
        for at in ["2026-11-22T12:44:59.999999Z","2026-11-22T12:46:00.000000Z","2026-11-21T12:45:05.000Z"]:  # last: retired slot
            clock(at)
            refused(lambda:claim(svc,pins),"official_claim_outside_slot")
        clock(CLOCK)
        for k,wrong,reason in [(0,"2026-11-22","official_binding_invalid"),(0,"2026-11-20","official_binding_invalid"),(3,"other","official_native_binding"),(4,"1"*40,"official_native_binding"),(5,"0"*64,"official_native_binding"),(6,IDS[::-1],"official_binding_invalid"),(6,[IDS[0],IDS[0]],"official_binding_invalid")]:
            bad=pins.copy();bad[k]=wrong
            refused(lambda:claim(svc,bad),reason)
        for after_write in (False,True):
            blocked_write(lambda:claim(svc,pins),"blsh_official_runs","2026-11-22T12:46:00.000001Z","official_claim_outside_slot",after_write=after_write)
            assert sql(own,"select count(*) from blsh_official_runs")==0
        blocked_write(lambda:claim(svc,pins),"blsh_official_runs","2026-11-22T12:46:00.000001Z","official_claim_outside_slot",uncommitted_claim=pins)
        assert sql(own,"select count(*) from blsh_official_runs")==0
        later="2026-11-22T12:45:06.000Z"
        sql(svc,"begin")
        acknowledged=blocked_write(lambda:claim(svc,pins),"blsh_official_runs",later)
        assert sql(svc,"select claimed_at=%s::timestamptz from blsh_official_runs where run_id=%s",(later,acknowledged["runId"]))
        sql(svc,"rollback")
        barrier=Barrier(4)
        def race(_):
            with closing(connect("service_role")) as c:
                barrier.wait()
                return claim(c,pins)
        with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(race,range(4)))
        winners=[r for r in results if r["claimed"]]
        assert len(winners)==1 and results.count({"claimed":False})==3
        run=winners[0]["runId"]; prefix=f"official-v1/{pins[0]}/{run}/"
        print("PASS exact native 20/20, schedule/deployment pins, sorted slate, four concurrent claims")
        for role in ["anon","authenticated"]:
            with closing(connect(role)) as c:
                refused(lambda:claim(c,pins),"permission denied")
                refused(lambda:sql(c,"select * from public.blsh_official_objects"),"permission denied")
                refused(lambda:sql(c,"select body from public.blsh_official_originals"),"permission denied")
        for tab in ["blsh_official_runs","blsh_official_objects","blsh_official_originals"]:
            for perm in ["INSERT","UPDATE","DELETE","TRUNCATE"]:
                assert sql(own,"select has_table_privilege('service_role',%s,%s)",(tab,perm)) is False
            refused(lambda:sql(svc,"delete from "+tab),"permission denied")
        refused(lambda:sql(svc,"select public.blsh_official_clock_v1()"),"permission denied")
        sql(svc,"begin")
        assert rpc(svc,"blsh_official_close_v1",run,"failed","lost_ack",None,None)
        assert claim(svc,pins)=={"claimed":False}
        sql(svc,"rollback")
        files=[]
        def txt(obj):return json.dumps(obj,separators=(",",":"))
        def put(n,name,body):
            path=prefix+name;digest=sha256(body.encode()).hexdigest()
            assert rpc(svc,"blsh_official_object_v1",run,n,path,len(body.encode()),digest,b64encode(body.encode()).decode())
            files.append(dict(file=name,bytes=len(body.encode()),sha256=digest))
            return digest
        approval=dict(runId=run,sourceDate=DAY,nativeRunId=pins[1],nativeManifestSHA256=context.H,deploymentId=DEP,gitCommitSha=GIT,scheduleSHA256=SCHEDULE,gameIds=IDS)
        grant=b'{"synthetic":true}'; grant_hash=sha256(grant).hexdigest()
        runtime=dict(**approval,version="fhfh.blsh.official-pilot-runtime.v1",region="iad1",acquisitionClass="vercel_direct_https",startedAtUTC=CLOCK,grantBase64=b64encode(grant).decode(),acquisitionPinsSHA256=grant_hash)
        refused(lambda:put(1,"RUNTIME.json",txt(dict(runtime,gameIds=IDS[::-1]))),"official_runtime_binding")
        put(1,"RUNTIME.json",txt(runtime))
        refused(lambda:sql(own,"update blsh_official_originals set body=%s where run_id=%s",(b"replaced",run)),"official_ledger_immutable")
        refused(lambda:sql(own,"truncate blsh_official_originals cascade"),"official_ledger_immutable")
        refused(lambda:sql(own,"update blsh_official_runs set native_manifest_sha256=%s where run_id=%s",("0"*64,run)),"official_run_immutable")
        refused(lambda:rpc(svc,"blsh_official_object_v1",run,3,prefix+"x",1,context.H,None),"official_object_order")
        for i,g in enumerate(IDS,1):
            url=f"https://api-web.nhle.com/v1/gamecenter/{g}/boxscore"
            journal=dict(operation=i,method="GET",url=url,acquisitionPinsSHA256=grant_hash,startedAtUTC=CLOCK)
            jpath=prefix+f"operation-{i}-STARTED.json"
            bad=txt(dict(journal,url=url+"?widen"))
            refused(lambda:rpc(svc,"blsh_official_object_v1",run,3*i-1,jpath,len(bad),sha256(bad.encode()).hexdigest(),b64encode(bad.encode()).decode()),"official_intent_scope")
            if i==1:
                good=txt(journal)
                def intent():
                    return rpc(svc,"blsh_official_object_v1",run,2,jpath,len(good),sha256(good.encode()).hexdigest(),b64encode(good.encode()).decode())
                for table,after_write in [("blsh_official_originals",False),("blsh_official_objects",False),("blsh_official_objects",True)]:
                    blocked_write(intent,table,"2026-11-22T12:47:05.000001Z","official_acquisition_deadline",after_write=after_write)
                    for name in ["blsh_official_objects","blsh_official_originals"]:
                        assert sql(own,"select count(*) from "+name+" where run_id=%s and ordinal=2",(run,))==0
                blocked_write(intent,"blsh_official_objects","2026-11-22T12:45:20.000Z","official_intent_deadline")
                sql(svc,"begin")
                assert blocked_write(intent,"blsh_official_originals",later)
                assert sql(svc,"select written_at=%s::timestamptz from blsh_official_objects where run_id=%s and ordinal=2",(later,run))
                sql(svc,"rollback")
            put(3*i-1,jpath.removeprefix(prefix),txt(journal))
            assert sql(svc,"select array[game_ordinal::text,game_id::text,intent_url] from blsh_official_objects where path=%s",(jpath,))==[str(i),str(g),url]
            refused(lambda:rpc(svc,"blsh_official_object_v1",run,3*i-1,jpath,len(bad),sha256(bad.encode()).hexdigest(),b64encode(bad.encode()).decode()),"official_object_order")
            box='{"id":%d}'%g
            if i==1:
                box=box.ljust(4194304)
                assert (4*((len(box)+2)//3))==5592408
            put(3*i,f"boxscore-{g}.body.json",box)
            assert bytes(sql(svc,"select body from blsh_official_originals where run_id=%s and ordinal=%s",(run,3*i)))==box.encode()
            put(3*i+1,f"boxscore-{g}.receipt.json",'{"version":"fixture"}')
        manifest_obj=dict(**approval,version="fhfh.blsh.official-pilot-manifest.v1",status="acquisition_complete_pending_review",acquisitionPinsSHA256=grant_hash,requests=len(IDS),retries=0,completedAtUTC=CLOCK,files=list(files))
        manifest=txt(manifest_obj)
        def close(state,reason=None,h=None,text=None):
            return rpc(svc,"blsh_official_close_v1",run,state,reason,h,text)
        for override,reason in [({"gameIds":IDS[::-1]},"official_terminal_binding"),
                ({"nativeManifestSHA256":"0"*64},"official_terminal_binding"),({"files":files[:-1]},"official_manifest_index_mismatch")]:
            sql(svc,"begin")
            wrong=txt(dict(manifest_obj,**override)); wrongh=put(8,"MANIFEST.json",wrong)
            refused(lambda:close("packet_complete_pending_review",None,wrongh,wrong),reason)
            sql(svc,"rollback");files.pop()
        digest=put(8,"MANIFEST.json",manifest)
        refused(lambda:close("packet_complete_pending_review",None,"0"*64,manifest),"official_manifest_digest")
        clock("2026-11-22T12:47:05.000001Z")
        refused(lambda:close("packet_complete_pending_review",None,digest,manifest),"official_terminal_binding")
        clock(CLOCK)
        for after_write in (False,True):
            blocked_write(lambda:close("packet_complete_pending_review",None,digest,manifest),"blsh_official_runs",
                "2026-11-22T12:47:05.000001Z","official_terminal_binding",after_write=after_write)
            assert sql(own,"select state from blsh_official_runs where run_id=%s",(run,))=="claimed"
        sql(svc,"begin")
        assert blocked_write(lambda:close("packet_complete_pending_review",None,digest,manifest),"blsh_official_runs",later)
        assert sql(svc,"select closed_at=%s::timestamptz from blsh_official_runs where run_id=%s",(later,run))
        sql(svc,"rollback")
        print("PASS PostgreSQL table, uncommitted-claim and post-write waits, expiry rollback, actual transition times")
        assert close("packet_complete_pending_review",None,digest,manifest)
        refused(lambda:close("failed","operator_failure"),"query returned no rows")
        assert sql(svc,"select manifest_sha256 from blsh_official_runs where run_id=%s",(run,))==digest
        assert bytes(sql(svc,"select body from blsh_official_originals where run_id=%s and ordinal=8",(run,)))==manifest.encode()
        assert claim(svc,pins)=={"claimed":False}
        print("PASS durable journal, 4 MiB binary readback, resealed manifest refusal, terminal readback and role/owner mutation controls")

def main():
    for k in tuple(os.environ):
        if k.startswith(("PG","SUPABASE")) or k in ("DATABASE_URL","DB_HOST","DB_PORT"): del os.environ[k]
    with tempfile.TemporaryDirectory(prefix="blsh-off-",dir="/tmp") as root:
        pg=context.PG;data=Path(root)/"data";env={"PATH":str(pg)+":/usr/bin:/bin","HOME":root,"LC_ALL":"C"}
        subprocess.run([pg/"initdb","-D",data,"-U","postgres","-A","trust","--no-locale","-E","UTF8","--no-sync"],env=env,check=True,capture_output=True)
        subprocess.run([pg/"pg_ctl","-D",data,"-l",Path(root)/"log","-o",f"-k {root} -p 5432 -c listen_addresses=''","-w","start"],env=env,check=True,capture_output=True)
        try: exercise(root)
        finally: subprocess.run([pg/"pg_ctl","-D",data,"-m","immediate","-w","stop"],env=env,check=True,capture_output=True)
if __name__=="__main__": main()

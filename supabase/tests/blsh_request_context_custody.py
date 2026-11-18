#!/usr/bin/env python3
"""Offline PostgreSQL proof, stubbed Storage metadata. Needs local PostgreSQL 15 and psycopg2.
Run from the repository root with /opt/anaconda3/bin/python3 -I -B supabase/tests/blsh_request_context_custody.py.
Creates a private Unix-socket-only cluster; no inherited database configuration is used.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from hashlib import sha256
import json
import os
from pathlib import Path
import subprocess
import tempfile
from threading import Barrier
from uuid import uuid4

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
MIGRATIONS = ROOT / "supabase/migrations"
NATIVE = """STARTED.json PLAN.json RUNTIME.json operation-1-STARTED.json operation-1-SETTLED.json schedule.raw.json
schedule.TRANSPORT-OBSERVATION.json operation-2-STARTED.json operation-2-SETTLED.json operation-3-STARTED.json
operation-3-SETTLED.json individual.parser-input.html individual.TRANSPORT-OBSERVATION.json operation-4-STARTED.json
operation-4-SETTLED.json operation-5-STARTED.json operation-5-SETTLED.json onIce.parser-input.html onIce.TRANSPORT-OBSERVATION.json MANIFEST.json""".split()
FILES = "DB-CONTEXT.json RAW-wgo.json RAW-individual.json RAW-onIce.json RAW-calendar.json CURRENT-REQUEST.json RESULT.json MANIFEST.json".split()
BUCKET = "blsh-request-context"
H = sha256(b"native-manifest").hexdigest()


def sql(db, query, params=None):
    with db.cursor() as c:
        c.execute(query, params)
        return c.fetchone()[0] if c.description else None


def rpc(db, name, *args):
    return sql(db, f"select public.{name}({','.join(['%s'] * len(args))})", args)


def refused(action, why):
    try:
        action()
    except psycopg2.Error as e:
        assert why in str(e), (why, e)
        return
    raise AssertionError(f"accepted despite {why}")


def exercise(socket):
    def connect(role):
        con = psycopg2.connect(host=socket, port=5432, dbname="postgres", user=role)
        con.autocommit = True
        return con

    with closing(connect("postgres")) as admin:
        sql(admin, """create role anon login; create role authenticated login; create role service_role bypassrls login;
           create role custody_owner login nosuperuser; grant create,usage on schema public to custody_owner;
           create schema storage authorization custody_owner;""")
    with closing(connect("custody_owner")) as own, closing(connect("service_role")) as svc:
        sql(own, """alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
          alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
          create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
          create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
          alter table storage.objects enable row level security;
          grant usage on schema storage to anon,authenticated,service_role;
          grant select,insert on storage.objects to anon,authenticated,service_role;
          create policy fixture_other_open_storage on storage.objects for all to public using(true) with check(true);""")
        sql(own, (MIGRATIONS / "20261116000000_blsh_native_capture_v6.sql").read_text())
        sql(own, (MIGRATIONS / "20261118131414_blsh_request_context_custody.sql").read_text())
        assert sql(own, "select array[public::text,file_size_limit::text,allowed_mime_types[1]] from storage.buckets where id=%s", (BUCKET,)) == ["false","33554432","application/json"]
        assert sql(own, "select file_size_limit from storage.buckets where id='blsh-native-packets'") == 2621440

        def storage(path, size, bucket=BUCKET):
            sql(own, "insert into storage.objects values (%s,%s,jsonb_build_object('size',%s::integer))", (bucket,path,size))

        def native(day, *, state="packet_complete_pending_review", count=20, pruned=False, wrong=None):
            native_id = str(uuid4())
            sql(own, """insert into blsh_capture_runs(run_id,pipeline,source_date,state,manifest_sha256,reason,closed_at,pruned_at)
                values(%s,'native-v6',%s,%s,%s,%s,now(),case when %s then now() end)""",
                (native_id,day,state,H if state == "packet_complete_pending_review" else None,None if state == "packet_complete_pending_review" else "failure",pruned))
            for i,name in enumerate(NATIVE[:count],1):
                path = f"native-v6/{day}/{native_id}/{name if wrong != i else 'unexpected.json'}"
                storage(path,1,"blsh-native-packets")
                sql(own, "insert into blsh_capture_objects(run_id,ordinal,path,sha256,bytes) values(%s,%s,%s,%s,1)", (native_id,i,path,H))
            return day,native_id,H

        pins = native("2026-12-01")
        def source(args): return rpc(svc, "blsh_context_source_v1", *args)
        trace = source(pins)
        assert trace["sourceDate"] == pins[0] and trace["nativeRunId"] == pins[1] and trace["nativeManifestSHA256"] == H
        assert [(r["ordinal"],r["path"].split("/")[-1]) for r in trace["objects"]] == list(enumerate(NATIVE,1))
        for bad in [(pins[0],str(uuid4()),H),(pins[0],pins[1],"f"*64),("2027-01-01",pins[1],H),
                    native("2026-12-02",state="failed"),native("2026-12-03",pruned=True)]:
            refused(lambda: source(bad), "query returned no rows")
        for bad in [native("2026-12-04",count=19),native("2026-12-05",wrong=8)]:
            refused(lambda: rpc(svc,"blsh_context_claim_v1",*bad), "context_native_index_or_storage_invalid")
        bad = native("2026-12-06")
        sql(own,"delete from storage.objects where bucket_id='blsh-native-packets' and name=%s", (f"native-v6/{bad[0]}/{bad[1]}/{NATIVE[0]}",))
        refused(lambda: source(bad), "context_native_index_or_storage_invalid")
        print("PASS native tuple, closed state, pruning, 20 ordinals, paths, sizes and physical Storage metadata")

        for role in ("anon","authenticated"):
            with closing(connect(role)) as client:
                refused(lambda: rpc(client,"blsh_context_source_v1",*pins),"permission denied")
                refused(lambda: rpc(client,"blsh_context_claim_v1",*pins),"permission denied")
                refused(lambda: rpc(client,"blsh_context_object_v1",pins[1],1,"x",H,1),"permission denied")
                refused(lambda: rpc(client,"blsh_context_close_v1",pins[1],"failed","error",None,None),"permission denied")
                refused(lambda: sql(client,"select count(*) from blsh_context_runs"),"permission denied")
                refused(lambda: sql(client,"insert into storage.objects values(%s,%s,'{}')",(BUCKET,role)),"row-level security")
        for table in ("blsh_context_objects","blsh_context_runs"):
            for op in ("delete from ","truncate "):
                refused(lambda: sql(svc,op+table),"permission denied")
        print("PASS default grants stripped; broad Storage policy cannot admit client reads/writes to context objects")

        def race_claim(scope):
            start = Barrier(2)
            def claim(_):
                with closing(connect("service_role")) as con:
                    start.wait(timeout=10)
                    return rpc(con, "blsh_context_claim_v1", *scope)
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(claim, range(2)))
            assert sorted(r["claimed"] for r in results) == [False, True]
            return next(r["runId"] for r in results if r["claimed"])
        run = race_claim(pins)
        for day in range(1, 8):
            race_claim(native(f"2027-01-{day:02d}"))
        print("PASS eight simultaneous claim races yield one winner per date across both unique indexes")

        def key(scope, run_id, file): return f"request-context-v1/{scope[0]}/{run_id}/{file}"
        def record(run_id,i,path,digest,length): return rpc(svc,"blsh_context_object_v1",run_id,i,path,digest,length)
        def finish(run_id,state="packet_complete_pending_review",reason=None,digest=None,body=None):
            return rpc(svc,"blsh_context_close_v1",run_id,state,reason,digest,body)
        p = key(pins,run,FILES[0])
        refused(lambda: record(run,2,p,H,1),"context_object_scope_or_bounds")
        refused(lambda: record(run,1,p,H,8388609),"context_object_scope_or_bounds")
        refused(lambda: record(run,1,p.replace("request-context-v1","native-v6"),H,1),"context_object_scope_or_bounds")
        refused(lambda: record(run,1,p,H,1),"context_storage_size_mismatch")
        refused(lambda: record(pins[1],1,p,H,1),"query returned no rows")
        def stage(scope,run_id,duplicate=False,wrong_file=False):
            entries = []
            for i,name in enumerate(FILES[:-1],1):
                body = ("fixture:"+name).encode()
                digest = sha256(body).hexdigest(); path = key(scope,run_id,name)
                storage(path,len(body))
                assert record(run_id,i,path,digest,len(body)) is True
                entries.append({"file":name,"bytes":len(body),"sha256":digest})
            if wrong_file:
                entries[0]["bytes"] += 1
            manifest = json.dumps(dict(version="fhfh.blsh.request-context-manifest.v1",runId=run_id,sourceDate=scope[0],nativeRunId=scope[1],nativeManifestSHA256=scope[2],files=entries))
            if duplicate: manifest = manifest.replace('"runId":', '"runId":"wrong","runId":')
            digest = sha256(manifest.encode()).hexdigest(); path = key(scope,run_id,FILES[-1])
            storage(path,len(manifest.encode()))
            assert record(run_id,8,path,digest,len(manifest.encode())) is True
            return digest,manifest
        digest,body = stage(pins,run)
        refused(lambda: record(run,8,key(pins,run,FILES[-1]),digest,len(body)),"context_object_scope_or_bounds")
        refused(lambda: finish(run,digest="e"*64,body=body),"context_manifest_digest")
        with closing(connect("anon")) as anon:
            assert sql(anon,"select count(*) from storage.objects where bucket_id=%s",(BUCKET,)) == 0
        assert finish(run,digest=digest,body=body) is True
        refused(lambda: finish(run,"failed","failure"),"query returned no rows")
        assert rpc(svc,"blsh_context_claim_v1",*pins) == {"claimed":False}
        refused(lambda: sql(own,"update blsh_context_runs set reason='failure' where run_id=%s",(run,)),"context_run_immutable")
        refused(lambda: sql(own,"delete from blsh_context_objects where run_id=%s",(run,)),"context_ledger_immutable")
        refused(lambda: sql(own,"truncate blsh_context_objects"),"context_ledger_immutable")
        print("PASS exact eight-object manifest close, duplicate-index/refinalization/reclaim refused, immutable history")

        pins2 = native("2026-12-07"); run2 = rpc(svc,"blsh_context_claim_v1",*pins2)["runId"]
        d2,b2 = stage(pins2,run2,duplicate=True)
        refused(lambda: finish(run2,digest=d2,body=b2),"context_manifest_index_mismatch")
        assert finish(run2,"failed","context_write_unacknowledged") is True
        assert sql(svc,"select count(*) from blsh_context_objects where run_id=%s",(run2,)) == 8
        assert sql(svc,"select state from blsh_context_runs where run_id=%s",(run2,)) == "failed"
        print("PASS ambiguous manifest rejected; failure after manifest preserves all objects and remains terminal")

        pins3 = native("2026-12-08"); run3 = rpc(svc,"blsh_context_claim_v1",*pins3)["runId"]
        for i,megabytes in enumerate([8,16,16,16,8],1):
            path = key(pins3,run3,FILES[i-1]); size=megabytes*1024*1024
            storage(path,size); assert record(run3,i,path,H,size) is True
        refused(lambda: record(run3,6,key(pins3,run3,FILES[5]),H,1),"context_object_scope_or_bounds")
        print("PASS per-object and aggregate byte limits, including RPC body beyond the native bucket limit")

        broken = native("2026-12-09"); broken_id = rpc(svc,"blsh_context_claim_v1",*broken)["runId"]
        d,b = stage(broken,broken_id,wrong_file=True)
        refused(lambda: finish(broken_id,digest=d,body=b),"context_manifest_index_mismatch")
        sql(own,"update storage.objects set metadata=jsonb_build_object('size',999) where bucket_id=%s and name=%s",
            (BUCKET,key(broken,broken_id,FILES[0])))
        refused(lambda: finish(broken_id,digest=d,body=b),"context_index_or_storage_changed")
        print("PASS closing rechecks stored objects and all seven manifest file records after indexing")

        # Exercise the unmodified native retention RPC while request-context bytes exist in their own bucket.
        older = sql(own,"select (current_date - 46)::text")
        before_prune = native(older); linked = rpc(svc,"blsh_context_claim_v1",*before_prune)["runId"]
        digest,body = stage(before_prune,linked)
        refused(lambda: rpc(own,"blsh_capture_mark_pruned_v1",before_prune[1]),"bytes must be deleted")
        sql(own,"delete from storage.objects where bucket_id='blsh-native-packets' and split_part(name,'/',3)=%s",(before_prune[1],))
        assert rpc(own,"blsh_capture_mark_pruned_v1",before_prune[1]) is True
        refused(lambda: finish(linked,digest=digest,body=body),"query returned no rows")
        assert finish(linked,"failed","context_source_pruned") is True
        assert sql(svc,"select count(*) from blsh_context_objects where run_id=%s",(linked,)) == 8
        print("PASS native retention cannot delete context objects; pruned native source invalidates a pending success close")


def main():
    # Explicitly discard even libpq service-file and hostaddr settings before connecting.
    for k in tuple(os.environ):
        if k.startswith("PG") or k.startswith("SUPABASE") or k in ("DATABASE_URL","DB_HOST","DB_PORT"):
            del os.environ[k]
    with tempfile.TemporaryDirectory(prefix="blsh-ctx-",dir="/tmp") as root:
        data = Path(root)/"data"
        env = {"PATH":str(PG)+":/usr/bin:/bin","LC_ALL":"C","HOME":root}
        subprocess.run([PG/"initdb","-D",data,"-U","postgres","-A","trust","--no-locale","-E","UTF8","--no-sync"],
                       env=env,check=True,capture_output=True)
        subprocess.run([PG/"pg_ctl","-D",data,"-l",Path(root)/"log","-o",f"-k {root} -p 5432 -c listen_addresses=''","-w","start"],
                       env=env,check=True,capture_output=True)
        try:
            exercise(root)
        finally:
            subprocess.run([PG/"pg_ctl","-D",data,"-m","immediate","-w","stop"],env=env,check=True,capture_output=True)
    print("RESULT OK")


if __name__ == "__main__":
    main()

"""Exercise both migrations through independent psql sessions in a disposable, socket-only PG17 cluster."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Barrier
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PG = Path(os.environ.get("RANKINGS_TEST_PG_BIN", "/opt/homebrew/opt/postgresql@17/bin"))
MIGRATIONS = ROOT / "supabase/migrations"


def exercise(socket):
    def sql(query, role="service_role"):
        run = subprocess.run([PG / "psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-h", socket,
                              "-p", "55432", "-U", "postgres", "-d", "postgres"],
                             input=f"set role {role};\n{query}", text=True, capture_output=True)
        if run.returncode:
            raise RuntimeError(run.stderr.strip())
        return run.stdout.strip()

    sql("create role anon; create role authenticated; create role service_role bypassrls", "postgres")
    sql("""create table entity_metric_rankings (entity_type text,season_id int,snapshot_date date,
        strength_state text,peer_group_type text,peer_group_key text,window_type text,window_size int);
        create table skater_composite_ratings (season_id int,snapshot_date date,window_type text,window_size int,
        strength_state text,peer_group_type text,peer_group_key text);
        grant select,insert on entity_metric_rankings,skater_composite_ratings to service_role;""", "postgres")
    for file in ("20261115210000_ranking_publications.sql", "20261118160000_rankings_daily_dispatch.sql"):
        sql((MIGRATIONS / file).read_text(), "postgres")

    for role in ("anon", "authenticated"):
        assert sql("""select not has_function_privilege('public.claim_ranking_publication_dispatch(integer,date,text,boolean,date[])','execute')
            and not has_function_privilege('public.record_ranking_publication_dispatch(uuid,text,text,text,jsonb)','execute')
            and not has_function_privilege('public.latest_ranking_publication_cutoff(integer,date)','execute')
            and not has_function_privilege('public.reconcile_ranking_publication_dispatch(uuid,text,timestamptz,text,jsonb)','execute')
            and not has_table_privilege('public.ranking_publication_dispatches','select');""", role) == "t"
    assert sql("select not has_table_privilege('public.ranking_publication_dispatches','delete')") == "t"
    print("PASS service role only")

    def claim(date, mode="scheduled", protect=True, dates=None):
        dates = [date] if dates is None else dates
        array = "array[" + ",".join(f"'{d}'" if d else "null" for d in dates) + "]::date[]"
        return json.loads(sql(f"select claim_ranking_publication_dispatch(20262027,'{date}','{mode}',{str(protect).lower()},{array})"))

    def record(id, status, stage="run", evidence="{}"):
        return sql(f"select record_ranking_publication_dispatch('{id}','{stage}','{status}','test','{evidence}')")

    assert claim("2024-11-01")["outcome"] == "protected"
    assert claim("2024-11-01")["outcome"] == "duplicate"
    sql("""insert into ranking_publications (surface, season_id,snapshot_date,strength_state,window_type,window_size,
        peer_group_type,peer_group_key,min_gp,min_toi_seconds,methodology_version,status,expected_rows,db_written_rows,
        expected_entities,written_entities,started_at,completed_at)
      select surface,20262027,d,'5v5',w,n,'all_skaters','all',1,300,'fixture','complete',2,2,2,2,
        d + (case when surface='entity_metric_rankings' then interval '1 hour' else interval '3 hours' end),
        d + (case when surface='entity_metric_rankings' then interval '2 hours' else interval '4 hours' end)
      from (values ('entity_metric_rankings','season',0), ('entity_metric_rankings','last_5',5),
                   ('entity_metric_rankings','last_10',10), ('entity_metric_rankings','last_20',20),
                   ('skater_composite_ratings','season',0)) w(surface,w,n)
      cross join (values (date '2024-11-02'),(date '2024-11-03'),(date '2024-11-04')) dates(d);
      update ranking_publications set completed_at=snapshot_date+interval '6 hours'
       where snapshot_date='2024-11-03' and window_type='last_20';
      update ranking_publications set expected_entities=1,written_entities=1
       where snapshot_date='2024-11-04' and window_type='last_20';""")
    assert sql("select latest_ranking_publication_cutoff(20262027)") == "2024-11-02"
    assert sql("select latest_ranking_publication_cutoff(20262027, '2024-10-31') is null") == "t"
    assert sql("select latest_ranking_publication_cutoff(20262027, '2024-11-02')") == "2024-11-02"
    assert claim("2024-11-02")["outcome"] == "protected"
    assert claim("2024-11-02","manual_rankings",True,["2024-11-06","2024-11-02"])["outcome"] == "protected"
    assert claim("2024-11-06","manual_composites",True,[None])["outcome"] == "protected"
    print("PASS five-marker chronology, equal population, as-of bound and served-cutoff protection")

    sql("""insert into entity_metric_rankings values
      ('skater',20262027,'2024-11-20','5v5','all_skaters','all','last_5',5),
      ('skater',20262027,'2024-11-22','5v5','position','D','season',0);
      insert into skater_composite_ratings values
      (20262027,'2024-11-21','season',0,'5v5','all_skaters','all_skaters'),
      (20262027,'2024-11-22','last_5',5,'5v5','all_skaters','all_skaters');""")
    for target in ("2024-11-03","2024-11-04","2024-11-20","2024-11-21"):
        stale = claim(target)
        assert stale["outcome"] == "protected" and "physical rows" in stale["reason"]
        assert claim(target)["outcome"] == "duplicate"
    independent = claim("2024-11-22")
    assert independent["outcome"] == "claimed"
    record(independent["id"], "blocked")
    print("PASS orphaned ranking, physical composite and marker-only candidates consume the day; other keys remain independent")

    barrier = Barrier(8)
    def race(_):
        barrier.wait()
        return claim("2024-11-05")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(race, range(8)))
    assert sorted(r["outcome"] for r in results) == ["claimed"] + ["duplicate"] * 7
    owner = next(r for r in results if r["outcome"] == "claimed")
    assert owner["priorCutoff"] == "2024-11-02"
    assert claim("2024-11-06")["outcome"] == "busy"
    assert claim("2024-11-06")["outcome"] == "duplicate"
    assert claim("2024-11-07","manual_rankings",False)["outcome"] == "busy"
    record(owner["id"], "running", "ready", '{"readyAt":"2024-11-06T10:00:00Z","sourceDigest":"abc","cohortCount":2}')
    record(owner["id"], "complete", "readback", '{"served":"2024-11-05"}')
    assert sql("""select (finished_at is not null and prior_cutoff='2024-11-02' and reason='test'
        and evidence->>'sourceDigest'='abc' and evidence->>'cohortCount'='2'
        and evidence->>'served'='2024-11-05' and jsonb_array_length(events)=2)
        from ranking_publication_dispatches where target_date='2024-11-05'""") == "t"
    assert claim("2024-11-05", "manual_rankings")["outcome"] == "protected"
    print("PASS eight concurrent claims, cross-date/cross-mode single flight, consumed busy day and terminal receipt")

    manual = claim("2024-11-02", "manual_composites", False)
    assert manual["outcome"] == "claimed"
    assert claim("2024-11-07")["outcome"] == "busy"
    record(manual["id"], "ambiguous", "transport")
    sql("update ranking_publication_dispatches set updated_at='2000-01-01' where status='ambiguous'", "postgres")
    assert claim("2024-11-08")["outcome"] == "busy"
    try:
        record(manual["id"], "complete")
    except RuntimeError as error:
        assert "no longer has an active claim" in str(error)
    else:
        raise AssertionError("ambiguous claim accepted a late completion")
    print("PASS inactive cadence permits manual writes, ambiguous owner never expires or self-releases")

    def reconcile(id, prev, updated, outcome, witness):
        return sql(f"select reconcile_ranking_publication_dispatch('{id}','{prev}','{updated}','{outcome}','{json.dumps(witness)}')")
    def denied(action, needle):
        try:
            action()
        except RuntimeError as error:
            assert needle in str(error), str(error)
        else:
            raise AssertionError("unsafe recovery was accepted")

    proof = {"operator":"fixture-operator","receipt":"offline physical-key reconciliation","writerQuiescent":True,"databaseQuiescent":True}
    updated = sql(f"select updated_at from ranking_publication_dispatches where id='{manual['id']}'")
    denied(lambda: reconcile(manual["id"], "ambiguous", updated, "failed", {}), "attestations")
    denied(lambda: reconcile(manual["id"], "ambiguous", "1990-01-01", "failed", proof), "Claim changed")
    reconcile(manual["id"], "ambiguous", updated, "failed", proof)
    denied(lambda: reconcile(manual["id"], "ambiguous", updated, "failed", proof), "Claim changed")
    stranded = claim("2024-11-09")
    assert stranded["outcome"] == "claimed"
    updated = sql(f"select updated_at from ranking_publication_dispatches where id='{stranded['id']}'")
    reconcile(stranded["id"], "running", updated, "failed", proof)
    assert claim("2024-11-09")["outcome"] == "duplicate"
    assert sql(f"select evidence->'reconciliation'->>'receipt' from ranking_publication_dispatches where id='{stranded['id']}'") == proof["receipt"]
    print("PASS operator evidence and compare-and-set release; stale/repeated calls refuse, history and single-use D survive")



if __name__ == "__main__":
    with TemporaryDirectory(prefix="ranking-ledger-") as work:
        root = Path(work)
        data = root / "data"
        subprocess.run([PG / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-locale"],
                       check=True, stdout=subprocess.DEVNULL)
        subprocess.run([PG / "pg_ctl", "-D", data, "-l", root/"server.log", "-o",
                        f"-c listen_addresses='' -k {root} -p 55432", "-w", "start"],
                       check=True, stdout=subprocess.DEVNULL)
        try:
            exercise(root)
        finally:
            subprocess.run([PG / "pg_ctl", "-D", data, "-w", "stop"], check=True, stdout=subprocess.DEVNULL)

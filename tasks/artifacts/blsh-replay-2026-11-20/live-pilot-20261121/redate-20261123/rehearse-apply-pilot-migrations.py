#!/usr/bin/env python3
"""Disposable PostgreSQL 15 rehearsal of apply-pilot-migrations.sh (approval line 2). Never touches a hosted database:
the server listens on a unix socket only (listen_addresses=''), no PG* variable is inherited, HOME is the temp dir,
FHFH_ENV_FILE=/dev/null makes pgpool.sh refuse if it were ever reached, and every script run is checked to carry a
PSQL_CMD aimed at the temp socket. Stubs come from pg15-validate.py; the four released BLSH migrations are read from
commit Y. The ledger stub supabase_migrations.schema_migrations is seeded with every Y migration version up to
20261121205959 except 20261120143000 (hosted ledger shape: max 20261121205959, 20261120143000 absent).
Runs as the local superuser (hosted postgres is not one)."""
from hashlib import sha256
from pathlib import Path
import importlib.util
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
SCRIPT = HERE / "apply-pilot-migrations.sh"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
Y = "1efdfb4364dffa73a9c249f382dbfebe22ebbbd2"
V1, V2, PIN = "20261120143000", "20261121210000", "20261121205959"
F1 = f"supabase/migrations/{V1}_blsh_official_pilot_redate_20261121.sql"
F2 = f"supabase/migrations/{V2}_blsh_official_pilot_redate_20261122.sql"
PRE = "tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/redate-20261123/PRECHECK-READONLY.sql"
FIRST = "apply_20261120143000_first|CHECK ((source_date = '2026-11-20'::date))|5893416fdcb334659cefb8e6873da4b88426f91bfda92bcf1b81cfbb86fba2c1|0"
READY = "ready_to_apply|CHECK ((source_date = '2026-11-21'::date))|4efee291f95cab0c761c3b88e423131a2d13d87956daf593fbcc9be05bf61f4d|0"
DONE = "already_redated|CHECK ((source_date = '2026-11-22'::date))|03a29fd4ecff446f593cd561a5f6fc0ee4a47b6548e804f6be951c8915311855|0"
GIT_ENV = {"PATH": "/usr/bin:/bin:/opt/homebrew/bin", "HOME": "/nonexistent", "LC_ALL": "C",
           "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"}
results = []


def check(label, ok, detail=""):
    results.append(("PASS " if ok else "FAIL ") + label + ("" if ok else f" [{detail}]"))
    print(results[-1], flush=True)
    if not ok:
        raise AssertionError(label + " " + str(detail))


def git_blob(path, repo=REPO, commit=Y):
    return subprocess.run(["git", "--no-replace-objects", "-C", str(repo), "cat-file", "blob", f"{commit}:{path}"],
                          env=GIT_ENV, check=True, capture_output=True).stdout


def main():
    script_sha = sha256(SCRIPT.read_bytes()).hexdigest()
    print(f"script {SCRIPT.name} sha256 {script_sha}")
    spec = importlib.util.spec_from_file_location("v", HERE / "pg15-validate.py")
    v = importlib.util.module_from_spec(spec); spec.loader.exec_module(v)
    with tempfile.TemporaryDirectory(prefix="bpm-", dir="/tmp") as root:
        env = {"PATH": str(PG) + ":/usr/bin:/bin", "LC_ALL": "C", "HOME": root}
        data = Path(root) / "data"
        pg = lambda *a: subprocess.run(a, env=env, check=True, capture_output=True, timeout=60)
        pg(PG / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "--no-sync")
        pg(PG / "pg_ctl", "-D", data, "-l", Path(root) / "log", "-o", f"-k {root} -c listen_addresses='' -c fsync=off", "-w", "start")
        try:
            run(root, env, v)
        finally:
            pg(PG / "pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")
    check("script bytes unchanged during the rehearsal", sha256(SCRIPT.read_bytes()).hexdigest() == script_sha)
    print(f"ALL {len(results)} CHECKS PASSED (script sha256 {script_sha})")


def run(root, env, v):
    def sql(db, statement):
        r = subprocess.run([PG / "psql", "-XAtq", "-h", root, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"],
                           input=statement, env=env, text=True, capture_output=True, timeout=60)
        assert r.returncode == 0, r.stderr
        return r.stdout.strip()

    precheck_sql = git_blob(PRE).decode()
    state = lambda db: (sql(db, precheck_sql), sql(db, "select string_agg(version || ':' || coalesce(name, ''), ',' order by version) from supabase_migrations.schema_migrations"))
    rows = lambda db: sql(db, f"select count(*) filter (where version='{V1}') || '|' || count(*) filter (where version='{V2}') || '|' || max(version) from supabase_migrations.schema_migrations")

    # Template: released schema (the four original BLSH migrations from Y) + ledger stub at the hosted max.
    sql("postgres", "create database old")
    sql("old", v.STUBS)
    for name in v.ORIGINAL_MIGRATIONS:
        prefix = "set check_function_bodies = off;\n" if name.startswith("20261116000100") else ""
        sql("old", prefix + git_blob("supabase/migrations/" + name).decode())
    versions = sorted({m.group(1) for m in re.finditer(r"supabase/migrations/(\d{14})_", subprocess.run(
        ["git", "-C", str(REPO), "ls-tree", "-r", "--name-only", Y, "supabase/migrations/"], env=GIT_ENV, check=True,
        capture_output=True, text=True).stdout)})
    seed = [x for x in versions if x <= PIN and x != V1]
    check("ledger seed ends at the pinned max and omits both re-date versions", seed[-1] == PIN and V1 not in seed and V2 not in seed, seed[-3:])
    sql("old", """create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key,
      statements text[], name text, created_by text, idempotency_key text, rollback text[]);
      create function fixture.reject_ledger() returns trigger language plpgsql as $$ begin
        if new.version = current_setting('fixture.reject_version', true) then raise exception 'fixture_ledger_insert_rejected'; end if;
        return new; end $$;
      create trigger reject_ledger before insert on supabase_migrations.schema_migrations for each row execute function fixture.reject_ledger();"""
        + "insert into supabase_migrations.schema_migrations (version, name) values " + ",".join(f"('{x}','seed')" for x in seed) + ";")
    check("template PRECHECK is apply_20261120143000_first (hosted today)", state("old")[0] == FIRST)

    def fresh(db):
        sql("postgres", f"create database {db} template old")
        return db

    def script(db, *args, script_path=SCRIPT, repo=None, tag):
        out = Path(root) / f"out-{tag}"
        psql_cmd = f"{PG}/psql -X -v ON_ERROR_STOP=1 -h {root} -U postgres -d {db}"
        assert psql_cmd and f"-h {root} " in psql_cmd and root.startswith("/tmp/bpm-")
        e = dict(env, PSQL_CMD=psql_cmd, OUTDIR=str(out), FHFH_ENV_FILE="/dev/null")
        if repo:
            e["BLSH_REPO"] = str(repo)
        r = subprocess.run(["/bin/zsh", str(script_path), *args], env=e, text=True, capture_output=True, timeout=600)
        return r.returncode, r.stdout + r.stderr, out

    def refuses(tag, db, args, reason, no_apply=True, **kw):
        before = state(db)
        rc, text, out = script(db, *args, tag=tag, **kw)
        after = state(db)
        check(f"{tag}: exits 7 with '{reason}'", rc == 7 and f"FAIL: {reason}" in text, (rc, text[-400:]))
        check(f"{tag}: PRECHECK line and ledger rows identical before/after", before == after, (before, after))
        if no_apply:
            check(f"{tag}: no apply-*.sql was written", not list(out.glob("apply-*.sql")) if out.exists() else True)
        return text, out

    # 1. Read-only precheck mode changes nothing.
    db = fresh("pre")
    before = state(db)
    rc, text, out = script(db, "--ledger-max", PIN, tag="precheck")
    check("precheck mode: exit 0, start state first, nothing changed, no apply file",
          rc == 0 and "start state: first" in text and state(db) == before and not list(out.glob("apply-*.sql")), (rc, text[-300:]))
    check("precheck mode: blobs read from Y with the pinned sha256s",
          all(s in text for s in ("sha256=ce14c532", "sha256=4035c5c9", "sha256=6a3ff596")))

    # 2. Happy path from the hosted state.
    db = fresh("happy")
    rc, text, out = script(db, "--apply", "--confirm", V2, "--ledger-max", PIN, tag="happy")
    check("happy: exit 0", rc == 0, text[-600:])
    check("happy: PRECHECK reads already_redated with 03a29fd4 and 0 runs", state(db)[0] == DONE)
    check("happy: ledger has both rows, max is 20261121210000", rows(db) == f"1|1|{V2}", rows(db))
    check("happy: ledger names follow the CLI convention", sql(db, f"select string_agg(name, ',' order by version) from supabase_migrations.schema_migrations where version in ('{V1}','{V2}')")
          == "blsh_official_pilot_redate_20261121,blsh_official_pilot_redate_20261122")
    for ver in (V1, V2):
        o = (out / f"apply-{ver}.out").read_text().splitlines()
        check(f"happy: apply-{ver}.out has exactly one BEGIN and one COMMIT, no WARNING",
              o.count("BEGIN") == 1 and o.count("COMMIT") == 1 and not any("WARNING" in l for l in o), o)
    rec = (out / "receipt.txt").read_text()
    check("happy: receipt records the readbacks in order",
          rec.index(f"precheck after-{V1} ") < rec.index(f"precheck after-{V2} ") and READY in rec and DONE in rec)
    check("happy: receipt directory is 0700 and holds no credential text",
          (out.stat().st_mode & 0o777) == 0o700 and not re.search(r"password|PGPASSWORD|SUPABASE_DB_URL|postgres://", "".join(p.read_text() for p in out.iterdir()), re.I))

    # 3. A rerun refuses.
    refuses("rerun", "happy", ["--apply", "--confirm", V2, "--ledger-max", PIN], "PRECHECK verdict is not apply_20261120143000_first or ready_to_apply: already_redated|")

    # 4. Wrong ledger max: a wrong pin, and a ledger that moved past the pin.
    refuses("wrong-pin", fresh("pin"), ["--apply", "--confirm", V2, "--ledger-max", "20261121190000"], f"ledger max is {PIN}, pinned 20261121190000")
    db = fresh("moved"); sql(db, "insert into supabase_migrations.schema_migrations (version, name) values ('20261121205970', 'landed_later')")
    refuses("ledger-moved", db, ["--apply", "--confirm", V2, "--ledger-max", PIN], f"ledger max is 20261121205970, pinned {PIN}")

    # 5. Tampered blob: a copy of the script whose only change is the Y= line, pointed at a throwaway repo.
    work = Path(root) / "tamper"
    for tag, tamper in (("copy-control", False), ("tampered-blob", True)):
        repo = work / tag; repo.mkdir(parents=True)
        g = lambda *a: subprocess.run(["git", "-C", str(repo), *a], env=dict(GIT_ENV, GIT_AUTHOR_NAME="fixture", GIT_AUTHOR_EMAIL="fixture@invalid",
            GIT_COMMITTER_NAME="fixture", GIT_COMMITTER_EMAIL="fixture@invalid", GIT_AUTHOR_DATE="1795302000 +0000",
            GIT_COMMITTER_DATE="1795302000 +0000"), check=True, capture_output=True, text=True).stdout.strip()
        g("init", "-q")
        for path in (F1, F2, PRE):
            dest = repo / path; dest.parent.mkdir(parents=True, exist_ok=True)
            body = git_blob(path)
            if tamper and path == F2:
                body = body.replace(b"date '2026-11-22'", b"date '2026-11-29'", 1)
            dest.write_bytes(body)
        g("add", "-A"); g("commit", "-qm", "fixture")
        commit = g("rev-parse", "HEAD")
        copy = repo / "apply-copy.sh"
        text = SCRIPT.read_text()
        assert text.count(f"Y={Y}\n") == 1
        copy.write_text(text.replace(f"Y={Y}\n", f"Y={commit}\n"))
        diff = subprocess.run(["diff", str(SCRIPT), str(copy)], capture_output=True, text=True).stdout
        dl = diff.splitlines()
        check(f"{tag}: the copy differs from the script only in the Y= line", len(dl) == 4 and re.fullmatch(r"(\d+)c\1", dl[0]) is not None
              and dl[1] == f"< Y={Y}" and dl[2] == "---" and dl[3] == f"> Y={commit}", diff)
        print(f"  {tag} copy diff:\n" + "\n".join("    " + l for l in diff.splitlines()))
        if not tamper:
            rc, out_text, _ = script(fresh("ctl"), "--ledger-max", PIN, script_path=copy, repo=repo, tag=tag)
            check("copy-control: the copy with untampered blobs passes precheck (exit 0)", rc == 0, out_text[-300:])
        else:
            t, out = refuses(tag, fresh("tamper"), ["--apply", "--confirm", V2, "--ledger-max", PIN],
                             f"{F2} at {commit} has sha256 ", script_path=copy, repo=repo)
            check("tampered-blob: refused before any database call", not (out / "precheck-before.out").exists())

    # 6. An official run present refuses.
    db = fresh("runs")
    sql(db, """set session_replication_role = replica;
      insert into public.blsh_capture_runs(run_id,pipeline,source_date,state) values ('00000000-0000-4000-8000-0000000000aa','native-v6','2026-11-20','claimed');
      insert into public.blsh_official_runs(source_date,native_run_id,native_manifest_sha256,deployment_id,git_commit_sha,schedule_sha256,game_ids)
        values ('2026-11-20','00000000-0000-4000-8000-0000000000aa',repeat('a',64),'dpl_x',repeat('b',40),repeat('c',64),'{2026020301}');""")
    refuses("official-run", db, ["--apply", "--confirm", V2, "--ledger-max", PIN], "PRECHECK verdict is not apply_20261120143000_first or ready_to_apply: stop_official_runs_exist|")

    # 7. Atomicity: the first ledger insert fails after the body ran; the body rolls back with it.
    db = fresh("atomic"); sql(db, f"alter database atomic set fixture.reject_version = '{V1}'")
    t, out = refuses("atomic-ledger-fail", db, ["--apply", "--confirm", V2, "--ledger-max", PIN], f"{V1} did not commit cleanly", no_apply=False)
    check("atomic-ledger-fail: the body ran inside the transaction and the injected ledger error rolled it back",
          "fixture_ledger_insert_rejected" in (out / f"apply-{V1}.out").read_text() and state(db)[0] == FIRST and rows(db) == f"0|0|{PIN}")
    # The generated SQL itself guards the ledger: replay it with the row already present.
    db2 = fresh("guard"); sql(db2, f"insert into supabase_migrations.schema_migrations (version, name) values ('{V1}', 'raced')")
    r = subprocess.run([PG / "psql", "-X", "-v", "ON_ERROR_STOP=1", "-h", root, "-U", "postgres", "-d", db2, "-f", str(out / f"apply-{V1}.sql")],
                       env=env, text=True, capture_output=True, timeout=60)
    check("atomic-guard: a raced ledger row makes the transaction raise ledger_version_exists and roll back",
          r.returncode == 3 and "ledger_version_exists" in r.stderr and sql(db2, precheck_sql) == FIRST, (r.returncode, r.stderr[-300:]))

    # 8. Realistic ready_to_apply: the second ledger insert fails, the script stops, a rerun finishes from ready_to_apply.
    db = fresh("mid"); sql(db, f"alter database mid set fixture.reject_version = '{V2}'")
    rc, text, out = script(db, "--apply", "--confirm", V2, "--ledger-max", PIN, tag="mid-stop")
    check("mid-stop: exit 7 at the second file, first file committed", rc == 7 and f"FAIL: {V2} did not commit cleanly" in text
          and state(db)[0] == READY and rows(db) == f"1|0|{PIN}", (rc, text[-300:], rows(db)))
    sql(db, "alter database mid reset fixture.reject_version")
    rc, text, out = script(db, "--apply", "--confirm", V2, "--ledger-max", PIN, tag="from-ready")
    check("from-ready: exit 0, start state ready, only the second file applied", rc == 0 and "start state: ready" in text
          and sorted(p.name for p in out.glob("apply-*.sql")) == [f"apply-{V2}.sql"], (rc, text[-300:]))
    check("from-ready: PRECHECK already_redated, ledger 1|1|20261121210000", state(db)[0] == DONE and rows(db) == f"1|1|{V2}")

    # 9. ready_to_apply without the first ledger row (schema applied outside the ledger) refuses.
    db = fresh("noledger"); sql(db, git_blob(F1).decode())
    refuses("ready-no-ledger-row", db, ["--apply", "--confirm", V2, "--ledger-max", PIN], "state ready_to_apply needs")
    # 10. First-file ledger row present but schema not applied refuses.
    db = fresh("rowonly"); sql(db, f"insert into supabase_migrations.schema_migrations (version, name) values ('{V1}', 'x')")
    refuses("ledger-row-without-schema", db, ["--apply", "--confirm", V2, "--ledger-max", PIN], "state apply_20261120143000_first needs both ledger rows absent")
    # 11. Argument refusals before any database call.
    for tag, args, reason in (("no-confirm", ["--apply", "--ledger-max", PIN], f"--apply needs --confirm {V2}"),
                              ("no-pin", ["--apply", "--confirm", V2], "--ledger-max <14-digit version> is required")):
        refuses(tag, fresh(tag.replace("-", "")), args, reason)


if __name__ == "__main__":
    main()

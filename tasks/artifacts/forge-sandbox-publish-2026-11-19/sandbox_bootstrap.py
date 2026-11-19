#!/usr/bin/env python3
"""Emit the production-sandbox bootstrap for synthetic FORGE fixture 2099020991.

Every object lands in four private schemas plus the exposed API schema forge_sandbox_api, all owned by the NOLOGIN role
forge_sandbox_owner, which receives no privilege outside them except USAGE on `extensions` (pgcrypto digest/hmac).
forge_sandbox_api holds only owner-owned views over the capture's read tables and SECURITY DEFINER wrappers for the
capture, native-input and run-ledger functions (sandbox-api.sql). The NOLOGIN role forge_sandbox_api, granted to
authenticator so PostgREST can switch to it for a JWT with role=forge_sandbox_api, gets USAGE on that schema, SELECT on
its views and EXECUTE on its wrappers, and nothing on the private schemas. No database login is created. Nothing
touches public, other roles' defaults, authenticator/service_role settings or cron. The source text is the tested rehearsal bootstrap (fixture schema, seed,
custody and publication SQL) with schema and role names rewritten; generation refuses any leftover reference.
The fixture tree is read from git object FORGE_SANDBOX_SOURCE (default: the approved rehearsal candidate f886ddac,
refs/rc/forge-offline-rehearsal-20261123) into a temporary directory, so master carries no fixtures or migrations.
The sandbox holds what v1 capture, the FORGE publication and both RSO readers need (the full fixture platform).
"""
import argparse
import atexit
import re
import runpy
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SOURCE = os.environ.get("FORGE_SANDBOX_SOURCE", "f886ddac731ae825a12fab915848d2b5fd7d9b8c")
SOURCE_PATHS = ["tasks/artifacts/forge-offline-2026-11-18/rehearsal", "supabase/migrations", "supabase/tests", "web/lib", "web/package.json"]
# v1 capture uses the custody RPCs and the frozen inputs only.
# Publication's schedule check (hosted_schedule) lives in the hosted-dispatch migration, so the whole fixture platform is
# kept; it creates no roles and schedules no jobs. The hosted witness/run migrations stay out (add_seed HOSTED = []).
CAPTURE_ONLY_DROP: list = []


def _source_tree() -> Path:
    tree = Path(tempfile.mkdtemp(prefix="forge-sandbox-src-"))
    archive = subprocess.run(["git", "-C", str(REPO), "archive", "--format=tar", SOURCE, *SOURCE_PATHS], check=True, capture_output=True).stdout
    subprocess.run(["tar", "-x", "-C", str(tree)], input=archive, check=True)
    (tree / "web/node_modules").symlink_to(REPO / "web/node_modules")   # same lockfile as master (checked by the caller)
    return tree


_LOADED: dict = {}


def boot() -> dict:
    """The rehearsal bootstrap module from the source tree, extracted once per process."""
    if not _LOADED:
        tree = _source_tree()
        atexit.register(shutil.rmtree, tree, True)
        _LOADED.update(tree=tree, boot=runpy.run_path(str(tree / "tasks/artifacts/forge-offline-2026-11-18/rehearsal/bootstrap.py")))
    return _LOADED["boot"]
GAME = 2099020991
OWNER, API = "forge_sandbox_owner", "forge_sandbox_api"
API_SCHEMA = "forge_sandbox_api"
SCHEMAS = {"forge_pregame_capture": "forge_sandbox_capture", "fhfh_internal": "forge_sandbox_internal",
           "forge_execution_internal": "forge_sandbox_exec", "public": "forge_sandbox"}
SANDBOX = list(SCHEMAS.values())
FORBIDDEN = [r"\bcreate\s+role\b", r"\balter\s+role\b", r"\bcreate\s+extension\b", r"\bevent\s+trigger\b",
             r"\bcreate\s+publication\b", r"\bcron\.\w", r"\bauthenticator\b", r"\bforge_witness_api\b", r"\bsupabase_\w+\b"]


def transform(sql: str) -> str:
    for old, new in SCHEMAS.items():
        # Schemas are pre-created with the owner as authorization; drop the migrations' own create statements.
        sql = re.sub(rf"(?im)^\s*create\s+schema\s+(if\s+not\s+exists\s+)?{old}\s*;", f"-- schema {new} created by the sandbox prelude", sql)
        sql = re.sub(rf'(?<![\w."]){old}\.', f"{new}.", sql)
        sql = re.sub(rf"(?i)\bschema\s+{old}\b", f"schema {new}", sql)
    # Former service_role grants are re-pointed at the API role and then revoked from it on every private schema and
    # object in the lockdown, so it ends with nothing there (isolation-check.sql proves it). The owner keeps its rights.
    return re.sub(r"\bservice_role\b", API, sql)


def check(sql: str) -> None:
    for old in SCHEMAS:
        leftover = re.findall(rf'(?<![\w."]){old}\.\w+', sql)
        if leftover:
            raise SystemExit(f"leftover {old}. references: {sorted(set(leftover))[:8]}")
    for pattern in FORBIDDEN:
        hit = re.search(pattern, sql, re.I)
        if hit:
            raise SystemExit(f"forbidden statement in sandbox SQL: {hit.group(0)!r}")


def application(start: datetime) -> str:
    BOOT = boot()
    item = BOOT["world"](start)
    add_seed = BOOT["add_seed"]
    add_seed.__globals__["HOSTED"] = []          # no hosted dispatch, witness roles or witness API in the sandbox
    seed = add_seed(item)
    core = BOOT["core_platform"]()
    for name in CAPTURE_ONLY_DROP:
        text = (_LOADED["tree"] / "supabase/migrations" / name).read_text()
        if core.count(text) != 1:
            raise SystemExit(f"cannot isolate {name} in the fixture platform")
        core = core.replace(text, f"-- {name} omitted: not used by v1 capture\n")
    body = BOOT["atomic"](core + "\n" + seed + "\n" + (HERE / "sandbox-run-schema.sql").read_text())
    defaults = "\n".join(f"alter default privileges in schema public revoke all on {kind} from anon, authenticated, service_role;"
                         for kind in ("tables", "sequences", "functions"))
    sql = transform(defaults + "\n" + body)
    # The owner seeds tables it owns; a table with FORCE ROW LEVEL SECURITY would refuse even its owner. Lift FORCE only
    # around that table's own seed insert and restore it immediately, so the final table state is unchanged.
    for name in set(re.findall(r'(?im)^alter table forge_sandbox\."?(\w+)"? force row level security;', sql)):
        table = f'forge_sandbox."{name}"'
        insert = re.compile(rf'(?m)^(insert into forge_sandbox\."?{name}"? \(.*;)$')
        sql = insert.sub(lambda m: f"alter table {table} no force row level security;\n{m.group(1)}\n"
                                   f"alter table {table} force row level security;", sql)
    check(sql)
    return sql, item["request"]


def bootstrap(start: datetime) -> tuple[str, dict]:
    sql, request = application(start)
    schemas = SANDBOX + [API_SCHEMA]
    names = ", ".join(f"'{s}'" for s in schemas)
    lockdown = "\n".join(
        f"revoke all on all tables in schema {s} from public, anon, authenticated, {API};\n"
        f"revoke all on all sequences in schema {s} from public, anon, authenticated, {API};\n"
        f"revoke all on all functions in schema {s} from public, anon, authenticated, {API};\n"
        f"revoke all on schema {s} from public, anon, authenticated, {API};" for s in schemas)
    api = (HERE / "sandbox-api.sql").read_text()
    text = "\n".join([
        f"-- FORGE production sandbox bootstrap (narrow PostgREST interface) for fixture {GAME}.",
        f"-- Generated {datetime.now(timezone.utc).isoformat(timespec='seconds')}. Synthetic puck drop {request['scheduledStart']}, slate {request['slateDate']}.",
        f"-- Apply once as the project owner (postgres); then add {API_SCHEMA} to the Data API exposed schemas.",
        "\\set ON_ERROR_STOP on",
        "begin;",
        "set local lock_timeout = '5s';",
        "do $guard$ begin",
        f"  if exists (select from pg_catalog.pg_namespace where nspname in ({names}))",
        f"    or exists (select from pg_catalog.pg_roles where rolname in ('{OWNER}', '{API}')) then",
        "    raise exception 'forge sandbox already exists; run reset-sandbox.sql first'; end if;",
        "  if to_regprocedure('extensions.digest(bytea,text)') is null then raise exception 'pgcrypto in extensions is required'; end if;",
        "  if not exists (select from pg_catalog.pg_roles where rolname = 'authenticator') then raise exception 'authenticator role missing'; end if;",
        "end $guard$;",
        f"create role {OWNER} nologin noinherit nocreatedb nocreaterole noreplication nobypassrls;",
        f"create role {API} nologin noinherit nocreatedb nocreaterole noreplication nobypassrls;",
        f"alter role {API} set statement_timeout = '20s';",
        f"alter role {API} set timezone = 'UTC';",
        f"grant {API} to authenticator;",
        f"grant {OWNER} to current_user;",
        *[f"create schema {s} authorization {OWNER};" for s in schemas],
        f"grant usage on schema extensions to {OWNER};",
        f"set local role {OWNER};",
        sql, api, lockdown,
        f"grant usage on schema {API_SCHEMA} to {API};",
        f"grant select on all tables in schema {API_SCHEMA} to {API};",
        f"grant execute on all functions in schema {API_SCHEMA} to {API};",
        "reset role;",
        "commit;",
        "notify pgrst, 'reload schema';", ""])
    return text, request


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--start", required=True, help="synthetic puck drop, ISO 8601 UTC, 76 minutes to 7 days ahead")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    start = datetime.fromisoformat(args.start.replace("Z", "+00:00"))
    if start.utcoffset() is None or not 75 * 60 < (start - datetime.now(timezone.utc)).total_seconds() < 7 * 86400:
        ap.error("choose a puck drop more than 75 minutes and less than seven days ahead")
    text, request = bootstrap(start)
    with args.out.open("x") as out:
        out.write(text)
    print(f"Created {args.out}: fixture {GAME}, slate {request['slateDate']}, start {request['scheduledStart']}.")


if __name__ == "__main__":
    main()

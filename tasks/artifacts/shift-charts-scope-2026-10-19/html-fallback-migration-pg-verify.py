"""Disposable PostgreSQL 17 check of the HTML shift-snapshot capture migration.

Builds two fresh databases in one synthetic Unix-socket cluster with the raw
payload table, the snapshot-head triggers (20260720105524) and the current
capture RPC (20261011115124) plus its grants. `old_rpc` stays on that body;
`new_rpc` also applies 20261019172842. The same JSON capture sequence runs in
both and must produce identical results and table state; the RPC identity,
security and ACL must be identical; HTML envelopes are then checked on both.
No hosted database is contacted.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile

base = Path(__file__).resolve().parent
repo = base.parents[2]
run_id = sys.argv[1] if len(sys.argv) > 1 else "v1"
output = base / f"html-fallback-migration-pg-result-{run_id}.json"
assert not output.exists(), "Preserve prior receipts; use a new run ID."
materialization = (repo / "supabase/migrations/20260720105524_add_projection_materialization_transactions.sql").read_text()
old_capture = (repo / "supabase/migrations/20261011115124_preserve_projection_raw_shift_occurrences.sql").read_text()
migration_path = repo / "supabase/migrations/20261019172842_accept_html_report_projection_shift_snapshots.sql"
new_capture = migration_path.read_text()

heads_sql = materialization[
    materialization.index("create unique index nhl_api_game_payloads_raw_snapshot_identity_idx"):
    materialization.index("create table public.projection_game_materialization_status")
]
grants_start = materialization.index("revoke all on function public.capture_projection_raw_source_snapshots_v1(")
grants_sql = materialization[grants_start:materialization.index("create or replace function public.persist_projection_game_inputs_v1(")]

binary = Path("/opt/homebrew/opt/postgresql@17/bin")
cluster = Path(tempfile.mkdtemp(prefix="fhfh-html-", dir="/private/tmp"))
os.chmod(cluster, 0o700)
(cluster / "socket").mkdir()
port = str(55000 + secrets.randbelow(9000))
environment = {"PATH": "/usr/bin:/bin", "LC_ALL": "C", "TMPDIR": str(cluster)}
cases = []
running = False


def run(args, stdin=None, check=True):
    result = subprocess.run(args, env=environment, text=True, input=stdin,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
    if check and result.returncode:
        raise RuntimeError(result.stdout)
    return result


def psql(db):
    return [str(binary / "psql"), "-X", "-w", "-qAt", "-h", str(cluster / "socket"), "-p", port,
            "-U", "fixture", "-d", db, "-v", "ON_ERROR_STOP=1"]


def sql(db, text, check=True):
    return run(psql(db), stdin=text, check=check)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


FIXTURE = """
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls;
""".strip()

SCHEMA = """
create table public.games (id bigint primary key, date date not null, "seasonId" bigint not null);
create table public.nhl_api_game_payloads_raw (
  id bigserial primary key,
  game_id bigint not null,
  endpoint text not null,
  season_id bigint,
  game_date date,
  source_url text not null,
  payload_hash text not null,
  payload jsonb not null,
  fetched_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  constraint nhl_api_game_payloads_raw_endpoint_check check (endpoint = any (array['play-by-play','boxscore','landing','shiftcharts'])),
  constraint nhl_api_game_payloads_raw_payload_hash_nonempty_chk check (btrim(payload_hash) <> ''),
  constraint nhl_api_game_payloads_raw_source_url_nonempty_chk check (btrim(source_url) <> ''),
  constraint nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key unique (game_id, endpoint, payload_hash)
);
create function public.prevent_nhl_api_game_payloads_raw_mutation() returns trigger
  language plpgsql as $$ begin raise exception 'nhl_api_game_payloads_raw rows are immutable'; end; $$;
insert into public.games values (2026020001, '2026-09-29', 20262027), (2026020010, '2026-10-02', 20262027);
"""

PBP = {"id": 2026020001, "season": 20262027, "gameDate": "2026-09-29", "plays": [{"eventId": 1}, {"eventId": 2, "typeDescKey": "game-end"}]}


def json_row(game_id, player_id, shift_number, type_code=517, **overrides):
    row = {"id": shift_number, "gameId": game_id, "playerId": player_id, "teamId": 17, "shiftNumber": shift_number,
           "period": 1, "startTime": "00:34", "endTime": "01:50", "duration": "01:16", "typeCode": type_code}
    row.update(overrides)
    return row


def capture(db, game_id, game_date, shift_payload, pbp=None):
    pbp = pbp or {**PBP, "id": game_id, "gameDate": game_date}
    pbp_hash = hashlib.sha256(json.dumps(pbp).encode()).hexdigest()
    shift_hash = hashlib.sha256(json.dumps(shift_payload).encode()).hexdigest()
    statement = f"""
select game_id, pbp_raw_snapshot_version, pbp_raw_payload_hash = {literal(pbp_hash)},
       shift_raw_snapshot_version, shift_raw_payload_hash = {literal(shift_hash)}
from public.capture_projection_raw_source_snapshots_v1(
  {game_id}, 20262027, {literal(game_date)},
  {literal(f'https://api-web.nhle.com/v1/gamecenter/{game_id}/play-by-play')}, {literal(pbp_hash)}, {literal(json.dumps(pbp))}::jsonb,
  {literal(f'https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={game_id}')}, {literal(shift_hash)}, {literal(json.dumps(shift_payload))}::jsonb);
"""
    result = sql(db, statement, check=False)
    text = result.stdout.strip()
    if result.returncode:
        message = next((line.split("ERROR:", 1)[1].strip() for line in text.splitlines() if "ERROR:" in line), text)
        return {"ok": False, "error": message}
    return {"ok": True, "receipt": text}


def state(db):
    return sql(db, """
select json_agg(json_build_object('game', game_id, 'endpoint', endpoint, 'hash', payload_hash, 'source', payload->>'source') order by id) from public.nhl_api_game_payloads_raw;
select json_agg(json_build_object('game', game_id, 'endpoint', endpoint, 'version', snapshot_version, 'hash', payload_hash) order by game_id, endpoint) from public.nhl_api_game_payload_snapshot_heads;
""").stdout.strip()


def rpc_identity(db):
    return sql(db, """
select p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid),
       p.prosecdef, p.provolatile, coalesce(array_to_string(p.proconfig, ','), ''),
       coalesce(array_to_string(p.proacl, ','), ''), l.lanname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
where n.nspname = 'public' and p.proname = 'capture_projection_raw_source_snapshots_v1';
""").stdout.strip()


def record(name, passed, detail):
    cases.append({"case": name, "passed": bool(passed), "detail": detail})


JSON_SEQUENCE = [
    ("json_capture", 2026020001, "2026-09-29", {"total": 2, "data": [json_row(2026020001, 101, 1), json_row(2026020001, 202, 1)], "source": "json-api"}),
    ("json_exact_replay_is_idempotent", 2026020001, "2026-09-29", {"total": 2, "data": [json_row(2026020001, 101, 1), json_row(2026020001, 202, 1)], "source": "json-api"}),
    ("json_changed_payload_advances_head", 2026020001, "2026-09-29", {"total": 3, "data": [json_row(2026020001, 101, 1), json_row(2026020001, 101, 2), json_row(2026020001, 202, 1)], "source": "json-api"}),
    ("json_null_type_code_rejected", 2026020001, "2026-09-29", {"total": 1, "data": [json_row(2026020001, 101, 1, type_code=None)], "source": "json-api"}),
    ("json_wrong_game_rejected", 2026020001, "2026-09-29", {"total": 1, "data": [json_row(2026020010, 101, 1)], "source": "json-api"}),
    ("json_total_mismatch_rejected", 2026020001, "2026-09-29", {"total": 5, "data": [json_row(2026020001, 101, 1)], "source": "json-api"}),
    ("json_empty_rejected", 2026020001, "2026-09-29", {"total": 0, "data": [], "source": "json-api"}),
    ("json_api_empty_source_rejected", 2026020001, "2026-09-29", {"total": 1, "data": [json_row(2026020001, 101, 1)], "source": "json-api-empty"}),
    ("missing_source_rejected", 2026020001, "2026-09-29", {"total": 1, "data": [json_row(2026020001, 101, 1)]}),
]


def html_envelope(rows):
    return {"total": len(rows), "data": rows, "source": "htmlreports", "upstream": {"json": {"total": 0, "data": []}},
            "htmlReports": {"visitorUrl": "https://www.nhl.com/scores/htmlreports/20262027/TV020010.HTM",
                            "homeUrl": "https://www.nhl.com/scores/htmlreports/20262027/TH020010.HTM"}}


def html_row(player_id, shift_number, **overrides):
    row = {"id": shift_number, "gameId": 2026020010, "playerId": player_id, "teamId": 17, "teamAbbrev": "DET",
           "teamName": "DETROIT RED WINGS", "firstName": "Ben", "lastName": "Chiarot", "period": 1,
           "shiftNumber": shift_number, "startTime": "00:34", "endTime": "01:50", "duration": "01:16",
           "typeCode": 517, "detailCode": None, "eventNumber": None, "eventDescription": None,
           "eventDetails": None, "hexValue": None}
    row.update(overrides)
    return row


try:
    run([str(binary / "initdb"), "-D", str(cluster / "data"), "-U", "fixture", "-A", "trust", "--no-locale"])
    run([str(binary / "pg_ctl"), "-D", str(cluster / "data"), "-l", str(cluster / "server.log"),
         "-o", f"-F -k {cluster / 'socket'} -c listen_addresses='' -p {port}", "-w", "-t", "10", "start"])
    running = True
    version = sql("postgres", "show server_version;").stdout.strip()
    sql("postgres", FIXTURE)
    for db in ("old_rpc", "new_rpc"):
        sql("postgres", f"create database {db};")
        sql(db, SCHEMA)
        sql(db, "begin;\n" + heads_sql + "\ncommit;")
        sql(db, old_capture)
        sql(db, grants_sql)
    identity_before = rpc_identity("new_rpc")
    sql("new_rpc", new_capture)
    identity_after = rpc_identity("new_rpc")
    record("rpc_name_signature_result_security_config_acl_unchanged",
           identity_before == identity_after == rpc_identity("old_rpc"),
           {"identity": identity_after})

    for name, game_id, game_date, payload in JSON_SEQUENCE:
        old = capture("old_rpc", game_id, game_date, payload)
        new = capture("new_rpc", game_id, game_date, payload)
        record(f"{name}_identical_before_and_after", old == new, {"old": old, "new": new})
    expected = {"json_capture": True, "json_exact_replay_is_idempotent": True, "json_changed_payload_advances_head": True}
    for name, *_ in JSON_SEQUENCE:
        result = next(case for case in cases if case["case"] == f"{name}_identical_before_and_after")["detail"]["new"]
        record(f"{name}_outcome", result["ok"] == expected.get(name, False), result)
    record("json_table_state_identical", state("old_rpc") == state("new_rpc"), {"state": state("new_rpc")})

    valid = html_envelope([html_row(101, 1), html_row(101, 2, startTime="05:02", endTime="05:37", duration="00:35"),
                           html_row(202, 1, teamId=18, teamAbbrev="NSH", teamName="NASHVILLE PREDATORS")])
    old_html = capture("old_rpc", 2026020010, "2026-10-02", valid)
    record("old_rpc_rejects_htmlreports", not old_html["ok"] and old_html["error"] == "INVALID_PROJECTION_RAW_SHIFT_PAYLOAD", old_html)
    new_html = capture("new_rpc", 2026020010, "2026-10-02", valid)
    record("new_rpc_accepts_htmlreports", new_html["ok"], new_html)
    heads = sql("new_rpc", "select payload_hash = " + literal(hashlib.sha256(json.dumps(valid).encode()).hexdigest()) +
                ", snapshot_version from public.nhl_api_game_payload_snapshot_heads where game_id = 2026020010 and endpoint = 'shiftcharts';").stdout.strip()
    record("htmlreports_capture_is_current_head", heads == "t|1", {"head": heads})
    record("htmlreports_exact_replay_is_idempotent", capture("new_rpc", 2026020010, "2026-10-02", valid) == new_html, {})
    for name, payload, error in [
        ("htmlreports_null_type_code_rejected", html_envelope([html_row(101, 1, typeCode=None)]), "INVALID_PROJECTION_RAW_SHIFT_ROWS"),
        ("htmlreports_missing_game_id_rejected", html_envelope([{k: v for k, v in html_row(101, 1).items() if k != "gameId"}]), "INVALID_PROJECTION_RAW_SHIFT_ROWS"),
        ("htmlreports_wrong_game_rejected", html_envelope([html_row(101, 1, gameId=2026020001)]), "INVALID_PROJECTION_RAW_SHIFT_ROWS"),
        ("htmlreports_null_start_rejected", html_envelope([html_row(101, 1, startTime=None)]), "INVALID_PROJECTION_RAW_SHIFT_ROWS"),
        ("htmlreports_total_mismatch_rejected", {**html_envelope([html_row(101, 1)]), "total": 4}, "INVALID_PROJECTION_RAW_SHIFT_PAYLOAD"),
        ("htmlreports_empty_rejected", html_envelope([]), "INVALID_PROJECTION_RAW_SHIFT_PAYLOAD"),
        ("other_source_rejected", {**html_envelope([html_row(101, 1)]), "source": "html-report"}, "INVALID_PROJECTION_RAW_SHIFT_PAYLOAD"),
    ]:
        result = capture("new_rpc", 2026020010, "2026-10-02", payload)
        record(name, not result["ok"] and result["error"] == error, result)
finally:
    if running:
        run([str(binary / "pg_ctl"), "-D", str(cluster / "data"), "-m", "fast", "-w", "stop"], check=False)
    shutil.rmtree(cluster, ignore_errors=True)

passed = bool(cases) and all(case["passed"] for case in cases)
output.write_text(json.dumps({
    "ranAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "postgres": version if running else None,
    "migration": str(migration_path.relative_to(repo)),
    "migrationSha256": hashlib.sha256(migration_path.read_bytes()).hexdigest(),
    "passed": passed,
    "caseCount": len(cases),
    "cases": cases,
}, indent=2) + "\n")
print(json.dumps({"passed": passed, "cases": len(cases), "failed": [c["case"] for c in cases if not c["passed"]]}))
sys.exit(0 if passed else 1)

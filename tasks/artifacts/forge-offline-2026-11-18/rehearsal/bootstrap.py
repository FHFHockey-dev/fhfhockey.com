#!/usr/bin/env python3
"""Emit a synthetic isolated-project SQL bootstrap, or test its seed on socket-only PostgreSQL."""
import argparse
import base64
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import runpy
import secrets
import socket
import subprocess
import tempfile
import time
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[4]
WEB = ROOT / "web"
FIXTURES = WEB / "lib/projections/pregameCapture/__fixtures__"
MIGRATIONS = ROOT / "supabase/migrations"
CORE = runpy.run_path(str(ROOT / "supabase/tests/forge_pregame_publication.py"))
GAME = 2099020991
CENTER = 8471001
NATIVE = ["20261021182129_forge_latest_rolling_rows.sql",
          "20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql",
          "20261115190000_forge_latest_trend_bands.sql"]
HOSTED = ["20261118210001_forge_hosted_runs.sql", "20261118210002_forge_independent_witness.sql",
          "20261118210003_forge_hosted_progress.sql"]
CORE_TABLES = ["seasons", "teams", "games", "players", "roster_optimizer_team_games"]

def quote(name):
    if not re.fullmatch(r'[a-zA-Z_]\w*', name):
        raise ValueError(f"unexpected fixture column {name}")
    return '"' + name + '"'

def world(start):
    env = {**os.environ, "NODE_PATH": ".", "TS_NODE_COMPILER_OPTIONS": '{"module":"commonjs","moduleResolution":"node"}'}
    script = """
      const {prospectiveLeague} = require('./lib/projections/pregameCapture/__fixtures__/prospectiveLeague');
      const {world,request} = prospectiveLeague('synthetic-world', Number(process.argv[1]), Number(process.argv[2]));
      process.stdout.write(JSON.stringify({tables:world.tables,request}));
    """
    output = subprocess.check_output(["node", "-r", "ts-node/register/transpile-only", "-e", script, str(GAME),
                                      str(int(start.timestamp() * 1000))], cwd=WEB, env=env)
    item = json.loads(output)
    for p in item["tables"]["players"]:
        p.update(firstName="Synthetic", lastName=str(p["id"]), birthDate="2000-01-01",
                 heightInCentimeters=180, weightInKilograms=80)
    for row in item["tables"]["roster_optimizer_team_games"]:
        row.update(mapping_status="unmapped", source_url="https://fixture.invalid")
    return item

def shapes(tables):
    """Retain null columns that the real capture selects, filters and validates through PostgREST."""
    fields = defaultdict(dict)
    for table, rows in tables.items():
        for row in rows:
            for col, val in row.items():
                if fields[table].get(col) is None:
                    fields[table][col] = val
    reads = json.loads((FIXTURES / "world/oracle/normal-one-game.json").read_text())["reads"]
    for read in reads:
        op, *tail = read["request"]
        table = op["args"][0]
        if op["method"] == "rpc":
            if table == "forge_latest_rolling_rows":
                for col in op["args"][1]["p_columns"]:
                    fields["rolling_player_game_metrics"].setdefault(col, None)
            continue
        for step in tail:
            args = step["args"]
            if step["method"] == "select":
                for col in args[0].split(","):
                    if col != "*":
                        fields[table].setdefault(col, None)
            elif step["method"] in {"eq", "neq", "in", "gt", "gte", "lt", "lte", "is", "not", "order"}:
                sample = args[1] if len(args) > 1 and step["method"] not in {"not", "order"} else None
                if isinstance(sample, list):
                    sample = next(iter(sample), None)
                if fields[table].get(args[0]) is None:
                    fields[table][args[0]] = sample
    extras = {
        "rolling_player_metric_support_payloads": "player_id game_id game_date season strength_state payload_schema_version support_payload",
        "forge_board_news_events": "id game_id queue_version accepted_at",
        "wgo_skater_stats": "season_id games_played position_code hits blocked_shots",
        "nst_team_stats": "team_abbreviation season situation gp xga xgf",
        "wgo_skater_stats_totals": "player_id season games_played goals gw_goals penalty_minutes plus_minus sh_goals sh_assists sh_points total_fow total_fol",
        "opponent_skater_allowed_by_position": "season_id opponent position_group games points shots",
        "player_forecast_lineup_assignments": "id snapshot_id created_at",
        "player_forecast_conflict_resolutions": "id conflict_id created_at resolved_at",
    }
    for table, cols in extras.items():
        for col in cols.split():
            fields[table].setdefault(col, None)
    return fields

def column_type(table, col, val):
    if col in {"strength_state", "window_code", "metric_key", "position_code", "situation", "position_group",
               "opponent", "team_abbreviation"}:
        return "text"
    if col in {"support_payload", "metadata", "payload", "provenance", "resolution"} or isinstance(val, (dict, list)):
        return "jsonb"
    if col.endswith("_at") or col in {"effective_to", "effective_from"}:
        return "timestamptz"
    if col.endswith("_date") or col in {"date", "gameDate"}:
        return "date"
    if isinstance(val, bool) or col == "accepted":
        return "boolean"
    if isinstance(val, str):
        return "text"
    if col in {"hits", "blocked_shots", "games_played", "season", "queue_version"} or col.endswith(("_id", "Id")) or col == "id":
        return "bigint"
    return "numeric"

def migrations(names):
    return "\n".join((MIGRATIONS / name).read_text() for name in names)

def add_seed(item):
    tables = item["tables"]
    fields = shapes(tables)
    chunks = []
    for table, cols in fields.items():
        if table in CORE_TABLES or table == "forge_board_news_events":
            continue
        definition = ", ".join(f"{quote(col)} {column_type(table, col, val)}" for col, val in cols.items())
        name = "public." + quote(table)
        chunks += [f"create table {name} ({definition});", f"alter table {name} enable row level security;",
                   f"revoke all on {name} from public, anon, authenticated, service_role;", f"grant select on {name} to service_role;"]
    for table in [*CORE_TABLES, *(t for t in tables if t not in CORE_TABLES)]:
        rows = tables[table]
        keys = list(dict.fromkeys(col for row in rows for col in row))
        columns = ", ".join(map(quote, keys))
        records = json.dumps(rows, separators=(",", ":"), allow_nan=False).replace("'", "''")
        name = "public." + quote(table)
        chunks.append(f"insert into {name} ({columns}) select {columns} from jsonb_populate_recordset(null::{name},'{records}'::jsonb);")
    # Current role reads the real platform Data API. Keep target projection and event tables unseeded.
    chunks += ["grant select on public.seasons, public.yahoo_matchup_weeks to service_role;",
               'alter table public."skatersGameStats" add foreign key ("gameId") references public.games(id);',
               'alter table public."goaliesGameStats" add foreign key ("gameId") references public.games(id);',
               migrations(NATIVE)]
    baseline = (MIGRATIONS / "20260716112908_production_schema_baseline.sql").read_text()
    chunks += [re.search(r"CREATE TABLE public\.cron_job_audit \(.*?\n\);", baseline, re.S)[0],
               "alter table public.cron_job_audit enable row level security;",
               "revoke all on public.cron_job_audit from public, anon, authenticated, service_role;", migrations(HOSTED)]
    return "\n".join(chunks)

def core_platform():
    # The Python companion starts with synthetic platform roles, Vault and pg_net in its LOCAL test schema.
    # On Supabase keep the existing services and roles, including the real net.http_post and scheduler.
    full = CORE["fixture_schema"]()
    marker = 'CREATE TYPE public."NHL_Position_Code"'
    if full.count(marker) != 1:
        raise RuntimeError("unexpected publication fixture schema")
    return full[full.index(marker):]

def atomic(text):
    # Imported migrations have standalone top-level transaction commands. Execute the bootstrap once, atomically.
    return re.sub(r"^(?:begin|commit);[ \t]*$", "", text, flags=re.I | re.M)

EMPTY_PROJECT = """
do $guard$ begin
  if exists (select from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind in ('r','p','m','v','f','S'))
    or to_regnamespace('forge_pregame_capture') is not null or to_regnamespace('fhfh_internal') is not null then
    raise exception 'Rehearsal bootstrap requires a fresh isolated project'; end if;
  if not exists(select from pg_extension where extname='pg_cron') or not exists(select from pg_extension where extname='pg_net')
    or to_regclass('vault.decrypted_secrets') is null or to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'Enable pg_cron, pg_net, Vault and pgcrypto in extensions on the isolated project'; end if;
end $guard$;
"""

def application_sql(seed):
    # The included migrations explicitly grant each client its rights. On a dedicated Supabase
    # project new public objects may otherwise inherit broader project defaults absent in local PG.
    defaults = "\n".join(f"alter default privileges in schema public revoke all on {kind} from anon, authenticated, service_role;"
                         for kind in ("tables", "sequences", "functions"))
    return defaults + "\n" + atomic(core_platform() + "\n" + seed)

def postgrest_check(binary, namespace, item):
    def b64(value):
        return base64.urlsafe_b64encode(value).rstrip(b"=")
    secret = secrets.token_hex(32)
    data = b".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(b'{"role":"service_role"}')])
    key = (data + b"." + b64(hmac.new(secret.encode(), data, hashlib.sha256).digest())).decode()
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    uri = "postgresql:///synthetic_rehearsal?" + urlencode({"host": namespace["host"], "port": namespace["port"], "user": "fixture_authenticator"})
    env = {key: value for key, value in os.environ.items() if not key.startswith(("PGRST_", "PG"))}
    env.update(PGRST_DB_URI=uri, PGRST_DB_ANON_ROLE="anon", PGRST_SERVER_HOST="127.0.0.1",
               PGRST_SERVER_PORT=str(port), PGRST_JWT_SECRET=secret, PGRST_DB_SCHEMAS="public", PGRST_DB_MAX_ROWS="1000")
    with tempfile.TemporaryFile() as log, subprocess.Popen([str(binary)], env=env, stdout=log, stderr=log) as server:
        try:
            for _ in range(100):
                if server.poll() is not None:
                    log.seek(0)
                    raise RuntimeError(log.read(1800).decode())
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=.2):
                        break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError("local PostgREST did not start")
            release = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, capture_output=True)
            label = release.stdout.strip() if release.returncode == 0 else os.environ.get(
                "FORGE_TEST_ARCHIVE_SHA", "0123456789abcdef0123456789abcdef01234567")
            if not re.fullmatch(r"[0-9a-f]{40}", label):
                raise RuntimeError("invalid local release label")
            item["request"]["codeVersion"] = label
            test_env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR") if k in os.environ}
            test_env.update(NODE_PATH=os.pathsep.join([".", str(WEB / "node_modules")]),
                            TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}',
                            NEXT_PUBLIC_SUPABASE_URL=f"http://127.0.0.1:{port}", SUPABASE_SERVICE_ROLE_KEY=key, NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="unused-local-anonymous-key",
                            FORGE_PREGAME_CAPTURE_ENABLED="true", STARTER_BOARD_CAPTURE_ENABLED="true",
                            STARTER_BOARD_COMPUTE_ENABLED="true", STARTER_BOARD_SERVING_ENABLED="true",
                            STARTER_BOARD_CANARY_GAME_IDS=str(GAME), FORGE_SKATER_MODEL_MODE="baseline",
                            FORGE_RESERVE_PASS_ENABLED="false", STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED="false",
                            RSO_LATER_IMPACT_SCENARIO="off", RSO_FORGE_DAILY_BRIDGE="on",
                            FORGE_REHEARSAL_REQUEST=json.dumps(item["request"]), FORGE_FIXTURE_SOCKET=namespace["host"],
                            FORGE_FIXTURE_PG_PORT=namespace["port"], VERCEL_ENV="production", VERCEL_GIT_COMMIT_SHA=label,
                            FORGE_PREGAME_DISPATCH_SECRET=secrets.token_hex(32))
            subprocess.run(["node", "-r", "ts-node/register/transpile-only", str(Path(__file__).with_name("postgrest-check.ts"))],
                           cwd=WEB, env=test_env, check=True, timeout=160)
        finally:
            server.terminate()

def check_local(item, seed, binary):
    import psycopg2
    checked = CORE["row"]
    with CORE["publication_db"]() as connect:
        with connect() as owner:
            # Run the exact generated application SQL in a separate empty database. The platform
            # roles are cluster-wide. Only this local database uses test net/Vault stand-ins.
            checked(owner, "create database synthetic_rehearsal")
            namespace = owner.get_dsn_parameters()
        with psycopg2.connect(host=namespace["host"], port=namespace["port"], user="postgres", dbname="synthetic_rehearsal") as db:
            prelude = CORE["fixture_schema"]().split('CREATE TYPE public."NHL_Position_Code"', 1)[0]
            checked(db, prelude[prelude.index("create schema extensions;"):])
            checked(db, application_sql(seed))
            checked(db, "set role service_role")
            for table, cols in shapes(item["tables"]).items():
                checked(db, f"select {', '.join(map(quote, cols))} from public.{quote(table)} limit 0")
            if checked(db, 'select count(*) from public.roster_optimizer_team_games where source_game_id=%s and source_metadata ? %s',
                       (GAME, "scheduleCoverage"))[0] != 2:
                raise RuntimeError("paired schedule missing")
            if checked(db, 'select canonical_position from public.fhfh_player_identities where nhl_player_id=%s', (CENTER,))[0] != 'C':
                raise RuntimeError("fixture center missing")
            if not checked(db, "select rolling_row ? 'player_id' from public.forge_latest_rolling_rows(%s,'all',%s,%s)",
                           ([CENTER], item["request"]["slateDate"], ["player_id"]))[0]:
                raise RuntimeError("rolling data missing")
            if not checked(db, "select count(*)=1 from public.forge_latest_trend_bands(%s,%s,%s,%s)",
                           ([CENTER], ["fantasy_score"], ["l5"], item["request"]["slateDate"]))[0]:
                raise RuntimeError("trend data unavailable")
            if not checked(db, "select count(*)=4 from public.forge_league_skater_physical_totals(20262027,%s)",
                           (item["request"]["slateDate"],))[0]:
                raise RuntimeError("physical rates unavailable")
            if checked(db, "select count(*) from public.forge_runs")[0]:
                raise RuntimeError("output must start empty")
            if checked(db, "select has_table_privilege('anon','public.rosters','select') or has_function_privilege('anon',"
                       "'public.forge_pregame_capture_claim_v1'::regproc, 'execute')")[0]:
                raise RuntimeError("unexpected anonymous rehearsal privilege")
            if binary:
                checked(db, "reset role; create role fixture_authenticator login noinherit; grant service_role, anon to fixture_authenticator")
        if binary:
            postgrest_check(binary.resolve(), namespace, item)
    print("Socket-only PostgreSQL passed: generated application SQL, captured columns, native seed and three reader RPCs.")

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--start", required=True, help="synthetic puck drop in ISO 8601 UTC")
    output = ap.add_mutually_exclusive_group(required=True)
    output.add_argument("--out", type=Path, help="new SQL output file (never applied by this command)")
    output.add_argument("--check-local", action="store_true", help="run an isolated disposable PostgreSQL verification")
    output.add_argument("--check-postgrest", type=Path, metavar="BINARY", help="also check capture, publication and readers through loopback PostgREST with a local TSA")
    args = ap.parse_args()
    start = datetime.fromisoformat(args.start.replace("Z", "+00:00"))
    if start.utcoffset() is None or not 75*60 < (start-datetime.now(timezone.utc)).total_seconds() < 7*86400:
        ap.error("choose a puck drop more than 75 minutes and less than seven days ahead")
    item = world(start)
    seed = add_seed(item)
    if args.check_local or args.check_postgrest:
        check_local(item, seed, args.check_postgrest)
    else:
        with args.out.open("x") as out:
            out.write("begin;\n" + EMPTY_PROJECT + application_sql(seed) + "\nnotify pgrst, 'reload schema';\ncommit;\n")
        print(f"Created {args.out} for game {GAME}, season 20262027, center {CENTER}, "
              f"slate {item['request']['slateDate']}, start {item['request']['scheduledStart']}. No dispatch registered.")

if __name__ == "__main__":
    main()

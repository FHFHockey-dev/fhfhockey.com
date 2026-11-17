#!/usr/bin/env python3
"""Disposable PostgreSQL 15 dispatch regression. Net and Vault are local SQL fixtures.

Run: LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_pregame_hosted_dispatch.py --with-route
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack, contextmanager
from datetime import timedelta
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
PG = Path(os.environ.get("FORGE_TEST_PG_BIN", "/opt/homebrew/opt/postgresql@15/bin"))
CUSTODY = ROOT / "supabase/migrations/20261115000000_forge_pregame_capture_custody.sql"
HOSTED = ROOT / "supabase/migrations/20261117215012_forge_pregame_hosted_dispatch.sql"
SHA = "1" * 40
WRONG_SHA = "2" * 40
SECRET = "local-fixture-not-a-real-secret-012345"

BOOTSTRAP = """
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role supa_owner login nosuperuser in role pg_read_all_stats;
grant create on database postgres to supa_owner;
grant create, usage on schema public to supa_owner;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to supa_owner;
create schema vault authorization supa_owner;
create schema net authorization supa_owner;
"""

FIXTURES = """
create table public.games (id bigint primary key, date date not null, "seasonId" bigint not null,
  "startTime" timestamptz not null, "homeTeamId" smallint not null, "awayTeamId" smallint not null);
create table public.roster_optimizer_team_games (
  source_game_id bigint not null, source_season_id bigint not null, game_date date not null,
  team_id smallint not null, start_time timestamptz not null, team_abbreviation character(3) not null,
  game_status text not null, schedule_status text not null, fetched_at timestamptz not null
);
create table vault.decrypted_secrets (name text, decrypted_secret text);
create table net.test_requests (
  id bigint generated always as identity, url text, body jsonb, headers jsonb, timeout_ms integer
);
create function net.http_post(url text, body jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 2000)
returns bigint language sql as $$
  insert into net.test_requests(url, body, headers, timeout_ms) values ($1, $2, $4, $5) returning id;
$$;
"""


def row(conn, sql, args=None):
    with conn.cursor() as cursor:
        cursor.execute(sql, args)
        return cursor.fetchone() if cursor.description else None


def expect(label, actual, expected):
    if actual != expected:
        raise AssertionError(f"{label}: got {actual!r}, expected {expected!r}")
    print(f"PASS {label}")


def exercise(connect):
    with connect("postgres") as admin:
        row(admin, BOOTSTRAP)
    with connect("supa_owner") as owner, connect("postgres", "service_role") as service:
        row(owner, FIXTURES)
        row(owner, CUSTODY.read_text())
        row(owner, HOSTED.read_text())
        today = row(owner, "select (current_timestamp at time zone 'America/New_York')::date")[0]

        def tick():
            return row(owner, "select forge_pregame_capture.hosted_tick_v1()")[0]

        def requests():
            return row(owner, "select count(*) from net.test_requests")[0]

        def approve(first=today, last=None, canary=None, enabled=True):
            row(owner, """
                insert into forge_pregame_capture.hosted_slates
                  (slate_date,last_slate_date,expected_code_version,enabled,canary_game_id,canary_scheduled_start)
                values (%s,%s,%s,%s,%s,(select "startTime" from public.games where id=%s))
            """, (first, last, SHA, enabled, canary, canary))

        def reset():
            row(owner, "truncate forge_pregame_capture.hosted_games, forge_pregame_capture.hosted_slates, net.test_requests, public.games, public.roster_optimizer_team_games")

        def game(game_id, minutes=71, offset=0, status="FUT", schedule_status="OK"):
            row(owner, """
                insert into public.games
                select %s, %s::date + %s, 20262027, current_timestamp + make_interval(mins => %s), 10, 20
            """, (game_id, today, offset, minutes))
            row(owner, """
                insert into public.roster_optimizer_team_games
                select g.id, g."seasonId", g.date, t.team_id, g."startTime", t.label, %s, %s, clock_timestamp()
                from public.games g cross join (values (10, 'AAA'), (20, 'BBB')) t(team_id,label)
                where g.id=%s
            """, (status, schedule_status, game_id))

        def job(game_id):
            return row(owner, """
                select state, outcome, reason, dispatch_id::text from forge_pregame_capture.hosted_games where game_id=%s
            """, (game_id,))

        def begin(dispatch_id, sha=SHA, conn=service):
            return row(conn, "select * from public.forge_pregame_hosted_begin_v1(%s,%s)", (dispatch_id, sha))

        def finish(dispatch_id, outcome, reason=None, stop=None):
            return row(service, "select * from public.forge_pregame_hosted_finish_v1(%s,%s,%s,%s,%s)",
                       (dispatch_id, SHA, outcome, reason, stop))

        def reconcile(game_id):
            return row(owner, "select forge_pregame_capture.hosted_reconcile_v1(%s)", (game_id,))[0]

        for role in ("anon", "authenticated"):
            with connect("postgres", role) as client:
                expect(f"{role} denies both RPCs", row(client, """
                    select has_function_privilege('public.forge_pregame_hosted_begin_v1(uuid,text)','EXECUTE'),
                           has_function_privilege('public.forge_pregame_hosted_finish_v1(uuid,text,text,text,text)','EXECUTE')
                """), (False, False))
        expect("service role has RPCs without private or Cron access", row(service, """
            select has_function_privilege('public.forge_pregame_hosted_begin_v1(uuid,text)','EXECUTE'),
                   has_function_privilege('public.forge_pregame_hosted_finish_v1(uuid,text,text,text,text)','EXECUTE'),
                   has_function_privilege((select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                     where n.nspname='forge_pregame_capture' and p.proname='hosted_tick_v1'),'EXECUTE'),
                   has_schema_privilege('forge_pregame_capture','USAGE')
        """), (True, True, False, False))
        game(1)
        game(2)
        approve(canary=1, enabled=False)
        expect("default disabled approval has zero requests", (tick(), requests()), ("disabled", 0))
        row(owner, "insert into vault.decrypted_secrets values ('forge_pregame_dispatch_secret',%s)", (SECRET,))
        row(owner, "update forge_pregame_capture.hosted_slates set enabled=true")
        expect("explicit canary schedules one POST", (tick(), requests(), job(2)), ("queued", 1, None))
        fence = job(1)[3]
        signed = hmac.new(SECRET.encode(), fence.encode(), hashlib.sha256).hexdigest()
        expect("POST has only fenced UUID and HMAC", row(owner, "select url,body,headers,timeout_ms from net.test_requests"), (
            "https://fhfhockey.com/api/v1/db/forge-pregame-capture", {"dispatchId": fence},
            {"Content-Type": "application/json", "X-Forge-Dispatch-Signature": signed}, 420000))
        expect("SHA mismatch leaves queued", (begin(fence, WRONG_SHA)[0], job(1)[0]), ("pin_mismatch", "queued"))
        expect("finish before begin fails", finish(fence, "never_dispatched"), ("not_started", None))
        with connect("postgres", "service_role", autocommit=False) as first:
            started = begin(fence, conn=first)
            expect("begin exposes trusted game/date/policy", (started[0], started[1], started[2], started[5]),
                   ("started", 1, today, "pregame-native-v1"))
            expect("simultaneous duplicate cannot consume", begin(fence)[0], "duplicate")
        expect("consumed UUID cannot begin again", begin(fence)[0], "duplicate")
        expect("finish cannot forge qualification", finish(fence, "qualified"), ("outcome_mismatch", "unresolved"))
        expect("mismatched custody blocks next tick", tick(), "awaiting_reconciliation")
        expect("early reconcile cannot decide absence", reconcile(1), "awaiting_deadline")
        row(owner, """update public.games set "startTime"=clock_timestamp()+interval '30 minutes' where id=1""")
        row(owner, """update forge_pregame_capture.hosted_games set scheduled_start=clock_timestamp()+interval '30 minutes' where game_id=1""")
        expect("owner resolves no-claim without re-POST", (reconcile(1), tick(), requests()), ("never_dispatched", "stopped", 1))

        reset()
        game(11)
        game(12, offset=1)
        game(13, offset=2)
        game(14, minutes=62)
        game(15, status="PPD")
        game(16, status="FUT", schedule_status="TBD")
        game(17, minutes=80, offset=1)
        approve(last=today + timedelta(days=1))
        expect("first date dispatched, misses and noneligible explicit", (
            tick(), job(14)[:3], job(15)[:3], job(16)[:3], job(13)), (
            "queued", ("finished", "never_dispatched", "window_missed"),
            ("finished", "never_dispatched", "ineligible"),
            ("finished", "never_dispatched", "ineligible"), None))
        expect("active slot blocks other date", (tick(), requests()), ("in_flight", 1))
        first_fence = job(11)[3]
        expect("first date begin", begin(first_fence)[0], "started")
        expect("definite preclaim refusal persisted", finish(first_fence, "never_dispatched", "schedule_unavailable"),
               ("finished", "never_dispatched"))
        expect("duplicate finish preserves first outcome", finish(first_fence, "qualified"), ("duplicate", "never_dispatched"))
        expect("preclaim outcome exists in authoritative custody", row(owner, """
            select outcome,metadata from forge_pregame_capture.outcomes where game_id=11
        """), ("never_dispatched", {"reason": "schedule_unavailable"}))
        expect("second approved date dispatches unattended", (tick(), requests(), job(12)[0]), ("queued", 2, "queued"))
        second_fence = job(12)[3]
        row(owner, "update forge_pregame_capture.hosted_games set stale_at=clock_timestamp()-interval '1 second' where game_id=12")
        expect("lost delivery halts whole range and cannot resend",
               (tick(), begin(second_fence)[0], tick(), requests(), job(17)[:3]),
               ("awaiting_reconciliation", "duplicate", "awaiting_reconciliation", 2,
                ("finished", "never_dispatched", "slate_stopped")))

        reset()
        game(21)
        game(22)
        game(23, minutes=80)
        approve()
        expect("first simultaneous game queued once", tick(), "queued")
        fence = job(21)[3]
        row(owner, """update public.games set "startTime" = "startTime" + interval '5 minutes' where id=21""")
        expect("schedule move after enqueue refuses begin", (begin(fence)[0], job(21)[:3]),
               ("schedule_changed", ("finished", "never_dispatched", "schedule_changed")))
        expect("second simultaneous game gets its own fence", (tick(), requests(), job(22)[0]), ("queued", 2, "queued"))
        fence = job(22)[3]
        started = begin(fence)
        claim = row(service, """
          select claim_id from public.forge_pregame_capture_claim_v1(
            %s,'pregame-native-v1',%s,10::smallint,20::smallint,repeat('a',64),%s,240000,%s)
        """, (started[1], started[2], started[3], SHA))[0]
        expect("actual custody claim exists", claim is not None, True)
        row(owner, "update forge_pregame_capture.hosted_games set stale_at=clock_timestamp()-interval '1 second' where game_id=22")
        expect("crashed handler keeps claim fenced and undispatched siblings blocked",
               (tick(), reconcile(22), requests(), job(23)[:3]),
               ("awaiting_reconciliation", "custody_unresolved", 2,
                ("finished", "never_dispatched", "slate_stopped")))
        row(service, """
            select public.forge_pregame_capture_record_outcome_v1(22,'pregame-native-v1',%s,'save_unknown','{}')
        """, (claim,))
        expect("owner reconcile mirrors committed custody and preserves stop", (reconcile(22), tick(), requests()),
               ("save_unknown", "stopped", 2))

        def wait_for(sql, args):
            for _ in range(600):
                if row(owner, sql, args)[0]:
                    return
                time.sleep(0.02)
            raise AssertionError("database activity fixture never appeared")

        reset()
        game(31)
        game(32)
        approve()
        with ExitStack() as stack, ThreadPoolExecutor(max_workers=6) as pool:
            sessions = [stack.enter_context(connect("postgres")) for _ in range(6)]
            active = "select count(*) = %s from pg_stat_activity where pid = any(%s) and state = 'active'"
            try:
                for conn in sessions[:5]:
                    pool.submit(row, conn, "select pg_sleep(30)")
                wait_for(active, (5, [conn.get_backend_pid() for conn in sessions[:5]]))
                expect("five short active other sessions allowed",
                       row(owner, "select forge_pregame_capture.hosted_load_open()")[0], True)
                pool.submit(row, sessions[5], "select pg_sleep(30)")
                wait_for(active, (6, [conn.get_backend_pid() for conn in sessions]))
                expect("six active sessions block first dispatch", (tick(), requests()), ("load_gate_closed", 0))
                expect("second gate closure trips shared stop", (tick(), requests(), job(32)[:3]),
                       ("load_gate_closed", 0, ("finished", "never_dispatched", "slate_stopped")))
                for conn in sessions[1:]:
                    conn.cancel()
                wait_for("select query_start < clock_timestamp() - interval '10 seconds' "
                         "from pg_stat_activity where pid=%s", (sessions[0].get_backend_pid(),))
                expect("over-10-second active query blocks gate",
                       row(owner, "select forge_pregame_capture.hosted_load_open()")[0], False)
            finally:
                for conn in sessions:
                    conn.cancel()

        with connect("postgres") as blocker, connect("postgres") as waiter, ThreadPoolExecutor(max_workers=1) as pool:
            row(blocker, "select pg_advisory_lock(84512)")
            pool.submit(row, waiter, "select pg_advisory_lock(84512)")
            try:
                wait_for("select exists (select 1 from pg_locks where pid=%s and not granted)",
                         (waiter.get_backend_pid(),))
                expect("one genuine lock wait blocks gate",
                       row(owner, "select forge_pregame_capture.hosted_load_open()")[0], False)
            finally:
                waiter.cancel()

        reset()
        game(41)
        approve()
        expect("normal gate and transport recover for an approved range", tick(), "queued")
        fence = job(41)[3]
        expect("sanitized finish test admitted", begin(fence)[0], "started")
        expect("canonical result persists with separate timeout stop",
               finish(fence, "never_dispatched", "set_config_secret_not_allowed", "statement_timeout"),
               ("finished", "never_dispatched"))
        expect("unrecognized detail was discarded and separate stop recorded", (
            job(41)[:3], row(owner, "select stop_reason from forge_pregame_capture.hosted_slates")[0]),
            (("finished", "never_dispatched", "endpoint_finished"), "statement_timeout"))

        reset()
        game(51)
        game(52)
        game(53, minutes=90)
        approve()
        for game_id in (51, 52):
            expect(f"source failure game {game_id} queued", tick(), "queued")
            fence = job(game_id)[3]
            started = begin(fence)
            claim = row(service, """
                select claim_id from public.forge_pregame_capture_claim_v1(
                  %s,'pregame-native-v1',%s,10::smallint,20::smallint,repeat('a',64),%s,240000,%s)
            """, (started[1], started[2], started[3], SHA))[0]
            row(service, """
                select public.forge_pregame_capture_record_outcome_v1(
                  %s,'pregame-native-v1',%s,'source_failed','{}')
            """, (game_id, claim))
            expect(f"source failure game {game_id} mirrors custody", finish(fence, "source_failed", "source_failed"),
                   ("finished", "source_failed"))
        expect("two source failures block a healthy pending sibling", (tick(), requests(), job(53)[:3]),
               ("stopped", 2, ("finished", "never_dispatched", "slate_stopped")))


def main():
    with tempfile.TemporaryDirectory(prefix="forge-hosted-pg-") as tmp:
        data = str(Path(tmp) / "data")
        subprocess.run([PG / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-sync"],
                       check=True, capture_output=True)
        with open(Path(tmp) / "postgres.log", "w+") as log:
            server = subprocess.Popen([PG / "postgres", "-D", data, "-k", tmp, "-c", "listen_addresses=", "-c", "fsync=off"],
                                      stdout=log, stderr=log)

            @contextmanager
            def connect(user, role=None, autocommit=True):
                conn = psycopg2.connect(host=tmp, user=user, dbname="postgres")
                conn.autocommit = autocommit
                try:
                    if role:
                        row(conn, "set role " + role)
                    if autocommit:
                        yield conn
                    else:
                        with conn:
                            yield conn
                finally:
                    conn.close()

            try:
                for attempt in range(100):
                    try:
                        with connect("postgres"):
                            break
                    except psycopg2.OperationalError:
                        if attempt == 99:
                            log.seek(0)
                            raise RuntimeError(log.read()) from None
                        time.sleep(0.05)
                exercise(connect)
                if "--with-route" in sys.argv:
                    # Deliver the signed pg_net fixture request to the Pages handler. The game
                    # and every RPC live in this disposable Unix-socket-only cluster.
                    with connect("supa_owner") as owner:
                        row(owner, "truncate forge_pregame_capture.hosted_games, forge_pregame_capture.hosted_slates")
                        row(owner, """
                            insert into public.games select 2026020250, (start at time zone 'America/New_York')::date,
                              20262027, start, 10, 6 from (select date_trunc('milliseconds', clock_timestamp()) + interval '72 minutes' as start) s
                        """)
                        row(owner, """
                            insert into public.roster_optimizer_team_games
                            select g.id, g."seasonId", g.date, v.id, g."startTime", v.team, 'FUT', 'OK', clock_timestamp()
                            from public.games g cross join (values (10,'TOR'),(6,'BOS')) v(id,team) where g.id=2026020250
                        """)
                        row(owner, """insert into forge_pregame_capture.hosted_slates
                            (slate_date,expected_code_version,enabled,canary_game_id,canary_scheduled_start)
                            select date,%s,true,id,"startTime" from public.games where id=2026020250""", (SHA,))
                        expect("connected route canary queued", row(owner, "select forge_pregame_capture.hosted_tick_v1()")[0], "queued")
                        body, headers = row(owner, "select body,headers from net.test_requests order by id desc limit 1")
                    subprocess.run(["npm", "test", "--", "--run", "__tests__/pages/api/v1/db/forge-pregame-capture.test.ts",
                                    "-t", "disposable PostgreSQL"], cwd=ROOT / "web", check=True, env={
                                        **os.environ, "FORGE_TEST_PG_SOCKET": tmp, "FORGE_TEST_REQUEST": json.dumps([body, headers]),
                                        "FORGE_TEST_SIGNER": SECRET, "FORGE_TEST_SHA": SHA,
                                    })
            finally:
                subprocess.run([PG / "pg_ctl", "-D", data, "-m", "fast", "-w", "stop"],
                               check=True, capture_output=True)
                server.wait(timeout=10)


if __name__ == "__main__":
    main()

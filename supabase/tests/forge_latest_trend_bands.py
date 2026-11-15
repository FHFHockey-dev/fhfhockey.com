#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261115190000_forge_latest_trend_bands.sql (Claude capture lane, TJ
2026-11-15). Never applied to a hosted database.

The migration runs as a NON-superuser owner (as Supabase's postgres role is), against public.sustainability_trend_bands
with the production columns, primary key and both secondary indexes, plus anon, authenticated and service_role.

Refusals: null as-of date, empty or null-element lists, more than 1,000 keys (PostgREST would truncate silently).
Grants: only service_role may execute. Output: one row per distinct requested key in player, metric, window byte
order; nulls for a key without rows; the newest row on or before the as-of date per key (stale rows keep their dates,
later rows are ignored, a window missing on the newest date returns its own latest row). STABLE, SECURITY INVOKER,
search_path pinned. Rollback drops the function. The plan and scale evidence is the benchmark in
tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/.
Run: LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_latest_trend_bands.py
"""
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20261115190000_forge_latest_trend_bands.sql"
ROLLBACK = ROOT / "supabase/tests/forge_latest_trend_bands_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55543
METRICS = ["fantasy_score", "ixg_per_60", "shots_per_60", "points_per_60_5v5"]
WINDOWS = ["l5", "l10"]
AS_OF = "2026-11-14"

SETUP = """
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supa_owner login nosuperuser; grant create on database postgres to supa_owner;
grant create, usage on schema public to supa_owner; grant usage on schema public to service_role;
create table public.sustainability_trend_bands (
    player_id integer NOT NULL, season_id integer, snapshot_date date NOT NULL, metric_key text NOT NULL,
    window_code text NOT NULL, baseline numeric, ewma numeric, value numeric NOT NULL, ci_lower numeric NOT NULL,
    ci_upper numeric NOT NULL, n_eff numeric, prior_weight numeric, z_score numeric, percentile numeric,
    exposure numeric, distribution jsonb, computed_at timestamp with time zone DEFAULT now() NOT NULL,
    constraint sustainability_trend_bands_pkey primary key (player_id, snapshot_date, metric_key, window_code));
create index idx_stb_player_metric on public.sustainability_trend_bands (player_id, metric_key, snapshot_date desc);
create index idx_stb_snapshot on public.sustainability_trend_bands (snapshot_date desc);
grant select on public.sustainability_trend_bands to service_role;
"""

failures = []


def check(name, condition):
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)


def rows_for(cur):
    data = []
    # Player 1: every key on 11-10 .. 11-13, and also rows on 11-15 and 11-16 (after the as-of date).
    for day in ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-15", "2026-11-16"]:
        data += [(1, day, m, w, 5.0 if day <= AS_OF else 99.0) for m in METRICS for w in WINDOWS]
    # Player 2: hard-stale only (2026-09-30). Player 3: no rows. Player 5: l5 absent on its newest date 11-13.
    data += [(2, "2026-09-30", m, w, 3.0) for m in METRICS for w in WINDOWS]
    data += [(5, "2026-11-13", m, "l10", 6.0) for m in METRICS] + [(5, "2026-11-01", m, w, 7.0) for m in METRICS for w in WINDOWS]
    # Irrelevant keys the reader never asks for.
    data += [(1, "2026-11-13", "hits_per_60", "l3", 1.0), (2, "2026-11-13", "pdo", "l20", 1.0)]
    cur.executemany("insert into public.sustainability_trend_bands (player_id, snapshot_date, metric_key, window_code, value, "
                    "ci_lower, ci_upper, n_eff) values (%s, %s, %s, %s, %s, %s - 1, %s + 1, 6)", [(p, d, m, w, v, v, v) for p, d, m, w, v in data])


def call(cur, players, metrics=METRICS, windows=WINDOWS, as_of=AS_OF):
    cur.execute("select player_id, metric_key, window_code, snapshot_date::text, value::float8 from "
                "public.forge_latest_trend_bands(%s::integer[], %s::text[], %s::text[], %s::date)", (players, metrics, windows, as_of))
    return cur.fetchall()


def run(sock):
    admin = psycopg2.connect(host=sock, port=PORT, user="postgres", dbname="postgres")
    admin.autocommit = True
    acur = admin.cursor()
    acur.execute(SETUP)
    rows_for(acur)
    sql = MIGRATION.read_text()
    check("migration is ASCII only", all(ord(c) < 128 for c in sql))
    owner = psycopg2.connect(host=sock, port=PORT, user="supa_owner", dbname="postgres")
    owner.autocommit = True
    owner.cursor().execute(sql)
    owner.cursor().execute(sql)  # create or replace: re-running is harmless
    check("applies (twice) as a non-superuser owner", True)

    cur = admin.cursor()

    def refused(name, args, fragment, role="service_role"):
        try:
            cur.execute("begin")
            cur.execute(f"set local role {role}")
            call(cur, *args)
            check(name, False)
        except psycopg2.Error as error:
            check(name, fragment in str(error))
        finally:
            cur.execute("rollback")

    refused("refuses a null as-of date", ([1], METRICS, WINDOWS, None), "p_as_of is required")
    refused("refuses an empty player list", ([], METRICS, WINDOWS, AS_OF), "must be non-empty")
    refused("refuses an empty window list", ([1], METRICS, [], AS_OF), "must be non-empty")
    refused("refuses a null element", ([1, None], METRICS, WINDOWS, AS_OF), "must not be null")
    refused("refuses more than 1000 keys (126 players x 4 x 2)", (list(range(1, 127)), METRICS, WINDOWS, AS_OF), "1008 keys requested")
    refused("anon cannot execute", ([1],), "permission denied", role="anon")
    refused("authenticated cannot execute", ([1],), "permission denied", role="authenticated")

    cur.execute("begin")
    cur.execute("set local role service_role")
    result = call(cur, [5, 3, 2, 1, 1])
    at_limit = len(call(cur, list(range(1, 126))))
    cur.execute("rollback")
    keys = [(r[0], r[1], r[2]) for r in result]
    expected = [(p, m, w) for p in [1, 2, 3, 5] for m in sorted(METRICS) for w in sorted(WINDOWS)]
    check("one row per distinct key, ordered by player, metric, window in byte order (l10 before l5)", keys == expected)
    by = {(r[0], r[1], r[2]): (r[3], r[4]) for r in result}
    check("player 1: newest row on or before the as-of date, rows after it ignored",
          all(by[(1, m, w)] == ("2026-11-13", 5.0) for m in METRICS for w in WINDOWS))
    check("player 2: hard-stale rows come back with their date, not as missing", all(by[(2, m, w)][0] == "2026-09-30" for m in METRICS for w in WINDOWS))
    check("player 3: no rows gives null rows for every key", all(by[(3, m, w)] == (None, None) for m in METRICS for w in WINDOWS))
    check("player 5: l10 newest on 11-13, l5 returns its own latest (11-01)",
          all(by[(5, m, "l10")][0] == "2026-11-13" and by[(5, m, "l5")][0] == "2026-11-01" for m in METRICS))
    check("exactly 1000 keys (125 players x 8) is allowed", at_limit == 1000)

    acur.execute("select p.provolatile, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner), "
                 "has_function_privilege('service_role', p.oid, 'execute'), has_function_privilege('anon', p.oid, 'execute'), "
                 "has_function_privilege('authenticated', p.oid, 'execute') from pg_proc p where p.proname = 'forge_latest_trend_bands'")
    volatile, definer, config, owner_name, svc, anon, auth = acur.fetchone()
    check("STABLE, SECURITY INVOKER, search_path pinned", volatile == "s" and not definer and config == ["search_path=pg_catalog"])
    check("owned by the non-superuser owner; EXECUTE service_role only", owner_name == "supa_owner" and svc and not anon and not auth)

    owner.cursor().execute(ROLLBACK.read_text())
    acur.execute("select count(*) from pg_proc where proname = 'forge_latest_trend_bands'")
    check("rollback drops the function (the reader then sees PGRST202 and falls back)", acur.fetchone()[0] == 0)
    owner.close()
    admin.close()


def main():
    with tempfile.TemporaryDirectory(dir="/tmp") as tmp:
        data = Path(tmp) / "data"
        subprocess.run([PG / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-sync"], check=True, capture_output=True)
        server = subprocess.Popen([PG / "postgres", "-D", data, "-p", str(PORT), "-k", tmp, "-c", "listen_addresses=", "-c", "fsync=off"],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    psycopg2.connect(host=tmp, port=PORT, user="postgres", dbname="postgres").close()
                    break
                except psycopg2.OperationalError:
                    time.sleep(0.1)
            run(tmp)
        finally:
            server.kill()
            server.wait()
    print(f"{'FAILED' if failures else 'OK'}: {len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()

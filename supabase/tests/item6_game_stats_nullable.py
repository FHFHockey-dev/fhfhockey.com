#!/usr/bin/env python3
"""Offline Item 6 proof using disposable PostgreSQL 15 and a private Unix socket.

Run from the repo root under the shared heavy lock:
  LC_ALL=C python3 -I supabase/tests/item6_game_stats_nullable.py
No credentials, hosted calls, shared database or historical rewrites. The existing
L4a fixture supplies source-extracted table definitions and synthetic game rows.
"""
import copy
import json
import os
import re
import runpy
import shutil
import subprocess
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / "supabase/migrations/20261113190000_fix_team_goalie_game_stats_placeholders_nullable.sql"
PREVIOUS = ROOT / "supabase/migrations/20261111180900_fix_skater_game_stats_placeholders_nullable.sql"
ROLLBACK = ROOT / "supabase/tests/item6_game_stats_nullable_rollback.sql"
FIXTURE = runpy.run_path(str(ROOT / "supabase/tests/l4a_game_stats_nullable.py"))
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
RATIOS = ("evenStrengthShotsAgainst", "powerPlayShotsAgainst", "shorthandedShotsAgainst", "saveShotsAgainst")
FIELDS = ("powerPlayToi", *RATIOS, "toi")


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    print("PASS " + name, flush=True)


def function(sql):
    return re.search(r"CREATE OR REPLACE FUNCTION public\.persist_complete_game_stats_v1\(.*?\n\$\$;", sql, re.S).group()


def prove_exact_diff():
    candidate = function(FIX.read_text())
    previous = function(PREVIOUS.read_text())
    for field in FIELDS:
        ref = "incoming.toi" if field == "toi" else f'incoming."{field}"'
        pattern = "^[0-9]{1,3}:[0-5][0-9]$" if field in ("powerPlayToi", "toi") else "^[0-9]+[/-][0-9]+$"
        clause = f"and ({ref} is null or {ref} ~ '{pattern}')"
        check("one scoped nullable validation: " + field, candidate.count(clause) == 1)
        candidate = candidate.replace(clause, f"and {ref} is not null", 1)
    check("entire remaining RPC byte-identical to latest prior definition", candidate == previous)
    check("rollback restores latest prior RPC", function(ROLLBACK.read_text()) == previous)


def properties(cur):
    cur.execute("select pg_get_function_identity_arguments(oid), pg_get_function_result(oid), "
                "proconfig, prosecdef, proacl::text from pg_proc where proname = 'persist_complete_game_stats_v1'")
    return cur.fetchall()


def persist(cur, game, rows):
    try:
        cur.execute("select outcome from public.persist_complete_game_stats_v1(%s,%s::jsonb,%s::jsonb,%s::jsonb,2,2,2)",
                    (game, *(json.dumps(batch) for batch in rows)))
        return cur.fetchone()[0]
    except psycopg2.Error as error:
        return error.pgerror.splitlines()[0]


def snapshot(cur, game):
    result = []
    for table in ("teamGameStats", "skatersGameStats", "goaliesGameStats", "statsUpdateStatus"):
        cur.execute(f'SELECT to_jsonb(t) FROM public."{table}" t WHERE "gameId" = %s ORDER BY to_jsonb(t)::text', (game,))
        result.append(cur.fetchall())
    return result


def checks(cur, game, nullable):
    for variant in ("zero", "null", "missing"):
        rows = FIXTURE["payload"](game, skater_overrides={"faceoffs": None, "powerPlayToi": None, "shorthandedToi": None})
        for row in rows[0]:
            row["powerPlayToi"] = "00:00" if variant == "zero" else None
            if variant == "missing":
                del row["powerPlayToi"]
        for row in rows[2]:
            for key in (*RATIOS, "toi"):
                row[key] = ("00:00" if key == "toi" else "0/0") if variant == "zero" else None
                if variant == "missing":
                    del row[key]
        before = snapshot(cur, game)
        outcome = persist(cur, game, rows)
        if variant == "zero" or nullable:
            check(f"{variant} accepted in complete transaction", outcome == "complete")
            cur.execute('select "powerPlayToi" from public."teamGameStats" where "gameId"=%s', (game,))
            check(f"{variant} team clock stored exactly", cur.fetchall() == [("00:00" if variant == "zero" else None,)] * 2)
            cols = ','.join(f'"{key}"' for key in (*RATIOS, "toi"))
            cur.execute(f'select {cols} from public."goaliesGameStats" where "gameId"=%s', (game,))
            wanted = ("0/0", "0/0", "0/0", "0/0", "00:00") if variant == "zero" else (None,) * 5
            check(f"{variant} goalie fields stored exactly", cur.fetchall() == [wanted] * 2)
        else:
            check(f"fail-first {variant} rejected by previous RPC", "INVALID_TEAM_GAME_STATS_ROWS" in outcome)
            check("failed transaction leaves rows and manifest unchanged", snapshot(cur, game) == before)
        game += 1

    # Isolate each goalie field so the team guard cannot mask a goalie regression.
    for field in (*RATIOS, "toi"):
        rows = FIXTURE["payload"](game)
        rows[2][0][field] = None
        outcome = persist(cur, game, rows)
        check(f"isolated goalie {field}: expected null acceptance={nullable}",
              outcome == "complete" if nullable else "INVALID_GOALIE_GAME_STATS_ROWS" in outcome)
        game += 1

    # Preserve the complete prior rows and receipt across rejected updates.
    rows = FIXTURE["payload"](game)
    check("seed transaction", persist(cur, game, rows) == "complete")
    before = snapshot(cur, game)
    for label, batch, key, value in (
        ("team identity", 0, "gameId", game + 1), ("goalie identity", 2, "playerId", 0),
        ("required skater clock", 1, "toi", None), ("required goalie goals", 2, "goalsAgainst", None),
    ):
        bad = copy.deepcopy(rows)
        bad[batch][0][key] = value
        check(label + " rejected", persist(cur, game, bad) != "complete")
        check(label + " atomic rollback", snapshot(cur, game) == before)
    for batch in (0, 1, 2):
        bad = copy.deepcopy(rows)
        bad[batch].pop()
        check(f"batch {batch} cardinality still rejected", persist(cur, game, bad) != "complete")
        check("cardinality failure preserves prior receipt", snapshot(cur, game) == before)
    if nullable:
        for field in FIELDS:
            for value in ("", "malformed", "00:60" if field in ("toi", "powerPlayToi") else "0/x"):
                bad = copy.deepcopy(rows)
                bad[0 if field == "powerPlayToi" else 2][0][field] = value
                check(f"malformed {field} rejected: {value!r}", persist(cur, game, bad) != "complete")
                check("malformed payload rolls back rows and manifest", snapshot(cur, game) == before)


def main():
    prove_exact_diff()
    tmp = Path(tempfile.mkdtemp(prefix="item6-pg-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {key: value for key, value in os.environ.items() if key in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update(LC_ALL="C", LANG="C", TZ="UTC")
    started = False
    try:
        subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"],
                       env=env, check=True, capture_output=True)
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(tmp / "server.log"), "-o", f"-p 55496 -k {sock} -h ''", "-w", "start"],
                       env=env, check=True, capture_output=True)
        started = True
        conn = psycopg2.connect(host=str(sock), port=55496, user="postgres", dbname="postgres")
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(FIXTURE["schema"]())
        cur.execute(PREVIOUS.read_text())
        # Reproduce the baseline ACL, then prove CREATE OR REPLACE retains it.
        cur.execute("revoke all on function public.persist_complete_game_stats_v1(bigint,jsonb,jsonb,jsonb,integer,integer,integer) from public; "
                    "grant all on function public.persist_complete_game_stats_v1(bigint,jsonb,jsonb,jsonb,integer,integer,integer) to service_role")
        for game in range(100, 160):
            cur.execute('insert into public.games(id,date,"seasonId",type,"homeTeamId","awayTeamId") values (%s,\'2025-11-01\',20252026,2,1,2)', (game,))
        before_columns, before_props = FIXTURE["column_state"](cur), properties(cur)
        checks(cur, 100, False)
        cur.execute(FIX.read_text())
        cur.execute(FIX.read_text())
        checks(cur, 120, True)
        changes = [(a, b) for a, b in zip(before_columns, FIXTURE["column_state"](cur)) if a != b]
        expected = [(a, (a[0], a[1], "YES", a[3])) for a in before_columns
                    if (a[0] == "teamGameStats" and a[1] == "powerPlayToi") or (a[0] == "goaliesGameStats" and a[1] in RATIOS)]
        check("exactly five columns nullable; defaults unchanged", changes == expected)
        check("signature, result, ACL, invoker and search path unchanged", properties(cur) == before_props)
        try:
            cur.execute(ROLLBACK.read_text())
        except psycopg2.Error:
            cur.execute("rollback")
        else:
            raise AssertionError("rollback must refuse unknowns")
        check("refused rollback leaves nullable schema intact", properties(cur) == before_props and FIXTURE["column_state"](cur) != before_columns)
        # Delete only synthetic fixture rows to prove reversibility; never a production repair recipe.
        cur.execute('delete from public."goaliesGameStats" where toi is null or "evenStrengthShotsAgainst" is null or "powerPlayShotsAgainst" is null or "shorthandedShotsAgainst" is null or "saveShotsAgainst" is null')
        cur.execute('delete from public."teamGameStats" where "powerPlayToi" is null')
        cur.execute(ROLLBACK.read_text())
        check("rollback restores schema and function metadata", FIXTURE["column_state"](cur) == before_columns and properties(cur) == before_props)
        checks(cur, 140, False)
        conn.close()
        print("RESULT OK", flush=True)
    finally:
        if started:
            subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "-w", "stop"], env=env, check=True, capture_output=True)
        shutil.rmtree(tmp)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        print((error.stderr or b"").decode(errors="replace"), flush=True)
        raise

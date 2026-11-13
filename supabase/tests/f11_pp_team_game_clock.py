#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261113220000_pp_team_game_clock.sql (owner decision 152; math-audit
follow-up lane F11). Never applied to a hosted database.

Schema: games and powerPlayCombinations exactly as the production baseline (20260716112908) defines them, a minimal
players table for the playerId foreign key, and the anon, authenticated and service_role roles. One game,
2026020174 (home 29, away 54), seeded with 12 stored rows written by the earlier writer: 2 stale pre-11-01 players
(decision-152 group A) and 4 players short of their overtime PP seconds (group B).

Defect check (FAIL before, PASS after): no transactional replace exists before; after, one call replaces the
game's rows as one set: the 2 stale rows are gone, the 4 OT players carry their full time, the clock rows are
stored, and every row carries calculation_version and computed_at.
Controls: existing rows keep every value (new columns null); grants and RLS; the RPC is service_role only.
Refusals leave the stored set unchanged (atomic, including failures raised after the delete): player rows for an
unavailable team-game, PPTOI above the clock, a capped or wrong share, PPTOI not summing to skater_seconds, a
PP1 of 6, a duplicate player, a missing or foreign team clock row, an unknown player, an available clock with
skater-seconds below 3 x clock, a not-applicable clock that isn't 0 and an unavailable clock with no reason.
A qualified clock of 0 is stored as not applicable with no player rows. Rollback drops exactly what was added.
Run: LC_ALL=C python3 -I supabase/tests/f11_pp_team_game_clock.py (needs Homebrew postgresql@15 and psycopg2).
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BASE = (ROOT / "supabase/migrations/20260716112908_production_schema_baseline.sql").read_text()
FIX = ROOT / "supabase/migrations/20261113220000_pp_team_game_clock.sql"
ROLLBACK = ROOT / "supabase/tests/f11_pp_team_game_clock_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55532
G, HOME, AWAY = 2026020174, 29, 54
VERSION, AT = "pp-shifts-qualified-clock-v1", "2026-11-13T22:00:00Z"
FN = "public.replace_power_play_game_v1(bigint, text, timestamp with time zone, jsonb, jsonb)"

# Team 29's ten skaters as the stored calculation computes them (clock 284 s; shifts within the qualified spans,
# including 44 s of overtime). Units follow the writer's pivot rule.
NEW = [  # player, unit, PPTOI
    (8478460, 1, 203), (8475745, 1, 161), (8482660, 1, 158), (8477501, 1, 119), (8476923, 1, 115),
    (8484166, 2, 169), (8477497, 2, 125), (8478856, 2, 123), (8482720, 2, 121), (8483485, 2, 82),
]
CLOCK = 284
# The earlier writer's rows: four OT players short by 44 s and two stale players with no PP time.
OLD = [(p, u, t - 44 if p in (8478460, 8484166, 8475745, 8482660) else t) for p, u, t in NEW] + [
    (8470001, 2, 33), (8470002, 3, 39)]


def grab(text, pattern):
    found = re.search(pattern, text, re.S)
    assert found, pattern
    return found.group(0)


def schema():
    return "\n".join([
        grab(BASE, r"CREATE TABLE public\.games \(\n.*?\n\);\n"),
        "alter table public.games add constraint games_pkey primary key (id);",
        "create table public.players (id bigint primary key);",
        grab(BASE, r'CREATE TABLE public\."powerPlayCombinations" \(\n.*?\n\);\n'),
        'alter table public."powerPlayCombinations" add constraint "powerPlayCombinations_pkey" primary key ("gameId", "playerId");',
        'alter table public."powerPlayCombinations" add constraint "powerPlayCombinations_gameId_fkey" foreign key ("gameId") '
        "references public.games(id) on update cascade on delete cascade;",
        'alter table public."powerPlayCombinations" add constraint "powerPlayCombinations_playerId_fkey" foreign key ("playerId") '
        "references public.players(id) on update cascade on delete cascade;",
        'alter table public."powerPlayCombinations" enable row level security;',
        'create policy "Enable read access for all users" on public."powerPlayCombinations" for select using (true);',
        'grant select, insert, references, delete, trigger, truncate, update on table public."powerPlayCombinations" '
        "to anon, authenticated, service_role;",
    ])


def seed(cur):
    cur.execute('insert into public.games (id, date, "seasonId", "startTime", type, "homeTeamId", "awayTeamId") '
                f"values ({G}, '2026-10-24', 20262027, '2026-10-24T23:00:00Z', 2, {HOME}, {AWAY})")
    players = {p for p, _, _ in NEW + OLD} | {8499999}
    cur.execute("insert into public.players (id) select unnest(%s::bigint[])", (sorted(players),))
    for p, unit, toi in OLD:
        cur.execute('insert into public."powerPlayCombinations" ("gameId", "playerId", unit, "percentageOfPP", "PPTOI", '
                    "pp_unit_usage_index, pp_unit_relative_toi, pp_vs_unit_avg, pp_share_of_team) "
                    "values (%s, %s, %s, 1, %s, 1, 0, 0, %s)", (G, p, unit, toi, round(toi / CLOCK, 6)))


def player_rows(rows=NEW, clock=CLOCK, team=HOME):
    return [{"gameId": G, "playerId": p, "team_id": team, "unit": u, "PPTOI": t, "percentageOfPP": 1,
             "pp_unit_usage_index": 1, "pp_unit_relative_toi": 0, "pp_vs_unit_avg": 0,
             "pp_share_of_team": round(t / clock, 6)} for p, u, t in rows]


def clock_rows(home=None, away=None):
    base = {"game_id": G, "qualified": True, "reference_source": "teamGameStats", "official_class": "nonzero",
            "penalty_summary_seconds": None, "audit_checked_events": 4, "audit_disagreements": 0}
    rows = [
        {**base, "team_id": HOME, "availability": "available", "unavailable_reason": None, "clock_seconds": CLOCK,
         "official_seconds": CLOCK, "skater_seconds": sum(t for _, _, t in NEW)},
        {**base, "team_id": AWAY, "availability": "unavailable", "clock_seconds": 120, "official_seconds": 120,
         "skater_seconds": 0, "unavailable_reason": "Stored shifts cover 0 skater-seconds of PP, below 3 x the 120 s clock."},
    ]
    rows[0].update(home or {})
    rows[1].update(away or {})
    return rows


def call(cur, clocks, players, version=VERSION):
    try:
        cur.execute(f"select * from public.replace_power_play_game_v1(%s, %s, %s, %s::jsonb, %s::jsonb)",
                    (G, version, AT, json.dumps(clocks), json.dumps(players)))
        return cur.fetchall(), None
    except psycopg2.Error as e:
        return None, (e.pgcode, e.diag.message_primary)


def stored(cur):
    cur.execute('select "playerId", unit, "PPTOI", pp_share_of_team from public."powerPlayCombinations" '
                f'where "gameId" = {G} order by 1')
    return cur.fetchall()


def stored_clock(cur):
    cur.execute(f"select team_id, availability, clock_seconds, unavailable_reason from public.pp_team_game_clock "
                f"where game_id = {G} order by 1")
    return cur.fetchall()


def state(cur):
    cur.execute("select table_name, column_name, data_type, is_nullable from information_schema.columns "
                "where table_schema = 'public' order by 1, 2")
    cols = cur.fetchall()
    cur.execute("select conrelid::regclass::text, conname from pg_catalog.pg_constraint "
                "where connamespace = 'public'::regnamespace order by 1, 2")
    cons = cur.fetchall()
    cur.execute("select routine_name from information_schema.routines where routine_schema = 'public' order by 1")
    fns = cur.fetchall()
    cur.execute("select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) "
                "from information_schema.role_table_grants where table_schema = 'public' group by 1, 2 order by 1, 2")
    grants = cur.fetchall()
    return cols, cons, fns, grants


def connect(sock, db):
    conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname=db)
    conn.autocommit = True
    return conn, conn.cursor()


def fresh(sock, admin, name):
    admin.execute(f"create database {name}")
    conn, cur = connect(sock, name)
    cur.execute(schema())
    seed(cur)
    return conn, cur


def report(name, good, detail=""):
    print(f"  {'PASS' if good else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}")
    return good


def main():
    tmp = Path(tempfile.mkdtemp(prefix="f11ppclock-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"],
                   env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"],
                   env=env, check=True, capture_output=True)
    ok = True
    try:
        admin_conn, admin = connect(sock, "postgres")
        admin.execute("create role anon; create role authenticated; create role service_role")

        print("phase 1: starting state (the earlier writer's rows)")
        conn, cur = fresh(sock, admin, "before")
        st0 = state(cur)
        _, err = call(cur, clock_rows(), player_rows())
        ok &= report("no transactional replace exists before (the defect: stale rows stay beside newer ones)",
                     err is not None and err[0] == "42883", err)
        conn.close()

        print("phase 2: apply the migration")
        conn, cur = fresh(sock, admin, "after")
        before = stored(cur)
        cur.execute(FIX.read_text())
        after = stored(cur)
        cur.execute('select count(*) from public."powerPlayCombinations" '
                    "where calculation_version is not null or computed_at is not null")
        ok &= report("existing rows keep every value; the new columns are null", after == before and cur.fetchone()[0] == 0)
        st1 = state(cur)
        added = [c for c in st1[0] if c not in st0[0]]
        ok &= report("powerPlayCombinations gains two nullable columns",
                     [c for c in added if c[0] == "powerPlayCombinations"] == [
                         ("powerPlayCombinations", "calculation_version", "text", "YES"),
                         ("powerPlayCombinations", "computed_at", "timestamp with time zone", "YES")], added)
        ok &= report("powerPlayCombinations grants unchanged",
                     [g for g in st1[3] if g[0] == "powerPlayCombinations"] == [g for g in st0[3] if g[0] == "powerPlayCombinations"])
        ok &= report("pp_team_game_clock grants (besides the owner): anon and authenticated read, service_role writes",
                     [g[1:] for g in st1[3] if g[0] == "pp_team_game_clock" and g[1] != "postgres"] == [
                         ("anon", "SELECT"), ("authenticated", "SELECT"), ("service_role", "DELETE,INSERT,SELECT,UPDATE")],
                     [g for g in st1[3] if g[0] == "pp_team_game_clock"])
        cur.execute("select relrowsecurity from pg_catalog.pg_class where oid = 'public.pp_team_game_clock'::regclass")
        ok &= report("pp_team_game_clock has RLS", cur.fetchone()[0] is True)
        cur.execute(f"select has_function_privilege(r, '{FN}', 'execute') from unnest(array['anon', 'authenticated', "
                    "'service_role']) as r")
        ok &= report("replace RPC executable by service_role only", [r[0] for r in cur.fetchall()] == [False, False, True])

        print("phase 3: transactional replace")
        receipt, err = call(cur, clock_rows(), player_rows())
        ok &= report("one call replaces the game's set (12 earlier rows out, 10 in, 2 clock rows)",
                     err is None and receipt == [(G, 12, 10, 2)], receipt or err)
        ok &= report("group A: the 2 stale players are gone", not any(r[0] in (8470001, 8470002) for r in stored(cur)))
        ok &= report("group B: the 4 OT players carry their full time (203, 169, 161, 158 s)",
                     {r[0]: r[2] for r in stored(cur) if r[0] in (8478460, 8484166, 8475745, 8482660)} ==
                     {8478460: 203, 8484166: 169, 8475745: 161, 8482660: 158})
        cur.execute(f'select count(*) from public."powerPlayCombinations" where "gameId" = {G} '
                    f"and calculation_version = '{VERSION}' and computed_at = '{AT}'")
        ok &= report("every row carries calculation_version and computed_at", cur.fetchone()[0] == 10)
        ok &= report("clock rows stored (home available 284 s; away unavailable with its reason)",
                     [r[:3] for r in stored_clock(cur)] == [(HOME, "available", CLOCK), (AWAY, "unavailable", 120)],
                     stored_clock(cur))
        good = (stored(cur), stored_clock(cur))
        receipt, err = call(cur, clock_rows(), player_rows())
        ok &= report("replaying the same set is idempotent", err is None and receipt == [(G, 10, 10, 2)]
                     and (stored(cur), stored_clock(cur)) == good, receipt or err)

        print("phase 4: refusals leave the stored set unchanged")
        bad_share = player_rows()
        bad_share[0]["pp_share_of_team"] = 1.0
        over = player_rows([(8478460, 1, 300)] + NEW[1:])
        dup = player_rows(NEW + [NEW[0]])
        six = player_rows([(p, 1, t) for p, _, t in NEW[:6]] + NEW[6:])
        stranger = player_rows(NEW + [(8499998, 3, 1)])
        cases = [
            ("player rows for an unavailable team-game", clock_rows(),
             player_rows() + player_rows([(8499999, 1, 60)], clock=120, team=AWAY), "PP_GAME_REPLACE_PLAYER_ROWS"),
            ("PPTOI above the clock", clock_rows(home={"skater_seconds": sum(t for _, _, t in NEW) + 97}), over,
             "PP_GAME_REPLACE_PLAYER_ROWS"),
            ("a capped share (1.0 for 203 of 284 s)", clock_rows(), bad_share, "PP_GAME_REPLACE_PLAYER_ROWS"),
            ("PPTOI not summing to skater_seconds", clock_rows(home={"skater_seconds": 2000}), player_rows(),
             "PP_GAME_REPLACE_PLAYER_ROWS"),
            ("a PP1 of 6 players", clock_rows(), six, "PP_GAME_REPLACE_PLAYER_ROWS"),
            ("a duplicate player", clock_rows(home={"skater_seconds": sum(t for _, _, t in NEW) + 203}), dup,
             "PP_GAME_REPLACE_PLAYER_ROWS"),
            ("one clock row", clock_rows()[:1], player_rows(), "PP_GAME_REPLACE_CLOCK_TEAMS"),
            ("a team not in the game", clock_rows(away={"team_id": 1}), player_rows(), "PP_GAME_REPLACE_CLOCK_TEAMS"),
            ("an unknown player (foreign key, raised after the delete)",
             clock_rows(home={"skater_seconds": sum(t for _, _, t in NEW) + 1}), stranger, "23503"),
            ("available with skater-seconds below 3 x clock (CHECK, raised after the delete)",
             clock_rows(home={"skater_seconds": 600}), player_rows([(p, u, 60) for p, u, _ in NEW]), "23514"),
            ("not applicable with a clock above 0", clock_rows(away={"availability": "not_applicable",
                                                                      "unavailable_reason": None, "clock_seconds": 5}),
             player_rows(), "23514"),
            ("unavailable with no reason", clock_rows(away={"unavailable_reason": None}), player_rows(), "23514"),
        ]
        for name, clocks, players, expected in cases:
            _, err = call(cur, clocks, players)
            unchanged = (stored(cur), stored_clock(cur)) == good
            ok &= report(f"refused: {name}; stored set unchanged", err is not None and expected in err and unchanged, err)

        print("phase 5: availability")
        receipt, err = call(cur, clock_rows(away={"availability": "not_applicable", "unavailable_reason": None,
                                                  "clock_seconds": 0, "official_class": "zero", "official_seconds": 0,
                                                  "skater_seconds": None}), player_rows())
        ok &= report("a qualified clock of 0 is stored as not applicable, with no player rows",
                     err is None and [r[:3] for r in stored_clock(cur)][1] == (AWAY, "not_applicable", 0)
                     and len(stored(cur)) == 10, receipt or err)
        receipt, err = call(cur, clock_rows(home={"availability": "unavailable", "qualified": False,
                                                  "unavailable_reason": "The clock differs from the official team PP total by +28 s.",
                                                  "skater_seconds": None}), [])
        ok &= report("an unavailable team-game has no player rows (the earlier set is removed, never capped)",
                     err is None and stored(cur) == [] and stored_clock(cur)[0][1] == "unavailable", receipt or err)

        print("phase 6: rollback")
        call(cur, clock_rows(), player_rows())
        rows_now = stored(cur)
        cur.execute(ROLLBACK.read_text())
        st2 = state(cur)
        ok &= report("rollback restores the columns, constraints, functions and grants exactly", st2 == st0,
                     [i for i in range(4) if st2[i] != st0[i]])
        ok &= report("player rows survive the rollback", stored(cur) == rows_now)
        conn.close()
        admin_conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

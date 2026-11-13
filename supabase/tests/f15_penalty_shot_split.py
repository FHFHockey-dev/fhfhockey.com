#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261113200000_forge_strength_penalty_shot_split.sql
(math-audit fix lane F15; owner decision 149, Astra AF-07: penalty shots count in all-situations only).
Never applied to a hosted database.

Schema: games, the strength and goalie tables with their primary keys (production baseline 20260716112908),
the raw-payload table, snapshot heads, projection status and persist_projection_game_derived_v1 exactly as
20260720105524 defines them, and the pbp_plays columns the writer reads. One game, 2026020065 (home 54,
away 10), with a 5v5 shot, a home penalty-shot goal (1010), an away penalty-shot save (0101), a home
penalty-shot miss, an away power-play goal and a shootout goal.

Defect checks (FAIL before, PASS after): a split payload (penalty shots in shots_ps / goals_ps, never in ES)
is stored, and its all-situation shots and goals (ES + PP + PK + PS) equal the official totals: home 2
shots / 1 goal, away 2 shots / 1 goal; the miss and the shootout goal count nowhere.
Controls (PASS before and after): the released code's legacy payload through v1 gives the same receipt and
the same rows; existing rows keep their values and are marked legacy (null); grants unchanged.
Also: replaying a split payload is idempotent; v1 rewrites a split game back to legacy without losing a
shot; mixed markers, a penalty-shot count that differs from the stored play-by-play (including a shootout
goal counted as a penalty shot), team PS != sum of player PS, goals_ps > shots_ps, marker 2 and a
legacy row carrying PS are all refused; rollback refuses while a split row is stored, and afterwards
restores v1, the columns and the CHECKs exactly.
Run: LC_ALL=C python3 -I supabase/tests/f15_penalty_shot_split.py (needs Homebrew postgresql@15 and psycopg2).
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
PROJECTION = (ROOT / "supabase/migrations/20260720105524_add_projection_materialization_transactions.sql").read_text()
FIX = ROOT / "supabase/migrations/20261113200000_forge_strength_penalty_shot_split.sql"
ROLLBACK = ROOT / "supabase/tests/f15_penalty_shot_split_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55531
G, HOME, AWAY = 2026020065, 54, 10
IN_FP = "a" * 64
H_PBP, H_SHIFT = "b" * 64, "c" * 64
ARGS = "%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s"


def grab(text, pattern):
    found = re.search(pattern, text, re.S)
    assert found, pattern
    return found.group(0)


def schema():
    parts = [grab(BASE, r"CREATE TABLE public\.games \(\n.*?\n\);\n"),
             "alter table public.games add constraint games_pkey primary key (id);"]
    for table, pkey, cols in (("forge_player_game_strength", "player_game_strength_v2_pkey", "game_id, player_id"),
                              ("forge_team_game_strength", "team_game_strength_v2_pkey", "game_id, team_id"),
                              ("forge_goalie_game", "goalie_game_v2_pkey", "game_id, goalie_id")):
        parts.append(grab(BASE, rf"CREATE TABLE public\.{table} \(\n.*?\n\);\n"))
        parts.append(f"alter table public.{table} add constraint {pkey} primary key ({cols});")
        parts.append(f"alter table public.{table} enable row level security;")
        parts.append(f"grant select on table public.{table} to anon, authenticated;")
        parts.append(f"grant all on table public.{table} to service_role;")
    parts.append("""
create table public.nhl_api_game_payloads_raw (
  id bigserial primary key, game_id bigint not null, endpoint text not null, season_id bigint,
  game_date date, source_url text not null, payload_hash text not null, payload jsonb not null,
  fetched_at timestamptz not null default now(), created_at timestamptz not null default now());
create table public.pbp_plays (
  id integer primary key, gameid integer not null, periodnumber integer, periodtype character varying(255),
  situationcode character varying(255), typedesckey character varying(255), eventownerteamid integer,
  goalieinnetid integer);
""")
    parts.append(grab(PROJECTION, r"create unique index nhl_api_game_payloads_raw_snapshot_identity_idx.*?;\n"))
    parts.append(grab(PROJECTION, r"create table public\.nhl_api_game_payload_snapshot_heads \(.*?\n\);\n"))
    parts.append(grab(PROJECTION, r"create table public\.projection_game_materialization_status \(.*?\n\);\n"))
    parts.append(grab(PROJECTION, r"create or replace function public\.persist_projection_game_derived_v1\(.*?\n\$\$;\n"))
    parts.append(grab(PROJECTION, r"revoke all on function public\.persist_projection_game_derived_v1\(.*?to service_role;\n"))
    return "\n".join(parts)


PLAYS = [  # id, period, type, situation, event, owner, goalie in net
    (1, 1, "REG", "1551", "shot-on-goal", HOME, 601),
    (2, 2, "REG", "1010", "goal", HOME, 601),          # home penalty-shot goal
    (3, 2, "REG", "0101", "shot-on-goal", AWAY, 501),  # away penalty-shot save
    (4, 2, "REG", "1010", "missed-shot", HOME, 601),   # home penalty-shot miss: counts nowhere
    (5, 3, "REG", "1541", "goal", AWAY, 501),          # away power-play goal
    (6, 5, "SO", "0101", "goal", AWAY, 501),           # shootout goal: counts nowhere
    (7, 5, "SO", "1010", "shot-on-goal", HOME, 601),   # shootout save: counts nowhere
]


def seed(cur):
    cur.execute('insert into public.games (id, date, "seasonId", "startTime", type, "homeTeamId", "awayTeamId") '
                f"values ({G}, '2026-10-08', 20262027, '2026-10-08T23:00:00Z', 2, {HOME}, {AWAY})")
    for endpoint, digest in (("play-by-play", H_PBP), ("shiftcharts", H_SHIFT)):
        cur.execute("insert into public.nhl_api_game_payloads_raw (game_id, endpoint, source_url, payload_hash, payload) "
                    "values (%s, %s, 'https://example.invalid', %s, '{}') returning id", (G, endpoint, digest))
        raw_id = cur.fetchone()[0]
        cur.execute("insert into public.nhl_api_game_payload_snapshot_heads "
                    "(game_id, endpoint, snapshot_version, raw_payload_id, payload_hash, fetched_at) "
                    "values (%s, %s, 1, %s, %s, now())", (G, endpoint, raw_id, digest))
    cur.execute("""
insert into public.projection_game_materialization_status (
  game_id, input_status, input_fingerprint, input_version, pbp_source_hash, shift_source_hash,
  pbp_raw_payload_id, pbp_raw_snapshot_version, pbp_raw_payload_hash,
  shift_raw_payload_id, shift_raw_snapshot_version, shift_raw_payload_hash,
  parser_version, input_materializer_version, expected_play_rows, observed_play_rows,
  expected_strength_rows, observed_strength_rows, input_completed_at,
  relationship_status, relationship_input_fingerprint, relationship_fingerprint, relationship_version,
  relationship_algorithm_version, expected_relationship_rows, observed_relationship_rows, relationship_completed_at)
values (%s, 'complete', %s, 1, %s, %s, 1, 1, %s, 2, 1, %s, 'p1', 'm1', 7, 7, 6, 6, now(),
        'complete', %s, %s, 1, 'r1', 6, 6, now())""", (G, IN_FP, H_PBP, H_SHIFT, H_PBP, H_SHIFT, IN_FP, "d" * 64))
    for play in PLAYS:
        cur.execute("insert into public.pbp_plays (id, gameid, periodnumber, periodtype, situationcode, typedesckey, "
                    "eventownerteamid, goalieinnetid) values (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (play[0], G, play[1], play[2], play[3], play[4], play[5], play[6]))


def player(pid, team, opp, shots=(0, 0, 0), goals=(0, 0, 0), ps=None):
    row = {"game_id": G, "player_id": pid, "team_id": team, "opponent_team_id": opp, "game_date": "2026-10-08",
           "toi_es_seconds": 600, "toi_pp_seconds": 60, "toi_pk_seconds": 60,
           "shots_es": shots[0], "shots_pp": shots[1], "shots_pk": shots[2],
           "goals_es": goals[0], "goals_pp": goals[1], "goals_pk": goals[2],
           "assists_es": 0, "assists_pp": 0, "assists_pk": 0,
           "hits": None, "blocks": None, "pim": None, "plus_minus": None}
    if ps is not None:
        row.update({"shots_ps": ps[0], "goals_ps": ps[1], "penalty_shot_split_version": 1})
    return row


def team(tid, opp, players):
    row = {"game_id": G, "team_id": tid, "opponent_team_id": opp, "game_date": "2026-10-08"}
    for key in ("toi_es_seconds", "toi_pp_seconds", "toi_pk_seconds", "shots_es", "shots_pp", "shots_pk",
                "goals_es", "goals_pp", "goals_pk"):
        row[key] = sum(p[key] for p in players if p["team_id"] == tid)
    if "penalty_shot_split_version" in players[0]:
        row["shots_ps"] = sum(p["shots_ps"] for p in players if p["team_id"] == tid)
        row["goals_ps"] = sum(p["goals_ps"] for p in players if p["team_id"] == tid)
        row["penalty_shot_split_version"] = 1
    return row


def legacy_players():
    """What the released builder sends: penalty shots inside ES, no split keys."""
    return [player(101, HOME, AWAY, shots=(2, 0, 0), goals=(1, 0, 0)), player(102, HOME, AWAY),
            player(201, AWAY, HOME, shots=(1, 0, 0)), player(202, AWAY, HOME, shots=(0, 1, 0), goals=(0, 1, 0))]


def split_players():
    """The F15 builder: penalty shots only in shots_ps / goals_ps."""
    return [player(101, HOME, AWAY, shots=(1, 0, 0), ps=(1, 1)), player(102, HOME, AWAY, ps=(0, 0)),
            player(201, AWAY, HOME, ps=(1, 0)), player(202, AWAY, HOME, shots=(0, 1, 0), goals=(0, 1, 0), ps=(0, 0))]


GOALIES = [{"game_id": G, "goalie_id": 501, "team_id": HOME, "opponent_team_id": AWAY, "game_date": "2026-10-08",
            "shots_against": 2, "goals_allowed": 1, "saves": 1, "toi_seconds": 3600},
           {"game_id": G, "goalie_id": 601, "team_id": AWAY, "opponent_team_id": HOME, "game_date": "2026-10-08",
            "shots_against": 2, "goals_allowed": 1, "saves": 1, "toi_seconds": 3600}]


def payload(players, teams=None, fingerprint="e" * 64):
    teams = teams or [team(HOME, AWAY, players), team(AWAY, HOME, players)]
    return (G, IN_FP, 1, fingerprint, "projection-derived-materialization-v1", json.dumps(players), json.dumps(teams),
            json.dumps(GOALIES), len(players), 2, len(GOALIES), "complete", None)


def call(cur, fn, args):
    """Run the RPC in its own transaction; return (receipt, None) or (None, (sqlstate, message))."""
    cur.execute("begin")
    try:
        cur.execute(f"select * from public.{fn}({ARGS})", args)
        receipt = cur.fetchall()
        cur.execute("commit")
        return receipt, None
    except psycopg2.Error as e:
        cur.execute("rollback")
        return None, (e.pgcode, e.diag.message_primary)


def stable(receipt):
    """Receipt without completed_at (a transaction timestamp)."""
    return [row[:-1] for row in receipt] if receipt else receipt


def stored(cur, table, key):
    cur.execute(f"select to_jsonb(t) - 'created_at' - 'updated_at' from public.{table} as t where game_id = {G} order by {key}")
    return [row[0] for row in cur.fetchall()]


def all_situation(cur):
    """Shots and goals per team as every F15 reader computes them: ES + PP + PK + (marker 1 ? PS : 0)."""
    cur.execute("select team_id, shots_es + shots_pp + shots_pk + case when penalty_shot_split_version = 1 then shots_ps else 0 end, "
                "goals_es + goals_pp + goals_pk + case when penalty_shot_split_version = 1 then goals_ps else 0 end "
                f"from public.forge_team_game_strength where game_id = {G} order by team_id")
    return cur.fetchall()


OFFICIAL = [(AWAY, 2, 1), (HOME, 2, 1)]


def state(cur):
    cur.execute("select table_name, column_name, data_type, is_nullable from information_schema.columns "
                "where table_schema = 'public' and table_name in ('forge_player_game_strength', 'forge_team_game_strength') "
                "order by table_name, ordinal_position")
    columns = cur.fetchall()
    cur.execute("select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint "
                "where conrelid in ('public.forge_player_game_strength'::regclass, 'public.forge_team_game_strength'::regclass) "
                "order by 1, 2")
    constraints = cur.fetchall()
    cur.execute("select p.proname, pg_get_functiondef(p.oid), p.proacl::text from pg_proc p "
                "where p.pronamespace = 'public'::regnamespace and p.proname like 'persist_projection_game_derived_%' order by 1")
    functions = cur.fetchall()
    cur.execute("select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) "
                "from information_schema.role_table_grants where table_schema = 'public' "
                "and table_name in ('forge_player_game_strength', 'forge_team_game_strength') group by 1, 2 order by 1, 2")
    grants = cur.fetchall()
    return columns, constraints, functions, grants


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
    tmp = Path(tempfile.mkdtemp(prefix="f15pssplit-"))
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

        print("phase 1: starting state (v1 as 20260720105524 defines it)")
        conn, cur = fresh(sock, admin, "before")
        st0 = state(cur)
        legacy_receipt, err = call(cur, "persist_projection_game_derived_v1", payload(legacy_players()))
        ok &= report("released legacy payload stored through v1", err is None and legacy_receipt[0][3] == "complete", err)
        legacy_rows = (stored(cur, "forge_player_game_strength", "player_id"), stored(cur, "forge_team_game_strength", "team_id"))
        ok &= report("legacy all-situation totals equal the official totals (penalty shots inside ES)",
                     all_situation_legacy(cur) == OFFICIAL, all_situation_legacy(cur))
        _, err = call(cur, "persist_projection_game_derived_v2", payload(split_players(), fingerprint="f" * 64))
        ok &= report("split payload refused before (the defect: no writer and no column for penalty shots)",
                     err is not None and err[0] == "42883", err)
        conn.close()

        print("phase 2: apply the migration")
        conn, cur = fresh(sock, admin, "after")
        call(cur, "persist_projection_game_derived_v1", payload(legacy_players()))
        rows_before = (stored(cur, "forge_player_game_strength", "player_id"), stored(cur, "forge_team_game_strength", "team_id"))
        cur.execute(FIX.read_text())
        rows_after = (stored(cur, "forge_player_game_strength", "player_id"), stored(cur, "forge_team_game_strength", "team_id"))
        null_split = {"shots_ps": None, "goals_ps": None, "penalty_shot_split_version": None}
        ok &= report("existing rows keep every value and are marked legacy (null)",
                     rows_after == tuple([{**r, **null_split} for r in rows] for rows in rows_before))
        st1 = state(cur)
        ok &= report("table grants unchanged; v1 keeps its ACL", st1[3] == st0[3] and
                     [f[2] for f in st1[2] if f[0].endswith("_v1")] == [f[2] for f in st0[2] if f[0].endswith("_v1")])
        added = [c for c in st1[0] if c not in st0[0]]
        ok &= report("three nullable columns added to each table",
                     sorted(added) == sorted((t, c, ty, "YES") for t in ("forge_player_game_strength", "forge_team_game_strength")
                                             for c, ty in (("shots_ps", "integer"), ("goals_ps", "integer"),
                                                           ("penalty_shot_split_version", "smallint"))), added)
        cur.execute("select has_function_privilege(r, 'public.persist_projection_game_derived_v2(bigint, text, bigint, text, text, "
                    "jsonb, jsonb, jsonb, integer, integer, integer, text, text)', 'execute') from unnest(array['anon', "
                    "'authenticated', 'service_role']) as r")
        ok &= report("v2 executable by service_role only", [r[0] for r in cur.fetchall()] == [False, False, True])

        # Wrapper equivalence on the released payload (idempotent replay, then a forced rewrite).
        replay, err = call(cur, "persist_projection_game_derived_v1", payload(legacy_players()))
        ok &= report("v1 (now a wrapper) replays the released payload idempotently with the same receipt",
                     err is None and stable(replay)[0][:-1] == stable(legacy_receipt)[0][:-1] and replay[0][-2] is True, err)

        split_receipt, err = call(cur, "persist_projection_game_derived_v2", payload(split_players(), fingerprint="f" * 64))
        ok &= report("split payload stored through v2", err is None and split_receipt[0][3] == "complete"
                     and split_receipt[0][-2] is False, err)
        cur.execute(f"select team_id, shots_es, goals_es, shots_ps, goals_ps, penalty_shot_split_version "
                    f"from public.forge_team_game_strength where game_id = {G} order by team_id")
        teams = cur.fetchall()
        ok &= report("penalty shots in PS only: home 1 PS shot + 1 PS goal, away 1 PS shot; ES holds the 5v5 shot only",
                     teams == [(AWAY, 0, 0, 1, 0, 1), (HOME, 1, 0, 1, 1, 1)], teams)
        ok &= report("all-situation totals equal the official totals (miss and shootout count nowhere)",
                     all_situation(cur) == OFFICIAL, all_situation(cur))
        cur.execute(f"select count(*) from public.forge_player_game_strength where game_id = {G} "
                    "and penalty_shot_split_version is distinct from 1")
        ok &= report("every player row is marked split", cur.fetchone()[0] == 0)
        replay, err = call(cur, "persist_projection_game_derived_v2", payload(split_players(), fingerprint="f" * 64))
        ok &= report("replaying the split payload is idempotent", err is None and replay[0][-2] is True, err)

        back, err = call(cur, "persist_projection_game_derived_v1", payload(legacy_players(), fingerprint="9" * 64))
        cur.execute(f"select count(*) from public.forge_team_game_strength where game_id = {G} and penalty_shot_split_version is not null")
        ok &= report("a v1 rewrite returns the split game to legacy without losing a shot",
                     err is None and cur.fetchone()[0] == 0 and all_situation(cur) == OFFICIAL, err)
        call(cur, "persist_projection_game_derived_v2", payload(split_players(), fingerprint="f" * 64))

        def mutate(players=None, teams=None):
            players = players or split_players()
            return payload(players, teams=teams, fingerprint="8" * 64)

        mixed = split_players()
        legacy_teams = [team(HOME, AWAY, legacy_players()), team(AWAY, HOME, legacy_players())]
        wrong_team = [team(HOME, AWAY, split_players()), team(AWAY, HOME, split_players())]
        wrong_team[0]["shots_ps"] += 1
        no_ps = split_players()
        no_ps[0].update({"shots_es": 2, "goals_es": 1, "shots_ps": 0, "goals_ps": 0})
        shootout = split_players()
        shootout[2].update({"shots_ps": 2, "goals_ps": 1})
        too_many = split_players()
        too_many[1].update({"shots_ps": 0, "goals_ps": 1})
        marker2 = split_players()
        for row in marker2:
            row["penalty_shot_split_version"] = 2
        refusals = {
            "mixed markers (split players, legacy teams)": (call(cur, "persist_projection_game_derived_v2", mutate(mixed, legacy_teams)),
                                                           "INVALID_PROJECTION_DERIVED_PENALTY_SHOT_SPLIT"),
            "team PS != sum of player PS": (call(cur, "persist_projection_game_derived_v2", mutate(teams=wrong_team)),
                                             "PROJECTION_DERIVED_PENALTY_SHOT_EVIDENCE_MISMATCH"),
            "penalty shot left in ES (PS 0 vs play-by-play 1)": (call(cur, "persist_projection_game_derived_v2", mutate(no_ps)),
                                                                 "PROJECTION_DERIVED_PENALTY_SHOT_EVIDENCE_MISMATCH"),
            "shootout goal counted as a penalty shot": (call(cur, "persist_projection_game_derived_v2", mutate(shootout)),
                                                        "PROJECTION_DERIVED_PENALTY_SHOT_EVIDENCE_MISMATCH"),
            "goals_ps > shots_ps": (call(cur, "persist_projection_game_derived_v2", mutate(too_many)),
                                    "INVALID_PROJECTION_DERIVED_PLAYER_ROWS"),
            "marker 2": (call(cur, "persist_projection_game_derived_v2", mutate(marker2)), "INVALID_PROJECTION_DERIVED_PLAYER_ROWS"),
        }
        got = {name: (res[1][1] if res[1] else None) for name, (res, _) in refusals.items()}
        ok &= report("refused: " + "; ".join(refusals), all(got[n] == want for n, (_, want) in refusals.items()), got)
        cur.execute("begin")
        try:
            cur.execute(f"update public.forge_team_game_strength set penalty_shot_split_version = null where game_id = {G}")
            check_err = None
        except psycopg2.Error as e:
            check_err = e.pgcode
        cur.execute("rollback")
        ok &= report("table CHECK refuses a legacy marker on a row that holds PS counts (23514)", check_err == "23514", check_err)
        ok &= report("refusals left the stored split rows unchanged", all_situation(cur) == OFFICIAL)

        print("phase 3: rollback")
        cur.execute("begin")
        try:
            cur.execute(ROLLBACK.read_text())
            rb_err = None
        except psycopg2.Error as e:
            rb_err = e.diag.message_primary
        cur.execute("rollback")
        ok &= report("rollback refuses while a split row is stored", rb_err == "PENALTY_SHOT_SPLIT_ROWS_STORED", rb_err)
        call(cur, "persist_projection_game_derived_v1", payload(legacy_players(), fingerprint="7" * 64))
        cur.execute(ROLLBACK.read_text())
        st2 = state(cur)
        ok &= report("after a legacy rebuild, rollback restores v1, the columns, constraints and grants exactly", st2 == st0,
                     [i for i in range(4) if st2[i] != st0[i]])
        ok &= report("legacy totals still official after rollback", all_situation_legacy(cur) == OFFICIAL)
        conn.close()
        admin_conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


def all_situation_legacy(cur):
    cur.execute("select team_id, shots_es + shots_pp + shots_pk, goals_es + goals_pp + goals_pk "
                f"from public.forge_team_game_strength where game_id = {G} order by team_id")
    return cur.fetchall()


if __name__ == "__main__":
    main()

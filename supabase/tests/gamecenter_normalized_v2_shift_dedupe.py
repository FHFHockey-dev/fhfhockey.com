#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261109034000_gamecenter_normalized_v2_shift_dedupe.sql.

Unix socket only, no hosted credentials, no NHL requests. Builds the six normalization tables
with the production column definitions, installs persist_nhl_api_gamecenter_normalized_v1
exactly as 20260722010355 defines it (its body md5 equals production's), applies the v2
migration, and drives both RPCs with arguments built by the real writer
(gamecenter_normalized_v2_scope.mjs), so JS and SQL must agree on the canonical rows.
Run: LC_ALL=C python3 -I supabase/tests/gamecenter_normalized_v2_shift_dedupe.py
(needs Homebrew postgresql@15, psycopg2 and node).
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
V1 = ROOT / "supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql"
V2 = ROOT / "supabase/migrations/20261109034000_gamecenter_normalized_v2_shift_dedupe.sql"
SCOPE = ROOT / "supabase/tests/gamecenter_normalized_v2_scope.mjs"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PRODUCTION_V1_BODY_MD5 = "8a056d7265d8b62bd907e61f1140de67"
PORT = 55481
checks = []

TABLES = """
create schema extensions;
create extension pgcrypto schema extensions;
create role anon; create role authenticated; create role service_role;
create table public.games (id bigint primary key, date date not null, "seasonId" bigint not null);
create table public.nhl_api_game_payloads_raw (
  id bigserial primary key, game_id bigint not null, endpoint text not null, season_id bigint,
  game_date date, source_url text not null, payload_hash text not null, payload jsonb not null,
  fetched_at timestamptz not null default now(), created_at timestamptz not null default now(),
  unique (game_id, endpoint, payload_hash));
create table public.nhl_api_game_payload_snapshot_heads (
  game_id bigint not null, endpoint text not null, snapshot_version bigint not null,
  raw_payload_id bigint not null, payload_hash text not null, fetched_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (game_id, endpoint));
create table public.nhl_api_game_roster_spots (
  game_id bigint not null, season_id bigint, game_date date, team_id bigint not null,
  player_id bigint not null, first_name text, last_name text, sweater_number integer,
  position_code text, headshot_url text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), source_play_by_play_hash text not null,
  parser_version integer not null default 1, raw_spot jsonb not null default '{}'::jsonb,
  primary key (game_id, player_id));
create table public.nhl_api_pbp_events (
  game_id bigint not null, season_id bigint, game_date date, event_id bigint not null,
  sort_order integer, period_number integer, period_type text, time_in_period text,
  time_remaining text, period_seconds_elapsed integer, time_remaining_seconds integer,
  situation_code text, away_goalie smallint, away_skaters smallint, home_skaters smallint,
  home_goalie smallint, strength_exact text, strength_state text, home_team_defending_side text,
  type_code integer, type_desc_key text, event_owner_team_id bigint, event_owner_side text,
  is_shot_like boolean not null default false, is_goal boolean not null default false,
  is_penalty boolean not null default false, details jsonb not null default '{}'::jsonb,
  losing_player_id bigint, winning_player_id bigint, shooting_player_id bigint,
  scoring_player_id bigint, goalie_in_net_id bigint, blocking_player_id bigint,
  hitting_player_id bigint, hittee_player_id bigint, committed_by_player_id bigint,
  drawn_by_player_id bigint, served_by_player_id bigint, player_id bigint,
  assist1_player_id bigint, assist2_player_id bigint, shot_type text, penalty_type_code text,
  penalty_desc_key text, penalty_duration_minutes integer, reason text, secondary_reason text,
  x_coord numeric, y_coord numeric, zone_code text, home_score integer, away_score integer,
  home_sog integer, away_sog integer, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), source_play_by_play_hash text not null,
  parser_version integer not null default 1, strength_version integer not null default 1,
  raw_event jsonb not null default '{}'::jsonb, primary key (game_id, event_id));
create table public.nhl_api_shift_rows (
  game_id bigint not null, shift_id bigint not null, season_id bigint, game_date date,
  player_id bigint not null, team_id bigint not null, team_abbrev text, team_name text,
  first_name text, last_name text, period integer, shift_number integer, start_time text,
  end_time text, duration text, start_seconds integer, end_seconds integer,
  duration_seconds integer, type_code integer, detail_code integer, event_number integer,
  event_description text, event_details text, hex_value text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  source_shiftcharts_hash text not null, parser_version integer not null default 1,
  raw_shift jsonb not null default '{}'::jsonb, primary key (game_id, shift_id));
create table public.nhl_api_game_normalization_status (
  game_id bigint primary key, season_id bigint not null, game_date date not null,
  status text not null, normalization_version bigint not null,
  normalization_fingerprint text not null, source_fingerprint text not null,
  parser_fingerprint text not null, parser_version integer not null,
  strength_version integer not null, materializer_version text not null,
  pbp_raw_payload_id bigint not null, pbp_raw_snapshot_version bigint not null,
  pbp_raw_payload_hash text not null, shift_raw_payload_id bigint not null,
  shift_raw_snapshot_version bigint not null, shift_raw_payload_hash text not null,
  roster_fingerprint text not null, event_fingerprint text not null,
  shift_fingerprint text not null, expected_roster_rows integer not null,
  observed_roster_rows integer not null, expected_event_rows integer not null,
  observed_event_rows integer not null, expected_shift_rows integer not null,
  observed_shift_rows integer not null, completed_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
"""


def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def v1_function_sql():
    src = V1.read_text()
    fn = re.search(r"create or replace function public\.persist_nhl_api_gamecenter_normalized_v1\(.*?\n\$\$;\n", src, re.S).group(0)
    grants = re.search(r"revoke all on function public\.persist_nhl_api_gamecenter_normalized_v1\(.*?to service_role;\n", src, re.S).group(0)
    return fn + grants


def sha(value):
    return hashlib.sha256(json.dumps(value, separators=(",", ":")).encode()).hexdigest()


def pbp_for(game_id, away, home, game_state="OFF"):
    return {
        "id": game_id, "season": 20262027, "gameDate": "2026-10-12", "gameState": game_state,
        "awayTeam": {"id": away, "abbrev": "AWY"}, "homeTeam": {"id": home, "abbrev": "HOM"},
        "rosterSpots": [
            {"teamId": away, "playerId": away * 100 + 1, "firstName": {"default": "A"}, "lastName": {"default": "Away"}},
            {"teamId": home, "playerId": home * 100 + 1, "firstName": {"default": "H"}, "lastName": {"default": "Home"}},
        ],
        "plays": [
            {"eventId": period, "sortOrder": period, "periodDescriptor": {"number": period},
             "timeInPeriod": "20:00", "typeDescKey": "period-end", "details": {}}
            for period in (1, 2, 3)
        ],
    }


def shifts_for(game_id, team, first_id):
    return [
        {"id": first_id + i, "gameId": game_id, "playerId": team * 100 + 1, "teamId": team,
         "teamAbbrev": "X", "firstName": "F", "lastName": "L", "period": period, "shiftNumber": i + 1,
         "startTime": "19:00", "endTime": "20:00", "duration": "01:00", "typeCode": 517}
        for i, period in enumerate((1, 2, 3))
    ]


def build_scope(pbp, payload, pbp_hash, shift_hash, raw_scope=False):
    out = subprocess.run(
        ["node", str(SCOPE)], input=json.dumps({"pbp": pbp, "shiftPayload": payload, "pbpHash": pbp_hash,
                                                "shiftHash": shift_hash, "rawScope": raw_scope}),
        capture_output=True, text=True, cwd=ROOT / "web")
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return json.loads(out.stdout)


def store_heads(cur, pbp, payload, version=1):
    gid = pbp["id"]
    heads = {}
    for endpoint, body in (("play-by-play", pbp), ("shiftcharts", payload)):
        h = sha(body)
        cur.execute("""insert into public.nhl_api_game_payloads_raw (game_id, endpoint, season_id, game_date, source_url, payload_hash, payload)
                       values (%s, %s, 20262027, '2026-10-12', 'test', %s, %s)
                       on conflict (game_id, endpoint, payload_hash) do update set source_url = excluded.source_url returning id""",
                    (gid, endpoint, h, json.dumps(body)))
        raw_id = cur.fetchone()[0]
        cur.execute("""insert into public.nhl_api_game_payload_snapshot_heads (game_id, endpoint, snapshot_version, raw_payload_id, payload_hash, fetched_at)
                       values (%s, %s, %s, %s, %s, now())
                       on conflict (game_id, endpoint) do update set snapshot_version = excluded.snapshot_version,
                         raw_payload_id = excluded.raw_payload_id, payload_hash = excluded.payload_hash""",
                    (gid, endpoint, version, raw_id, h))
        heads[endpoint] = h
    return heads["play-by-play"], heads["shiftcharts"]


def persist(conn, fn, pbp, pbp_hash, shift_hash, scope, current=None):
    with conn.cursor() as cur:
        try:
            cur.execute(f"""select * from public.{fn}(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s)""", (
                pbp["id"], int(pbp["season"]), pbp["gameDate"], pbp_hash, shift_hash,
                current[0] if current else None, current[1] if current else None,
                scope["fingerprint"], scope["parserVersion"], scope["strengthVersion"], scope["materializerVersion"],
                json.dumps(scope["roster"]), json.dumps(scope["events"]), json.dumps(scope["shifts"]),
                len(scope["roster"]), len(scope["events"]), len(scope["shifts"])))
            cols = [d[0] for d in cur.description]
            row = dict(zip(cols, cur.fetchone()))
            conn.commit()
            return row, None
        except psycopg2.Error as error:
            conn.rollback()
            return None, error.pgerror.splitlines()[0] if error.pgerror else str(error)


def shift_ids(cur, gid):
    cur.execute("select shift_id from public.nhl_api_shift_rows where game_id = %s order by shift_id", (gid,))
    return [r[0] for r in cur.fetchall()]


def main():
    tmp = Path(tempfile.mkdtemp(prefix="gcv2-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"], env=env, check=True, capture_output=True)
    try:
        conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres")
        with conn.cursor() as cur:
            cur.execute(TABLES)
            cur.execute(v1_function_sql())
            cur.execute(V2.read_text())
            cur.execute("select proname, md5(prosrc) from pg_proc where proname like 'persist_nhl_api_gamecenter_normalized_v%' order by 1")
            bodies = dict(cur.fetchall())
            cur.execute("select count(*) from pg_proc where proname = 'persist_nhl_api_gamecenter_normalized_v2' and has_function_privilege('service_role', oid, 'execute') and not has_function_privilege('anon', oid, 'execute') and not has_function_privilege('authenticated', oid, 'execute')")
            grants_ok = cur.fetchone()[0] == 1
        conn.commit()
        check("v1 installed with the production body", bodies.get("persist_nhl_api_gamecenter_normalized_v1") == PRODUCTION_V1_BODY_MD5)
        check("v2 installed beside v1", "persist_nhl_api_gamecenter_normalized_v2" in bodies)
        check("v2 executable by service_role only", grants_ok)
        sql = "\n".join(line for line in V2.read_text().splitlines() if not line.lstrip().startswith("--"))
        check("migration is one transaction, additive, and never touches v1",
              len(re.findall(r"^begin;$", sql, re.M)) == 1 and len(re.findall(r"^commit;$", sql, re.M)) == 1
              and "normalized_v1" not in sql and not re.search(r"\b(drop|truncate|alter table)\b", sql, re.I)
              and len(re.findall(r"create or replace function", sql, re.I)) == 1)

        # 2026020019 shape: one interval published twice under distinct ids.
        gid = 2026020019
        pbp = pbp_for(gid, 52, 10)
        away, home = shifts_for(gid, 52, 100), shifts_for(gid, 10, 200)
        dup_payload = {"total": 7, "data": [{**away[0], "id": 900}, *away, *home], "source": "json-api"}
        with conn.cursor() as cur:
            cur.execute("insert into public.games values (%s, '2026-10-12', 20262027), (%s, '2026-10-12', 20262027), (%s, '2026-10-12', 20262027)", (gid, gid + 1, gid + 2))
            pbp_hash, shift_hash = store_heads(cur, pbp, dup_payload)
        conn.commit()
        canonical = build_scope(pbp, dup_payload, pbp_hash, shift_hash)
        raw = build_scope(pbp, dup_payload, pbp_hash, shift_hash, raw_scope=True)
        check("writer builds 6 canonical rows from 7 raw entries", len(canonical["shifts"]) == 6 and len(raw["shifts"]) == 7)

        _, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v1", pbp, pbp_hash, shift_hash, canonical)
        check("v1 refuses the canonical scope (the 280e4ce00 failure)", err and "NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH" in err, err or "")

        _, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v2", pbp, pbp_hash, shift_hash, raw)
        check("v2 refuses the raw scope with the duplicate", err and "NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH" in err, err or "")

        wrong = json.loads(json.dumps(canonical))
        wrong["shifts"] = [dict(r, shift_id=900) if r["shift_id"] == 100 else r for r in wrong["shifts"]]
        _, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v2", pbp, pbp_hash, shift_hash, wrong)
        check("v2 refuses a scope keeping the higher id of a duplicate", err and "SHIFT_HEAD_MISMATCH" in err, err or "")

        short = json.loads(json.dumps(canonical))
        short["shifts"] = short["shifts"][:-1]
        _, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v2", pbp, pbp_hash, shift_hash, short)
        check("v2 refuses a scope missing a canonical row", err and "SHIFT_HEAD_MISMATCH" in err, err or "")

        # Repair path for the 2026-27 games: they were normalized by v1 with every raw row.
        receipt, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v1", pbp, pbp_hash, shift_hash, raw)
        with conn.cursor() as cur:
            before = shift_ids(cur, gid)
        check("v1 stores the duplicate (current production state)", receipt and before == [100, 101, 102, 200, 201, 202, 900], err or str(before))
        current = (receipt["normalization_fingerprint"], receipt["normalization_version"])
        receipt, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v2", pbp, pbp_hash, shift_hash, canonical, current)
        with conn.cursor() as cur:
            after = shift_ids(cur, gid)
            cur.execute("select normalization_version, observed_shift_rows, expected_shift_rows from public.nhl_api_game_normalization_status where game_id = %s", (gid,))
            status = cur.fetchone()
        check("v2 re-normalization prunes exactly the duplicate",
              receipt and receipt["pruned_shift_rows"] == 1 and receipt["pruned_roster_rows"] == 0
              and receipt["pruned_event_rows"] == 0 and after == [100, 101, 102, 200, 201, 202], err or str(receipt))
        check("status advances one version with 6 observed rows", status == (2, 6, 6), str(status))
        current = (receipt["normalization_fingerprint"], receipt["normalization_version"])
        receipt, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v2", pbp, pbp_hash, shift_hash, canonical, current)
        check("v2 replay is idempotent", receipt and receipt["idempotent"] is True and receipt["normalization_version"] == 2, err or str(receipt))

        # No duplicates: v2 behaves like v1.
        gid2 = gid + 1
        pbp2 = pbp_for(gid2, 52, 10)
        clean = {"total": 6, "data": [*shifts_for(gid2, 52, 300), *shifts_for(gid2, 10, 400)], "source": "json-api"}
        with conn.cursor() as cur:
            pbp_hash2, shift_hash2 = store_heads(cur, pbp2, clean)
        conn.commit()
        receipt, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v2", pbp2, pbp_hash2, shift_hash2, build_scope(pbp2, clean, pbp_hash2, shift_hash2))
        check("v2 accepts a feed without duplicates unchanged", receipt and receipt["observed_shift_rows"] == 6, err or "")

        # JS and SQL group alike: a null type code is its own group; 517 and "517" are one.
        gid3 = gid + 2
        pbp3 = pbp_for(gid3, 52, 10, game_state="LIVE")
        base = shifts_for(gid3, 52, 500)[0]
        nulls = {"total": 4, "data": [{**base, "typeCode": None}, {**base, "id": 501, "typeCode": 517},
                                      {**base, "id": 502, "typeCode": "517"}, {**base, "id": 503, "typeCode": None}], "source": "json-api"}
        with conn.cursor() as cur:
            pbp_hash3, shift_hash3 = store_heads(cur, pbp3, nulls)
        conn.commit()
        scope3 = build_scope(pbp3, nulls, pbp_hash3, shift_hash3)
        receipt, err = persist(conn, "persist_nhl_api_gamecenter_normalized_v2", pbp3, pbp_hash3, shift_hash3, scope3)
        with conn.cursor() as cur:
            ids3 = shift_ids(cur, gid3)
        check("JS and SQL group null and 517/\"517\" type codes alike", ids3 == [500, 501] and receipt and receipt["observed_shift_rows"] == 2, err or str(ids3))
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)
    failed = [c for c in checks if not c[1]]
    print(f"{len(checks) - len(failed)}/{len(checks)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

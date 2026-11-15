#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261115000000_forge_pregame_capture_custody.sql (Claude pregame
capture lane, TJ steer 20261115). Never applied to a hosted database.

Schema: public.games and public.roster_optimizer_team_games reduced to the columns the functions read, plus the
anon, authenticated and service_role roles. Every check runs as service_role unless it says otherwise.

Claim: binding mismatch, future cutoff, late start, insufficient time and duplicate are refused and insert
nothing; one claim per (game, policy), also under two concurrent sessions.
Save: hash mismatch stores nothing; a second save is refused and the first bytes stay; a late save is refused.
A writer whose save runs before the deadline but commits after it is stored, yet can only be witnessed as
saved_without_valid_witness: a qualified witness with an acknowledgement after the deadline is refused.
Settle (never retry): it waits on the claim row lock for an in-flight save, reports present after its commit,
fences after its rollback or when no save exists (a later save then collides), and fails at lock_timeout rather
than guessing. A function-level statement_timeout does not bound a call, so no timer is trusted for absence.
Read: recomputes the hash from committed bytes, reports the row version, the current start and the DB clock.
Witness/outcome: statement must bind claim, game, policy and both hashes; qualified outcome needs a qualified
witness; one outcome per (game, policy).
Immutability and grants: no direct table access for service_role, anon or authenticated; update, delete and
truncate are rejected even for the owner; only service_role may execute the functions. Rollback drops it all.
Run: LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_pregame_capture_custody.py
"""
import base64
import hashlib
import json
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20261115000000_forge_pregame_capture_custody.sql"
ROLLBACK = ROOT / "supabase/tests/forge_pregame_capture_custody_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55541
REV = "a" * 64
CODE = "abcdef0123456789"

SCHEMA = """
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create table public.games (id bigint primary key, date date not null, "seasonId" bigint not null,
  "startTime" timestamptz not null, "homeTeamId" smallint not null, "awayTeamId" smallint not null);
create table public.roster_optimizer_team_games (source_game_id bigint not null, team_abbreviation character(3) not null,
  game_status text not null);
"""

failures = []


def check(name, condition):
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)


def b64(data):
    return base64.b64encode(data).decode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    with tempfile.TemporaryDirectory() as tmp:
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
            server.terminate()
            server.wait()
    print(f"{'FAILED' if failures else 'OK'}: {len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


def run(host):
    def connect():
        conn = psycopg2.connect(host=host, port=PORT, user="postgres", dbname="postgres")
        conn.autocommit = True
        return conn

    owner = connect()
    cur = owner.cursor()
    cur.execute(SCHEMA)
    cur.execute(MIGRATION.read_text())
    cur.execute("""insert into public.games values
      (1, current_date, 20262027, clock_timestamp() + interval '3 hours', 10, 20),
      (2, current_date, 20262027, clock_timestamp() + interval '30 minutes', 10, 20),
      (3, current_date, 20262027, clock_timestamp() + interval '60 minutes' + interval '6 seconds', 10, 20),
      (4, current_date, 20262027, clock_timestamp() + interval '60 minutes' + interval '6 seconds', 10, 20),
      (5, current_date, 20262027, clock_timestamp() + interval '4 hours', 10, 20),
      (6, current_date, 20262027, clock_timestamp() + interval '3 hours', 10, 20),
      (7, current_date, 20262027, clock_timestamp() + interval '3 hours', 10, 20),
      (8, current_date, 20262027, clock_timestamp() + interval '3 hours', 10, 20),
      (9, current_date, 20262027, clock_timestamp() + interval '3 hours', 10, 20);
      insert into public.roster_optimizer_team_games values (1, 'AAA', 'FUT'), (1, 'BBB', 'FUT');""")
    cur.execute("select id, \"startTime\" from public.games order by id")
    start = dict(cur.fetchall())

    svc = connect()
    s = svc.cursor()
    s.execute("set role service_role")

    def connect_as_service():
        conn = connect()
        conn.cursor().execute("set role service_role")
        return conn

    def claim(game, policy="pregame-native-v1", cutoff="now", required=60000, **override):
        args = dict(game=game, policy=policy, date=override.get("date"), home=override.get("home", 10), away=override.get("away", 20),
                    start=override.get("start", start[game]), cutoff=cutoff, required=required)
        s.execute("""select * from public.forge_pregame_capture_claim_v1(%(game)s, %(policy)s, coalesce(%(date)s::date, current_date),
          %(home)s::smallint, %(away)s::smallint, '""" + REV + """', %(start)s, case when %(cutoff)s = 'now' then clock_timestamp()
          else %(cutoff)s::timestamptz end, %(required)s, '""" + CODE + "')", args)
        return s.fetchone()

    def claim_count():
        cur.execute("select count(*) from forge_pregame_capture.claims")
        return cur.fetchone()[0]

    # --- claims ---
    check("binding mismatch (sides) refused", claim(1, home=11)[0] == "binding_mismatch")
    check("binding mismatch (start) refused", claim(1, start="2030-01-01T00:00:00Z")[0] == "binding_mismatch")
    check("future cutoff refused", claim(1, cutoff="2099-01-01T00:00:00Z")[0] == "future_cutoff")
    check("late start refused", claim(2)[0] == "late_start")
    check("insufficient time refused", claim(5, required=4 * 3600 * 1000 - 60 * 60 * 1000 + 1000)[0] == "insufficient_time")
    check("refusals insert nothing", claim_count() == 0)
    first = claim(1)
    check("claim succeeds", first[0] == "claimed" and first[1] is not None)
    check("ack deadline is start minus 60 minutes", first[2] == start[1] - __import__("datetime").timedelta(minutes=60))
    check("duplicate refused", claim(1)[0] == "duplicate" and claim_count() == 1)
    claim_id = first[1]

    results = []

    def racer():
        conn = connect()
        c = conn.cursor()
        c.execute("set role service_role")
        c.execute("""select outcome from public.forge_pregame_capture_claim_v1(5, 'race-policy', current_date, 10::smallint, 20::smallint,
          %s, %s, clock_timestamp(), 60000, %s)""", (REV, start[5], CODE))
        results.append(c.fetchone()[0])
        conn.close()

    threads = [threading.Thread(target=racer) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    check("concurrent claims: exactly one wins", sorted(results) == ["claimed", "duplicate", "duplicate", "duplicate"])

    # --- save ---
    packet = json.dumps({"gameId": 1, "reads": [1, 2, 3]}, separators=(",", ":")).encode()
    canonical = sha(b"canonical-form")
    try:
        s.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)", (claim_id, b64(packet), "0" * 64, canonical))
        check("hash mismatch refused", False)
    except psycopg2.Error as error:
        check("hash mismatch refused", "capture_raw_hash_mismatch" in str(error))
    cur.execute("select count(*) from forge_pregame_capture.artifacts")
    check("mismatch stored nothing", cur.fetchone()[0] == 0)
    s.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)", (claim_id, b64(packet), sha(packet), canonical))
    saved = s.fetchone()
    check("save stores bytes with server hash", saved[0] == sha(packet) and saved[1] == len(packet))
    try:
        s.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)", (claim_id, b64(b"other"), sha(b"other"), canonical))
        check("second save refused", False)
    except psycopg2.Error as error:
        check("second save refused", "duplicate key" in str(error) or "unique" in str(error).lower())

    # --- read ---
    s.execute("select * from public.forge_pregame_capture_read_v1(%s)", (claim_id,))
    cols = [d[0] for d in s.description]
    row = dict(zip(cols, s.fetchone()))
    check("read returns committed bytes", base64.b64decode(row["packet_base64"]) == packet)
    check("read recomputes hash from bytes", row["raw_sha256"] == row["stored_raw_sha256"] == sha(packet))
    check("read reports version, start, statuses and DB clock",
          row["row_version"] and row["current_start"] == start[1] and row["team_game_statuses"] == ["AAA:FUT", "BBB:FUT"] and row["db_read_at"])

    # --- late save and commit-after-deadline writer ---
    late = claim(3, required=1000)
    check("near-deadline claim succeeds", late[0] == "claimed")
    straddle = claim(4, required=1000)
    check("straddle claim succeeds", straddle[0] == "claimed")
    writer = connect()
    writer.autocommit = False
    w = writer.cursor()
    w.execute("set role service_role")
    w.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)", (straddle[1], b64(packet), sha(packet), canonical))
    time.sleep(7)  # both deadlines pass while the straddling writer has not committed
    try:
        s.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)", (late[1], b64(packet), sha(packet), canonical))
        check("late save refused", False)
    except psycopg2.Error as error:
        check("late save refused", "capture_save_late" in str(error))
    writer.commit()
    s.execute("select artifact_present, db_read_at, ack_deadline from public.forge_pregame_capture_read_v1(%s)", (straddle[1],))
    present, read_at, deadline = s.fetchone()
    check("writer that commits after the deadline is stored", present and read_at > deadline)

    # --- settle fence: an unknown save is settled, never retried ---
    def settle(cid, conn=None):
        c = (conn or svc).cursor()
        c.execute("select state from public.forge_pregame_capture_settle_v1(%s)", (cid,))
        return c.fetchone()[0]

    def save_on(cursor, cid, data=packet):
        cursor.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)", (cid, b64(data), sha(data), canonical))

    # (a) in-flight save commits while settle waits on the claim lock -> present
    c6 = claim(6)[1]
    inflight = connect(); inflight.autocommit = False
    ic = inflight.cursor(); ic.execute("set role service_role"); save_on(ic, c6)
    settled = {}
    waiter = threading.Thread(target=lambda: settled.setdefault("state", settle(c6, connect_as_service())))
    waiter.start(); time.sleep(1.0)
    check("settle waits for the in-flight save", waiter.is_alive())
    inflight.commit(); waiter.join(10)
    check("settle after commit reports present", settled.get("state") == "present")
    # (b) in-flight save rolls back -> settle fences; a late retry collides with the fence
    c7 = claim(7)[1]
    inflight = connect(); inflight.autocommit = False
    ic = inflight.cursor(); ic.execute("set role service_role"); save_on(ic, c7)
    settled = {}
    waiter = threading.Thread(target=lambda: settled.setdefault("state", settle(c7, connect_as_service())))
    waiter.start(); time.sleep(1.0); inflight.rollback(); waiter.join(10)
    check("settle after rollback fences", settled.get("state") == "fenced")
    try:
        save_on(s, c7)
        check("save after fence refused", False)
    except psycopg2.Error as error:
        check("save after fence refused", "capture_save_fenced" in str(error))
    s.execute("select artifact_present, save_fenced from public.forge_pregame_capture_read_v1(%s)", (c7,))
    check("read reports fence and no artifact", s.fetchone() == (False, True))
    # (c) no save at all -> fenced; settle is repeatable
    c8 = claim(8)[1]
    check("settle with no save fences", settle(c8) == "fenced" and settle(c8) == "fenced")
    # (d) a save that holds the lock longer than lock_timeout makes settle fail, not guess
    c9 = claim(9)[1]
    inflight = connect(); inflight.autocommit = False
    ic = inflight.cursor(); ic.execute("set role service_role"); save_on(ic, c9)
    started = time.time()
    try:
        settle(c9)
        check("settle bounded by lock_timeout", False)
    except psycopg2.Error as error:
        check("settle bounded by lock_timeout", "lock timeout" in str(error) and 4.0 <= time.time() - started <= 8.0)
    inflight.rollback()

    def statement(cid, game, raw, canon):
        body = {"claimId": str(cid), "gameId": str(game), "policyId": "pregame-native-v1", "rawSha256": raw, "canonicalSha256": canon}
        return json.dumps(body), sha(json.dumps(body, sort_keys=True).encode())

    def witness(cid, game, ack_upper, verdict, reason=None, raw=None):
        body, digest = statement(cid, game, raw or sha(packet), canonical)
        s.execute("""select public.forge_pregame_capture_record_witness_v1(%s, %s::jsonb, %s, %s, clock_timestamp(), 1500000,
          %s, clock_timestamp(), %s, %s)""", (cid, body, digest, b64(b"\x30" * 80), ack_upper, verdict, reason))
        return s.fetchone()[0]

    try:
        witness(straddle[1], 4, read_at, "qualified")
        check("late acknowledgement cannot qualify", False)
    except psycopg2.Error as error:
        check("late acknowledgement cannot qualify", "capture_witness_late" in str(error))
    check("late writer can only be witnessed without qualification",
          witness(straddle[1], 4, read_at, "saved_without_valid_witness", "ack_after_deadline") is not None)

    # --- witness binding, outcomes ---
    try:
        witness(claim_id, 1, row["db_read_at"], "qualified", raw="1" * 64)
        check("witness binding mismatch refused", False)
    except psycopg2.Error as error:
        check("witness binding mismatch refused", "capture_witness_binding" in str(error))
    try:
        s.execute("select public.forge_pregame_capture_record_outcome_v1(1, 'pregame-native-v1', %s, 'qualified', '{}')", (claim_id,))
        check("qualified outcome needs a qualified witness", False)
    except psycopg2.Error as error:
        check("qualified outcome needs a qualified witness", "capture_outcome_unwitnessed" in str(error))
    witness(claim_id, 1, row["db_read_at"], "qualified")
    s.execute("select public.forge_pregame_capture_record_outcome_v1(1, 'pregame-native-v1', %s, 'qualified', '{\"saveMs\": 812}')", (claim_id,))
    check("qualified outcome recorded", s.fetchone()[0] is not None)
    try:
        s.execute("select public.forge_pregame_capture_record_outcome_v1(1, 'pregame-native-v1', %s, 'save_unknown', '{}')", (claim_id,))
        check("one outcome per game and policy", False)
    except psycopg2.Error as error:
        check("one outcome per game and policy", "duplicate key" in str(error))
    s.execute("select public.forge_pregame_capture_record_outcome_v1(9, 'pregame-native-v1', null, 'never_dispatched', '{}')")
    check("never-dispatched outcome without a claim", s.fetchone()[0] is not None)

    # --- grants and immutability ---
    for table in ("claims", "artifacts", "save_fences", "witnesses", "outcomes"):
        for role in ("service_role", "anon", "authenticated"):
            conn = connect()
            c = conn.cursor()
            c.execute(f"set role {role}")
            try:
                c.execute(f"select 1 from forge_pregame_capture.{table} limit 1")
                check(f"{role} cannot read {table} directly", False)
            except psycopg2.Error:
                check(f"{role} cannot read {table} directly", True)
            conn.close()
        for statement_sql in (f"update forge_pregame_capture.{table} set {'policy_id' if table in ('claims', 'outcomes') else 'claim_id'} = {'policy_id' if table in ('claims', 'outcomes') else 'claim_id'}",
                              f"delete from forge_pregame_capture.{table}", f"truncate forge_pregame_capture.{table} cascade"):
            try:
                cur.execute(statement_sql)
                check(f"owner cannot mutate {table}: {statement_sql.split()[0]}", False)
            except psycopg2.Error as error:
                check(f"owner cannot mutate {table}: {statement_sql.split()[0]}", "immutable" in str(error))
    for role in ("anon", "authenticated"):
        conn = connect()
        c = conn.cursor()
        c.execute(f"set role {role}")
        try:
            c.execute("select * from public.forge_pregame_capture_read_v1(%s)", (claim_id,))
            check(f"{role} cannot execute capture functions", False)
        except psycopg2.Error as error:
            check(f"{role} cannot execute capture functions", "permission denied" in str(error))
        conn.close()

    # --- rollback ---
    cur.execute(ROLLBACK.read_text())
    cur.execute("select count(*) from pg_namespace where nspname = 'forge_pregame_capture'")
    schemas = cur.fetchone()[0]
    cur.execute("select count(*) from pg_proc where proname like 'forge_pregame_capture%'")
    check("rollback drops schema and functions", schemas == 0 and cur.fetchone()[0] == 0)


if __name__ == "__main__":
    main()

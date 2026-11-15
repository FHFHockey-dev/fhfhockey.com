#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261115000000_forge_pregame_capture_custody.sql (Claude pregame
capture lane, TJ steer 20261115). Never applied to a hosted database.

The migration runs as a NON-superuser owner (as Supabase's postgres role is), with public.games and
public.roster_optimizer_team_games reduced to the columns the functions read, plus anon, authenticated and
service_role. Every check runs as service_role unless it says otherwise.

Claim: binding mismatch, late start, insufficient time and duplicate are refused and insert nothing; the
cutoff is the claim's own database clock; one claim per (game, policy), also under concurrent sessions.
Save: hash mismatch stores nothing; a second save is refused; a late save is refused. A writer whose save
runs before the deadline but commits after it is stored, yet can only be witnessed without qualification.
Settle (never retry): waits on the claim row lock for an in-flight save, reports present after its commit,
fences after its rollback or when no save exists, and fails at lock_timeout rather than guessing.
Read/lookup: recompute the hash from committed bytes; report version, schedule state, witness, outcome and
the DB clock; base64 has no line breaks; lookup by (game, policy) finds a claim whose response was lost.
Witness: binds claim, game, policy, both hashes and row version; the digest is computed from the exact text;
upper bound = gen_time + accuracy; the attested read follows the commit; qualified only by T−60.
Outcome: one per (game, policy) and per claim, consistent with state under the claim lock (never_dispatched
only without a claim; source_failed/save_unknown fence and need no artifact; saved_without_valid_witness needs
an artifact; qualified needs a qualified witness); a closed game cannot be claimed again.
Sweeper: closes orphaned claims past deadline + grace by state, skips one whose row lock is held, and never
overwrites an outcome. Immutability: no direct table access for service_role, anon or authenticated; update,
delete and truncate rejected for the owner and for a superuser under session_replication_role = replica;
only service_role may execute the functions. Rollback drops it all. Runs about 90 s (it waits out a grace).
Run: LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_pregame_capture_custody.py
"""
import base64
import datetime
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
POLICY = "pregame-native-v1"

ROLES = """
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create role supa_owner login nosuperuser; grant create on database postgres to supa_owner;
grant create, usage on schema public to supa_owner; grant usage on schema public to service_role;
"""
TABLES = """
create table public.games (id bigint primary key, date date not null, "seasonId" bigint not null,
  "startTime" timestamptz not null, "homeTeamId" smallint not null, "awayTeamId" smallint not null);
create table public.roster_optimizer_team_games (source_game_id bigint not null, team_abbreviation character(3) not null,
  game_status text not null, schedule_status text not null, fetched_at timestamptz not null);
"""

failures = []


def check(name, condition):
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)


def raises(name, fn, fragment):
    try:
        fn()
        check(name, False)
    except psycopg2.Error as error:
        ok = fragment in str(error)
        if not ok:
            print("   got:", str(error).splitlines()[0])
        check(name, ok)


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
            server.kill()
            server.wait()
    print(f"{'FAILED' if failures else 'OK'}: {len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


def run(host):
    def connect(user="postgres"):
        conn = psycopg2.connect(host=host, port=PORT, user=user, dbname="postgres")
        conn.autocommit = True
        return conn

    def as_service():
        conn = connect()
        conn.cursor().execute("set role service_role")
        return conn

    def held_save_conn():
        conn = connect()
        conn.autocommit = False
        cursor = conn.cursor()
        cursor.execute("set role service_role")
        return conn, cursor

    sup = connect().cursor()
    sup.execute(ROLES)
    own = connect("supa_owner").cursor()
    own.execute(TABLES)
    own.execute(MIGRATION.read_text())
    own.execute("insert into public.roster_optimizer_team_games values (1, 'AAA', 'FUT', 'OK', now()), (1, 'BBB', 'FUT', 'OK', now())")

    def add_game(gid, seconds_ahead):
        own.execute("""insert into public.games values (%s, current_date, 20262027, clock_timestamp() + make_interval(secs => %s), 10, 20)
          returning "startTime" """, (gid, seconds_ahead))
        return own.fetchone()[0]

    start = {gid: add_game(gid, secs) for gid, secs in {1: 3 * 3600, 2: 1800, 5: 4 * 3600, 6: 3 * 3600, 7: 3 * 3600,
                                                         8: 3 * 3600, 9: 3 * 3600, 10: 3 * 3600}.items()}
    svc = as_service()
    s = svc.cursor()

    def claim(game, policy=POLICY, required=60000, conn=None, **override):
        c = (conn or svc).cursor()
        c.execute("select * from public.forge_pregame_capture_claim_v1(%s, %s, current_date, %s::smallint, %s::smallint, %s, %s, %s, %s)",
                  (game, policy, override.get("home", 10), override.get("away", 20), REV, override.get("start", start.get(game)), required, CODE))
        return c.fetchone()

    def count(table):
        own.execute(f"select count(*) from forge_pregame_capture.{table}")
        return own.fetchone()[0]

    packet = json.dumps({"gameId": 1, "reads": [1, 2, 3]}, separators=(",", ":")).encode()
    canonical = sha(b"canonical-form")

    def save(cid, data=packet, cursor=None):
        c = cursor or s
        c.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)", (cid, b64(data), sha(data), canonical))
        return c.fetchone()

    def settle(cid, conn=None):
        c = (conn or svc).cursor()
        c.execute("select state from public.forge_pregame_capture_settle_v1(%s)", (cid,))
        return c.fetchone()[0]

    def read(cid):
        s.execute("select * from public.forge_pregame_capture_read_v1(%s)", (cid,))
        cols = [d[0] for d in s.description]
        return dict(zip(cols, s.fetchone()))

    def outcome(game, cid, value, policy=POLICY):
        s.execute("select public.forge_pregame_capture_record_outcome_v1(%s, %s, %s, %s, '{}')", (game, policy, cid, value))
        return s.fetchone()[0]

    def statement_for(cid, game, row, **override):
        body = {"claimId": str(cid), "gameId": str(game), "policyId": POLICY, "rawSha256": row["stored_raw_sha256"],
                "canonicalSha256": row["canonical_sha256"], "rowVersion": row["row_version"], "dbReadAt": row["db_read_at"].isoformat()}
        body.update(override)
        return json.dumps(body, sort_keys=True, separators=(",", ":"))

    def witness(cid, game, verdict, reason=None, accuracy_us=1_500_000, upper=None, row=None, text=None, gen=None, final="read"):
        row = row or read(cid)
        gen = gen or row["db_read_at"] + datetime.timedelta(seconds=1)
        upper = upper or gen + datetime.timedelta(microseconds=accuracy_us)
        final_at = row["db_read_at"] if final == "read" else final
        s.execute("select public.forge_pregame_capture_record_witness_v1(%s, %s, %s, %s, %s, 'token', %s, %s, %s, %s, %s, %s)",
                  (cid, text or statement_for(cid, game, row), b64(b"\x30" * 80), gen, accuracy_us, "b" * 64, upper, row["db_read_at"],
                   final_at, verdict, reason))
        return s.fetchone()[0]

    # --- claims ---
    check("binding mismatch (sides) refused", claim(1, home=11)[0] == "binding_mismatch")
    check("binding mismatch (start) refused", claim(1, start="2030-01-01T00:00:00Z")[0] == "binding_mismatch")
    check("late start refused", claim(2)[0] == "late_start")
    check("insufficient time refused", claim(5, required=3 * 3600 * 1000 + 1000)[0] == "insufficient_time")
    check("refusals insert nothing", count("claims") == 0)
    first = claim(1)
    check("claim succeeds", first[0] == "claimed" and first[1] is not None)
    check("ack deadline is start minus 60 minutes", first[2] == start[1] - datetime.timedelta(minutes=60))
    check("cutoff is the claim's own database clock", first[4] == first[3])
    check("duplicate refused", claim(1)[0] == "duplicate" and count("claims") == 1)
    claim_id = first[1]

    results = []
    threads = [threading.Thread(target=lambda: results.append(claim(5, policy="race-policy", conn=as_service())[0])) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    check("concurrent claims: exactly one wins", sorted(results) == ["claimed", "duplicate", "duplicate", "duplicate"])

    # --- save ---
    raises("hash mismatch refused", lambda: s.execute("select * from public.forge_pregame_capture_save_v1(%s, %s, %s, %s)",
                                                       (claim_id, b64(packet), "0" * 64, canonical)), "capture_raw_hash_mismatch")
    check("mismatch stored nothing", count("artifacts") == 0)
    saved = save(claim_id)
    check("save stores bytes with server hash", saved[0] == sha(packet) and saved[1] == len(packet))
    raises("second save refused", lambda: save(claim_id, b"other"), "duplicate key")

    # --- read, lookup ---
    row = read(claim_id)
    check("read returns committed bytes without line breaks", "\n" not in row["packet_base64"] and base64.b64decode(row["packet_base64"]) == packet)
    big = claim(9)[1]
    save(big, data=bytes(range(256)) * 64)
    check("large packet base64 has no line breaks", "\n" not in read(big)["packet_base64"])
    check("read recomputes hash from bytes", row["raw_sha256"] == row["stored_raw_sha256"] == sha(packet))
    check("read reports version, start, statuses, fetch time and DB clock",
          bool(row["row_version"]) and row["current_start"] == start[1] and row["team_game_statuses"] == ["AAA:FUT:OK", "BBB:FUT:OK"]
          and row["team_game_fetched_at"] is not None and row["db_read_at"] is not None and row["witness_verdict"] is None and row["outcome"] is None)
    s.execute("select * from public.forge_pregame_capture_lookup_v1(1, %s)", (POLICY,))
    found = s.fetchone()
    check("lookup by game and policy finds the claim", found[0] == claim_id and found[1] is True and found[4] is None)
    s.execute("select * from public.forge_pregame_capture_lookup_v1(999, %s)", (POLICY,))
    check("lookup with no claim returns an empty claim", s.fetchone()[0] is None)

    # --- late save and commit-after-deadline writer ---
    start[3], start[4] = add_game(3, 3606), add_game(4, 3606)
    late, straddle = claim(3, required=1000), claim(4, required=1000)
    check("near-deadline claims succeed", late[0] == "claimed" and straddle[0] == "claimed")
    writer, w = held_save_conn()
    save(straddle[1], cursor=w)
    time.sleep(7)  # both deadlines pass while the straddling writer has not committed
    raises("late save refused", lambda: save(late[1]), "capture_save_late")
    writer.commit()
    straddle_row = read(straddle[1])
    check("writer that commits after the deadline is stored", straddle_row["artifact_present"] and straddle_row["db_read_at"] > straddle_row["ack_deadline"])
    raises("late acknowledgement cannot qualify", lambda: witness(straddle[1], 4, "qualified", row=straddle_row), "capture_witness_late")
    # Token bound inside T-60, but the final committed readback (database clock) after it: still not qualified.
    in_time_gen = straddle_row["ack_deadline"] - datetime.timedelta(seconds=3)
    raises("token in time but final readback after T-60 cannot qualify",
           lambda: witness(straddle[1], 4, "qualified", row=straddle_row, gen=in_time_gen), "capture_witness_final_read_late")
    raises("a qualified witness needs a final readback",
           lambda: witness(straddle[1], 4, "qualified", row=straddle_row, gen=in_time_gen, final=None), "capture_witness_final_read_late")
    raises("final readback cannot precede the attested read",
           lambda: witness(straddle[1], 4, "saved_without_valid_witness", "x", row=straddle_row,
                           final=straddle_row["db_read_at"] - datetime.timedelta(seconds=1)), "capture_witness_read_order")
    check("late writer can only be witnessed without qualification",
          witness(straddle[1], 4, "saved_without_valid_witness", "ack_after_deadline", row=straddle_row) is not None)

    # --- witness constraints ---
    raises("witness hash binding mismatch refused", lambda: witness(claim_id, 1, "qualified", text=statement_for(claim_id, 1, row, rawSha256="1" * 64)), "capture_witness_binding")
    raises("witness row version mismatch refused", lambda: witness(claim_id, 1, "qualified", text=statement_for(claim_id, 1, row, rowVersion="1")), "capture_witness_binding")
    raises("upper bound must equal gen time + accuracy", lambda: witness(claim_id, 1, "qualified", upper=row["db_read_at"]), "witnesses_upper")
    early = dict(row, db_read_at=row["db_read_at"] - datetime.timedelta(hours=1))
    raises("attested read must follow the commit", lambda: witness(claim_id, 1, "qualified", row=early), "capture_witness_read_order")
    raises("negative accuracy refused", lambda: witness(claim_id, 1, "qualified", accuracy_us=-1), "check constraint")

    # Earliest applicable start: an earlier current games."startTime" tightens both bounds.
    start[11] = add_game(11, 3 * 3600)
    c11 = claim(11)[1]
    save(c11)
    own.execute('update public.games set "startTime" = clock_timestamp() + interval \'30 minutes\' where id = 11')
    raises("earlier current start refuses a token bound past its T-60", lambda: witness(c11, 11, "qualified"), "capture_witness_late")

    # --- outcomes ---
    raises("qualified outcome needs a qualified witness", lambda: outcome(1, claim_id, "qualified"), "capture_outcome_state")
    raises("never_dispatched refused while a claim exists", lambda: outcome(1, None, "never_dispatched"), "capture_outcome_claim_exists")
    raises("a claim outcome needs its claim id", lambda: outcome(1, None, "save_unknown"), "capture_outcome_needs_claim")
    raises("source_failed refused when an artifact exists", lambda: outcome(1, claim_id, "source_failed"), "capture_outcome_state")
    witness(claim_id, 1, "qualified")
    own.execute("select bool_and(statement_sha256 = encode(sha256(convert_to(statement_text, 'UTF8')), 'hex')) from forge_pregame_capture.witnesses")
    check("witness digest is computed from the exact statement text", own.fetchone()[0] is True)
    raises("saved_without_valid_witness refused beside a qualified witness", lambda: outcome(1, claim_id, "saved_without_valid_witness"), "capture_outcome_state")
    check("qualified outcome recorded", outcome(1, claim_id, "qualified") is not None)
    raises("one outcome per game and policy", lambda: outcome(1, claim_id, "qualified"), "duplicate key")
    final = read(claim_id)
    check("read reports the qualified witness and outcome", final["outcome"] == "qualified" and final["witness_verdict"] == "qualified")
    check("never_dispatched without a claim", outcome(99, None, "never_dispatched") is not None)
    start[99] = add_game(99, 3 * 3600)
    check("a closed game cannot be claimed again", claim(99)[0] == "duplicate")

    # --- settle fence ---
    c6 = claim(6)[1]
    inflight, ic = held_save_conn()
    save(c6, cursor=ic)
    settled = {}
    waiter = threading.Thread(target=lambda: settled.setdefault("state", settle(c6, as_service())))
    waiter.start()
    time.sleep(1.0)
    check("settle waits for the in-flight save", waiter.is_alive())
    inflight.commit()
    waiter.join(10)
    check("settle after commit reports present", settled.get("state") == "present")

    c7 = claim(7)[1]
    inflight, ic = held_save_conn()
    save(c7, cursor=ic)
    settled = {}
    waiter = threading.Thread(target=lambda: settled.setdefault("state", settle(c7, as_service())))
    waiter.start()
    time.sleep(1.0)
    inflight.rollback()
    waiter.join(10)
    check("settle after rollback fences", settled.get("state") == "fenced")
    raises("save after fence refused", lambda: save(c7), "capture_save_fenced")
    fenced_row = read(c7)
    check("read reports fence and no artifact", (fenced_row["artifact_present"], fenced_row["save_fenced"]) == (False, True))
    check("save_unknown recorded for a fenced claim", outcome(7, c7, "save_unknown") is not None)

    c8 = claim(8)[1]
    check("settle with no save fences, repeatably", settle(c8) == "fenced" and settle(c8) == "fenced")
    check("source_failed recorded after a fence", outcome(8, c8, "source_failed") is not None)

    c10 = claim(10)[1]
    inflight, ic = held_save_conn()
    save(c10, cursor=ic)
    started = time.time()
    raises("settle bounded by lock_timeout", lambda: settle(c10), "lock timeout")
    check("settle lock wait is about 5 s", 4.0 <= time.time() - started <= 8.0)
    inflight.rollback()
    check("source_failed for a claim with no save", outcome(10, c10, "source_failed") is not None)
    raises("source_failed fence blocks a straggling save", lambda: save(c10), "capture_save_fenced")

    # --- sweeper ---
    raises("sweeper bounds enforced", lambda: s.execute("select * from public.forge_pregame_capture_sweep_v1(10, 5)"), "capture_sweep_bounds")
    start[12], start[13] = add_game(12, 3602), add_game(13, 3602)
    orphan_saved, orphan_empty = claim(12, required=1000)[1], claim(13, required=1000)[1]
    save(orphan_saved)
    s.execute("select game_id from public.forge_pregame_capture_sweep_v1(60, 50)")
    check("sweeper ignores claims inside deadline + grace", s.fetchall() == [])
    time.sleep(64)  # deadlines (+2 s) plus the minimum 60 s grace
    blocker, bc = held_save_conn()
    bc.execute("select 1 from public.forge_pregame_capture_settle_v1(%s)", (orphan_empty,))  # holds orphan_empty's row lock
    s.execute("select game_id, outcome from public.forge_pregame_capture_sweep_v1(60, 50)")
    swept = dict(s.fetchall())
    check("sweeper closes orphans by state and skips a locked one",
          swept == {3: "save_unknown", 4: "saved_without_valid_witness", 12: "saved_without_valid_witness"})
    blocker.rollback()
    s.execute("select game_id, outcome from public.forge_pregame_capture_sweep_v1(60, 50)")
    check("a later sweep takes the skipped claim", dict(s.fetchall()) == {13: "save_unknown"})
    s.execute("select * from public.forge_pregame_capture_sweep_v1(60, 50)")
    check("sweeper never overwrites an outcome", s.fetchall() == [])
    raises("swept orphan is fenced", lambda: save(orphan_empty), "capture_save_fenced")

    # --- grants and immutability ---
    for table in ("claims", "artifacts", "save_fences", "witnesses", "outcomes"):
        for role in ("service_role", "anon", "authenticated"):
            c = connect().cursor()
            c.execute(f"set role {role}")
            raises(f"{role} cannot read {table} directly", lambda: c.execute(f"select 1 from forge_pregame_capture.{table} limit 1"), "permission denied")
        column = "policy_id" if table in ("claims", "outcomes") else "claim_id"
        for statement_sql in (f"update forge_pregame_capture.{table} set {column} = {column}",
                              f"delete from forge_pregame_capture.{table}", f"truncate forge_pregame_capture.{table} cascade"):
            verb = statement_sql.split()[0]
            raises(f"owner cannot mutate {table}: {verb}", lambda: own.execute(statement_sql), "immutable")
            sup.execute("set session_replication_role = replica")
            raises(f"replica-mode superuser cannot mutate {table}: {verb}", lambda: sup.execute(statement_sql), "immutable")
            sup.execute("reset session_replication_role")
    for role in ("anon", "authenticated"):
        c = connect().cursor()
        c.execute(f"set role {role}")
        raises(f"{role} cannot execute capture functions", lambda: c.execute("select * from public.forge_pregame_capture_read_v1(%s)", (claim_id,)), "permission denied")
    own.execute("""select count(*) from pg_proc p where p.proname like 'forge\\_pregame\\_capture\\_%' and p.prosecdef
      and pg_get_userbyid(p.proowner) = 'supa_owner'""")
    check("all eight public functions are SECURITY DEFINER owned by the non-superuser owner", own.fetchone()[0] == 8)

    # --- rollback ---
    own.execute(ROLLBACK.read_text())
    own.execute("select count(*) from pg_namespace where nspname = 'forge_pregame_capture'")
    schemas = own.fetchone()[0]
    own.execute("select count(*) from pg_proc where proname like 'forge_pregame_capture%'")
    check("rollback drops schema and functions", schemas == 0 and own.fetchone()[0] == 0)


if __name__ == "__main__":
    main()

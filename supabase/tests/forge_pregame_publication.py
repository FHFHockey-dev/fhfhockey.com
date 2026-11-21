#!/usr/bin/env python3
"""Disposable PostgreSQL publication regression using production DDL and real custody RPCs.

Run: LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_pregame_publication.py
Print the same disposable schema for the companion JS integration: pass --schema.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timedelta
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase/migrations"
PG = Path(os.environ.get("FORGE_TEST_PG_BIN", "/opt/homebrew/opt/postgresql@15/bin"))
SHA = "1" * 40
CANONICAL_SHA = "2" * 64
REVISIONS = ["3" * 64, "4" * 64]
CALENDAR = hashlib.sha256(json.dumps(REVISIONS, separators=(",", ":")).encode()).hexdigest()


def fixture_schema():
    baseline = (MIGRATIONS / "20260716112908_production_schema_baseline.sql").read_text()
    foundation = (MIGRATIONS / "20260802163747_add_player_forecast_foundation.sql").read_text()
    news_queue = (MIGRATIONS / "20260916014510_starter_board_news_queue.sql").read_text()
    operational_reporting = (MIGRATIONS / "20260916045842_starter_board_operational_reporting.sql").read_text()
    tables = ("teams", "seasons", "games", "players", "yahoo_matchup_weeks", "forge_runs",
              "forge_player_projections", "forge_team_projections", "forge_goalie_projections")
    public_tables = "|".join(tables)
    ddl = ["""
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;
        create schema extensions;
        create extension pgcrypto with schema extensions;
        create schema vault;
        create table vault.decrypted_secrets (name text, decrypted_secret text);
        create schema net;
        create function net.http_post(url text, body jsonb, params jsonb default '{}'::jsonb,
          headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 2000)
        returns bigint language sql as $$select null::bigint$$;
    """]
    ddl += [re.search(r'CREATE TYPE public\."NHL_Position_Code" AS ENUM \(.*?\n\);', baseline, re.S)[0]]
    ddl += [re.search(r"CREATE TABLE public\." + table + r" \(.*?\n\);", baseline, re.S)[0] for table in tables]
    ddl += re.findall(r"ALTER TABLE ONLY public\.(?:" + public_tables + r")\s+ADD CONSTRAINT .*? PRIMARY KEY .*?;", baseline)
    ddl += re.findall(r"ALTER TABLE ONLY public\.(?:" + public_tables + r")\s+ADD CONSTRAINT .*? FOREIGN KEY .*? REFERENCES public\.(?:" + public_tables + r")\(.*?;", baseline)
    ddl += [re.search(r"CREATE FUNCTION public\.touch_updated_at\(\).*?\$\$;", baseline, re.S)[0]]
    ddl += ["create schema fhfh_internal; revoke all on schema fhfh_internal from public;"]
    ddl += [re.search(pattern, foundation, re.S)[0] for pattern in (
        r"create table public\.player_forecast_source_observations \(.*?\n\);",
        r"create or replace function fhfh_internal\.reject_player_forecast_mutation\(\).*?\$\$;")]
    ddl += [re.search(r"create table public\.forge_game_update_queue \(.*?\n\);", news_queue, re.S)[0]]
    ddl += ["""
      create trigger player_forecast_source_observations_immutable before update or delete on public.player_forecast_source_observations
        for each row execute function fhfh_internal.reject_player_forecast_mutation();
      alter table public.player_forecast_source_observations enable row level security;
      revoke all on public.player_forecast_source_observations from public, anon, authenticated;
      grant select, insert on public.player_forecast_source_observations to service_role;
      grant select on public.games, public.players, public.teams to service_role;
      grant select on public.forge_runs, public.forge_player_projections, public.forge_team_projections,
        public.forge_goalie_projections to service_role;
    """]
    ddl += [(MIGRATIONS / filename).read_text() for filename in (
        "20260829161013_add_roster_optimizer_team_game_schedule.sql",
        "20260916012353_starter_board_game_revisions.sql",
        "20260916023000_starter_board_release_control.sql",
    )]
    for source, function, trigger in [
        (news_queue, "guard_starter_board_publication", "starter_board_publication_guard"),
        (operational_reporting, "capture_starter_board_revision_timing", "starter_board_revision_timing"),
    ]:
        ddl.extend([re.search(pattern, source, re.S)[0] for pattern in (
            rf"create function fhfh_internal\.{function}\(\).*?\$\$;", rf"create trigger {trigger}\b.*?;")])
    ddl += [(MIGRATIONS / filename).read_text() for filename in (
        "20261002021651_forge_local_execution_fence.sql",
        "20261004181455_forge_public_revision_reader.sql",
        "20261027090000_forge_reserve_projections.sql",
        "20261115000000_forge_pregame_capture_custody.sql",
        "20261117215012_forge_pregame_hosted_dispatch.sql",
        "20261118135813_forge_pregame_publication.sql",
    )]
    return "\n".join(ddl)


@contextmanager
def publication_db():
    import psycopg2

    with tempfile.TemporaryDirectory(dir="/tmp", prefix="forge-pub-") as directory:
        data = Path(directory) / "data"
        subprocess.run([str(PG / "initdb"), "-D", str(data), "-U", "postgres", "--no-locale", "--encoding=UTF8", "-A", "trust"],
                       stdout=subprocess.DEVNULL, check=True)
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"),
                        "-o", f"-k {directory} -c listen_addresses=''", "-w", "start"], stdout=subprocess.DEVNULL, check=True)
        try:
            @contextmanager
            def connect(role=None, autocommit=True):
                conn = psycopg2.connect(dbname="postgres", user="postgres", host=directory)
                try:
                    conn.autocommit = autocommit
                    if role:
                        row(conn, f"set role {role}")
                    yield conn
                    if not autocommit:
                        conn.commit()
                finally:
                    conn.close()

            with connect() as conn:
                row(conn, fixture_schema())
            yield connect
        finally:
            subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "stop"],
                           stdout=subprocess.DEVNULL, check=True)


def row(conn, sql, args=None):
    with conn.cursor() as cursor:
        cursor.execute(sql, args)
        return cursor.fetchone() if cursor.description else None


def record(conn, sql, args=None):
    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(sql, args)
        return cursor.fetchone()


def expect(label, actual, expected):
    if actual != expected:
        raise AssertionError(f"{label}: got {actual!r}, expected {expected!r}")
    print(f"PASS {label}")


def refused(label, call, state, message=None):
    import psycopg2

    try:
        call()
    except psycopg2.Error as error:
        expect(label, error.pgcode, state)
        if message and error.diag.message_primary != message:
            raise AssertionError(error.diag.message_primary) from error
    else:
        raise AssertionError(f"{label}: unsafe call was accepted")


def seed_identities(admin):
    row(admin, """
      insert into public.seasons(id,"startDate","endDate","regularSeasonEndDate","numberOfGames")
        values(20402041,'2040-01-01','2041-12-31','2041-04-01',82);
      insert into public.teams(id,name,abbreviation) values(11,'Fixture home','HOM'),(12,'Fixture away','AWY');
      insert into public.players(id,"firstName","lastName","fullName","position","birthDate","heightInCentimeters","weightInKilograms")
        select i,'Test',i::text,'Test '||i::text,(case when i in (103, 104, 105) then 'G' else 'C' end)::public."NHL_Position_Code",
          '2000-01-01',183,83 from generate_series(100,106) i;
    """)


def claim_game(admin, service, game_id, qualified=True, policy="pregame-native-v1"):
    game = record(admin, """
      insert into public.games(id,date,"seasonId","startTime","homeTeamId","awayTeamId",type)
        values(%s,(clock_timestamp() + interval '85 minutes') at time zone 'America/New_York',20402041,
          clock_timestamp()+interval '85 minutes',11,12,2) returning id,date,"startTime"
    """, [game_id])
    game_date, start = game["date"], game["startTime"]
    row(admin, """
      insert into public.roster_optimizer_team_games(game_key,season,source_game_id,source_season_id,game_date,start_time,
        game_type,game_status,schedule_status,mapping_status,team_id,team_abbreviation,opponent_team_id,opponent_abbreviation,
        home_away,source_url,fetched_at)
      select 'fixture:'||%s::text,'2040',%s,20402041,%s,%s,2,'FUT','OK','unmapped',team,abb,opponent,opp_abbr,
        side,'fixture-source',clock_timestamp()
      from (values(11,'HOM',12,'AWY','home'),(12,'AWY',11,'HOM','away')) as teams(team,abb,opponent,opp_abbr,side)
    """, [game_id, game_id, game_date, start])
    claim = record(service, "select * from public.forge_pregame_capture_claim_v1(%s,%s,%s,11::smallint,12::smallint,%s,%s,1000,%s)",
                   [game_id, policy, game_date, CALENDAR, start, SHA])
    if claim["outcome"] != "claimed":
        raise AssertionError(claim)
    claim_id, cutoff = claim["claim_id"], claim["input_cutoff"]
    if not qualified:
        return claim_id, cutoff, start, game_date, CANONICAL_SHA
    raw_sha = hashlib.sha256(b"input packet fixture").hexdigest()
    row(service, "select * from public.forge_pregame_capture_save_v1(%s,%s,%s,%s)",
        [claim_id, "aW5wdXQgcGFja2V0IGZpeHR1cmU=", raw_sha, CANONICAL_SHA])
    read = record(service, "select * from public.forge_pregame_capture_read_v1(%s)", [claim_id])
    db_read = read["db_read_at"]
    statement = {"version": "forge-pregame-witness-v1", "claimId": claim_id, "gameId": str(game_id), "policyId": policy,
                 "rawSha256": raw_sha, "canonicalSha256": CANONICAL_SHA, "rowVersion": read["row_version"],
                 "byteLength": read["byte_length"], "calendarRevision": CALENDAR, "scheduledStart": start.isoformat(),
                 "currentStart": start.isoformat(), "dbReadAt": db_read.isoformat(), "nonce": "1"}
    time.sleep(0.002)
    end = row(service, "select clock_timestamp()")[0]
    row(service, """
      select public.forge_pregame_capture_record_witness_v1(%s,%s,encode(decode(repeat('01',64),'hex'),'base64'),
        %s,0::bigint,1::bigint,'token',repeat('5',64),%s,%s,%s,'qualified',null)
    """, [claim_id, json.dumps(statement), db_read, db_read + timedelta(microseconds=1), db_read, end])
    row(service, "select public.forge_pregame_capture_record_outcome_v1(%s,%s,%s,'qualified','{}')", [game_id, policy, claim_id])
    return claim_id, cutoff, start, game_date, raw_sha


def make_payload(game_id, claim):
    claim_id, cutoff, start, game_date, raw_sha = claim
    scope = {"run_id": claim_id, "game_id": game_id, "horizon_games": 1, "as_of_date": str(game_date)}
    home = {**scope, "team_id": 11, "opponent_team_id": 12}
    away = {**scope, "team_id": 12, "opponent_team_id": 11}
    output_hash = "6" * 64
    snapshot = {
        "version": "forge-inputs-v1", "replayClassification": "captured_live", "runId": claim_id, "codeVersion": SHA,
        "modelMode": "candidate", "slateDate": str(game_date), "gameIds": [game_id], "horizonGames": 1,
        "decisionAsOf": cutoff.isoformat(), "inputCutoff": cutoff.isoformat(), "outputHash": output_hash,
        "goalieStarts": [{"game_id": game_id, "team_id": 11, "player_id": 103, "start_probability": 0.8}],
        "inputProvenance": {"external_fantasy_input_contract": "fixture-contract", "capturedReads": {
            "version": "forge-captured-reads-v1", "hash": "7" * 64, "readCount": 1,
            "firstReceivedAt": cutoff.isoformat(), "lastReceivedAt": cutoff.isoformat()},
            "issuedTargets": {"outputHash": output_hash}, "issuedContexts": [{"version": "forge-issued-context-v1",
                "game": {"id": game_id, "date": str(game_date), "seasonId": 20402041, "homeTeamId": 11,
                         "awayTeamId": 12, "startTime": start.isoformat()},
                "schedule": [{"revision": revision} for revision in REVISIONS],
                "roster": [{"nhlId": 100, "teamId": 11}, {"nhlId": 101, "teamId": 12},
                           {"nhlId": 103, "teamId": 11}, {"nhlId": 104, "teamId": 12}]}]},
        "pregameCandidates": {"skaters": [100, 101], "goalies": [103, 104, 105], "reserves": [106]},
        "unknownPrivateProperty": "not retained",
    }
    metrics = {"completed_game_ids": [game_id, 88], "succeeded_observed_at": cutoff.isoformat(), "games": 1,
               "timed_out": False, "player_rows": 2, "team_rows": 2, "goalie_rows": 2}
    return [claim_id, SHA, raw_sha, CANONICAL_SHA, snapshot, metrics,
            [{**home, "player_id": 100, "proj_goals_es": 1.2}, {**away, "player_id": 101}], [home, away],
            [{**home, "goalie_id": 103, "starter_probability": 0.8}, {**away, "goalie_id": 104}],
            [{**home, "player_id": 106, "player_class": "skater", "conditioning": "if_dressed", "reserve_reason": "not_in_lineup",
              "model_version": SHA}, {**away, "player_id": 105, "player_class": "goalie", "conditioning": "if_starts",
              "reserve_reason": "backup_goalie", "model_version": SHA}]]


def publish(conn, payload):
    from psycopg2.extras import Json

    return row(conn, "select public.forge_pregame_publish_v1(" + ",".join(["%s"] * 10) + ")",
               [*payload[:4], *(Json(x) for x in payload[4:])])[0]


def receipt(conn, payload):
    return row(conn, "select public.forge_pregame_publication_receipt_v1(%s,%s,%s,%s)", payload[:4])[0]


def counts(conn):
    tables = ["public.forge_runs", "public.forge_player_projections", "public.forge_team_projections", "public.forge_goalie_projections",
              "public.forge_reserve_projections", "public.player_forecast_source_observations", "public.forge_game_revisions",
              "forge_pregame_capture.publications"]
    return row(conn, "select " + ",".join(f"(select count(*) from {table})" for table in tables))


def ordinary_revision(admin, game_id, slate, cutoff):
    return record(admin, """
      with run as (
        insert into public.forge_runs(as_of_date,status) values(%(slate)s,'succeeded') returning run_id
      ), inputs as (
        insert into public.player_forecast_source_observations(provider,dataset_key,entity_kind,entity_key,
          observed_at,available_at,payload_hash,payload)
        select 'forge','forge-run-inputs-v1','projection_run',run_id::text,%(cutoff)s,%(cutoff)s,'ordinary-fixture','{}'
        from run returning id
      )
      insert into public.forge_game_revisions(run_id,game_id,slate_date,input_snapshot_id,decision_as_of,published_at,payload)
      select run.run_id,%(game)s,%(slate)s,inputs.id,%(cutoff)s,%(cutoff)s,'{"codeVersion":"ordinary-fixture"}'
      from run,inputs returning id,published_at
    """, {"slate": slate, "cutoff": cutoff, "game": game_id})


def read_revision(conn, slate, game_id):
    return record(conn, "select * from public.read_forge_game_revisions(%s) where game_id=%s", [slate, game_id])


def exercise(connect):
    with connect() as admin, connect("service_role") as service:
        seed_identities(admin)
        data = make_payload(781, claim_game(admin, service, 781))
        invalid = make_payload(782, claim_game(admin, service, 782, qualified=False))
        wrong_policy = make_payload(783, claim_game(admin, service, 783, policy="different-native-v1"))
        late = make_payload(784, claim_game(admin, service, 784))
        split = make_payload(785, claim_game(admin, service, 785))
        rollback = make_payload(786, claim_game(admin, service, 786))
        stale = make_payload(787, claim_game(admin, service, 787))
        superseded = make_payload(788, claim_game(admin, service, 788))
        deferred = make_payload(789, claim_game(admin, service, 789))
        expect("missing receipt is null", receipt(service, data), None)
        with connect("anon") as anon, connect("authenticated") as authenticated:
            for role in [anon, authenticated]:
                refused("unprivileged publish", lambda: publish(role, data), "42501")
                refused("unprivileged receipt", lambda: receipt(role, data), "42501")
        refused("private custody is not directly readable by service role",
                lambda: row(service, "select * from forge_pregame_capture.publications"), "42501")
        refused("missing qualified artifact/witness/outcome", lambda: publish(service, invalid), "22023", "pregame_publication_custody")
        refused("wrong policy", lambda: publish(service, wrong_policy), "22023", "pregame_publication_custody")
        wrong = deepcopy(data)
        wrong[1] = wrong[4]["codeVersion"] = "a" * 40
        refused("wrong code pin", lambda: publish(service, wrong), "22023", "pregame_publication_custody")
        wrong = deepcopy(data)
        wrong[3] = "b" * 64
        refused("wrong packet digest", lambda: publish(service, wrong), "22023", "pregame_publication_custody")
        wrong = deepcopy(data)
        wrong[4]["inputCutoff"] = wrong[4]["decisionAsOf"] = "2000-01-01T00:00:00Z"
        refused("caller cannot backdate cutoff", lambda: publish(service, wrong), "22023", "pregame_publication_snapshot_binding")
        wrong = deepcopy(data)
        wrong[4]["decisionAsOf"] = (row(admin, "select clock_timestamp()")[0] + timedelta(seconds=30)).isoformat()
        refused("padded cutoff must elapse before publication", lambda: publish(service, wrong), "22023", "pregame_publication_snapshot_binding")
        wrong = deepcopy(data)
        wrong[4]["inputProvenance"]["issuedContexts"][0]["schedule"][0]["revision"] = "a" * 64
        refused("wrong retained calendar", lambda: publish(service, wrong), "22023", "pregame_publication_calendar_binding")
        wrong = deepcopy(data)
        wrong[6][0]["player_id"] = 102
        refused("wrong candidate player", lambda: publish(service, wrong), "22023", "pregame_publication_output_scope")
        wrong = deepcopy(data)
        wrong[6][0]["team_id"] = 12
        wrong[6][0]["opponent_team_id"] = 11
        refused("roster-conflicting team", lambda: publish(service, wrong), "22023", "pregame_publication_output_scope")
        wrong = deepcopy(data)
        wrong[7][0]["horizon_games"] = 2
        refused("cross-horizon output", lambda: publish(service, wrong), "22023", "pregame_publication_output_scope")
        wrong = deepcopy(data)
        wrong[8][0]["game_id"] = 782
        refused("cross-game output", lambda: publish(service, wrong), "22023", "pregame_publication_output_scope")
        wrong = deepcopy(data)
        wrong[8].pop()
        refused("partial terminal result refuses publication", lambda: publish(service, wrong), "22023", "pregame_publication_partial_output")
        wrong = deepcopy(rollback)
        wrong[9][1]["conditioning"] = "if_dressed"
        refused("physical reserve check rejects terminal write", lambda: publish(service, wrong), "23514")
        row(admin, "update public.games set \"startTime\"=clock_timestamp()-interval '1 minute' where id=784")
        refused("kickoff/change refuses new publication", lambda: publish(service, late), "22023", "pregame_publication_not_pregame")
        row(admin, "update public.roster_optimizer_team_games set game_status='LIVE' where source_game_id=787")
        refused("schedule status refuses new publication", lambda: publish(service, stale), "22023", "pregame_publication_not_pregame")
        row(admin, """insert into public.forge_game_update_queue(game_id,source_published_at,received_at)
                      values (788,clock_timestamp(),clock_timestamp())""")
        refused("newer accepted evidence still blocks revision", lambda: publish(service, superseded), "P0001",
                "FORGE inputs superseded by newer accepted evidence")
        expect("all refused runs leave no rows", counts(admin), (0, 0, 0, 0, 0, 0, 0, 0))

        # Verify concurrent calculations that differ only in operational clocks or row ordering converge.
        second_payload = deepcopy(data)
        second_payload[4]["capturedAt"] = row(admin, "select clock_timestamp()")[0].isoformat()
        second_payload[5]["elapsedMs"] = 91
        second_payload[6][0]["created_at"] = second_payload[4]["capturedAt"]
        second_payload[6].reverse()

        def concurrent_publish(payload):
            with connect("service_role") as another:
                return publish(another, payload)

        with ThreadPoolExecutor(2) as pool:
            receipts = list(pool.map(concurrent_publish, [data, second_payload]))
        first, duplicate = sorted(receipts, key=lambda value: value["alreadyPublished"])
        expect("concurrent retries use same stored IDs", duplicate, {**first, "alreadyPublished": True})
        expect("exactly one complete commit", counts(admin), (1, 2, 2, 2, 2, 1, 1, 1))
        expect("atomic publication has no commit-observation clock", first["observedAt"], None)
        expect("run, revision, input and H1 game have conserved scope and time", row(admin, """
          select f.metrics->'completed_game_ids', f.metrics->>'succeeded_observed_at', r.game_id, r.run_id::text,
            r.input_snapshot_id::text, p.claim_id::text, p.raw_sha256, p.canonical_sha256,
            f.created_at <= o.available_at and o.available_at <= r.published_at,
            o.payload ? 'reads', o.payload ? 'unknownPrivateProperty', o.payload->>'snapshotKind', (r.payload->'players'->0->>'proj_goals_es')::numeric
          from public.forge_runs f join public.forge_game_revisions r using (run_id)
          join public.player_forecast_source_observations o on o.id=r.input_snapshot_id
          join forge_pregame_capture.publications p on p.revision_id=r.id
        """), ([781], None, 781, data[0], first["inputSnapshotId"], data[0], data[2], data[3], True, False, False,
                  "qualified_pregame_receipt", Decimal("1.2")))
        stamp = receipt(service, data)
        expect("first committed read stamps release clock", bool(stamp["observedAt"] > stamp["publishedAt"]), True)
        expect("repeated receipt keeps stable observation", receipt(service, data), stamp)
        row(admin, "update public.games set \"startTime\"=clock_timestamp()-interval '1 minute' where id=781")
        expect("late read/retry preserves previously admitted publication", (receipt(service, data), publish(service, data)), (stamp, stamp))
        wrong = deepcopy(data)
        wrong[6][0]["proj_goals_es"] = 0.9
        refused("same claim with changed outputs conflicts", lambda: publish(service, wrong), "22023", "pregame_publication_conflict")
        wrong = deepcopy(data)
        wrong[2] = "e" * 64
        refused("receipt refuses changed digests", lambda: receipt(service, wrong), "22023", "pregame_publication_binding")

        actual_cutoff = row(admin, "select input_cutoff from forge_pregame_capture.claims where id=%s", [split[0]])[0]
        split[4]["decisionAsOf"] = (actual_cutoff + timedelta(milliseconds=250)).isoformat()
        row(admin, "select pg_sleep(greatest(0, extract(epoch from %s::timestamptz - clock_timestamp())))", [split[4]["decisionAsOf"]])
        expect("test cutoff is after the fast custody witness", row(admin, """
          select greatest(ack_upper, final_read_at) < %s::timestamptz
            from forge_pregame_capture.witnesses where claim_id=%s
        """, [split[4]["decisionAsOf"], split[0]])[0], True)
        with connect("service_role", autocommit=False) as in_tx:
            publish(in_tx, split)
            row(in_tx, "savepoint check_readback")
            refused("same transaction cannot stamp committed readback", lambda: receipt(in_tx, split), "55000",
                    "pregame_publication_uncommitted")
            row(in_tx, "rollback to savepoint check_readback")
        row(admin, "update public.games set \"startTime\"=clock_timestamp()-interval '1 minute' where id=785")
        expect("first late or schedule-changed acknowledgment leaves RSO observation absent", receipt(service, split)["observedAt"], None)

        def change_game_before_commit():
            with connect(autocommit=False) as txn:
                publish(txn, deferred)
                row(txn, "update public.games set \"startTime\"=clock_timestamp()-interval '1 minute' where id=789")

        refused("transaction end rechecks the puck-drop fence", change_game_before_commit, "22023", "pregame_publication_not_pregame")
        expect("transaction-end refusal rolls back issuance", receipt(service, deferred), None)


def exercise_revision_reader(connect):
    with connect() as admin, connect("service_role") as service, connect("anon") as anon:
        game_id, late_game_id = 790, 791
        claim = claim_game(admin, service, game_id)
        late_claim = claim_game(admin, service, late_game_id)
        slate, late_slate = claim[3], late_claim[3]
        older = ordinary_revision(admin, game_id, slate, claim[1] - timedelta(minutes=1))
        older_for_freeze = ordinary_revision(admin, late_game_id, late_slate, late_claim[1] - timedelta(minutes=1))
        expect("service still lacks internal schema lookup",
               row(service, "select has_schema_privilege(current_user,'fhfh_internal','USAGE')")[0], False)
        refused("anonymous still cannot read the revision RPC", lambda: read_revision(anon, slate, game_id), "42501")
        expect("ordinary revision time is unchanged", read_revision(service, slate, game_id)["published_at"], older["published_at"])

        payload = make_payload(game_id, claim)
        issued = publish(service, payload)
        expect("unconfirmed revision cannot replace a selected ordinary revision", read_revision(service, slate, game_id)["id"], older["id"])
        row(admin, "select public.select_starter_board_revision(%s,%s,'pending test')", [game_id, issued["revisionId"]])
        expect("explicit pin of unconfirmed revision fails closed", read_revision(service, slate, game_id), None)
        row(admin, "select public.select_starter_board_revision(%s,null,'reset test')", [game_id])
        expect("reset returns ordinary eligible latest", read_revision(service, slate, game_id)["id"], older["id"])

        later = ordinary_revision(admin, game_id, slate, claim[1] + timedelta(microseconds=1))
        row(admin, "select public.select_starter_board_revision(%s,%s,'ordinary test')", [game_id, later["id"]])
        expect("previousRevision skips unconfirmed past revision", read_revision(service, slate, game_id)["payload"]["previousRevision"]["id"], older["id"])

        stamp = receipt(service, payload)
        expect("previousRevision admits confirmed past revision", read_revision(service, slate, game_id)["payload"]["previousRevision"]["id"], issued["revisionId"])
        row(admin, "select public.select_starter_board_revision(%s,%s,'confirmed test')", [game_id, issued["revisionId"]])
        selected = read_revision(service, slate, game_id)
        expect("selected confirmed revision exposes conservative clock", (selected["id"], selected["published_at"]),
               (issued["revisionId"], datetime.fromisoformat(stamp["observedAt"])))
        expect("selected confirmed revision retains older comparison", selected["payload"]["previousRevision"]["id"], older["id"])

        cross_slate = ordinary_revision(admin, game_id, slate - timedelta(days=1), claim[1] - timedelta(days=1))
        row(admin, "select public.select_starter_board_revision(%s,%s,'cross-slate test')", [game_id, cross_slate["id"]])
        expect("eligible cross-slate selection keeps its existing precedence", read_revision(service, slate, game_id)["id"], cross_slate["id"])

        late_payload = make_payload(late_game_id, late_claim)
        publish(service, late_payload)
        row(admin, 'update public.games set "startTime"=clock_timestamp()-interval \'1 minute\' where id=%s', [late_game_id])
        expect("late first observation remains unavailable to live reader", receipt(service, late_payload)["observedAt"], None)
        row(service, "select public.freeze_starter_board_pregame(%s)", [late_slate])
        expect("freeze retains eligible ordinary revision", row(admin,
               "select revision_id from public.forge_final_pregame_revisions where game_id=%s", [late_game_id])[0], older_for_freeze["id"])
        expect("live reader honors eligible frozen revision", read_revision(service, late_slate, late_game_id)["id"], older_for_freeze["id"])

        row(admin, """
          create role forge_publication_rls_probe;
          grant select on public.forge_game_revisions, public.forge_game_selection_events, public.forge_final_pregame_revisions,
            public.forge_runs, fhfh_internal.visible_forge_game_revisions to forge_publication_rls_probe;
          grant execute on function public.read_forge_game_revisions(date), fhfh_internal.current_starter_board_revisions(date)
            to forge_publication_rls_probe;
        """)
        with connect("forge_publication_rls_probe") as probe:
            expect("revision reader honors caller RLS", read_revision(probe, slate, game_id), None)


if __name__ == "__main__":
    if "--schema" in sys.argv:
        print(fixture_schema())
    else:
        with publication_db() as disposable:
            exercise(disposable)
            exercise_revision_reader(disposable)

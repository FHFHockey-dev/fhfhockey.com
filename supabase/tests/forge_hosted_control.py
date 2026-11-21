#!/usr/bin/env python3
"""Offline PostgreSQL controls for hosted FORGE.
Run: LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_hosted_control.py --with-route
"""

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from psycopg2.extras import Json

sys.path.insert(0, str(Path(__file__).resolve().parent))
from forge_pregame_publication import (CALENDAR, MIGRATIONS, SHA, claim_game, expect, make_payload,
                                       publication_db, publish, record, refused, row, seed_identities)

GAME = 2026020250
SECRET = "offline-synthetic-signing-key-0123456789"
TICK = "select forge_pregame_capture.hosted_tick_v2()"


def setup(conn):
    baseline = (MIGRATIONS / "20260716112908_production_schema_baseline.sql").read_text()
    row(conn, re.search(r"CREATE TABLE public.cron_job_audit \(.*?\n\);", baseline, re.S)[0])
    row(conn, """
      create table net.test_requests(id bigint generated always as identity, url text, body jsonb, headers jsonb, timeout_ms integer);
      create or replace function net.http_post(url text, body jsonb, params jsonb default '{}'::jsonb,
        headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 2000)
      returns bigint language sql as $$
        insert into net.test_requests(url,body,headers,timeout_ms) values ($1,$2,$4,$5) returning id;
      $$;
      insert into vault.decrypted_secrets values ('forge_pregame_dispatch_secret',%s)
    """, [SECRET])
    for name in ("20261118210001_forge_hosted_runs", "20261118210002_forge_independent_witness",
                 "20261118210003_forge_hosted_progress"):
        row(conn, (MIGRATIONS / f"{name}.sql").read_text())
    seed_identities(conn)
    row(conn, """insert into public.seasons(id,"startDate","endDate","regularSeasonEndDate","numberOfGames")
        values(20262027,'2026-01-01','2027-12-31','2027-04-01',82);
      insert into public.teams(id,name,abbreviation) values(10,'Fixture Toronto','TOR'),(6,'Fixture Boston','BOS')""")


def seed_schedule(conn, lead_minutes=85, game=GAME):
    row(conn, """
      insert into public.games(id,date,"seasonId","startTime","homeTeamId","awayTeamId",type)
        select %s,(start at time zone 'America/New_York')::date,20262027,start,10,6,2
        from (select date_trunc('milliseconds',clock_timestamp())+%s*interval '1 minute' as start) t;
      insert into public.roster_optimizer_team_games(game_key,season,source_game_id,source_season_id,game_date,start_time,
        game_type,game_status,schedule_status,mapping_status,team_id,team_abbreviation,opponent_team_id,opponent_abbreviation,
        home_away,source_url,fetched_at)
      select 'test:'||g.id,'2026',g.id,g."seasonId",g.date,g."startTime",2,'FUT','OK','unmapped',team,abbrev,
        opponent,opp_abbrev,side,'fixture',clock_timestamp()
      from public.games g cross join (values(10,'TOR',6,'BOS','home'),(6,'BOS',10,'TOR','away'))
        t(team,abbrev,opponent,opp_abbrev,side) where g.id=%s
    """, [game, lead_minutes, game])


def enroll(conn, game=GAME, open_seconds=0.2, close_seconds=120):
    row(conn, """
      insert into forge_pregame_capture.hosted_runs(game_id,expected_code_version,scheduled_start,slate_date,
        open_at,close_at,witness_authority,witness_principal,player_id,context_id,app_origin)
      select id,%s,"startTime",date,clock_timestamp()+%s*interval '1 second',clock_timestamp()+%s*interval '1 second',
        'automated','forge_independent_verifier',100,'synthetic-single-center-points-v1','https://fixture.invalid'
      from public.games where id=%s
    """, [SHA, open_seconds, close_seconds, game])


def arm(conn, close_seconds=120):
    seed_schedule(conn)
    enroll(conn, close_seconds=close_seconds)
    row(conn, "select forge_pregame_capture.hosted_arm_v2(%s)", [GAME])
    row(conn, """select pg_sleep(greatest(0,extract(epoch from open_at-clock_timestamp())))
      from forge_pregame_capture.hosted_runs where game_id=%s""", [GAME])


def tick(conn):
    return row(conn, TICK)[0]


def counts(conn):
    return row(conn, """
      select (select count(*) from net.test_requests),(select count(*) from forge_pregame_capture.hosted_games),
        (select count(*) from forge_pregame_capture.claims)
    """)


def stage_id(conn, stage):
    return row(conn, "select id from forge_pregame_capture.hosted_steps where game_id=%s and stage=%s", [GAME, stage])[0]


def begin(conn, step):
    return row(conn, "select public.forge_hosted_stage_begin_v2(%s,%s)", [step, SHA])[0]


def finish(conn, step, reason=None):
    return row(conn, "select public.forge_hosted_stage_finish_v2(%s,%s,%s,null)", [step, SHA, reason])[0]


def preflight(conn):
    if tick(conn) != "preflight":
        raise AssertionError("expected preflight request")
    step = stage_id(conn, "preflight")
    if begin(conn, step)["stage"] != "preflight":
        raise AssertionError("expected preflight begin")
    return step


def ready(conn):
    if finish(conn, preflight(conn)) != "ready":
        raise AssertionError("positive preflight must reach ready")


def capture_begin(conn, step, compute=True, game=GAME):
    return record(conn, "select * from public.forge_pregame_hosted_begin_v2(%s,%s,%s,%s)", [step, SHA, compute, game])


def audit(conn, phase, reason):
    result = row(conn, """
      select count(*),min(status),min(rows_affected),bool_and(details=jsonb_build_object('gameId',%s,'phase',%s,'reason',%s))
      from public.cron_job_audit where job_name='forge-pregame-hosted-dispatch'
    """, [GAME, phase, reason])
    expect(f"{reason} produces one bounded terminal audit", result, (1, "failure", 1, True))


@contextmanager
def isolated(connect, close_seconds=120):
    with connect(autocommit=False) as conn:
        try:
            arm(conn, close_seconds)
            yield conn
        finally:
            conn.rollback()


def admission_cases(connect):
    with connect(autocommit=False) as conn:
        seed_schedule(conn)
        enroll(conn,open_seconds=30)
        bind = row(conn,'select date,"startTime" from public.games where id=%s',[GAME])
        claim = row(conn,"select outcome from public.forge_pregame_capture_claim_v1(%s,'pregame-native-v1',%s,10::smallint,6::smallint,%s,%s,160000,%s)",
                    [GAME,bind[0],CALENDAR,bind[1],SHA])
        expect("dormant registration preserves existing capture authority",claim,("claimed",))
        refused("cannot arm over another owner's committed custody",lambda:row(conn,
                "select forge_pregame_capture.hosted_arm_v2(%s)",[GAME]),"P0001","hosted_scope_ineligible")
        conn.rollback()
    for reason in ("capture_disabled", "compute_off", "wrong_game_scope"):
        with isolated(connect) as conn:
            step = preflight(conn)
            expect("consumed preflight cannot restart", begin(conn, step), None)
            expect(reason, finish(conn, step, reason), "skipped")
            expect("duplicate finish fenced", finish(conn, step, reason), "fenced")
            expect("refused preflight never takes slot or claim", (tick(conn), counts(conn)), ("idle", (1, 0, 0)))
            audit(conn, "skipped", reason)
    with isolated(connect) as conn:
        ready(conn)
        row(conn, "update public.roster_optimizer_team_games set start_time=start_time-interval '1 minute'")
        expect("earlier schedule closes after preflight", (tick(conn), counts(conn)), ("skipped", (1, 0, 0)))
        audit(conn, "skipped", "schedule_changed")
    with isolated(connect, close_seconds=0.7) as conn:
        ready(conn)
        row(conn, """select pg_sleep(greatest(0,extract(epoch from close_at-clock_timestamp())))
            from forge_pregame_capture.hosted_runs where game_id=%s""", [GAME])
        expect("late ready run cannot take a protected slot", (tick(conn), counts(conn)), ("skipped", (1, 0, 0)))
        audit(conn, "skipped", "dispatch_window_missed")

    for compute, game, reason in [(False, GAME, "compute_off"), (True, GAME + 1, "wrong_game_scope")]:
        with isolated(connect) as conn:
            ready(conn)
            expect("positive preflight permits capture request", tick(conn), "capture")
            step = stage_id(conn, "capture")
            refusal = capture_begin(conn, step, compute, game)
            expect("scope is rechecked at delivery", (refusal["status"], refusal["outcome"]), (reason, "never_dispatched"))
            expect("changed compute scope takes no claim", (tick(conn), counts(conn)), ("idle", (2, 1, 0)))
            audit(conn, "skipped", reason)
    with isolated(connect) as conn:
        ready(conn)
        tick(conn)
        step = stage_id(conn, "capture")
        started = capture_begin(conn, step)
        expect("duplicate capture delivery does not begin twice", (started["status"], capture_begin(conn, step)["status"]),
               ("started", "duplicate"))
        row(conn, "update forge_pregame_capture.hosted_games set stale_at=clock_timestamp()-interval '1 second'")
        expect("expired ambiguous capture never opens another attempt", (tick(conn), tick(conn), counts(conn)),
               ("unresolved", "idle", (2, 1, 0)))
        audit(conn, "unresolved", "capture_ack_unknown")
        seed_schedule(conn, game=GAME + 1)
        enroll(conn, GAME + 1)
        row(conn, "savepoint second_arm")
        refused("unresolved capture quarantines another game", lambda: row(conn,
            "select forge_pregame_capture.hosted_arm_v2(%s)", [GAME + 1]), "P0001", "hosted_scope_ineligible")
        row(conn, "rollback to savepoint second_arm")



def publication_loss_cases(connect):
    with isolated(connect) as conn:
        # Stage-local failure fixture. There is no committed publication receipt.
        row(conn, """
          update forge_pregame_capture.hosted_runs set phase='publish';
          insert into forge_pregame_capture.hosted_steps(game_id,stage,request_id,consumed_at)
            values(%s,'publish',99,clock_timestamp())
        """, [GAME])
        step = stage_id(conn, "publish")
        expect("lost publication response only waits for a receipt", finish(conn, step, "publication_unconfirmed"), "awaiting_receipt")
        expect("missing receipt cannot resend or authorize readers", (tick(conn), tick(conn), counts(conn)),
               ("awaiting_publication", "awaiting_publication", (0, 0, 0)))
        row(conn, """update forge_pregame_capture.hosted_steps set queued_at=clock_timestamp()-interval '241 seconds'
          where id=%s""", [step])
        expect("ambiguous publication ends without retry", (tick(conn), tick(conn), counts(conn)), ("unresolved", "idle", (0, 0, 0)))
        audit(conn, "unresolved", "publication_ack_unknown")

    # Seed existing qualified custody with the publisher's fixture packet; the standalone witness integration
    # tests cryptographic acceptance. For this gate regression seed its accepted verdict only after proving refusal.
    game = GAME + 5
    with connect() as owner, connect("service_role") as writer:
        claim = claim_game(owner, writer, game)
        payload = make_payload(game, claim)
        enroll(owner, game, open_seconds=-60)
        row(owner, """
          update forge_pregame_capture.hosted_runs set phase='publish',armed_at=clock_timestamp()-interval '2 minutes',
            claim_id=%s where game_id=%s
        """, [claim[0], game])
        step = row(owner, """insert into forge_pregame_capture.hosted_steps(game_id,stage,request_id)
            values(%s,'publish',98) returning id""", [game])[0]
        def fenced_publish():
            return row(writer, "select public.forge_hosted_publish_v2(" + ",".join(["%s"] * 11) + ")",
                       [step, *payload[:4], *(Json(value) for value in payload[4:])])[0]
        refused("unconsumed stage cannot publish", fenced_publish, "P0001", "hosted_publication_refused")
        expect("publication stage consumes one fence", begin(writer, step)["stage"], "publish")
        refused("publisher cannot substitute for absent independent verdict", fenced_publish, "22023", "independent_publication_gate")
        row(owner, """
          insert into forge_pregame_capture.independent_reads(claim_id,game_id,verifier_role)
            values(%s,%s,'forge_independent_verifier');
          insert into forge_pregame_capture.independent_checks(claim_id,verdict,raw_sha256,canonical_sha256,token_sha256)
            select a.claim_id,'accepted',a.raw_sha256,a.canonical_sha256,w.tsa_token_sha256
            from forge_pregame_capture.artifacts a join forge_pregame_capture.witnesses w using(claim_id) where a.claim_id=%s;
          insert into forge_pregame_capture.independent_verdicts
            (claim_id,game_id,verified_at,verifier_role,verdict,raw_sha256,canonical_sha256,token_sha256)
            select claim_id,%s,clock_timestamp(),'forge_independent_verifier',verdict,raw_sha256,canonical_sha256,token_sha256
            from forge_pregame_capture.independent_checks where claim_id=%s
        """, [claim[0], game, claim[0], game, claim[0]])
        refused("concurrent manual publisher lacks consumed dispatch fence", lambda: publish(writer, payload),
                "22023", "independent_publication_gate")
        expect("manual publication refusal rolls all writes back", row(owner, """
          select (select count(*) from public.forge_runs where run_id=%s),
                 (select count(*) from forge_pregame_capture.publications where claim_id=%s)
        """, [claim[0], claim[0]]), (0, 0))
        published = fenced_publish()
        expect("lost publish response reports only an unconfirmed outcome", finish(writer, step, "publication_unconfirmed"), "awaiting_receipt")
    with connect() as observer:
        row(observer, "update forge_pregame_capture.hosted_steps set queued_at=clock_timestamp()-interval '241 seconds' where id=%s", [step])
        expect("watch preserves the committed publication despite an expired delivery", watch(observer, game), "publish")
        expect("separately committed publication receipt advances to readers", tick(observer), "readers")
        seen = row(observer, "select publication from forge_pregame_capture.hosted_runs where game_id=%s", [game])[0]
        expect("recovered observation binds exact previously committed revision", (seen["revisionId"], seen["observedAt"] is not None),
               (published["revisionId"], True))
        expect("repeated tick never publishes twice", (tick(observer), row(observer, """
          select count(*) from net.test_requests where url like '%%forge-pregame-stage'""")[0],
            row(observer, "select count(*) from forge_pregame_capture.publications where claim_id=%s", [claim[0]])[0]),
            ("awaiting_readers", 1, 1))

        reader_step = row(observer, "select id from forge_pregame_capture.hosted_steps where game_id=%s and stage='readers'", [game])[0]
        begin(observer, reader_step)
        selected = {"selectedRun": claim[0], "playerId": "100", "points": 1.5, "legalSlot": "C#1", "reason": None}
        synthetic = {"playerNhlId": 100, "contextId": "synthetic-single-center-points-v1",
                     "daily": {**selected, "revisionId": "forge-daily-bridge-v1:" + claim[0]},
                     "detailed": {**selected, "revisionId": seen["revisionId"]}}
        terminal = row(observer, "select public.forge_hosted_stage_finish_v2(%s,%s,null,%s)", [reader_step, SHA, Json(synthetic)])[0]
        row(observer, "update forge_pregame_capture.hosted_steps set queued_at=clock_timestamp()-interval '241 seconds' where id=%s", [reader_step])
        expect("watch preserves the terminal outcome of a committed reader receipt", (terminal, watch(observer, game)),
               ("succeeded", "succeeded"))


def release_fence_cases(connect):
    def release(conn):
        return row(conn,"select forge_pregame_capture.hosted_release_fence_v2(%s)",[GAME])[0]
    with isolated(connect) as conn:
        row(conn,"select forge_pregame_capture.hosted_end_v2(%s,'unresolved','test_ack_unknown')",[GAME])
        expect("pregame unresolved fence remains held",release(conn),"awaiting_postgame")
    with connect(autocommit=False) as conn:
        seed_schedule(conn,lead_minutes=-10)
        enroll(conn,open_seconds=-6500,close_seconds=-6100)
        row(conn,"update forge_pregame_capture.hosted_runs set phase='unresolved',armed_at=open_at-interval '1 minute',terminal_at=clock_timestamp()")
        expect("postgame settled slot releases once without queueing",(release(conn),release(conn),tick(conn),counts(conn)),
               ("fence_released","already_reconciled","idle",(0,0,0)))
        expect("release retains original unresolved receipt",
               row(conn,"select phase,reconciled_at is not null from forge_pregame_capture.hosted_runs"),
               ("unresolved",True))
        conn.rollback()


def permissions(connect):
    for role in ("anon", "authenticated", "service_role"):
        with connect(role) as actor:
            refused(f"{role} cannot inspect private run", lambda: row(actor, "select * from forge_pregame_capture.hosted_runs"), "42501")
            refused(f"{role} cannot run owner tick", lambda: tick(actor), "42501")
            refused(f"{role} cannot inspect operator receipt", lambda: row(actor, "select forge_pregame_capture.hosted_receipt_v2(1)"), "42501")
            refused(f"{role} cannot run owner watch", lambda: watch(actor), "42501")
            if role != "service_role":
                refused(f"{role} cannot begin app stage", lambda: begin(actor, "00000000-0000-4000-8000-000000000001"), "42501")
                refused(f"{role} cannot begin capture", lambda: capture_begin(actor, "00000000-0000-4000-8000-000000000001"), "42501")


def watch(conn, game=GAME):
    return row(conn, "select forge_pregame_capture.hosted_watch_v2(%s)", [game])[0]


def monitoring_and_transport(connect):
    with connect() as owner:
        expect("watch cannot arm a target", watch(owner), "unarmed")
    with isolated(connect, close_seconds=0.6) as conn:
        expect("watch cannot emit an approved run", (watch(conn), counts(conn)), ("approved", (0, 0, 0)))
        row(conn, """select pg_sleep(greatest(0,extract(epoch from close_at-clock_timestamp())))
            from forge_pregame_capture.hosted_runs where game_id=%s""", [GAME])
        expect("missed Cron window gets terminal watch alert with no POST", (watch(conn), watch(conn), counts(conn)),
               ("skipped", "skipped", (0, 0, 0)))
        audit(conn, "skipped", "dispatch_window_missed")
    with isolated(connect) as conn:
        ready(conn)
        tick(conn)
        row(conn, "update forge_pregame_capture.hosted_games set stale_at=clock_timestamp()-interval '1 second'")
        expect("watch quarantines unconfirmed capture without issuing a replacement", (watch(conn), tick(conn), counts(conn)),
               ("unresolved", "idle", (2, 1, 0)))
        audit(conn, "unresolved", "capture_ack_unknown")
    with connect(autocommit=False) as conn:
        seed_schedule(conn, lead_minutes=59)
        enroll(conn, open_seconds=-720, close_seconds=-600)
        row(conn, """update forge_pregame_capture.hosted_runs set phase='verify',armed_at=clock_timestamp()-interval '20 minutes'
          where game_id=%s""", [GAME])
        expect("watch independently fails missed T-60 without publication", (watch(conn), counts(conn)), ("failed", (0, 0, 0)))
        audit(conn, "failed", "independent_deadline_missed")
        conn.rollback()
    for stage, reason in (("publish", "publication_ack_unknown"), ("readers", "reader_ack_unknown")):
        with isolated(connect) as conn:
            row(conn, """update forge_pregame_capture.hosted_runs set phase=%s where game_id=%s;
              insert into forge_pregame_capture.hosted_steps(game_id,stage,request_id,queued_at)
                values(%s,%s,99,clock_timestamp()-interval '241 seconds')""", [stage, GAME, GAME, stage])
            expect(f"stale {stage} without receipt alerts without reissuing", (watch(conn), tick(conn), counts(conn)),
                   ("unresolved", "idle", (0, 0, 0)))
            audit(conn, "unresolved", reason)
    for failure in ("missing signing key", "pg_net exception"):
        with isolated(connect) as conn:
            ready(conn)
            if failure == "missing signing key":
                row(conn, "delete from vault.decrypted_secrets")
            else:
                row(conn, """create or replace function net.http_post(url text,body jsonb,params jsonb default '{}'::jsonb,
                    headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 2000)
                  returns bigint language plpgsql as $$
                  begin
                    insert into net.test_requests(url,body,headers,timeout_ms) values ($1,$2,$4,$5);
                    raise exception 'fixture_dispatch_failure';
                  end $$""")
            expect(f"{failure} rolls back capture request and fence", (tick(conn), tick(conn), counts(conn)), ("failed", "idle", (1, 0, 0)))
            audit(conn, "failed", "dispatch_transport_unavailable")


def overlap(connect):
    with connect() as owner:
        arm(owner)
    def contender():
        with connect() as conn:
            return tick(conn)
    with connect(autocommit=False) as holder:
        expect("first scheduler owns preflight insert", tick(holder), "preflight")
        with ThreadPoolExecutor(max_workers=1) as pool:
            expect("overlapping scheduler skips locked transaction", pool.submit(contender).result(timeout=5), "locked")
    with connect() as owner:
        step = stage_id(owner, "preflight")
        expect("committed duplicate tick emits no second preflight", (tick(owner), counts(owner)), ("awaiting_preflight", (1, 0, 0)))
        begin(owner, step)
        finish(owner, step)
    with connect(autocommit=False) as holder:
        expect("positive preflight schedules a single capture", tick(holder), "capture")
        with ThreadPoolExecutor(max_workers=1) as pool:
            expect("capture enqueue lock prevents parallel issue", pool.submit(contender).result(timeout=5), "locked")
    with connect() as owner:
        step = stage_id(owner, "capture")
        url, body, headers, timeout = row(owner, "select url,body,headers,timeout_ms from net.test_requests order by id desc limit 1")
        signature = hmac.new(SECRET.encode(), f"capture-v2:{step}".encode(), hashlib.sha256).hexdigest()
        expect("queue binds exact UUID HMAC domain and four-minute cap", (url, body, headers.get("X-Forge-Dispatch-Signature"), timeout),
               ("https://fixture.invalid/api/v1/db/forge-pregame-capture-v2", {"dispatchId": step}, signature, 240000))
        expect("committed duplicate tick emits no second capture", (tick(owner), counts(owner)), ("awaiting_capture", (2, 1, 0)))
        capture_begin(owner, step)
        game_date, scheduled_start = row(owner, 'select date,"startTime" from public.games where id=%s', [GAME])
        with connect("service_role") as service:
            refused("legacy direct claim cannot consume a v2 slot", lambda: row(service, """
              select * from public.forge_pregame_capture_claim_v1(%s,'pregame-native-v1',%s,10::smallint,6::smallint,%s,%s,160000,%s)
            """, [GAME, game_date, CALENDAR, scheduled_start, SHA]), "P0001", "hosted_claim_refused")
        expect("legacy refusal leaves zero claims", counts(owner), (2, 1, 0))

        with connect("service_role") as service:
            row(service, "select public.forge_pregame_capture_record_outcome_v1(%s,'pregame-native-v1',null,'never_dispatched','{}')", [GAME])
        row(owner, "update forge_pregame_capture.hosted_games set stale_at=clock_timestamp()-interval '1 second' where game_id=%s", [GAME])
        expect("watch leaves committed null-claim custody for normal reconciliation",
               (watch(owner), row(owner, "select count(*) from public.cron_job_audit")[0]), ("capture", 0))
        expect("next tick mirrors null-claim refusal without quarantine or recapture",
               (tick(owner), watch(owner), counts(owner)), ("skipped", "skipped", (2, 1, 0)))
        audit(owner, "skipped", "never_dispatched")


def connected_capture(connect):
    with connect() as owner:
        arm(owner)
        ready(owner)
        expect("connected v2 capture queued", tick(owner), "capture")
        body, headers = row(owner, "select body,headers from net.test_requests order by id desc limit 1")
        socket_dir = owner.get_dsn_parameters()["host"]
    subprocess.run(["npm", "test", "--", "--run", "__tests__/pages/api/v1/db/forge-pregame-capture.test.ts",
                    "-t", "disposable PostgreSQL"], cwd=MIGRATIONS.parents[1] / "web", check=True, env={
                        **os.environ, "FORGE_TEST_HOSTED_V2": "1", "FORGE_TEST_PG_SOCKET": socket_dir,
                        "FORGE_TEST_SIGNER": SECRET, "FORGE_TEST_SHA": SHA,
                        "FORGE_TEST_REQUEST": json.dumps([body, headers])})
    with connect() as observer:
        expect("qualified capture handoff advances once without a new request", (tick(observer), tick(observer), counts(observer)),
               ("verify", "awaiting_witness", (2, 1, 1)))


def main():
    with publication_db() as connect:
        with connect() as conn:
            setup(conn)
        release_fence_cases(connect)
        permissions(connect)
        admission_cases(connect)
        monitoring_and_transport(connect)
        # Run the two committed scenarios in distinct databases so the real one-active-run constraint holds.
        overlap(connect)
    with publication_db() as connect:
        with connect() as conn:
            setup(conn)
        publication_loss_cases(connect)
    if "--with-route" in sys.argv:
        with publication_db() as connect:
            with connect() as conn:
                setup(conn)
            connected_capture(connect)


if __name__ == "__main__":
    main()

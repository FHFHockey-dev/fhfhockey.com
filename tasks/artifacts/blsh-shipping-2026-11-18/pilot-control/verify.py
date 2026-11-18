#!/usr/bin/env python3
"""Disposable PostgreSQL 15 proof. No TCP listener or inherited database configuration."""
from datetime import datetime
from hashlib import sha256
from pathlib import Path
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
BASE = ROOT / "supabase/migrations/20261116000000_blsh_native_capture_v6.sql"
PINS = {"release_sha": "a" * 40, "deployment_id": "dpl_ReviewedFixture"}
OFF = "2026-11-21 12:04:59.999999+00"
OPEN = "2026-11-21 12:05:00+00"
END = "2026-11-21 12:07:00+00"
ENABLED = "select public.blsh_capture_enabled_v1()"
CLAIMS = "select count(*) from public.blsh_capture_runs"


def exercise(root, env):
    def sql(statement, *, at=OFF, role="postgres", pins=PINS, error=None):
        # The only caller-supplied clock is in the test cluster's private schema.
        datetime.fromisoformat(at)
        cli = [PG / "psql", "-XAtq", "-h", root, "-U", role, "-d", "postgres", "-v", "ON_ERROR_STOP=1"]
        for name, value in pins.items():
            cli += ["-v", name + "=" + value]
        result = subprocess.run(cli, input=f"set fixture.at = '{at}';\n" + statement, env=env,
                                text=True, capture_output=True, timeout=15)
        if error:
            assert result.returncode and error in result.stderr, (error, result.stdout, result.stderr)
        else:
            assert result.returncode == 0, result.stderr
        return result.stdout.strip()

    def artifact(name):
        body = (HERE / (name + ".sql")).read_text()
        assert "fixture." not in body and "current_setting" not in body
        return body.replace("pg_catalog.clock_timestamp()", "fixture.wall_clock()")

    def claim(*, at=OPEN, day="2026-11-20", deployment=None, pipeline="native-v6", error=None):
        deployment = deployment if deployment is not None else '{"deploymentId":"dpl_ReviewedFixture","gitCommitSha":"' + PINS["release_sha"] + '"}'
        return sql(f"select public.blsh_capture_claim_v1('{pipeline}', '{day}', '{deployment}') ->> 'claimed';",
                   role="service_role", at=at, error=error)

    base = BASE.read_bytes()
    assert sha256(base).hexdigest() == "4e896a891d02543a5a500597c7ce97d745e6a724d1c5100de1a7a2e8c9250c70"
    sql("""
        create role anon; create role authenticated; create role service_role bypassrls login;
        create schema storage;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(bucket_id text,name text,metadata jsonb);
        create schema fixture;
        create function fixture.wall_clock() returns timestamptz language sql volatile as
          $$select current_setting('fixture.at')::timestamptz$$;
    """)
    sql(base.decode())
    baseline = sql("select pg_get_functiondef('public.blsh_capture_enabled_v1()'::regprocedure)")
    install, arm, retire = (artifact(name) for name in ("INSTALL", "ARM", "DISARM-ROLLBACK"))
    # Verify baseline-definition drift is refused before installation; restore it on this disposable database.
    sql("alter function public.blsh_capture_enabled_v1() volatile")
    sql(install, error="pilot_migration_153_definition_mismatch")
    sql(baseline)
    # Also compile the unchanged production installer and rollback against the real database clock.
    if sql("select clock_timestamp() < timestamptz '2026-11-21 12:05:00+00'") == "t":
        sql((HERE / "INSTALL.sql").read_text())
        assert sql(ENABLED, role="service_role") == "f"
        sql((HERE / "DISARM-ROLLBACK.sql").read_text())
    else:
        sql((HERE / "INSTALL.sql").read_text(), error="pilot_install_after_primary_start")
    sql("update public.blsh_capture_control set enabled = true")
    sql(install, error="pilot_install_requires_switch_off")
    sql("update public.blsh_capture_control set enabled = false")
    sql("insert into public.blsh_capture_runs(pipeline,source_date) values ('native-v6','2026-11-20')")
    sql(install, error="pilot_date_already_consumed")
    sql("truncate public.blsh_capture_objects, public.blsh_capture_runs")
    sql(install, pins={**PINS, "release_sha": "bad"}, error="check constraint")
    sql(install, pins={**PINS, "deployment_id": "invalid"}, error="check constraint")
    sql(install, at=OPEN, error="pilot_install_after_primary_start")
    sql(install)
    assert sql(ENABLED, at=OPEN, role="service_role") == "f"
    claim(error="BLSH capture is disabled")
    sql(arm, pins={**PINS, "deployment_id": "dpl_Wrong"}, error="pilot_arm_pins_or_time_mismatch")
    sql(arm, at=OPEN, error="pilot_arm_pins_or_time_mismatch")
    assert sql("select enabled from public.blsh_capture_control") == "f"
    sql(arm)
    sql(arm, error="pilot_not_armable")
    sql("update public.blsh_pilot_20261121 set deployment_id = 'dpl_Other'", role="service_role", error="permission denied")
    for at in (OFF, END, "2026-11-21 12:20:00+00", "2026-11-22 12:05:00+00"):
        assert sql(ENABLED, at=at, role="service_role") == "f"
        claim(at=at, error="BLSH capture is disabled")
    assert sql(ENABLED, at="2026-11-21 12:06:59.999999+00", role="service_role") == "t"
    claim(day="2026-11-21", error="pilot_claim_outside_permit")
    claim(pipeline="other", error="check constraint")
    for deployment in ('{}', '{"deploymentId":"dpl_Other","gitCommitSha":"' + PINS["release_sha"] + '"}',
                       '{"deploymentId":"dpl_ReviewedFixture","gitCommitSha":"' + 'b' * 40 + '"}'):
        claim(deployment=deployment, error="pilot_claim_outside_permit")
    assert sql(CLAIMS) == "0"
    # Simulate time advancing between the original claim RPC precheck and our insert trigger.
    sql("""create sequence fixture.tick;
        create or replace function fixture.wall_clock() returns timestamptz language sql volatile as $$
          select case when nextval('fixture.tick') = 1 then timestamptz '2026-11-21 12:06:59.999999+00'
                      else timestamptz '2026-11-21 12:07:00+00' end$$;""")
    claim(error="pilot_claim_outside_permit")
    assert sql(CLAIMS) == "0"
    sql("""create or replace function fixture.wall_clock() returns timestamptz language sql volatile as
             $$select current_setting('fixture.at')::timestamptz$$;""")
    assert claim() == "true"
    assert claim(at="2026-11-21 12:06:59.999999+00") == "false"
    assert sql(CLAIMS) == "1"
    assert sql("select enabled from public.blsh_capture_control") == "t"
    assert sql(ENABLED, at=END, role="service_role") == "f"
    sql(retire, at=OPEN)
    assert sql(CLAIMS) == "1"
    assert sql("select pg_get_functiondef('public.blsh_capture_enabled_v1()'::regprocedure)") == baseline
    assert sql("select enabled from public.blsh_capture_control") == "f"
    assert sql(ENABLED, at=OPEN, role="service_role") == "f"
    claim(error="BLSH capture is disabled")
    sql(arm, error="pilot_not_armable")
    print("PASS guarded installation and arming, immutable client pins, DB expiry and backup, exact claim identity, "
          "in-flight expiry, unique primary, rollback with original function and switch off")


def main():
    with tempfile.TemporaryDirectory(prefix="blsh-primary-", dir="/tmp") as root:
        data = Path(root) / "data"
        env = {"PATH": str(PG) + ":/usr/bin:/bin", "LC_ALL": "C", "HOME": root}
        def pg(*args):
            return subprocess.run(args, env=env, check=True, capture_output=True, timeout=45)
        pg(PG / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "--no-sync")
        pg(PG / "pg_ctl", "-D", data, "-l", Path(root) / "log", "-o", f"-k {root} -c listen_addresses=''", "-w", "start")
        try:
            exercise(root, env)
        finally:
            pg(PG / "pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")


if __name__ == "__main__":
    main()

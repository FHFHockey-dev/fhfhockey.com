#!/usr/bin/env python3
"""Run only synthetic, local PostgreSQL fixtures; preserve cluster and logs."""
import json
import hashlib
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import time

BIN = Path("/opt/homebrew/opt/postgresql@15/bin")
HERE = Path(__file__).resolve().parent
LOCK = Path("/private/tmp/fhfh-heavy.lock")
ENV = {"PATH": "/opt/homebrew/bin:/usr/bin:/bin", "LANG": "C", "LC_ALL": "C"}
REPO = HERE.parents[3]
SOURCE_PINS = {
    REPO / "supabase/migrations/20261026200000_rso_yahoo_past_lineups.sql":
        "bec40282d7b923960d859160ebf079c848d19a8ab860968361ef936b650c1603",
    REPO / "supabase/migrations/20261027090000_forge_reserve_projections.sql":
        "1ca5816e835da899833499cc95d345a9253227ea176898c1ca2ba382fdd55da8",
}


def check_pins():
    for path, expected in SOURCE_PINS.items():
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            raise RuntimeError(f"source pin changed: {path}; observed {actual}")


def run(args, label, cwd=None):
    result = subprocess.run(
        [str(x) for x in args], cwd=cwd, env=ENV, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60,
    )
    print(f"{label}: exit {result.returncode}", flush=True)
    lines = result.stdout.strip().splitlines()
    if lines:
        print("\n".join(lines[-12:]), flush=True)
    if result.returncode:
        raise RuntimeError(f"{label} failed")


def main():
    try:
        fd = os.open(LOCK, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        print("BLOCKED: shared heavy lock is already held; no test started", flush=True)
        return 75
    identity = os.fstat(fd)
    owner = {"owner": "codex-supabase-access-audit", "pid": os.getpid(),
             "created_unix": time.time(), "scope": "one isolated PostgreSQL fixture run"}
    os.write(fd, (json.dumps(owner) + "\n").encode())
    os.close(fd)
    launch_attempted = False
    data = None
    stop_failed = False
    try:
        work = Path(tempfile.mkdtemp(prefix="fhfh-supabase-acl-audit-", dir="/tmp"))
        data = work / "data"
        socket = work / "socket"
        socket.mkdir(mode=0o700)
        print(f"Disposable cluster and logs retained at {work}", flush=True)
        check_pins()
        run([BIN / "initdb", "-D", data, "-U", "postgres", "-A", "trust",
             "--encoding=UTF8", "--locale=C", "--no-sync"], "initdb")
        opts = f"-k {shlex.quote(str(socket))} -p 55439 -c listen_addresses='' -F"
        launch_attempted = True
        run([BIN / "pg_ctl", "-D", data, "-l", work / "server.log",
             "-o", opts, "-w", "start"], "start isolated PostgreSQL")
        psql = [BIN / "psql", "-X", "-h", socket, "-p", "55439",
                "-U", "postgres", "-v", "ON_ERROR_STOP=1"]
        run(psql + ["-d", "postgres", "-f", HERE / "legacy-fixture.test.sql"],
            "legacy tables, function and rollback")
        for db in ("future_legacy", "future_optin"):
            run(psql + ["-d", "postgres", "-c", f"CREATE DATABASE {db}"], f"create {db}")
        for db, setting in (("future_legacy", "true"), ("future_optin", "false")):
            run(psql + ["-d", db, "-v", f"legacy_defaults={setting}",
                        "-f", HERE / "future-fixture.test.sql"], f"future grants: {db}")
        check_pins()
        print("PASS: all isolated fixture phases", flush=True)
    finally:
        if launch_attempted:
            try:
                status = subprocess.run([str(BIN / "pg_ctl"), "-D", str(data), "status"],
                    env=ENV, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=10)
                if status.returncode == 0:
                    run([BIN / "pg_ctl", "-D", data, "-m", "fast", "-w", "stop"],
                        "stop isolated PostgreSQL")
                elif status.returncode != 3:
                    raise RuntimeError(f"uncertain server status ({status.returncode}): {status.stdout.strip()}")
            except Exception as exc:
                stop_failed = True
                print(f"BLOCKED: could not stop owned cluster: {exc}", flush=True)
        try:
            current = os.stat(LOCK)
            if not stop_failed and (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino):
                os.unlink(LOCK)
                print("Released own shared heavy lock", flush=True)
            elif stop_failed:
                print("Retained own heavy lock because the test server may still be running", flush=True)
            else:
                print("WARNING: lock identity changed; did not touch it", flush=True)
        except FileNotFoundError:
            print("WARNING: owned lock disappeared; did not alter a replacement", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"BLOCKED: {exc}", flush=True)
        sys.exit(1)

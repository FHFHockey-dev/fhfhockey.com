#!/usr/bin/env python3
"""Read-only, bounded production SQL for the FORGE projection audit (2026-11-16).

Usage:  python3 -I ro_sql.py [file.sql]        SQL from the file, or from stdin
        RO_SQL_CSV=1 for CSV output; RO_SQL_TIMEOUT_S=1..10 (default 5)

Every call runs inside BEGIN TRANSACTION READ ONLY with statement_timeout (default 5 s, at most 10 s),
lock_timeout 1 s, and ends with ROLLBACK. Each statement must start with SELECT, WITH, EXPLAIN, SHOW, TABLE or VALUES.
Refused: transaction control, SET, DML and DDL words, dollar quotes, psql meta-commands and side-effecting functions.
Limits: at most 10 statements per call, RO_SQL_CAP (default 150) statements in all, calls serialized, none at or
after 2026-11-16 21:00Z (FORGE capture prep). Each call is logged (UTC, statements, exit, ms, first 300 characters).
Credentials come from pgpool.sh, which never prints them.
"""
import datetime
import fcntl
import os
import re
import subprocess
import sys
import tempfile
import time

ROOT = "/Users/tim/Code/fhfhockey.com"
PGPOOL = f"{ROOT}/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh"
HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "ro-sql-log.txt")
COUNT = os.path.join(HERE, ".ro-sql-count")
LOCK = os.path.join(HERE, ".ro-sql-lock")
STOP = datetime.datetime(2026, 11, 16, 21, 0, tzinfo=datetime.timezone.utc)
CAP = int(os.environ.get("RO_SQL_CAP", "150"))
TIMEOUT_S = min(10, max(1, int(os.environ.get("RO_SQL_TIMEOUT_S", "5"))))
MAX_LINES = 4000
ALLOWED_FIRST = {"select", "with", "explain", "show", "table", "values"}
BLOCKED_WORDS = re.compile(
    r"\b(insert|update|delete|merge|truncate|copy|lock|into|nextval|setval|set_config|pg_terminate_backend|"
    r"pg_cancel_backend|pg_reload_conf|pg_notify|pg_sleep\w*|pg_advisory\w*|dblink\w*|pg_read_file|"
    r"pg_read_binary_file|pg_ls_dir|lo_\w+|txid_current|http\w*|net|pg_stat\w*reset\w*)\b",
    re.I,
)


def refuse(msg: str) -> None:
    print(f"REFUSED: {msg}", file=sys.stderr)
    sys.exit(9)


def strip(sql: str) -> str:
    if re.search(r"\$\w*\$", sql):
        refuse("dollar-quoted strings are not allowed")
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"'(?:[^']|'')*'", "'s'", sql)
    sql = re.sub(r'"(?:[^"]|"")*"', "ident", sql)
    return sql


def main() -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    if now >= STOP:
        refuse("audit reads stop at 2026-11-16 21:00Z")
    sql = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
    bare = strip(sql)
    if "\\" in bare:
        refuse("psql meta-commands (backslashes outside string literals) are not allowed")
    if "'" in bare.replace("'s'", ""):
        refuse("unbalanced quote")
    statements = [s.strip() for s in bare.split(";") if s.strip()]
    if not statements:
        refuse("no statement")
    if len(statements) > 10:
        refuse("at most 10 statements per call")
    for s in statements:
        first = re.match(r"\(?\s*(\w+)", s)
        if not first or first.group(1).lower() not in ALLOWED_FIRST:
            refuse(f"statement must start with {sorted(ALLOWED_FIRST)}: {s[:80]!r}")
        hit = BLOCKED_WORDS.search(s)
        if hit:
            refuse(f"blocked word {hit.group(0)!r} in: {s[:80]!r}")
    with open(LOCK, "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        used = int(open(COUNT).read().strip() or 0) if os.path.exists(COUNT) else 0
        if used + len(statements) > CAP:
            refuse(f"statement cap reached ({used} used of {CAP})")
        with open(COUNT, "w") as f:
            f.write(str(used + len(statements)))
        script = (
            "\\set ON_ERROR_STOP on\n\\set QUIET on\n"
            "begin transaction read only;\n"
            f"set local statement_timeout = '{TIMEOUT_S}s';\n"
            "set local lock_timeout = '1s';\n"
            "set local idle_in_transaction_session_timeout = '30s';\n"
            "\\set QUIET off\n"
            f"{sql}\n;\nrollback;\n"
        )
        with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as tf:
            tf.write(script)
            path = tf.name
        args = ["perl", "-e", "alarm shift; exec @ARGV", "90", "zsh", PGPOOL, "-P", "pager=off", "-f", path]
        if os.environ.get("RO_SQL_CSV") == "1":
            args.insert(-2, "--csv")
        t0 = time.monotonic()
        proc = subprocess.run(args, capture_output=True, text=True)
        ms = int((time.monotonic() - t0) * 1000)
        os.unlink(path)
        lines = proc.stdout.splitlines()
        lines = [l for l in lines if l not in ("BEGIN", "ROLLBACK", "SET")]
        print("\n".join(lines[:MAX_LINES]))
        if len(lines) > MAX_LINES:
            print(f"... truncated: {len(lines) - MAX_LINES} more lines")
        if proc.stderr.strip():
            print(proc.stderr.strip()[-2000:], file=sys.stderr)
        one_line = " ".join(sql.split())[:300]
        with open(LOG, "a") as f:
            f.write(f"{now:%Y-%m-%dT%H:%M:%SZ} | n={len(statements)} | exit={proc.returncode} | {ms}ms | {one_line}\n")
        sys.exit(proc.returncode)


if __name__ == "__main__":
    main()

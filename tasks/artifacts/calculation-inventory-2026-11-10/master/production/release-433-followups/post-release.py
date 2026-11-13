#!/usr/bin/env python3
"""Release #433 follow-ups (TJ approved "Run them after release", 2026-11-13).
Sequential, concurrency 1, DB guard before each call, stop on any error. Never prints secrets.
1. update-games (2026-27, season-wide): 32 NHL club-schedule GETs; fills games.game_state (F4).
2. CTPI v2 backfill 2026-09-29 -> 2026-11-13 in two chunks of <= 31 dates (F1; no provider calls).
3. update-team-sos once: 32 NHL club-schedule GETs; first descriptive-sos-v2 snapshot (F2)."""
import json, os, subprocess, sys, time, urllib.request, urllib.error

ROOT = "/Users/tim/Code/fhfhockey.com"
OUT = os.path.join(os.environ["TMPDIR"], "release-433")
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "run.jsonl"), "a")
PGPOOL = os.path.join(os.environ["TMPDIR"], "pgpool.sh")
BASE = "https://fhfhockey.com"
STEPS = [
    ("update-games", "/api/v1/db/update-games"),
    ("ctpi-v2-chunk-1", "/api/v1/db/update-team-ctpi-daily?start=2026-09-29&end=2026-10-29"),
    ("ctpi-v2-chunk-2", "/api/v1/db/update-team-ctpi-daily?start=2026-10-30&end=2026-11-13"),
    ("update-team-sos", "/api/v1/db/update-team-sos"),
]

secret = None
for line in open(os.path.join(ROOT, "web/.env.local")):
    if line.startswith("CRON_SECRET="):
        secret = line.split("=", 1)[1].strip().strip('"')
assert secret


def log(**kw):
    kw["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    s = json.dumps(kw)
    LOG.write(s + "\n"); LOG.flush(); print(s, flush=True)


def guard():
    env = dict(os.environ, PGOPTIONS="-c statement_timeout=8000 -c default_transaction_read_only=on")
    for _ in range(12):
        r = subprocess.run([PGPOOL, "-At", "-c",
                            "select count(*) filter (where state='active' and pid<>pg_backend_pid())||'|'||"
                            "coalesce(max(extract(epoch from now()-query_start)) filter (where state='active' and pid<>pg_backend_pid()),0)::int "
                            "from pg_stat_activity where datname='postgres'"],
                           capture_output=True, text=True, env=env, timeout=60)
        active, longest = (int(x) for x in r.stdout.strip().split("|"))
        if active <= 5 and longest <= 10:
            return
        log(event="guard_wait", active=active, longest=longest)
        time.sleep(20)
    log(event="STOP", reason="guard did not clear")
    sys.exit(3)


for name, path in STEPS:
    guard()
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {secret}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            status, body = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:
        log(event="STOP", step=name, reason="uncertain outcome: " + repr(e)[:200])
        sys.exit(2)
    try:
        j = json.loads(body)
    except Exception:
        j = {"raw": body[:300].decode("utf-8", "replace")}
    keep = {k: j.get(k) for k in ("success", "message", "error", "rows", "rowsUpserted", "updated", "inserted",
                                   "dates", "datesProcessed", "warnings", "sosVersion", "ctpiVersion", "count",
                                   "gamesUpserted", "stateCounts") if k in j}
    log(event="call", step=name, status=status, duration_s=round(time.time() - t0, 1), **keep,
        keys=sorted(j.keys())[:30])
    if status != 200 or j.get("success") is False:
        log(event="STOP", step=name, reason="non-200 or success:false; inspect before any retry")
        sys.exit(4)
    time.sleep(20)
log(event="DONE")

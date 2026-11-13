#!/usr/bin/env python3
"""2026-27 rolling recompute (TJ-approved 2026-11-13, bypassFreshnessBlockers=true).
Sequential calls of 20 players, resume cursor, DB guards, stop rules. Never prints secrets."""
import json, os, subprocess, sys, time, urllib.request, urllib.error

ROOT = "/Users/tim/Code/fhfhockey.com"
OUT = os.path.join(os.environ["TMPDIR"], "rolling-2627")
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "run.jsonl"), "a")
PGPOOL = os.path.join(os.environ["TMPDIR"], "pgpool.sh")
BASE = "https://fhfhockey.com/api/v1/db/update-rolling-player-averages"
FIXED = "startDate=2026-09-29&endDate=2026-11-11&maxPlayers=8&maxRuntimeMs=200000&bypassFreshnessBlockers=true"

secret = None
for line in open(os.path.join(ROOT, "web/.env.local")):
    if line.startswith("CRON_SECRET="):
        secret = line.split("=", 1)[1].strip().strip('"')
assert secret


def log(**kw):
    kw["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    s = json.dumps(kw)
    LOG.write(s + "\n"); LOG.flush(); print(s, flush=True)


def psql(sql):
    env = dict(os.environ, PGOPTIONS="-c statement_timeout=8000 -c default_transaction_read_only=on")
    r = subprocess.run([PGPOOL, "-At", "-c", sql], capture_output=True, text=True, env=env, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:300])
    return [x for x in r.stdout.strip().split("\n") if x]


def guard():
    for attempt in range(12):
        t0 = time.time()
        row = psql("select count(*) filter (where state='active' and pid<>pg_backend_pid()), "
                   "coalesce(max(extract(epoch from now()-query_start)) filter (where state='active' and pid<>pg_backend_pid()),0)::int, "
                   "count(*) filter (where wait_event_type in ('Lock','IO') and state='active' and pid<>pg_backend_pid()) "
                   "from pg_stat_activity where datname='postgres'")[0]
        probe = time.time() - t0
        active, longest, waits = (int(x) for x in row.split("|"))
        ok = active <= 5 and longest <= 10 and waits == 0 and probe < 1.5
        if ok:
            return
        log(event="guard_wait", active=active, longest=longest, waits=waits, probe_s=round(probe, 2))
        time.sleep(20)
    log(event="STOP", reason="guard did not clear in 4 minutes")
    sys.exit(3)


def call(resume):
    url = BASE + "?" + FIXED + (f"&resumeFrom={resume}" if resume else "")
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {secret}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=260) as resp:
            status, body = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:  # timeout or network: outcome uncertain
        return None, time.time() - t0, {"error": repr(e)[:300]}
    dur = time.time() - t0
    try:
        j = json.loads(body)
    except Exception:
        j = {"raw": body[:300].decode("utf-8", "replace")}
    return status, dur, j


resume = int(sys.argv[1]) if len(sys.argv) > 1 else None
slow_streak = 0
calls = 0
total_rows = 0
blockers = 0
while True:
    hour = time.gmtime().tm_hour
    minute = time.gmtime().tm_min
    if (hour == 9 and minute >= 25) or hour == 10 or (hour == 8 and minute < 20):
        log(event="STOP", reason="entering a cron window", resume=resume)
        sys.exit(4)
    guard()
    status, dur, j = call(resume)
    calls += 1
    rs = j.get("runSummary") or {}
    log(event="call", n=calls, resumeFrom=resume, status=status, duration_s=round(dur, 1),
        success=j.get("success"), operationStatus=j.get("operationStatus"),
        rowsUpserted=rs.get("rowsUpserted"), processedPlayers=rs.get("processedPlayers"),
        freshnessBlockers=rs.get("freshnessBlockers"), suspicious=rs.get("suspiciousOutputWarnings"),
        abandoned=rs.get("abandonedPlayerCount"), nextResumeFrom=rs.get("nextResumeFrom"),
        remaining=rs.get("remainingPlayerCount"), stoppedReason=rs.get("stoppedReason"),
        error=j.get("error") or j.get("message") if status not in (200, 207) else None)
    if status not in (200, 207) or not rs:
        log(event="STOP", reason="non-200/207 or uncertain outcome; reconcile before any retry", resume=resume)
        sys.exit(2)
    if (rs.get("abandonedPlayerCount") or 0) > 0:
        log(event="note", reason="abandoned players sit past nextResumeFrom; they will be retried by resume")
    total_rows += rs.get("rowsUpserted") or 0
    blockers += rs.get("freshnessBlockers") or 0
    if dur > 200:
        log(event="STOP", reason="call over 200 s", resume=rs.get("nextResumeFrom"))
        sys.exit(5)
    slow_streak = slow_streak + 1 if dur > 120 else 0
    if slow_streak >= 2:
        log(event="STOP", reason="two slow calls in a row", resume=rs.get("nextResumeFrom"))
        sys.exit(6)
    nxt = rs.get("nextResumeFrom")
    if nxt is None or rs.get("remainingPlayerCount") == 0:
        log(event="DONE", calls=calls, total_rows=total_rows, freshnessBlockers=blockers)
        break
    resume = nxt
    time.sleep(60)

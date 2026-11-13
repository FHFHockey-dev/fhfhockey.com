#!/usr/bin/env python3
"""2026-27 trend-band history rebuild (decision 36). TJ approved "Later, paced" on 2026-11-13.
history=true, season 20262027, 2026-09-29 -> 2026-11-12, game_limit=160, 10 players per call by offset,
60 s gaps, DB guard before each call. Waits until 11:41Z (after the 11:18-11:33Z band crons) and pauses
11:58-12:08Z for job 392 (player-trend v3 first run). Never prints secrets."""
import calendar, json, os, subprocess, sys, time, urllib.request, urllib.error

ROOT = "/Users/tim/Code/fhfhockey.com"
OUT = os.path.join(os.environ["TMPDIR"], "trend-bands-2627")
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "run.jsonl"), "a")
PGPOOL = os.path.join(os.environ["TMPDIR"], "pgpool.sh")
BASE = "https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands"
FIXED = "history=true&season_id=20262027&start_date=2026-09-29&end_date=2026-11-12&game_limit=160&limit=10&dry=false"
TOTAL_PLAYERS = 769  # player_totals_unified, season 20262027, read 11:05Z
START_AT = "2026-11-13T11:41:00"
PAUSE = ("2026-11-13T11:58:00", "2026-11-13T12:08:00")
SLOW_S = 60

secret = None
for line in open(os.path.join(ROOT, "web/.env.local")):
    if line.startswith("CRON_SECRET="):
        secret = line.split("=", 1)[1].strip().strip('"')
assert secret


def ts(s):
    return calendar.timegm(time.strptime(s, "%Y-%m-%dT%H:%M:%S"))


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
    for _ in range(12):
        t0 = time.time()
        row = psql("select count(*) filter (where state='active' and pid<>pg_backend_pid()), "
                   "coalesce(max(extract(epoch from now()-query_start)) filter (where state='active' and pid<>pg_backend_pid()),0)::int, "
                   "count(*) filter (where wait_event_type in ('Lock','IO') and state='active' and pid<>pg_backend_pid()) "
                   "from pg_stat_activity where datname='postgres'")[0]
        probe = time.time() - t0
        active, longest, waits = (int(x) for x in row.split("|"))
        if active <= 5 and longest <= 10 and waits == 0 and probe < 1.5:
            return
        log(event="guard_wait", active=active, longest=longest, waits=waits, probe_s=round(probe, 2))
        time.sleep(20)
    log(event="STOP", reason="guard did not clear in 4 minutes")
    sys.exit(3)


def call(offset):
    req = urllib.request.Request(f"{BASE}?{FIXED}&offset={offset}", headers={"Authorization": f"Bearer {secret}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=280) as resp:
            status, body = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:  # timeout or network: outcome uncertain
        return None, time.time() - t0, {"error": repr(e)[:300]}
    try:
        j = json.loads(body)
    except Exception:
        j = {"raw": body[:300].decode("utf-8", "replace")}
    return status, time.time() - t0, j


offset = int(sys.argv[1]) if len(sys.argv) > 1 else 0
wait = ts(START_AT) - time.time()
if wait > 0:
    log(event="waiting", until=START_AT, seconds=int(wait))
    time.sleep(wait)
calls = players = bands = 0
while offset < TOTAL_PLAYERS:
    now = time.time()
    if ts(PAUSE[0]) <= now < ts(PAUSE[1]):
        log(event="pause", until=PAUSE[1], offset=offset)
        time.sleep(ts(PAUSE[1]) - now)
    guard()
    status, dur, j = call(offset)
    calls += 1
    errs = j.get("errors") or []
    log(event="call", n=calls, offset=offset, status=status, duration_s=round(dur, 1), success=j.get("success"),
        processed=j.get("processed"), updated_bands=j.get("updated_bands"), snapshots=j.get("snapshots_processed"),
        errors=errs[:3], error=(j.get("error") or j.get("message")) if status != 200 else None)
    if status != 200 or j.get("success") is not True or j.get("dry_run") is not False:
        log(event="STOP", reason="non-200, unsuccessful or not a live run; reconcile before any retry", offset=offset)
        sys.exit(2)
    if errs:
        log(event="STOP", reason="per-player errors; reconcile before any retry", offset=offset)
        sys.exit(4)
    players += j.get("processed") or 0
    bands += j.get("updated_bands") or 0
    if dur > SLOW_S:
        log(event="STOP", reason=f"slow call over {SLOW_S} s", next_offset=offset + 10)
        sys.exit(5)
    if not j.get("processed"):
        break
    offset += 10
    if offset < TOTAL_PLAYERS:
        time.sleep(60)
log(event="DONE", calls=calls, players=players, updated_bands=bands)

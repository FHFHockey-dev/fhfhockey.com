#!/usr/bin/env python3
"""Team power ratings v4 rebuild (decision 145, 5-on-5 goaltending). NOT YET APPROVED.

Run only after TJ approves PLAN.md and the release containing F9 is live on fhfhockey.com.
One date per call, ascending, sequential. Resumable. Read-only DB guard before every call.
Never prints secrets.

Usage (from any directory):
  python3 -I power-g5v5-loop.py --preflight          # guard + v3 backup + resume point; no route calls
  python3 -I power-g5v5-loop.py                      # 2026-09-29 .. 2026-11-12 (45 calls)
  python3 -I power-g5v5-loop.py --end 2026-11-13     # also call 46 (the 11-13 row cron 283 wrote as v3)
Exit codes: 0 done, 2 HTTP/body failure or uncertain outcome, 3 DB guard, 4 cron window,
            5 slow call, 6 readback mismatch, 7 deployed code is not v4.
"""
import argparse, json, os, subprocess, sys, time, urllib.error, urllib.request

ROOT = "/Users/tim/Code/fhfhockey.com"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "run")
PGPOOL = os.path.join(os.environ["TMPDIR"], "pgpool.sh")
BASE = "https://fhfhockey.com/api/v1/db/update-team-power-ratings"
V4 = "team-power-v4-5v5-goaltending"
TEAMS_PER_DATE = 32
PAUSE_S = 5
SLOW_S = 60
# Local read-only sample (PLAN.md): expected v4 goalie_rating for 2026-11-12.
EXPECTED_1112 = {"ANA": 106.00, "BOS": 122.50, "BUF": 91.50, "CAR": 105.62, "CBJ": 110.59, "CGY": 93.84,
    "CHI": 75.37, "COL": 97.63, "DAL": 77.07, "DET": 91.75, "EDM": 121.24, "FLA": 74.60, "LAK": 108.64,
    "MIN": 130.17, "MTL": 126.18, "NJD": 99.32, "NSH": 107.83, "NYI": 109.23, "NYR": 103.32, "OTT": 110.87,
    "PHI": 99.21, "PIT": 77.72, "SEA": 101.12, "SJS": 117.86, "STL": 102.65, "TBL": 97.16, "TOR": 78.02,
    "UTA": 86.80, "VAN": 84.10, "VGK": 107.79, "WPG": 90.98, "WSH": 93.31}
UNCHANGED_COLS = ["off_rating", "def_rating", "pace_rating", "xgf60", "gf60", "sf60", "xga60", "ga60", "sa60",
                  "pace60", "finishing_rating", "danger_rating", "special_rating", "discipline_rating", "variance_flag",
                  "trend10", "pp_tier", "pk_tier"]

ap = argparse.ArgumentParser()
ap.add_argument("--start", default="2026-09-29")
ap.add_argument("--end", default="2026-11-12")
ap.add_argument("--preflight", action="store_true")
args = ap.parse_args()
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "run.jsonl"), "a")

secret = None
for line in open(os.path.join(ROOT, "web/.env.local")):
    if line.startswith("CRON_SECRET="):
        secret = line.split("=", 1)[1].strip().strip('"')
if not secret:
    sys.exit("CRON_SECRET missing from web/.env.local")


def log(**kw):
    kw["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    s = json.dumps(kw)
    LOG.write(s + "\n"); LOG.flush(); print(s, flush=True)


def stop(code, reason, **kw):
    log(event="STOP", code=code, reason=reason, **kw)
    sys.exit(code)


def psql(sql, *extra):
    env = dict(os.environ, ROOT=ROOT,
               PGOPTIONS="-c statement_timeout=8000 -c default_transaction_read_only=on")
    r = subprocess.run([PGPOOL, "-At", *extra, "-c", sql], capture_output=True, text=True, env=env, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:300])
    return [x for x in r.stdout.split("\n") if x]


def in_cron_window():
    t = time.gmtime(); m = t.tm_hour * 60 + t.tm_min
    # 08:00-08:20, 09:25-11:00 (includes pg_cron 283 at 10:15), 11:15-11:40 UTC
    return 480 <= m < 500 or 565 <= m < 660 or 675 <= m < 700


def guard():
    for _ in range(3):
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
        time.sleep(60)
    stop(3, "DB guard did not clear after 3 checks (3 min)")


def readback(d):
    total, v4, goalie = psql(
        f"select count(*), count(*) filter (where calculation_version='{V4}'), "
        f"count(*) filter (where calculation_version='{V4}' and goalie_rating is not null) "
        f"from team_power_ratings_daily where date='{d}'")[0].split("|")
    return int(total), int(v4), int(goalie)


def call(d):
    req = urllib.request.Request(f"{BASE}?date={d}", headers={"Authorization": f"Bearer {secret}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            status, body = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:  # timeout or network: outcome uncertain
        return None, time.time() - t0, {"error": repr(e)[:200]}
    try:
        j = json.loads(body)
    except Exception:
        j = {"raw": body[:200].decode("utf-8", "replace")}
    return status, time.time() - t0, j


# 1. Pre-checks and one-time backup of the issued rows (rule 21: they become history).
if in_cron_window():
    stop(4, "inside a cron window; start outside 08:00-08:20, 09:25-11:00, 11:15-11:40 UTC")
guard()
backup = os.path.join(OUT, f"issued-rows-{args.start}_{args.end}.tsv")
if not os.path.exists(backup):
    lines = psql(f"select * from team_power_ratings_daily where date between '{args.start}' and '{args.end}' "
                 f"order by date, team_abbreviation", "-F", "\t", "-P", "tuples_only=off", "-P", "footer=off")
    open(backup, "w").write("\n".join(lines) + "\n")
    log(event="backup", file=os.path.relpath(backup, HERE), rows=len(lines) - 1)
versions = psql(f"select coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
                f"where date between '{args.start}' and '{args.end}' group by 1 order by 1")
log(event="versions_before", versions=versions)

todo = []
for line in psql(
        f"select d::date, count(t.team_abbreviation), "
        f"count(*) filter (where t.calculation_version='{V4}'), "
        f"count(*) filter (where t.calculation_version='{V4}' and t.goalie_rating is not null) "
        f"from generate_series('{args.start}'::date, '{args.end}'::date, interval '1 day') d "
        f"left join team_power_ratings_daily t on t.date = d::date group by 1 order by 1"):
    d, total, v4, goalie = line.split("|")
    if (int(total), int(v4), int(goalie)) != (TEAMS_PER_DATE,) * 3:
        todo.append(d)
log(event="plan", first=todo[0] if todo else None, calls=len(todo), dates=todo)
if args.preflight:
    log(event="PREFLIGHT_ONLY", calls=0)
    sys.exit(0)
if not todo:
    log(event="nothing_to_call", reason="every date already has 32 v4 rows; running final verification")

# 2. One date per call, ascending.
for n, d in enumerate(todo, 1):
    if in_cron_window():
        stop(4, "entering a cron window", resume_from=d)
    guard()
    status, dur, j = call(d)
    log(event="call", n=n, date=d, status=status, duration_s=round(dur, 1),
        calculationVersion=j.get("calculationVersion"), processedDays=j.get("processedDays"),
        totalUpserts=j.get("totalUpserts"), error=j.get("error") if status != 200 else None)
    if status != 200:
        stop(2, "non-200 or uncertain outcome; rerun the script to resume (upserts are idempotent)", resume_from=d)
    if j.get("calculationVersion") != V4:
        stop(7, "deployed route is not v4; this call rewrote the date with its existing definition (no change). "
                "Wait for the release, then rerun.", resume_from=d)
    if j.get("processedDays") != 1 or j.get("totalUpserts") != TEAMS_PER_DATE:
        stop(6, "unexpected processedDays/totalUpserts", resume_from=d)
    total, v4, goalie = readback(d)
    log(event="readback", date=d, rows=total, v4=v4, goalie_known=goalie)
    if (total, v4, goalie) != (TEAMS_PER_DATE,) * 3:
        stop(6, "readback mismatch (expected 32 rows, all v4, all goalie_rating known)", resume_from=d)
    if dur > SLOW_S:
        stop(5, f"call over {SLOW_S} s", resume_from=(todo[n] if n < len(todo) else None))
    time.sleep(PAUSE_S)

# 3. Final verification (read-only).
versions = psql(f"select coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
                f"where date between '{args.start}' and '{args.end}' group by 1 order by 1")
later = psql(f"select date, coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
             f"where date > '{args.end}' group by 1,2 order by 1")
cols = ",".join(["team_abbreviation", "date", "goalie_rating"] + UNCHANGED_COLS)
after = {}
for line in psql(f"select {cols} from team_power_ratings_daily where date between '{args.start}' and '{args.end}'"):
    p = line.split("|"); after[(p[0], p[1])] = p
with open(backup) as fh:
    header = fh.readline().rstrip("\n").split("\t")
    before = {}
    for line in fh:
        p = line.rstrip("\n").split("\t")
        if len(p) == len(header):
            r = dict(zip(header, p)); before[(r["team_abbreviation"], r["date"])] = r
changed = []
for key, p in after.items():
    b = before.get(key)
    if not b:
        continue
    for i, c in enumerate(UNCHANGED_COLS):
        x, y = p[3 + i], b.get(c, "")
        if (x == "") != (y == "") or (x and abs(float(x) - float(y)) > 1e-9):
            changed.append([key[0], key[1], c, y, x])
off_expected = [[t, round(float(after[(t, "2026-11-12")][2]), 2), e] for t, e in EXPECTED_1112.items()
                if (t, "2026-11-12") in after and abs(float(after[(t, "2026-11-12")][2]) - e) > 0.05]
log(event="final", versions_after=versions, later_dates=later,
    non_goalie_columns_changed=len(changed), changed_sample=changed[:10],
    goalie_1112_off_expected=off_expected)
log(event="DONE", calls=len(todo))

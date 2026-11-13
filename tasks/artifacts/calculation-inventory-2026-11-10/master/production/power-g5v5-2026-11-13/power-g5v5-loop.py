#!/usr/bin/env python3
"""Team power ratings v4 rebuild. NOT YET APPROVED.

v4 = (1) decision 145: goalie_rating is 5-on-5 goaltending (empty-net goals excluded);
     (2) season-total NST rows (gp != 1) no longer count as games, for every component.
Run only after TJ approves PLAN.md and the release containing F9 is live on fhfhockey.com.
One date per call, ascending, sequential. Resumable. Read-only DB guard before every call.
Never prints secrets.
Carry-forward (decision 150): a team with no genuine game in the lookback keeps its 2026-09-28
snapshot (legacy_unversioned, source 2026-08-29). Every readback proves those rows are exactly
that snapshot and never v4. See PREFLIGHT.md.

Usage (from any directory):
  python3 -I power-g5v5-loop.py --preflight          # guard + issued-row backup + plan; no route calls
  python3 -I power-g5v5-loop.py                      # 2026-09-29 .. 2026-11-12 (45 calls)
  python3 -I power-g5v5-loop.py --end 2026-11-13     # also call 46 (the 11-13 rows cron 283 wrote as v3)
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
V3 = "team-power-v3-all-team-baseline-prior-after-norm-pooled-st"
TEAMS_PER_DATE = 32   # the writer upserts every team: computed (v4) or carried from its last stored row
LOOKBACK_DAYS = 150   # TEAM_RATINGS_TREND_LOOKBACK_DAYS
LEGACY = "legacy_unversioned"
CARRY_FROM = "2026-09-28"     # the snapshot every carried row must equal (decision 150)
CARRY_SOURCE = "2026-08-29"
# Columns the writer copies from the previous stored row (trend10 too: a team with no genuine
# game has no trend override). pp_tier/pk_tier are recomputed per date, so not compared.
CARRY_COLS = ["off_rating", "def_rating", "pace_rating", "xgf60", "gf60", "sf60", "xga60", "ga60", "sa60",
              "pace60", "finishing_rating", "goalie_rating", "danger_rating", "special_rating",
              "discipline_rating", "variance_flag", "trend10"]
PAUSE_S = 5
SLOW_S = 60
# Local read-only sample (PLAN.md §3): expected v4 values for 2026-11-12.
EXPECTED_1112_GOALIE = {"ANA": 106.85, "BOS": 121.17, "BUF": 90.73, "CAR": 105.94, "CBJ": 111.14, "CGY": 93.78,
    "CHI": 75.38, "COL": 96.64, "DAL": 75.00, "DET": 91.89, "EDM": 122.10, "FLA": 75.56, "LAK": 108.35,
    "MIN": 129.23, "MTL": 125.91, "NJD": 99.98, "NSH": 108.69, "NYI": 108.06, "NYR": 103.21, "OTT": 111.94,
    "PHI": 99.40, "PIT": 77.42, "SEA": 99.63, "SJS": 118.23, "STL": 103.59, "TBL": 97.47, "TOR": 79.54,
    "UTA": 87.21, "VAN": 85.34, "VGK": 109.10, "WPG": 91.13, "WSH": 90.37}
EXPECTED_1112_OFF = {"ANA": 106.76, "BOS": 101.04, "BUF": 108.75, "CAR": 137.04, "CBJ": 82.85, "CGY": 88.57,
    "CHI": 70.76, "COL": 105.06, "DAL": 97.46, "DET": 94.93, "EDM": 90.53, "FLA": 117.20, "LAK": 107.79,
    "MIN": 122.50, "MTL": 107.18, "NJD": 125.55, "NSH": 100.10, "NYI": 86.91, "NYR": 106.16, "OTT": 105.55,
    "PHI": 85.93, "PIT": 100.93, "SEA": 75.36, "SJS": 85.42, "STL": 101.13, "TBL": 108.55, "TOR": 93.01,
    "UTA": 111.59, "VAN": 69.84, "VGK": 106.57, "WPG": 102.34, "WSH": 96.64}
REPORT_COLS = ["off_rating", "def_rating", "pace_rating", "finishing_rating", "goalie_rating", "danger_rating",
               "special_rating", "discipline_rating", "variance_flag", "trend10", "pp_tier", "pk_tier"]

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


def state_by_date(start, end):
    """Per date: rows, v4 rows, v4 rows with goalie known, v3 rows left, carried rows that are exactly
    the team's 09-28 snapshot (label legacy_unversioned, source 08-29, same values), and the expected
    v4 count (teams with a genuine gp = 1 game in the writer's 150-day lookback)."""
    same = " and ".join(f"coalesce(abs(t.{c} - p.{c}) < 1e-9, t.{c} is null and p.{c} is null)"
                        for c in CARRY_COLS)
    rows = {}
    for line in psql(
            f"with d as (select g::date as d from generate_series('{start}'::date, '{end}'::date, interval '1 day') g), "
            f"x as (select d.d, count(distinct a.team_abbreviation) as n from d left join nst_team_gamelogs_as_rates a "
            f"on a.situation = 'all' and a.gp = 1 and a.date between d.d - {LOOKBACK_DAYS} and d.d group by 1), "
            f"t as (select d.d, count(t.team_abbreviation) as total, "
            f"count(*) filter (where t.calculation_version = '{V4}') as v4, "
            f"count(*) filter (where t.calculation_version = '{V4}' and t.goalie_rating is not null) as goalie, "
            f"count(*) filter (where t.calculation_version = '{V3}') as v3, "
            f"count(*) filter (where t.calculation_version = '{LEGACY}' and t.source_through_date = '{CARRY_SOURCE}' "
            f"and {same}) as carried_ok "
            f"from d left join team_power_ratings_daily t on t.date = d.d "
            f"left join team_power_ratings_daily p on p.team_abbreviation = t.team_abbreviation and p.date = '{CARRY_FROM}' "
            f"group by 1) "
            f"select t.d, t.total, t.v4, t.goalie, t.v3, t.carried_ok, x.n from t join x using (d) order by 1"):
        d, total, v4, goalie, v3, carried_ok, expected = line.split("|")
        rows[d] = dict(total=int(total), v4=int(v4), goalie=int(goalie), v3=int(v3), carried_ok=int(carried_ok),
                       expected=int(expected))
    return rows


def done(s):
    # Every team is either computed (v4, goalie known) or carried exactly from its 09-28 snapshot.
    return (s["total"] == TEAMS_PER_DATE and s["v4"] == s["expected"] and s["goalie"] == s["expected"]
            and s["v3"] == 0 and s["carried_ok"] == TEAMS_PER_DATE - s["expected"])


def dump(path):
    lines = psql(f"select * from team_power_ratings_daily where date between '{args.start}' and '{args.end}' "
                 f"order by date, team_abbreviation", "-F", "\t", "-P", "tuples_only=off", "-P", "footer=off")
    open(path, "w").write("\n".join(lines) + "\n")
    return len(lines) - 1


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
if not os.path.exists(backup):  # the first (preflight) snapshot is the movement baseline
    log(event="backup", file=os.path.relpath(backup, HERE), rows=dump(backup))
versions = psql(f"select coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
                f"where date between '{args.start}' and '{args.end}' group by 1 order by 1")
log(event="versions_before", versions=versions)

state = state_by_date(args.start, args.end)
todo = [d for d, s in state.items() if not done(s)]
expected = {d: s["expected"] for d, s in state.items()}
log(event="plan", first=todo[0] if todo else None, calls=len(todo), dates=todo,
    expected_v4_rows=sum(expected.values()),
    expected_carried_rows=sum(TEAMS_PER_DATE - n for n in expected.values()),
    partial_dates={d: n for d, n in expected.items() if n < TEAMS_PER_DATE})
if args.preflight:
    log(event="PREFLIGHT_ONLY", calls=0)
    sys.exit(0)
if not todo:
    log(event="nothing_to_call", reason="every date already matches v4; running final verification")
else:
    # Rows can change after the preflight (cron 283 rewrites D-1..D each morning), so every run also
    # snapshots the range just before its first call: every row a call can overwrite is on disk.
    snap = os.path.join(OUT, time.strftime("pre-run-%Y%m%dT%H%M%SZ.tsv", time.gmtime()))
    log(event="pre_run_snapshot", file=os.path.relpath(snap, HERE), rows=dump(snap))

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
    s = state_by_date(d, d)[d]
    log(event="readback", date=d, rows=s["total"], v4=s["v4"], goalie_known=s["goalie"], v3_left=s["v3"],
        carried_exact=s["carried_ok"], expected_v4=expected[d], expected_carried=TEAMS_PER_DATE - expected[d])
    if s["expected"] != expected[d] or not done(s):
        stop(6, "readback mismatch (expected 32 rows: v4 = teams with a genuine game, goalie known for all of "
                "them; every other row exactly its 09-28 snapshot, legacy_unversioned, source 08-29; no v3 left)",
             resume_from=d)
    if dur > SLOW_S:
        stop(5, f"call over {SLOW_S} s", resume_from=(todo[n] if n < len(todo) else None))
    time.sleep(PAUSE_S)

# 3. Final verification (read-only).
versions = psql(f"select coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
                f"where date between '{args.start}' and '{args.end}' group by 1 order by 1")
carried = psql(f"select date, coalesce(calculation_version,'null'), source_through_date, count(*) "
               f"from team_power_ratings_daily where date between '{args.start}' and '{args.end}' "
               f"and calculation_version is distinct from '{V4}' group by 1,2,3 order by 1")
later = psql(f"select date, coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
             f"where date > '{args.end}' group by 1,2 order by 1")
cols = ",".join(["team_abbreviation", "date"] + REPORT_COLS)
after = {}
for line in psql(f"select {cols} from team_power_ratings_daily where date between '{args.start}' and '{args.end}'"):
    p = line.split("|"); after[(p[0], p[1])] = dict(zip(REPORT_COLS, p[2:]))
with open(backup) as fh:
    header = fh.readline().rstrip("\n").split("\t")
    before = {}
    for line in fh:
        p = line.rstrip("\n").split("\t")
        if len(p) == len(header):
            r = dict(zip(header, p)); before[(r["team_abbreviation"], r["date"])] = r
movement = {}
for c in REPORT_COLS:
    diffs = [abs(float(a[c]) - float(before[k][c])) for k, a in after.items()
             if k in before and a[c] != "" and before[k].get(c, "") != ""]
    movement[c] = {"compared": len(diffs), "changed": sum(1 for x in diffs if x > 1e-9),
                   "max_abs": round(max(diffs), 2) if diffs else None}
def off_expected(col, exp):
    return [[t, round(float(after[(t, "2026-11-12")][col]), 2), e] for t, e in exp.items()
            if (t, "2026-11-12") in after and abs(float(after[(t, "2026-11-12")][col]) - e) > 0.05]
final_state = state_by_date(args.start, args.end)
log(event="final", versions_after=versions, expected_v4_rows=sum(expected.values()),
    expected_carried_rows=sum(TEAMS_PER_DATE - n for n in expected.values()),
    dates_not_done=[d for d, s in final_state.items() if not done(s)],
    non_v4_rows=carried, later_dates=later, movement_vs_backup=movement,
    goalie_1112_off_expected=off_expected("goalie_rating", EXPECTED_1112_GOALIE),
    off_rating_1112_off_expected=off_expected("off_rating", EXPECTED_1112_OFF))
log(event="DONE", calls=len(todo))

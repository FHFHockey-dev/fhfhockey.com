#!/usr/bin/env python3
"""Team power ratings v4 rebuild runner. NOT YET APPROVED: run only on TJ's explicit approval.

v4 = (1) decision 145: goalie_rating is 5-on-5 goaltending (empty-net goals excluded);
     (2) season-total NST rows (gp != 1) no longer count as games, for every component.
Carry-forward (decision 150): the 47 team-dates in carry-manifest.tsv keep the team's 2026-09-28 snapshot
(legacy_unversioned, source 2026-08-29). They are never labelled v4 and no gap is filled.

Fails closed, in this order (Astra #434 P1 rebuild gate). Nothing is written before step 6.
  1. Cron windows (live-checked: cron 283 must still be the only active job touching the table, at 15 10 * * *)
     and read-only DB guard. Refuses to start within START_MARGIN_MIN of a window. Immediately before every
     mutating call, AFTER the DB guard (which can sleep up to 120 s), stops if a window is within CALL_MARGIN_MIN.
  2. Backup: created if missing, then ALWAYS verified: it must hold every (team, date) in range, 32 per date,
     every column, and equal the live row wherever the live row is still the issued v3 row.
  3. Manifest: the 47 keys must equal the live "no genuine game in the lookback" keys, and their values the
     live 09-28 rows, key by key.
  4. Live route bound to v4 without a write:
     0. before ANY request to the writer: the latest successful GitHub deployment of "Production – fhfhockey"
        must be a commit in master's history whose writer source has the dry-run mode (2bf3c1d26 or a released
        successor; releases are squash-merged, so the source is checked, not the ancestry of 2bf3c1d26).
        The old writer audits every call, so it must never be reached;
     a. probe date=2000-01-01&dryRun=true (no ratings or NST rows exist near it); it must answer dryRun=true,
        v4, 0 upserts, and on the dry-run writer a successful dry run leaves no audit row;
     b. dry runs of the first date to write and of 2026-11-12, checked row by row: manifest rows exact, every
        other row v4 with a known goalie rating, and 2026-11-12 equal to PLAN.md's local sample (0.05).
  5. Served API (/api/team-ratings, which the card, the terminal and the landing read) must expose
     calculationVersion and sourceThroughDate and equal the database.
  --preflight stops here.
  6. Fresh verified pre-run snapshot, then one write per date, ascending; after each, a key-by-key readback
     (and, for dry-run dates, equality with the dry-run rows).
  7. Final: every date key by key, the manifest exactly, the sample, and a served readback equal to the
     database. Any mismatch exits non-zero; DONE is printed only when everything matches.
Never prints secrets.

Usage (from any directory):
  python3 -I power-g5v5-loop.py --preflight --end 2026-11-13   # steps 1-5; no writes
  python3 -I power-g5v5-loop.py --end 2026-11-13               # the rebuild (46 calls), after approval
  --base http://localhost:PORT runs --preflight against a local dev server (it shares the production
  database, so a local base is never allowed to write).
Exit codes: 0 done or preflight passed, 2 HTTP/body failure or uncertain outcome, 3 DB guard, 4 cron window,
            5 slow call, 6 readback/manifest/sample/served mismatch, 7 live route not v4 or without dry run,
            8 backup does not cover the range.
"""
import argparse, csv, hashlib, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = "/Users/tim/Code/fhfhockey.com"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "run")
MANIFEST = os.path.join(HERE, "carry-manifest.tsv")
PGPOOL = os.path.join(os.environ["TMPDIR"], "pgpool.sh")
PRODUCTION = "https://fhfhockey.com"
V4 = "team-power-v4-5v5-goaltending"
V3 = "team-power-v3-all-team-baseline-prior-after-norm-pooled-st"
LEGACY = "legacy_unversioned"
CARRY_FROM = "2026-09-28"      # the snapshot every carried row must equal (decision 150)
CARRY_SOURCE = "2026-08-29"
TEAMS_PER_DATE = 32
LOOKBACK_DAYS = 150            # TEAM_RATINGS_TREND_LOOKBACK_DAYS
PROBE_DATE = "2000-01-01"      # no stored ratings or NST logs within the writer's windows
SAMPLE_DATE = "2026-11-12"
PAUSE_S = 5
SLOW_S = 60
SERVED_CACHE_S = 65            # /api/team-ratings caches 60 s in process
REPO = "FHFHockey-dev/fhfhockey.com"
PROD_ENV = "Production – fhfhockey"
WRITER_PATH = "web/pages/api/v1/db/update-team-power-ratings.ts"
# Source markers of the dry-run writer (2bf3c1d26): the flag, the no-write branch and the audit skip.
DRY_RUN_MARKERS = [f'"{V4}"', 'getRequestFlag(req, "dryRun")', "dryRunRows.push(...upserts)", "skipAuditWhenNoOp"]
# Guard windows (UTC minutes from midnight). ET is UTC-5 until 2027-03-14 (EST).
CRON_283 = (283, "15 10 * * *")   # update-team-power-ratings, the only active job that writes the table
WINDOWS = [(480, 500, "08:00-08:20 UTC (03:00-03:20 ET): morning ingest jobs"),
           (565, 660, "09:25-11:00 UTC (04:25-06:00 ET): cron 283 at 10:15 (route runs ~10:15:01-10:15:06) "
                      "and the 10:05-10:55 FORGE pipeline"),
           (675, 700, "11:15-11:40 UTC (06:15-06:40 ET): sustainability and forecast jobs")]
CALL_MARGIN_MIN = 15           # no mutating call within 15 min of a window (so none from 09:10 UTC before 283)
START_MARGIN_MIN = 25          # a run (about 8 minutes) must finish before the call margin begins
# Columns the writer copies from the previous stored row (trend10 too: a team with no genuine game has no
# trend override). pp_tier/pk_tier are recomputed per date, so not compared.
CARRY_COLS = ["off_rating", "def_rating", "pace_rating", "xgf60", "gf60", "sf60", "xga60", "ga60", "sa60",
              "pace60", "finishing_rating", "goalie_rating", "danger_rating", "special_rating",
              "discipline_rating", "variance_flag", "trend10"]
SERVED_FIELDS = {"offRating": "off_rating", "defRating": "def_rating", "paceRating": "pace_rating",
                 "finishingRating": "finishing_rating", "goalieRating": "goalie_rating",
                 "dangerRating": "danger_rating", "specialRating": "special_rating",
                 "disciplineRating": "discipline_rating", "trend10": "trend10",
                 "calculationVersion": "calculation_version", "sourceThroughDate": "source_through_date"}
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
ap.add_argument("--base", default=PRODUCTION)
args = ap.parse_args()
LOCAL = urllib.parse.urlparse(args.base).hostname in ("localhost", "127.0.0.1")
if args.base != PRODUCTION and not LOCAL:
    sys.exit(f"--base must be {PRODUCTION} or a localhost dev server")
if LOCAL and not args.preflight:
    sys.exit("a localhost base shares the production database: --preflight only")
ROUTE = args.base.rstrip("/") + "/api/v1/db/update-team-power-ratings"
SERVED = args.base.rstrip("/") + "/api/team-ratings"
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


def window_at(margin_min=0):
    """The guard window we are in, or that starts within margin_min minutes; None when clear."""
    t = time.gmtime(); m = t.tm_hour * 60 + t.tm_min
    for start, end, label in WINDOWS:
        if any(start <= (m + k) % 1440 < end for k in range(margin_min + 1)):
            return label
    return None


def write_gate(d):
    """Immediately before a mutating call: no guard window within CALL_MARGIN_MIN, checked before the DB
    guard and again after it returns, because guard() can sleep up to 120 s (Astra #435 P2)."""
    w = window_at(CALL_MARGIN_MIN)
    if w:
        stop(4, f"guard window within {CALL_MARGIN_MIN} min: {w}", resume_from=d)
    guard()
    w = window_at(CALL_MARGIN_MIN)
    if w:
        stop(4, f"guard window within {CALL_MARGIN_MIN} min after the DB guard wait: {w}", resume_from=d)


def check_cron_jobs():
    """Read-only: cron 283 still runs at 15 10 * * *, no other active job touches the table, and no 283
    run is in progress. Commands are filtered in the database and never selected or printed."""
    rows = psql(f"select schedule, active from cron.job where jobid = {CRON_283[0]}")
    others = psql("select count(*) from cron.job where active and jobid <> %d and (command ilike '%%team_power_ratings%%' "
                  "or command ilike '%%team-power-ratings%%')" % CRON_283[0])[0]
    running = psql(f"select count(*) from cron.job_run_details where jobid = {CRON_283[0]} and status in ('running', 'starting')")[0]
    problems = []
    if rows != [f"{CRON_283[1]}|t"]:
        problems.append(f"cron {CRON_283[0]} is {rows}, expected {CRON_283[1]} active: update WINDOWS")
    if others != "0":
        problems.append(f"{others} other active cron job(s) touch team_power_ratings: add their windows")
    if running != "0":
        problems.append(f"cron {CRON_283[0]} has a run in progress")
    return problems


def gh(path, raw=False):
    r = subprocess.run(["gh", "api", *(["-H", "Accept: application/vnd.github.raw"] if raw else []), path],
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(f"gh api {path.split('?')[0]}: {r.stderr.strip()[:200]}")
    return r.stdout


def deployed_writer_gate():
    """Before any request to the writer: the live production deployment must contain the dry-run writer.
    Read-only GitHub API calls; for a localhost base the working tree is checked instead."""
    if LOCAL:
        src = open(os.path.join(ROOT, WRITER_PATH)).read()
        return "working tree", [m for m in DRY_RUN_MARKERS if m not in src]
    env = urllib.parse.quote(PROD_ENV)
    for dep in json.loads(gh(f"repos/{REPO}/deployments?environment={env}&per_page=10")):
        statuses = json.loads(gh(f"repos/{REPO}/deployments/{dep['id']}/statuses?per_page=1"))
        if statuses and statuses[0].get("state") == "success":
            sha = dep["sha"]
            break
    else:
        return None, ["no successful production deployment found"]
    problems = []
    status = json.loads(gh(f"repos/{REPO}/compare/{sha}...master")).get("status")
    if status not in ("identical", "ahead"):  # "ahead": master is ahead of sha, i.e. sha is in master's history
        problems.append(f"deployed {sha[:9]} is not in master's history (compare: {status})")
    src = gh(f"repos/{REPO}/contents/{WRITER_PATH}?ref={sha}", raw=True)
    problems += [f"deployed writer lacks {m}" for m in DRY_RUN_MARKERS if m not in src]
    return sha, problems


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


def dates_between(start, end):
    return [x for x in psql(f"select g::date from generate_series('{start}'::date, '{end}'::date, interval '1 day') g")]


def num(v):
    return None if v is None or v == "" else float(v)


def same(a, b):
    a, b = num(a), num(b)
    return (a is None and b is None) or (a is not None and b is not None and abs(a - b) <= 1e-9)


def db_rows(start, end):
    """{date: {team: row}} with the label, source date and copied columns, read-only."""
    cols = ["team_abbreviation", "date", "calculation_version", "source_through_date"] + CARRY_COLS
    out = {}
    for line in psql(f"select {', '.join(cols)} from team_power_ratings_daily "
                     f"where date between '{start}' and '{end}'", "-F", "\t"):
        r = dict(zip(cols, line.split("\t")))
        out.setdefault(r["date"], {})[r["team_abbreviation"]] = r
    return out


def api_rows(rows):
    """Writer dry-run rows in the same shape as db_rows."""
    out = {}
    for r in rows:
        x = {"team_abbreviation": r.get("team_abbreviation"), "date": r.get("date"),
             "calculation_version": r.get("calculation_version") or "",
             "source_through_date": (r.get("source_through_date") or "")[:10]}
        for c in CARRY_COLS:
            x[c] = "" if r.get(c) is None else repr(float(r[c]))
        out[x["team_abbreviation"]] = x
    return out


def check_date(d, rows):
    """Problems for one date's rows (empty = exactly as expected): the manifest teams carry their 09-28
    snapshot exactly; every other team is v4 with a known goalie rating; 32 teams; no v3."""
    problems = []
    carried = {t: m for (t, md), m in MANIFEST_ROWS.items() if md == d}
    if set(rows) != ALL_TEAMS:
        problems.append(f"{d}: teams {len(rows)} (missing {sorted(ALL_TEAMS - set(rows))}, extra {sorted(set(rows) - ALL_TEAMS)})")
    for t, r in sorted(rows.items()):
        if t in carried:
            m = carried[t]
            if r["calculation_version"] != LEGACY or r["source_through_date"][:10] != CARRY_SOURCE:
                problems.append(f"{t} {d}: carried row labelled {r['calculation_version']} / {r['source_through_date']}")
            bad = [c for c in CARRY_COLS if not same(r[c], m[c])]
            if bad:
                problems.append(f"{t} {d}: carried row differs from 09-28 in {bad}")
        else:
            if r["calculation_version"] != V4:
                problems.append(f"{t} {d}: expected v4, found {r['calculation_version'] or 'null'}")
            if num(r["goalie_rating"]) is None:
                problems.append(f"{t} {d}: v4 row with unknown goalie_rating")
            if not r["source_through_date"] or r["source_through_date"][:10] > d:
                problems.append(f"{t} {d}: v4 source_through_date {r['source_through_date'] or 'null'}")
    return problems


def sample_problems(rows):
    out = []
    for col, exp in (("goalie_rating", EXPECTED_1112_GOALIE), ("off_rating", EXPECTED_1112_OFF)):
        for t, e in exp.items():
            v = num(rows.get(t, {}).get(col))
            if v is None or abs(v - e) > 0.05:
                out.append(f"{t} {SAMPLE_DATE} {col}: {v} vs sample {e}")
    return out


def http(url, auth):
    headers = {"Authorization": f"Bearer {secret}"} if auth else {}
    t0 = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as resp:
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


def call(d, dry):
    return http(f"{ROUTE}?date={d}" + ("&dryRun=true" if dry else ""), auth=True)


def dump_lines(start, end):
    return psql(f"select * from team_power_ratings_daily where date between '{start}' and '{end}' "
                f"order by date, team_abbreviation", "-F", "\t", "-P", "tuples_only=off", "-P", "footer=off")


def keyed(lines):
    header = lines[0].split("\t")
    ti, di = header.index("team_abbreviation"), header.index("date")
    out = {}
    for line in lines[1:]:
        p = line.split("\t")
        out[(p[ti], p[di])] = (p, line)
    return header, out


def verify_backup(path, live_lines):
    """The file must hold every live (team, date) in range, 32 per date, every column, no duplicates, and
    equal the live row wherever the live row is still the issued v3 row."""
    with open(path) as fh:
        lines = [x.rstrip("\n") for x in fh if x.strip()]
    problems = []
    header, rows = keyed(lines)
    live_header, live = keyed(live_lines)
    if header != live_header:
        problems.append("columns differ from the live table")
    if len(rows) != len(lines) - 1:
        problems.append("duplicate keys")
    if any(len(p) != len(header) for p, _ in rows.values()):
        problems.append("ragged rows")
    if set(rows) != set(live):
        problems.append(f"keys differ: {len(set(live) - set(rows))} live keys missing, {len(set(rows) - set(live))} extra")
    per_date = {}
    for (_, d) in rows:
        per_date[d] = per_date.get(d, 0) + 1
    for d in DATES:
        if per_date.get(d) != TEAMS_PER_DATE:
            problems.append(f"{d}: {per_date.get(d, 0)} rows")
    vi = live_header.index("calculation_version")
    stale = [k for k, (p, line) in live.items() if p[vi] == V3 and k in rows and rows[k][1] != line]
    if stale:
        problems.append(f"{len(stale)} untouched v3 rows differ from the backup, e.g. {sorted(stale)[:3]}")
    sha = hashlib.sha256(open(path, "rb").read()).hexdigest()
    return problems, len(rows), sha


# 1. Cron windows and DB guard.
w = window_at(START_MARGIN_MIN)
if w:
    stop(4, f"inside, or within {START_MARGIN_MIN} min of, the guard window {w}")
guard()
cron_problems = check_cron_jobs()
log(event="cron_checked", job=CRON_283[0], schedule=CRON_283[1], problems=cron_problems)
if cron_problems:
    stop(4, "cron schedule check failed; the guard windows may no longer protect the run")
DATES = dates_between(args.start, args.end)
ALL_TEAMS = set(db_rows(CARRY_FROM, CARRY_FROM).get(CARRY_FROM, {}))
if len(ALL_TEAMS) != TEAMS_PER_DATE:
    stop(6, f"{CARRY_FROM} has {len(ALL_TEAMS)} rows, expected {TEAMS_PER_DATE}")

# 2. Backup: create if missing, then always verify against the live table.
live_lines = dump_lines(args.start, args.end)
backup = os.path.join(OUT, f"issued-rows-{args.start}_{args.end}.tsv")
if not os.path.exists(backup):  # the first snapshot is the movement baseline
    open(backup, "w").write("\n".join(live_lines) + "\n")
    log(event="backup_created", file=os.path.relpath(backup, HERE))
problems, n, sha = verify_backup(backup, live_lines)
log(event="backup_verified" if not problems else "backup_rejected", file=os.path.relpath(backup, HERE),
    rows=n, sha256=sha, problems=problems[:10])
if problems:
    stop(8, "backup does not cover the range; move it aside and rerun --preflight to recreate it")
versions = psql(f"select coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
                f"where date between '{args.start}' and '{args.end}' group by 1 order by 1")
log(event="versions_before", versions=versions)

# 3. Manifest, key by key: the live no-genuine-game keys and the live 09-28 values.
with open(MANIFEST) as fh:
    MANIFEST_ROWS = {(r["team_abbreviation"], r["date"]): r for r in csv.DictReader(fh, delimiter="\t")
                     if args.start <= r["date"] <= args.end}
genuine = {}
for line in psql(f"with d as (select g::date as d from generate_series('{args.start}'::date, '{args.end}'::date, interval '1 day') g) "
                 f"select d.d, string_agg(distinct a.team_abbreviation, ',') from d join nst_team_gamelogs_as_rates a "
                 f"on a.situation = 'all' and a.gp = 1 and a.date between d.d - {LOOKBACK_DAYS} and d.d group by 1"):
    d, teams = line.split("|")
    genuine[d] = set(teams.split(","))
live_carry = {(t, d) for d in DATES for t in ALL_TEAMS - genuine.get(d, set())}
snapshot = db_rows(CARRY_FROM, CARRY_FROM)[CARRY_FROM]
manifest_problems = [f"live carry keys not in manifest: {sorted(live_carry - set(MANIFEST_ROWS))}"] \
    if live_carry - set(MANIFEST_ROWS) else []
if set(MANIFEST_ROWS) - live_carry:
    manifest_problems.append(f"manifest keys that now have a genuine game: {sorted(set(MANIFEST_ROWS) - live_carry)}")
for (t, d), m in sorted(MANIFEST_ROWS.items()):
    s = snapshot.get(t)
    if (s is None or m["calculation_version"] != LEGACY or m["source_through_date"] != CARRY_SOURCE
            or s["calculation_version"] != LEGACY or s["source_through_date"] != CARRY_SOURCE
            or any(not same(s[c], m[c]) for c in CARRY_COLS)):
        manifest_problems.append(f"{t} {d}: manifest differs from the live {CARRY_FROM} row")
log(event="manifest_checked", keys=len(MANIFEST_ROWS), problems=manifest_problems[:10])
if manifest_problems:
    stop(6, "carry manifest no longer matches the live data; regenerate it (carry-manifest.sql) for TJ's review")

state = db_rows(args.start, args.end)
todo = [d for d in DATES if check_date(d, state.get(d, {}))]
log(event="plan", first=todo[0] if todo else None, calls=len(todo), dates=todo,
    expected_v4_rows=len(DATES) * TEAMS_PER_DATE - len(MANIFEST_ROWS), expected_carried_rows=len(MANIFEST_ROWS))

# 4. Bind the live route to v4 without a write.
dry = {}
if todo:
    try:
        sha, gate_problems = deployed_writer_gate()
    except Exception as e:  # gh missing, unauthenticated or unreachable: fail closed
        sha, gate_problems = None, [repr(e)[:200]]
    log(event="deployed_writer_gate", sha=sha, problems=gate_problems)
    if gate_problems:
        stop(7, "the live production deployment does not contain the dry-run writer; no request was sent "
                "to the writer. Wait for the release that contains it, then rerun --preflight.")
    guard()
    status, dur, j = call(PROBE_DATE, dry=True)
    log(event="probe", date=PROBE_DATE, status=status, duration_s=round(dur, 1), dryRun=j.get("dryRun"),
        calculationVersion=j.get("calculationVersion"), totalUpserts=j.get("totalUpserts"),
        wouldUpsert=j.get("wouldUpsert"), error=j.get("error") if status != 200 else None)
    if not (status == 200 and j.get("dryRun") is True and j.get("calculationVersion") == V4
            and j.get("totalUpserts") == 0 and j.get("wouldUpsert") == 0):
        stop(7, "the live route is not the v4 writer with a dry-run mode; no rating was written. "
                "Wait for the release that contains it, then rerun --preflight.")
    for d in dict.fromkeys([todo[0]] + ([SAMPLE_DATE] if args.start <= SAMPLE_DATE <= args.end else [])):
        guard()
        status, dur, j = call(d, dry=True)
        rows = api_rows(j.get("rows") or [])
        problems = check_date(d, rows) if status == 200 else [f"HTTP {status}: {j.get('error')}"]
        if not (j.get("dryRun") is True and j.get("totalUpserts") == 0 and j.get("processedDays") == 1
                and j.get("wouldUpsert") == TEAMS_PER_DATE):
            problems.append("dry-run response is not a one-day, no-write dry run")
        if d == SAMPLE_DATE:
            problems += sample_problems(rows)
        log(event="dry_run", date=d, status=status, duration_s=round(dur, 1), wouldUpsert=j.get("wouldUpsert"),
            v4=sum(r["calculation_version"] == V4 for r in rows.values()),
            carried=sum(r["calculation_version"] == LEGACY for r in rows.values()), problems=problems[:10])
        if problems:
            stop(6, "dry run does not match the manifest, v4 labels or sample; nothing written", date=d)
        dry[d] = rows

# 5. The served API must expose the labels and equal the database.
def served_problems(d, db):
    status, _, j = http(f"{SERVED}?date={d}", auth=False)
    if status != 200:
        return [f"served {d}: HTTP {status}"]
    rows = j if isinstance(j, list) else j.get("ratings", []) if isinstance(j, dict) else []
    served = {r.get("teamAbbr"): r for r in rows if isinstance(r, dict)}
    out = [] if set(served) == set(db) else [f"served {d}: teams {sorted(set(served) ^ set(db))} differ"]
    for t, r in served.items():
        if t not in db:
            continue
        for k, c in SERVED_FIELDS.items():
            if k not in r:
                out.append(f"served {d}: field {k} missing")
                return out
            v, w = r[k], db[t][c]
            if c == "calculation_version":
                ok = (v or "") == (w or "")
            elif c == "source_through_date":
                ok = str(v or "")[:10] == (w or "")[:10]
            else:
                ok = same("" if v is None else v, w)
            if not ok:
                out.append(f"served {t} {d} {k}: {v} vs db {w}")
    return out

served_date = todo[0] if todo else args.end
problems = served_problems(served_date, state.get(served_date, {}))
log(event="served_check", date=served_date, problems=problems[:10])
if problems:
    stop(6, "the served API does not expose calculationVersion/sourceThroughDate or differs from the database")
if args.preflight:
    log(event="PREFLIGHT_OK", calls=0, writes=0)
    sys.exit(0)

# 6. Fresh verified snapshot, then one write per date, ascending.
last_write = None
if todo:
    w = window_at(START_MARGIN_MIN) or (check_cron_jobs() or [None])[0]
    if w:
        stop(4, f"guard window or cron check before the first write: {w}")
    snap = os.path.join(OUT, time.strftime("pre-run-%Y%m%dT%H%M%SZ.tsv", time.gmtime()))
    snap_lines = dump_lines(args.start, args.end)
    open(snap, "w").write("\n".join(snap_lines) + "\n")
    problems, n, sha = verify_backup(snap, snap_lines)
    log(event="pre_run_snapshot", file=os.path.relpath(snap, HERE), rows=n, sha256=sha, problems=problems[:10])
    if problems:
        stop(8, "pre-run snapshot does not cover the range")
for n, d in enumerate(todo, 1):
    write_gate(d)  # the window is rechecked after guard() returns, right before the write
    status, dur, j = call(d, dry=False)
    last_write = time.time()
    log(event="call", n=n, date=d, status=status, duration_s=round(dur, 1),
        calculationVersion=j.get("calculationVersion"), dryRun=j.get("dryRun"), processedDays=j.get("processedDays"),
        totalUpserts=j.get("totalUpserts"), error=j.get("error") if status != 200 else None)
    if status != 200:
        stop(2, "non-200 or uncertain outcome; rerun the script to resume (upserts are idempotent)", resume_from=d)
    if j.get("calculationVersion") != V4 or j.get("dryRun") is not False:
        stop(7, "the response is not from the v4 writer with a dry-run mode", resume_from=d)
    if j.get("processedDays") != 1 or j.get("totalUpserts") != TEAMS_PER_DATE:
        stop(6, "unexpected processedDays/totalUpserts", resume_from=d)
    rows = db_rows(d, d).get(d, {})
    problems = check_date(d, rows)
    if d in dry:
        problems += [f"{t} {d}: stored row differs from its dry run" for t, r in dry[d].items()
                     if t not in rows or r["calculation_version"] != rows[t]["calculation_version"]
                     or r["source_through_date"] != rows[t]["source_through_date"][:10]
                     or any(not same(r[c], rows[t][c]) for c in CARRY_COLS)]
    log(event="readback", date=d, rows=len(rows), v4=sum(r["calculation_version"] == V4 for r in rows.values()),
        carried=sum(r["calculation_version"] == LEGACY for r in rows.values()), problems=problems[:10])
    if problems:
        stop(6, "readback mismatch", resume_from=d)
    if dur > SLOW_S:
        stop(5, f"call over {SLOW_S} s", resume_from=(todo[n] if n < len(todo) else None))
    time.sleep(PAUSE_S)

# 7. Final verification (read-only). Any problem exits 6 and DONE is not printed.
after = db_rows(args.start, args.end)
problems = [p for d in DATES for p in check_date(d, after.get(d, {}))]
non_v4 = {(t, d) for d in DATES for t, r in after.get(d, {}).items() if r["calculation_version"] != V4}
if non_v4 != set(MANIFEST_ROWS):
    problems.append(f"non-v4 keys differ from the manifest: extra {sorted(non_v4 - set(MANIFEST_ROWS))[:5]}, "
                    f"missing {sorted(set(MANIFEST_ROWS) - non_v4)[:5]}")
if args.start <= SAMPLE_DATE <= args.end:
    problems += sample_problems(after.get(SAMPLE_DATE, {}))
if last_write is not None:
    time.sleep(max(0, SERVED_CACHE_S - (time.time() - last_write)))
for d in dict.fromkeys(x for x in (args.start, "2026-10-02", SAMPLE_DATE, args.end) if args.start <= x <= args.end):
    problems += served_problems(d, after.get(d, {}))
versions = psql(f"select coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
                f"where date between '{args.start}' and '{args.end}' group by 1 order by 1")
later = psql(f"select date, coalesce(calculation_version,'null'), count(*) from team_power_ratings_daily "
             f"where date > '{args.end}' group by 1,2 order by 1")
cols = ",".join(["team_abbreviation", "date"] + REPORT_COLS)
after_report = {}
for line in psql(f"select {cols} from team_power_ratings_daily where date between '{args.start}' and '{args.end}'"):
    p = line.split("|"); after_report[(p[0], p[1])] = dict(zip(REPORT_COLS, p[2:]))
with open(backup) as fh:
    header = fh.readline().rstrip("\n").split("\t")
    before = {}
    for line in fh:
        p = line.rstrip("\n").split("\t")
        if len(p) == len(header):
            r = dict(zip(header, p)); before[(r["team_abbreviation"], r["date"])] = r
movement = {}
for c in REPORT_COLS:
    diffs = [abs(float(a[c]) - float(before[k][c])) for k, a in after_report.items()
             if k in before and a[c] != "" and before[k].get(c, "") != ""]
    movement[c] = {"compared": len(diffs), "changed": sum(1 for x in diffs if x > 1e-9),
                   "max_abs": round(max(diffs), 2) if diffs else None}
log(event="final", versions_after=versions, expected_carried_rows=len(MANIFEST_ROWS), non_v4_rows=len(non_v4),
    later_dates=later, movement_vs_backup=movement, problems=problems[:20], problem_count=len(problems))
if problems:
    stop(6, "final verification failed; see problems (DONE not printed)")
log(event="DONE", calls=len(todo))

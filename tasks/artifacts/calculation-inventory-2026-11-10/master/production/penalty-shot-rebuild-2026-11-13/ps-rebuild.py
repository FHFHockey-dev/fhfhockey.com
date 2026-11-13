#!/usr/bin/env python3
"""Penalty-shot derived rebuild (F15; owner decision 149, Astra AF-07). NOT APPROVED: --execute only on TJ's
explicit approval, after migration 20261113200000 is applied and the F15 code is the production deployment.

Rebuilds exactly the 8 games of 2026-27 with a penalty shot outside the shootout, one game per call, through
GET /api/v1/db/build-projection-derived-v2?startDate=<date>&gameId=<id> (DB-only: no NHL, NST or Yahoo request).
The default is a read-only DRY RUN; nothing is written unless --execute is given.

Fails closed, in this order:
  1. Read-only DB guard: at most 5 active queries and none older than 10 s (waits 60 s, at most 3 times).
     Derived-build windows: no call within 15 min of 09:50-11:00 UTC (pg_cron 305 build-forge-derived-v2 at
     10:25 and the 10:05 rolling FORGE pipeline, which also runs the derived build).
  2. Migration applied: both tables have shots_ps, goals_ps and penalty_shot_split_version, and
     persist_projection_game_derived_v2 exists.
  3. Deployed code: the latest successful production deployment is in master's history and its route and
     persistence are the F15 ones (gameId filter, v2 writer). Read-only GitHub API calls.
  4. Manifest: the stored play-by-play's penalty shots for 2026-27 equal the 8 expected (game, team, result)
     exactly, and every game has stored derived rows (2 team rows) and a stored official boxscore.
  5. Official baseline per PLANNED game (a game already in the done file is reported, never re-baselined): legacy all-situation totals (ES + PP + PK) against the boxscore (SOG; goals =
     score minus the shootout winner's extra goal). A pre-existing mismatch is reported and the game is then
     held to "unchanged" instead of "equal to the boxscore".
  --dry-run (default) stops here and prints the 8 planned calls.
  6. --execute: per game, ascending: guard and window check, before-snapshot of every team and player row (to a
     run-unique run/before-<game>-<runstamp>-<seq>.json opened "x", never overwritten; after-files likewise; A3-02),
     one call (200 s timeout), then a key-by-key readback:
       - same player keys; every row marked split (1);
       - per player, ES + PP + PK + PS after == ES + PP + PK before (shots and goals), ES after == ES before - PS,
         PP, PK, assists and TOI unchanged;
       - the shooter team's PS shots / goals equal the manifest, the other team's are 0;
       - per team, all-situation after equals the official boxscore (or, for a reported baseline mismatch,
         the before value).
     A finished game id goes to run/ps-rebuild.done; a rerun skips it. 10 s between calls.
  7. Final: all 8 games split and equal to the official record; prints DONE.
Never prints secrets: CRON_SECRET is read from web/.env.local into memory only.

Usage: python3 -I ps-rebuild.py              # dry run, read-only
       python3 -I ps-rebuild.py --execute    # after approval
Exit codes: 0 done / dry run passed, 2 HTTP or body failure, 3 DB guard, 4 window, 5 slow call,
            6 readback or manifest mismatch, 7 migration or deployment not ready.
"""
import argparse, glob, itertools, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = "/Users/tim/Code/fhfhockey.com"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "run")
DONE = os.path.join(OUT, "ps-rebuild.done")
PRODUCTION = "https://fhfhockey.com"
ROUTE = PRODUCTION + "/api/v1/db/build-projection-derived-v2"
REPO = "FHFHockey-dev/fhfhockey.com"
PROD_ENV = "Production – fhfhockey"
ROUTE_PATH = "web/pages/api/v1/db/build-projection-derived-v2.ts"
PERSIST_PATH = "web/lib/projections/derived/projectionDerivedPersistence.ts"
DEPLOY_MARKERS = {ROUTE_PATH: ["onlyGameId", "persistProjectionGameDerivedV2"],
                  PERSIST_PATH: ['"persist_projection_game_derived_v2"', "PENALTY_SHOT_SPLIT_VERSION"]}
SEASON_FIRST, SEASON_LAST = 2026010001, 2026039999
# (game, date, shooter team, result): pbp_plays read 2026-11-13, PLAN.md table.
MANIFEST = [
    (2026020065, "2026-10-08", 54, "goal"),
    (2026020094, "2026-10-13", 55, "save"),
    (2026020101, "2026-10-13", 18, "save"),
    (2026020119, "2026-10-16", 21, "save"),
    (2026020131, "2026-10-17", 18, "goal"),
    (2026020150, "2026-10-20", 12, "save"),
    (2026020159, "2026-10-22", 26, "save"),
    (2026020203, "2026-10-29", 16, "save"),
]
WINDOWS = [(590, 660, "09:50-11:00 UTC: 10:05 rolling FORGE pipeline and pg_cron 305 derived build at 10:25")]
CALL_MARGIN_MIN = 15
PAUSE_S = 10
SLOW_S = 200
COUNT_COLS = ["shots_es", "shots_pp", "shots_pk", "goals_es", "goals_pp", "goals_pk"]
KEEP_COLS = ["shots_pp", "shots_pk", "goals_pp", "goals_pk", "assists_es", "assists_pp", "assists_pk",
             "toi_es_seconds", "toi_pp_seconds", "toi_pk_seconds", "team_id", "opponent_team_id", "game_date"]
# A penalty shot: outside the shootout, a side with no skaters (classifyEventStrengthBucket / isShootoutPlay).
PS_WHERE = ("p.situationcode ~ '^[01][0-6][0-6][01]$' and (substr(p.situationcode, 2, 1) = '0' "
            "or substr(p.situationcode, 3, 1) = '0') and coalesce(p.periodtype, '') <> 'SO' "
            "and not ((p.gameid / 10000) % 100 in (1, 2) and coalesce(p.periodnumber, 0) >= 5)")


# ---------- pure helpers (tested in test_ps_rebuild.py) ----------

def official_totals(box):
    """{team_id: (sog, goals)} from a stored NHL boxscore; a shootout winner's score carries one extra goal."""
    out = {}
    so = (box.get("gameOutcome") or {}).get("lastPeriodType") == "SO"
    home, away = box["homeTeam"], box["awayTeam"]
    for team, other in ((home, away), (away, home)):
        goals = int(team["score"]) - (1 if so and int(team["score"]) > int(other["score"]) else 0)
        out[int(team["id"])] = (int(team["sog"]), goals)
    return out


def all_situation(row):
    """(shots, goals) as every F15 reader computes them: ES + PP + PK + (marker 1 ? PS : 0)."""
    split = row.get("penalty_shot_split_version") == 1
    shots = row["shots_es"] + row["shots_pp"] + row["shots_pk"] + (row["shots_ps"] if split else 0)
    goals = row["goals_es"] + row["goals_pp"] + row["goals_pk"] + (row["goals_ps"] if split else 0)
    return shots, goals


def expected_ps(game_id, team_id):
    """(PS shots, PS goals) the manifest gives this team in this game."""
    for gid, _date, shooter, result in MANIFEST:
        if gid == game_id and shooter == team_id:
            return 1, 1 if result == "goal" else 0
    return 0, 0


def readback_problems(game_id, before, after, official, baseline_ok):
    """Key-by-key comparison of one game's rows. before/after: {"players": {pid: row}, "teams": {tid: row}}."""
    problems = []
    if set(before["players"]) != set(after["players"]):
        problems.append(f"player keys changed: -{sorted(set(before['players']) - set(after['players']))} "
                        f"+{sorted(set(after['players']) - set(before['players']))}")
    if set(after["teams"]) != set(before["teams"]) or len(after["teams"]) != 2:
        problems.append(f"team keys {sorted(after['teams'])} != {sorted(before['teams'])}")
    for kind in ("players", "teams"):
        for key, row in after[kind].items():
            if row.get("penalty_shot_split_version") != 1:
                problems.append(f"{kind[:-1]} {key} not split (marker {row.get('penalty_shot_split_version')})")
    for pid, b in before["players"].items():
        a = after["players"].get(pid)
        if a is None or a.get("penalty_shot_split_version") != 1:
            continue
        if b.get("penalty_shot_split_version") is None and all_situation(a) != all_situation(b):
            problems.append(f"player {pid} all-situation {all_situation(b)} -> {all_situation(a)}")
        if b.get("penalty_shot_split_version") is None and (a["shots_es"] != b["shots_es"] - a["shots_ps"]
                                                           or a["goals_es"] != b["goals_es"] - a["goals_ps"]):
            problems.append(f"player {pid} ES did not drop by exactly its PS")
        for col in KEEP_COLS:
            if a.get(col) != b.get(col):
                problems.append(f"player {pid} {col} {b.get(col)} -> {a.get(col)}")
    for tid, a in after["teams"].items():
        if a.get("penalty_shot_split_version") != 1:
            continue
        if (a["shots_ps"], a["goals_ps"]) != expected_ps(game_id, tid):
            problems.append(f"team {tid} PS {(a['shots_ps'], a['goals_ps'])} != manifest {expected_ps(game_id, tid)}")
        want = official.get(tid) if baseline_ok else all_situation(before["teams"][tid])
        if all_situation(a) != want:
            problems.append(f"team {tid} all-situation {all_situation(a)} != {'official' if baseline_ok else 'before'} {want}")
    return problems


# Evidence files are never overwritten (Astra A3-02): run-unique names, opened "x".
RUN_STAMP = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + f"-{os.getpid()}"
_EVIDENCE_SEQ = itertools.count(1)


def evidence_path(kind, game_id, ext):
    """A run-unique evidence path, e.g. run/before-<game>-<runstamp>-<seq>.json."""
    return os.path.join(OUT, f"{kind}-{game_id}-{RUN_STAMP}-{next(_EVIDENCE_SEQ):02d}.{ext}")


def write_evidence(path, text):
    """Create the file; an existing file is never truncated (FileExistsError instead)."""
    with open(path, "x") as f:
        f.write(text)
    return path


def authority_file(kind, game_id, ext):
    """The first run-unique evidence file of this kind for the game (the authority, e.g. for rollback). Legacy
    un-stamped files (before-<game>.json) are not considered: before A3-02 a rerun could overwrite them."""
    files = sorted(glob.glob(os.path.join(OUT, f"{kind}-{game_id}-*.{ext}")))
    return files[0] if files else None


def planned_games(done):
    return [(g, d) for g, d, _t, _r in MANIFEST if str(g) not in done]


def preflight(plan, done):
    """Baseline the planned games only; a done game is reported, never re-baselined (A3-02)."""
    for g, _d, _t, _r in MANIFEST:
        if str(g) in done:
            authority = authority_file("before", g, "json")
            log(event="already_done", game=g, authority_before=authority and os.path.relpath(authority, HERE))
    baseline = {}
    for g, d in plan:
        rows, official = rows_for(g), official_for(g)
        if len(rows["teams"]) != 2 or not rows["players"] or official is None:
            stop(6, "game lacks derived rows or a stored boxscore", game=g)
        current = {tid: all_situation(r) for tid, r in rows["teams"].items()}
        markers = sorted({str(r.get("penalty_shot_split_version")) for r in rows["teams"].values()})
        ok = all(current[t] == official.get(t) for t in current)
        baseline[g] = ok
        log(event="baseline", game=g, date=d, markers=markers, derived=current, official=official, equal=ok)
    return baseline


def window_at(minute_of_day, margin_min=0):
    for start, end, label in WINDOWS:
        if any(start <= (minute_of_day + k) % 1440 < end for k in range(margin_min + 1)):
            return label
    return None


# ---------- I/O ----------

def log(**kw):
    kw["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    line = json.dumps(kw)
    with open(os.path.join(OUT, "run.jsonl"), "a") as f:
        f.write(line + "\n")
    print(line, flush=True)


def stop(code, reason, **kw):
    log(event="STOP", code=code, reason=reason, **kw)
    sys.exit(code)


def psql(sql):
    env = dict(os.environ, PGOPTIONS="-c statement_timeout=8000 -c default_transaction_read_only=on")
    r = subprocess.run([os.path.join(os.environ["TMPDIR"], "pgpool.sh"), "-At", "-c", sql],
                       capture_output=True, text=True, env=env, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:300])
    return [x for x in r.stdout.split("\n") if x]


def guard():
    for _ in range(3):
        active, oldest = psql("select count(*) filter (where state = 'active'), coalesce(max(extract(epoch from "
                              "now() - query_start)) filter (where state = 'active' and pid <> pg_backend_pid()), 0)::int "
                              "from pg_stat_activity where datname = 'postgres'")[0].split("|")
        if int(active) <= 5 and int(oldest) <= 10:
            return
        log(event="guard_wait", active=int(active), oldest_s=int(oldest))
        time.sleep(60)
    stop(3, "DB guard: busy database after 3 waits")


def window_gate(game_id):
    t = time.gmtime()
    w = window_at(t.tm_hour * 60 + t.tm_min, CALL_MARGIN_MIN)
    if w:
        stop(4, f"derived-build window within {CALL_MARGIN_MIN} min: {w}", resume_from=game_id)


def gh(path, raw=False):
    r = subprocess.run(["gh", "api", *(["-H", "Accept: application/vnd.github.raw"] if raw else []), path],
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(f"gh api {path.split('?')[0]}: {r.stderr.strip()[:200]}")
    return r.stdout


def deployment_problems():
    env = urllib.parse.quote(PROD_ENV)
    for dep in json.loads(gh(f"repos/{REPO}/deployments?environment={env}&per_page=10")):
        statuses = json.loads(gh(f"repos/{REPO}/deployments/{dep['id']}/statuses?per_page=1"))
        if statuses and statuses[0].get("state") == "success":
            sha = dep["sha"]
            break
    else:
        return None, ["no successful production deployment found"]
    problems = []
    if json.loads(gh(f"repos/{REPO}/compare/{sha}...master")).get("status") not in ("identical", "ahead"):
        problems.append(f"deployed {sha[:9]} is not in master's history")
    for path, markers in DEPLOY_MARKERS.items():
        src = gh(f"repos/{REPO}/contents/{path}?ref={sha}", raw=True)
        problems += [f"deployed {path} lacks {m}" for m in markers if m not in src]
    return sha, problems


def migration_problems():
    cols = psql("select table_name || '.' || column_name from information_schema.columns where table_schema = 'public' "
                "and table_name in ('forge_player_game_strength', 'forge_team_game_strength') "
                "and column_name in ('shots_ps', 'goals_ps', 'penalty_shot_split_version') order by 1")
    fn = psql("select count(*) from pg_proc where pronamespace = 'public'::regnamespace "
              "and proname = 'persist_projection_game_derived_v2'")[0]
    problems = [] if len(cols) == 6 else [f"split columns present: {cols}"]
    return problems + ([] if fn == "1" else ["persist_projection_game_derived_v2 missing"])


def manifest_problems():
    rows = psql(f"select p.gameid || '|' || p.eventownerteamid || '|' || case when p.typedesckey = 'goal' then 'goal' "
                f"else 'save' end from pbp_plays p where p.gameid between {SEASON_FIRST} and {SEASON_LAST} "
                f"and p.typedesckey in ('goal', 'shot-on-goal') and {PS_WHERE} order by 1")
    want = sorted(f"{g}|{t}|{r}" for g, _d, t, r in MANIFEST)
    if rows != want:
        return [f"stored penalty shots {rows} != manifest {want}"]
    problems = []
    for g, d, _t, _r in MANIFEST:
        date = psql(f"select date::text from games where id = {g}")
        if date != [d]:
            problems.append(f"{g} scheduled {date}, manifest {d}")
    return problems


def rows_for(game_id):
    players = {}
    for line in psql(f"select to_jsonb(t) - 'created_at' - 'updated_at' from forge_player_game_strength t "
                     f"where game_id = {game_id}"):
        row = json.loads(line)
        players[row["player_id"]] = row
    teams = {}
    for line in psql(f"select to_jsonb(t) - 'created_at' - 'updated_at' from forge_team_game_strength t "
                     f"where game_id = {game_id}"):
        row = json.loads(line)
        teams[row["team_id"]] = row
    return {"players": players, "teams": teams}


def official_for(game_id):
    line = psql(f"select payload from nhl_api_game_payloads_raw where game_id = {game_id} and endpoint = 'boxscore' "
                f"order by fetched_at desc limit 1")
    if not line:
        return None
    return official_totals(json.loads(line[0]))


def call(game_id, date, secret):
    url = f"{ROUTE}?startDate={date}&gameId={game_id}&maxDurationMs=180000"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {secret}"})
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=SLOW_S) as resp:
            status, body = resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        stop(2, f"HTTP {e.code}", game=game_id)
    except Exception as e:  # timeout or network: the outcome is uncertain, so stop and read back by hand
        stop(5 if "timed out" in str(e) else 2, f"call failed: {type(e).__name__}", game=game_id)
    took = round(time.time() - started, 1)
    if (status != 200 or body.get("success") is not True or body.get("failures") or body.get("gamesVerified") != 1):
        stop(2, "route body not a clean single-game success", game=game_id, status=status,
             failures=body.get("failures"), gamesVerified=body.get("gamesVerified"))
    return took, body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true", help="write (only after TJ's approval)")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    log(event="start", mode="execute" if args.execute else "dry-run")

    guard()
    problems = migration_problems()
    if problems:
        stop(7, "migration not applied", problems=problems)
    try:
        sha, problems = deployment_problems()
    except Exception as e:  # gh missing, unauthenticated or unreachable: fail closed
        stop(7, f"deployment check failed: {e}")
    if problems:
        stop(7, "production deployment is not the F15 code", sha=sha, problems=problems)
    problems = manifest_problems()
    if problems:
        stop(6, "manifest mismatch", problems=problems)

    done = set(open(DONE).read().split()) if os.path.exists(DONE) else set()
    plan = planned_games(done)
    baseline = preflight(plan, done)
    for g, d in plan:
        log(event="planned_call", game=g, url=f"{ROUTE}?startDate={d}&gameId={g}&maxDurationMs=180000")
    if not args.execute:
        log(event="DRY_RUN_OK", sha=sha, games=len(plan), baseline_mismatches=[g for g, ok in baseline.items() if not ok])
        return

    secret = None
    for line in open(os.path.join(ROOT, "web/.env.local")):
        if line.startswith("CRON_SECRET="):
            secret = line.split("=", 1)[1].strip().strip('"')
    if not secret:
        stop(7, "CRON_SECRET missing from web/.env.local")

    for i, (g, d) in enumerate(plan):
        if i:
            time.sleep(PAUSE_S)
        window_gate(g)
        guard()
        window_gate(g)
        before = rows_for(g)
        write_evidence(evidence_path("before", g, "json"), json.dumps(before, sort_keys=True))
        took, body = call(g, d, secret)
        after = rows_for(g)
        write_evidence(evidence_path("after", g, "json"), json.dumps(after, sort_keys=True))
        problems = readback_problems(g, before, after, official_for(g), baseline[g])
        if problems:
            stop(6, "readback mismatch", game=g, problems=problems[:20])
        with open(DONE, "a") as f:
            f.write(f"{g}\n")
        log(event="game_done", game=g, seconds=took, rowsAffected=body.get("rowsAffected"),
            idempotent=body.get("gamesIdempotent"))

    final = []
    for g, _d, _t, _r in MANIFEST:
        rows, official = rows_for(g), official_for(g)
        if any(r.get("penalty_shot_split_version") != 1 for r in [*rows["players"].values(), *rows["teams"].values()]):
            final.append(f"{g} not fully split")
        # A game done in an earlier run was checked against the official record then (its baseline matched on
        # 2026-11-13), so it is held to the official record now.
        if baseline.get(g, True) and any(all_situation(r) != official.get(t) for t, r in rows["teams"].items()):
            final.append(f"{g} differs from the official record")
    if final:
        stop(6, "final readback mismatch", problems=final)
    log(event="DONE", games=len(MANIFEST))


if __name__ == "__main__":
    main()

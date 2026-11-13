#!/usr/bin/env python3
"""Team underlying-summary refresh for the 8 penalty-shot games (F15; decision 149, TJ's team spec).
NOT APPROVED. Default: a READ-ONLY DIFF (no summary write). --execute writes and needs TJ's approval of that diff.

TJ's spec: count each regulation or overtime penalty shot exactly once in all-situation totals, as a goal only if
scored, for the shooting team and against the other; exclude shootout attempts; ES/PP/PK unchanged.
team_underlying_stats_summary rows (game, team, strength, score_state) are mutable upserts with no version column.

Route: POST /api/v1/db/rebuild-team-underlying-summaries (admin; a dry run unless dryRun=false). A successful dry
run or diff writes nothing at all, not even a cron-audit row (isSuccessfulReadOnlyTeamSummaryRebuild); writes,
failures and non-2xx responses are audited:
  diff  : POST ?seasonId=20262027&gameIds=<8 ids>&diff=true       (1 call, strictly read-only; no dryRun param,
                                                                   so the route's default dry run applies)
  write : ?seasonId=20262027&gameIds=<id>&dryRun=false             (1 per game, only with --execute)

Fails closed, in this order:
  1. Read-only DB guard (<= 5 active queries, none older than 10 s; 60 s waits, at most 3).
  2. Windows: no call within 15 min of 08:00-08:20 or 09:25-11:40 UTC.
  3. Deployed code (read-only gh api): production is in master's history and carries the team penalty-shot
     builder (collectPenaltyShotAttempts), the gameIds/diff route (MAX_REBUILD_GAME_IDS) and the audit skip for a
     successful dry run (isSuccessfulReadOnlyTeamSummaryRebuild), so the diff never runs on code that audits it.
  4. Manifest: the stored play-by-play's penalty-shot attempts equal the 8 expected (game, shooting team, result).
  5. Diff call. Every difference must be the penalty shot and nothing else:
       - only strength allStrengths; no missing row and no stale key;
       - shooting team: cf +1, ff +1, sf +1, gf +goal; the other team: ca +1, fa +1, sa +1, ga +goal;
       - allScores carries it for both teams; exactly one of tied/leading/trailing per team; withinOne/upOne/
         downOne either carry it or are unchanged;
       - the rebuilt allScores SF and GF of both teams equal the stored official boxscore (shootout goal removed).
     Only games not yet in the done file are diffed (done games are reported, never re-diffed). Every diff is kept
     as run-unique evidence (run/team-diff-planned-<runstamp>-<seq>.json, opened "x"). The first accepted diff
     becomes run/team-diff-approved.json (the file TJ approves); it is never overwritten, and a later diff must
     equal it for the planned games (A3-02).
  --execute, per game: window, guard, window; re-diff that game and require it to equal the approved diff;
     before-snapshot and after-snapshot as run-unique files (run/team-before|after-<game>-<runstamp>-<seq>.json,
     opened "x"; the first before-file per game is the rollback authority); write call (rowsUpserted =
     rowsGenerated, staleKeyCount 0); readback: diff rows equal their rebuilt values, every other row unchanged;
     the game id goes to run/team-refresh.done (reruns skip it). 10 s between calls.
Never prints secrets: CRON_SECRET is read from web/.env.local into memory only.

Usage: python3 -I team-refresh.py               # read-only diff (after the release is live)
       python3 -I team-refresh.py --execute     # after TJ approves the diff
Exit codes: 0 diff OK / done, 2 HTTP or body failure, 3 DB guard, 4 window, 5 slow call,
            6 diff, manifest or readback mismatch, 7 deployment not ready.
"""
import argparse, glob, itertools, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = "/Users/tim/Code/fhfhockey.com"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "run")
DONE = os.path.join(OUT, "team-refresh.done")
APPROVED = os.path.join(OUT, "team-diff-approved.json")
ROUTE = "https://fhfhockey.com/api/v1/db/rebuild-team-underlying-summaries"
SEASON = 20262027
REPO = "FHFHockey-dev/fhfhockey.com"
PROD_ENV = "Production – fhfhockey"
DEPLOY_MARKERS = {
    "web/lib/underlying-stats/teamStatsSummaryRefresh.ts": ["collectPenaltyShotAttempts", "compareTeamSummaryRows"],
    "web/pages/api/v1/db/rebuild-team-underlying-summaries.ts": ["MAX_REBUILD_GAME_IDS", "reportDiffs: diff"],
    "web/lib/cron/withOperationalRouteAuth.ts": ["skipAuditWhenNoOp: isSuccessfulReadOnlyTeamSummaryRebuild"],
}
# (game, shooting team, result): pbp_plays read 2026-11-13; all in regulation.
MANIFEST = [
    (2026020065, 54, "goal"), (2026020094, 55, "save"), (2026020101, 18, "save"), (2026020119, 21, "save"),
    (2026020131, 18, "goal"), (2026020150, 12, "save"), (2026020159, 26, "save"), (2026020203, 16, "save"),
]
WINDOWS = [(480, 500, "08:00-08:20 UTC"), (565, 700, "09:25-11:40 UTC")]
CALL_MARGIN_MIN = 15
PAUSE_S = 10
SLOW_S = 240
PRIMARY = ("tied", "leading", "trailing")
IGNORED_COLUMNS = {"created_at", "updated_at"}
# Evidence files are never overwritten (Astra A3-02): run-unique names, opened "x".
RUN_STAMP = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + f"-{os.getpid()}"
_EVIDENCE_SEQ = itertools.count(1)
PS_WHERE = ("p.situationcode ~ '^[01][0-6][0-6][01]$' and (substr(p.situationcode, 2, 1) = '0' "
            "or substr(p.situationcode, 3, 1) = '0') and coalesce(p.periodtype, '') <> 'SO' "
            "and not ((p.gameid / 10000) % 100 in (1, 2) and coalesce(p.periodnumber, 0) >= 5)")


# ---------- pure helpers (tested in test_team_refresh.py) ----------

def official_totals(box):
    """{team_id: (sog, goals)} from a stored NHL boxscore; a shootout winner's score carries one extra goal."""
    so = (box.get("gameOutcome") or {}).get("lastPeriodType") == "SO"
    out = {}
    for team, other in ((box["homeTeam"], box["awayTeam"]), (box["awayTeam"], box["homeTeam"])):
        goals = int(team["score"]) - (1 if so and int(team["score"]) > int(other["score"]) else 0)
        out[int(team["id"])] = (int(team["sog"]), goals)
    return out


def expected_changes(team_id, shooter_team, result):
    goal = 1 if result == "goal" else 0
    if team_id == shooter_team:
        return {"cf": 1, "ff": 1, "sf": 1, **({"gf": 1} if goal else {})}
    return {"ca": 1, "fa": 1, "sa": 1, **({"ga": 1} if goal else {})}


def diff_problems(diffs, stale_keys, official_by_game, games=None):
    """Check a diff response against the manifest (or the planned subset of it).
    official_by_game: {game: {team: (sog, goals)}}."""
    problems = [f"stale keys: {stale_keys[:3]}"] if stale_keys else []
    by_game = {}
    for d in diffs:
        by_game.setdefault(d["game_id"], []).append(d)
    for game, shooter_team, result in (MANIFEST if games is None else games):
        rows = by_game.pop(game, [])
        official = official_by_game.get(game, {})
        teams = sorted(official) or sorted({d["team_id"] for d in rows})
        if len(teams) != 2:
            problems.append(f"{game}: teams {teams}")
            continue
        for team in teams:
            want = expected_changes(team, shooter_team, result)
            states = []
            for d in (r for r in rows if r["team_id"] == team):
                if d.get("missing"):
                    problems.append(f"{game}/{team} {d['strength']}/{d['score_state']}: stored row missing")
                    continue
                deltas = {c: v["rebuilt"] - v["stored"] for c, v in d["changes"].items()
                          if isinstance(v.get("rebuilt"), (int, float)) and isinstance(v.get("stored"), (int, float))}
                if d["strength"] != "allStrengths" or set(d["changes"]) != set(want) or deltas != want:
                    problems.append(f"{game}/{team} {d['strength']}/{d['score_state']}: {d['changes']} != {want}")
                    continue
                states.append(d["score_state"])
                if d["score_state"] == "allScores":
                    key = ("sf", "gf") if team == shooter_team else ("sa", "ga")
                    rebuilt = tuple(d["changes"][k]["rebuilt"] if k in d["changes"] else None for k in key)
                    if team == shooter_team and official.get(team):
                        sog, goals = official[team]
                        if rebuilt[0] != sog or (result == "goal" and rebuilt[1] != goals):
                            problems.append(f"{game}/{team}: rebuilt SF/GF {rebuilt} != official {official[team]}")
            if "allScores" not in states:
                problems.append(f"{game}/{team}: allStrengths/allScores does not gain the penalty shot")
            if len([s for s in states if s in PRIMARY]) != 1:
                problems.append(f"{game}/{team}: penalty shot in {[s for s in states if s in PRIMARY]} of tied/leading/trailing")
    for game, rows in by_game.items():
        problems.append(f"{game}: unexpected differences in a game without a penalty shot ({len(rows)} rows)")
    return problems


def readback_problems(before_rows, after_rows, game_diffs):
    """before/after: {key: row}; key = (team_id, strength, score_state). game_diffs: this game's approved diffs."""
    problems = []
    if set(before_rows) != set(after_rows):
        return [f"row keys changed: {sorted(set(before_rows) ^ set(after_rows))[:4]}"]
    changed = {(d["team_id"], d["strength"], d["score_state"]): d["changes"] for d in game_diffs}
    for key, before in before_rows.items():
        after = after_rows[key]
        for column in set(before) | set(after):
            if column in IGNORED_COLUMNS:
                continue
            want = changed.get(key, {}).get(column, {}).get("rebuilt", before.get(column))
            got = after.get(column)
            same = (abs(float(got) - float(want)) < 1e-6
                    if isinstance(got, (int, float)) and isinstance(want, (int, float)) else got == want)
            if not same:
                problems.append(f"{key} {column}: {before.get(column)} -> {got}, expected {want}")
    return problems


def evidence_path(kind, game_id, ext):
    """A run-unique evidence path, e.g. run/team-before-<game>-<runstamp>-<seq>.json."""
    return os.path.join(OUT, f"{kind}-{game_id}-{RUN_STAMP}-{next(_EVIDENCE_SEQ):02d}.{ext}")


def write_evidence(path, text):
    """Create the file; an existing file is never truncated (FileExistsError instead)."""
    with open(path, "x") as f:
        f.write(text)
    return path


def authority_file(kind, game_id, ext):
    """The first run-unique evidence file of this kind for the game (the authority, e.g. for rollback)."""
    files = sorted(glob.glob(os.path.join(OUT, f"{kind}-{game_id}-*.{ext}")))
    return files[0] if files else None


def planned_games(done):
    return [(g, t, r) for g, t, r in MANIFEST if str(g) not in done]


def diffs_for(diffs, game_ids):
    return [d for d in diffs if d["game_id"] in game_ids]


def record_diff(body, sha, official, plan):
    """Keep the diff as run-unique evidence; accept it only if it is exactly the planned games' penalty shots.
    The approved diff is created once and never overwritten: a later diff (for example on a resume) must equal
    it for the planned games, or the run stops. Returns the list of problems (empty when accepted)."""
    record = {"sha": sha, "body": body, "official": {str(k): v for k, v in official.items()},
              "planned": [g for g, _t, _r in plan]}
    path = write_evidence(evidence_path("team-diff", "planned", "json"), json.dumps(record, indent=1, sort_keys=True))
    problems = diff_problems(body.get("diffs", []), body.get("staleKeys", []), official, plan)
    if problems:
        return problems, path
    planned_ids = {g for g, _t, _r in plan}
    if os.path.exists(APPROVED):
        approved = json.load(open(APPROVED))["body"]["diffs"]
        if diffs_for(approved, planned_ids) != diffs_for(body.get("diffs", []), planned_ids):
            return ["diff differs from the approved diff for the planned games (approved file kept)"], path
    else:
        write_evidence(APPROVED, json.dumps(record, indent=1, sort_keys=True))
    return [], path


def window_at(minute_of_day, margin_min=0):
    for start, end, label in WINDOWS:
        if any(start <= (minute_of_day + k) % 1440 < end for k in range(margin_min + 1)):
            return label
    return None


# ---------- I/O ----------

def log(**kw):
    kw["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    line = json.dumps(kw)
    with open(os.path.join(OUT, "team-run.jsonl"), "a") as f:
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


def window_gate(tag):
    t = time.gmtime()
    w = window_at(t.tm_hour * 60 + t.tm_min, CALL_MARGIN_MIN)
    if w:
        stop(4, f"window within {CALL_MARGIN_MIN} min: {w}", at=tag)


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


def manifest_problems():
    rows = psql("select p.gameid || '|' || p.eventownerteamid || '|' || case when p.typedesckey = 'goal' then 'goal' "
                "else 'save' end from pbp_plays p where p.gameid between 2026010001 and 2026039999 "
                f"and p.typedesckey in ('goal', 'shot-on-goal', 'missed-shot') and {PS_WHERE} order by 1")
    want = sorted(f"{g}|{t}|{r}" for g, t, r in MANIFEST)
    return [] if rows == want else [f"stored penalty-shot attempts {rows} != manifest {want}"]


def official_for(game_id):
    line = psql(f"select payload from nhl_api_game_payloads_raw where game_id = {game_id} and endpoint = 'boxscore' "
                "order by fetched_at desc limit 1")
    return official_totals(json.loads(line[0])) if line else {}


def stored_rows(game_id):
    out = {}
    for line in psql(f"select to_jsonb(t)::text from team_underlying_stats_summary t where game_id = {game_id}"):
        row = json.loads(line)
        out[(row["team_id"], row["strength"], row["score_state"])] = row
    return out


def post(query, secret):
    req = urllib.request.Request(f"{ROUTE}?{urllib.parse.urlencode(query)}", data=b"", method="POST",
                                 headers={"Authorization": f"Bearer {secret}"})
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=SLOW_S) as resp:
            status, body = resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        stop(2, f"HTTP {e.code}", query=query)
    except Exception as e:  # timeout or network: the outcome is uncertain, so stop and read back by hand
        stop(5 if "timed out" in str(e) else 2, f"call failed: {type(e).__name__}", query=query)
    if status != 200 or body.get("success") is not True:
        stop(2, "route did not succeed", query=query, status=status, error=body.get("error"))
    return round(time.time() - started, 1), body


def read_secret():
    for line in open(os.path.join(ROOT, "web/.env.local")):
        if line.startswith("CRON_SECRET="):
            return line.split("=", 1)[1].strip().strip('"')
    stop(7, "CRON_SECRET missing from web/.env.local")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true", help="write (only after TJ approves the diff)")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    log(event="start", mode="execute" if args.execute else "diff")

    guard()
    try:
        sha, problems = deployment_problems()
    except Exception as e:  # gh missing, unauthenticated or unreachable: fail closed
        stop(7, f"deployment check failed: {e}")
    if problems:
        stop(7, "production deployment lacks the team penalty-shot builder or the diff route", sha=sha, problems=problems)
    problems = manifest_problems()
    if problems:
        stop(6, "manifest mismatch", problems=problems)
    secret = read_secret()
    official = {g: official_for(g) for g, _t, _r in MANIFEST}

    done = set(open(DONE).read().split()) if os.path.exists(DONE) else set()
    plan = planned_games(done)
    for g, _t, _r in MANIFEST:
        if str(g) in done:
            authority = authority_file("team-before", g, "json")
            log(event="already_done", game=g, authority_before=authority and os.path.relpath(authority, HERE))
    if not plan:
        log(event="DONE", games=len(MANIFEST), calls=0)
        return

    if not args.execute:
        window_gate("diff"); guard(); window_gate("diff")
        took, body = post({"seasonId": SEASON, "gameIds": ",".join(str(g) for g, _t, _r in plan), "diff": "true"}, secret)
        if body.get("dryRun") is not True or body.get("rowsUpserted") != 0 or body.get("diffsTruncated"):
            stop(2, "diff call was not a complete dry run", dryRun=body.get("dryRun"), truncated=body.get("diffsTruncated"))
        problems, path = record_diff(body, sha, official, plan)
        if problems:
            stop(6, "diff rejected", problems=problems[:20], file=os.path.relpath(path, HERE))
        log(event="DIFF_OK", sha=sha, seconds=took, games=[g for g, _t, _r in plan], rowsGenerated=body.get("rowsGenerated"),
            diffRowCount=body.get("diffRowCount"), file=os.path.relpath(path, HERE))
        return

    if not os.path.exists(APPROVED):
        stop(6, "no approved diff: run the read-only diff first and have it approved")
    approved = json.load(open(APPROVED))["body"]["diffs"]
    for i, (g, _t, _r) in enumerate(plan):
        if i:
            time.sleep(PAUSE_S)
        window_gate(g); guard(); window_gate(g)
        _took, body = post({"seasonId": SEASON, "gameIds": str(g), "diff": "true"}, secret)
        # The same check as diff mode: only a complete, read-only dry run can be compared (else exit 2,
        # before any snapshot or write).
        if body.get("dryRun") is not True or body.get("rowsUpserted") != 0 or body.get("diffsTruncated"):
            stop(2, "per-game diff call was not a complete dry run", game=g, dryRun=body.get("dryRun"),
                 rowsUpserted=body.get("rowsUpserted"), truncated=body.get("diffsTruncated"))
        # Compared with the ORIGINAL approved diff (team-diff-approved.json is never rewritten).
        game_diffs = [d for d in approved if d["game_id"] == g]
        if body.get("diffs") != game_diffs or body.get("staleKeys"):
            stop(6, "this game's diff differs from the approved diff", game=g)
        before = stored_rows(g)
        write_evidence(evidence_path("team-before", g, "json"), json.dumps([before[k] for k in sorted(before)], sort_keys=True))
        time.sleep(PAUSE_S)
        window_gate(g); guard(); window_gate(g)
        took, body = post({"seasonId": SEASON, "gameIds": str(g), "dryRun": "false"}, secret)
        if body.get("dryRun") is not False or body.get("rowsUpserted") != body.get("rowsGenerated") or body.get("staleKeyCount"):
            stop(6, "write response mismatch", game=g, rowsUpserted=body.get("rowsUpserted"),
                 rowsGenerated=body.get("rowsGenerated"), staleKeyCount=body.get("staleKeyCount"))
        after = stored_rows(g)
        write_evidence(evidence_path("team-after", g, "json"), json.dumps([after[k] for k in sorted(after)], sort_keys=True))
        problems = readback_problems(before, after, game_diffs)
        if problems:
            stop(6, "team summary readback mismatch", game=g, problems=problems[:20])
        with open(DONE, "a") as f:
            f.write(f"{g}\n")
        log(event="game_done", game=g, seconds=took, rowsUpserted=body.get("rowsUpserted"), changedRows=len(game_diffs))
    log(event="DONE", games=len(MANIFEST), calls=2 * len(plan))


if __name__ == "__main__":
    main()

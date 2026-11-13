#!/usr/bin/env python3
"""Underlying-stats summary refresh for the 8 penalty-shot games (F15; decision 149, Astra AF-07).
NOT APPROVED: --execute only on TJ's explicit approval. The default is a read-only DRY RUN.

8a4a7d8d1 makes NST parity "all" count penalty shots (individual goals/shots/iCF/iFF and the goalie's shots
against/saves/goals against), in no strength split, on-ice stat or xG. The underlying-stats landing reads
stored per-game summary partitions, so these 8 games show the old "all" until their summaries are rebuilt:
  player partitions: nhl_api_game_payloads_raw, endpoint 'landing', source_url
                     derived://underlying-player-summary-v2/<mode>/<strength>/[<scoreState>/]<gameId>
                     (append-only; readers take the newest row per source_url)
  goalie partitions: goalie_underlying_summary_partitions, keyed (game_id, strength, score_state) (upsert)
Team underlying summaries are built from shot features, which still exclude penalty shots, so they would not
change and are not refreshed here (a separate decision-149 gap; see SUMMARY-REFRESH.md).

Per game, two calls (16 in all), sequential, 10 s apart, DB-side only (no NHL, NST or Yahoo request):
  GET /api/v1/db/update-player-underlying-summaries?gameId=<id>&seasonId=20262027&gameType=2
  GET /api/v1/db/update-goalie-underlying-summaries?gameId=<id>&seasonId=20262027&gameType=2
Both run in "game" mode: no backfill, no legacy migration, no shared-seed reuse, no landing-cache warm.

Fails closed, in this order:
  1. Read-only DB guard: at most 5 active queries, none older than 10 s (waits 60 s, at most 3 times).
  2. Windows: no call within 15 min of 08:00-08:20 or 09:25-11:40 UTC.
  3. Deployed code (read-only gh api): the production deployment is in master's history, carries the parity
     fix (includeInAllSituationsOnly) and keeps PLAYER_STATS_SUMMARY_FORMULA_REVISION = 2.
  4. Manifest: the stored play-by-play's penalty-shot attempts equal the 8 expected (game, shooter, goalie,
     result) exactly.
  5. Before-snapshot (read-only) of every player partition head and goalie partition row of each game, saved
     to run/summary-before-<game>.jsonl; every head is version 1 / formula revision 2. The dry run prints each
     shooter's and goalie's current "all" line and the expected one.
  --dry-run (default) stops here.
  6. --execute, per game: window, guard, window; fresh before-snapshot; player call; readback; goalie call;
     readback; the game id goes to run/summary-refresh.done (a rerun skips it).
Readback, key by key (exit 6 on any difference):
  - the same partition set; every player head is new (fetched_at later than before) with formula revision 2;
  - allStrengths, allScores: the shooter's individual goals/shots/iCf/iFf and the goalie's shotsAgainst/saves/
    goalsAgainst move by exactly the penalty shot; every other metric of every row is unchanged;
  - allStrengths score states: exactly one of tied/leading/trailing carries the same move; any other score
    state either carries it or is unchanged;
  - every other strength and the onIce mode: every row's metrics unchanged.
Route checks: HTTP 200, success true, mode "game", gameIds [game], rowsUpserted = partitions in the snapshot.
A stop after a call leaves the new rows in place: review before rolling back (SUMMARY-REFRESH.md, Rollback).
Never prints secrets: CRON_SECRET is read from web/.env.local into memory only.

Usage: python3 -I summary-refresh.py                            # dry run, read-only
       python3 -I summary-refresh.py --execute --max-games 1    # after approval: one game, then review
       python3 -I summary-refresh.py --execute                  # the remaining games
Exit codes: 0 done / dry run passed, 2 HTTP or body failure, 3 DB guard, 4 window, 5 slow call,
            6 readback or manifest mismatch, 7 deployment not ready.
"""
import argparse, copy, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = "/Users/tim/Code/fhfhockey.com"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "run")
DONE = os.path.join(OUT, "summary-refresh.done")
PRODUCTION = "https://fhfhockey.com"
PLAYER_ROUTE = PRODUCTION + "/api/v1/db/update-player-underlying-summaries"
GOALIE_ROUTE = PRODUCTION + "/api/v1/db/update-goalie-underlying-summaries"
SEASON, GAME_TYPE = 20262027, 2
PREFIX = "derived://underlying-player-summary-v2/"
FORMULA_REVISION, PAYLOAD_VERSION = 2, 1
REPO = "FHFHockey-dev/fhfhockey.com"
PROD_ENV = "Production – fhfhockey"
DEPLOY_MARKERS = {
    "web/lib/supabase/Upserts/nhlEventInclusion.ts": ["includeInAllSituationsOnly"],
    "web/lib/supabase/Upserts/nhlNstParityMetrics.ts": ["allSituationsOnly"],
    "web/lib/underlying-stats/playerStatsLandingServer.ts": ["PLAYER_STATS_SUMMARY_FORMULA_REVISION = 2;"],
}
# (game, shooter, goalie in net, result): pbp_plays read 2026-11-13; all regulation, none in a shootout.
MANIFEST = [
    (2026020065, 8478403, 8475683, "goal"),
    (2026020094, 8474586, 8478435, "save"),
    (2026020101, 8480835, 8478499, "save"),
    (2026020119, 8477492, 8481668, "save"),
    (2026020131, 8476539, 8476412, "goal"),
    (2026020150, 8478427, 8482447, "save"),
    (2026020159, 8477960, 8473575, "save"),
    (2026020203, 8483493, 8476434, "save"),
]
WINDOWS = [(480, 500, "08:00-08:20 UTC"), (565, 700, "09:25-11:40 UTC")]
CALL_MARGIN_MIN = 15
PAUSE_S = 10
SLOW_S = 240
PRIMARY_SCORE_STATES = ("tied", "leading", "trailing")
PS_WHERE = ("p.situationcode ~ '^[01][0-6][0-6][01]$' and (substr(p.situationcode, 2, 1) = '0' "
            "or substr(p.situationcode, 3, 1) = '0') and coalesce(p.periodtype, '') <> 'SO' "
            "and not ((p.gameid / 10000) % 100 in (1, 2) and coalesce(p.periodnumber, 0) >= 5)")


# ---------- pure helpers (tested in test_summary_refresh.py) ----------

def parse_partition(source_url):
    """(mode, strength, scoreState) of a player partition source_url, or None."""
    if not source_url.startswith(PREFIX):
        return None
    parts = source_url[len(PREFIX):].split("/")
    if len(parts) == 3:
        return parts[0], parts[1], "allScores"
    if len(parts) == 4:
        return parts[0], parts[1], parts[2]
    return None


def expected_move(mode, result):
    """{metric group: {field: delta}} a penalty shot adds to the shooter (individual) or goalie (goalies)."""
    goal = 1 if result == "goal" else 0
    if mode == "individual":
        return {"individual": {"goals": goal, "shots": 1, "iCf": 1, "iFf": 1}}
    if mode == "goalies":
        return {"goalies": {"shotsAgainst": 1, "saves": 1 - goal, "goalsAgainst": goal}}
    return {}


def _rows_by_player(payload):
    return {row["playerId"]: row.get("metrics") for row in payload.get("rows", [])}


def apply_move(metrics, move):
    moved = copy.deepcopy(metrics)
    for group, fields in move.items():
        for field, delta in fields.items():
            moved[group][field] = (moved[group].get(field) or 0) + delta
    return moved


def classify_partition_change(before, after, mode, subject, result):
    """'unchanged', 'moved' (only the subject's row moved by exactly the penalty shot) or a problem string."""
    b, a = _rows_by_player(before), _rows_by_player(after)
    if set(b) != set(a):
        return f"row keys differ: -{sorted(set(b) - set(a))} +{sorted(set(a) - set(b))}"
    others = [pid for pid in b if pid != subject and b[pid] != a[pid]]
    if others:
        return f"metrics changed for players {others[:5]}"
    if subject not in b or b[subject] == a[subject]:
        return "unchanged"
    move = expected_move(mode, result)
    if move and apply_move(b[subject], move) == a[subject]:
        return "moved"
    return f"player {subject} changed by something other than the penalty shot"


def partition_problems(before_heads, after_heads, shooter, goalie, result):
    """Readback of one game's player partitions. heads: {source_url: payload}."""
    problems = []
    if set(before_heads) != set(after_heads):
        return [f"partition set differs: -{sorted(set(before_heads) - set(after_heads))[:3]} "
                f"+{sorted(set(after_heads) - set(before_heads))[:3]}"]
    moved_states = {"individual": [], "goalies": []}
    for url, before in before_heads.items():
        after = after_heads[url]
        mode, strength, score_state = parse_partition(url)
        if after.get("version") != PAYLOAD_VERSION or after.get("formulaRevision") != FORMULA_REVISION:
            problems.append(f"{url}: version {after.get('version')} / revision {after.get('formulaRevision')}")
        subject = shooter if mode == "individual" else goalie if mode == "goalies" else None
        may_move = strength == "allStrengths" and subject is not None
        verdict = classify_partition_change(before, after, mode, subject, result)
        if verdict == "moved" and may_move:
            moved_states[mode].append(score_state)
        elif verdict != "unchanged":
            problems.append(f"{url}: {verdict if verdict != 'moved' else 'moved outside allStrengths'}")
    for mode, states in moved_states.items():
        if "allScores" not in states:
            problems.append(f"{mode}/allStrengths/allScores did not gain the penalty shot")
        primary = [s for s in states if s in PRIMARY_SCORE_STATES]
        if len(primary) != 1:
            problems.append(f"{mode}/allStrengths: penalty shot in {primary or 'none'} of tied/leading/trailing")
    return problems


def goalie_table_problems(before_rows, after_rows, goalie, result):
    """Readback of goalie_underlying_summary_partitions. rows: {(strength, score_state): payload}."""
    problems = []
    if set(before_rows) != set(after_rows):
        return [f"goalie partition keys differ: {sorted(set(before_rows) ^ set(after_rows))[:4]}"]
    moved = []
    for key, before in before_rows.items():
        after = after_rows[key]
        if after.get("formulaRevision") != FORMULA_REVISION:
            problems.append(f"goalie {key}: revision {after.get('formulaRevision')}")
        verdict = classify_partition_change(before, after, "goalies", goalie, result)
        if verdict == "moved" and key[0] == "allStrengths":
            moved.append(key[1])
        elif verdict != "unchanged":
            problems.append(f"goalie {key}: {verdict if verdict != 'moved' else 'moved outside allStrengths'}")
    if "allScores" not in moved:
        problems.append("goalie allStrengths/allScores did not gain the penalty shot")
    if len([s for s in moved if s in PRIMARY_SCORE_STATES]) != 1:
        problems.append(f"goalie penalty shot in {moved} of tied/leading/trailing")
    return problems


def window_at(minute_of_day, margin_min=0):
    for start, end, label in WINDOWS:
        if any(start <= (minute_of_day + k) % 1440 < end for k in range(margin_min + 1)):
            return label
    return None


# ---------- I/O ----------

def log(**kw):
    kw["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    line = json.dumps(kw)
    with open(os.path.join(OUT, "summary-run.jsonl"), "a") as f:
        f.write(line + "\n")
    print(line, flush=True)


def stop(code, reason, **kw):
    log(event="STOP", code=code, reason=reason, **kw)
    sys.exit(code)


def psql(sql, timeout_ms=8000):
    env = dict(os.environ, PGOPTIONS=f"-c statement_timeout={timeout_ms} -c default_transaction_read_only=on")
    r = subprocess.run([os.path.join(os.environ["TMPDIR"], "pgpool.sh"), "-At", "-c", sql],
                       capture_output=True, text=True, env=env, timeout=120)
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
        stop(4, f"window within {CALL_MARGIN_MIN} min: {w}", resume_from=game_id)


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
    rows = psql("select p.gameid || '|' || coalesce(p.shootingplayerid, p.scoringplayerid) || '|' || p.goalieinnetid "
                "|| '|' || case when p.typedesckey = 'goal' then 'goal' else 'save' end from pbp_plays p "
                "where p.gameid between 2026010001 and 2026039999 and p.typedesckey in ('goal', 'shot-on-goal', "
                f"'missed-shot') and {PS_WHERE} order by 1")
    want = sorted(f"{g}|{s}|{k}|{r}" for g, s, k, r in MANIFEST)
    return [] if rows == want else [f"stored penalty-shot attempts {rows} != manifest {want}"]


def player_heads(game_id):
    lines = psql("select json_build_object('u', source_url, 'f', fetched_at, 'p', payload)::text from ("
                 "select distinct on (source_url) source_url, fetched_at, payload from nhl_api_game_payloads_raw "
                 f"where endpoint = 'landing' and game_id = {game_id} and source_url like '{PREFIX}%' "
                 "order by source_url, fetched_at desc, id desc) h", timeout_ms=30000)
    return {row["u"]: row for row in map(json.loads, lines)}


def goalie_rows(game_id):
    lines = psql("select json_build_object('s', strength, 'c', score_state, 'f', fetched_at, 'p', payload)::text "
                 f"from goalie_underlying_summary_partitions where game_id = {game_id}", timeout_ms=30000)
    return {(row["s"], row["c"]): row for row in map(json.loads, lines)}


def snapshot(game_id, tag):
    heads, goalies = player_heads(game_id), goalie_rows(game_id)
    with open(os.path.join(OUT, f"summary-{tag}-{game_id}.jsonl"), "w") as f:
        for url in sorted(heads):
            f.write(json.dumps({"table": "nhl_api_game_payloads_raw", **heads[url]}, sort_keys=True) + "\n")
        for key in sorted(goalies):
            f.write(json.dumps({"table": "goalie_underlying_summary_partitions", **goalies[key]}, sort_keys=True) + "\n")
    return heads, goalies


def line_of(heads, mode, subject):
    payload = heads.get(f"{PREFIX}{mode}/allStrengths/{subject[0]}", {}).get("p", {})
    for row in payload.get("rows", []):
        if row.get("playerId") == subject[1]:
            group = "individual" if mode == "individual" else "goalies"
            return {k: row["metrics"][group].get(k) for k in expected_move(mode, "goal")[group]}
    return None


def call(route, game_id, secret):
    url = f"{route}?gameId={game_id}&seasonId={SEASON}&gameType={GAME_TYPE}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {secret}"})
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=SLOW_S) as resp:
            status, body = resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        stop(2, f"HTTP {e.code}", route=route, game=game_id)
    except Exception as e:  # timeout or network: the outcome is uncertain, so stop and read back by hand
        stop(5 if "timed out" in str(e) else 2, f"call failed: {type(e).__name__}", route=route, game=game_id)
    if status != 200 or body.get("success") is not True or body.get("mode") != "game" or body.get("gameIds") != [game_id]:
        stop(2, "route body is not a clean single-game success", route=route, game=game_id, status=status,
             mode=body.get("mode"), gameIds=body.get("gameIds"), error=body.get("error"))
    return round(time.time() - started, 1), body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true", help="write (only after TJ's approval)")
    ap.add_argument("--max-games", type=int, default=len(MANIFEST),
                    help="refresh at most this many not-yet-done games (first live run: 1, then review)")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    log(event="start", mode="execute" if args.execute else "dry-run")

    guard()
    try:
        sha, problems = deployment_problems()
    except Exception as e:  # gh missing, unauthenticated or unreachable: fail closed
        stop(7, f"deployment check failed: {e}")
    if problems:
        stop(7, "production deployment lacks the parity fix or the formula revision changed", sha=sha, problems=problems)
    problems = manifest_problems()
    if problems:
        stop(6, "manifest mismatch", problems=problems)

    for g, shooter, goalie, result in MANIFEST:
        heads, goalies = snapshot(g, "before")
        stale = [u for u, h in heads.items() if h["p"].get("version") != PAYLOAD_VERSION
                 or h["p"].get("formulaRevision") != FORMULA_REVISION]
        if not heads or not goalies or stale:
            stop(6, "game lacks current summaries", game=g, heads=len(heads), goalie_rows=len(goalies), stale=stale[:5])
        now_s, now_g = line_of(heads, "individual", (g, shooter)), line_of(heads, "goalies", (g, goalie))
        log(event="baseline", game=g, partitions=len(heads), goalie_rows=len(goalies),
            shooter=shooter, shooter_all_now=now_s,
            shooter_all_expected=now_s and {k: now_s[k] + d for k, d in expected_move("individual", result)["individual"].items()},
            goalie=goalie, goalie_all_now=now_g,
            goalie_all_expected=now_g and {k: now_g[k] + d for k, d in expected_move("goalies", result)["goalies"].items()})

    done = set(open(DONE).read().split()) if os.path.exists(DONE) else set()
    plan = [m for m in MANIFEST if str(m[0]) not in done][: max(0, args.max_games)]
    if not args.execute:
        log(event="DRY_RUN_OK", sha=sha, games=len(plan), calls=2 * len(plan))
        return

    secret = None
    for line in open(os.path.join(ROOT, "web/.env.local")):
        if line.startswith("CRON_SECRET="):
            secret = line.split("=", 1)[1].strip().strip('"')
    if not secret:
        stop(7, "CRON_SECRET missing from web/.env.local")

    for i, (g, shooter, goalie, result) in enumerate(plan):
        if i:
            time.sleep(PAUSE_S)
        window_gate(g); guard(); window_gate(g)
        before_heads, before_goalies = snapshot(g, "before")
        took, body = call(PLAYER_ROUTE, g, secret)
        if body.get("rowsUpserted") != len(before_heads):
            stop(6, "player rowsUpserted != partitions", game=g, rowsUpserted=body.get("rowsUpserted"), partitions=len(before_heads))
        after_heads = player_heads(g)
        stale = [u for u in after_heads if before_heads.get(u) and after_heads[u]["f"] <= before_heads[u]["f"]]
        problems = ([f"{len(stale)} partitions not rewritten"] if stale else []) + partition_problems(
            {u: h["p"] for u, h in before_heads.items()}, {u: h["p"] for u, h in after_heads.items()}, shooter, goalie, result)
        if problems:
            stop(6, "player summary readback mismatch", game=g, problems=problems[:20])
        log(event="player_done", game=g, seconds=took, rowsUpserted=body.get("rowsUpserted"))

        time.sleep(PAUSE_S)
        window_gate(g); guard(); window_gate(g)
        took, body = call(GOALIE_ROUTE, g, secret)
        if body.get("rowsUpserted") != len(before_goalies):
            stop(6, "goalie rowsUpserted != partitions", game=g, rowsUpserted=body.get("rowsUpserted"), partitions=len(before_goalies))
        after_goalies = goalie_rows(g)
        snapshot(g, "after")
        problems = goalie_table_problems({k: r["p"] for k, r in before_goalies.items()},
                                         {k: r["p"] for k, r in after_goalies.items()}, goalie, result)
        if problems:
            stop(6, "goalie summary readback mismatch", game=g, problems=problems[:20])
        with open(DONE, "a") as f:
            f.write(f"{g}\n")
        log(event="game_done", game=g, goalie_seconds=took, shooter_all=line_of(after_heads, "individual", (g, shooter)))
    finished = set(open(DONE).read().split()) if os.path.exists(DONE) else set()
    remaining = [m[0] for m in MANIFEST if str(m[0]) not in finished]
    log(event="DONE" if not remaining else "BATCH_DONE", games_this_run=len(plan), calls=2 * len(plan), remaining=remaining)


if __name__ == "__main__":
    main()

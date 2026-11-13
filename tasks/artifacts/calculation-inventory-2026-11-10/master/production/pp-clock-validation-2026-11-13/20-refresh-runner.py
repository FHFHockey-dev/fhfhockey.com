#!/usr/bin/env python3
"""Decision 152 refresh runner (math-audit follow-up lane F11). NOT RUN: the write phase needs TJ's approval.

Scope: the frozen 2026-27 regular-season list in results/after-d152/refresh-batches-2026-27-regular.json (309 games,
618 team-games, 31 batches of at most 10), checked against BATCHES_SHA256 below.

Target: a deployment of the reviewed writer (update-power-play-combinations/index.ts and [gameId].ts at the reviewed
commit, Part A registry included). For the write phase, migration 20261113220000 must be applied first and the target must run with
PP_STORED_CALCULATION_WRITES_ENABLED=true (otherwise every call answers as a skip and the runner stops at batch 1).

  dry:   python3 -I 20-refresh-runner.py dry --base-url URL --out DIR
         Every batch with dryRun=true&concurrency=1, one call at a time, at least 5 s apart, hygiene gate before
         each. Saves DIR/dry-run.json (all responses: every game's clock rows, computed rows and diff) and prints its
         sha256, then checks it against the Part B expectation: exactly the 16 team-games change (15 deletes, the
         23 PP-time/share updates, 5 inserts; other field changes only inside those 16), 618 clock rows, all
         qualified, clock seconds as in results/after-c1-c2, 9 not applicable and 609 available. Anything else exits 4.
  write: python3 -I 20-refresh-runner.py write --base-url URL --dry-run DIR/dry-run.json --dry-run-sha256 HEX
         [--start-batch N]
         Only after TJ approves that dry-run file by its hash. Same batches, concurrency=1, at least 5 s apart,
         hygiene gate before each call and each readback. After each call it reads the batch's powerPlayCombinations
         and pp_team_game_clock rows back (bounded psql through $TMPDIR/pgpool.sh) and compares them with the dry
         run: same rows, same values, same clock availability, calculation_version set. It stops on the first
         mismatch and prints the resume point (--start-batch).

Bounds: concurrency 1; the only HTTP calls are to --base-url (never an NHL or NST host); any non-200, any call over
60 s, a failed or skipped game, or a busy database (hygiene.sh exit 3) stops the run. Authorization: the bearer
value is read from FHFH_ROUTE_BEARER (cron secret or an admin access token) and never printed; a local dev server
on loopback needs none. A dry run writes nothing at all: a complete, successful dryRun response skips even the
route's cron_job_audit row (a failed dry run keeps it). Each write call keeps its audit row.
"""
import argparse
import csv
import hashlib
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
BATCHES_FILE = RESULTS / "after-d152" / "refresh-batches-2026-27-regular.json"
BATCHES_SHA256 = "c2c287aa09d5078f5fd472b4e6dc655743c1c658589874699e9678dbc020a5c4"
CALCULATION_VERSION = "pp-shifts-qualified-clock-v1"
ROUTE = "/api/v1/db/update-power-play-combinations"
MIN_GAP_S = 5
CALL_LIMIT_S = 60
FORBIDDEN_HOSTS = ("nhl.com", "nhle.com", "naturalstattrick.com")
FLOAT_FIELDS = ("percentageOfPP", "pp_unit_usage_index", "pp_vs_unit_avg", "pp_share_of_team")
INT_FIELDS = ("unit", "PPTOI", "pp_unit_relative_toi")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def stop(code, message):
    print(f"STOP: {message}", file=sys.stderr)
    sys.exit(code)


def load_batches():
    if sha256(BATCHES_FILE) != BATCHES_SHA256:
        stop(2, f"{BATCHES_FILE.name} does not match its frozen sha256")
    doc = json.loads(BATCHES_FILE.read_text())
    if doc["games"] != 309 or sum(len(b) for b in doc["batches"]) != 309 or max(len(b) for b in doc["batches"]) > 10:
        stop(2, "frozen batch list is not 309 games in batches of at most 10")
    return doc["batches"]


def hygiene():
    if subprocess.run([str(HERE / "hygiene.sh")]).returncode != 0:
        stop(3, "database busy or unreachable (hygiene.sh); nothing more was sent")


class Pacer:
    def __init__(self):
        self.last = None

    def wait(self):
        if self.last is not None:
            gap = MIN_GAP_S - (time.monotonic() - self.last)
            if gap > 0:
                time.sleep(gap)

    def done(self):
        self.last = time.monotonic()


def call_route(base_url, game_ids, dry_run):
    host = urllib.parse.urlparse(base_url).hostname or ""
    if any(host == h or host.endswith("." + h) for h in FORBIDDEN_HOSTS):
        stop(2, "the target must be an FHFH deployment, never a provider host")
    query = {"gameIds": ",".join(str(g) for g in game_ids), "concurrency": "1"}
    if dry_run:
        query["dryRun"] = "true"
    request = urllib.request.Request(f"{base_url.rstrip('/')}{ROUTE}?{urllib.parse.urlencode(query)}")
    bearer = os.environ.get("FHFH_ROUTE_BEARER")
    if bearer:
        request.add_header("Authorization", f"Bearer {bearer}")
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=CALL_LIMIT_S) as response:
            status, body = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, body = error.code, error.read()
    except Exception as error:  # timeout or connection failure: the batch's state is unknown
        stop(5, f"call for games {game_ids[0]}..{game_ids[-1]} did not complete ({type(error).__name__}); "
                "read the batch back before resuming")
    elapsed = time.monotonic() - started
    if elapsed > CALL_LIMIT_S:
        stop(5, f"call took {elapsed:.1f} s (limit {CALL_LIMIT_S} s); read the batch back before resuming")
    try:
        payload = json.loads(body)
    except ValueError:
        payload = {"unparsed": body[:500].decode("utf-8", "replace")}
    if status != 200:
        stop(5, f"HTTP {status} for games {game_ids[0]}..{game_ids[-1]}: {payload.get('message', payload)}")
    if not payload.get("success") or payload.get("processed") != len(game_ids) or payload.get("failed") or \
            payload.get("skipped") or sorted(payload.get("gameIds", [])) != sorted(game_ids):
        stop(5, f"games {game_ids[0]}..{game_ids[-1]} not all processed: {payload.get('message')}")
    if dry_run and (payload.get("dryRun") is not True or
                    sorted(g["gameId"] for g in payload.get("games", [])) != sorted(game_ids)):
        stop(5, f"dry-run response for games {game_ids[0]}..{game_ids[-1]} lacks a game's diff")
    return {"status": status, "elapsedS": round(elapsed, 2), "response": payload}


def expectations():
    """The Part B result (REPORT section 11.1) this dry run must reproduce exactly."""
    clocks = {}
    for r in csv.DictReader(open(RESULTS / "after-c1-c2" / "team-game-results.csv")):
        if r["season_id"] == "20262027" and r["game_type"] == "2":
            clocks[(int(r["game_id"]), int(r["team_id"]))] = int(r["sim_s"])
    changing = {(int(t["game_id"]), int(t["team_id"]))
                for t in csv.DictReader(open(RESULTS / "after-d152" / "numerator-team-games.csv"))
                if t["team_game_agrees"] != "true"}
    team_of, deletes, inserts, pp_updates = {}, {}, {}, {}
    for r in csv.DictReader(open(RESULTS / "after-d152" / "numerator-rows-disagreeing-team-games.csv")):
        key = (int(r["game_id"]), int(r["player_id"]))
        team_of[key] = int(r["team_id"])
        if r["stored_pptoi"] == "":
            inserts[key] = int(r["computed_pptoi"])
        elif int(r["computed_pptoi"]) == 0:
            deletes[key] = int(r["stored_pptoi"])
        elif r["agree_within_2s"] != "true":
            pp_updates[key] = int(r["computed_pptoi"])
    counts = (len(clocks), len(changing), len(deletes), len(pp_updates), len(inserts))
    if counts != (618, 16, 15, 23, 5):
        stop(2, f"committed expectation files give {counts}, not (618, 16, 15, 23, 5)")
    return clocks, changing, team_of, deletes, inserts, pp_updates


def check_dry_run(calls):
    clocks, changing, team_of, deletes, inserts, pp_updates = expectations()
    problems = []
    seen_clock, got_deletes, got_inserts, got_pp, other = {}, {}, {}, {}, []
    for call in calls:
        for game in call["response"]["games"]:
            g = game["gameId"]
            for clock in game["clock"]:
                seen_clock[(g, clock["team_id"])] = clock
            for row in game["rows"]:
                team_of.setdefault((g, row["playerId"]), row["team_id"])
            for row in game["diff"]["deleted"]:
                got_deletes[(g, row["playerId"])] = row["PPTOI"]
            for row in game["diff"]["inserted"]:
                got_inserts[(g, row["playerId"])] = row["PPTOI"]
            for row in game["diff"]["updated"]:
                key, changes = (g, row["playerId"]), row["changes"]
                if "PPTOI" in changes or "pp_share_of_team" in changes:
                    got_pp[key] = changes.get("PPTOI", {}).get("after")
                else:
                    other.append(key)
    if set(seen_clock) != set(clocks):
        problems.append(f"clock rows for {len(seen_clock)} team-games, expected the 618 frozen ones")
    for key, clock in sorted(seen_clock.items()):
        want = clocks.get(key)
        state = "not_applicable" if want == 0 else "available"
        if not clock.get("qualified") or clock.get("clock_seconds") != want or clock.get("availability") != state:
            problems.append(f"clock {key}: {clock.get('availability')} {clock.get('clock_seconds')} s "
                            f"({clock.get('unavailable_reason')}); expected {state} {want} s")
    if got_deletes != deletes:
        problems.append(f"deletes differ: unexpected {sorted(set(got_deletes) - set(deletes))}, "
                        f"missing {sorted(set(deletes) - set(got_deletes))}")
    if got_inserts != inserts:
        problems.append(f"inserts differ: got {sorted(got_inserts.items())}, expected {sorted(inserts.items())}")
    if set(got_pp) != set(pp_updates) or any(after not in (None, pp_updates[k]) for k, after in got_pp.items()):
        problems.append(f"PP time/share updates differ: unexpected {sorted(set(got_pp) - set(pp_updates))}, "
                        f"missing {sorted(set(pp_updates) - set(got_pp))}, "
                        f"wrong values {sorted(k for k, a in got_pp.items() if k in pp_updates and a not in (None, pp_updates[k]))}")
    touched = set()
    for key in [*got_deletes, *got_inserts, *got_pp, *other]:
        team = team_of.get(key)
        if team is None or (key[0], team) not in changing:
            problems.append(f"change outside the 16 team-games: game {key[0]} player {key[1]} team {team}")
        else:
            touched.add((key[0], team))
    if touched != changing:
        problems.append(f"team-games that should change but didn't: {sorted(changing - touched)}")
    summary = {
        "clockRows": len(seen_clock),
        "available": sum(c.get("availability") == "available" for c in seen_clock.values()),
        "notApplicable": sum(c.get("availability") == "not_applicable" for c in seen_clock.values()),
        "unavailable": sum(c.get("availability") == "unavailable" for c in seen_clock.values()),
        "teamGamesChanged": len(touched), "deleted": len(got_deletes), "ppUpdated": len(got_pp),
        "otherUpdated": len(other), "inserted": len(got_inserts),
    }
    return problems, summary


def run_dry(args):
    batches = load_batches()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    pacer, calls = Pacer(), []
    for index, batch in enumerate(batches, start=1):
        hygiene()
        pacer.wait()
        result = call_route(args.base_url, batch, dry_run=True)
        pacer.done()
        calls.append({"batch": index, "gameIds": batch, **result})
        print(f"dry batch {index}/{len(batches)}: games {batch[0]}..{batch[-1]} {result['elapsedS']} s "
              f"{result['response']['totals']}")
    problems, summary = check_dry_run(calls)
    doc = {"runner": "20-refresh-runner.py", "phase": "dry", "batchesSha256": BATCHES_SHA256,
           "calculationVersion": CALCULATION_VERSION, "target": urllib.parse.urlparse(args.base_url).netloc,
           "finishedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "gate": {"passed": not problems, "problems": problems, "summary": summary}, "calls": calls}
    path = out / "dry-run.json"
    path.write_text(json.dumps(doc, indent=1) + "\n")
    print(json.dumps(doc["gate"], indent=1))
    print(f"dry-run file {path} sha256 {sha256(path)}")
    if problems:
        stop(4, "the dry run does not match the expected diff; nothing may be written")


def psql_csv(sql):
    pgpool = Path(os.environ.get("TMPDIR", "/tmp")) / "pgpool.sh"
    result = subprocess.run([str(pgpool), "-q", "-c", "set statement_timeout = '10s'", "-c", f"\\copy ({sql}) to stdout with csv header"],
                            capture_output=True, text=True)
    if result.returncode != 0:
        stop(5, f"readback query failed: {result.stderr.strip()[:300]}")
    return list(csv.DictReader(io.StringIO(result.stdout)))


def same(a, b):
    if a in (None, "") or b in (None, ""):
        return a in (None, "") and b in (None, "")
    return abs(float(a) - float(b)) <= 1e-9


def read_back(batch, expected_game):
    ids = ",".join(str(g) for g in batch)
    stored = psql_csv('select "gameId", "playerId", unit, "PPTOI", "percentageOfPP", pp_unit_usage_index, '
                      'pp_unit_relative_toi, pp_vs_unit_avg, pp_share_of_team, calculation_version '
                      f'from public."powerPlayCombinations" where "gameId" in ({ids}) order by 1, 2')
    clocks = psql_csv("select game_id, team_id, availability, unavailable_reason, qualified, clock_seconds, "
                      "reference_source, calculation_version from public.pp_team_game_clock "
                      f"where game_id in ({ids}) order by 1, 2")
    problems = []
    want_rows = {(g, r["playerId"]): r for g in batch for r in expected_game[g]["rows"]}
    got_rows = {(int(r["gameId"]), int(r["playerId"])): r for r in stored}
    if set(got_rows) != set(want_rows):
        problems.append(f"player rows differ: extra {sorted(set(got_rows) - set(want_rows))[:10]}, "
                        f"missing {sorted(set(want_rows) - set(got_rows))[:10]}")
    for key in sorted(set(got_rows) & set(want_rows)):
        got, want = got_rows[key], want_rows[key]
        bad = [f for f in INT_FIELDS + FLOAT_FIELDS if not same(got[f], want[f])]
        if bad or got["calculation_version"] != CALCULATION_VERSION:
            problems.append(f"row {key}: {bad or 'calculation_version'}")
    want_clock = {(g, c["team_id"]): c for g in batch for c in expected_game[g]["clock"]}
    got_clock = {(int(c["game_id"]), int(c["team_id"])): c for c in clocks}
    if set(got_clock) != set(want_clock):
        problems.append(f"clock rows differ: got {sorted(got_clock)}, expected {sorted(want_clock)}")
    for key in sorted(set(got_clock) & set(want_clock)):
        got, want = got_clock[key], want_clock[key]
        if (got["availability"] != want["availability"] or not same(got["clock_seconds"], want["clock_seconds"])
                or (got["unavailable_reason"] or None) != want["unavailable_reason"]
                or got["qualified"] != ("t" if want["qualified"] else "f")
                or got["reference_source"] != want["reference_source"]
                or got["calculation_version"] != CALCULATION_VERSION):
            problems.append(f"clock {key}: stored {got['availability']} {got['clock_seconds']}, "
                            f"expected {want['availability']} {want['clock_seconds']}")
    return problems


def run_write(args):
    batches = load_batches()
    path = Path(args.dry_run)
    if sha256(path) != args.dry_run_sha256:
        stop(2, "the dry-run file's sha256 is not the approved one")
    doc = json.loads(path.read_text())
    if doc.get("phase") != "dry" or not doc.get("gate", {}).get("passed") or doc.get("batchesSha256") != BATCHES_SHA256:
        stop(2, "the dry-run file did not pass its gate, or was made for another batch list")
    expected_game = {game["gameId"]: game for call in doc["calls"] for game in call["response"]["games"]}
    start = args.start_batch
    if not 1 <= start <= len(batches):
        stop(2, f"--start-batch must be 1..{len(batches)}")
    pacer = Pacer()
    for index in range(start, len(batches) + 1):
        batch = batches[index - 1]
        hygiene()
        pacer.wait()
        result = call_route(args.base_url, batch, dry_run=False)
        pacer.done()
        hygiene()
        problems = read_back(batch, expected_game)
        if problems:
            print("\n".join(problems[:20]), file=sys.stderr)
            stop(6, f"readback mismatch in batch {index} (games {batch[0]}..{batch[-1]}). Review it; the resume "
                    f"point is --start-batch {index} after the cause is understood, never past it")
        print(f"write batch {index}/{len(batches)}: games {batch[0]}..{batch[-1]} {result['elapsedS']} s, "
              "readback matches the dry run")
    print(f"done: batches {start}..{len(batches)} written and read back")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="phase", required=True)
    dry = sub.add_parser("dry")
    dry.add_argument("--base-url", required=True)
    dry.add_argument("--out", required=True)
    write = sub.add_parser("write")
    write.add_argument("--base-url", required=True)
    write.add_argument("--dry-run", required=True)
    write.add_argument("--dry-run-sha256", required=True)
    write.add_argument("--start-batch", type=int, default=1)
    args = parser.parse_args()
    run_dry(args) if args.phase == "dry" else run_write(args)


if __name__ == "__main__":
    main()

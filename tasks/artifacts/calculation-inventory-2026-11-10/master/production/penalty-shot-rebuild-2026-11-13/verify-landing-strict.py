#!/usr/bin/env python3
"""Strict served-landing check for the eight penalty-shot games (Astra A3-01, 2026-11-13).

Replaces verify-landing.py, which could print ALL_OK with wrong ES values or missing goalie fields.

Expectations come only from retained files in run/:
  - summary-after-<game>.jsonl: the stored partitions the refresh wrote (shooter allStrengths and
    evenStrength rows, goalie allStrengths row), and
  - summary-run.jsonl: the first pre-refresh baseline event per game (shooter and goalie expected totals).
The two must agree before any request is made. ES must also equal the stored pre-refresh ES row
(summary-before-<game>.jsonl), except the canary, whose before file the resumed runner overwrote (A3-02).

Live mode makes exactly 24 sequential read-only GETs (3 per game, 1 s apart), stops at the first non-200
or transport error, saves every raw response, and exits 0 only when every field is present and equal,
every GP is 1, each player appears exactly once, and the GET count is 24.

--selftest runs the same checks offline against fixtures (no requests): the exact rows must pass, and
Astra's false-pass case (ES 999, goalie SA/SV/GA missing, goalie GP 999), a duplicate row, a missing
row and a non-200 must each fail.
"""
import json, os, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(HERE, "run")
HOST = "https://fhfhockey.com"
PREFIX = "derived://underlying-player-summary-v2/"
# game: (shooter team, defending team, date)
META = {2026020065: (54, 10, "2026-10-08"), 2026020094: (55, 4, "2026-10-13"), 2026020101: (18, 54, "2026-10-13"),
        2026020119: (21, 5, "2026-10-16"), 2026020131: (18, 19, "2026-10-17"), 2026020150: (12, 23, "2026-10-20"),
        2026020159: (26, 2, "2026-10-22"), 2026020203: (16, 17, "2026-10-29")}
CANARY = 2026020065
B = ("fromSeasonId=20262027&throughSeasonId=20262027&seasonType=regularSeason&scoreState=allScores"
     "&displayMode=counts&scope=dateRange&minimumToiSeconds=0")
SKATER = ("goals", "shots", "iCf", "iFf")
GOALIE = ("shotsAgainst", "saves", "goalsAgainst")
EXPECTED_GETS = 3 * len(META)


def baselines():
    out = {}
    for line in open(os.path.join(RUN, "summary-run.jsonl")):
        e = json.loads(line)
        if e.get("event") == "baseline":
            out.setdefault(e["game"], e)  # first baseline = pre-refresh
    return out


def stored_rows(path, game, shooter, goalie):
    """Shooter all/ES rows and goalie all row from one snapshot file; each must occur exactly once."""
    found = {"all": [], "es": [], "goalie": []}
    for line in open(path):
        r = json.loads(line)
        if r["table"] == "nhl_api_game_payloads_raw":
            kind = {f"{PREFIX}individual/allStrengths/{game}": "all",
                    f"{PREFIX}individual/evenStrength/{game}": "es"}.get(r["u"])
            if kind:
                for x in r["p"]["rows"]:
                    if x["playerId"] == shooter and x["scoreState"] == "allScores":
                        m = x["metrics"]
                        found[kind].append({"gamesPlayed": m["gamesPlayed"], **{k: m["individual"][k] for k in SKATER}})
        elif r["table"] == "goalie_underlying_summary_partitions" and r["s"] == "allStrengths" and r["c"] == "allScores":
            for x in r["p"]["rows"]:
                if x["playerId"] == goalie and x["scoreState"] == "allScores":
                    m = x["metrics"]
                    found["goalie"].append({"gamesPlayed": m["gamesPlayed"], **{k: m["goalies"][k] for k in GOALIE}})
    for kind, rows in found.items():
        if len(rows) != 1:
            raise SystemExit(f"EXPECTATION_ERROR {game} {kind}: {len(rows)} stored rows in {os.path.basename(path)}")
    return {k: v[0] for k, v in found.items()}


def expectations():
    base, exp = baselines(), {}
    for g in META:
        e = base[g]
        after = stored_rows(os.path.join(RUN, f"summary-after-{g}.jsonl"), g, e["shooter"], e["goalie"])
        if after["all"] != {"gamesPlayed": 1, **e["shooter_all_expected"]}:
            raise SystemExit(f"EXPECTATION_ERROR {g}: stored shooter all {after['all']} != baseline {e['shooter_all_expected']}")
        if after["goalie"] != {"gamesPlayed": 1, **e["goalie_all_expected"]}:
            raise SystemExit(f"EXPECTATION_ERROR {g}: stored goalie {after['goalie']} != baseline {e['goalie_all_expected']}")
        if after["es"]["gamesPlayed"] != 1:
            raise SystemExit(f"EXPECTATION_ERROR {g}: stored ES GP {after['es']['gamesPlayed']}")
        es_source = "stored after row; pre-refresh file overwritten (A3-02)"
        if g != CANARY:
            before = stored_rows(os.path.join(RUN, f"summary-before-{g}.jsonl"), g, e["shooter"], e["goalie"])
            if before["es"] != after["es"]:
                raise SystemExit(f"EXPECTATION_ERROR {g}: ES changed in refresh {before['es']} -> {after['es']}")
            es_source = "stored after row = pre-refresh row"
        exp[g] = {"shooter": e["shooter"], "goalie": e["goalie"], "all": after["all"], "es": after["es"],
                  "goalie_all": after["goalie"], "es_source": es_source}
    return exp


def paths(g):
    st, dt, d = META[g]
    q = f"{B}&startDate={d}&endDate={d}"
    return [("all", f"/api/v1/underlying-stats/players?{q}&strength=allStrengths&statMode=individual&teamId={st}"),
            ("es", f"/api/v1/underlying-stats/players?{q}&strength=evenStrength&statMode=individual&teamId={st}"),
            ("goalie", f"/api/v1/underlying-stats/goalies?{q}&strength=allStrengths&teamId={dt}")]


def check(body, pid, want, label, problems):
    rows = [r for r in body.get("rows", []) if r.get("playerId") == pid]
    if len(rows) != 1:
        problems.append(f"{label}: {len(rows)} served rows for player {pid}")
        return None
    row = rows[0]
    for k, v in want.items():
        if k not in row:
            problems.append(f"{label}: {k} missing")
        elif row[k] != v:
            problems.append(f"{label}: {k} served {row[k]!r} expected {v!r}")
    return {k: row.get(k) for k in want}


def verify(exp, fetch, pause=1.0, save=None):
    """fetch(path) -> (status, bytes). Returns (results, problems, gets)."""
    results, problems, gets = [], [], 0
    for g in META:
        e = exp[g]
        served = {}
        for kind, path in paths(g):
            gets += 1
            try:
                status, raw = fetch(path)
            except Exception as err:  # transport error: stop, no further requests
                problems.append(f"{g} {kind}: request failed {type(err).__name__}")
                return results, problems, gets
            if save:
                save(g, kind, path, status, raw)
            if status != 200:
                problems.append(f"{g} {kind}: HTTP {status}")
                return results, problems, gets
            body = json.loads(raw)
            pid, want = (e["goalie"], e["goalie_all"]) if kind == "goalie" else (e["shooter"], e[kind])
            served[kind] = check(body, pid, want, f"{g} {kind}", problems)
            if pause:
                time.sleep(pause)
        results.append({"game": g, "shooter": e["shooter"], "goalie": e["goalie"], "served": served,
                        "expected": {"all": e["all"], "es": e["es"], "goalie": e["goalie_all"]}, "es_source": e["es_source"]})
    return results, problems, gets


def live():
    exp = expectations()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = os.path.join(HERE, f"landing-verify-{stamp}")
    os.makedirs(out)
    log = []

    def fetch(path):
        req = urllib.request.Request(HOST + path, headers={"User-Agent": "fhfh-landing-verify"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                hdr = {k: r.headers.get(k) for k in ("date", "age", "x-vercel-cache", "x-vercel-id", "cache-control")}
                log.append({"path": path, "status": r.status, "headers": hdr})
                return r.status, r.read()
        except urllib.error.HTTPError as err:
            log.append({"path": path, "status": err.code})
            return err.code, err.read()

    def save(g, kind, path, status, raw):
        with open(os.path.join(out, f"{g}-{kind}.json"), "wb") as f:
            f.write(raw)

    results, problems, gets = verify(exp, fetch, save=save)
    if gets != EXPECTED_GETS:
        problems.append(f"GET count {gets} != {EXPECTED_GETS}")
    verdict = "ALL_OK" if not problems else "MISMATCH"
    with open(os.path.join(out, "result.json"), "w") as f:
        json.dump({"verdict": verdict, "gets": gets, "requests": log, "problems": problems, "results": results}, f, indent=1)
    for r in results:
        print(json.dumps(r))
    for p in problems:
        print("PROBLEM", p)
    print(verdict, f"gets={gets}", os.path.relpath(out, HERE))
    return 0 if verdict == "ALL_OK" else 1


def selftest():
    exp = expectations()

    def body_for(mutate):
        def fetch(path):
            g = next(g for g in META if f"startDate={META[g][2]}" in path and (
                f"teamId={META[g][0]}" in path if "/players" in path else f"teamId={META[g][1]}" in path))
            e = exp[g]
            if "/goalies" in path:
                row = {"playerId": e["goalie"], **e["goalie_all"]}
                kind = "goalie"
            else:
                kind = "es" if "evenStrength" in path else "all"
                row = {"playerId": e["shooter"], **e[kind]}
            rows = [{"playerId": 1, "gamesPlayed": 1, "goals": 999}, dict(row)]
            return mutate(g, kind, rows)
        return fetch

    ok = lambda g, k, rows: (200, json.dumps({"rows": rows}).encode())

    def astra(g, kind, rows):  # Astra's reproduction
        if kind == "es":
            rows[1].update(goals=999, shots=999)
        if kind == "goalie":
            for k in GOALIE:
                rows[1].pop(k)
            rows[1]["gamesPlayed"] = 999
        return 200, json.dumps({"rows": rows}).encode()

    dup = lambda g, k, rows: (200, json.dumps({"rows": rows + [rows[1]]}).encode())
    gone = lambda g, k, rows: (200, json.dumps({"rows": rows[:1] if (g, k) == (2026020150, "goalie") else rows}).encode())
    http500 = lambda g, k, rows: (500, b"{}") if (g, k) == (2026020119, "es") else (200, json.dumps({"rows": rows}).encode())

    cases = {"exact": (ok, True), "astra_false_pass": (astra, False), "duplicate_row": (dup, False),
             "missing_goalie_row": (gone, False), "non_200": (http500, False)}
    failed = []
    for name, (mutate, should_pass) in cases.items():
        _, problems, gets = verify(exp, body_for(mutate), pause=0)
        passed = not problems and gets == EXPECTED_GETS
        as_expected = passed == should_pass
        if name == "astra_false_pass" and {p.split()[0] for p in problems} != {str(g) for g in META}:
            as_expected = False  # every game must fail, not just one
        print(f"{name}: {'pass' if passed else 'fail'} gets={gets} problems={len(problems)}")
        if not as_expected:
            failed.append(name)
    print("SELFTEST_OK" if not failed else f"SELFTEST_FAILED {failed}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else live())

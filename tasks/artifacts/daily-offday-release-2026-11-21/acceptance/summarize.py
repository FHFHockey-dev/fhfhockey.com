"""Daily FORGE natural-run acceptance: strict, offline evaluation of the receipts check.sh wrote.

Every check needs explicit, date-matched, attributable evidence. Missing, null, ambiguous or merely vacuous evidence
fails: an empty expected slate, an absent schedule day, a partial stage set, a selected_games recovery run, a run from
outside the scheduled window, reader rows from another run, or an NST row without explicit zero counts never passes.
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Stage rows a complete daily_incremental run writes (every fully complete daily scope on record, e.g. 11-03, 11-09,
# 11-13, has exactly these 11 rows).
EXPECTED_STAGES = frozenset({
    "core_entity_freshness", "upstream_skater_sources", "contextual_builders", "rolling_player_recompute",
    "projection_input_ingest", "projection_relationship_build", "projection_derived_build", "projection_execution",
    "projection_execution:goalie", "downstream_projection_consumers", "monitoring"})
# The Vercel cron fires the pipeline at 10:05 UTC; the checkpoint is 11:15 UTC.
WINDOW_START, WINDOW_END = "09:55:00", "11:15:00"
BRIDGE_PREFIX = "forge-daily-bridge-v1:"


def _int(value):
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _ts(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else None


def schedule_day(sched, date):
    """The one gameWeek entry dated `date`, with an explicit integer count that equals its explicit games list."""
    if not isinstance(sched, dict) or not isinstance(sched.get("gameWeek"), list):
        return None
    days = [d for d in sched["gameWeek"] if isinstance(d, dict) and d.get("date") == date]
    if len(days) != 1:
        return None
    count, games = _int(days[0].get("numberOfGames")), days[0].get("games")
    if count is None or not isinstance(games, list) or count != len(games):
        return None
    ids = [g.get("id") for g in games if isinstance(g, dict)]
    if len(ids) != count or any(_int(i) is None for i in ids) or len(set(ids)) != count:
        return None
    return sorted(ids)


def evaluate(ev, run_date, src_date, kind):
    """Pure. `ev` holds the parsed receipts; returns (checks, facts). `kind` is "control" or "offday"."""
    checks, facts = {}, {}
    start = datetime.fromisoformat(f"{run_date}T{WINDOW_START}+00:00")
    end = datetime.fromisoformat(f"{run_date}T{WINDOW_END}+00:00")
    if kind not in ("control", "offday"):
        return {"known_kind": False}, facts

    # 1. Official schedules, date-matched and explicit.
    expected, source = schedule_day(ev.get("schedule_run"), run_date), schedule_day(ev.get("schedule_source"), src_date)
    facts.update(expectedGameIds=expected, sourceGameIds=source)
    checks["run_schedule_explicit_nonempty"] = bool(expected)
    checks["source_schedule_matches_kind"] = source is not None and (source == [] if kind == "offday" else len(source) > 0)

    db = ev.get("db") if isinstance(ev.get("db"), dict) else {}
    # 2. Complete stage evidence for exactly this scope.
    scope = f"daily_incremental:{run_date}"
    rows = db.get("pipeline") if isinstance(db.get("pipeline"), list) else []
    stages = {}
    for row in rows:
        if isinstance(row, dict) and row.get("scope") == scope:
            stages.setdefault(row.get("stage"), []).append(row.get("status"))
    facts["pipelineStages"] = stages
    checks["pipeline_stages_complete"] = (set(stages) == EXPECTED_STAGES
                                          and all(v == ["complete"] for v in stages.values()))

    # 3. One attributable scheduled full-slate run (never a selected_games recovery, never a guess).
    runs = db.get("runs") if isinstance(db.get("runs"), list) else []
    scheduled = []
    for run in runs:
        created = _ts(run.get("created_at")) if isinstance(run, dict) else None
        scope_obj = run.get("scope") if isinstance(run, dict) else None
        if (created and start <= created < end and isinstance(scope_obj, dict) and scope_obj.get("mode") == "full_slate"
                and isinstance(run.get("run_id"), str)):
            scheduled.append(run)
    facts["scheduledRuns"] = [r["run_id"] for r in scheduled]
    run = scheduled[0] if len(scheduled) == 1 else None
    run_id = run["run_id"] if run else None
    facts["runId"] = run_id
    checks["one_scheduled_full_slate_run"] = run is not None
    checks["scheduled_run_succeeded"] = bool(run) and run.get("status") == "succeeded"

    # 4. Every expected game under that exact run: writer rows, Start Chart, Daily RSO.
    want = set(expected or [])
    player_rows = db.get("player_rows") if isinstance(db.get("player_rows"), dict) else {}
    writer = {int(k.split(":")[1]) for k, c in player_rows.items()
              if run_id and k.startswith(run_id + ":") and _int(c) and c > 0 and k.split(":")[1].isdigit()}
    facts["writerMissing"] = sorted(want - writer)
    checks["writer_rows_cover_expected"] = bool(want) and want <= writer

    sc = ev.get("startchart") if isinstance(ev.get("startchart"), dict) else {}
    sc_games = {p.get("game_id") for p in (sc.get("players") or []) if isinstance(p, dict)
                and isinstance(p.get("row_key"), str) and run_id and p["row_key"].startswith(run_id + ":")}
    facts["startChartMissing"] = sorted(want - sc_games)
    checks["start_chart_http_200"] = ev.get("sc_http") == 200
    checks["start_chart_selects_run"] = bool(run_id) and sc.get("projectionRunId") == run_id
    checks["start_chart_covers_expected_under_run"] = bool(want) and want <= sc_games

    rso = (ev.get("rso") or {}).get("bridgeForecasts") if isinstance(ev.get("rso"), dict) else None
    rso = rso if isinstance(rso, dict) else {}
    bridge_runs = [r[0] if isinstance(r, list) and r else None for r in (rso.get("runs") or [])]
    target = BRIDGE_PREFIX + run_id if run_id else None
    rso_games = set()
    for row in rso.get("rows") or []:
        if (isinstance(row, list) and len(row) > 2 and _int(row[2]) is not None and 0 <= row[2] < len(bridge_runs)
                and bridge_runs[row[2]] == target and str(row[1]).isdigit()):
            rso_games.add(int(row[1]))
    facts["dailyRsoMissing"] = sorted(want - rso_games)
    checks["daily_rso_http_200"] = ev.get("rso_http") == 200
    checks["daily_rso_covers_expected_under_run"] = bool(want) and target in bridge_runs and want <= rso_games

    # 5. Off-day: an attributable NST audit row that verified the source date with explicit zero requests.
    if kind == "offday":
        nst = db.get("nst") if isinstance(db.get("nst"), list) else []
        in_window = [r for r in nst if isinstance(r, dict) and (t := _ts(r.get("run_time"))) and start <= t < end]
        verified = [r for r in in_window if r.get("status") == "success" and r.get("state") == "skipped_no_completed_games"
                    and isinstance(r.get("verifiedOffDates"), list) and src_date in r["verifiedOffDates"]
                    and r.get("missingScheduleDates") == []]
        facts["nstRows"] = in_window
        checks["nst_verified_off_day"] = len(verified) >= 1
        checks["nst_zero_requests_explicit"] = bool(in_window) and all(
            _int(r.get("planned")) == 0 and _int(r.get("networkAttempts")) == 0 for r in in_window)
    return checks, facts


def load(out):
    def body(name):
        path = out / name
        try:
            return json.loads(path.read_text())
        except (OSError, ValueError):
            return None

    def http(name):
        try:
            first = (out / name).read_text().splitlines()[0].split()
            return int(first[1])
        except (OSError, IndexError, ValueError):
            return None
    return {"schedule_run": body("schedule-run.json"), "schedule_source": body("schedule-source.json"), "db": body("db.json"),
            "startchart": body("startchart.json"), "rso": body("rso.json"), "sc_http": http("sc.headers"), "rso_http": http("rso.headers")}


def main(argv):
    out, run_date, src_date, kind = Path(argv[1]), argv[2], argv[3], argv[4]
    checks, facts = evaluate(load(out), run_date, src_date, kind)
    hashes = {}
    for name in ("schedule-run.json", "schedule-source.json", "db.json", "startchart.json", "rso.json", "sc.headers", "rso.headers"):
        path = out / name
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
    result = {"runDate": run_date, "sourceDate": src_date, "kind": kind, "evaluatedAt": datetime.now(timezone.utc).isoformat(),
              "checks": checks, "facts": facts, "receiptSha256": hashes, "pass": bool(checks) and all(checks.values())}
    (out / "ACCEPTANCE.json").write_text(json.dumps(result, indent=1, default=str))
    print(json.dumps({"pass": result["pass"], "checks": checks, "runId": facts.get("runId"),
                      "writerMissing": facts.get("writerMissing"), "startChartMissing": facts.get("startChartMissing"),
                      "dailyRsoMissing": facts.get("dailyRsoMissing")}, indent=1))
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

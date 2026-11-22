"""The checker as first written (2026-11-21 ~23:0xZ), kept only so tests can reproduce its false passes."""
import json, sys
from pathlib import Path

out, run_date, src_date = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
load = lambda name: json.loads((out / name).read_text())

def day_games(sched, date):
    for day in sched.get("gameWeek", []):
        if day.get("date") == date:
            return day.get("numberOfGames"), [g for g in day.get("games", [])]
    return None, None

n_run, run_games = day_games(load("schedule-run.json"), run_date)
n_src, src_games = day_games(load("schedule-source.json"), src_date)
expected = sorted(g["id"] for g in (run_games or []) if g.get("gameScheduleState", "OK") == "OK")
db = load("db.json")
stage_status = {row["stage"]: row["status"] for row in db.get("pipeline") or []}
runs = db.get("runs") or []
db_games = {}
for key, count in (db.get("player_rows") or {}).items():
    run_id, game_id = key.split(":")
    db_games.setdefault(run_id, {})[int(game_id)] = count
nst = db.get("nst") or []
sc = load("startchart.json")
sc_run = sc.get("projectionRunId")
sc_games = sorted({p["game_id"] for p in sc.get("players", []) if p.get("game_id") is not None})
rso = load("rso.json").get("bridgeForecasts") or {}
rso_runs = [r[0] for r in rso.get("runs", [])]
rso_games = {}
for row in rso.get("rows", []):
    rso_games.setdefault(rso_runs[row[2]] if row[2] < len(rso_runs) else row[2], set()).add(int(row[1]))
natural = [r for r in runs if (r.get("scope") or {}).get("mode") != "selected_games"]
fresh = natural[-1]["run_id"] if natural else (runs[-1]["run_id"] if runs else None)
checks = {
    "pipeline_all_complete": bool(stage_status) and all(s == "complete" for s in stage_status.values()),
    "fresh_run_succeeded": any(r["run_id"] == fresh and r["status"] == "succeeded" for r in runs),
    "db_rows_cover_expected": fresh is not None and set(expected) <= set(db_games.get(fresh, {})),
    "start_chart_selects_fresh_run": sc_run == fresh,
    "start_chart_covers_expected": set(expected) <= set(sc_games),
    "daily_rso_selects_fresh_run": any(fresh and fresh in r for r in rso_runs),
    "daily_rso_covers_expected": set(expected) <= set().union(*rso_games.values()) if rso_games else not expected,
}
if n_src == 0:
    checks.update({
        "source_is_official_off_day": n_src == 0 and src_games == [],
        "nst_verified_off_day": any(src_date in (row.get("verifiedOffDates") or []) for row in nst),
        "nst_no_request_for_off_day": all((row.get("networkAttempts") or 0) == 0 for row in nst),
    })
print(json.dumps({"pass": all(checks.values())}))

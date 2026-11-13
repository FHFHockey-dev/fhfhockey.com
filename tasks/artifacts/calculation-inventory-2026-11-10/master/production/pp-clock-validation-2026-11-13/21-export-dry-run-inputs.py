#!/usr/bin/env python3
"""Decision 152 local dry run, step 1 (F11): export the writer's stored inputs for the frozen refresh scope.

TJ approved a local dry run before migration 149 or any release. This reads production only through psql
($TMPDIR/pgpool.sh), one session per batch, each inside START TRANSACTION READ ONLY (plus
default_transaction_read_only = on and a 10 s statement timeout), so the database itself refuses any write. The
pooler drops PGOPTIONS startup options, so read-only is enforced in-session and logged: every batch log records
`show transaction_read_only` = on, and the export stops if it isn't.

Per frozen batch (results/after-d152/refresh-batches-2026-27-regular.json, 31 batches of up to 10 games): the
hygiene gate first (stop if more than 5 active queries or any running over 10 s), then scalar columns only from
games, nhl_api_pbp_events, nhl_api_shift_rows (type 517), nhl_api_game_roster_spots, teamGameStats and
powerPlayCombinations. No jsonb payloads. Batches run one at a time, at least 5 s apart. Stops at the first
problem. Writes OUT/batch-NN/<table>.csv, OUT/batch-NN/session.log and OUT/export-manifest.json (every file's sha256
and row count); prints the export hash (sha256 of the manifest).
  python3 -I 21-export-dry-run-inputs.py OUT
"""
import csv
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BATCHES_FILE = HERE / "results" / "after-d152" / "refresh-batches-2026-27-regular.json"
BATCHES_SHA256 = "c2c287aa09d5078f5fd472b4e6dc655743c1c658589874699e9678dbc020a5c4"
MIN_GAP_S = 5

QUERIES = {
    "games": 'select id, date, "homeTeamId", "awayTeamId", type from public.games where id in ({ids}) order by id',
    "nhl_api_pbp_events": "select game_id, event_id, sort_order, period_number, period_type, time_in_period, time_remaining, "
                          "situation_code, type_desc_key, event_owner_team_id, penalty_type_code, penalty_desc_key, "
                          "penalty_duration_minutes, committed_by_player_id, served_by_player_id "
                          "from public.nhl_api_pbp_events where game_id in ({ids}) order by game_id, sort_order, event_id",
    "nhl_api_shift_rows": "select game_id, shift_id, player_id, team_id, period, start_seconds, end_seconds "
                          "from public.nhl_api_shift_rows where game_id in ({ids}) and type_code = 517 order by game_id, shift_id",
    "nhl_api_game_roster_spots": "select game_id, player_id, team_id, position_code from public.nhl_api_game_roster_spots "
                                 "where game_id in ({ids}) order by game_id, player_id",
    "teamGameStats": 'select "gameId", "teamId", "powerPlayToi", "powerPlay" from public."teamGameStats" '
                     'where "gameId" in ({ids}) order by "gameId", "teamId"',
    "powerPlayCombinations": 'select "gameId", "playerId", unit, "PPTOI", "percentageOfPP", pp_unit_usage_index, '
                             "pp_unit_relative_toi, pp_vs_unit_avg, pp_share_of_team "
                             'from public."powerPlayCombinations" where "gameId" in ({ids}) order by "gameId", "playerId"',
}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def stop(message):
    print(f"STOP: {message}", file=sys.stderr)
    sys.exit(3)


def main():
    out = Path(sys.argv[1])
    if sha256(BATCHES_FILE) != BATCHES_SHA256:
        stop("frozen batch list changed")
    batches = json.loads(BATCHES_FILE.read_text())["batches"]
    pgpool = Path(os.environ["TMPDIR"]) / "pgpool.sh"
    manifest = {"batchesSha256": BATCHES_SHA256, "readOnly": "START TRANSACTION READ ONLY per batch session",
                "batches": []}
    last = None
    for index, batch in enumerate(batches, start=1):
        folder = out / f"batch-{index:02d}"
        folder.mkdir(parents=True, exist_ok=True)
        if subprocess.run([str(HERE / "hygiene.sh")]).returncode != 0:
            stop(f"database busy before batch {index}; nothing more was read")
        if last is not None and time.monotonic() - last < MIN_GAP_S:
            time.sleep(MIN_GAP_S - (time.monotonic() - last))
        ids = ",".join(str(g) for g in batch)
        script = ["\\set ON_ERROR_STOP on", "set default_transaction_read_only = on;", "start transaction read only;",
                  "set local statement_timeout = '10s';", "show transaction_read_only;", "show statement_timeout;"]
        for table, query in QUERIES.items():
            script.append(f"\\copy ({query.format(ids=ids)}) to '{folder / (table + '.csv')}' with csv header")
        script.append("commit;")
        started = time.monotonic()
        result = subprocess.run([str(pgpool), "-At", "-q"], input="\n".join(script) + "\n", capture_output=True, text=True)
        last = time.monotonic()
        log = result.stdout + result.stderr
        (folder / "session.log").write_text(log)
        shown = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if result.returncode != 0:
            stop(f"batch {index} failed: {result.stderr.strip()[:300]}")
        if shown[:2] != ["on", "10s"]:
            stop(f"batch {index} session was not read-only with a 10 s timeout: {shown[:2]}")
        files = {}
        for table in QUERIES:
            path = folder / f"{table}.csv"
            with open(path) as handle:
                rows = sum(1 for _ in csv.reader(handle)) - 1
            files[table] = {"rows": rows, "sha256": sha256(path)}
        games = {int(r["id"]) for r in csv.DictReader(open(folder / "games.csv"))}
        if games != set(batch):
            stop(f"batch {index}: games table returned {sorted(games)} for {batch}")
        manifest["batches"].append({"batch": index, "gameIds": batch, "transactionReadOnly": shown[0],
                                    "seconds": round(last - started, 2), "files": files})
        print(f"batch {index}/{len(batches)}: read-only {shown[0]}, {round(last - started, 2)} s, "
              + ", ".join(f"{t} {f['rows']}" for t, f in files.items()), flush=True)
    path = out / "export-manifest.json"
    path.write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n")
    print(f"export manifest {path} sha256 {sha256(path)}")


if __name__ == "__main__":
    main()

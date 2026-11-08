"""Export one completed season of BLSH history from Supabase to JSONL in the dev-history row shape.

Sibling of export_dev_history.py (whose hash the pinned dry run checks, so it stays unchanged).
Read-only: one psql connection, one REPEATABLE READ READ ONLY transaction, a 60 s statement
timeout, a count query that stops the run before any row SELECT when a bound is exceeded, then
four SELECTs (WGO, NST individual, NST on-ice, games). No writes, no provider or NST calls.
Nulls stay null; nothing is filled with zero. Rows keep every NST match (ambiguous duplicates
included) so the consumer's one-match gate decides, as for the 2022-24 export.

Approved by TJ on 2026-11-03 for season 20242025 only; 2025-26 stays an untouched reserve.

Usage:
  python3 -I export_db_history.py capture --season 20242025 --env <web/.env.local> --output <new dir>
  python3 -I export_db_history.py build --capture <capture dir> --output <new dir>
"""
import argparse
import csv
import hashlib
import json
import math
import subprocess
from pathlib import Path

ALLOWED_SEASONS = {20242025}
MAX_ROWS = {"wgo": 60000, "nst_individual": 60000, "nst_onice": 60000, "games": 1700}
WGO_FIELDS = ["id", "player_id", "game_id", "season_id", "date", "player_name", "team_abbrev", "position_code", "games_played",
              "toi_per_game", "es_toi_per_game", "pp_toi_per_game", "goals", "assists", "pp_points", "shots", "hits",
              "blocked_shots", "total_primary_assists", "total_secondary_assists", "penalties_drawn", "penalties", "total_fow",
              "total_fol", "sat_for", "sat_against", "es_goals_for", "pp_goals_for", "sh_goals_for", "es_goals_against",
              "pp_goals_against", "sh_goals_against", "points"]
IND_FIELDS = ["id", "player_id", "season", "date_scraped", "gp", "toi", "ixg", "goals", "shots"]
ONICE_FIELDS = ["id", "player_id", "season", "date_scraped", "gp", "toi", "xgf", "xga"]
GAME_FIELDS = ["id", "seasonId", "date", "type"]
TEXT = {"date", "date_scraped", "player_name", "team_abbrev", "position_code"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def bounds(season):
    start = season // 10000
    return f"DATE '{start}-07-01'", f"DATE '{start + 1}-06-30'"


def queries(season):
    lo, hi = bounds(season)
    cols = lambda fields: ", ".join(f'"{f}"' for f in fields)
    where_w = f"season_id = {season} AND date BETWEEN {lo} AND {hi}"
    where_n = f"season = {season} AND date_scraped BETWEEN {lo} AND {hi}"
    where_g = f'"seasonId" = {season}'
    counts = ("SELECT max(n) FILTER (WHERE t = 'wgo') AS wgo, max(n) FILTER (WHERE t = 'nst_individual') AS nst_individual, "
              "max(n) FILTER (WHERE t = 'nst_onice') AS nst_onice, max(n) FILTER (WHERE t = 'games') AS games FROM ("
              f"SELECT 'wgo' AS t, count(*) AS n FROM public.wgo_skater_stats WHERE {where_w} "
              f"UNION ALL SELECT 'nst_individual', count(*) FROM public.nst_gamelog_as_counts WHERE {where_n} "
              f"UNION ALL SELECT 'nst_onice', count(*) FROM public.nst_gamelog_as_counts_oi WHERE {where_n} "
              f"UNION ALL SELECT 'games', count(*) FROM public.games WHERE {where_g}) c")
    return counts, {
        "wgo": f"SELECT {cols(WGO_FIELDS)} FROM public.wgo_skater_stats WHERE {where_w} ORDER BY id",
        "nst_individual": f"SELECT {cols(IND_FIELDS)} FROM public.nst_gamelog_as_counts WHERE {where_n} ORDER BY id",
        "nst_onice": f"SELECT {cols(ONICE_FIELDS)} FROM public.nst_gamelog_as_counts_oi WHERE {where_n} ORDER BY id",
        "games": f"SELECT {cols(GAME_FIELDS)} FROM public.games WHERE {where_g} ORDER BY id",
    }


def env_value(path, key):
    for line in Path(path).read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"{key} not set in {path}")


def capture(args):
    if args.season not in ALLOWED_SEASONS:
        raise SystemExit("Season not approved for reading")
    if args.output.exists():
        raise SystemExit("Output directory must be new")
    args.output.mkdir(parents=True)
    counts, selects = queries(args.season)
    over = " OR ".join(f"{k} > {v}" for k, v in MAX_ROWS.items())
    lines = ["\\set ON_ERROR_STOP on",
             "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;",
             "SET LOCAL statement_timeout = '60s';",
             # The one count query; its values are written with \qecho so it runs once.
             f"SELECT c.*, ({over}) AS over_bound FROM ({counts}) c \\gset",
             f"\\o '{args.output / 'counts.txt'}'",
             "\\qecho wgo=:wgo nst_individual=:nst_individual nst_onice=:nst_onice games=:games over_bound=:over_bound", "\\o",
             "\\if :over_bound", "\\echo 'row bound exceeded; no row SELECT run'", "ROLLBACK;", "\\quit", "\\endif"]
    lines += [f"\\copy ({sql}) TO '{args.output / (name + '.csv')}' WITH (FORMAT csv, HEADER)" for name, sql in selects.items()]
    lines += ["SELECT current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation, transaction_timestamp() AS snapshot_utc \\gset",
              f"\\o '{args.output / 'transaction.txt'}'", "\\qecho :read_only", "\\qecho :isolation", "\\qecho :snapshot_utc", "\\o",
              "ROLLBACK;"]
    script = args.output / "capture.sql"
    script.write_text("\n".join(lines) + "\n")
    result = subprocess.run(["psql", "-X", "-q", "-d", env_value(args.env, "SUPABASE_DB_URL"), "-f", str(script)],
                            capture_output=True, text=True, timeout=600)
    (args.output / "psql.stderr").write_text(result.stderr)
    if result.returncode != 0 or "row bound exceeded" in result.stdout:
        raise SystemExit(f"psql stopped (exit {result.returncode}); see psql.stderr and counts.csv")
    files = {p.name: {"sha256": sha256(p), "rows": sum(1 for _ in p.open()) - 1} for p in sorted(args.output.glob("*.csv"))}
    (args.output / "CAPTURE-RECEIPT.json").write_text(json.dumps(
        {"season": args.season, "bounds": bounds(args.season), "counts_sql": counts, "selects": selects, "max_rows": MAX_ROWS,
         "files": files, "transaction": (args.output / "transaction.txt").read_text().split("\n")[:3],
         "exporter": {"path": str(Path(__file__).resolve()), "sha256": sha256(Path(__file__).resolve())},
         "database_writes": 0, "provider_requests": 0}, indent=2) + "\n")
    print(json.dumps({k: v["rows"] for k, v in files.items()}))


def value(field, raw):
    if raw == "":
        return None
    if field in TEXT:
        return raw
    number = float(raw)
    if not math.isfinite(number):
        return None
    return int(number) if number.is_integer() and "." not in raw else number


def read(path, fields):
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != fields:
            raise SystemExit(f"Unexpected columns in {path.name}")
        return [{k: value(k, r[k]) for k in fields} for r in reader]


def build(args):
    if args.output.exists():
        raise SystemExit("Output directory must be new")
    receipt = json.loads((args.capture / "CAPTURE-RECEIPT.json").read_text())
    for name, pin in receipt["files"].items():
        if sha256(args.capture / name) != pin["sha256"]:
            raise SystemExit(f"Capture hash mismatch for {name}")
    games = {g["id"]: [g["seasonId"], g["date"], g["type"]] for g in read(args.capture / "games.csv", GAME_FIELDS)}
    individual, onice = {}, {}
    for r in read(args.capture / "nst_individual.csv", IND_FIELDS):
        # Same keys as the 2022-24 audit rows: nst_gp, nst_toi, nst_ixg.
        individual.setdefault((r["player_id"], r["date_scraped"]), []).append(
            {"nst_id": r["id"], "nst_gp": r["gp"], "nst_toi": r["toi"], "nst_ixg": r["ixg"], "nst_goals": r["goals"], "nst_shots": r["shots"]})
    for r in read(args.capture / "nst_onice.csv", ONICE_FIELDS):
        onice.setdefault((r["player_id"], r["date_scraped"]), []).append(r)
    args.output.mkdir(parents=True)
    output, rows, skipped = args.output / "db-history.jsonl", 0, {}
    with output.open("x") as out:
        for r in read(args.capture / "wgo.csv", WGO_FIELDS):
            calendar = games.get(r["game_id"])
            # Regular-season games only, as in the 2022-24 history; others are counted, not exported.
            if calendar is None or calendar[2] != 2:
                key = "no_calendar_game" if calendar is None else f"game_type_{calendar[2]}"
                skipped[key] = skipped.get(key, 0) + 1
                continue
            row = {**r, "_research_game_id": None, "_research_correction_status": "wgo_db_raw", "calendar": calendar,
                   "nst_individual": individual.get((r["player_id"], r["date"]), []), "nst_onice": onice.get((r["player_id"], r["date"]), [])}
            out.write(json.dumps(row, allow_nan=False) + "\n")
            rows += 1
    (args.output / "EXPORT-RECEIPT.json").write_text(json.dumps(
        {"rows": rows, "skipped": skipped, "season": receipt["season"], "capture": {"dir": str(args.capture.resolve()), "files": receipt["files"]},
         "output": {"file": output.name, "sha256": sha256(output)},
         "exporter": {"path": str(Path(__file__).resolve()), "sha256": sha256(Path(__file__).resolve())},
         "nulls_preserved": True, "network": False}, indent=2) + "\n")
    print(json.dumps({"rows": rows, "skipped": skipped}))


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("capture")
    c.add_argument("--season", required=True, type=int)
    c.add_argument("--env", required=True, type=Path)
    c.add_argument("--output", required=True, type=Path)
    b = sub.add_parser("build")
    b.add_argument("--capture", required=True, type=Path)
    b.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    capture(args) if args.command == "capture" else build(args)


if __name__ == "__main__":
    main()

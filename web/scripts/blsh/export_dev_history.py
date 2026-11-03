"""Export the frozen 2022-23/2023-24 BLSH development history to JSONL for the local dry run.

Read-only: every input path comes from the v1 run's INPUTS.json and is checked against its
pinned SHA-256 before reading. Writes only to a new output directory given on the command line.
No database, provider or network access. Nulls stay null; nothing is filled with zero.

Usage: python3 -I export_dev_history.py --inputs <support-conditioned-ranking-v1/INPUTS.json> --output <new dir>
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import pyarrow.parquet as pq

SEASONS = {"wgo2022": 20222023, "wgo2023": 20232024}
WGO_FIELDS = ["id", "player_id", "season_id", "date", "position_code", "team_abbrev", "game_id", "_research_game_id",
              "_research_correction_status", "games_played", "toi_per_game", "es_toi_per_game", "pp_toi_per_game",
              "goals", "assists", "pp_points", "shots", "hits", "blocked_shots", "total_primary_assists",
              "total_secondary_assists", "penalties_drawn", "penalties", "total_fow", "total_fol", "sat_for",
              "sat_against", "es_goals_for", "pp_goals_for", "sh_goals_for", "es_goals_against", "pp_goals_against",
              "sh_goals_against"]
AUDIT_FIELDS = ["wgo_id", "nst_id", "nst_present", "wgo_present", "nst_gp", "nst_toi", "nst_ixg", "nst_goals", "nst_shots"]
ONICE_FIELDS = ["id", "player_id", "season", "date_scraped", "gp", "toi", "xgf", "xga"]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def plain(v):
    if v is None or isinstance(v, (bool, int, str)):
        return v
    if isinstance(v, float):
        return v if math.isfinite(v) else None
    if hasattr(v, "isoformat"):
        return v.isoformat()[:10]
    return v


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Output directory must be new")
    sources = json.loads(args.inputs.read_text())["sources"]
    needed = ["wgo2022", "wgo2023", "audit", "calendar2022", "calendar2023", "onice_raw"]
    receipts = {}
    for name in needed:
        actual = sha256(sources[name]["path"])
        if actual != sources[name]["sha256"]:
            raise SystemExit(f"Pin mismatch for {name}")
        receipts[name] = {"path": sources[name]["path"], "sha256": actual}

    regular = {}
    for name in ("calendar2022", "calendar2023"):
        for r in pq.read_table(sources[name]["path"], columns=["id", "date", "seasonId", "type"]).to_pylist():
            regular[int(r["id"])] = (int(r["seasonId"]), plain(r["date"]), int(r["type"]))

    audit = {}
    for r in pq.read_table(sources["audit"]["path"], columns=AUDIT_FIELDS).to_pylist():
        if r["wgo_id"] is None or not r["nst_present"]:
            continue
        audit.setdefault(int(r["wgo_id"]), []).append({k: plain(r[k]) for k in AUDIT_FIELDS})

    onice = {}
    for r in pq.read_table(sources["onice_raw"]["path"], columns=ONICE_FIELDS).to_pylist():
        key = (int(r["season"]), int(r["player_id"]), plain(r["date_scraped"]))
        onice.setdefault(key, []).append({k: plain(r[k]) for k in ONICE_FIELDS})

    args.output.mkdir(parents=True)
    rows = 0
    with (args.output / "dev-history.jsonl").open("x") as out:
        for name in ("wgo2022", "wgo2023"):
            for r in pq.read_table(sources[name]["path"], columns=WGO_FIELDS).to_pylist():
                if r["season_id"] != SEASONS[name]:
                    raise SystemExit("Unexpected season in development view")
                row = {k: plain(r[k]) for k in WGO_FIELDS}
                game = row["_research_game_id"] or row["game_id"]
                row["calendar"] = None if game is None or int(game) not in regular else list(regular[int(game)])
                row["nst_individual"] = audit.get(row["id"], [])
                row["nst_onice"] = onice.get((row["season_id"], row["player_id"], row["date"]), [])
                out.write(json.dumps(row, allow_nan=False) + "\n")
                rows += 1
    # Pin the derivative so consumers can verify it at read time, with its source and exporter provenance.
    output = args.output / "dev-history.jsonl"
    (args.output / "EXPORT-RECEIPT.json").write_text(json.dumps(
        {"rows": rows, "sources": receipts, "output": {"file": output.name, "sha256": sha256(output)},
         "exporter": {"path": str(Path(__file__).resolve()), "sha256": sha256(Path(__file__).resolve())},
         "nulls_preserved": True, "network": False}, indent=2) + "\n")
    print(json.dumps({"rows": rows}))


if __name__ == "__main__":
    main()

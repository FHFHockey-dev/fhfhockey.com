#!/usr/bin/env python3
"""Decision 152 local dry run, step 3 (F11): check and seal the local dry run.

Reads OUT/dry-run.unchecked.json (22-local-dry-run.ts) and the export manifest, applies the refresh runner's own
gate (20-refresh-runner.py check_dry_run: exactly the 16 team-games change, 15 deletes, 23 PP-time/share updates,
5 inserts, 618 qualified clocks), and reconciles every one of the 618 team-games:
  unchanged      available, with player rows, none of them deleted, inserted or updated;
  changed        any deleted, inserted or updated row (deleted rows are placed by the exported roster);
  not applicable a qualified clock of 0 with no player rows;
  anything else  flagged.
Writes OUT/dry-run.json (the runner's format, gate included: what the write phase would need, by its sha256),
OUT/dry-run.sha256 and OUT/reconciliation.json, and prints the hashes.
  python3 -I 23-reconcile-local-dry-run.py <export dir> OUT
"""
import csv
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    export, out = Path(sys.argv[1]), Path(sys.argv[2])
    spec = importlib.util.spec_from_file_location("refresh_runner", HERE / "20-refresh-runner.py")
    runner = importlib.util.module_from_spec(spec)
    sys.dont_write_bytecode = True
    spec.loader.exec_module(runner)

    doc = json.loads((out / "dry-run.unchecked.json").read_text())
    manifest_path = export / "export-manifest.json"
    batches = runner.load_batches()
    flags = []
    if [c["gameIds"] for c in doc["calls"]] != batches:
        flags.append(f"the local dry run covered {len(doc['calls'])} of {len(batches)} batches; it stopped early")
    problems, summary = runner.check_dry_run(doc["calls"]) if not flags else (["incomplete run"], {})

    roster = {}
    for folder in sorted(export.glob("batch-*")):
        for row in csv.DictReader(open(folder / "nhl_api_game_roster_spots.csv")):
            roster[(int(row["game_id"]), int(row["player_id"]))] = int(row["team_id"])
    classes = {"unchanged": [], "changed": [], "notApplicable": [], "flagged": []}
    for call in doc["calls"]:
        for game in call["response"]["games"]:
            g = game["gameId"]
            changed_teams = set()
            for row in game["diff"]["deleted"]:
                team = roster.get((g, row["playerId"]))
                if team is None:
                    flags.append(f"deleted row {g}/{row['playerId']} has no roster team")
                changed_teams.add(team)
            team_of_row = {r["playerId"]: r["team_id"] for r in game["rows"]}
            for row in game["diff"]["inserted"]:
                changed_teams.add(row["team_id"])
            for row in game["diff"]["updated"]:
                changed_teams.add(team_of_row.get(row["playerId"]))
            for clock in game["clock"]:
                key = f"{g}/{clock['team_id']}"
                rows = [r for r in game["rows"] if r["team_id"] == clock["team_id"]]
                if clock["team_id"] in changed_teams:
                    classes["changed"].append(key)
                elif clock["availability"] == "not_applicable" and clock["clock_seconds"] == 0 and not rows:
                    classes["notApplicable"].append(key)
                elif clock["availability"] == "available" and rows:
                    classes["unchanged"].append(key)
                else:
                    classes["flagged"].append(f"{key}: {clock['availability']} {clock.get('unavailable_reason')}")
    counts = {name: len(keys) for name, keys in classes.items()}
    if counts != {"unchanged": 593, "changed": 16, "notApplicable": 9, "flagged": 0}:
        flags.append(f"reconciliation counts {counts}, expected 593 unchanged, 16 changed, 9 not applicable")
    flags += problems

    doc.update({"runner": "22-local-dry-run.ts + 23-reconcile-local-dry-run.py",
                "exportManifestSha256": sha256(manifest_path),
                "gate": {"passed": not flags, "problems": flags, "summary": summary}})
    final = out / "dry-run.json"
    final.write_text(json.dumps(doc, separators=(",", ":"), sort_keys=True) + "\n")
    digest = sha256(final)
    (out / "dry-run.sha256").write_text(f"{digest}  dry-run.json\n")
    (out / "reconciliation.json").write_text(json.dumps({
        "exportManifestSha256": sha256(manifest_path), "dryRunSha256": digest, "counts": counts,
        "gateSummary": summary, "flags": flags, "changedTeamGames": sorted(classes["changed"]),
        "notApplicableTeamGames": sorted(classes["notApplicable"]), "flaggedTeamGames": classes["flagged"]},
        indent=1) + "\n")
    (out / "dry-run.unchecked.json").unlink()
    print(json.dumps({"exportManifestSha256": sha256(manifest_path), "dryRunSha256": digest, "counts": counts,
                      "gate": summary, "flags": flags[:10]}, indent=1))
    sys.exit(0 if not flags else 4)


if __name__ == "__main__":
    main()

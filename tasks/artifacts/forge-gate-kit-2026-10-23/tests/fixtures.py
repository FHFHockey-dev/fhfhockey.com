"""Synthetic public-shape records only; no retained captures or service access."""
import json
from pathlib import Path

DATE = "2026-10-20"


def projection(game, player, value=1):
    return {"game_id": game, "player_id": player, "horizon_games": 1,
            "proj_goals_es": value * .3, "proj_goals_pp": value * .1,
            "proj_assists_es": value * .4, "proj_assists_pp": value * .2,
            "proj_shots_es": value * 2, "proj_shots_pp": value * .4,
            "proj_hits": value * .9, "proj_blocks": value * .7}


def capture(rows, positions=None):
    positions = positions if positions is not None else [
        {"id": r["player_id"], "team_id": 1, "position": "D" if int(r["player_id"]) % 3 == 0 else "C"}
        for r in rows]
    return {"payload": {"slateDate": DATE, "reads": [
        {"request": [{"method": "from", "args": ["players"]}], "result": {"data": positions}}]},
        "diagnostics": {"replay": {"matched": True}},
        "intendedWrites": [[{"method": "from", "args": ["forge_player_projections"]},
                            {"method": "upsert", "args": [rows]}]]}


def write_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2) + "\n")


def write_fixture(root, variants=("f", "candidate")):
    root = Path(root)
    actuals, hb = [], []
    for game, count in ((101, 11), (102, 12), (103, 13)):
        rows = {v: [] for v in variants}
        for player in range(1, count + 1):
            # Same player ID across games exercises composite identity, not player-only joins.
            x = player + (game - 100) * .17
            actuals.append({"game_id": game, "player_id": player, "date": DATE,
                            "goals": player % 4, "assists": player % 5, "pp_points": player % 3,
                            "shots": player % 8 + 1})
            hb.append({"game_id": game, "player_id": player, "date": DATE,
                       "hits": player % 6, "blocked_shots": player % 4})
            rows[variants[0]].append(projection(game, player, x))
            rows[variants[1]].append(projection(game, player, x * .9))
        for v in variants:
            write_json(root / "out" / v / f"{DATE}-{game}.json", capture(rows[v]))
    write_json(root / "actuals.json", actuals)
    write_json(root / "hb.json", hb)
    return root / "out", *variants, root / "actuals.json", root / "hb.json"

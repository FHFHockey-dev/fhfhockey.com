#!/usr/bin/env python
"""Run Sustainability Pipeline against a real Postgres (Supabase) database.

Usage (example):
  SUPABASE_DB_URL=postgres://... python -m scripts.run_sustainability_pipeline \
      --season-id 2025 --games-json ./sample_games.json --persist --build-snapshot --assign-tiers

Arguments:
  --season-id <int>          Target season id (required)
  --games-json <path>        Path to JSON file containing a list of per-game player stat dicts.
                             If omitted, a tiny synthetic dataset is generated.
  --persist                  Actually upsert barometers (model_player_game_barometers) & optional snapshot.
  --no-build-snapshot        Skip building a fresh distribution snapshot.
  --no-assign-tiers          Skip quintile assignment.
  --persist-snapshot         Persist snapshot thresholds (sustainability_distribution_snapshots).
  --reuse-snapshot           Reuse existing snapshot if build disabled (default True).
  --no-reuse-snapshot        Force not reusing snapshot.
  --incremental              Filter out already processed GAME dates (requires existing rows).
  --lock                     Acquire advisory lock to avoid concurrent runs.
  --log-run                  Insert run summary into sustainability_run_logs.
  --previous-config-hash H   Simulate previous config hash to trigger retro enqueue if changed.

Environment:
  SUPABASE_DB_URL must point to a writable Postgres for persistence.

Game Record Required Keys (minimum):
  player_id, season_id, position_code, game_id, game_date (YYYY-MM-DD),
  shots, goals, onice_goals_for, onice_shots_for, points, ixg, icf, hdcf

This script intentionally stays light—no retry/robust error handling. Suitable for manual validation.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import load_config


def load_games(path: Path | None, season_id: int) -> List[Dict[str, Any]]:
    if path and path.exists():
        with path.open("r") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise SystemExit("--games-json must contain a JSON list of game objects")
        return data  # trust user formatting
    # Fallback synthetic tiny dataset
    return [
        {
            "player_id": 100 + i,
            "season_id": season_id,
            "position_code": "F",
            "game_id": f"G{i+1}",
            "game_date": f"{season_id}-01-0{i+1}",
            "shots": 3 + i,
            "goals": 1 if i % 2 == 0 else 0,
            "onice_goals_for": 2 + i,
            "onice_shots_for": 12 + i * 2,
            "points": 1 if i % 2 == 0 else 0,
            "ixg": 0.4 + 0.1 * i,
            "icf": 4 + i,
            "hdcf": 1 + (i % 2),
        }
        for i in range(3)
    ]


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run sustainability pipeline end-to-end")
    p.add_argument("--season-id", type=int, required=True)
    p.add_argument("--games-json", type=Path)
    p.add_argument("--persist", action="store_true")
    p.add_argument("--no-build-snapshot", dest="build_snapshot", action="store_false")
    p.add_argument("--no-assign-tiers", dest="assign_tiers", action="store_false")
    p.add_argument("--persist-snapshot", action="store_true")
    p.add_argument("--reuse-snapshot", dest="reuse_snapshot", action="store_true", default=True)
    p.add_argument("--no-reuse-snapshot", dest="reuse_snapshot", action="store_false")
    p.add_argument("--incremental", action="store_true")
    p.add_argument("--lock", dest="use_lock", action="store_true")
    p.add_argument("--log-run", dest="log_run", action="store_true")
    p.add_argument("--previous-config-hash")
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    games = load_games(args.games_json, args.season_id)
    cfg = load_config()  # DB-backed or fallback
    res = orchestrate_full_run(
        season_id=args.season_id,
        games=games,
        persist=args.persist,
        build_snapshot=args.build_snapshot,
        assign_tiers=args.assign_tiers,
        persist_snapshot=args.persist_snapshot,
        reuse_snapshot=args.reuse_snapshot,
        incremental=args.incremental,
        use_lock=args.use_lock,
        log_run=args.log_run,
        previous_config_hash=args.previous_config_hash,
    )
    d = res.to_dict()
    print("Run Summary:\n" + json.dumps(d, indent=2))
    if not args.persist:
        print("(Dry run: no DB persistence performed.)")
    return 0


if __name__ == "__main__":  # pragma: no cover - manual execution path
    raise SystemExit(main(sys.argv[1:]))

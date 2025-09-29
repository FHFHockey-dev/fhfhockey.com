#!/usr/bin/env python
"""Seed minimal demo game data for Sustainability pipeline.

Problem you're hitting: the smoke runner expects a source table `player_game_stats` with
per‑game per‑player events. Your DB currently returns zero rows, so the orchestrator
has nothing to score. This script creates (if absent) a lean table with the exact
columns the pipeline expects and inserts a small synthetic dataset so you can:
  * Build league & player priors
  * Generate rolling windows
  * Produce scores
  * Persist barometers & snapshot thresholds

Usage:
  SUPABASE_DB_URL=postgres://... \
  python -m scripts.seed_sustainability_demo_games --season-id 2025 --players 3 --games 6 --persist

Arguments:
  --season-id <int>   Target season id (required)
  --players <int>     Number of distinct players to synthesize (default 3)
  --games <int>       Number of games per player (default 6)
  --position F|D      Position code to use for all synthetic players (default F)
  --clear             Truncate existing rows for that season before seeding
  --dry-run           Build SQL / show plan but do not write

After running this, re-run:
  python -m scripts.sustainability_live_smoke --season-id 2025 --limit 300 --persist --build-snapshot --persist-snapshot --second-run
"""
from __future__ import annotations

import argparse
import random
import sys
from datetime import date, timedelta
from typing import List, Dict, Any

from lib.sustainability import db_adapter

TABLE_DDL = """
CREATE TABLE IF NOT EXISTS player_game_stats (
  player_id        BIGINT NOT NULL,
  season_id        INT NOT NULL,
  position_code    TEXT NOT NULL,
  game_id          BIGINT NOT NULL,
  game_date        DATE NOT NULL,
  shots            INT NOT NULL,
  goals            INT NOT NULL,
  onice_goals_for  INT NOT NULL,
  onice_shots_for  INT NOT NULL,
  points           INT NOT NULL,
  ixg              DOUBLE PRECISION NOT NULL,
  icf              INT NOT NULL,
  hdcf             INT NOT NULL
);
"""


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed demo sustainability per-game stats")
    p.add_argument("--season-id", type=int, required=True)
    p.add_argument("--players", type=int, default=3)
    p.add_argument("--games", type=int, default=6)
    p.add_argument("--position", default="F")
    p.add_argument("--clear", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args(argv)


def ensure_table(conn) -> None:
    conn.execute(TABLE_DDL)


def truncate_season(conn, season_id: int):
    conn.execute("DELETE FROM player_game_stats WHERE season_id=%(s)s", {"s": season_id})


def build_rows(season_id: int, players: int, games: int, position: str) -> List[Dict[str, Any]]:
    base_date = date(season_id, 1, 1)
    rows: List[Dict[str, Any]] = []
    rng = random.Random(42)
    for p in range(players):
        player_id = 10_000 + p
        for g in range(games):
            game_date = base_date + timedelta(days=g)
            shots = rng.randint(1, 6)
            goals = 1 if rng.random() < 0.35 and shots > 2 else 0
            onice_shots_for = shots + rng.randint(5, 12)
            onice_goals_for = goals + rng.randint(0, 3)
            points = goals + (1 if rng.random() < 0.4 else 0)
            ixg = round(shots * rng.uniform(0.05, 0.18), 3)
            icf = shots + rng.randint(0, 4)
            hdcf = 1 if rng.random() < 0.5 else 0
            rows.append({
                "player_id": player_id,
                "season_id": season_id,
                "position_code": position,
                "game_id": int(f"{season_id}{p:02d}{g:02d}"),
                "game_date": game_date.isoformat(),
                "shots": shots,
                "goals": goals,
                "onice_goals_for": onice_goals_for,
                "onice_shots_for": onice_shots_for,
                "points": points,
                "ixg": ixg,
                "icf": icf,
                "hdcf": hdcf,
            })
    return rows


def insert_rows(conn, rows: List[Dict[str, Any]]):
    if not rows:
        return 0
    # Simple row-at-a-time insert; volume is tiny
    sql = """
        INSERT INTO player_game_stats(
            player_id, season_id, position_code, game_id, game_date, shots, goals,
            onice_goals_for, onice_shots_for, points, ixg, icf, hdcf)
        VALUES (
            %(player_id)s, %(season_id)s, %(position_code)s, %(game_id)s, %(game_date)s, %(shots)s, %(goals)s,
            %(onice_goals_for)s, %(onice_shots_for)s, %(points)s, %(ixg)s, %(icf)s, %(hdcf)s)
    """
    with conn.transaction():  # type: ignore[attr-defined]
        for r in rows:
            conn.execute(sql, r)
    return len(rows)


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    with db_adapter.get_conn() as conn:
        if conn is None:
            print("[error] Could not connect to DB (check SUPABASE_DB_URL)", file=sys.stderr)
            return 2
        ensure_table(conn)
        if args.clear:
            truncate_season(conn, args.season_id)
        rows = build_rows(args.season_id, args.players, args.games, args.position)
        if args.dry_run:
            print(f"Would insert {len(rows)} rows (dry-run)")
            return 0
        inserted = insert_rows(conn, rows)
        print(f"Inserted {inserted} demo game rows into player_game_stats (season {args.season_id}).")
    print("Next: run the live smoke script to generate sustainability scores.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    import sys as _sys
    raise SystemExit(main(_sys.argv[1:]))

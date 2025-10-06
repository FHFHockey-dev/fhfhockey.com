"""Rolling window construction (Task 4.1).

Builds per-player window aggregates for window types:
  * GAME  - each individual game row
  * G5    - rolling last up to 5 games (including current)
  * G10   - rolling last up to 10 games
  * STD   - season-to-date (optionally freshness-limited by config.freshness_days)

Input Game Row Expected Keys (minimal set used):
  player_id, game_id, game_date (date or ISO string), season_id, position_code
  shots, goals, onice_goals_for, onice_shots_for, points, ixg, icf, hdcf

Output Window Row Keys:
  player_id, season_id, position_code, window_type, game_id (None for STD), game_date,
  n_games, shots, goals, onice_goals_for, onice_shots_for, points, ixg, icf, hdcf,
  sh_pct, oish_pct, ipp (derived rates where denominators > 0), freshness_applied(bool)

Freshness Logic:
  For STD windows we exclude any game where (current_game_date - game_date).days > freshness_days.
  GAME / G5 / G10 ignore freshness (their recency is implicit) but still carry freshness_applied=False.

This module only assembles windows; scoring & reliability weighting happen later.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Dict, Iterable, Any, Optional

WINDOW_TYPES = ["GAME", "G5", "G10", "STD"]


def _to_date(d: Any) -> date:
    if isinstance(d, date):
        return d
    if isinstance(d, datetime):  # pragma: no cover (defensive)
        return d.date()
    # Assume ISO string
    return datetime.fromisoformat(str(d)).date()


def _compute_rates(acc: Dict[str, Any]) -> None:
    shots = acc.get("shots", 0) or 0
    goals = acc.get("goals", 0) or 0
    onice_goals_for = acc.get("onice_goals_for", 0) or 0
    onice_shots_for = acc.get("onice_shots_for", 0) or 0
    points = acc.get("points", 0) or 0
    # Shooting%
    acc["sh_pct"] = goals / shots if shots > 0 else None
    # On-ice Sh%
    acc["oish_pct"] = onice_goals_for / onice_shots_for if onice_shots_for > 0 else None
    # IPP (player points / on-ice GF)
    acc["ipp"] = points / onice_goals_for if onice_goals_for > 0 else None


def _aggregate_games(games: List[Dict[str, Any]]) -> Dict[str, Any]:
    acc = {
        "shots": 0,
        "goals": 0,
        "onice_goals_for": 0,
        "onice_shots_for": 0,
        "points": 0,
        "ixg": 0.0,
        "icf": 0,
        "hdcf": 0,
    }
    for g in games:
        acc["shots"] += g.get("shots", 0) or 0
        acc["goals"] += g.get("goals", 0) or 0
        acc["onice_goals_for"] += g.get("onice_goals_for", 0) or 0
        acc["onice_shots_for"] += g.get("onice_shots_for", 0) or 0
        acc["points"] += g.get("points", 0) or 0
        acc["ixg"] += float(g.get("ixg", 0.0) or 0.0)
        acc["icf"] += g.get("icf", 0) or 0
        acc["hdcf"] += g.get("hdcf", 0) or 0
    _compute_rates(acc)
    return acc


def build_player_windows(
    player_games: Iterable[Dict[str, Any]],
    freshness_days: int = 45,
) -> List[Dict[str, Any]]:
    """Build windows for a single player's games.

    Games are sorted by game_date ascending before rolling aggregation.
    Returns combined list for all window types (GAME/G5/G10/STD) keyed per current game_date.
    STD row is produced per game_date to enable timeline visualizations; downstream can de-duplicate latest if needed.
    """
    games = [g.copy() for g in player_games]
    if not games:
        return []
    for g in games:
        g["game_date"] = _to_date(g["game_date"])  # normalize
    games.sort(key=lambda x: x["game_date"])  # chronological

    out: List[Dict[str, Any]] = []
    rolling: List[Dict[str, Any]] = []  # holds prior games up to current inclusive
    for g in games:
        rolling.append(g)
        # GAME
        base_meta = {
            "player_id": g["player_id"],
            "season_id": g["season_id"],
            "position_code": g.get("position_code"),
            "game_date": g["game_date"],
        }
        # GAME window
        single_stats = _aggregate_games([g])
        out.append({
            **base_meta,
            "window_type": "GAME",
            "game_id": g.get("game_id"),
            "n_games": 1,
            **single_stats,
            "freshness_applied": False,
        })
        # Rolling helpers
        def window_slice(n: int) -> List[Dict[str, Any]]:
            return rolling[-n:] if len(rolling) >= n else rolling[:]

        for n, label in [(5, "G5"), (10, "G10")]:
            w_games = window_slice(n)
            agg = _aggregate_games(w_games)
            out.append({
                **base_meta,
                "window_type": label,
                "game_id": g.get("game_id"),
                "n_games": len(w_games),
                **agg,
                "freshness_applied": False,
            })
        # STD with freshness filter
        current_date = g["game_date"]
        std_filtered = [x for x in rolling if (current_date - x["game_date"]).days <= freshness_days]
        freshness_applied = len(std_filtered) != len(rolling)
        std_agg = _aggregate_games(std_filtered)
        out.append({
            **base_meta,
            "window_type": "STD",
            "game_id": None,
            "n_games": len(std_filtered),
            **std_agg,
            "freshness_applied": freshness_applied,
        })
    return out


def build_all_players_windows(
    all_games: Iterable[Dict[str, Any]],
    freshness_days: int = 45,
) -> List[Dict[str, Any]]:
    by_player: Dict[int, List[Dict[str, Any]]] = {}
    for g in all_games:
        pid = g.get("player_id")
        if pid is None:
            continue
        by_player.setdefault(int(pid), []).append(g)
    out: List[Dict[str, Any]] = []
    for pid, games in by_player.items():
        out.extend(build_player_windows(games, freshness_days=freshness_days))
    return out


__all__ = [
    "WINDOW_TYPES",
    "build_player_windows",
    "build_all_players_windows",
]

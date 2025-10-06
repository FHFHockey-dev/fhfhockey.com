"""Performance benchmark harness (Task 4.12).

Generates a synthetic dataset of player game rows and executes the
pre-scoring + full scoring pipeline measuring phase timings.

Usage (programmatic):
    from lib.sustainability.benchmark import run_performance_benchmark
    summary = run_performance_benchmark(n_players=5000, n_games=40)

NOTES:
  * Default synthetic generation aims to mimic distributions for:
      shots ~ Poisson(3.2), goals ~ Binomial(shots, 0.11), on-ice shots for ~ Poisson(18),
      on-ice goals for ~ Binomial(onice_shots_for, 0.08), points correlated with goals.
  * ixG approximated as goals * U(0.6,1.1) + (shots-goals)*U(0.05,0.12)
  * Position mix 70% F / 30% D (simple ratio).
  * Season id fixed (e.g., 2025) for this benchmark.
  * Does not persist (persist=False) to avoid DB dependency in CI.
  * If environment variable SUSTAIN_BENCH_FAST=1 set, scales down to lighter run.
"""
from __future__ import annotations

import os
import random
import time
from typing import Dict, Any, List

from .orchestrator import orchestrate_full_run
from .config_loader import load_config


def _synthetic_games(n_players: int, n_games: int, season_id: int = 2025) -> List[Dict[str, Any]]:
    games: List[Dict[str, Any]] = []
    # Pre-generate per-player position
    positions = {pid: ("F" if random.random() < 0.7 else "D") for pid in range(1, n_players + 1)}
    # Game date spacing: assume 2-day increments
    for g_idx in range(n_games):
        game_date = f"2025-01-{1 + g_idx:02d}" if g_idx < 31 else f"2025-02-{(g_idx-30):02d}"
        for pid in range(1, n_players + 1):
            pos = positions[pid]
            shots = random.poisson(3.2) if hasattr(random, 'poisson') else int(random.gauss(3.2, 1.2))
            if shots < 0:
                shots = 0
            goals = 0
            for _ in range(shots):
                if random.random() < 0.11:
                    goals += 1
            onice_shots_for = max(shots + int(random.gauss(15, 4)), 0)
            onice_goals_for = 0
            for _ in range(onice_shots_for):
                if random.random() < 0.08:
                    onice_goals_for += 1
            points = goals
            # ixG approximation
            ixg_goals = sum(random.uniform(0.6, 1.1) for _ in range(goals))
            ixg_nongoals = sum(random.uniform(0.05, 0.12) for _ in range(max(shots - goals, 0)))
            ixg = ixg_goals + ixg_nongoals
            icf = shots + int(random.gauss(2, 1))
            if icf < shots:
                icf = shots
            hdcf = max(int(goals + random.gauss(1.2, 0.8)), 0)
            games.append({
                'player_id': pid,
                'season_id': season_id,
                'position_code': pos,
                'game_id': f"G{g_idx+1}",
                'game_date': game_date,
                'shots': shots,
                'goals': goals,
                'onice_shots_for': onice_shots_for,
                'onice_goals_for': onice_goals_for,
                'points': points,
                'ixg': round(ixg, 3),
                'icf': icf,
                'hdcf': hdcf,
            })
    return games


def run_performance_benchmark(
    n_players: int = 5000,
    n_games: int = 40,
    season_id: int = 2025,
    fast: bool | None = None,
) -> Dict[str, Any]:
    # Fast mode override for CI or local quick check
    if fast is None:
        fast = os.getenv("SUSTAIN_BENCH_FAST") == "1"
    if fast:
        n_players = min(n_players, 500)
        n_games = min(n_games, 15)

    t0 = time.perf_counter()
    games = _synthetic_games(n_players=n_players, n_games=n_games, season_id=season_id)
    t_gen = time.perf_counter()
    cfg = load_config()  # fallback config acceptable for synthetic
    t_cfg = time.perf_counter()
    result = orchestrate_full_run(
        season_id=season_id,
        games=games,
        cfg=cfg,
        persist=False,
        build_snapshot=True,
        assign_tiers=True,
    )
    t_pipe = time.perf_counter()
    total_ms = int((t_pipe - t0) * 1000)
    return {
        'players': n_players,
        'games_per_player': n_games,
        'rows_generated': len(games),
        'duration_generate_ms': int((t_gen - t0) * 1000),
        'duration_config_ms': int((t_cfg - t_gen) * 1000),
        'duration_pipeline_ms': int((t_pipe - t_cfg) * 1000),
        'duration_total_ms': total_ms,
        'pipeline_summary': result.to_dict(),
    }


__all__ = [
    'run_performance_benchmark',
]

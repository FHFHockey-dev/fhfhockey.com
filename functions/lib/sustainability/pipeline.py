"""Combined pre-scoring pipeline helper.

Assembles the sustainability data flow up to (but not including) score
aggregation & logistic mapping (Tasks 4.1–4.3 integrated + z-score prep 4.2).

Steps:
  1. Load configuration (or accept injected cfg).
  2. Load SD constants (fixed or empirical placeholder).
  3. Compute or accept injected league priors.
  4. Compute or accept injected player priors for target season.
  5. Build rolling windows for all players (GAME, G5, G10, STD) with freshness.
  6. Annotate windows with z-scores vs posterior expectations.
  7. Annotate reliability factors r_<metric>.

Returns list of enriched window rows ready for soft clipping / contribution
weighting & final scoring (next tasks 4.4+).
"""
from __future__ import annotations

from typing import List, Dict, Any, Iterable, Tuple, Optional

from .config_loader import load_config, SustainabilityConfig
from .constants import load_sd_constants
from .priors import compute_league_beta_priors, LeaguePriorRow
from .player_priors import compute_player_posteriors
from .windows import build_all_players_windows
from .zscores import annotate_zscores
from .reliability import compute_reliability


def _league_priors_map(priors: List[LeaguePriorRow]) -> Dict[Tuple[int, str, str], LeaguePriorRow]:
    return {(p.season_id, p.position_code, p.stat_code): p for p in priors}


def run_pre_scoring_pipeline(
    season_id: int,
    games: Iterable[Dict[str, Any]],
    db_client=None,
    cfg: SustainabilityConfig | None = None,
    league_priors: List[LeaguePriorRow] | None = None,
    player_priors_rows: List[Dict[str, Any]] | None = None,
    metrics: Iterable[str] | None = None,
) -> Dict[str, Any]:
    """Run the combined pipeline returning enriched window rows & metadata.

    Parameters:
      season_id: target season for priors & player posteriors.
      games: iterable of raw per-game player stat dicts.
      db_client: optional DB adapter for config / priors (stubs tolerated).
      cfg: preloaded config (skips load if provided).
      league_priors: optional precomputed league priors list.
      player_priors_rows: optional precomputed player posterior rows.
      metrics: optional subset of rate metrics for z-score + reliability.

    Returns dict with keys:
      cfg, league_priors, player_priors, windows (raw), windows_enriched (with z & r)
    """
    # 1. Config
    if cfg is None:
        cfg = load_config(db_client=db_client)

    # 2. SD constants
    sd_constants = load_sd_constants(db_client if cfg.sd_mode != "fixed" else None)

    # 3. League priors
    if league_priors is None:
        league_priors = compute_league_beta_priors(season_id, db_client, cfg)
    league_map = _league_priors_map(league_priors)

    # 4. Player priors
    if player_priors_rows is None:
        player_priors_rows = compute_player_posteriors(
            target_season=season_id,
            league_priors=league_map,
            cfg=cfg,
            db_client=db_client,
        )

    # 5. Windows
    windows = build_all_players_windows(games, freshness_days=cfg.freshness_days)

    # 6. Z-scores
    windows_z = annotate_zscores(windows, player_priors_rows, sd_constants, metrics=metrics)

    # 7. Reliability
    windows_enriched = compute_reliability(windows_z, cfg.k_r, metrics=metrics)

    return {
        "cfg": cfg,
        "league_priors": league_priors,
        "player_priors": player_priors_rows,
        "windows": windows,
        "windows_enriched": windows_enriched,
        "sd_constants": sd_constants,
    }


__all__ = ["run_pre_scoring_pipeline"]

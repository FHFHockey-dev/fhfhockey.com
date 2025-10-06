import pytest

from lib.sustainability.config_loader import load_config
from lib.sustainability.priors import LeaguePriorRow
from lib.sustainability.player_priors import compute_player_posteriors, summarize_player_posteriors


def _mk_prior_map():
    # Provide league priors for season=2025 both positions & metrics minimal
    priors = {}
    metrics = ["sh_pct", "oish_pct", "ipp"]
    for pos in ["F", "D"]:
        for m in metrics:
            priors[(2025, pos, m)] = LeaguePriorRow(
                season_id=2025,
                position_code=pos,
                stat_code=m,
                alpha0=4.0,
                beta0=96.0,
                k=100.0,
                league_mu=0.04,
            )
    return priors


def test_player_posteriors_basic():
    cfg = load_config(db_client=None, allow_fallback=True)
    # Provide multi-season rows: player 1 has two seasons (2025 target + 2024), player 2 only target (rookie)
    rows = [
        # Player 1 target season
        {
            "player_id": 1,
            "season_id": 2025,
            "position_code": "F",
            "sh_pct_successes": 20,
            "sh_pct_trials": 200,
            "oish_pct_successes": 40,
            "oish_pct_trials": 500,
            "ipp_successes": 60,
            "ipp_trials": 50,
        },
        # Player 1 previous season 2024
        {
            "player_id": 1,
            "season_id": 2024,
            "position_code": "F",
            "sh_pct_successes": 18,
            "sh_pct_trials": 210,
            "oish_pct_successes": 30,
            "oish_pct_trials": 480,
            "ipp_successes": 55,
            "ipp_trials": 45,
        },
        # Player 2 only target season (rookie)
        {
            "player_id": 2,
            "season_id": 2025,
            "position_code": "D",
            "sh_pct_successes": 5,
            "sh_pct_trials": 120,
            "oish_pct_successes": 10,
            "oish_pct_trials": 400,
            "ipp_successes": 15,
            "ipp_trials": 12,
        },
    ]

    priormap = _mk_prior_map()
    out = compute_player_posteriors(
        target_season=2025,
        league_priors=priormap,
        cfg=cfg,
        db_client=None,
        rows=rows,
    )
    # Expect 2 players * 3 metrics = 6 rows
    assert len(out) == 6
    # Check rookie flag distribution
    p1 = [r for r in out if r["player_id"] == 1]
    p2 = [r for r in out if r["player_id"] == 2]
    assert all(r["rookie_status"] is False for r in p1)
    assert all(r["rookie_status"] is True for r in p2)
    # Posterior mean should be between prior mu and observed sample rate extremes
    for r in out:
        assert 0 <= r["post_mean"] <= 1


def test_player_posteriors_missing_target_skips():
    cfg = load_config(db_client=None, allow_fallback=True)
    rows = [
        {  # only historical season without target season -> should skip entirely
            "player_id": 10,
            "season_id": 2024,
            "position_code": "F",
            "sh_pct_successes": 10,
            "sh_pct_trials": 100,
            "oish_pct_successes": 20,
            "oish_pct_trials": 300,
            "ipp_successes": 30,
            "ipp_trials": 25,
        }
    ]
    priormap = _mk_prior_map()
    out = compute_player_posteriors(
        2025,
        priormap,
        cfg,
        rows=rows,
        db_client=None,
    )
    assert out == []


def test_player_posteriors_no_history_reproducible():
    cfg = load_config(db_client=None, allow_fallback=True)
    priormap = _mk_prior_map()
    rows = [
        {  # Rookie only target season data
            "player_id": 99,
            "season_id": 2025,
            "position_code": "F",
            "sh_pct_successes": 3,
            "sh_pct_trials": 40,
            "oish_pct_successes": 8,
            "oish_pct_trials": 150,
            "ipp_successes": 10,
            "ipp_trials": 9,
        }
    ]
    out1 = compute_player_posteriors(2025, priormap, cfg, rows=rows)
    out2 = compute_player_posteriors(2025, priormap, cfg, rows=rows)
    assert out1 == out2
    summary = summarize_player_posteriors(out1)
    assert summary["rookie_players"] == 1


if __name__ == "__main__":
    pytest.main([__file__])

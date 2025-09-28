import pytest

from lib.sustainability.config_loader import load_config
from lib.sustainability.priors import compute_league_beta_priors, LeaguePriorRow, upsert_league_priors


def test_compute_league_beta_priors_basic():
    cfg = load_config(db_client=None, allow_fallback=True)
    aggregates = [
        {
            "season_id": 2025,
            "position_code": "F",
            "sh_pct_successes": 500,  # goals
            "sh_pct_trials": 5000,    # shots
            "oish_pct_successes": 900,  # on-ice goals for
            "oish_pct_trials": 9000,    # on-ice shots for
            "ipp_successes": 1400,  # player points
            "ipp_trials": 900,      # on-ice goals for (points can exceed goals? guard below)
        },
        {
            "season_id": 2025,
            "position_code": "D",
            "sh_pct_successes": 200,
            "sh_pct_trials": 3200,
            "oish_pct_successes": 700,
            "oish_pct_trials": 8700,
            "ipp_successes": 600,
            "ipp_trials": 700,
        },
    ]

    rows = compute_league_beta_priors(2025, db_client=None, cfg=cfg, aggregates=aggregates)
    assert rows, "Should produce rows"
    # Ensure one row per metric per position
    metrics = {r.stat_code for r in rows}
    assert {"sh_pct", "oish_pct", "ipp"}.issubset(metrics)
    by_pos_metric = {(r.position_code, r.stat_code) for r in rows}
    assert ("F", "sh_pct") in by_pos_metric
    assert ("D", "ipp") in by_pos_metric

    # Sanity check parameter bounds
    for r in rows:
        assert r.alpha0 > 0 and r.beta0 > 0
        assert 0 <= r.league_mu <= 1


def test_compute_league_beta_priors_zero_trials():
    cfg = load_config(db_client=None, allow_fallback=True)
    aggregates = [
        {
            "season_id": 2025,
            "position_code": "F",
            "sh_pct_successes": 0,
            "sh_pct_trials": 0,
            "oish_pct_successes": 0,
            "oish_pct_trials": 0,
            "ipp_successes": 0,
            "ipp_trials": 0,
        }
    ]
    rows = compute_league_beta_priors(2025, db_client=None, cfg=cfg, aggregates=aggregates)
    assert len(rows) == 3
    for r in rows:
        assert r.league_mu == 0.0
        # Neutral fallback Beta(1,1) -> alpha0 or beta0 may have been adjusted to 0.5 guard, accept >=0.5
        assert r.alpha0 > 0
        assert r.beta0 > 0


def test_upsert_league_priors_stub():
    # No db_client returns 0
    cfg = load_config(db_client=None, allow_fallback=True)
    rows = compute_league_beta_priors(2025, db_client=None, cfg=cfg, aggregates=[{
        "season_id": 2025,
        "position_code": "F",
        "sh_pct_successes": 10,
        "sh_pct_trials": 100,
        "oish_pct_successes": 20,
        "oish_pct_trials": 200,
        "ipp_successes": 30,
        "ipp_trials": 40,
    }])
    assert upsert_league_priors(None, rows) == 0
    # Fake client to count call size
    class FakeClient: ...
    assert upsert_league_priors(FakeClient(), rows) == len(rows)


if __name__ == "__main__":
    pytest.main([__file__])

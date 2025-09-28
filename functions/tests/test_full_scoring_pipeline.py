from lib.sustainability.pipeline import run_full_scoring_pipeline
from lib.sustainability.config_loader import DEFAULT_CONFIG, SustainabilityConfig
from lib.sustainability.priors import LeaguePriorRow


def _fake_cfg():
    return SustainabilityConfig(
        model_version=DEFAULT_CONFIG['model_version'],
        weights=DEFAULT_CONFIG['weights_json'],
        toggles=DEFAULT_CONFIG['toggles_json'],
        constants=DEFAULT_CONFIG['constants_json'],
        sd_mode='fixed',
        freshness_days=DEFAULT_CONFIG['freshness_days'],
        config_hash='testhash',
        source='default',
    )


def test_run_full_scoring_pipeline_basic():
    games = [
        {'player_id': 1, 'season_id': 2025, 'position_code': 'F', 'game_id': 'G1', 'game_date': '2025-01-01', 'shots': 4, 'goals': 1, 'onice_goals_for': 2, 'onice_shots_for': 12, 'points': 1, 'ixg': 0.6, 'icf': 5, 'hdcf': 2},
        {'player_id': 1, 'season_id': 2025, 'position_code': 'F', 'game_id': 'G2', 'game_date': '2025-01-05', 'shots': 3, 'goals': 0, 'onice_goals_for': 1, 'onice_shots_for': 10, 'points': 0, 'ixg': 0.4, 'icf': 4, 'hdcf': 1},
        {'player_id': 1, 'season_id': 2025, 'position_code': 'F', 'game_id': 'G3', 'game_date': '2025-01-08', 'shots': 5, 'goals': 1, 'onice_goals_for': 3, 'onice_shots_for': 15, 'points': 1, 'ixg': 0.8, 'icf': 6, 'hdcf': 2},
    ]
    league_priors = [
        LeaguePriorRow(season_id=2025, position_code='F', stat_code='sh_pct', alpha0=5, beta0=45, k=50, league_mu=0.10),
        LeaguePriorRow(season_id=2025, position_code='F', stat_code='oish_pct', alpha0=12, beta0=138, k=150, league_mu=0.08),
        LeaguePriorRow(season_id=2025, position_code='F', stat_code='ipp', alpha0=18, beta0=12, k=30, league_mu=0.60),
    ]
    cfg = _fake_cfg()
    result = run_full_scoring_pipeline(
        season_id=2025,
        games=games,
        cfg=cfg,
        league_priors=league_priors,
        player_priors_rows=[
            {'player_id': 1, 'season_id': 2025, 'position_code': 'F', 'stat_code': 'sh_pct', 'successes_blend': 2, 'trials_blend': 12, 'post_mean': 0.10, 'rookie_status': False, 'model_version': cfg.model_version},
            {'player_id': 1, 'season_id': 2025, 'position_code': 'F', 'stat_code': 'oish_pct', 'successes_blend': 6, 'trials_blend': 37, 'post_mean': 0.081, 'rookie_status': False, 'model_version': cfg.model_version},
            {'player_id': 1, 'season_id': 2025, 'position_code': 'F', 'stat_code': 'ipp', 'successes_blend': 2, 'trials_blend': 6, 'post_mean': 0.62, 'rookie_status': False, 'model_version': cfg.model_version},
        ],
        persist=False,
    )
    assert 'windows_scored' in result
    scored = result['windows_scored']
    assert len(scored) == 12  # 3 games * 4 window types
    sample = scored[-1]
    assert 'score' in sample and sample['score'] is not None
    assert 'components_json' in sample
    # Contrib_total should align with logistic input
    assert 'contrib_total' in sample
    assert 0 <= sample['score'] <= 100
    # Finishing residual metrics should appear when toggle enabled and weights present
    comp = sample['components_json']
    assert 'finish_res_cnt' in comp and 'finish_res_rate' in comp

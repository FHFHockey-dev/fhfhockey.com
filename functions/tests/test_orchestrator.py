from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.priors import LeaguePriorRow
from lib.sustainability.config_loader import DEFAULT_CONFIG, SustainabilityConfig


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


def test_orchestrate_full_run_basic():
    games = [
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G1','game_date':'2025-01-01','shots':4,'goals':1,'onice_goals_for':2,'onice_shots_for':12,'points':1,'ixg':0.6,'icf':5,'hdcf':2},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G2','game_date':'2025-01-05','shots':3,'goals':0,'onice_goals_for':1,'onice_shots_for':10,'points':0,'ixg':0.4,'icf':4,'hdcf':1},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G3','game_date':'2025-01-08','shots':5,'goals':1,'onice_goals_for':3,'onice_shots_for':15,'points':1,'ixg':0.8,'icf':6,'hdcf':2},
    ]
    # Use orchestrator with built-in priors generation (no explicit priors injection here) & dry run
    cfg = _fake_cfg()
    res = orchestrate_full_run(season_id=2025, games=games, cfg=cfg, persist=False)
    d = res.to_dict()
    assert d['season_id'] == 2025
    assert d['model_version'] == cfg.model_version
    assert d['total_rows_scored'] > 0
    assert d['persisted_count'] == 0
    assert 'config' in d['phases'] and 'scoring_pipeline' in d['phases']

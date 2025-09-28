from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import SustainabilityConfig, DEFAULT_CONFIG


def _cfg():
    return SustainabilityConfig(
        model_version=DEFAULT_CONFIG['model_version'],
        weights=DEFAULT_CONFIG['weights_json'],
        toggles=DEFAULT_CONFIG['toggles_json'],
        constants={**DEFAULT_CONFIG['constants_json'], 'extreme_z_threshold': 3.0},
        sd_mode='fixed',
        freshness_days=DEFAULT_CONFIG['freshness_days'],
        config_hash='hash',
        source='default'
    )


def test_anomalies_phase_present():
    games = [
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G1','game_date':'2025-01-01','shots':10,'goals':4,'onice_goals_for':5,'onice_shots_for':20,'points':2,'ixg':1.2,'icf':12,'hdcf':4},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G2','game_date':'2025-01-02','shots':0,'goals':0,'onice_goals_for':1,'onice_shots_for':10,'points':0,'ixg':0.1,'icf':3,'hdcf':1},
    ]
    res = orchestrate_full_run(season_id=2025, games=games, cfg=_cfg(), persist=False)
    d = res.to_dict()
    assert 'anomalies' in d['phases']
    stats = d['phases']['anomalies']
    assert 'total_components' in stats
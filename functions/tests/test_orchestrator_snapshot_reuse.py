from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import SustainabilityConfig, DEFAULT_CONFIG


class FakeDBReuse:
    def fetch_latest_distribution_snapshot(self, window_type, model_version, config_hash):
        # Return a fixed snapshot with thresholds for testing
        return {
            'window_type': window_type,
            'model_version': model_version,
            'config_hash': config_hash,
            'n': 100,
            't20': 0.80,
            't40': 0.70,
            't60': 0.60,
            't80': 0.50,
            'created_at': '2025-01-01T00:00:00Z'
        }


def _cfg():
    return SustainabilityConfig(
        model_version=DEFAULT_CONFIG['model_version'],
        weights=DEFAULT_CONFIG['weights_json'],
        toggles=DEFAULT_CONFIG['toggles_json'],
        constants=DEFAULT_CONFIG['constants_json'],
        sd_mode='fixed',
        freshness_days=DEFAULT_CONFIG['freshness_days'],
        config_hash='hash',
        source='default'
    )


def test_snapshot_reuse_assigns_quintiles():
    games = [
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G1','game_date':'2025-01-02','shots':3,'goals':1,'onice_goals_for':2,'onice_shots_for':12,'points':1,'ixg':0.5,'icf':4,'hdcf':1},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G2','game_date':'2025-01-03','shots':2,'goals':0,'onice_goals_for':1,'onice_shots_for':10,'points':0,'ixg':0.3,'icf':3,'hdcf':1},
    ]
    # Call with build_snapshot False so orchestrator attempts reuse
    res = orchestrate_full_run(
        season_id=2025,
        games=games,
        db_client=FakeDBReuse(),
        cfg=_cfg(),
        persist=True,
        build_snapshot=False,
        assign_tiers=True,
        reuse_snapshot=True,
    )
    d = res.to_dict()
    assert 'snapshot_reuse' in d['phases']
    assert d['phases']['snapshot_reuse']['status'] == 'reused'
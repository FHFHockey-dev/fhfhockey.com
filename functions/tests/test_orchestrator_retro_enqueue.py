from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import SustainabilityConfig, DEFAULT_CONFIG


class CaptureDB:
    def __init__(self):
        self.enqueued = []

    def enqueue_retro_task(self, reason, player_id=None, season_id=None):
        self.enqueued.append({"reason": reason, "player_id": player_id, "season_id": season_id})
        return 1


def _cfg(hash_val: str):
    return SustainabilityConfig(
        model_version=DEFAULT_CONFIG['model_version'],
        weights=DEFAULT_CONFIG['weights_json'],
        toggles=DEFAULT_CONFIG['toggles_json'],
        constants=DEFAULT_CONFIG['constants_json'],
        sd_mode='fixed',
        freshness_days=DEFAULT_CONFIG['freshness_days'],
        config_hash=hash_val,
        source='default'
    )


def test_retro_enqueue_on_config_change():
    db = CaptureDB()
    games = [
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G1','game_date':'2025-01-02','shots':3,'goals':1,'onice_goals_for':2,'onice_shots_for':12,'points':1,'ixg':0.5,'icf':4,'hdcf':1},
    ]
    res = orchestrate_full_run(
        season_id=2025,
        games=games,
        db_client=db,
        cfg=_cfg('new_hash'),
        persist=True,
        previous_config_hash='old_hash',
        enqueue_retro_on_config_change=True,
    )
    d = res.to_dict()
    assert 'retro_enqueue' in d['phases']
    assert db.enqueued and db.enqueued[0]['reason'] == 'config_change'
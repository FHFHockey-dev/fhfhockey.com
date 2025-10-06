from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import DEFAULT_CONFIG, SustainabilityConfig


class FakeDB:
    def fetch_max_barometer_game_date(self, model_version: int, window_type: str):
        return "2025-01-05"  # simulate last processed GAME date

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


def test_incremental_filters_old_games():
    games = [
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G1','game_date':'2025-01-01','shots':3,'goals':1,'onice_goals_for':2,'onice_shots_for':12,'points':1,'ixg':0.5,'icf':4,'hdcf':1},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G2','game_date':'2025-01-05','shots':2,'goals':0,'onice_goals_for':1,'onice_shots_for':10,'points':0,'ixg':0.3,'icf':3,'hdcf':1},
        {'player_id':1,'season_id':2025,'position_code':'F','game_id':'G3','game_date':'2025-01-07','shots':5,'goals':1,'onice_goals_for':3,'onice_shots_for':15,'points':1,'ixg':0.7,'icf':6,'hdcf':2},
    ]
    res = orchestrate_full_run(
        season_id=2025,
        games=games,
        db_client=FakeDB(),
        cfg=_cfg(),
        persist=False,  # still allow incremental filter path to run
        incremental=True,
    )
    d = res.to_dict()
    # Because persist=False incremental phase not triggered (filter only if persist True per logic)
    assert 'incremental_filter' not in d['phases']

    # Force persist=True to exercise filter
    res2 = orchestrate_full_run(
        season_id=2025,
        games=games,
        db_client=FakeDB(),
        cfg=_cfg(),
        persist=True,
        incremental=True,
    )
    d2 = res2.to_dict()
    inc = d2['phases'].get('incremental_filter')
    assert inc['last_processed'] == '2025-01-05'
    assert inc['games_after_filter'] == 1  # only the 2025-01-07 game remains
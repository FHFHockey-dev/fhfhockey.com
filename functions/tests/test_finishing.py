from lib.sustainability.finishing import annotate_finishing_residuals, FINISHING_COUNT_METRIC, FINISHING_RATE_METRIC


def test_annotate_finishing_residuals_basic():
    rows = [{
        'player_id':1,'season_id':2025,'position_code':'F','window_type':'GAME','game_date':'2025-01-01',
        'goals':2,'ixg':1.2,'shots':5
    }]
    sd_constants = {
        FINISHING_COUNT_METRIC: {'F':1.5},
        FINISHING_RATE_METRIC: {'F':0.20},
    }
    out = annotate_finishing_residuals(rows, sd_constants)
    r = out[0]
    assert r[FINISHING_COUNT_METRIC] == 0.8  # 2 - 1.2
    assert abs(r[f'z_{FINISHING_COUNT_METRIC}'] - (0.8/1.5)) < 1e-9
    assert r[f'r_{FINISHING_COUNT_METRIC}'] == 1.0
    assert r[FINISHING_RATE_METRIC] == 0.8/5
    assert abs(r[f'z_{FINISHING_RATE_METRIC}'] - ( (0.8/5)/0.20 )) < 1e-9


def test_annotate_finishing_residuals_handles_zero_shots():
    rows = [{
        'player_id':2,'season_id':2025,'position_code':'F','window_type':'GAME','game_date':'2025-01-02',
        'goals':0,'ixg':0.0,'shots':0
    }]
    sd_constants = {
        FINISHING_COUNT_METRIC: {'F':1.5},
        FINISHING_RATE_METRIC: {'F':0.20},
    }
    out = annotate_finishing_residuals(rows, sd_constants)
    r = out[0]
    # rate variant None due to zero shots
    assert r[FINISHING_RATE_METRIC] is None
    assert r[f'z_{FINISHING_RATE_METRIC}'] is None
    # count residual defined (0 - 0)
    assert r[FINISHING_COUNT_METRIC] == 0.0

from math import isclose, tanh

from lib.sustainability.reliability import compute_reliability
from lib.sustainability.clipping import apply_soft_clipping
from lib.sustainability.contributions import compute_contributions
from lib.sustainability.scoring import apply_logistic_scoring
from lib.sustainability.finishing import annotate_finishing_residuals, FINISHING_RATE_METRIC


def test_zero_exposures_reliability_and_contribution_zero():
    # Row with zero shots / on-ice shots / on-ice goals so reliability denominators are zero
    windows = [{
        'player_id': 1,
        'season_id': 2025,
        'position_code': 'F',
        'window_type': 'GAME',
        'game_date': '2025-01-01',
        'shots': 0,
        'goals': 0,
        'onice_shots_for': 0,
        'onice_goals_for': 0,
        'points': 0,
    }]
    rel = compute_reliability(windows, k_r={'sh_pct':50,'oish_pct':150,'ipp':30})
    r = rel[0]
    assert r['r_sh_pct'] == 0.0
    assert r['r_oish_pct'] == 0.0
    assert r['r_ipp'] == 0.0
    # Add fake z-scores (would normally be None when denom=0) to force contrib calc path
    r['z_sh_pct'] = 1.5
    contrib = compute_contributions([r], weights={'sh_pct':-1.0}, metrics=['sh_pct'])
    assert contrib[0]['contrib_sh_pct'] == 0.0  # r=0 => contribution zero even with z


def test_soft_clipping_extreme_saturation():
    rows = [{'player_id':1,'z_sh_pct':50.0}]
    clipped = apply_soft_clipping(rows, metrics=['sh_pct'], c=3.0)
    val = clipped[0]['zc_sh_pct']
    assert 0.999 < val < 1.0  # saturated but never exactly 1


def test_reliability_monotonic_in_trials():
    base = {
        'player_id': 1,'season_id':2025,'position_code':'F','window_type':'GAME','game_date':'2025-01-01',
        'goals':0,'onice_goals_for':0,'points':0
    }
    # Build rows with increasing shots (trials) for sh_pct
    rows = []
    for shots in [0,5,50,200]:
        r = base.copy()
        r['shots'] = shots
        r['onice_shots_for'] = shots * 3  # scale others just to populate
        r['onice_goals_for'] = max(0, shots // 5)
        rows.append(r)
    rel = compute_reliability(rows, k_r={'sh_pct':50,'oish_pct':150,'ipp':30})
    vals = [r['r_sh_pct'] for r in rel]
    assert vals[0] <= vals[1] <= vals[2] <= vals[3]
    assert vals[-1] > 0.8  # high reliability once trials >> k


def test_guardrails_prevent_0_100_except_extremes():
    rows = [
        {'player_id':1,'contrib_total':0.0},           # logistic center
        {'player_id':2,'contrib_total':8.0},           # very large positive
        {'player_id':3,'contrib_total':-8.0},          # very large negative
    ]
    guardrails = {'lower_raw':0.01,'upper_raw':0.99}
    scored = apply_logistic_scoring(rows, guardrails)
    for r in scored:
        assert 0 < r['score_raw'] < 1  # within open interval
    assert scored[1]['score_raw'] < 0.99  # not hitting exact upper
    assert scored[2]['score_raw'] > 0.01  # not hitting exact lower


def test_finishing_residual_rate_none_when_no_shots():
    row = {'player_id':1,'season_id':2025,'position_code':'F','window_type':'GAME','game_date':'2025-01-01','goals':0,'ixg':0.2,'shots':0}
    out = annotate_finishing_residuals([row], sd_constants={'finish_res_cnt':{'F':1.5},'finish_res_rate':{'F':0.2}})
    r = out[0]
    assert r[FINISHING_RATE_METRIC] is None
    assert r['z_finish_res_rate'] is None

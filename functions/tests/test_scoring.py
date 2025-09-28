from lib.sustainability.scoring import apply_logistic_scoring, attach_components_json


def test_apply_logistic_scoring_basic():
    rows = [
        {'player_id':1,'contrib_total':0.0},
        {'player_id':2,'contrib_total':1.5},
        {'player_id':3,'contrib_total':-2.0},
    ]
    guardrails = {'lower_raw':0.05,'upper_raw':0.95}
    out = apply_logistic_scoring(rows, guardrails)
    r_mid = out[0]
    assert 0.49 < r_mid['score_raw'] < 0.51  # centered logistic ~0.5 scaled
    r_high = out[1]
    assert r_high['score_raw'] > r_mid['score_raw']
    r_low = out[2]
    assert r_low['score_raw'] < r_mid['score_raw']
    # Score integer 0..100
    for r in out:
        assert 0 <= r['score'] <= 100


def test_attach_components_json():
    rows = [{
        'player_id':1,
        'z_sh_pct':0.2,'zc_sh_pct':0.19,'r_sh_pct':0.6,'contrib_sh_pct':-0.1,
        'z_ipp':-0.3,'zc_ipp':-0.28,'r_ipp':0.5,'contrib_ipp':0.05,
        'sh_pct':0.11,'exp_sh_pct':0.10,
    }]
    weights = {'sh_pct':-1.2,'ipp':-0.8}
    out = attach_components_json(rows, metrics=['sh_pct','ipp'], weights=weights, extreme_threshold=0.25)
    comp = out[0]['components_json']
    assert set(comp.keys()) == {'sh_pct','ipp'}
    assert comp['sh_pct']['weight'] == -1.2
    assert comp['ipp']['z'] == -0.3
    assert 'obs' in comp['sh_pct'] and comp['sh_pct']['obs'] == 0.11
    assert 'exp' in comp['sh_pct']
    # With threshold 0.25, z=0.2 should not be extreme, z=-0.3 should be
    assert comp['sh_pct']['extreme'] is False
    assert comp['ipp']['extreme'] is True

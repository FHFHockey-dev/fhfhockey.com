from lib.sustainability.reliability import compute_reliability


def test_compute_reliability_basic():
    windows = [
        {'player_id':1,'window_type':'G5','shots':25,'onice_shots_for':80,'onice_goals_for':10},
        {'player_id':2,'window_type':'G5','shots':0,'onice_shots_for':0,'onice_goals_for':0},
    ]
    k_r = {'sh_pct':50,'oish_pct':150,'ipp':30}
    out = compute_reliability(windows, k_r)
    p1 = out[0]
    # r_sh_pct = sqrt(25/(25+50)) = sqrt(25/75)=sqrt(1/3)=~0.57735
    assert abs(p1['r_sh_pct'] - 0.5773) < 0.001
    # r_ipp = sqrt(10/(10+30)) = sqrt(0.25)=0.5
    assert abs(p1['r_ipp'] - 0.5) < 0.0001
    # Player2 zero trials -> r_sh_pct should be 0
    p2 = out[1]
    assert p2['r_sh_pct'] == 0.0


def test_subset_metrics_and_attach_false():
    windows = [{'player_id':3,'window_type':'G10','shots':40,'onice_shots_for':100,'onice_goals_for':12}]
    k_r = {'sh_pct':50,'oish_pct':150,'ipp':30}
    out = compute_reliability(windows, k_r, metrics=['sh_pct','ipp'], attach=False)
    r = out[0]
    assert 'r_sh_pct' in r and 'r_ipp' in r and 'r_oish_pct' not in r
    assert 'shots' not in r  # due to attach=False

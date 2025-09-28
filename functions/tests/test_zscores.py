from lib.sustainability.zscores import annotate_zscores


def test_annotate_zscores_basic():
    windows = [
        {
            'player_id': 1,
            'position_code': 'F',
            'window_type': 'G5',
            'sh_pct': 0.12,
            'oish_pct': 0.08,
            'ipp': 0.7,
        },
        {
            'player_id': 2,
            'position_code': 'D',
            'window_type': 'G5',
            'sh_pct': None,  # missing
            'oish_pct': 0.06,
            'ipp': 0.55,
        },
    ]
    priors = [
        {'player_id': 1, 'stat_code': 'sh_pct', 'post_mean': 0.10},
        {'player_id': 1, 'stat_code': 'oish_pct', 'post_mean': 0.07},
        {'player_id': 1, 'stat_code': 'ipp', 'post_mean': 0.65},
        {'player_id': 2, 'stat_code': 'oish_pct', 'post_mean': 0.055},
        {'player_id': 2, 'stat_code': 'ipp', 'post_mean': 0.50},
    ]
    sds = {
        'sh_pct': {'F': 0.05, 'D': 0.05},
        'oish_pct': {'F': 0.04, 'D': 0.04},
        'ipp': {'F': 0.10, 'D': 0.08},
    }

    out = annotate_zscores(windows, priors, sds)
    # Player 1 sh_pct delta = 0.02 -> z = 0.4
    p1 = out[0]
    assert round(p1['delta_sh_pct'], 4) == 0.02
    assert round(p1['z_sh_pct'], 4) == 0.4
    # Player 2 sh_pct remains None
    p2 = out[1]
    assert p2['z_sh_pct'] is None
    # Ensure expected keys exist
    assert 'exp_sh_pct' in p1 and 'exp_ipp' in p1


def test_subset_metrics():
    windows = [{'player_id':1,'position_code':'F','window_type':'G5','sh_pct':0.11,'oish_pct':0.09,'ipp':0.6}]
    priors = [
        {'player_id':1,'stat_code':'sh_pct','post_mean':0.10},
        {'player_id':1,'stat_code':'oish_pct','post_mean':0.07},
        {'player_id':1,'stat_code':'ipp','post_mean':0.55},
    ]
    sds = {'sh_pct':{'F':0.05},'oish_pct':{'F':0.04},'ipp':{'F':0.1}}
    out = annotate_zscores(windows, priors, sds, metrics=['sh_pct','ipp'])
    r = out[0]
    assert r['z_sh_pct'] is not None and r['z_ipp'] is not None
    # oish_pct should not be added (no z_oish_pct key)
    assert 'z_oish_pct' not in r

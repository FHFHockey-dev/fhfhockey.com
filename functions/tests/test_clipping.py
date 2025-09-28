from lib.sustainability.clipping import apply_soft_clipping


def test_apply_soft_clipping_basic():
    rows = [
        {'player_id':1,'z_sh_pct':0.0,'z_oish_pct':2.0,'z_ipp':-3.0},
        {'player_id':2,'z_sh_pct':None,'z_oish_pct':5.0,'z_ipp':1.5},
    ]
    out = apply_soft_clipping(rows, metrics=['sh_pct','oish_pct','ipp'], c=3.0)
    r1 = out[0]
    # tanh(0/3)=0
    assert r1['zc_sh_pct'] == 0.0
    # Within bounds (-1,1)
    assert -1 < r1['zc_oish_pct'] < 1
    assert -1 < r1['zc_ipp'] < 1
    # None propagates
    r2 = out[1]
    assert r2['zc_sh_pct'] is None


def test_apply_soft_clipping_invalid_c():
    try:
        apply_soft_clipping([], metrics=['sh_pct'], c=0)
    except ValueError:
        return
    assert False, 'Expected ValueError for c<=0'

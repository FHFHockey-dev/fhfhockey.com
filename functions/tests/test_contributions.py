from lib.sustainability.contributions import compute_contributions


def test_compute_contributions_basic():
    rows = [
        {'player_id':1,'r_sh_pct':0.5,'zc_sh_pct':0.4,'z_sh_pct':0.6,'r_ipp':0.6,'zc_ipp':-0.2,'z_ipp':-0.3},
        {'player_id':2,'r_sh_pct':0.0,'zc_sh_pct':0.5,'z_sh_pct':0.5},
    ]
    weights = {'sh_pct':-1.2,'ipp':-0.8}
    metrics = ['sh_pct','ipp']
    out = compute_contributions(rows, weights, metrics)
    r1 = out[0]
    # contrib_sh_pct = -1.2 * 0.5 * 0.4 = -0.24
    assert abs(r1['contrib_sh_pct'] + 0.24) < 1e-6
    # contrib_ipp = -0.8 * 0.6 * -0.2 = 0.096
    assert abs(r1['contrib_ipp'] - 0.096) < 1e-6
    assert abs(r1['contrib_total'] - (-0.144)) < 1e-6
    r2 = out[1]
    # r_sh_pct=0 => zero contribution
    assert r2['contrib_sh_pct'] == -1.2 * 0.0 * 0.5


def test_compute_contributions_fallback_raw():
    rows = [{'player_id':3,'r_sh_pct':0.5,'z_sh_pct':1.0}]  # no clipped
    weights = {'sh_pct':1.0}
    out = compute_contributions(rows, weights, ['sh_pct'])
    assert out[0]['contrib_sh_pct'] == 0.5 * 1.0 * 1.0

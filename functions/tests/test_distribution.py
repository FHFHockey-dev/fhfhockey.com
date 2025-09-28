from lib.sustainability.distribution import build_distribution_snapshot, assign_quintiles


def test_build_distribution_snapshot_and_assign():
    # Create synthetic scored rows for GAME window
    rows = []
    scores = [10,20,30,40,50,60,70,80,90,100]
    for i,s in enumerate(scores, start=1):
        rows.append({'player_id':i,'season_id':2025,'position_code':'F','window_type':'GAME','score':s})
    snap = build_distribution_snapshot(rows, window_type='GAME', model_version=1, config_hash='abc')
    assert snap is not None
    # thresholds should be within range
    assert 0 <= snap.t20 <= snap.t40 <= snap.t60 <= snap.t80 <= 100
    assigned = assign_quintiles(rows, snap, window_filter='GAME')
    # Highest score should be quintile 1, lowest quintile 5
    by_score = {r['score']: r for r in assigned}
    assert by_score[100]['quintile'] == 1
    assert by_score[10]['quintile'] == 5


def test_assign_quintiles_provisional_when_no_snapshot():
    rows = [{'player_id':1,'season_id':2025,'position_code':'F','window_type':'GAME','score':55}]
    assigned = assign_quintiles(rows, snapshot=None, window_filter='GAME')
    assert assigned[0]['quintile'] is None
    assert assigned[0]['provisional_tier'] is True

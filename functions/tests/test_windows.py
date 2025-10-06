import pytest
from datetime import date, timedelta
from lib.sustainability.windows import build_player_windows, build_all_players_windows


def _make_games(player_id=1, start=date(2025,1,1), n=7):
    games = []
    for i in range(n):
        d = start + timedelta(days=i)
        games.append({
            'player_id': player_id,
            'season_id': 2025,
            'position_code': 'F',
            'game_id': f'G{i+1}',
            'game_date': d.isoformat(),
            'shots': 2 + (i % 3),
            'goals': 1 if i % 4 == 0 else 0,
            'onice_goals_for': 2 + (i % 2),
            'onice_shots_for': 10 + i,
            'points': 1 if i % 3 == 0 else 0,
            'ixg': 0.5 + 0.1 * i,
            'icf': 3 + i,
            'hdcf': 1 + (i % 2),
        })
    return games


def test_build_player_windows_basic_counts():
    games = _make_games(n=6)
    rows = build_player_windows(games, freshness_days=30)
    # For each game we produce 4 window rows -> 6 * 4 = 24
    assert len(rows) == 24
    # Last game's rows
    last_date = games[-1]['game_date']
    last_rows = [r for r in rows if r['game_date'].isoformat() == last_date]
    assert {r['window_type'] for r in last_rows} == {'GAME','G5','G10','STD'}
    # G5 should have n_games = min(5, idx+1) -> last index (5) => 5
    g5 = [r for r in last_rows if r['window_type']=='G5'][0]
    assert g5['n_games'] == 5
    # G10 same as total games (6)
    g10 = [r for r in last_rows if r['window_type']=='G10'][0]
    assert g10['n_games'] == 6
    # STD should also equal total games (6)
    std = [r for r in last_rows if r['window_type']=='STD'][0]
    assert std['n_games'] == 6
    assert std['freshness_applied'] is False


def test_freshness_filter_applied():
    games = _make_games(n=8)
    # Make earlier 3 games older than freshness window
    for i in range(3):
        games[i]['game_date'] = (date(2024,11,1) + timedelta(days=i)).isoformat()
    rows = build_player_windows(games, freshness_days=30)
    # Find STD row for final game
    last_std = [r for r in rows if r['window_type']=='STD' and r['game_date']==rows[-1]['game_date']][-1]
    # Only 5 recent games within freshness window (games 3..7 after adjusting dates)
    assert last_std['n_games'] == 5
    assert last_std['freshness_applied'] is True


def test_build_all_players():
    p1 = _make_games(player_id=1, n=3)
    p2 = _make_games(player_id=2, n=2)
    out = build_all_players_windows(p1 + p2)
    # Each game -> 4 rows
    assert len(out) == (3+2)*4
    assert len({r['player_id'] for r in out}) == 2

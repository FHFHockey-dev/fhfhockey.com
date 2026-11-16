"""Derives dateFrom from the retained 2026-11-01 capture (Codex live-read-01, read only) and writes DATE-FROM.json.
Offline. Deterministic. tests/test_reader.py asserts capture_reader.DATE_MIN equals the choice made here.
    env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B justify_date_from.py [--write]
"""
import collections
import datetime as dt
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
RETAINED = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')
CAP = 10000
THROUGH = dt.date(2026, 11, 11)
LAST_RETAINED_GAME = None  # derived below
FIRST_GAME_AFTER_1111 = 2026020299  # the 11-11 slate is 2026020293..298 (bridge conversion schedule; POST-CAPTURE step 5)
WINDOW_PERCENTILE = 0.99


def analyse():
    r = json.loads(RETAINED.read_text())
    wgo, cal = r['wgo']['rows'], r['calendar']['rows']
    rows_by_date = collections.Counter(x['date'] for x in wgo)
    games_by_date = collections.Counter(g['date'] for g in cal)
    rows_per_game_max = max(rows_by_date[d] / games_by_date[d] for d in games_by_date)
    dup_player_dates = sum(1 for v in collections.Counter((x['player_id'], x['date']) for x in wgo).values() if v > 1)
    last_game = max(g['id'] for g in cal)
    new_games = FIRST_GAME_AFTER_1111 - 1 - last_game            # 2026020227..298
    new_rows = int(round(rows_per_game_max * new_games))           # <= 36 skaters per game
    # latest-five span for players active on the last two retained dates
    by_player = collections.defaultdict(list)
    for x in wgo:
        by_player[x['player_id']].append(x['date'])
    spans = sorted((dt.date.fromisoformat(d[-1]) - dt.date.fromisoformat(d[-5])).days
                   for d in (sorted(v) for v in by_player.values()) if len(d) >= 5 and d[-1] >= '2026-10-30')
    p = spans[min(len(spans) - 1, int(len(spans) * WINDOW_PERCENTILE))]
    choice = (THROUGH - dt.timedelta(days=p)).isoformat()

    def projected(date_from):
        kept = sum(n for d, n in rows_by_date.items() if d >= date_from)
        return kept + new_rows

    candidates = {}
    for back in (14, 21, 28, 35, 42, 49):
        d = (THROUGH - dt.timedelta(days=back)).isoformat()
        n = projected(d)
        candidates[d] = {'daysBack': back, 'projectedRows': n, 'headroomRows': CAP - n, 'pages': -(-n // 400),
                         'dispatches': 6 + 1 + 1 + -(-n // 400) + 1 + 1,
                         'latestFiveCoverage': round(sum(s <= back for s in spans) / len(spans), 4)}
    full = len(wgo) + new_rows
    return {
        'version': 'fhfh.blsh.request-reader-date-from.v1', 'source': str(RETAINED), 'cap': CAP,
        'retained': {'wgoRows': len(wgo), 'dates': [min(rows_by_date), max(rows_by_date)], 'games': len(cal),
                     'lastGameId': last_game, 'rowsPerGameMax': rows_per_game_max, 'duplicatePlayerDates': dup_player_dates,
                     'rowsByDate': dict(sorted(rows_by_date.items())), 'gamesByDate': dict(sorted(games_by_date.items()))},
        'projection': {'newGames': new_games, 'newGameIds': [last_game + 1, FIRST_GAME_AFTER_1111 - 1], 'newRowsUpperBound': new_rows,
                       'fullSeasonRows': full, 'fullSeasonExceedsCap': full > CAP},
        'latestFiveSpanDays': {'players': len(spans), 'p50': spans[len(spans) // 2], 'p90': spans[int(len(spans) * .9)],
                               'p95': spans[int(len(spans) * .95)], 'p99': p, 'max': spans[-1]},
        'choice': {'dateFrom': choice, 'rule': '2026-11-11 minus the p99 latest-five span', **candidates[choice]},
        'candidates': candidates,
        'note': 'Projection assumes <= 36 WGO rows per game (retained max 36.0, 0 duplicate player-dates) and that game ids '
                '2026020227..298 are the games played 11-01..11-11. A cap hit is a no-retry stop, so headroom wins over coverage.',
    }


if __name__ == '__main__':
    result = analyse()
    body = json.dumps(result, indent=2) + '\n'
    if '--write' in sys.argv:
        (ROOT / 'DATE-FROM.json').write_text(body)
    print(json.dumps(result['choice']))

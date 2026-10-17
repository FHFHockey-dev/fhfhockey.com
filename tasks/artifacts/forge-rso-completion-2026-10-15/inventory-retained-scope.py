"""Offline inventory only: never generates values, reads services or admits coverage."""
import hashlib
import json
import sys
from pathlib import Path

snapshot_path, games_path, output_path = map(Path, sys.argv[1:])
source = json.loads(snapshot_path.read_text())
snapshot = source['snapshot']
games = json.loads(games_path.read_text())
players = {p['id']: p for p in snapshot['players']}
owned = list(dict.fromkeys(row['playerId'] for row in snapshot['roster']))
rows = []
for player_id in owned:
    player = players.get(player_id)
    team = player.get('nhlTeamId') if player else None
    scheduled = sorted((g for g in games if team is not None and team in (g['homeTeamId'], g['awayTeamId'])),
                       key=lambda g: (g['date'], g['startTime'], g['id']))
    rows.append({'playerId': player_id, 'nhlId': player.get('nhlId') if player else None,
                 'teamId': team, 'name': player.get('name') if player else None,
                 'identityState': 'retained_binding_requires_current_verification' if team else 'missing_team_or_identity',
                 'horizons': {str(n): {'requestedScheduledGames': n,
                    'observedGameIds': [g['id'] for g in scheduled[:n]],
                    'observedGameStarts': [g['startTime'] for g in scheduled[:n]],
                    'unresolvedScheduleSlots': max(0, n - len(scheduled)),
                    'forecastState': 'not_produced_or_read_in_this_capture',
                    'complete': False} for n in (1, 10, 20)}})
report = {'version': 'forge-rso-retained-universe-inventory-v1',
          'inputs': {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in (snapshot_path, games_path)},
          'context': snapshot['context'], 'snapshotExportedAt': source['exportedAt'],
          'rosterEvidence': snapshot['evidence']['roster'], 'rosterCount': len(owned),
          'observedOtherCanonicalPlayers': len(set(players) - set(owned)),
          'evaluatedCandidateCount': 0,
          'candidateLimitation': 'Retained export has unknown league availability. No evaluated acquisition universe is certified.',
          'actualScoring': snapshot['rules']['scoring'],
          'managerConfirmedRules': {'acquisitionTiming': 'same_day', 'acquisitionCost': 1,
            'currentPeriodRemaining': 2, 'reset': 'Monday 03:00 America/New_York', 'futureAllowance': None,
            'source': 'direct user decision; not written to saved plan'},
          'players': rows,
          'totals': {str(n): {'expectedSlots': len(owned) * n,
              'observedScheduledBindings': sum(len(p['horizons'][str(n)]['observedGameIds']) for p in rows),
              'unresolvedScheduleSlots': sum(p['horizons'][str(n)]['unresolvedScheduleSlots'] for p in rows),
              'admittedForecastsVerified': 0, 'complete': False} for n in (1, 10, 20)},
          'limitations': ['Schedule rows are metadata, not independent source completeness witnesses.',
            'No fresh native inputs, participation denominator, starter or PP-role receipt has been acquired.',
            'No forecast/outcome bodies, private pilots or sealed evaluation outcomes were read.',
            'All values and league totals remain unavailable; observed bindings do not certify a release universe.']}
with output_path.open('x') as output:
    json.dump(report, output, indent=2)
output_path.chmod(0o600)
print(json.dumps({'rosterCount': len(owned), 'totals': report['totals'], 'output': str(output_path)}))

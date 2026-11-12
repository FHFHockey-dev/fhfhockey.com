"""Offline AST extraction of actual Python season helpers; no application imports."""
import ast
import hashlib
import json
import math
import socket
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

def forbidden(*args, **kwargs):
    raise RuntimeError('NETWORK_FORBIDDEN')
socket.create_connection = forbidden
socket.socket.connect = forbidden
root = Path(__file__).resolve().parents[5]
source = root / 'modeling/player_forecasts/season.py'
names = {'_round_number', '_portable_canonical_json', '_reconcile', '_target_multiplier', '_reconcile_quantiles', '_quantiles', 'evaluate_season_game', '_aggregate_components'}
tree = ast.parse(source.read_text())
selected = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
assert {n.name for n in selected} == names
namespace = dict(globals(), GOALIE_TARGETS=(), SKATER_TARGETS=())
exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), 'exec'), namespace)
data = json.load(sys.stdin)
if isinstance(data, dict) and data.get('mode') == 'advanced':
    advanced_source = root / 'modeling/player_forecasts/advanced.py'
    advanced_tree = ast.parse(advanced_source.read_text())
    funcs = [n for n in advanced_tree.body if isinstance(n, ast.FunctionDef) and n.name in {'_number', '_rounded', '_policy_for', '_advanced_rate'}]
    constants = [n for n in advanced_tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id in {'SKATER_ADVANCED_TARGETS', 'GOALIE_ADVANCED_TARGETS'} for t in n.targets)]
    parent = next(n for n in advanced_tree.body if isinstance(n, ast.FunctionDef) and n.name == 'project_advanced_release')
    game_rows = next(n for n in parent.body if isinstance(n, ast.FunctionDef) and n.name == 'game_rows')
    io_tree = ast.parse((root / 'modeling/player_forecasts/io.py').read_text())
    canonical = next(n for n in io_tree.body if isinstance(n, ast.FunctionDef) and n.name == 'canonical_json')
    namespace.update(artifact=data['advanced'], v4_bundle=Path('/synthetic'), v4_manifest={'files': {'game-outputs': {'path': 'synthetic'}}},
        read_jsonl=lambda _: [data['baseOutput']], aggregate_means=defaultdict(lambda: defaultdict(float)),
        aggregate_variances=defaultdict(lambda: defaultdict(float)), fallback_flags=defaultdict(set), component_counts=defaultdict(int))
    exec(compile(ast.Module(body=constants + funcs + [canonical, game_rows], type_ignores=[]), str(advanced_source), 'exec'), namespace)
    json.dump(list(namespace['game_rows']())[0], sys.stdout)
    sys.exit(0)
results = []
for case in data:
    a, g = case['artifact'], case['game']
    game = {'game_id': g['gameId'], 'team_id': g['teamId'], 'opponent_team_id': g['opponentTeamId'], 'is_home': g['isHome'], 'scheduled_start_at': g['scheduledStartAt']}
    results.append(namespace['evaluate_season_game'](a, a['players']['1'], game))
json.dump(results, sys.stdout)

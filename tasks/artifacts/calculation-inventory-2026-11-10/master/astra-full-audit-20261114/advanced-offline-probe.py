"""Offline AST-isolated probes of exact audited functions; no app imports or DB calls."""
import ast
from collections import defaultdict
from datetime import date, datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import tempfile
from typing import Any
from types import SimpleNamespace
import pytest

ROOT = Path('/Users/tim/Code/fhfhockey.com')
ns = dict(globals())
def load_nodes(relative, names=None, assignments=False):
    path = ROOT / relative
    tree = ast.parse(path.read_text(), filename=str(path))
    nodes = [ast.ImportFrom(module='__future__', names=[ast.alias(name='annotations')], level=0)]
    nodes += [n for n in tree.body if
              (isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and (names is None or n.name in names))
              or (assignments and isinstance(n, (ast.Assign, ast.AnnAssign)))]
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), str(path), 'exec'), ns)

load_nodes('modeling/player_forecasts/contract.py', names=set(), assignments=True)
load_nodes('modeling/player_forecasts/io.py', names={'canonical_json','read_json','read_jsonl','write_json','write_jsonl'})
load_nodes('modeling/player_forecasts/advanced.py', assignments=True)
load_nodes('modeling/player_forecasts/season.py', names={'_finite_or_none','_portable_canonical_json','_round_number','verify_season_settlement_bundle'})
ns['SEASON_ID'] = 20262027
ns['season_module'] = SimpleNamespace(verify_season_settlement_bundle=ns['verify_season_settlement_bundle'])
load_nodes('modeling/player_forecasts/tests/test_harness.py', names={'_jsonl','test_v5_settlement_merges_cutoff_safe_advanced_actuals','test_v5_evaluation_receipt_requires_every_advanced_target'})
tmp = Path(tempfile.mkdtemp(prefix='astra-advanced-audit-'))
settlement_root = tmp / 'settlement'
settlement_root.mkdir()
ns['test_v5_settlement_merges_cutoff_safe_advanced_actuals'](settlement_root)
evaluation_root = tmp / 'evaluation'
evaluation_root.mkdir()
ns['test_v5_evaluation_receipt_requires_every_advanced_target'](evaluation_root)
results = {'sourceSha256': hashlib.sha256((ROOT/'modeling/player_forecasts/advanced.py').read_bytes()).hexdigest(),
           'tmp': str(tmp), 'existingFixtureAssertions': '2 existing test functions passed via exact AST nodes'}

freeze = settlement_root/'advanced-freeze'
players = {1:{'nhlPlayerId':1001,'population':'forward'},2:{'nhlPlayerId':2001,'population':'goalie'}}
audit = ns['read_json'](freeze/'source-audit.json')
base_files = {p.name:p.read_text() for p in freeze.glob('*.jsonl')}
def restore():
    for name, text in base_files.items():
        (freeze/name).write_text(text)
def observations():
    return ns['_build_advanced_observations'](freeze,players,audit)
def rows(name):
    return list(ns['read_jsonl'](freeze/(name+'.jsonl')))
def put(name, values):
    ns['write_jsonl'](freeze/(name+'.jsonl'), values)

restore()
onice = rows('player_on_ice')
onice[0]['source_available_at']='2026-10-02T08:00:00+00:00'
onice[0]['on_ice_expected_goals_for']=None
put('player_on_ice',onice)
manifest = ns['read_json'](freeze/'manifest.json')
manifest['files']['player_on_ice']['sha256']=ns['_file_sha256'](freeze/'player_on_ice.jsonl')
manifest.pop('manifestHash')
manifest['manifestHash']=hashlib.sha256(ns['canonical_json'](manifest).encode()).hexdigest()
ns['write_json'](freeze/'manifest.json',manifest)
before = observations()['skaterGames'][(1,2026020001)]['values']['ON_ICE_EXPECTED_GOALS_FOR']
bundle=ns['build_advanced_settlement_bundle'](settlement_root/'base-settlement', freeze, tmp/'null-settlement')
after=list(ns['read_jsonl'](tmp/'null-settlement'/'outcomes.jsonl'))[0]['primitiveValues']['ON_ICE_EXPECTED_GOALS_FOR']
assert before is None and after==0
results['nullSettlement']={'observation':before,'settledValue':after,'pendingGames':bundle['advancedPendingGameIds'],
                           'verification':ns['verify_season_settlement_bundle'](tmp/'null-settlement')}

restore()
put('shot_predictions',[])
put('player_rebounds',[])
obs=observations()['skaterGames'][(1,2026020001)]
assert obs['values']['EXPECTED_GOALS']==0 and obs['values']['REBOUNDS_CREATED']==0
results['missingFamilyDefaults']={'values':{k:obs['values'][k] for k in ['EXPECTED_GOALS','REBOUNDS_CREATED']},'sources':obs['sourceNames']}

restore()
features=rows('shot_features')
features[0].update(event_id=10,feature_version='feature-v1')
features.append({**features[0],'feature_version':'feature-v2'})
put('shot_features',features)
count=observations()['skaterGames'][(1,2026020001)]['values']['SHOT_ATTEMPTS']
assert count==2
results['twoFeatureVersionsOneEvent']={'events':1,'featureRows':2,'shotAttempts':count}

restore()
audit['approvedModels']=[]
predictions=rows('shot_predictions')
predictions[0].update(event_id=10,model_version='retired-v1',xg=0.25)
predictions.append({**predictions[0],'model_version':'retired-v2','xg':0.5})
put('shot_predictions',predictions)
value=observations()['skaterGames'][(1,2026020001)]['values']['EXPECTED_GOALS']
assert value==0.75
results['noChampion']={'shotEvents':1,'modelVersions':2,'expectedGoals':value}
audit=ns['read_json'](freeze/'source-audit.json')

restore()
features=rows('shot_features')
features[0].update(event_id=10,is_penalty_shot_event=True)
put('shot_features',features)
predictions=rows('shot_predictions')
predictions[0]['event_id']=10
put('shot_predictions',predictions)
values=observations()['skaterGames'][(1,2026020001)]['values']
assert values['SHOT_ATTEMPTS']==0 and values['EXPECTED_GOALS']==0.25
results['penaltyShotScope']={'shotAttempts':values['SHOT_ATTEMPTS'],'expectedGoals':values['EXPECTED_GOALS']}

policy_rows=[{'entityId':entity,'gameDate':f'2026-01-{3+game:02d}','values':{'EXPECTED_GOALS':float(entity%2)}}
             for entity in range(20) for game in range(5)]
policy,rates=ns['_fit_rate_policy'](policy_rows,'EXPECTED_GOALS',10.0,1.0)
assert policy['eligibleForServing'] and not policy['fallback'] and policy['trainingRows']==100
results['validationAsTraining']={k:policy[k] for k in ['trainingRows','rows','modelFamily','validationMae','baselineMae','eligibleForServing']}
before=ns['_fit_rate_policy'](policy_rows,'EXPECTED_GOALS',10,1)[1]['0']
later=policy_rows+[{'entityId':0,'gameDate':'2026-10-01','values':{'EXPECTED_GOALS':100.0}}]
after=ns['_fit_rate_policy'](later,'EXPECTED_GOALS',10,1)[1]['0']
assert before!=after
results['postTrainingCutoffChangesRate']={'before':before,'after':after,'futureDate':'2026-10-01','declaredTrainingCutoff':'2026-04-16T23:59:59Z'}

artifact_path=evaluation_root/'advanced-artifact'/'season-artifact.json'
artifact=ns['read_json'](artifact_path)
for population in artifact['targetPolicies'].values():
    for policy in population.values():
        policy.update(validationMae=100.0,baselineMae=1.0,intervalCalibrationStatus='uncalibrated',calibrationEmittedIntervalCoverage=1.0)
ns['write_json'](artifact_path,artifact)
ns['write_json'](artifact_path.parent/'artifact-manifest.json',{'artifactChecksum':ns['_file_sha256'](artifact_path)})
receipt=ns['evaluate_advanced_batch'](artifact_path.parent,tmp/'worse-model-receipt.json')
assert receipt['eligibleForRelease'] and not receipt['blockers']
results['evaluationGate']={'eligibleForRelease':receipt['eligibleForRelease'],'validationMae':100,'baselineMae':1,
                           'intervalCalibrationStatus':'uncalibrated','emittedCoverage':1.0,'blockers':receipt['blockers']}
print(json.dumps(results,indent=2,sort_keys=True))

"""Exact source nodes, stdlib only; no training/app imports/database/network."""
import ast,json,hashlib,math,tempfile
from collections import defaultdict
from datetime import datetime,date,timedelta,timezone
from pathlib import Path
from typing import Any,Iterable
from zoneinfo import ZoneInfo
root=Path('/Users/tim/Code/fhfhockey.com');ns=dict(globals())
def load(path,select):
 tree=ast.parse((root/path).read_text())
 nodes=[ast.ImportFrom(module='__future__',names=[ast.alias(name='annotations')],level=0)]+[n for n in tree.body if select(n)]
 exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),str(root/path),'exec'),ns)
load('modeling/player_forecasts/contract.py',lambda n:isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in {'SEASON_CONTRACT_VERSION','SEASON_CONTRACT_SHA256','FANTASY_SEASON_CONTRACT_VERSION','FANTASY_SEASON_CONTRACT_SHA256','ADVANCED_SEASON_CONTRACT_VERSION','ADVANCED_SEASON_CONTRACT_SHA256'})
load('modeling/player_forecasts/io.py',lambda n:isinstance(n,ast.FunctionDef) and n.name in {'read_json','read_jsonl','write_json','write_jsonl','canonical_json'})
load('modeling/player_forecasts/season.py',lambda n:(isinstance(n,ast.Assign) and (n.lineno<72 or n.lineno>=4080)) or (isinstance(n,ast.FunctionDef) and (n.lineno>=4051 or n.name=='_file_sha256')))
work=Path(tempfile.mkdtemp(prefix='fixture-',dir='/tmp/astra-season-tail'))
freeze=work/'freeze';freeze.mkdir()
write=ns['write_json'];jsonl=ns['write_jsonl'];season=ns['SEASON_ID'];version=ns['SEASON_CONTRACT_VERSION'];checksum=ns['SEASON_CONTRACT_SHA256']
write(freeze/'manifest.json',{'contractChecksum':checksum,'scheduleRevisionHash':'fixture-schedule','rosterRevisionHash':'fixture-roster','createdAt':'2026-10-01T00:00:00Z','transactionCoverage':{'complete':True,'cutoffAt':'2026-10-02T00:00:00Z'}})
schedule=[{'game_id':1,'scheduled_start_at':'2026-10-01T21:00:00Z','game_date':'2026-10-01','game_status':'final','home_team_id':1,'away_team_id':2}]
write(freeze/'schedule.json',schedule)
write(freeze/'player-pool.json',[{'nhl_player_id':10,'fhfh_player_id':1},{'nhl_player_id':20,'fhfh_player_id':2}])
row={'season_id':season,'game_id':1,'nhl_player_id':10,'position':'C','source_available_at':'2026-10-01T21:30:00Z','GAMES_PLAYED':1,'GOALS':1}
jsonl(freeze/'skaters.jsonl',[row]);jsonl(freeze/'goalies.jsonl',[])
jsonl(freeze/'games.jsonl',[{'game_id':1,'start_time':schedule[0]['scheduled_start_at'],'game_status':'started'}])
settled=work/'partial-settlement';manifest=ns['build_season_settlement_bundle'](freeze,settled,'2026-10-02T00:00:00Z')
verification=ns['verify_season_settlement_bundle'](settled)
assert len(manifest['completedGames'])==1 and manifest['outcomes']['rows']==1 and verification['valid']
results={'partial_settlement':{'completedGames':manifest['completedGames'],'outcomes':manifest['outcomes']['rows'],'verification':verification,'unobservedMappedPlayer':2}}
schedule[0]['game_status']='started';write(freeze/'schedule.json',schedule)
actuals=ns['_actuals_by_player'](freeze,'2026-10-01T22:00:00Z')
assert actuals[10]['GOALS']==1
notfinal=ns['build_season_settlement_bundle'](freeze,work/'nonfinal-settlement','2026-10-01T22:00:00Z')
assert notfinal['outcomes']['rows']==0
results['nonfinal_actuals']={'current_actual_goals':actuals[10]['GOALS'],'settlement_outcomes':notfinal['outcomes']['rows'],'status':'started','cutoff':'2026-10-01T22:00:00Z'}
player={'fhfhPlayerId':1,'nhlPlayerId':10,'playerName':'Fixture','population':'forward','position':'C','teamId':1,'poolStatus':'excluded','rosterConfidence':1,'ratingConfidence':0,'sampleGames':0,'ratings':{},'deployment':{},'fallbackFlags':[], 'playProbability':1,'conditionalRates':{'GOALS':1},'conditionalVariances':{'GOALS':1},'primitiveTargets':['GAMES_PLAYED','GOALS']}
artifact={'schemaVersion':'player-forecast-season-artifact-v1','seasonId':season,'contractVersion':version,'contractChecksum':checksum,'artifactVersion':'fixture','featureSchemaVersion':'fixture','codeVersion':'fixture','trainingCutoffAt':'2026-04-16T23:59:59Z','players':{'1':player},'teams':{str(i):{'ratings':{},'sampleGames':0,'scheduleNeutralGoalDifferential':0} for i in range(1,33)}}
write(work/'artifact.json',artifact)
write(freeze/'teams.json',[{'team_id':i,'name':str(i),'abbreviation':str(i)} for i in range(1,33)])
for name,body in [('season.json',{'id':season}),('player-pool-review.json',[])]:write(freeze/name,body)
for name in ['deployment_tallies.jsonl','line_snapshots.jsonl']:jsonl(freeze/name,[])
schedule[0].update(game_status='scheduled',scheduled_start_at='2026-10-03T21:00:00Z',game_date='2026-10-03');write(freeze/'schedule.json',schedule)
projected=ns['project_season_release'](freeze,work/'artifact.json',work/'excluded-release','ros','2026-10-02T00:00:00Z')
aggregates=list(ns['read_jsonl'](work/'excluded-release/player-aggregates.jsonl'))
assert projected['files']['game-outputs']['rows']==1 and aggregates[0]['expected_games']==1
results['excluded_player']={'game_outputs':projected['files']['game-outputs']['rows'],'pool_status':aggregates[0]['pool_status'],'expected_games':aggregates[0]['expected_games'],'goals':aggregates[0]['model_means']['GOALS'],'release_verification':ns['verify_season_release_bundle'](work/'excluded-release')}
goalie={'fhfhPlayerId':2,'population':'goalie','playProbability':1,'startProbability':1,'primitiveTargets':['GAMES_PLAYED','GAMES_STARTED','WINS_GOALIE'],'conditionalRates':{'WINS_GOALIE':.8},'conditionalVariances':{'WINS_GOALIE':.16},'deployment':{}}
evaluated=ns['evaluate_season_game'](artifact,goalie,{'game_id':1,'team_id':1,'opponent_team_id':2})
assert evaluated['quantiles']['p90']['WINS_GOALIE']>1
results['binary_outcome_quantile']={'mean':evaluated['unconditionalMeans']['WINS_GOALIE'],'variance':evaluated['variances']['WINS_GOALIE'],'quantiles':{k:v['WINS_GOALIE'] for k,v in evaluated['quantiles'].items()},'correct_bernoulli_quantiles':{'p10':0,'p50':1,'p90':1}}
results['sourceSha256']=hashlib.sha256((root/'modeling/player_forecasts/season.py').read_bytes()).hexdigest();results['fixture_root']=str(work)
print(json.dumps(results,indent=2));Path('/tmp/astra-season-tail/results.json').write_text(json.dumps(results,indent=2))

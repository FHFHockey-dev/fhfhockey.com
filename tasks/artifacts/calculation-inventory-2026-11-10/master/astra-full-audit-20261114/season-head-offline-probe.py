"""Exact isolated source functions, synthetic local fixtures only."""
import ast
from collections import defaultdict
from datetime import date, datetime, timezone
import hashlib, json, math, tempfile
from pathlib import Path
from typing import Any, Iterable

root=Path('/Users/tim/Code/fhfhockey.com')
ns=dict(globals(), TRAINING_CUTOFF_SEASON=20252026)
def load(relative,names):
    tree=ast.parse((root/relative).read_text())
    nodes=[ast.ImportFrom(module='__future__',names=[ast.alias(name='annotations')],level=0)]
    nodes.extend(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names)
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes,type_ignores=[])),str(root/relative),'exec'),ns)
load('modeling/player_forecasts/io.py',{'canonical_json','read_json','read_jsonl','write_json','write_jsonl'})
load('modeling/player_forecasts/season.py',{'_round_number','_finite_or_none','_percentile','_team_contexts',
 '_roster_adjusted_team_contexts','_participation_summary','_season_total_outcome_audit',
 '_official_landing_assist_labels','_resolve_unresolved_assist_labels'})
tmp=Path(tempfile.mkdtemp(prefix='astra-season-head-'))
results={'sourceSha256':hashlib.sha256((root/'modeling/player_forecasts/season.py').read_bytes()).hexdigest(),'tmp':str(tmp)}

rows=[{'season_id':20252026,'game_id':1,'team_id':1,'opponent_team_id':2,'goals_for':3,'goals_against':2,
       'shots_for':30,'shots_against':30,'pp_goals':1,'pp_opportunities':4,'pk_goals_against':1,'pk_opportunities':4}]
contexts=ns['_team_contexts'](rows,[{'team_id':1},{'team_id':2}])
assert contexts['2']['sampleGames']==0 and contexts['2']['ratings']['goaltending']==75
adjusted=ns['_roster_adjusted_team_contexts'](contexts,{})
results['emptyTeamContext']={'base':contexts['2'],'rosterAdjustedEmpty':adjusted['2']}

appearances=[{'season_id':20252026,'game_id':i,'team_id':1 if i<3 else 2,'nhl_player_id':10,'GAMES_PLAYED':1}
             for i in range(1,5)]
summary=ns['_participation_summary']({'forward':appearances})[('forward',10)][20252026]
assert summary['appearances']==4 and summary['opportunities']==2
results['tradedParticipation']=dict(summary,observedAppearanceFraction=summary['appearances']/summary['opportunities'])

totals=tmp/'totals.jsonl'
ns['write_jsonl'](totals,[{'season_id':20252026,'nhl_player_id':10,'GOALS':None,'PRIMARY_ASSISTS':None,
  'SECONDARY_ASSISTS':None,'ASSISTS':None,'POINTS':None,'TOTAL_TOI':3600,'EV_TOI':3600,'PP_TOI':None,'PK_TOI':None}])
audit=ns['_season_total_outcome_audit'](totals,'2026-11-14T12:00:00Z')
assert audit['eligibleForExposureModel']
results['unknownSeasonTotalsAccepted']=audit

skaters=tmp/'skaters.jsonl'
ns['write_jsonl'](skaters,[{'season_id':20252026,'game_id':2025020001,'nhl_player_id':10,'game_date':'2025-10-01',
  'source_available_at':'2025-10-02T00:00:00Z','PRIMARY_ASSISTS':None,'SECONDARY_ASSISTS':None,
  'BOX_SCORE_ASSISTS':1}])
calls=[]
def fake_capture(url):
    calls.append(url)
    return {'id':2025020001,'gameState':'OFF','summary':{'scoring':[{'goals':[
      {'playerId':11,'strength':'ev','assists':[{'playerId':10}]}]}]}},'fixture-hash'
ns['_fetch_json_capture']=fake_capture
captures=ns['_resolve_unresolved_assist_labels'](skaters,{'unresolved':[{'gameId':2025020001,'nhlPlayerId':10}]},'2026-11-14T12:00:00Z')
corrected=list(ns['read_jsonl'](skaters))[0]
assert corrected['PRIMARY_ASSISTS']==1 and corrected['source_available_at']=='2025-10-02T00:00:00Z'
results['resolvedLabelAvailability']={'corrected':corrected,'capture':captures[0],'mockCalls':len(calls)}
print(json.dumps(results,sort_keys=True,indent=2))

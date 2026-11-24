import sys,json,csv,collections as co
from pathlib import Path
p=Path(sys.argv[1])
d=json.load(open(p/'daily.json')); s=json.load(open(p/'start.json')); data=d['data']['data']; w=d['bridgeForecasts']; players={x['id']:x for x in data['players']}; gd={x['id']:x['date'] for x in data['games']}
dates=dict(zip(['0203c9b0','db190142','0ddc93e3','5dc35244','df4b39a8','b8da5fb9','f20889ee'],['2026-11-'+str(i) for i in range(23,30)]))
fields=['GOALS','ASSISTS','PP_POINTS','SHOTS_ON_GOAL','HITS','BLOCKED_SHOTS','PENALTY_MINUTES']
keys={}; summary=co.Counter(); detail={}; types=co.Counter(); manifest=data['forecastManifest']; results={}
for r in w['rows']:
 pl=players[r[0]]; sk=pl['playerClass']=='skater'; pid=pl['nhlId']; run=w['runs'][r[2]][0].split(':')[-1][:8]; code=r[8] if len(r)>8 else None; con=r[7] if len(r)>7 and r[7] else {}; stats=r[4]; core='GOALS' if sk else 'SAVES_GOALIE'; available=stats.get(core) is not None; exactDate=dates.get(run)==gd[r[1]]
 k=(str(pid),r[1]); ent=(run,code,available,exactDate);summary['duplicate_wire_keys']+= k in keys;keys[k]=ent
 types[(code or 'regular',available,bool(con.get(core) is not None),exactDate)]+=1
 summary['expected_value_missing']+=not available;summary['numeric']+=available
 if pl['name'] in ('John Tavares','Jake DeBrusk','Ivan Demidov','Jake Oettinger','Dylan Larkin','Nathan MacKinnon','Cale Makar','Quinn Hughes'):
  detail.setdefault(pl['name'],[]).append(dict(game=r[1],date=gd[r[1]],run=run,evidence=code or 'regular',expected={k:stats.get(k) for k in (fields if sk else ['SAVES_GOALIE','GOALS_AGAINST_GOALIE','WINS_GOALIE','GOALIE_MINUTES'])},conditional={k:con.get(k) for k in ([core] if sk else ['SAVES_GOALIE','SHOTS_AGAINST_GOALIE','WINS_GOALIE','GOALIE_MINUTES'])},start=r[5]))
per={}; total=co.Counter(); outside=co.Counter()
for z in csv.DictReader(open(p/'player-game-keys.csv')):
 h=int(z['team_horizon']);key=(z['player_id'],z['nhl_game_id']); stored=z['writer']!='missing'; wire=keys.get(key); official=z['affiliation_basis']=='official'
 c=per.setdefault((h,z['player_class']),co.Counter()) if official else outside
 c['eligible']+=1;c['stored']+=stored;c['no_wire']+=not wire;c['stored_no_wire']+=stored and not wire
 if wire:
  run,code,available,exact=wire;c['wire']+=1;c['value']+=available;c['unknown']+=not available;c['different_run_date']+=not exact;c['stored_other_or_no_wire']+=stored and not exact;c['same_date_numeric']+=stored and exact and available;c['same_date_cond_only']+=stored and exact and not available
 if official:total['stored']+=stored;total['missing']+=not stored
res={'http':{'daily':d['forecastSource'],'start':s['coverage'],'start_source':[s['projectionRunId'],s['skaterSource'],s['goalieSource'],s['goalieStartBasis']]},'manifest':{k:manifest[k] for k in ['asOf','requiredOpportunities','forecastedOpportunities','exclusionCounts']},'weekly':dict(summary),'weekly_types':[[*k,v] for k,v in types.items()],'per_horizon':{str(key):dict(c) for key,c in per.items()},'total':dict(total),'other_memberships':dict(outside),'players':detail}
(p/'consumer-match.json').write_text(json.dumps(res,indent=2))
print(res['manifest'],res['weekly'],res['weekly_types']);print({h:dict(c) for h,c in sorted(per.items()) if h[0]<=4});print('totals',total,outside)
for pl,ls in detail.items(): print(pl,[(x['game'],x['run'],x['evidence'],x['expected'].get('GOALS',x['expected'].get('SAVES_GOALIE')),x['conditional'].get('GOALS',x['conditional'].get('SAVES_GOALIE'))) for x in ls]);print('')

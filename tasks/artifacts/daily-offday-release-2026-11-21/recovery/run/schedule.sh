#!/bin/zsh
# Prints each of the 13 games' state and minutes to start; exit 1 if any started or <20 min.
curl -s -m 10 "https://api-web.nhle.com/v1/schedule/2026-11-21" | python3 -I -c "
import json,sys,datetime
ids=set(range(2026020360,2026020373)); now=datetime.datetime.now(datetime.timezone.utc); bad=0
d=json.load(sys.stdin)
for day in d['gameWeek']:
  for g in day['games']:
    if g['id'] in ids:
      st=datetime.datetime.fromisoformat(g['startTimeUTC'].replace('Z','+00:00')); m=(st-now).total_seconds()/60
      ok=g['gameState'] in ('FUT','PRE') and m>=20; bad|= not ok; ids.discard(g['id'])
      print(g['id'],g['gameState'],g['startTimeUTC'],round(m,1),'ok' if ok else 'STOP')
if ids: print('missing',sorted(ids)); bad=1
print('now',now.isoformat()); sys.exit(1 if bad else 0)"

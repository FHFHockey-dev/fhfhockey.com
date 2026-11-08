"""One sequential request per missing player-season to the official NHL stats API."""
import json
import pathlib
import subprocess
import time
import urllib.parse
root=pathlib.Path(__file__).resolve().parent
rows=json.loads((root/'captured-rows.json').read_text())
missing=[(p,s) for p,s in sorted({(r['player_id'],r['season_id']) for r in rows}) if not (root/'source'/f'{p}-{s}.json').exists() and not (root/'source'/f'{p}-{s}-summary.json').exists()]
assert len(missing)<=10
for player,season in missing:
    params={'isAggregate':'false','isGame':'true','start':0,'limit':100,'cayenneExp':f'playerId={player} and seasonId={season} and gameTypeId=2'}
    url='https://api.nhle.com/stats/rest/en/skater/summary?'+urllib.parse.urlencode(params)
    r=subprocess.run(['curl','--fail','--silent','--show-error','--connect-timeout','15','--max-time','45',url],capture_output=True,text=True)
    if r.returncode:
        print(player,season,'FAILED',r.returncode,r.stderr,flush=True)
        continue
    j=json.loads(r.stdout)
    if not isinstance(j.get('data'),list) or j.get('total')!=len(j['data']):
        print(player,season,'FAILED incomplete response',flush=True)
        continue
    (root/'source'/f'{player}-{season}-summary.json').write_text(r.stdout)
    (root/'source'/f'{player}-{season}-summary.url.txt').write_text(url+'\n')
    print(player,season,'captured official summary',len(j['data']),flush=True)
    time.sleep(1)

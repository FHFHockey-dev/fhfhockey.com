"""Collect public NHL player/season game logs for identity gaps. Cache exact response bytes."""
import collections, csv, datetime, gzip, json, sys, time, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests

def rows(folder,name):
    with gzip.open(folder/(name+'.csv.gz'),'rt') as f:yield from csv.DictReader(f)
def jobs(d):
    games={g['id']:g for g in rows(d,'games')}
    teams={t['id']:t['abbreviation'] for t in rows(d,'teams')}
    seasons=list(rows(d,'seasons'))
    date_s=collections.defaultdict(set)
    for g in games.values():
        if g['type'] in ('2','3'):date_s[g['date']].add((g['seasonId'],g['type']))
    wgos={(w['player_id'],w['date']):w for w in rows(d,'wgo')}
    needed=set()
    for r in rows(d,'wide'):
        p,day=r['player_id'],r['game_date']
        w=wgos.get((p,day),{});g=games.get(w.get('game_id'),{})
        match=bool(g and g['id']==r['game_id'] and g['date']==day and g['seasonId']==r['season']==w['season_id']
            and g['type'] in ('2','3') and w['games_played']=='1'
            and r['team_id'] in (g['homeTeamId'],g['awayTeamId']) and teams.get(r['team_id'])==w['team_abbrev']
            and w['opponent_team_abbrev']==teams.get(g['awayTeamId'] if r['team_id']==g['homeTeamId'] else g['homeTeamId']))
        if match:continue
        scopes=date_s[day] or {(s['id'],t) for s in seasons if s['startDate']<=day<=s['endDate'] for t in ('2','3')}
        needed.update((p,s,t) for s,t in scopes)
    return sorted(needed)
def collect(folder,cache,keys=None):
    cache.mkdir(parents=True,exist_ok=True)
    todo=jobs(folder) if keys is None else keys
    print('NHL player-season-types',len(todo),flush=True)
    lock=threading.Lock(); after=[0.0];tls=threading.local()
    def get(key):
        dest=cache/('-'.join(key)+'.json.gz')
        if dest.exists():return
        p,s,t=key; url=f'https://api-web.nhle.com/v1/player/{p}/game-log/{s}/{t}'
        if not hasattr(tls,'session'):tls.session=requests.Session()
        for attempt in range(3):
            with lock:
                time.sleep(max(0,after[0]-time.monotonic()));after[0]=time.monotonic()+0.125
            try:
                res=tls.session.get(url,timeout=16)
                if res.status_code==429:
                    with lock:after[0]=max(after[0],time.monotonic()+int(res.headers.get('Retry-After','30')))
                    continue
                if res.status_code==404:body=json.dumps({'http':404,'url':url}).encode()
                else:
                    res.raise_for_status()
                    if not isinstance(res.json().get('gameLog'),list):raise ValueError('missing gameLog')
                    body=res.content
                dest.with_suffix('.part').write_bytes(gzip.compress(body,compresslevel=2,mtime=0))
                dest.with_suffix('.part').replace(dest);return
            except (ValueError,requests.RequestException) as e:
                if attempt==2:print('unavailable',key,type(e).__name__,flush=True)
                else:time.sleep(2**attempt)
    with ThreadPoolExecutor(max_workers=3) as pool:
        for i,_ in enumerate(pool.map(get,todo)):
            if (i+1)%500==0:print('checked',i+1,flush=True)
if __name__=='__main__':collect(Path(sys.argv[1]),Path(sys.argv[2]),json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv)>3 else None)

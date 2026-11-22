"""Pin the published NHL boxscore extracts and validate the release asset hashes."""
import hashlib,json,re,sys
from pathlib import Path
import requests,pyarrow.parquet as pq
d=Path(sys.argv[1])/'boxes'
d.mkdir(exist_ok=True)
s=requests.Session();u='https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases/tags/nhl_player_boxscores'
r=s.get(u,timeout=15);r.raise_for_status();receipt=[]
for a in r.json()['assets']:
    if not re.fullmatch(r'player_box_20\d\d\.parquet',a['name']):continue
    p=d/a['name']
    if not p.exists():
        v=s.get(a['browser_download_url'],timeout=30);v.raise_for_status()
        assert 'sha256:'+hashlib.sha256(v.content).hexdigest()==a['digest'];p.write_bytes(v.content)
    assert 'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()==a['digest']
    receipt.append({k:a[k] for k in ('name','id','digest','size','updated_at','browser_download_url')})
    if len(receipt)==1:
        t=pq.read_table(p);print(t.column_names,t.num_rows,flush=True);print(t.slice(0,1).to_pylist(),flush=True)
(d/'sources.json').write_text(json.dumps(receipt,indent=2)+'\n')

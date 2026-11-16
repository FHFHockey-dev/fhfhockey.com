import json,sys
from collections import defaultdict,Counter
from datetime import date
r=json.load(open(sys.argv[1]))
rows=sorted(r['wgo']['rows'],key=lambda w:(w['player_id'],w['date'],w['id']))
by=defaultdict(list)
for w in rows: by[w['player_id']].append(w)
pol=r['freshnessPolicy']; H=pol['maxCaptureAgeHours']; A=pol['maxEventAgeDays']
def feas(dates):
    # brute force: evaluation E in minutes over a range; R_i in [D_i+1d, D_i+8d) and R_i<=E, E-R_i<=H; currentUse: day(E)-D_i<=A
    ds=[date.fromisoformat(d).toordinal()*1440 for d in dates]
    lo=max(ds)+1440; best_src=False; best_cur=False
    for E in range(lo, min(ds)+9*1440+1, 30):
        src=all(max(d+1440,E-H*60) <= min(E, d+8*1440-1) for d in ds)
        if src:
            best_src=True
            if all((E//1440)*1440 - d <= A*1440 for d in ds): best_cur=True
    return best_src,best_cur
gp1=Counter(); spans=Counter(); src=cur=0; n=0; non1=0
for pid,ws in by.items():
    if len(ws)<5: continue
    win=ws[-5:]; n+=1
    if any(w['games_played']!=1 for w in win): non1+=1
    ds=[w['date'] for w in win]
    spans[(date.fromisoformat(ds[-1])-date.fromisoformat(ds[0])).days]+=1
    s,c=feas(ds); src+=s; cur+=c
print(json.dumps({"playersWith5PlusRows":n,"windowsWithNonGP1Member":non1,"spanMin":min(spans),"spanDist":dict(sorted(spans.items())),"srcFeasible":src,"curFeasible":cur,"H":H,"A":A}))

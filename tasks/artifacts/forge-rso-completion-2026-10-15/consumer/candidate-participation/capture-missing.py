"""Exact44-source candidate participation capture. Root executes under recorded standing scope.
Default plan mode makes no request. No database, forecast release or activation.
"""
import argparse
from datetime import datetime, timezone
import http.client
import json
import os
from pathlib import Path
import runpy
import ssl
import sys
import time
from urllib.parse import urlsplit

ARTIFACT=Path(__file__).resolve().parents[2]
BASE=runpy.run_path(str(ARTIFACT/'capture-native-sources.py'))
CONTEXT=runpy.run_path(str(ARTIFACT/'capture-nhl-context.py'))
sha,clock,private_write,bounded_process=[BASE[k] for k in ('sha','clock','private_write','bounded_process')]
PRIVATE=Path('/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1')
HOST='api-web.nhle.com'; MAX_BODY=1048576; TOTAL=44*MAX_BODY; SECONDS=360
CLUBS={1:'NJD',2:'NYI',3:'NYR',5:'PIT',6:'BOS',7:'BUF',12:'CAR',13:'FLA',18:'NSH',19:'STL',20:'CGY',21:'COL',23:'VAN',28:'SJS',29:'CBJ',68:'UTA'}
GAMES=[2026020001,2026020003,2026020011,2026020014,2026020016,2026020019,2026020027,2026020029,2026020032,2026020033,2026020036,2026020037,2026020038,2026020042,2026020047,2026020048,2026020054,2026020056,2026020061,2026020063,2026020064,2026020068,2026020071,2026020074,2026020079,2026020082,2026020085,2026020087]

def reserved(data):
    reference=data['reservationMetadata']; raw=Path(reference['path']).read_bytes()
    if sha(raw)!=reference['sha256']:raise ValueError('Reserved register changed')
    protocol=json.loads(raw)
    ids=sorted({game['id'] for day in protocol['days'] for game in day['games']})
    if ids!=reference['gameIds'] or not ids or any(type(i)is not int for i in ids):raise ValueError('Exact reserved register mismatch')
    return set(ids)

def validate(data):
    if (data.get('version')!='candidate-participation-missing-source-allocation-v1'
        or data.get('seasonId')!=20262027 or data.get('executionAuthority',{}).get('kind')!='recorded_standing_scope'
        or data.get('bounds')!={'requests':44,'bytesPerBody':MAX_BODY,'totalBodyBytes':TOTAL,'requestSeconds':8,'totalSeconds':SECONDS,'concurrency':1,'redirects':0,'retries':0}):raise ValueError('Exact finite allocation required')
    for reference in data['sourcePins']:
        if sha(Path(reference['path']).read_bytes())!=reference['sha256']:raise ValueError('Source pin changed')
    players=data['players']
    if len(players)!=50 or len({p['playerId']for p in players})!=50 or len({p['nhlPlayerId']for p in players})!=50 or any(type(p.get(k))is not int or p[k]<=0 for p in players for k in ('playerId','nhlPlayerId','teamId')):raise ValueError('Exact50 candidate identity scope required')
    protected=reserved(data);requests=data['requests']
    if len(requests)!=44:raise ValueError('Exactly44 source requests required')
    for row,team in zip(requests[:16],CLUBS):
        if row!={'kind':'current_official_roster','teamId':team,'url':f'https://{HOST}/v1/roster/{CLUBS[team]}/20262027'}:raise ValueError('Roster allowlist changed')
    native=[]
    for row,game_id in zip(requests[16:],GAMES):
        if (row['kind']!='historical_boxscore' or row['gameId']!=game_id or game_id in protected
            or row['url']!=f'https://{HOST}/v1/gamecenter/{game_id}/boxscore'
            or not '2026-09-29'<=row['date']<='2026-10-12'
            or row['homeTeamId']==row['awayTeamId']):raise ValueError('Historical allowlist/reservation mismatch')
        at=datetime.fromisoformat(row['scheduledAt'].replace('Z','+00:00'))
        if at.tzinfo is None or not datetime(2026,9,29,4,tzinfo=timezone.utc)<=at<datetime(2026,10,13,4,tzinfo=timezone.utc):raise ValueError('Outside explicit NHL historical window')
        native.append({'id':game_id,'date':row['date'],'seasonId':20262027,'type':2,'startTime':row['scheduledAt'],'homeTeamId':row['homeTeamId'],'awayTeamId':row['awayTeamId']})
    # Existing finite native canonical metadata/reservation validator, with no transport.
    BASE['validate']({'version':'forge-rso-native-capture-allocation-v1','seasonId':20262027,'games':native,'reservedGameIds':list(protected),
        'requests':[f'https://{HOST}/v1/gamecenter/{g["id"]}/{endpoint}' for g in native for endpoint in ('boxscore','landing')]})
    return requests

def validate_body(body,row,data,captured):
    if row['kind']=='current_official_roster':
        return CONTEXT['validate_payload'](body,{'kind':'roster','teamId':row['teamId'],'abbreviation':CLUBS[row['teamId']]},{'teamDirectory':data['teamDirectory'],'roster':data['players']},captured)
    if (body.get('id')!=row['gameId'] or body.get('season')!=20262027 or body.get('gameType')!=2 or body.get('gameDate')!=row['date']
        or body.get('gameState')not in ('OFF','FINAL') or body.get('homeTeam',{}).get('id')!=row['homeTeamId'] or body.get('awayTeam',{}).get('id')!=row['awayTeamId']
        or datetime.fromisoformat(body.get('startTimeUTC','').replace('Z','+00:00'))!=datetime.fromisoformat(row['scheduledAt'].replace('Z','+00:00'))):raise ValueError('Original boxscore identity/finality mismatch')
    return {'gameId':row['gameId'],'date':row['date'],'scope':'original_final_boxscore_not_player_negative_label'}

def worker(url,path,maximum,allocation_path,allocation_hash):
    raw=Path(allocation_path).read_bytes()
    if len(raw)>MAX_BODY or sha(raw)!=allocation_hash or url not in [r['url'] for r in validate(json.loads(raw))] or not 0<maximum<=MAX_BODY:raise ValueError('Child exact scope denied')
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname!=HOST or parsed.port or parsed.username or parsed.password or parsed.query or parsed.fragment:raise ValueError('Child URL denied')
    context=ssl.create_default_context()
    if not context.get_ca_certs():context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    if not context.get_ca_certs():raise ValueError('Trusted CA store unavailable')
    conn=http.client.HTTPSConnection(HOST,timeout=8,context=context)
    try:
        with os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb',buffering=0)as stream:
            conn.request('GET',parsed.path,headers={'Accept':'application/json','Accept-Encoding':'identity','User-Agent':'FHFH-bounded-candidate-participation/1'})
            response=conn.getresponse()
            if response.status!=200:raise ValueError('non_200_source_status')
            if response.getheader('Content-Encoding','identity')!='identity':raise ValueError('Encoded response denied')
            private_write(Path(str(path)+'.headers.json'),json.dumps({'status':response.status,'sourceDate':response.getheader('Date'),'age':response.getheader('Age')}).encode())
            size=0
            while size<maximum:
                chunk=response.read1(min(65536,maximum-size))
                if not chunk:return
                stream.write(chunk);size+=len(chunk)
            raise ValueError('body_byte_ceiling_reached')
    finally:conn.close()

def transport(url,path,maximum,timeout,allocation_path,allocation_hash):
    code="import runpy,sys,pathlib;m=runpy.run_path(sys.argv[1]);m['worker'](sys.argv[2],pathlib.Path(sys.argv[3]),int(sys.argv[4]),sys.argv[5],sys.argv[6])"
    bounded_process([sys.executable,'-c',code,str(Path(__file__).resolve()),url,str(path),str(maximum),str(allocation_path),allocation_hash],timeout)

def capture(raw,allocation_hash,authority_ref,output,fetch_body=transport,monotonic=time.monotonic):
    started=monotonic()
    if len(raw)>MAX_BODY or sha(raw)!=allocation_hash or not authority_ref.strip():raise ValueError('Exact standing-scope allocation attribution required')
    data=json.loads(raw);requests=validate(data)
    if output.parent.resolve()!=PRIVATE or not output.name.startswith('candidate-participation-capture-'):raise ValueError('Exclusive private output required')
    output.mkdir(mode=0o700);private_write(output/'allocation.json',raw);private_write(output/'exposure-ledger.jsonl',b'')
    total=0;attempted=0;receipts=[];failures=[]
    def event(action,**fields):
        with (output/'exposure-ledger.jsonl').open('a')as stream:
            stream.write(json.dumps({'atUTC':clock(),'action':action,'authorityRef':authority_ref,'allocationSHA256':allocation_hash,**fields})+'\n');stream.flush();os.fsync(stream.fileno())
    index=0
    while index<len(requests):
        if monotonic()-started>=SECONDS or total>=TOTAL:break
        row=requests[index];path=output/f'{index+1:02d}-{row["kind"]}-{row.get("teamId",row.get("gameId"))}.json'
        event('acquisition_intent',**row);remaining=SECONDS-(monotonic()-started)
        if remaining<=0:break
        before=total
        try:
            attempted+=1;index+=1
            fetch_body(row['url'],path,min(MAX_BODY,TOTAL-total),min(8,remaining),output/'allocation.json',allocation_hash)
            captured=clock();body=path.read_bytes();total+=len(body)
            event('original_body_retained',url=row['url'],capturedAt=captured,bodySha256=sha(body),bytes=len(body))
            coverage=validate_body(json.loads(body),row,data,captured)
            headers=json.loads(Path(str(path)+'.headers.json').read_bytes())
            receipts.append({'url':row['url'],'capturedAt':captured,'bodySha256':sha(body),'rawBody':body.decode('utf8'),'sourceDate':headers.get('sourceDate'),'coverage':coverage})
        except Exception:
            if total==before and path.exists():total+=path.stat().st_size
            failures.append({'url':row['url'],'reason':'capture_or_source_validation_failed'});event('capture_or_source_validation_failed',url=row['url']);break
    receipt={'version':'candidate-participation-source-capture-v1','allocationSHA256':allocation_hash,'completedAt':clock(),'receipts':receipts,'failures':failures,'plannedRequests':44,'attemptedRequests':attempted,'unattemptedRequests':[r['url']for r in requests[index:]],'bodyBytes':total,'elapsedSeconds':monotonic()-started,'sourceAcquisitionOnly':True,'databaseWrites':0,'forecastReleased':False,'publicActivation':False}
    private_write(output/'receipts.json',json.dumps(receipt,indent=2).encode());return receipt

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('allocation');parser.add_argument('--execute',action='store_true');parser.add_argument('--allocation-sha256');parser.add_argument('--authority-ref');parser.add_argument('--output');args=parser.parse_args()
    raw=Path(args.allocation).read_bytes();validate(json.loads(raw))
    if args.execute:
        if not args.allocation_sha256 or not args.authority_ref or not args.output:parser.error('Exact allocation hash, recorded standing authority reference, new private output required')
        result=capture(raw,args.allocation_sha256,args.authority_ref,Path(args.output));print(json.dumps({k:result[k]for k in ['plannedRequests','attemptedRequests','bodyBytes','elapsedSeconds','failures']}))
    else:print(json.dumps({'mode':'plan_only_no_network','allocationSHA256':sha(raw),'requests':44,'totalSeconds':360,'standingAuthorityRecorded':True}))

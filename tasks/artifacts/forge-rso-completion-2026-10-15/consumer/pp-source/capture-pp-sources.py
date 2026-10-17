"""Unexecuted private PP source proposal. Default plan is network-free.
Reuses the approved native collector's exclusive writes and wall-clock child guard.
"""
import argparse
from datetime import datetime, timezone
import http.client
import json
import os
from pathlib import Path
import re
import runpy
import ssl
import sys
import time
from urllib.parse import urlsplit, urlencode

ROOT = Path(__file__).resolve().parents[5]
BASE = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'capture-native-sources.py'))
sha, clock, private_write, bounded_process = [BASE[k] for k in ('sha', 'clock', 'private_write', 'bounded_process')]
CLUBS = {4:'PHI',8:'MTL',9:'OTT',10:'TOR',14:'TBL',15:'WSH',16:'CHI',17:'DET',22:'EDM',25:'DAL',26:'LAK',30:'MIN',54:'VGK'}
PRIVATE_ROOT = Path('/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1')
MAX_BODY = 1024 * 1024
ORIGINAL = re.compile(r'https://(?:www\.)?(?:twitter\.com|x\.com)/(?!GameDayLines/)[A-Za-z0-9_]+/status/[0-9]+', re.I)

def page_urls():
    return [f'https://www.gamedaytweets.com/lines?team={abbr}' for abbr in CLUBS.values()]

def oembed_url(original):
    if not isinstance(original, str) or not ORIGINAL.fullmatch(original):
        raise ValueError('Only exact cited original status URLs')
    return 'https://publish.twitter.com/oembed?' + urlencode({'omit_script':'true','dnt':'true','url':original})

def validate(data):
    if (data.get('version') != 'forge-pp-source-allocation-v1' or data.get('seasonId') != 20262027
            or data.get('requests') != page_urls() or type(data.get('optionalOembed')) is not bool
            or not isinstance(data.get('wholeFeedExposure'), str) or not data['wholeFeedExposure'].strip()):
        raise ValueError('Allocation scope mismatch')
    roster, directory = data['roster'], data['directory']
    if (len(roster) != 19 or len({r['playerId'] for r in roster}) != 19
            or len({r['nhlPlayerId'] for r in roster}) != 19 or {r['teamId'] for r in roster} != set(CLUBS)
            or not 19 <= len(directory) <= 1100):
        raise ValueError('Exact owned roster/directory scope required')
    for row in directory:
        if (any(type(row.get(k)) is not int or row[k] <= 0 for k in ('playerId','nhlPlayerId','teamId'))
                or not isinstance(row.get('fullName'), str) or not row['fullName'].strip()):
            raise ValueError('Invalid identity metadata')
    for row in roster:
        if sum(all(d[k] == row[k] for k in ('playerId','nhlPlayerId','teamId')) for d in directory) != 1:
            raise ValueError('Owned identity not uniquely mapped')
    for source in data['sourcePins']:
        if sha(Path(source['path']).read_bytes()) != source['sha256']:
            raise ValueError('Bound source changed')
    return data

def worker(url, path, maximum):
    parsed = urlsplit(url)
    if (url not in page_urls() and not url.startswith('https://publish.twitter.com/oembed?')
            or parsed.scheme != 'https' or parsed.port or parsed.username or parsed.password or parsed.fragment
            or not 0 < maximum <= MAX_BODY):
        raise ValueError('Transport scope denied')
    if parsed.hostname == 'publish.twitter.com':
        from urllib.parse import parse_qs
        query = parse_qs(parsed.query, strict_parsing=True)
        if set(query) != {'omit_script','dnt','url'} or query['omit_script'] != ['true'] or query['dnt'] != ['true'] or len(query['url']) != 1 or oembed_url(query['url'][0]) != url:
            raise ValueError('oEmbed scope denied')
    context = ssl.create_default_context()
    if not context.get_ca_certs(): context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    if not context.get_ca_certs(): raise ValueError('No trusted CA store')
    conn = http.client.HTTPSConnection(parsed.hostname, timeout=8, context=context)
    try:
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb', buffering=0) as out:
            conn.request('GET', parsed.path + '?' + parsed.query, headers={'Accept':'text/html,application/json', 'Accept-Encoding':'identity','User-Agent':'FHFH-bounded-PP-proposal/1'})
            response = conn.getresponse()
            if response.status != 200: raise ValueError(f'http_status_{response.status}')
            if response.getheader('Content-Encoding','identity') != 'identity': raise ValueError('Encoded body denied')
            private_write(Path(str(path)+'.headers.json'), json.dumps({'httpStatus':response.status,'responseDate':response.getheader('Date'),'age':response.getheader('Age')}).encode())
            size = 0
            while size < maximum:
                chunk = response.read1(min(65536, maximum-size))
                if not chunk: return
                out.write(chunk); size += len(chunk)
            raise ValueError('Body ceiling reached; incomplete retained body')
    finally:
        conn.close()

def transport(url, path, maximum, timeout):
    command = "import runpy,sys,pathlib; m=runpy.run_path(sys.argv[1]); m['worker'](sys.argv[2],pathlib.Path(sys.argv[3]),int(sys.argv[4]))"
    bounded_process([sys.executable,'-c',command,str(Path(__file__).resolve()),url,str(path),str(maximum)], timeout)

def parse_body(data, kind, body, url, team, captured, output, original, timeout):
    incoming, outgoing = Path(str(body)+'.parse-input.json'), Path(str(body)+'.claims.json')
    private_write(incoming, json.dumps({'kind':kind,'bodyPath':str(body),'teamId':team,'capturedAt':captured,
        'sourceUrl':url,'originalTweetUrl':original,'directory':data['directory'],'ownedIds':[r['playerId'] for r in data['roster']]}).encode())
    command = [str(ROOT/'web/node_modules/.bin/ts-node'),'--transpile-only','--compiler-options','{"module":"commonjs","moduleResolution":"node"}',str(Path(__file__).with_name('extract-pp-claims.ts')),str(incoming),str(outgoing)]
    # Process only local original bodies. No parser enrichment/network entrypoints.
    import subprocess
    env = {**os.environ, 'NODE_PATH':str(ROOT/'web/node_modules')+':'+str(ROOT/'web')}
    subprocess.run(command, cwd=ROOT/'web', env=env, timeout=timeout, check=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return json.loads(outgoing.read_bytes())

def capture(raw, approved_hash, approval_ref, output, fetch_body=transport, parser=parse_body, monotonic=time.monotonic):
    if len(raw) > MAX_BODY or sha(raw) != approved_hash or not approval_ref.strip(): raise ValueError('Exact approval required')
    data = validate(json.loads(raw)); optional = data['optionalOembed']
    if output.parent.resolve() != PRIVATE_ROOT or not output.name.startswith('pp-source-capture-'):
        raise ValueError('Exclusive private capture output required')
    seconds, byte_budget = (300,26*MAX_BODY) if optional else (150,13*MAX_BODY)
    output.mkdir(mode=0o700)
    private_write(output/'allocation.json',raw); private_write(output/'exposure-ledger.jsonl',b'')
    started, total, attempted = monotonic(), 0, 0
    receipts, failures, oembed = [], [], []
    def event(action, **fields):
        with (output/'exposure-ledger.jsonl').open('a') as stream:
            stream.write(json.dumps({'atUTC':clock(),'action':action,'approvalRef':approval_ref,'allocationSHA256':approved_hash,**fields})+'\n'); stream.flush(); os.fsync(stream.fileno())
    requests = [('page',url,team,None) for team,url in zip(CLUBS,page_urls())]
    index = 0
    while index < len(requests):
        kind,url,team,original = requests[index]
        if monotonic()-started >= seconds or total >= byte_budget: break
        path = output/f'{index+1:02d}-{CLUBS[team]}-{kind}.body'
        event('acquisition_intent',url=url,teamId=team,kind=kind)
        remaining = seconds-(monotonic()-started)
        if remaining <= 0: break
        before = total
        try:
            attempted += 1; index += 1
            fetch_body(url,path,min(MAX_BODY,byte_budget-total),min(8,remaining))
            captured = clock(); body = path.read_bytes(); total += len(body)
            event('original_body_retained',url=url,bodySHA256=sha(body),bytes=len(body),capturedAt=captured)
            remaining = seconds-(monotonic()-started)
            if remaining <= 0: raise TimeoutError('Overall wall clock exhausted')
            result = parser(data,kind,path,url,team,captured,output,original,min(8,remaining))
            receipts.append({'url':url,'teamId':team,'kind':kind,'bodySHA256':sha(body),'capturedAt':captured,'claimCount':len(result['claims'])})
            cited = result.get('optionalOriginalTweetUrl')
            if kind == 'page' and optional and cited:
                oembed.append(('oembed',oembed_url(cited),team,cited))
        except Exception:
            # Failed/partial bytes count toward the same physical exposure cap.
            if total == before and path.exists(): total += path.stat().st_size
            failures.append({'url':url,'reason':'capture_or_parse_failed'}); event('capture_or_parse_failed',url=url)
            break  # Fail closed; no retries, fallback endpoint, paging or redirect.
        if index == 13 and optional: requests += oembed
    summary = {'version':'forge-pp-source-capture-v1','attemptedRequests':attempted,'plannedMaximum':26 if optional else 13,
        'bodyBytes':total,'elapsedSeconds':monotonic()-started,'receipts':receipts,'failures':failures,
        'unattemptedRequests':[row[1] for row in requests[index:]],'forecastAdmission':False,'databaseWrites':False}
    private_write(output/'receipts.json',json.dumps(summary,indent=2).encode()); return summary

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('allocation'); parser.add_argument('--execute',action='store_true')
    parser.add_argument('--approved-sha256'); parser.add_argument('--approval-ref'); parser.add_argument('--output')
    args = parser.parse_args(); raw = Path(args.allocation).read_bytes(); data = validate(json.loads(raw))
    if args.execute:
        if not args.output or not args.approved_sha256 or not args.approval_ref: parser.error('Exact hash, approval reference and new private output required')
        capture(raw,args.approved_sha256,args.approval_ref,Path(args.output))
    else: print(json.dumps({'mode':'plan_only_no_network','allocationSHA256':sha(raw),'firstPages':13,'optionalMaximum':13 if data['optionalOembed'] else 0}))

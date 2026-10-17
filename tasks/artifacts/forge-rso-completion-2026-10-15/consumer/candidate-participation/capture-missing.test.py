"""Synthetic exact-allocation tests. No provider/private outcome requests."""
import json
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
M=runpy.run_path(str(Path(__file__).with_name('capture-missing.py')))

def fixture(root):
    protocol=root/'protocol.json';protocol.write_text(json.dumps({'days':[{'date':'2026-10-14','games':[{'id':2026020106}]}]}))
    requests=[{'kind':'current_official_roster','teamId':team,'url':f'https://{M["HOST"]}/v1/roster/{abbr}/20262027'} for team,abbr in M['CLUBS'].items()]
    requests += [{'kind':'historical_boxscore','gameId':game,'date':'2026-10-01','scheduledAt':'2026-10-01T23:00:00Z','homeTeamId':1,'awayTeamId':2,'url':f'https://{M["HOST"]}/v1/gamecenter/{game}/boxscore'}for game in M['GAMES']]
    return {'version':'candidate-participation-missing-source-allocation-v1','seasonId':20262027,'executionAuthority':{'kind':'recorded_standing_scope'},'bounds':{'requests':44,'bytesPerBody':1048576,'totalBodyBytes':44*1048576,'requestSeconds':8,'totalSeconds':360,'concurrency':1,'redirects':0,'retries':0},'players':[{'playerId':i+1,'nhlPlayerId':i+101,'teamId':list(M['CLUBS'])[i%16]}for i in range(50)],'sourcePins':[],'teamDirectory':[{'teamId':k,'abbreviation':v}for k,v in M['CLUBS'].items()],'reservationMetadata':{'path':str(protocol),'sha256':M['sha'](protocol.read_bytes()),'gameIds':[2026020106]},'requests':requests}

def body(row):
    if row['kind']=='current_official_roster':return {'teamId':row['teamId'],'teamAbbrev':M['CLUBS'][row['teamId']],'seasonId':20262027,'forwards':[{'id':10}],'defensemen':[],'goalies':[]}
    return {'id':row['gameId'],'season':20262027,'gameType':2,'gameDate':row['date'],'startTimeUTC':row['scheduledAt'],'gameState':'FINAL','homeTeam':{'id':1},'awayTeam':{'id':2}}

class Capture(unittest.TestCase):
    def run_capture(self,fail=False,slow=False):
        with tempfile.TemporaryDirectory()as temporary:
            root=Path(temporary).resolve();data=fixture(root);raw=json.dumps(data).encode();calls=[];elapsed=[0];original=M['os'].fsync
            def fsync(fd):
                original(fd)
                if slow:elapsed[0]=360
            def fetch(url,path,maximum,timeout,*_):
                calls.append((url,maximum,timeout));row=next(r for r in data['requests']if r['url']==url)
                path.write_bytes(b'partial'if fail else json.dumps(body(row)).encode())
                if fail:raise ValueError('synthetic')
                Path(str(path)+'.headers.json').write_text(json.dumps({'sourceDate':'Fri, 16 Oct 2026 06:30:00 GMT'}))
            output=root/'candidate-participation-capture-fixture'
            with patch.dict(M['capture'].__globals__,{'PRIVATE':root}),patch.object(M['os'],'fsync',fsync):
                result=M['capture'](raw,M['sha'](raw),'recorded-standing-scope-fixture',output,fetch,lambda:elapsed[0])
            self.assertEqual(output.stat().st_mode&0o777,0o700)
            self.assertEqual((output/'allocation.json').stat().st_mode&0o777,0o600)
            return result,calls
    def test_all44_exact_serial_requests_and_original_receipts(self):
        result,calls=self.run_capture();self.assertEqual(len(calls),44);self.assertEqual(len(result['receipts']),44);self.assertEqual(result['unattemptedRequests'],[])
        self.assertTrue(all(0<r[1]<=1048576 and 0<r[2]<=8 for r in calls));self.assertEqual(result['failures'],[]);self.assertEqual(result['databaseWrites'],0)
    def test_slow_intent_fsync_does_not_attempt_or_drop_current_url(self):
        result,calls=self.run_capture(slow=True);self.assertEqual(calls,[]);self.assertEqual(result['attemptedRequests'],0);self.assertEqual(len(result['unattemptedRequests']),44)
    def test_partial_failure_stops_counts_bytes_no_retry(self):
        result,calls=self.run_capture(fail=True);self.assertEqual(len(calls),1);self.assertEqual(result['bodyBytes'],7);self.assertEqual(len(result['unattemptedRequests']),43)
    def test_reserved_register_overlap_stops_before_capture(self):
        with tempfile.TemporaryDirectory()as root:
            data=fixture(Path(root));p=Path(data['reservationMetadata']['path']);p.write_text(json.dumps({'days':[{'games':[{'id':M['GAMES'][0]}]}]}));data['reservationMetadata'].update(sha256=M['sha'](p.read_bytes()),gameIds=[M['GAMES'][0]])
            with self.assertRaisesRegex(ValueError,'reservation'):M['validate'](data)
    def test_protected_date_and_changed_url_denied(self):
        with tempfile.TemporaryDirectory()as root:
            for mutate in [lambda d:d['requests'][16].update(date='2026-10-13'),lambda d:d['requests'][16].update(scheduledAt='2026-10-13T04:00:00Z'),lambda d:d['requests'][0].update(url='https://evil.invalid/a')]:
                data=fixture(Path(root));mutate(data)
                with self.assertRaises(ValueError):M['validate'](data)
    def test_changed_reservation_pin_denied(self):
        with tempfile.TemporaryDirectory()as root:
            data=fixture(Path(root));Path(data['reservationMetadata']['path']).write_text('{}')
            with self.assertRaisesRegex(ValueError,'register changed'):M['validate'](data)
    def test_roster_and_final_boxscore_validator_reject_conflicts(self):
        with tempfile.TemporaryDirectory()as root:
            data=fixture(Path(root));roster=body(data['requests'][0]);roster['teamAbbrev']='XXX'
            with self.assertRaises(ValueError):M['validate_body'](roster,data['requests'][0],data,'2026-10-16T06:00:00Z')
            game=body(data['requests'][16]);game['gameDate']='2026-10-14'
            with self.assertRaises(ValueError):M['validate_body'](game,data['requests'][16],data,'2026-10-16T06:00:00Z')
    def test_body_byte_ceiling_is_fail_closed(self):
        class Response:
            status=200
            def getheader(self,name,default=None):return default
            def read1(self,size):return b'x'*size
        class Connection:
            def __init__(self,*a,**k):pass
            def request(self,*a,**k):pass
            def getresponse(self):return Response()
            def close(self):pass
        with tempfile.TemporaryDirectory()as temporary,patch.object(M['http'].client,'HTTPSConnection',Connection):
            root=Path(temporary);data=fixture(root);raw=json.dumps(data).encode();path=root/'allocation.json';path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError,'body_byte_ceiling'):M['worker'](data['requests'][0]['url'],root/'body',1024,path,M['sha'](raw))
            self.assertEqual((root/'body').stat().st_size,1024)
    def test_transport_denies_redirect_without_following(self):
        class Response:status=302
        class Connection:
            def __init__(self,*a,**k):pass
            def request(self,*a,**k):pass
            def getresponse(self):return Response()
            def close(self):pass
        with tempfile.TemporaryDirectory()as temporary,patch.object(M['http'].client,'HTTPSConnection',Connection):
            root=Path(temporary);data=fixture(root);raw=json.dumps(data).encode();path=root/'allocation.json';path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError,'non_200'):M['worker'](data['requests'][0]['url'],root/'body',1024,path,M['sha'](raw))
if __name__=='__main__':unittest.main()

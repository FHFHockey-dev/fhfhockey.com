"""Synthetic transport/controller bounds only; no provider requests/private inputs."""
import json
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
M = runpy.run_path(str(Path(__file__).with_name('capture-pp-sources.py')))

def fixture(optional=False):
    rows = [{'playerId':i+1,'nhlPlayerId':i+101,'teamId':list(M['CLUBS'])[i%13],'fullName':f'Player {i}','lastName':str(i)} for i in range(19)]
    return {'version':'forge-pp-source-allocation-v1','seasonId':20262027,'requests':M['page_urls'](),
        'optionalOembed':optional,'wholeFeedExposure':'Synthetic whole HTML test','roster':rows,'directory':rows,'sourcePins':[]}

class Capture(unittest.TestCase):
    def run_capture(self, optional=False, fail=False, timed=False, slowintent=False):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve(); output = root/'pp-source-capture-fixture'; data=fixture(optional)
            raw=json.dumps(data).encode(); calls=[]; parsed=[]
            def fetch(url,path,maximum,timeout):
                calls.append((url,maximum,timeout)); path.write_bytes(b'partial' if fail else b'body')
                if fail: raise ValueError('Synthetic failure')
            def parser(data,kind,body,url,team,captured,output,original,timeout):
                parsed.append((kind,original)); return {'claims':[], 'optionalOriginalTweetUrl':f'https://twitter.com/reporter/status/{team}'}
            times=iter([0,151] if timed else [0]*200); elapsed=[0]
            original_fsync=M['os'].fsync
            def fsync(fd):
                original_fsync(fd)
                if slowintent: elapsed[0]=151
            timer=(lambda:elapsed[0]) if slowintent else (lambda:next(times,151 if timed else 0))
            with patch.object(M['os'],'fsync',fsync), patch.dict(M['capture'].__globals__, {'PRIVATE_ROOT':root}):
                summary=M['capture'](raw,M['sha'](raw),'synthetic approval',output,fetch,parser,timer)
            self.assertEqual(output.stat().st_mode&0o777,0o700)
            self.assertEqual((output/'allocation.json').stat().st_mode&0o777,0o600)
            return summary,calls,parsed
    def test_13_serial_pages(self):
        summary,calls,parsed=self.run_capture(); self.assertEqual(len(calls),13)
        self.assertEqual([c[0] for c in calls],M['page_urls']()); self.assertEqual(summary['bodyBytes'],52)
        self.assertTrue(all(c[1]<=1024*1024 and c[2]<=8 for c in calls)); self.assertFalse(summary['forecastAdmission'])
    def test_optional_only_exact_selected_originals_once_per_club(self):
        summary,calls,parsed=self.run_capture(True); self.assertEqual(len(calls),26)
        self.assertEqual([p[0] for p in parsed],['page']*13+['oembed']*13)
        self.assertTrue(all('publish.twitter.com/oembed?' in c[0] for c in calls[13:]))
    def test_failed_partial_stops_and_counts_bytes_no_retry(self):
        summary,calls,_=self.run_capture(fail=True); self.assertEqual(len(calls),1); self.assertEqual(summary['bodyBytes'],7)
    def test_total_wall_clock_prevents_request(self):
        summary,calls,_=self.run_capture(timed=True); self.assertEqual(calls,[]); self.assertEqual(len(summary['unattemptedRequests']),13)
    def test_slow_durable_intent_does_not_count_or_send_expired_request(self):
        summary,calls,parsed=self.run_capture(slowintent=True)
        self.assertEqual(calls,[]); self.assertEqual(parsed,[])
        self.assertEqual(summary['attemptedRequests'],0); self.assertEqual(summary['bodyBytes'],0)
        self.assertEqual(summary['unattemptedRequests'],M['page_urls']())
    def test_allocation_and_original_allowlists(self):
        for url in ['https://evil.invalid/a','https://twitter.com/GameDayLines/status/1','https://x.com/reporter/status/1?extra=1']:
            with self.assertRaises(ValueError): M['oembed_url'](url)
        data=fixture();data['requests'][0]+='&page=2'
        with self.assertRaises(ValueError):M['validate'](data)
        data=fixture();data['roster'][0]['teamId']=99
        with self.assertRaises(ValueError):M['validate'](data)
    def test_transport_denies_redirect_before_reading(self):
        class Response:
            status=302
        class Connection:
            def __init__(self,*a,**k):pass
            def request(self,*a,**k):pass
            def getresponse(self):return Response()
            def close(self):pass
        with tempfile.TemporaryDirectory() as root,patch.object(M['http'].client,'HTTPSConnection',Connection):
            with self.assertRaisesRegex(ValueError,'http_status_302'):
                M['worker'](M['page_urls']()[0],Path(root)/'body',1024)
    def test_body_ceiling_retains_at_most_limit(self):
        class Response:
            status=200
            def getheader(self,name,default=None):return default
            def read1(self,size):return b'x'*size
        class Connection:
            def __init__(self,*a,**k):pass
            def request(self,*a,**k):pass
            def getresponse(self):return Response()
            def close(self):pass
        with tempfile.TemporaryDirectory() as root,patch.object(M['http'].client,'HTTPSConnection',Connection):
            path=Path(root)/'body'
            with self.assertRaisesRegex(ValueError,'Body ceiling'):M['worker'](M['page_urls']()[0],path,1024)
            self.assertEqual(path.stat().st_size,1024)
if __name__=='__main__':unittest.main()

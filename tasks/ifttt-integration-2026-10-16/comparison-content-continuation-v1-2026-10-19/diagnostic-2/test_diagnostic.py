import copy,json,shutil,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import diagnostic as d

PLAN=json.loads((d.HERE/'PLAN.json').read_text())


def auth():return {'test_only':True,'plan_hash':d.p.digest(PLAN),'maximum_calls':1,'cap_nano_usd':520000000,'preserve_unknown_nano_usd':254394800}


class Fake:
    offline_fake=True
    def __init__(self,fail=False):self.calls=0;self.fail=fail
    def __call__(self,e,sealed,key,admit):
        assert sealed.wire==admit(e,sealed.as_dict()).wire
        self.calls+=1
        if self.fail:raise TimeoutError('synthetic lost reply')
        return {'model':'gpt-6-luna','usage':{'input_tokens':1,'output_tokens':0,'total_tokens':1},
                'answers':[{'type':'predicate','name':sealed.as_dict()['questions'][0]['name'],'probability':.99}]},{'providerMetadata':{'httpStatus':200,'requestId':'req_fixture'}}


class Checks(unittest.TestCase):
    def test_unique_revision_fix_keeps_all_semantics_and_original_body(self):
        raw=PLAN['before_revision_fix'];before=copy.deepcopy(raw)
        revised,n,audits=d.repair_revision(PLAN['envelope'],raw)
        self.assertEqual(raw,before);self.assertEqual(len(audits),1);self.assertFalse(n['errors'])
        a=raw['revisions'][0];b=revised['revisions'][0]
        self.assertEqual({k:v for k,v in a.items() if k!='evidence'},{k:v for k,v in b.items() if k!='evidence'})
        self.assertEqual(a['evidence']['text'],b['evidence']['text'])
        self.assertEqual(PLAN['request']['questions'],PLAN['previous_request']['questions'])
        self.assertEqual(json.loads(PLAN['request']['input'])['source'],json.loads(PLAN['previous_request']['input'])['source'])
        self.assertEqual(len(json.loads(PLAN['request']['input'])['revisions']),1)
        self.assertEqual(len(json.loads(PLAN['previous_request']['input'])['revisions']),0)

    def test_absent_or_repeated_revision_quote_is_held(self):
        for repeated in [False,True]:
            envelope=copy.deepcopy(PLAN['envelope']);text=PLAN['before_revision_fix']['revisions'][0]['evidence']['text']
            envelope['records'][1]['text']=envelope['records'][1]['text']+' '+text if repeated else 'unrelated text'
            with self.assertRaises(ValueError):d.repair_revision(envelope,PLAN['before_revision_fix'])

    def test_retained_quoted_lineage_is_required(self):
        envelope=copy.deepcopy(PLAN['envelope']);envelope['retained_relations']=[]
        with self.assertRaises(ValueError):d.repair_revision(envelope,PLAN['before_revision_fix'])

    def test_fake_single_call_uses_canonical_copy_and_does_not_resend(self):
        with tempfile.TemporaryDirectory(prefix='ifttt-revision-test-') as td:
            path=Path(td)/'budget.sqlite';shutil.copyfile(d.bridge.LIVE,path);fake=Fake()
            with patch('socket.socket',side_effect=AssertionError('network forbidden')):
                result=d.run_once(path,PLAN,auth(),transport=fake,credential_loader=lambda:'SYNTHETIC_PLACEHOLDER',output=Path(td)/'run')
            self.assertEqual(result['status'],'completed_single_revision_diagnostic');self.assertEqual(fake.calls,1)
            with self.assertRaises(ValueError):d.run_once(path,PLAN,auth(),transport=fake,credential_loader=lambda:'SYNTHETIC_PLACEHOLDER',output=Path(td)/'again')
            self.assertEqual(fake.calls,1)

    def test_unknown_reply_keeps_full_reservation(self):
        with tempfile.TemporaryDirectory(prefix='ifttt-revision-unknown-') as td:
            path=Path(td)/'budget.sqlite';shutil.copyfile(d.bridge.LIVE,path);fake=Fake(True)
            result=d.run_once(path,PLAN,auth(),transport=fake,credential_loader=lambda:'SYNTHETIC_PLACEHOLDER',output=Path(td)/'run')
            self.assertEqual(result['status'],'stopped_uncertain');self.assertEqual(fake.calls,1)
            self.assertEqual(result['ledger']['exposure_nano_usd'],262053553+231000000)

    def test_fake_authority_cannot_touch_live_budget(self):
        before=d.sha(d.bridge.LIVE)
        with self.assertRaises(ValueError):d.run_once(d.bridge.LIVE,PLAN,auth(),transport=Fake(),credential_loader=lambda:'SYNTHETIC_PLACEHOLDER',output=d.HERE/'forbidden')
        self.assertEqual(d.sha(d.bridge.LIVE),before)


if __name__=='__main__':unittest.main()

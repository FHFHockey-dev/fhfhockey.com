import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import adapter
import continuation as c

PLAN = json.loads((adapter.HERE / 'PLAN.json').read_text())
ENVELOPE = PLAN['envelopes']['S05']
SAVED = PLAN['saved_S05_response']


def auth():
    return {'test_only': True, 'mode': 'fake_transport_isolated_ledger', 'plan_hash': c.p.digest(PLAN),
            'maximum_calls': 17, 'cap_nano_usd': 520000000, 'preserve_unknown_nano_usd': 254394800}


class AnchorTests(unittest.TestCase):
    def test_real_saved_s05_has_six_valid_claims_without_changing_any_semantics(self):
        raw = c.p.parse_extraction(SAVED); before = copy.deepcopy(raw)
        result = adapter.normalize(ENVELOPE, raw)
        self.assertEqual(raw, before)
        self.assertFalse(result['content_held'])
        self.assertEqual(len(result['verifier_set']['claims']), 6)
        proofs = [a for a in result['anchor_audit'] if a['reason'] == 'exact_subject_adjacent_parenthetical']
        self.assertEqual(len(proofs), 2)
        self.assertEqual({a['proof']['binding_quote'] for a in proofs}, {'Joonas Korpisalo (lower body)', 'Joe Veleno (lower body)'})
        for old, new in zip([x for d in raw['records'] for x in d['claims']], [x for d in result['revised_body']['records'] for x in d['claims']]):
            self.assertEqual({k:v for k,v in old.items() if k != 'evidence'}, {k:v for k,v in new.items() if k != 'evidence'})
            self.assertEqual(old['evidence']['text'], new['evidence']['text'])

    def test_nonadjacent_repeated_quote_stays_held_but_other_record_continues(self):
        envelope = copy.deepcopy(ENVELOPE)
        envelope['records'][0]['text'] = envelope['records'][0]['text'].replace('Korpisalo (', 'Korpisalo is listed (').replace('Veleno (', 'Veleno is listed (')
        result = adapter.normalize(envelope, c.p.parse_extraction(SAVED))
        self.assertIn('S05A', result['held_record_ids'])
        self.assertEqual(result['scored_record_ids'], ['S05B'])
        self.assertEqual(len(result['verifier_set']['claims']), 2)
        self.assertEqual(len(result['raw_body']['records']) if 'raw_body' in result else len(result['revised_body']['records']), 2)

    def test_duplicate_subject_and_wrong_source_identity_cannot_be_disambiguated(self):
        raw = c.p.parse_extraction(SAVED); claim = raw['records'][0]['claims'][1]
        source = c.p.source(ENVELOPE['records'][0])
        with self.assertRaises(ValueError): adapter.subject_parenthesis(dict(source, text=source['text']+' Joonas Korpisalo'), claim)
        with self.assertRaises(ValueError): adapter.subject_parenthesis(source, dict(claim, source_id='x:foreign'))
        with self.assertRaises(ValueError): adapter.subject_parenthesis(source, dict(claim, player='Korpisalo'))

    def test_valid_existing_span_is_never_reassigned_by_the_new_policy(self):
        raw = c.p.parse_extraction(SAVED)
        fixed = adapter.normalize(ENVELOPE, raw)['revised_body']
        again = adapter.normalize(ENVELOPE, fixed)
        self.assertEqual(again['revised_body'], fixed)
        self.assertFalse(any(a['reason'] == 'exact_subject_adjacent_parenthetical' for a in again['anchor_audit']))

    def test_nonparenthetical_ambiguous_or_missing_quote_is_not_repaired(self):
        source = c.p.source(ENVELOPE['records'][0]); claim = c.p.parse_extraction(SAVED)['records'][0]['claims'][1]
        for quote in ['lower body', '(unknown)', ' (lower body) ']:
            changed = copy.deepcopy(claim); changed['evidence']['text'] = quote
            with self.assertRaises(ValueError): adapter.subject_parenthesis(source, changed)

    def test_supplementary_unicode_uses_utf16_offsets(self):
        source = {'source_id':'x:synthetic','author':'@test','text':'🏒 Alpha Player (illness). Beta Player (illness).'}
        claim = copy.deepcopy(c.p.parse_extraction(SAVED)['records'][0]['claims'][1])
        claim.update(source_id=source['source_id'],source_author=source['author'],player='Beta Player')
        claim['evidence']={'start':1,'end':2,'text':'(illness)'}
        fixed,_=adapter.subject_parenthesis(source,claim)
        self.assertEqual(c.p.evidence_slice(source['text'],fixed['evidence']),'(illness)')

    def test_unparseable_content_uses_relevance_without_claiming_completeness(self):
        result=adapter.response_view(ENVELOPE,{'model':'gpt-6-luna','status':'incomplete'})
        self.assertTrue(result['content_held']);self.assertEqual(result['verifier_set']['claims'],[])
        request=c.p.decisions_request(ENVELOPE,result['verifier_set'])
        self.assertEqual(request['questions'][0]['name'],'post_material_news')


class Fake:
    offline_fake=True
    def __init__(self,mode='complete'):self.mode=mode;self.calls=[]
    def __call__(self,endpoint,sealed,key,admit):
        assert sealed.wire==admit(endpoint,sealed.as_dict()).wire
        stage=len(self.calls);self.calls.append(stage)
        if self.mode=='unknown':raise TimeoutError('synthetic unknown')
        body={'model':'gpt-6-luna','status':'completed','usage':{'input_tokens':1,'output_tokens':1 if endpoint=='responses' else 0,'total_tokens':2 if endpoint=='responses' else 1}}
        if endpoint=='responses':
            item=PLAN['schedule'][stage];envelope=PLAN['envelopes'][item['group']]
            content={'records':[{'record_id':r['record_id'],'material':True,'overflow':False,'claims':[]} for r in envelope['records']],'revisions':[]}
            text='{malformed' if self.mode=='content' else c.p.canonical(content)
            body['output']=[{'type':'message','role':'assistant','content':[{'type':'output_text','text':text}]}]
        else:body['answers']=[{'type':'predicate','name':sealed.as_dict()['questions'][0]['name'],'probability':.99}]
        if self.mode=='usage':body.pop('usage')
        return body,{'providerMetadata':{'httpStatus':200,'requestId':'req_synthetic'}}


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='ifttt-content-cont-');self.root=Path(self.temp.name)
        self.path=self.root/'budget.sqlite';shutil.copyfile(c.bridge.LIVE,self.path)
        self.live_hash=c.sha(c.bridge.LIVE);self.loads=0
    def tearDown(self):
        self.assertEqual(c.sha(c.bridge.LIVE),self.live_hash);self.temp.cleanup()
    def loader(self):self.loads+=1;return 'SYNTHETIC_PLACEHOLDER'
    def run_case(self,mode='complete'):
        fake=Fake(mode)
        with patch('socket.socket',side_effect=AssertionError('no network')):
            result=c.run(self.path,PLAN,auth(),transport=fake,credential_loader=self.loader,output=self.root/mode)
        return result,fake

    def test_one_missing_output_pass_is_seventeen_calls_and_never_regenerates_s05(self):
        result,fake=self.run_case()
        self.assertEqual(result['status'],'completed_bounded_continuation');self.assertEqual(len(fake.calls),17)
        self.assertEqual(self.loads,1)
        self.assertEqual(sum(r['endpoint']=='responses' for r in result['records']),5)
        self.assertFalse(any(r['group']=='S05' and r['endpoint']=='responses' for r in result['records']))

    def test_known_usage_content_failures_continue_independent_records(self):
        result,fake=self.run_case('content')
        self.assertEqual(result['status'],'completed_bounded_continuation');self.assertEqual(len(fake.calls),17)
        self.assertTrue(any(r['content_held_not_spend_uncertain'] for r in result['records']))
        self.assertTrue(all(r[5]=='settled' for r in result['ledger']['attempts'] if r[0].startswith(c.PREFIX)))

    def test_unknown_transport_and_usage_stop_and_keep_full_reservation(self):
        for mode in ['unknown','usage']:
            path=self.root/(mode+'.sqlite');shutil.copyfile(c.bridge.LIVE,path);fake=Fake(mode)
            result=c.run(path,PLAN,auth(),transport=fake,credential_loader=self.loader,output=self.root/(mode+'-run'))
            self.assertEqual(result['status'],'stopped_uncertain_spend');self.assertEqual(len(fake.calls),1)
            self.assertEqual(result['ledger']['exposure_nano_usd'],257904324+231000000)

    def test_no_live_mutation_under_test_authority_and_no_duplicate_reserve(self):
        with self.assertRaises(ValueError):c.Ledger(c.bridge.LIVE,PLAN,auth())
        ledger=c.Ledger(self.path,PLAN,auth())
        try:
            endpoint,payload,_=ledger.expected(0);sealed=ledger.admit(0,endpoint,payload);ledger.reserve(0,endpoint,sealed)
            with self.assertRaises(ValueError):ledger.reserve(0,endpoint,sealed)
        finally:ledger.close()

    def test_caps_are_real_server_limits_and_prompts_unchanged(self):
        old=c.bridge.load_plan()
        for group,request in PLAN['extraction_requests'].items():
            self.assertEqual({k:v for k,v in request.items() if k!='max_output_tokens'}, {k:v for k,v in old['extraction_requests'][group].items() if k!='max_output_tokens'})
            item=next(x for x in PLAN['schedule'] if x['group']==group and x['kind']=='extraction')
            self.assertEqual(item['reserve_nano_usd'],c.pilot.price('responses',922000,request['max_output_tokens']))

    def test_usage_above_a_reduced_server_cap_is_never_settled_as_safe(self):
        body={'model':'gpt-6-luna','service_tier':'default','usage':{'input_tokens':1000,'output_tokens':4097,'total_tokens':5097}}
        with self.assertRaises(ValueError):c.pilot.usage_cost('responses',body,922000,4096)


if __name__=='__main__':unittest.main()

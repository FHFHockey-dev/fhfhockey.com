import copy,hashlib,json,socket,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import pilot


def candidates():
    return copy.deepcopy({'material':True,'overflow':False,'claims':[dict(id=f'control-{i}',**g['expected'],evidence=g['evidence']) for i,g in enumerate(pilot.PROFILE['labels']['claims'])]})


def usage(n=100,o=0):
    return {'input_tokens':n,'output_tokens':o,'total_tokens':n+o,
            'input_tokens_details':{'cached_tokens':0,'cache_write_tokens':0},
            'output_tokens_details':{'reasoning_tokens':0}}


def extraction():
    return {'model':pilot.MODEL,'status':'completed','usage':usage(100,100),
            'output':[{'type':'message','role':'assistant','content':[{'type':'output_text','text':json.dumps(candidates())}]}]}


def answers(req):
    out=[]
    for q in req['questions']:
        if q['type']=='predicate':out.append({'name':q['name'],'type':'predicate','probability':.99});continue
        choice='supported' if q['name'].endswith('support') else 'direct_assertion'
        values=[c['value'] for c in q['choices']]
        out.append({'type':'choice','name':q['name'],'choice':choice,'confidence':.99,
                    'probabilities':[{'value':v,'probability':1 if v==choice else 0} for v in values]})
    return {'model':pilot.MODEL,'answers':out,'usage':usage()}


def clearance():
    # Synthetic attestation for offline control only; never written as approval.
    return {'authority':'parent-final-clearance','approved':True,'policy_sha256':hashlib.sha256((pilot.POLICY/'pilot-rules.json').read_bytes()).hexdigest(),
            'binding_sha256':hashlib.sha256(Path(pilot.__file__).read_bytes()).hexdigest(),
            'billing_documentation_verified':True,'all_fees_within_110_percent':True,
            'complete_input_bound_evidence':'https://example.invalid/offline-control-not-proof',
            'responses_input_max':4096,'decisions_input_max':4096}


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.network=patch.object(socket.socket,'connect',side_effect=AssertionError('offline test forbids network'));self.network.start();self.addCleanup(self.network.stop)
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.state=Path(self.tmp.name)/'state';self.patch=patch.object(pilot,'STATE',self.state);self.patch.start();self.addCleanup(self.patch.stop)

    def test_exact_dynamic_request_has_source_and_own_proposals_no_gold(self):
        req=pilot.decisions_request(candidates());e=json.loads(req['input'])
        self.assertEqual(e['source'],pilot.request_input(pilot.PROFILE['source']))
        self.assertEqual(len(req['questions']),5)
        self.assertEqual([p['claim']['id'] for p in e['proposals']],['control-0','control-1'])
        self.assertNotIn('gradable',req['input']);self.assertNotIn('expected',req['input'])
        self.assertTrue(all(p['claim']['player_id'] is None for p in e['proposals']))
        for q in req['questions'][1:]:
            i=q['name'].split('_')[1]
            self.assertTrue(q['instructions'].startswith(f'Evaluate only proposals[{i}];'))

    def test_zero_claims_still_whole_post_triage(self):
        req=pilot.decisions_request({'claims':[],'overflow':False,'material':False})
        self.assertEqual(len(req['questions']),1)

    def test_output_source_or_span_mutation_rejects_before_dispatch(self):
        for field,value in [('source_id','other'),('source_author','relay')]:
            body=candidates();body['claims'][0][field]=value
            with self.assertRaises(ValueError):pilot.decisions_request(body)
        body=candidates();body['claims'][0]['evidence']['end']=999
        with self.assertRaises(ValueError):pilot.decisions_request(body)

    def test_response_complete_structured_body(self):self.assertEqual(pilot.parse_extraction(extraction()),candidates())

    def test_response_refusal_incomplete_wrong_model_and_tool_rejected(self):
        variants=[]
        for key,v in [('status','incomplete'),('model','other')]:
            b=extraction();b[key]=v;variants.append(b)
        b=extraction();b['output'][0]['content']=[{'type':'refusal','refusal':'no'}];variants.append(b)
        b=extraction();b['output'].append({'type':'function_call'});variants.append(b)
        for b in variants:
            with self.assertRaises(ValueError):pilot.parse_extraction(b)

    def test_strict_duplicate_and_nonfinite_json(self):
        for s in ['{"x":1,"x":2}','{"x":NaN}','{"x":Infinity}']:
            with self.assertRaises(ValueError):pilot.json_strict(s)

    def test_decisions_question_source_and_choice_binding(self):
        req=pilot.decisions_request(candidates());result,unknown=pilot.parse_decisions(req,answers(req))
        self.assertEqual(len(result),2);self.assertEqual(unknown,[])
        for alter in ['name','type','choice','distribution','duplicate']:
            b=answers(req)
            if alter=='name':b['answers'][1]['name']='foreign'
            if alter=='type':b['answers'][1]['type']='predicate'
            if alter=='choice':b['answers'][1]['choice']='foreign'
            if alter=='distribution':b['answers'][1]['probabilities'][0]['probability']=.2
            if alter=='duplicate':b['answers'][2]=b['answers'][1]
            with self.subTest(alter=alter),self.assertRaises(ValueError):pilot.parse_decisions(req,b)

    def test_known_refusal_only_holds_its_claim(self):
        req=pilot.decisions_request(candidates());b=answers(req)
        b['answers'][1]={'name':req['questions'][1]['name'],'type':'refusal'}
        result,unknown=pilot.parse_decisions(req,b)
        self.assertNotIn('control-0',result);self.assertIn('control-1',result);self.assertEqual(len(unknown),1)

    def test_complete_usage_price_includes_nonvisible_output_and_cache_writes(self):
        b=extraction();b['usage']['input_tokens_details']={'cached_tokens':10,'cache_write_tokens':20};b['usage']['output_tokens_details']['reasoning_tokens']=50
        cost=pilot.usage_cost('responses',b,4096,1024)
        self.assertEqual(cost,65560)
        self.assertEqual(pilot.usage_cost('decisions',{'model':pilot.MODEL,'usage':usage()},4096,0),11000)

    def test_missing_negative_boolean_inconsistent_or_over_bound_usage_stops(self):
        variants=[]
        for k,v in [('input_tokens',None),('input_tokens',-1),('input_tokens',True),('total_tokens',1000),('input_tokens',9999)]:
            b=extraction();b['usage'][k]=v;variants.append(b)
        b=extraction();del b['usage']['input_tokens_details']['cache_write_tokens'];variants.append(b)
        for b in variants:
            with self.assertRaises((ValueError,TypeError)):pilot.usage_cost('responses',b,4096,1024)

    def test_broad_model_context_does_not_fit_complete_bundle(self):
        c=clearance();c['decisions_input_max']=922000
        with self.assertRaisesRegex(ValueError,'whole paired bundle'):pilot.validate_clearance(c)
        self.assertEqual(pilot.price('decisions',922000),202840000)

    def test_clearance_missing_unproved_or_wrong_hash_cannot_load_key(self):
        for c in [{},dict(clearance(),approved=False),dict(clearance(),billing_documentation_verified=False),dict(clearance(),binding_sha256='wrong')]:
            loader=unittest.mock.Mock(side_effect=AssertionError('must not read key'))
            with self.assertRaises(ValueError):pilot.run(c,candidates(),Path(self.tmp.name)/'blocked',key_loader=loader)
            loader.assert_not_called()

    def test_no_redirect_follow(self):self.assertIsNone(pilot.NoRedirect().redirect_request(None,None,None,None,None,None))

    def test_transport_pins_destination_tls_no_proxy_and_redacts_secret_echo(self):
        secret='offline-synthetic-secret';seen={}
        class Reply:
            headers={'x-request-id':'offline-request'}
            def __enter__(self):return self
            def __exit__(self,*a):return False
            def read(self,limit):return json.dumps({'echo':secret}).encode()
        class Opener:
            def open(self,req,timeout):
                seen.update(url=req.full_url,auth=req.get_header('Authorization'),data=req.data,timeout=timeout)
                return Reply()
        def build(*handlers):
            seen['handlers']=handlers;return Opener()
        with patch.object(pilot.request,'build_opener',side_effect=build):
            body,audit=pilot.post_once('decisions',{'model':pilot.MODEL},secret)
        self.assertEqual(seen['url'],'https://api.openai.com/v1/decisions')
        self.assertEqual(seen['auth'],'Bearer '+secret);self.assertNotIn(secret.encode(),seen['data'])
        self.assertEqual(seen['handlers'][0].proxies,{})
        self.assertTrue(seen['handlers'][1]._context.check_hostname)
        self.assertIsInstance(seen['handlers'][2],pilot.NoRedirect)
        self.assertNotIn(secret,json.dumps([body,audit]))

    def test_transport_error_never_echoes_header_or_secret(self):
        secret='offline-synthetic-secret'
        class Opener:
            def open(self,*a,**k):raise pilot.error.URLError('echo '+secret)
        with patch.object(pilot.request,'build_opener',return_value=Opener()):
            with self.assertRaises(RuntimeError) as caught:pilot.post_once('responses',{},secret)
        self.assertNotIn(secret,str(caught.exception))

    def test_unknown_billed_usage_preserves_reply_and_stops_after_one_call(self):
        calls=[]
        def transport(*args):
            calls.append(1);b=extraction();del b['usage'];return b,{'requestId':'offline'}
        out=Path(self.tmp.name)/'one'
        with self.assertRaises(RuntimeError):pilot.run(clearance(),candidates(),out,transport=transport,key_loader=lambda:'offline-placeholder')
        self.assertEqual(len(calls),1)
        db=pilot.Ledger(self.state/'budget.sqlite','approved-ifttt-comparison-USD0.26')
        try:
            saved=json.loads(db.db.execute('SELECT response FROM attempts WHERE id=?',('lindgren-0',)).fetchone()[0])
            self.assertEqual(saved['audit']['requestId'],'offline');self.assertNotIn('usage',saved['response'])
        finally:db.close()

    def test_known_billed_incomplete_reply_stops_without_replaying(self):
        calls=[]
        def transport(*args):
            calls.append(1);b=extraction();b['status']='incomplete';return b,{'requestId':'offline'}
        out=Path(self.tmp.name)/'one'
        with self.assertRaises(ValueError):pilot.run(clearance(),candidates(),out,transport=transport,key_loader=lambda:'offline-placeholder')
        snapshot=json.loads((out/'final-ledger.json').read_text())
        self.assertEqual(len(calls),1);self.assertEqual(snapshot['attempts'][0][5],'settled')
        self.assertTrue((out/'attempt-0.json').exists());self.assertTrue((out/'stopped-partial-pair.json').exists())

    def test_fake_transport_complete_four_arm_run_and_global_budget_no_second_bundle(self):
        calls=[]
        def transport(endpoint,payload,key):
            calls.append(endpoint);return (extraction() if endpoint=='responses' else answers(payload)),{'requestId':'offline'}
        out=Path(self.tmp.name)/'one'
        result=pilot.run(clearance(),candidates(),out,transport=transport,key_loader=lambda:'offline-placeholder')
        self.assertEqual(calls,['responses','decisions','decisions']);self.assertFalse(result['nativeEligible'])
        self.assertEqual(len(result['arms']),4)
        self.assertTrue((out/'final-ledger.json').exists())
        with self.assertRaises(RuntimeError):pilot.run(clearance(),candidates(),Path(self.tmp.name)/'two',transport=transport,key_loader=lambda:'offline-placeholder')
        self.assertEqual(len(calls),3)

    def test_unknown_result_keeps_reservations_and_restart_never_resends(self):
        calls=[]
        def transport(*args):calls.append(1);raise TimeoutError('offline failure')
        out=Path(self.tmp.name)/'one'
        with self.assertRaises(RuntimeError):pilot.run(clearance(),candidates(),out,transport=transport,key_loader=lambda:'offline-placeholder')
        snapshot=json.loads((out/'final-ledger.json').read_text())
        self.assertEqual(snapshot['exposure_nano_usd'],2027520);self.assertIsNotNone(snapshot['blocked'])
        with self.assertRaises(RuntimeError):pilot.run(clearance(),candidates(),Path(self.tmp.name)/'two',transport=transport,key_loader=lambda:'offline-placeholder')
        self.assertEqual(len(calls),1);self.assertTrue((out/'stopped-partial-pair.json').exists())


if __name__=='__main__':unittest.main(verbosity=2)

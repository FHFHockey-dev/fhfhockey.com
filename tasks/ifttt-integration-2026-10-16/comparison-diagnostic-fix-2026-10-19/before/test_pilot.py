import base64,copy,hashlib,json,socket,tempfile,threading,unittest
from pathlib import Path
from unittest.mock import Mock,patch
import pilot

def candidates():
 return copy.deepcopy({'material':True,'overflow':False,'claims':[dict(id=f'control-{i}',**g['expected'],evidence=g['evidence']) for i,g in enumerate(pilot.PROFILE['labels']['claims'])]})

def usage(n=100,o=0):
 return {'input_tokens':n,'output_tokens':o,'total_tokens':n+o,'input_tokens_details':{'cached_tokens':0,'cache_write_tokens':0},'output_tokens_details':{'reasoning_tokens':0}}

def extraction(n=100,o=100):
 return {'model':pilot.MODEL,'status':'completed','usage':usage(n,o),'output':[{'type':'message','role':'assistant','content':[{'type':'output_text','text':json.dumps(candidates())}]}]}

def answer(req,n=100,p=.99):
 return {'model':pilot.MODEL,'usage':usage(n),'answers':[{'name':req['questions'][0]['name'],'type':'predicate','probability':p}]}

def clearance():
 # Synthetic fixture only. Never writes approval or reads a real key.
 assert Path(tempfile.gettempdir()).resolve() in pilot.STATE.resolve().parents
 pilot.RULES_OUTPUT=pilot.STATE.parent/'approved-rules-fixture.json'
 pilot.EXECUTION_MANIFEST=pilot.STATE.parent/'execution-fixture.json'
 pilot.RULES_OUTPUT.write_text(json.dumps(candidates()))
 pilot.EXECUTION_MANIFEST.write_text(json.dumps(pilot.manifest_document(),indent=2))
 return {'authority':'parent-final-clearance','approved':True,'policy_sha256':hashlib.sha256((pilot.POLICY/'pilot-rules.json').read_bytes()).hexdigest(),
         'binding_sha256':hashlib.sha256(Path(pilot.__file__).read_bytes()).hexdigest(),'amendment_sha256':hashlib.sha256((pilot.HERE/'amendment.json').read_bytes()).hexdigest(),
         'execution_manifest_sha256':hashlib.sha256(pilot.EXECUTION_MANIFEST.read_bytes()).hexdigest(),
         'ordinary_billing_assumptions_accepted':True,'published_standard_rates_no_extra_fees':True}

class SequentialTests(unittest.TestCase):
 def setUp(self):
  self.net=patch.object(socket.socket,'connect',side_effect=AssertionError('offline only'));self.net.start();self.addCleanup(self.net.stop)
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.state=Path(self.tmp.name)/'state'
  for name,value in [('STATE',self.state),('RULES_OUTPUT',Path(self.tmp.name)/'rules.json'),('EXECUTION_MANIFEST',Path(self.tmp.name)/'manifest.json')]:
   p=patch.object(pilot,name,value);p.start();self.addCleanup(p.stop)
 def run_fake(self,transport,out='run',key_loader=lambda:'offline-placeholder'):
  return pilot.run(clearance(),candidates(),Path(self.tmp.name)/out,transport=transport,key_loader=key_loader)

 def test_exactly_one_question_same_source_own_proposals_no_gold(self):
  req=pilot.decisions_request(candidates());e=json.loads(req['input'])
  self.assertEqual(e['source'],pilot.request_input(pilot.PROFILE['source']));self.assertEqual(len(req['questions']),1)
  self.assertEqual(req['questions'][0]['type'],'predicate');self.assertEqual(len(e['proposals']),2)
  self.assertNotIn('gradable',req['input']);self.assertNotIn('expected',req['input'])

 def test_empty_set_asks_relevance_not_vacuous_support(self):
  req=pilot.decisions_request({'material':False,'overflow':False,'claims':[]})
  self.assertEqual(req['questions'][0]['name'],'post_material_news')
  self.assertEqual(pilot.parse_decisions(req,answer(req))['meaning'],'post_relevance_without_proposals')

 def test_bad_source_span_or_physical_scope_rejects(self):
  for field,value in [('source_id','other'),('source_author','relay'),('value','x'*20000)]:
   b=candidates();b['claims'][0][field]=value
   with self.assertRaises(ValueError):pilot.decisions_request(b)
  b=candidates();b['claims'][0]['evidence']['end']=999
  with self.assertRaises(ValueError):pilot.decisions_request(b)

 def test_predicate_exact_model_name_type_cardinality_finite_probability(self):
  req=pilot.decisions_request(candidates());self.assertEqual(pilot.parse_decisions(req,answer(req))['probability'],.99)
  for mode in ['model','name','type','extra','nan','negative','boolean']:
   b=answer(req)
   if mode=='model':b['model']='other'
   if mode=='name':b['answers'][0]['name']='other'
   if mode=='type':b['answers'][0]['type']='choice'
   if mode=='extra':b['answers']*=2
   if mode=='nan':b['answers'][0]['probability']=float('nan')
   if mode=='negative':b['answers'][0]['probability']=-1
   if mode=='boolean':b['answers'][0]['probability']=True
   with self.subTest(mode=mode),self.assertRaises(ValueError):pilot.parse_decisions(req,b)

 def test_refusal_holds_all_without_fabricating_wording(self):
  req=pilot.decisions_request(candidates());b=answer(req);b['answers'][0]={'type':'refusal','name':req['questions'][0]['name']}
  review=pilot.parse_decisions(req,b);self.assertEqual(review['status'],'unknown');self.assertNotIn('wording',review)
  rows=pilot.qualify(pilot.PROFILE['source'],pilot.normalize(pilot.PROFILE['source'],candidates()))
  self.assertTrue(all(not r['accepted'] for r in pilot.apply_review(rows,review)))

 def test_supported_set_never_promotes_prior_hold(self):
  r={'accepted':False,'holds':['prior'],'claim':{}}
  self.assertEqual(pilot.apply_review([r],{'status':'scored','probability':1}),[r])
  self.assertFalse(pilot.apply_review([dict(r,accepted=True)],{'status':'scored','probability':.94})[0]['accepted'])

 def test_extraction_complete_refused_incomplete_wrong_model_or_tool(self):
  self.assertEqual(pilot.parse_extraction(extraction()),candidates());variants=[]
  for k,v in [('status','incomplete'),('model','other')]:
   b=extraction();b[k]=v;variants.append(b)
  b=extraction();b['output'][0]['content']=[{'type':'refusal'}];variants.append(b)
  b=extraction();b['output'].append({'type':'function_call'});variants.append(b)
  for b in variants:
   with self.assertRaises(ValueError):pilot.parse_extraction(b)

 def test_json_duplicates_and_nonfinite_reject(self):
  for s in ['{"x":1,"x":2}','{"x":NaN}','{"x":Infinity}']:
   with self.assertRaises(ValueError):pilot.json_strict(s)

 def test_full_context_math_not_old_decisions922k_limit(self):
  x,d,r=pilot.validate_clearance(clearance())
  self.assertEqual((x,d),(922000,1050000));self.assertEqual(r,[254394800,231000000,231000000])
  self.assertGreater(sum(r),pilot.CAP);self.assertTrue(all(n<=pilot.CAP for n in r))

 def test_conservative_usage_includes_cache_write_and_hidden_output(self):
  b=extraction();b['usage']['input_tokens_details']={'cached_tokens':10,'cache_write_tokens':20};b['usage']['output_tokens_details']['reasoning_tokens']=50
  self.assertEqual(pilot.usage_cost('responses',b,922000,1024),68750)
  b['usage'].pop('input_tokens_details');b['usage'].pop('output_tokens_details')
  self.assertEqual(pilot.usage_cost('responses',b,922000,1024),68750)
  b={'model':pilot.MODEL,'usage':usage()};b['usage']['input_tokens_details']['cached_tokens']=50
  self.assertEqual(pilot.usage_cost('decisions',b,1050000,0),11000)

 def test_missing_negative_boolean_inconsistent_overbound_or_fast_usage_rejects(self):
  variants=[]
  for k,v in [('input_tokens',None),('input_tokens',-1),('input_tokens',True),('total_tokens',1000),('input_tokens',922001)]:
   b=extraction();b['usage'][k]=v;variants.append(b)
  b=extraction();b['usage']['input_tokens_details']['cached_tokens']=101;variants.append(b)
  b=extraction();b['service_tier']='fast';variants.append(b)
  b=extraction();b['usage']['input_tokens_details']=False;variants.append(b)
  for b in variants:
   with self.assertRaises((ValueError,TypeError)):pilot.usage_cost('responses',b,922000,1024)

 def test_missing_clearance_assumptions_or_amendment_never_reads_key(self):
  for c in [{},dict(clearance(),approved=False),dict(clearance(),ordinary_billing_assumptions_accepted=False),dict(clearance(),amendment_sha256='wrong')]:
   loader=Mock(side_effect=AssertionError('must not read key'))
   with self.assertRaises(ValueError):pilot.run(c,candidates(),Path(self.tmp.name)/'blocked',key_loader=loader)
   loader.assert_not_called()

 def test_actual_imported_request_caps_source_and_rules_identity_sealed_before_key(self):
  approved=clearance();loader=Mock();sent=[]
  for field,value in [('max_output_tokens',128000),('input','other source'),('service_tier','fast')]:
   changed=copy.deepcopy(pilot.EXTRACTION);changed[field]=value
   with patch.object(pilot,'EXTRACTION',changed):
    with self.assertRaises(ValueError):pilot.run(approved,candidates(),Path(self.tmp.name)/'blocked',transport=lambda *a:sent.append(a),key_loader=loader)
  changed=candidates();changed['claims'][0]['value']='changed'
  with self.assertRaises(ValueError):pilot.run(approved,changed,Path(self.tmp.name)/'blocked',key_loader=loader)
  loader.assert_not_called();self.assertEqual(sent,[])

 def test_execution_manifest_cannot_omit_a_dependency(self):
  c=clearance();m=json.loads(pilot.EXECUTION_MANIFEST.read_text());m['files'].pop();pilot.EXECUTION_MANIFEST.write_text(json.dumps(m))
  c['execution_manifest_sha256']=hashlib.sha256(pilot.EXECUTION_MANIFEST.read_bytes()).hexdigest()
  with self.assertRaises(ValueError):pilot.verify_execution(c,candidates())

 def test_sealed_actual_bytes_and_dynamic_question_cannot_change_after_admission(self):
  c=clearance();plan=pilot.verify_execution(c,candidates());sealed=pilot.admit_payload('responses',pilot.EXTRACTION,plan)
  data=sealed.as_dict();data['max_output_tokens']=128000;self.assertEqual(sealed['max_output_tokens'],1024)
  with self.assertRaises(ValueError):pilot.seal_payload('responses',data)
  q=pilot.decisions_request(candidates());q['questions'][0]['instructions']='unreviewed instruction'
  with self.assertRaises(ValueError):pilot.admit_payload('decisions',q,plan)

 def test_concurrent_stage_zero_has_one_reservation_winner(self):
  path=Path(self.tmp.name)/'ledger.sqlite';db=pilot.Ledger(path,'concurrency');db.close();barrier=threading.Barrier(2);out=[]
  def work():
   db=pilot.Ledger(path,'concurrency')
   try:barrier.wait(timeout=3);pilot.reserve_stage(db,0,'responses',pilot.EXTRACTION,254394800);out.append('reserved')
   except ValueError:out.append('refused')
   finally:db.close()
  ts=[threading.Thread(target=work) for _ in range(2)]
  for t in ts:t.start()
  for t in ts:t.join(timeout=5)
  self.assertEqual(sorted(out),['refused','reserved'])

 def test_small_reported_charges_complete_four_arms_no_new_directory_reset(self):
  calls=[]
  def transport(endpoint,payload,key):calls.append(endpoint);return (extraction() if endpoint=='responses' else answer(payload)),{'requestId':'offline'}
  r=self.run_fake(transport);self.assertEqual(calls,['responses','decisions','decisions']);self.assertEqual(len(r['arms']),4)
  self.assertFalse(r['nativeEligible']);self.assertEqual(r['ledger']['exposure_nano_usd'],90750)
  with self.assertRaises(ValueError):self.run_fake(transport,out='again')
  self.assertEqual(len(calls),3)

 def test_exact29m_prior_ceiling_admits_next231m_but_one_nano_more_refuses(self):
  for amount,should_fit in [(29000000,True),(29000001,False)]:
   db=pilot.Ledger(Path(self.tmp.name)/f'boundary-{amount}.sqlite','boundary')
   try:
    pilot.reserve_stage(db,0,'responses',pilot.EXTRACTION,254394800)
    db.begin('lindgren-0',pilot.EXTRACTION);db.settle('lindgren-0',{},amount)
    if should_fit:
     pilot.reserve_stage(db,1,'decisions',pilot.decisions_request(candidates()),231000000)
     self.assertEqual(db.snapshot()['exposure_nano_usd'],pilot.CAP)
    else:
     with self.assertRaises(pilot.BudgetStop):pilot.reserve_stage(db,1,'decisions',pilot.decisions_request(candidates()),231000000)
     self.assertEqual(len(db.snapshot()['attempts']),1)
   finally:db.close()

 def test_expensive_extraction_stops_before_first_decisions(self):
  calls=[]
  def transport(*args):calls.append(1);return extraction(240000,100),{'requestId':'offline'}
  with self.assertRaises(pilot.BudgetStop):self.run_fake(transport)
  self.assertEqual(len(calls),1);p=json.loads((Path(self.tmp.name)/'run/stopped-partial-pair.json').read_text())
  self.assertEqual(p['status'],'stopped_budget');self.assertEqual(p['goldClaimsInDenominator'],2);self.assertLessEqual(p['ledger']['exposure_nano_usd'],pilot.CAP)

 def test_expensive_first_decision_stops_before_second_without_overrun(self):
  calls=[]
  def transport(endpoint,payload,key):calls.append(endpoint);return (extraction() if endpoint=='responses' else answer(payload,n=1050000)),{'requestId':'offline'}
  with self.assertRaises(pilot.BudgetStop):self.run_fake(transport)
  self.assertEqual(calls,['responses','decisions']);s=json.loads((Path(self.tmp.name)/'run/final-ledger.json').read_text())
  self.assertEqual(s['exposure_nano_usd'],231068750);self.assertLessEqual(s['exposure_nano_usd'],pilot.CAP);self.assertEqual(len(s['attempts']),2)

 def test_unknown_first_outcome_retains_only_full_first_reservation_no_restart(self):
  calls=[]
  def transport(*args):calls.append(1);raise TimeoutError('offline')
  with self.assertRaises(RuntimeError):self.run_fake(transport)
  s=json.loads((Path(self.tmp.name)/'run/final-ledger.json').read_text());self.assertEqual(s['exposure_nano_usd'],254394800);self.assertIsNotNone(s['blocked'])
  with self.assertRaises(ValueError):self.run_fake(transport,out='again')
  self.assertEqual(len(calls),1)

 def test_unknown_second_outcome_retains231m_plus_known_first_charge(self):
  calls=[]
  def transport(endpoint,payload,key):
   calls.append(endpoint);b=extraction() if endpoint=='responses' else answer(payload)
   if endpoint=='decisions':del b['usage']
   return b,{'requestId':'offline'}
  with self.assertRaises(RuntimeError):self.run_fake(transport)
  s=json.loads((Path(self.tmp.name)/'run/final-ledger.json').read_text());self.assertEqual(s['exposure_nano_usd'],231068750);self.assertEqual(len(calls),2)

 def test_known_billed_incomplete_stops_with_saved_charge(self):
  calls=[]
  def transport(*args):calls.append(1);b=extraction();b['status']='incomplete';return b,{'requestId':'offline'}
  with self.assertRaises(ValueError):self.run_fake(transport)
  s=json.loads((Path(self.tmp.name)/'run/final-ledger.json').read_text());self.assertEqual(len(calls),1);self.assertEqual(s['attempts'][0][5],'settled')

 def test_decoded_unicode_percent_base64_nested_keys_and_values_are_redacted(self):
  token='OFFLINE_REVIEW_SYNTHETIC_TOKEN';u=''.join('\\u%04x'%ord(c) for c in token);percent=''.join('%%%02x'%ord(c) for c in token)
  data={token:[token,u,percent,base64.b64encode(token.encode()).decode()]}
  cleaned=pilot.redact_tree(data,token);serialized=json.dumps(cleaned)
  for variant in [token,u,percent,base64.b64encode(token.encode()).decode()]:self.assertNotIn(variant,serialized)

 def test_real_transport_fixed_tls_no_proxy_no_headers_and_secret_redaction(self):
  token='OFFLINE_REVIEW_SYNTHETIC_TOKEN';seen={};req=pilot.decisions_request(candidates())
  class Reply:
   headers={'x-request-id':token}
   def __enter__(self):return self
   def __exit__(self,*a):return False
   def read(self,limit):return json.dumps({'echo':token}).replace(token,''.join('\\u%04x'%ord(c) for c in token)).encode()
  class Opener:
   def open(self,r,timeout):seen.update(url=r.full_url,auth=r.get_header('Authorization'),data=r.data);return Reply()
  def build(*handlers):seen['handlers']=handlers;return Opener()
  with patch.object(pilot.request,'build_opener',side_effect=build):body,audit=pilot.post_once('decisions',req,token)
  self.assertEqual(seen['url'],'https://api.openai.com/v1/decisions');self.assertEqual(seen['auth'],'Bearer '+token)
  self.assertEqual(seen['handlers'][0].proxies,{});self.assertTrue(seen['handlers'][1]._context.check_hostname)
  self.assertIsInstance(seen['handlers'][2],pilot.NoRedirect);self.assertNotIn(token,json.dumps([body,audit]));self.assertFalse(audit['headersRetained'])

if __name__=='__main__':unittest.main(verbosity=2)

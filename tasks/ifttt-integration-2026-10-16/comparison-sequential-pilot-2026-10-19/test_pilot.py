import base64,copy,hashlib,io,json,socket,sqlite3,ssl,tempfile,threading,unittest
from contextlib import closing
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

class DiagnosticTests(unittest.TestCase):
 setUp=SequentialTests.setUp
 run_fake=SequentialTests.run_fake
 token='OFFLINE_DIAGNOSTIC_SECRET'

 def check_fault(self,*,opener=None,construct_error=None,wire_error=False):
  opener=Mock() if opener is None else opener
  def transport(endpoint,payload,key):
   if wire_error:payload=pilot.SealedPayload(endpoint,payload.wire,'wrong')
   return pilot.post_once(endpoint,payload,key)
  with patch.object(pilot.request,'build_opener',return_value=opener,side_effect=construct_error):
   with self.assertRaises(pilot.PilotFailure) as caught:
    self.run_fake(transport,key_loader=lambda:self.token)
  with closing(sqlite3.connect('file:'+str(pilot.STATE/'budget.sqlite')+'?mode=ro',uri=True)) as db:
   rows=db.execute('SELECT state,response,reserve,actual FROM attempts').fetchall()
  self.assertEqual(len(rows),1);state,stored,reserve,actual=rows[0]
  self.assertEqual((state,reserve,actual),('uncertain',254394800,None))
  stored=json.loads(stored);failure=stored['failure']
  self.assertEqual(failure,caught.exception.metadata)
  stopped=json.loads((Path(self.tmp.name)/'run/stopped-partial-pair.json').read_text())
  self.assertEqual(stopped['failure'],failure);self.assertEqual(stopped['ledger']['exposure_nano_usd'],254394800)
  self.assertIsNone(stored['response']);self.assertIsNone(stored['audit'])
  for variant in [self.token,''.join('\\u%04x'%ord(c) for c in self.token),
                  ''.join('%%%02x'%ord(c) for c in self.token),base64.b64encode(self.token.encode()).decode(),
                  'ARBITRARY_HEADER_SECRET','ARBITRARY_ERROR_BODY_SECRET']:
   self.assertNotIn(variant,json.dumps(stored)+json.dumps(stopped)+str(caught.exception))
  # Failure diagnostics do not permit another send, even to a new output dir.
  loader=Mock(side_effect=AssertionError('no retry key load'))
  with self.assertRaises(ValueError):self.run_fake(transport,out='restart',key_loader=loader)
  loader.assert_not_called()
  return failure,opener

 def reply(self,raw=None,failure=None,close_failure=None):
  class Reply:
   status=200
   headers={'x-request-id':'req_control123','Authorization':'ARBITRARY_HEADER_SECRET'}
   def __enter__(self):return self
   def __exit__(self,*_):
    if close_failure:raise close_failure
    return False
   def read(self,limit):
    if failure:raise failure
    return raw
  opener=Mock();opener.open.return_value=Reply();return opener

 def test_pre_dispatch_wire_failure_keeps_stage_and_never_opens(self):
  f,opener=self.check_fault(wire_error=True)
  self.assertEqual((f['stage'],f['cause'],f['dispatch']),('pre_dispatch','validation_error','not_started'))
  opener.open.assert_not_called()

 def test_construct_failure_keeps_safe_errno_without_message(self):
  f,opener=self.check_fault(construct_error=OSError(22,self.token))
  self.assertEqual((f['stage'],f['cause'],f['errno']),('construct','os_error',22))
  self.assertFalse(f['openCallStarted']);opener.open.assert_not_called()

 def test_http_error_preserves_status_ids_usage_but_not_error_text_or_headers(self):
  body={'id':'resp_control123','usage':usage(7,2),'error':{'code':'invalid_api_key','type':'authentication_error','message':self.token,'other':'ARBITRARY_ERROR_BODY_SECRET'}}
  headers={'x-request-id':'req_control123','Authorization':self.token,'x-other':'ARBITRARY_HEADER_SECRET'}
  opener=Mock();opener.open.side_effect=pilot.error.HTTPError('https://api.openai.com/v1/responses',401,self.token,headers,io.BytesIO(json.dumps(body).encode()))
  f,_=self.check_fault(opener=opener)
  self.assertEqual((f['stage'],f['cause'],f['dispatch']),('open','http_error','unknown'))
  self.assertEqual(f['provider'],{'httpStatus':401,'requestId':'req_control123','responseId':'resp_control123','reportedUsage':usage(7,2),'error_code':'invalid_api_key','error_type':'authentication_error'})
  self.assertEqual(opener.open.call_count,1)

 def test_http_error_malformed_body_still_preserves_status_and_request_id(self):
  opener=Mock();opener.open.side_effect=pilot.error.HTTPError('https://api.openai.com/v1/responses',502,self.token,{'x-request-id':'req_control123'},io.BytesIO(b'ARBITRARY_ERROR_BODY_SECRET'))
  f,_=self.check_fault(opener=opener)
  self.assertEqual(f['provider'],{'httpStatus':502,'requestId':'req_control123','responseId':None,'reportedUsage':{}})

 def test_dns_reason_keeps_category_and_errno_without_reason_string(self):
  opener=Mock();opener.open.side_effect=pilot.error.URLError(socket.gaierror(-2,self.token))
  f,_=self.check_fault(opener=opener)
  self.assertEqual((f['stage'],f['cause'],f['exceptionType'],f['errno']),('open','dns_error','gaierror',-2))

 def test_tls_reason_keeps_verification_code_without_message(self):
  exc=ssl.SSLCertVerificationError(1,self.token);exc.verify_code=20
  opener=Mock();opener.open.side_effect=pilot.error.URLError(exc)
  f,_=self.check_fault(opener=opener)
  self.assertEqual((f['stage'],f['cause'],f['verify_code']),('open','tls_certificate_error',20))

 def test_read_timeout_keeps_received_status_and_request_id(self):
  f,_=self.check_fault(opener=self.reply(failure=TimeoutError(self.token)))
  self.assertEqual((f['stage'],f['cause']),('read','timeout'))
  self.assertEqual((f['provider']['httpStatus'],f['provider']['requestId']),(200,'req_control123'))

 def test_json_error_keeps_parse_position_without_source_text(self):
  f,_=self.check_fault(opener=self.reply(raw=b'{"private":"ARBITRARY_ERROR_BODY_SECRET"} trailing'))
  self.assertEqual((f['stage'],f['cause']),('parse_json','invalid_json'))
  self.assertIsInstance(f['pos'],int);self.assertEqual(f['provider']['requestId'],'req_control123')

 def test_decode_error_keeps_category_without_bytes(self):
  f,_=self.check_fault(opener=self.reply(raw=b'\xffARBITRARY_ERROR_BODY_SECRET'))
  self.assertEqual((f['stage'],f['cause']),('decode','invalid_encoding'))

 def test_overflow_keeps_stage_and_received_metadata(self):
  f,_=self.check_fault(opener=self.reply(raw=b'x'*1_048_577))
  self.assertEqual((f['stage'],f['cause']),('reply_size','validation_error'))
  self.assertEqual(f['provider']['httpStatus'],200)

 def test_usage_error_keeps_only_numeric_usage_and_received_ids(self):
  body=extraction();body.update(id='resp_control123',private='ARBITRARY_ERROR_BODY_SECRET')
  body['usage']['total_tokens']=self.token
  f,_=self.check_fault(opener=self.reply(raw=json.dumps(body).encode()))
  self.assertEqual((f['stage'],f['cause']),('usage_validation','validation_error'))
  self.assertEqual((f['provider']['requestId'],f['provider']['responseId']),('req_control123','resp_control123'))
  self.assertEqual(f['provider']['reportedUsage']['input_tokens'],100)
  self.assertNotIn('total_tokens',f['provider']['reportedUsage'])

 def test_reply_close_error_keeps_already_parsed_usage_and_ids(self):
  body=extraction();body['id']='resp_control123'
  f,_=self.check_fault(opener=self.reply(raw=json.dumps(body).encode(),close_failure=OSError(5,self.token)))
  self.assertEqual((f['stage'],f['cause']),('close_reply','os_error'))
  self.assertEqual(f['provider']['reportedUsage'],body['usage'])
  self.assertEqual(f['provider']['responseId'],'resp_control123')

 def test_output_validation_retains_stage_without_changing_known_settlement(self):
  body=extraction();body['status']='incomplete';body['id']='resp_control123'
  opener=self.reply(raw=json.dumps(body).encode())
  with patch.object(pilot.request,'build_opener',return_value=opener):
   with self.assertRaises(ValueError):self.run_fake(pilot.post_once,key_loader=lambda:self.token)
  stopped=json.loads((Path(self.tmp.name)/'run/stopped-partial-pair.json').read_text())
  self.assertEqual(stopped['failure']['stage'],'output_validation')
  self.assertEqual(stopped['failure']['provider']['reportedUsage'],body['usage'])
  self.assertEqual(stopped['ledger']['attempts'][0][5],'settled')
  self.assertEqual(opener.open.call_count,1)

 def test_identifier_slots_drop_raw_unicode_percent_and_base64_key_variants(self):
  token=self.token
  variants=[token,''.join('\\u%04x'%ord(c) for c in token),''.join('%%%02x'%ord(c) for c in token),base64.b64encode(token.encode()).decode()]
  for variant in variants:
   with self.subTest(variantKind=variants.index(variant)):
    metadata=pilot.provider_metadata(token,headers={'x-request-id':'req_'+variant},body={'id':'resp_'+variant})
    self.assertIsNone(metadata['requestId']);self.assertIsNone(metadata['responseId'])
    self.assertNotIn(variant,json.dumps(metadata))

 def test_metadata_allowlist_rejects_bad_ids_counts_and_arbitrary_exception_names(self):
  metadata=pilot.provider_metadata(self.token,status=True,headers={'x-request-id':'req_bad\r\nsecret'},
    body={'id':'resp_'+'x'*200,'private':'ARBITRARY_ERROR_BODY_SECRET',
          'usage':{'input_tokens':True,'output_tokens':-1,'total_tokens':2**64,'other':self.token,
                   'input_tokens_details':{'cached_tokens':3,'cache_write_tokens':self.token,'other':self.token}}})
  self.assertEqual(metadata,{'httpStatus':None,'requestId':None,'responseId':None,'reportedUsage':{'input_tokens_details':{'cached_tokens':3}}})
  secret_class=type(self.token,(Exception,),{})
  f=pilot.failure_metadata('open',secret_class(self.token),self.token,opened=True)
  self.assertEqual((f['exceptionType'],f['cause']),('Exception','unexpected_exception'))
  self.assertNotIn(self.token,json.dumps(f))

 def test_explicit_certifi_bundle_is_loaded_with_full_verification(self):
  before=ssl.get_default_verify_paths();opener=self.reply(raw=b'{}')
  original=ssl.create_default_context
  with patch.object(pilot.ssl,'create_default_context',wraps=original) as create,patch.object(pilot.request,'build_opener',return_value=opener) as build:
   pilot.post_once('responses',pilot.EXTRACTION,self.token)
  create.assert_called_once_with(cafile=pilot.certifi.where())
  ctx=build.call_args.args[1]._context
  self.assertEqual(ctx.verify_mode,ssl.CERT_REQUIRED);self.assertTrue(ctx.check_hostname)
  self.assertGreater(ctx.cert_store_stats()['x509_ca'],0)
  self.assertEqual(ssl.get_default_verify_paths(),before);self.assertEqual(opener.open.call_count,1)

 def test_missing_certifi_bundle_fails_before_open_without_fallback(self):
  with patch.object(pilot.certifi,'where',return_value=str(Path(self.tmp.name)/'missing.pem')),patch.object(pilot.request,'build_opener') as build:
   with self.assertRaises(pilot.PilotFailure) as caught:pilot.post_once('responses',pilot.EXTRACTION,self.token)
  self.assertEqual(caught.exception.metadata['stage'],'construct')
  self.assertFalse(caught.exception.metadata['openCallStarted']);build.assert_not_called()

 def test_certifi_loader_and_bundle_are_bound_execution_dependencies(self):
  paths=pilot.execution_paths()
  for p in [Path(pilot.certifi.__file__),Path(pilot.certifi.core.__file__),Path(pilot.certifi.where())]:self.assertIn(p,paths)


if __name__=='__main__':unittest.main(verbosity=2)

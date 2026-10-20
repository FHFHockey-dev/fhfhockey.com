import copy,json,socket,tempfile,unittest
from pathlib import Path
from unittest.mock import patch,Mock
import pilot
from test_pilot import candidates,extraction,clearance
ROOT=Path(__file__).resolve().parents[3]
class IndependentBinding(unittest.TestCase):
 def setUp(self):
  self.network=patch.object(socket.socket,'connect',side_effect=AssertionError('no real network'));self.network.start();self.addCleanup(self.network.stop)
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.state=Path(self.tmp.name)/'state';self.sp=patch.object(pilot,'STATE',self.state);self.sp.start();self.addCleanup(self.sp.stop)
 def secret_case(self,kind):
  # Deliberately synthetic; no real credential is read, created or used.
  token='OFFLINE_REVIEW_SYNTHETIC_TOKEN';reply=extraction();reply['status']='incomplete'
  if kind=='escaped_body':reply['diagnostic']=token
  wire=json.dumps(reply)
  if kind=='escaped_body':wire=wire.replace(token,''.join('\\u%04x'%ord(c) for c in token))
  metadata={'x-request-id':token if kind=='header' else 'offline-id'};opened=[]
  class Reply:
   headers=metadata
   def __enter__(self):return self
   def __exit__(self,*a):return False
   def read(self,_limit):return wire.encode()
  class Opener:
   def open(self,req,timeout):opened.append(req.full_url);return Reply()
  out=Path(self.tmp.name)/'run'
  with patch.object(pilot.request,'build_opener',return_value=Opener()):
   with self.assertRaises(ValueError):pilot.run(clearance(),candidates(),out,transport=pilot.post_once,key_loader=lambda:token)
  self.assertEqual(len(opened),1)
  attempt=(out/'attempt-0.json').read_text();db=pilot.Ledger(self.state/'budget.sqlite','approved-ifttt-comparison-USD0.26')
  try:stored=db.db.execute('SELECT response FROM attempts WHERE id=?',('lindgren-0',)).fetchone()[0]
  finally:db.close()
  proof={'control':'synthetic credential echo only','kind':kind,'openerCalls':len(opened),'actualProviderCalls':0,'tokenPersistedInAttempt':token in attempt,'tokenPersistedInLedger':token in stored}
  ROOT.joinpath('secret-'+kind+'-evidence.json').write_text(json.dumps(proof,indent=2)+'\n')
  self.assertFalse(token in attempt or token in stored,'Decoded reply/header must not persist a supplied credential')
 def test_escaped_json_secret_echo_cannot_enter_durable_artifacts(self):self.secret_case('escaped_body')
 def test_request_id_secret_echo_cannot_enter_durable_artifacts(self):self.secret_case('header')
 def test_clearance_seals_extraction_request_caps_before_loading_key(self):
  approved=clearance();changed=copy.deepcopy(pilot.EXTRACTION);changed['max_output_tokens']=128000
  loaded=Mock(return_value='OFFLINE_ONLY');sent=[]
  def transport(endpoint,payload,key):
   sent.append({'endpoint':endpoint,'max_output_tokens':payload.get('max_output_tokens')});b=extraction();b['status']='incomplete';return b,{'requestId':'offline'}
  with patch.object(pilot,'EXTRACTION',changed):
   with self.assertRaises(ValueError):pilot.run(approved,candidates(),Path(self.tmp.name)/'run',transport=transport,key_loader=loaded)
  ROOT.joinpath('unsealed-request-evidence.json').write_text(json.dumps({'syntheticControl':True,'approvedBindingAndPolicyHashesUnchanged':True,'clearanceOutputReservation':1024,'changedRequestOutputLimit':128000,'keyLoaderCalls':loaded.call_count,'sent':sent,'actualProviderCalls':0},indent=2)+'\n')
  loaded.assert_not_called()
  self.assertEqual(sent,[],'Unreviewed request limits must be rejected before dispatch')

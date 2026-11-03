import ast,sys,os,json,pathlib,uuid
from unittest.mock import patch
from types import SimpleNamespace
root=pathlib.Path('/Users/tim/Code/fhfhockey.com');out=root/'tasks/artifacts/nst-independent-review-2026-11-01/re-review'
sys.path.insert(0,str(root/'functions'))
from lib import nst_admission as a
old=root/'tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/nst-goalie-writer-20261101/checkpoint-adapter/caller-qualification/candidate/functions/api/fetch_team_table.py'
results=[]
for variant,path in [('old',old),('current',root/'functions/api/fetch_team_table.py')]:
 for outcome in ['success','loader-failure','output-failure']:
  events=[]
  def bootstrap(keys):
   assert keys==['NST_KEY','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];events.append('bootstrap')
   if outcome=='loader-failure':raise RuntimeError('fixture loader failure')
   os.environ.update(NST_KEY='fixture',NEXT_PUBLIC_SUPABASE_URL='https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY='fixture')
  def post(url,**kw):
   assert url.startswith('https://offline.invalid/rest/v1/rpc/');name=url.rsplit('/',1)[-1];events.append(name)
   assert name in ['nst_job_begin_v1','nst_job_finish_v1','nst_job_hold_v1']
   return SimpleNamespace(status_code=200,json=lambda:{'status':'started' if 'begin' in name else 'finished' if 'finish' in name else 'held','token':kw['json']['p_token']})
  def fetch(**kw):
   a.assert_nst_job_active();events.append('fetch-and-output');return SimpleNamespace(status_code=503 if outcome=='output-failure' else 200)
  main=next(n for n in ast.parse(path.read_text()).body if isinstance(n,ast.If) and isinstance(n.test,ast.Compare) and getattr(n.test.left,'id',None)=='__name__')
  error=None
  with patch.dict(os.environ,{'NST_JOB_LIFECYCLE_ENABLED':'true'},clear=True),patch.object(sys,'argv',['fixture','--sit','5v5','--rate','n']),patch.object(a.requests,'post',side_effect=post),patch.object(a.requests,'get',side_effect=AssertionError('network forbidden')):
   ns={'__name__':'__main__','argparse':__import__('argparse'),'nst_job':a.nst_job,'NstAdmissionError':a.NstAdmissionError,'fetch_team_table':fetch,'ensure_loaded_for':bootstrap}
   try:exec(compile(ast.Module(body=main.body,type_ignores=[]),str(path),'exec'),ns)
   except RuntimeError as e:error=str(e)
  if variant=='old':assert not events and error=='NST lifecycle configuration or deadline unavailable.'
  elif outcome=='loader-failure':assert events==['bootstrap'] and error=='fixture loader failure'
  else:
   assert events==['bootstrap','nst_job_begin_v1','fetch-and-output','nst_job_finish_v1' if outcome=='success' else 'nst_job_hold_v1']
   assert (error is None)==(outcome=='success')
  results.append({'variant':variant,'outcome':outcome,'events':events,'error':error})
(out/'cli-differential.json').write_text(json.dumps({'status':'PASS','cases':results,'networkCalls':0,'envFilesRead':0},indent=2)+'\n')
print('CLI differential:6 cases PASS; zero network/env-file reads')

"""Supervised one-report invocation of the pinned CLI; no loop, retries or API implementation."""
import json,os,pathlib,subprocess,sys,time
root=pathlib.Path.cwd();assert root.name=='fhfhockey.com'
d=root/'tasks/artifacts/luna-reference-package-2026-10-31/continuation-e04-execution';f=d.parent/'continuation-v4-e04'
assert len(sys.argv)==2;case=sys.argv[1];assert case in json.loads((f/'PLAN.json').read_text())['selectedCaseIds']
base_env={'PATH':os.environ['PATH'],'TMPDIR':'/tmp','NODE_PATH':'.:./node_modules','TS_NODE_COMPILER_OPTIONS':'{"module":"CommonJS","moduleResolution":"node","allowJs":false}'}
offline=dict(base_env,NODE_OPTIONS='--require='+str(d.parent/'deny-network.cjs'))
control=['node','--experimental-require-module','-r','ts-node/register/transpile-only',str(d/'control.ts')]
with (d/(case+'.operator.log')).open('x') as operator_log:
 pre=subprocess.run(control+['preflight',case],cwd=root/'web',env=offline,stdout=operator_log,stderr=subprocess.STDOUT)
 if pre.returncode:print('Preflight held; no CLI invocation.');sys.exit(2)
 code=-1;start=time.monotonic()
 try:
  with (d/(case+'.cli.log')).open('x') as cli_log:
   paid_env=dict(base_env,NODE_OPTIONS='',IFTTT_LUNA_REVIEW_ENABLED='true',IFTTT_LUNA_REVIEW_STOP='false')
   command=['node','--env-file=.env.local','--experimental-require-module','-r','ts-node/register/transpile-only','scripts/review-ifttt-luna.ts','--input',str(f/'inputs'/(case+'.json')),'--output',str(d/'reviews'/(case+'.json')),'--binding-candidate-output',str(d/'candidates'/(case+'.json')),'--ledger',str(d.parent/'paid-evaluation/ledger.json'),'--dispatch']
   code=subprocess.run(command,cwd=root/'web',env=paid_env,stdout=cli_log,stderr=subprocess.STDOUT).returncode
 finally:
  grade=subprocess.run(control+['grade',case,str(code)],cwd=root/'web',env=offline,stdout=operator_log,stderr=subprocess.STDOUT)
  timing={'caseId':case,'cliExitCode':code,'gradingExitCode':grade.returncode,'wallSeconds':round(time.monotonic()-start,3),'automaticRetry':False}
  with (d/(case+'.time.json')).open('x') as out:json.dump(timing,out,indent=2);out.write('\n')
 print(json.dumps(timing));sys.exit(grade.returncode)

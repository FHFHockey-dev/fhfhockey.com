from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,subprocess,os
root=Path(__file__).resolve().parent
approval=json.loads((root/'APPROVED-REPORT-READ-20261026.json').read_text())
script=root/'capture-required-reports.mjs'
source_map=root.parent/'history-qualification-01/GAME-DATE-MAP.json'
assert hashlib.sha256(script.read_bytes()).hexdigest()==approval['scriptSha256']
assert hashlib.sha256(source_map.read_bytes()).hexdigest()==approval['mapSha256']
assert not (root/'PUBLIC-REPORT-BATCH-RECEIPT.json').exists()
assert not (root/'reports').exists() or not list((root/'reports').iterdir())
intent={'startedAt':datetime.now(timezone.utc).isoformat(),'approvalEvidence':'APPROVED-REPORT-READ-20261026.json','executionCount':1,'retryCount':0,'overallProcessSeconds':50,'status':'dispatching'}
with (root/'APPROVED-EXECUTION-RECEIPT.json').open('x') as f:json.dump(intent,f,indent=2)
env=os.environ.copy();env.pop('GIT_DIR',None)
try:
 result=subprocess.run(['/usr/local/bin/node',str(script)],cwd=root,env=env,capture_output=True,text=True,timeout=50)
 (root/'APPROVED-EXECUTION-STDOUT.log').write_text(result.stdout)
 (root/'APPROVED-EXECUTION-STDERR.log').write_text(result.stderr)
 intent.update({'exitCode':result.returncode,'status':'finished'})
 print(result.stdout[-14000:]);print(result.stderr[-1000:])
except subprocess.TimeoutExpired:
 intent.update({'exitCode':124,'status':'killed-at-overall-cap-no-retry'})
finally:
 intent['finishedAt']=datetime.now(timezone.utc).isoformat()
 (root/'APPROVED-EXECUTION-RECEIPT.json').write_text(json.dumps(intent,indent=2)+'\n')
print(json.dumps(intent))

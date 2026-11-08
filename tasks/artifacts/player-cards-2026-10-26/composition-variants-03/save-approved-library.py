from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,hashlib,re
root=Path(__file__).resolve().parent
approval=json.loads((root/'LIBRARY-APPROVAL-20261026.json').read_text())
for f in approval['files']: assert hashlib.sha256(Path(f['file']).read_bytes()).hexdigest()==f['sha256']
request={'uploads':[{'local_path':f['file'],'purpose':'create_library_file','library_artifact_type':'image'} for f in approval['files']]}
receipt={'startedAt':datetime.now(timezone.utc).isoformat(),'approvalEvidence':'LIBRARY-APPROVAL-20261026.json','executionCount':1,'retryOfExecutedOperation':False,'request':request}
with (root/'LIBRARY-UPLOAD-EXECUTION-INTENT.json').open('x') as f:json.dump(receipt,f,indent=2)
clean=lambda s:re.sub(r'https?://[^\s\"\']+','[private URL redacted]',s)
try:
 result=subprocess.run(['python3','/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-approved03-library-mruhv6bg/library_upload.py'],input=json.dumps(request),text=True,capture_output=True,timeout=60)
 (root/'LIBRARY-APPROVED-STDOUT.log').write_text(clean(result.stdout));(root/'LIBRARY-APPROVED-STDERR.log').write_text(clean(result.stderr))
 receipt['exitCode']=result.returncode
 try:
  output=json.loads(result.stdout);receipt['results']=output.get('results',output);print(clean(json.dumps(output)))
 except ValueError:
  receipt['results']=None;print('exit',result.returncode);print(clean(result.stderr)[-2200:]);print(clean(result.stdout)[-1000:])
except subprocess.TimeoutExpired:
 receipt.update({'exitCode':124,'outcomeUncertain':True});print('Library helper timed out; no automatic retry')
finally:
 receipt['finishedAt']=datetime.now(timezone.utc).isoformat();(root/'LIBRARY-APPROVED-DELIVERY-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')

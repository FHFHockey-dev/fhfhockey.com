from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,hashlib,re
root=Path(__file__).resolve().parent
request=json.loads((root/'LIBRARY-REQUEST.json').read_text())
for row,expected in zip(request['uploads'],request['expectedSha256']): assert hashlib.sha256(Path(row['local_path']).read_bytes()).hexdigest()==expected
receipt={'startedAt':datetime.now(timezone.utc).isoformat(),'helperAttempts':1,'retryPerformed':False,'requestOrder':[r['local_path'] for r in request['uploads']]}
with (root/'LIBRARY-EXECUTION-INTENT.json').open('x') as f:json.dump(receipt,f,indent=2)
clean=lambda s:re.sub(r'https?://[^\s\"\']+','[private URL redacted]',s)
try:
 result=subprocess.run(['python3','/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-visual02-library-qvq6g0qx/library_upload.py'],input=json.dumps({'uploads':request['uploads']}),text=True,capture_output=True,timeout=60)
 (root/'LIBRARY-STDOUT.log').write_text(clean(result.stdout));(root/'LIBRARY-STDERR.log').write_text(clean(result.stderr))
 receipt['exitCode']=result.returncode
 try:
  output=json.loads(result.stdout); receipt['results']=output.get('results',output);print(json.dumps(output))
 except ValueError:
  receipt['results']=None;print('exit',result.returncode);print(clean(result.stderr)[-2200:]);print(clean(result.stdout)[-800:])
except subprocess.TimeoutExpired:
 receipt.update({'exitCode':124,'outcomeUncertain':True});print('Library helper timed out; no retry')
finally:
 receipt['finishedAt']=datetime.now(timezone.utc).isoformat();(root/'LIBRARY-DELIVERY-RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')

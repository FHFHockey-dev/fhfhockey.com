from pathlib import Path
import json,subprocess,hashlib,re
from datetime import datetime,timezone
root=Path(__file__).resolve().parent
request=json.loads((root/'reference-transfer-private.json').read_text());results=[]
for t in request['transfers']:
 dest=root/'reference'/t['file_name']
 result=subprocess.run(['python3',request['helper'],'materialize',str(dest)],input=json.dumps(t),text=True,capture_output=True,timeout=20)
 item={'library_file_id':t['library_file_id'],'file_id':t['file_id'],'version':t['current_version_number'],'file_name':t['file_name'],'local_path':str(dest),'exitCode':result.returncode,'readable':dest.is_file(),'error':re.sub(r'https?://[^\s\"\']+','[private URL redacted]',result.stderr.strip())}
 if dest.is_file():
  b=dest.read_bytes();item.update({'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});assert len(b)==t['size_bytes']
 results.append(item);(root/'REFERENCE-MATERIALIZATION.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'attemptsPerFile':1,'results':results},indent=2)+'\n');print(json.dumps(item),flush=True)

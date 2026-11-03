from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,urllib.request
root=Path(__file__).resolve().parent
pin=json.loads((root/'candidate-pins.json').read_text())['preview.html']
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
with opener.open('http://127.0.0.1:3125/player-cards',timeout=3) as response:
 body=response.read(pin['bytes']+1)
 result={'at':datetime.now(timezone.utc).isoformat(),'url':'http://127.0.0.1:3125/player-cards','status':response.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'remoteAvailabilityClaimed':False,'publicRequests':0}
 assert response.status==200 and len(body)==pin['bytes'] and result['sha256']==pin['sha256']
(root/'DELIVERY-LOCAL-READBACK.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))

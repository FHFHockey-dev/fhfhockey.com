from pathlib import Path
import json,urllib.request,hashlib
from datetime import datetime,timezone
root=Path(__file__).resolve().parent
pins=json.loads((root.parent/'composition-variants-01/candidate-pins.json').read_text())['comparison.html']
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
with opener.open('http://127.0.0.1:3125/player-cards/compositions',timeout=3) as response:
 body=response.read(pins['bytes']+1)
 receipt={'at':datetime.now(timezone.utc).isoformat(),'url':'http://127.0.0.1:3125/player-cards/compositions','httpStatus':response.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'matchesPriorFrozenComparison':len(body)==pins['bytes'] and hashlib.sha256(body).hexdigest()==pins['sha256'],'remoteAvailabilityClaimed':False}
 assert response.status==200 and receipt['matchesPriorFrozenComparison']
(root/'PRIOR-COMPARISON-READBACK.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))

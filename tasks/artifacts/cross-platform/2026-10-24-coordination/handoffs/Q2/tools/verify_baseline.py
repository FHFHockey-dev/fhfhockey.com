"""Compare main + isolated Unity projects against the recorded 611-file v12 baseline (read-only)."""
import hashlib, json, sys, datetime
from pathlib import Path
BASE = Path('/Users/tim/Documents/Codex/2026-10-11/task-12/Resume20261023C/baseline-v12-hashes.json')
MAIN = Path('/Users/tim/Desktop/MetaQuestGame/Vesper Basin Prototype')
ISO = Path('/Users/tim/Documents/Codex/2026-10-11/task-12/Resume20261023B/V12ValidationProject')
V13 = 'Assets/MapPrototype/Scenes/VesperBasin_v13_RadarAscent.unity'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
files = json.loads(BASE.read_text())['files']
out = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'baselineFile': str(BASE),
       'baselineSha256': sha(BASE), 'baselineCount': len(files)}
for name, root in (('main', MAIN), ('isolated', ISO)):
    changed, missing = [], []
    for rel, h in files.items():
        p = root / rel
        if not p.exists(): missing.append(rel)
        elif sha(p) != h: changed.append(rel)
    out[name] = {'root': str(root), 'changed': changed, 'missing': missing, 'matched': len(files) - len(changed) - len(missing)}
out['mainHasV13Scene'] = (MAIN / V13).exists()
out['mainHasV14Scene'] = any((MAIN / 'Assets/MapPrototype/Scenes').glob('VesperBasin_v14*'))
out['v13SceneSha256'] = sha(ISO / V13)
out['v13SceneMatchesHandoff'] = out['v13SceneSha256'] == '077bd43b9bcaccd51a68e5d353b23cb2c701c7003c8eb21ea3c46c5ddd89aa80'
print(json.dumps(out, indent=2))
if len(sys.argv) > 1: Path(sys.argv[1]).write_text(json.dumps(out, indent=2))

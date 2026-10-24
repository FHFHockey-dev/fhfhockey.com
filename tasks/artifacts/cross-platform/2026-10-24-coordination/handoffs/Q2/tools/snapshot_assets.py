"""Hash every file under the isolated project's Assets/, Packages/, ProjectSettings/ (read-only)."""
import hashlib, json, sys, datetime
from pathlib import Path
ISO = Path('/Users/tim/Documents/Codex/2026-10-11/task-12/Resume20261023B/V12ValidationProject')
out = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'root': str(ISO), 'files': {}}
for top in ('Assets', 'Packages', 'ProjectSettings'):
    for p in sorted((ISO / top).rglob('*')):
        if p.is_file(): out['files'][str(p.relative_to(ISO))] = hashlib.sha256(p.read_bytes()).hexdigest()
Path(sys.argv[1]).write_text(json.dumps(out, indent=1))
if len(sys.argv) > 2:
    old = json.loads(Path(sys.argv[2]).read_text())['files']; new = out['files']
    print(json.dumps({'added': sorted(set(new) - set(old)), 'removed': sorted(set(old) - set(new)),
                      'changed': sorted(k for k in set(old) & set(new) if old[k] != new[k])}, indent=1))
print(len(out['files']), 'files')

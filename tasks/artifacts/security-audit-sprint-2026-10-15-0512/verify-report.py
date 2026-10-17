"""Check local report references and capture hashes without reading env/data artifacts."""
from pathlib import Path
from datetime import datetime, timezone
import csv
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
referenced={}
errors=[]
for report in ['findings.md','coverage.md','handoff.md']:
    p=OUT/report
    if not p.exists():
        continue
    for literal in re.findall(r'`((?:web|functions|cms|supabase|\.github)/[^`]+)`',p.read_text()):
        match=re.fullmatch(r'(.*?)(?::(\d+))?',literal)
        relative=match.group(1)
        line=int(match.group(2)) if match.group(2) else None
        target=ROOT/relative
        if not target.exists():
            errors.append({'report':report,'reference':literal,'error':'missing path'})
            continue
        if target.is_dir() or target.name.startswith('.env'):
            continue
        data=target.read_bytes()
        if line and line>len(data.splitlines()):
            errors.append({'report':report,'reference':literal,'error':'line beyond file'})
        referenced[relative]={'path':relative,'sha256':hashlib.sha256(data).hexdigest(),
                              'bytes':len(data),'coverage':'Referenced manual evidence or configuration; see coverage.md for depth'}
with (OUT/'referenced-source-hashes.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['path','sha256','bytes','coverage'])
    writer.writeheader();writer.writerows(referenced[p] for p in sorted(referenced))
drift=[]
for inventory in ['route-inventory.csv','migration-inventory.csv']:
    for row in csv.DictReader((OUT/inventory).open()):
        target=ROOT/row['path']
        digest=hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
        if digest!=row['sha256']:
            drift.append({'path':row['path'],'inventory_sha256':row['sha256'],'current_sha256':digest})
state={
    'captured_at_utc':datetime.now(timezone.utc).isoformat(),
    'branch':subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip(),
    'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
    'referenced_source_file_count':len(referenced),'reference_errors':errors,
    'changed_since_inventory':drift,
    'audit_write_scope':str(OUT.relative_to(ROOT)),
    'application_changes_by_this_audit':0,'remote_deployments':0,'production_application_requests':0,
    'note':'Concurrent dirty changes pre-existed and continue; this manifest is a source snapshot, not exclusive repository ownership.'
}
(OUT/'report-verification.json').write_text(json.dumps(state,indent=2)+'\n')
print(json.dumps(state,indent=2))
if errors:
    raise SystemExit(1)

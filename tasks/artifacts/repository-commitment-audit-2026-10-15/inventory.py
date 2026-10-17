"""Read-only commitment inventory. Writes only alongside this audit script."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = Path(__file__).resolve().parent
PRIOR = Path('/tmp/fhfh-repo-audit-20261013')
DOC_EXT = {'.md', '.mdc', '.rst', '.txt'}
CODE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.yml', '.yaml', '.scss', '.css', '.html', '.sh', '.toml'}
SKIP_DIRS = {'.git', 'node_modules', '.venv', '.npm-cache', '.pnpm-store', '.pytest_cache', '__pycache__', '.ms-playwright', 'playwright-report', 'test-results', '.vercel', '.temp', '.cache', '.turbo'}
SECRET = re.compile(r'(^|[/_.-])(env|credentials?|secrets?|tokens?|private[-_]?keys?)([/.\-_]|$)', re.I)
RAW = re.compile(r'(training|evaluation|holdout|held[-_]?experiment|paired[-_]?capture|raw[-_]?outcome|prediction[-_]?outcome)', re.I)
CHECK = re.compile(r'^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s*(.*)')
MARKER = re.compile(r'\b(TODO|FIXME|XXX|HACK|TBD|not implemented|unimplemented|coming soon)\b', re.I)
PROSE = re.compile(r'\b(remaining|unfinished|incomplete|not yet|pending|blocked|deferred|follow[- ]?up|next steps?|future work|open questions?|must|shall|acceptance criteria)\b', re.I)

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode()

def write(name, value):
    (OUT/name).write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')

tracked = set(git('ls-files', '-z').split('\0')) - {''}
prior_files = {r['path']:r for r in json.loads((PRIOR/'task-files.json').read_text())}
prior_items = json.loads((PRIOR/'item-adjudication.json').read_text())
prior_rows = {(r['path'], r['text']):r for r in prior_items['items']}
files, checklists, markers, prose, errors, excluded_dirs = [], [], [], [], [], []
for base, dirs, names in os.walk(ROOT, followlinks=False):
    relbase = Path(base).relative_to(ROOT)
    kept=[]
    for d in dirs:
        rp=relbase/d
        if d in SKIP_DIRS or d.startswith('.next') or (ROOT/rp).is_symlink() or OUT==ROOT/rp:
            excluded_dirs.append(str(rp))
        else:kept.append(d)
    dirs[:]=kept
    for n in names:
        p=Path(base)/n; rel=str(p.relative_to(ROOT)); ext=p.suffix.lower()
        r={'path':rel,'tracked':rel in tracked,'bytes':p.lstat().st_size,'symlink':p.is_symlink()}
        reason=None
        if p.is_symlink():reason='symlink; target not followed'
        elif SECRET.search(rel):reason='credential/environment filename; no content read'
        elif RAW.search(rel) and ('artifact' in rel or '/data/' in rel or '/output/' in rel or ext not in CODE_EXT):reason='protected experiment/outcome/training/evaluation evidence; no content read'
        elif ext not in DOC_EXT|CODE_EXT:reason='structured data, binary or other non-prose artifact; metadata only'
        elif ext=='.txt' and not any(x in n.lower() for x in ['readme','plan','task','prd','todo','license','ofl']):reason='non-planning text artifact; metadata only'
        elif p.stat().st_size>2_000_000:reason='large retained artifact; metadata only'
        if reason:
            r['coverage']=reason;files.append(r);continue
        try:
            raw=p.read_bytes()
            text=raw.decode('utf-8')
        except (OSError,UnicodeError) as e:
            r['coverage']='read error';errors.append({'path':rel,'type':type(e).__name__});files.append(r);continue
        r['sha256']=hashlib.sha256(raw).hexdigest()
        r['coverage']='document text scanned' if ext in DOC_EXT else 'source commitment-marker scan'
        old=prior_files.get(rel)
        r['prior_task_candidate']=old is not None
        r['prior_same_hash']=old['sha256']==r['sha256'] if old and old.get('sha256') else None
        r['checklists']=0;r['unchecked']=0;r['markers']=0;r['prose_candidates']=0
        heading=''
        for i,line in enumerate(text.splitlines(),1):
            if line.startswith('#'):heading=line.lstrip('# ').strip()
            common={'path':rel,'line':i,'heading':heading,'text':line.strip()}
            m=CHECK.match(line)
            if m:
                row={**common,'text':m[2],'checked':m[1].lower()=='x'}
                prior=prior_rows.get((rel,m[2]))
                row['prior_adjudication']=({k:prior.get(k) for k in ['row_key','task_id','disposition','reason','finding_id','duplicate_group','master_matches']} if prior else None)
                checklists.append(row);r['checklists']+=1;r['unchecked']+=not row['checked']
            if MARKER.search(line):
                markers.append(common);r['markers']+=1
            if ext in DOC_EXT and not m and PROSE.search(line):
                prose.append(common);r['prose_candidates']+=1
        files.append(r)

root_counts={}
for r in files:
    root=r['path'].split('/')[0] if '/' in r['path'] else '(root files)'
    v=root_counts.setdefault(root,Counter())
    v['files']+=1;v['tracked']+=r['tracked'];v['text_scanned']+='sha256' in r
    v['checklists']+=r.get('checklists',0);v['unchecked']+=r.get('unchecked',0)
    v['markers']+=r.get('markers',0);v['prose_candidates']+=r.get('prose_candidates',0)
unchecked=[r for r in checklists if not r['checked']]
summary={'captured_at':datetime.now(timezone.utc).isoformat(),'head':git('rev-parse','HEAD').strip(),'master':git('rev-parse','master').strip(),'branch':git('branch','--show-current').strip(),'files':len(files),'text_scanned':sum('sha256' in r for r in files),'checklists':len(checklists),'unchecked':len(unchecked),'unchanged_prior_eligible_rows':sum(r['prior_adjudication'] is not None for r in unchecked),'unmatched_unchecked':sum(r['prior_adjudication'] is None for r in unchecked),'markers':len(markers),'prose_candidates':len(prose),'by_root':root_counts,'errors':errors,'excluded_directories':sorted(excluded_dirs),'limits':'Static commitment discovery, not full functional review. Protected raw evidence, secrets, generated/dependency trees and symlink targets excluded. Keyword matches are candidates, never approved work.'}
write('inventory.json',files);write('checklists.json',checklists);write('markers.json',markers);write('prose-candidates.json',prose);write('coverage.json',summary)
write('prior-file-deltas.json',[r for r in files if r.get('prior_same_hash') is False])
write('unmatched-unchecked.json',[r for r in unchecked if not r['prior_adjudication']])
status = git('status','--short','--branch')
(OUT/'latest-status.txt').write_text(status)
if not (OUT/'initial-status.txt').exists():
    (OUT/'initial-status.txt').write_text(status)
print(json.dumps({k:v for k,v in summary.items() if k not in ['by_root','excluded_directories']},indent=2))

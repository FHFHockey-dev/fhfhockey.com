"""Live-tree documentary inventory refresh. No inspected file is imported or executed."""
from pathlib import Path
import os,stat,json,hashlib,datetime,collections,re
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent;now=datetime.datetime.now(datetime.timezone.utc).isoformat();D=json.loads((OUT/'COVERAGE.json').read_text());by={r['path']:r for r in D['entries']};seen=set();delta=[];own=[]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
for folder,dirs,files in os.walk(ROOT/'tasks',followlinks=False):
 dirs.sort();files.sort()
 for n in dirs+files:
  p=Path(folder)/n;name=p.relative_to(ROOT).as_posix();seen.add(name)
  if p==OUT or OUT in p.parents or name=='tasks/diaries/2026-10-24-codex-task-artifact-audit.md':
   if p.is_file():own.append({'path':name,'bytes':p.stat().st_size,'sha256':sha(p)})
   continue
  try:
   st=p.lstat();kind='symlink' if stat.S_ISLNK(st.st_mode) else 'directory' if stat.S_ISDIR(st.st_mode) else 'file' if stat.S_ISREG(st.st_mode) else 'special';old=by.get(name);new={'path':name,'type':kind,'bytes':st.st_size,'mtime_ns':st.st_mtime_ns,'mtime_utc':datetime.datetime.fromtimestamp(st.st_mtime,datetime.timezone.utc).isoformat()}
   if old and all(old.get(k)==new[k] for k in ['type','bytes','mtime_ns']):continue
   if kind=='directory':new['coverage']='directory-indexed'
   elif kind=='symlink':new['coverage']='symlink-not-followed';new['link_target']=os.readlink(p)
   elif any(t in n.lower() for t in ['.env','credential','private-key','access-token','refresh-token','cookie']):new['coverage']='sensitive-not-read'
   elif kind=='file':
    new['sha256']=sha(p);ext=p.suffix.lower()
    if old and old.get('sha256')==new['sha256']:
     old.update({k:v for k,v in new.items() if k!='coverage'});delta.append({'path':name,'change':'metadata-only; hash unchanged'});continue
    if ext in ['.png','.jpg','.jpeg','.webm','.pdf','.sqlite','.pyc','.gz','.zip','.z'] or n in ['.DS_Store','.npmrc']:new['coverage']='metadata-only';new['inspection']={'method':'Late binary/config entry: hash/metadata only; no visual or member content acceptance.'}
    else:
     new['coverage']='partially-inspected';new['inspection']={'method':'Late entry bounded text/structured shape inspection; semantic reading unverified unless REVIEWED.json matches current hash.'}
     try:
      text=p.read_text();lines=text.splitlines();new['inspection']['lines']=len(lines)
      if ext=='.json':
       o=json.loads(text);new['inspection']['json_type']=type(o).__name__;new['inspection']['top_level_size']=len(o) if isinstance(o,(dict,list)) else None
      elif ext in ['.md','.mdc']:new['inspection']['heading_count']=sum(bool(re.match(r'^#{1,6} ',l)) for l in lines);new['inspection']['open_checkboxes']=len(re.findall(r'(?m)^\s*- \[ \]',text))
     except Exception as e:new['inspection']['limitation']=type(e).__name__
   else:new['coverage']='unsupported'
   if old:new['history']=old.get('history',[])+[{k:v for k,v in old.items() if k!='history'}]
   delta.append({'path':name,'change':'modified' if old else 'new','before_sha256':old.get('sha256') if old else None,'after_sha256':new.get('sha256'),'coverage':new['coverage']});by[name]=new
  except Exception as e:delta.append({'path':name,'change':'unreadable','error':str(e)});by[name]={'path':name,'coverage':'unreadable','error':str(e)}
for name,r in by.items():
 if name not in seen and r.get('coverage')!='self-output-excluded':r['coverage']='missing-since-cutoff';delta.append({'path':name,'change':'missing-since-cutoff','before_sha256':r.get('sha256')})
review=json.loads((OUT/'REVIEWED.json').read_text())
extra=['tasks/artifacts/release-readiness-2026-10-24/r1/HANDOFF.md','tasks/artifacts/forge-testing-grounds-2026-10-24/slice-01/HANDOFF.md','tasks/artifacts/forge-testing-grounds-2026-10-24/slice-01/SOURCE-RESOLUTION-AND-NEXT.md','tasks/artifacts/xg-release-gate-verdict-2026-03-31-v2.md','tasks/artifacts/xg-gate-lane-2026-10-18/S-18-report.md','tasks/artifacts/data-correctness-fixes-2026-10-18/DIARY.md']
for name in extra:
 h=sha(ROOT/name)
 if not any(x['path']==name and x['sha256']==h for x in review):review.append({'path':name,'sha256':h,'review':'Full document read; recorded owner claims retain independent/live limits.'})
for r in review:
 q=by.get(r['path'])
 if q and q.get('sha256')==r['sha256']:q['coverage']='content-reviewed';q['review_note']=r['review']
for r in by.values():
 if r['coverage']=='duplicate-by-hash':
  rep=by[r['duplicate_of']];r['representative_coverage']=rep['coverage'];r['duplicate_limitation']='Only identical bytes and the representative exact reviewed scope are inherited; no blanket task acceptance.'
D['entries']=sorted(by.values(),key=lambda r:r['path']);D['latest_refresh_utc']=now;D['latest_refresh_scope']='All current tasks lstat metadata; hash new/changed safe files only. Original INVENTORY.json cutoff is immutable. Own continuously generated files listed separately and not re-audited.';(OUT/'COVERAGE.json').write_text(json.dumps(D,indent=2)+'\n');(OUT/'REVIEWED.json').write_text(json.dumps(review,indent=2)+'\n')
(OUT/'LIVE-DELTA.json').write_text(json.dumps({'at':now,'changes':delta,'original_cutoff':D['cutoff_utc']},indent=2)+'\n');(OUT/'OWN-OUTPUTS.json').write_text(json.dumps({'at':now,'self_index_note':'This file is indexed from its prior version if present; self-referential content hash is intentionally not claimed.','files':own},indent=2)+'\n')
files=[r for r in by.values() if r.get('type')=='file' and r['coverage']!='self-output-excluded'];folders={r['path']:{'path':r['path'],'files':0,'bytes':0,'coverage':collections.Counter(),'unresolved_files':[],'full_reviewed_examples':[]} for r in by.values() if r.get('type')=='directory' and r['coverage']!='self-output-excluded'}
for r in files:
 for par in Path(r['path']).parents:
  f=folders.get(str(par))
  if f:
   f['files']+=1;f['bytes']+=r.get('bytes',0);f['coverage'][r['coverage']]+=1
   if r['coverage']!='content-reviewed' and len(f['unresolved_files'])<8:f['unresolved_files'].append(r['path'])
   elif r['coverage']=='content-reviewed' and len(f['full_reviewed_examples'])<5:f['full_reviewed_examples'].append(r['path'])
(OUT/'FOLDERS.json').write_text(json.dumps({'at':now,'method':'Every indexed folder; representative unresolved paths here, exhaustive per-file statuses in COVERAGE.json.','folders':list(folders.values())},indent=2)+'\n')
queue=[]
for r in files:
 if r['coverage']=='content-reviewed':continue
 p=r['path'];ext=Path(p).suffix;kind='unique-task-document' if ext in ['.md','.mdc'] and r['coverage']!='duplicate-by-hash' else 'structured-evidence' if ext in ['.json','.jsonl','.csv','.tsv'] and r['coverage']!='duplicate-by-hash' else 'duplicate-scope-check' if r['coverage']=='duplicate-by-hash' else 'binary-or-supporting-snapshot'
 priority=0 if kind=='unique-task-document' and (p.startswith('tasks/TASKS/') or len(Path(p).parts)<=3) else 1 if kind=='unique-task-document' else 2 if kind=='structured-evidence' else 3
 queue.append({'path':p,'priority':priority,'kind':kind,'coverage':r['coverage'],'sha256':r.get('sha256'),'bytes':r.get('bytes'),'duplicate_of':r.get('duplicate_of'),'representative_coverage':r.get('representative_coverage'),'cursor':'No full semantic/visual review recorded; reuse exact selected source anchors in CHANGELOG and DOCUMENT-QUEUE before expanding.'})
queue.sort(key=lambda x:(x['priority'],x['path']));(OUT/'CONTINUATION.json').write_text(json.dumps({'at':now,'next_cursor':queue[0]['path'] if queue else None,'resume_rule':'Same single worker. Recheck only changed hashes. Complete unique task-bearing text in priority order; keep production/research/private gates; do not repeat inventory or accepted application checks.','counts_by_kind':dict(collections.Counter(r['kind'] for r in queue)),'items':queue},indent=2)+'\n')
summary={'at':now,'original_cutoff':D['cutoff_utc'],'current_in_scope_files':len(files),'current_folders':len(folders),'coverage':dict(collections.Counter(r['coverage'] for r in files)),'late_delta_count':len(delta),'full_read_receipts':len(review),'remaining_full_semantic_or_visual_items':len(queue),'next_cursor':queue[0]['path'] if queue else None};(OUT/'COVERAGE-SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

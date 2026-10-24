"""Read-only evidence indexing. Never imports or executes inspected repository code."""
from pathlib import Path
import json,re,collections,hashlib,tarfile,zipfile,datetime,struct
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
scan=json.loads((OUT/'INVENTORY.json').read_text());rows=scan['entries'];groups=collections.defaultdict(list)
for row in rows:
 if row.get('sha256'):groups[row['sha256']].append(row)
ledger=json.loads((OUT/'BASELINE-LEDGER.json').read_text());ids={t['taskID'] for t in ledger['tasks']};refs=collections.defaultdict(set)
for task in ledger['tasks']:
 for e in task['evidence']:
  if e.get('path'):refs[e['path']].add(task['taskID'])
stable_ids=re.compile(r'(?<![\w-])(?:'+'|'.join(re.escape(x) for x in sorted(ids,key=len,reverse=True))+r')(?![\w-])')
read_ids=re.compile(r'\b(?:MASTER-[A-Z][0-9]+|AUDIT-A[0-9]+|STATS-(?:S[0-9]+|R[0-9]+)|RSO-FE-[0-9]+[a-z]?|FPI-[0-9]+(?:\.[0-9]+)?|CR-[A-Z0-9-]+|R[0-9]+|F[0-9]+)\b')
def safe(s):
 s=re.sub(r'https?://\S+','[URL]',s);s=re.sub(r'[\w.+-]+@[\w.-]+','[email]',s)
 s=re.sub(r'(?i)(?:bearer|token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+','[sensitive-value]',s)
 return s[:240]
def choose(gs):return min(gs,key=lambda r:(any(x in r['path'].lower() for x in ['/snapshot/','/fixed-source/','/cache/','/node_modules/','/handoff/candidate-source/']),len(r['path']),r['path']))
review=[]
for sha,gs in groups.items():
 rep=choose(gs);p=ROOT/rep['path'];ext=p.suffix.lower();detail={'referenced_by':sorted(refs.get(rep['path'],set()))}
 try:
  if any(x in rep['path'] for x in ['/cache/_cacache/','/.npm/']):state='metadata-only';detail['limitation']='Dependency/cache payload; bytes hashed, never treated as task acceptance.'
  elif ext in ['.png','.jpg','.jpeg','.webm','.pdf','.sqlite','.pyc','.z'] or p.name=='.DS_Store':
   state='metadata-only';detail['limitation']='Binary evidence not visually/content inspected; cannot independently verify associated claims.'
   if ext=='.png':
    with p.open('rb') as f:b=f.read(24)
    if b[:8]==b'\x89PNG\r\n\x1a\n':detail['dimensions']=list(struct.unpack('>II',b[16:24]))
  elif ext in ['.gz','.zip']:
   state='metadata-only';detail['limitation']='Archive header listing only; no extraction or member execution, member contents unreviewed.'
   try:
    if ext=='.zip':
     with zipfile.ZipFile(p) as z:members=z.infolist();detail['archive_members']=len(members);detail['expanded_bytes']=sum(x.file_size for x in members);detail['unsafe_members']=sum(x.filename.startswith('/') or '..' in Path(x.filename).parts for x in members)
    elif p.name.endswith('.tar.gz'):
     with tarfile.open(p,'r:gz') as t:members=t.getmembers();detail['archive_members']=len(members);detail['expanded_bytes']=sum(x.size for x in members);detail['symlink_members']=sum(x.issym() or x.islnk() for x in members);detail['unsafe_members']=sum(x.name.startswith('/') or '..' in Path(x.name).parts for x in members)
    else:detail['limitation']='Compressed generated data: hash/size only; no row review.'
   except Exception as e:detail['archive_error']=type(e).__name__+': '+str(e)[:120]
  else:
   raw=p.read_bytes()
   if b'\0' in raw[:8192]:state='unsupported';detail['limitation']='Binary payload without supported safe content reader.'
   else:
    try:txt=raw.decode('utf-8')
    except UnicodeDecodeError:txt=raw.decode('utf-8',errors='replace');detail['encoding_warning']='Replacement characters; content inference limited.'
    state='partially-inspected';lines=txt.splitlines();detail['lines']=len(lines);detail['task_ids']=sorted(set(stable_ids.findall(txt)));detail['legacy_aliases']=sorted(set(read_ids.findall(txt))-ids)[:80]
    if ext in ['.md','.mdc']:
     detail['method']='All lines scanned for headings, checklist state, stable IDs and status/action markers; bounded excerpts selected. Not a full semantic review.'
     detail['headings']=[{'line':i,'text':safe(l)} for i,l in enumerate(lines,1) if re.match(r'^#{1,4} ',l)][:50]
     detail['checkboxes']={'checked':len(re.findall(r'(?mi)^\s*- \[[xX]\]',txt)),'open':len(re.findall(r'(?m)^\s*- \[ \]',txt))}
     candidates=[(i,l) for i,l in enumerate(lines,1) if re.search(r'(?i)\b(?:remaining|blocked|hold|pending|next action|not run|not deployed|unresolved|follow.up|still open|incomplete|accepted|superseded)\b',l) and len(l)<1800]
     detail['status_excerpts']=[{'line':i,'text':safe(l)} for i,l in (candidates[:5]+candidates[-5:] if len(candidates)>10 else candidates)]
     review.append({'path':rep['path'],'sha256':sha,'bytes':rep['bytes'],'lines':len(lines),'refs':detail['referenced_by'],'headings':detail['headings'][:5],'excerpts':detail['status_excerpts']})
    elif ext in ['.json','.ipynb']:
     detail['method']='JSON parse; top-level shape and bounded structural samples, no private record values or every-row review.'
     try:
      obj=json.loads(txt);detail['json_type']=type(obj).__name__
      if isinstance(obj,dict):
       detail['keys']=list(obj)[:100];detail['collection_sizes']={k:len(v) for k,v in obj.items() if isinstance(v,(list,dict)) and re.match(r'^[A-Za-z_][\w -]{0,80}$',k)}
       detail['status_fields']={k:safe(str(v)) for k,v in obj.items() if re.match(r'(?i)^(?:status|state|verdict|decision|result|passed|failed|as_of|created_at|timestamp|kind|type|schema_version|version|accepted|release_gate)$',k) and isinstance(v,(str,int,float,bool,type(None)))}
      elif isinstance(obj,list):
       detail['records']=len(obj);detail['sample_object_keys']=sorted({k for v in obj[:3]+obj[-3:] if isinstance(v,dict) for k in v})[:100]
     except Exception as e:detail['parse_error']=type(e).__name__+': '+str(e)[:120]
    elif ext in ['.csv','.tsv','.jsonl']:
     detail['method']='Header/record count and first/last record shape only; values not emitted, no row-level semantic review.';detail['nonempty_lines']=sum(bool(l.strip()) for l in lines)
     if ext in ['.csv','.tsv']:detail['header_fields']=[safe(x) for x in lines[0].split('\t' if ext=='.tsv' else ',')][:60] if lines else []
     else:
      try:detail['first_record_keys']=list(json.loads(next(l for l in lines if l.strip())))[:80]
      except Exception:detail['first_record_keys']='not a JSON object'
    elif ext in ['.log','.tap','.exit'] or p.name.endswith('.log.before'):
     detail['method']='All lines searched for test/process outcome markers; no execution; retained logs are historical evidence.'
     detail['outcome_markers']=[safe(l) for l in lines if re.search(r'(?i)(Tests\s+\d+|Test Files\s|# (?:pass|fail|tests)|exit.code|error TS\d|\d+ passed|\d+ failed)',l)][:16]
    else:
     detail['method']='Text structure/line count/identifiers only; source snapshot/patch/runbook not executed or independently code-audited.'
     detail['symbols']=[safe(l.strip()) for l in lines if re.match(r'\s*(?:export (?:async )?(?:function|class|const|type|interface)|(?:async )?def |class |CREATE (?:OR REPLACE )?(?:FUNCTION|TABLE)|diff --git)',l,re.I)][:16]
  rep['coverage']=state;rep['inspection']=detail
  for row in gs:
   if row is not rep:row['coverage']='duplicate-by-hash';row['duplicate_of']=rep['path'];row['representative_coverage']=state
 except Exception as e:rep['coverage']='unreadable';rep['inspection']={'error':type(e).__name__+': '+str(e)[:200]}
scan['inspection_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();scan['coverage_definition']='content-reviewed requires explicit human/model full reading; partially-inspected is automated bounded structural/excerpt inspection, not independent task acceptance; duplicate status inherits representative limitations'
(OUT/'COVERAGE.json').write_text(json.dumps(scan,indent=2)+'\n');(OUT/'DOCUMENT-QUEUE.json').write_text(json.dumps(review,indent=2)+'\n')
folders=[]
for row in rows:
 if row.get('type')=='directory':
  prefix=row['path']+'/';desc=[r for r in rows if r.get('type')=='file' and r['path'].startswith(prefix)]
  folders.append({'path':row['path'],'files':len(desc),'bytes':sum(r['bytes'] for r in desc),'coverage':dict(collections.Counter(r['coverage'] for r in desc)),'stable_task_ids':sorted({t for r in desc for t in r.get('inspection',{}).get('task_ids',[])})})
(OUT/'FOLDERS.json').write_text(json.dumps(folders,indent=2)+'\n')
print(json.dumps({'files_by_coverage':dict(collections.Counter(r['coverage'] for r in rows if r.get('type')=='file')),'documents':len(review),'folders':len(folders),'json_parse_errors':[r['path'] for r in rows if r.get('inspection',{}).get('parse_error')]},indent=2))

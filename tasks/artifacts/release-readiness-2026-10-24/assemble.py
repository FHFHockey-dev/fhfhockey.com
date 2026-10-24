"""Freeze the accepted web validation inputs. Does not edit Git or application files."""
from pathlib import Path
import datetime,gzip,hashlib,json,os,shutil,subprocess,tarfile,tempfile
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent;P=R/'tasks/artifacts/release-integration-2026-10-23'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert not (O/'CANDIDATE.json').exists(), 'immutable output already exists'
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip()
refs={n:subprocess.check_output(['git','rev-parse',n],cwd=R,text=True).strip() for n in ['HEAD','master','origin/master']}
base=P/'combined-validation-v1/fixed-source.tar.gz';assert sha(base)=='8569002be726f846a94a05946b9112fe634e007c3b3fb764aaec3a26c818e4a7'
S=Path(tempfile.mkdtemp(prefix='fhfh-release-readiness-20261024-'))/'snapshot';S.mkdir();(O/'inputs').mkdir(exist_ok=True)
with tarfile.open(base) as t:
 for m in t.getmembers():assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts,m.name
 t.extractall(S,filter='data')
guard=S/'web/audit-network-deny.cjs';(O/'offline-network-deny.cjs').write_bytes(guard.read_bytes());guard.unlink()
provenance={str(x.relative_to(S)):{'kind':'inherited frozen context; not blanket acceptance','archiveSha256':sha(base)} for x in S.rglob('*') if x.is_file()}
specs=[
 ('trusted-yahoo',P/'trusted-yahoo/CANDIDATE.json'),
 ('selected-restoration',P/'selected-model-baseline/CANDIDATE.json'),
 ('billing',R/'tasks/artifacts/billing-sales-rollout-2026-10-23/account-rollout-correction/CANDIDATE.json'),
 ('grid-readers',Path('/Users/tim/Documents/Codex/2026-10-22/task-3/evidence/release-fixes/CANDIDATE.json')),
 ('grid-r5',Path('/Users/tim/Documents/Codex/2026-10-22/task-3/evidence/visual-v2/CANDIDATE.json')),
 ('news',Path('/Users/tim/Documents/Codex/2026-10-23/task-4/evidence/attribution-serialization/CANDIDATE.json'))]
selected={};packet_metadata={};superseded=[]
for name,path in specs:
 j=json.loads(path.read_text());entries=j.get('pins',j.get('files'));copy=O/'inputs'/(name+'.json');copy.write_bytes(path.read_bytes())
 packet_metadata[name]={'manifest':str(path),'sha256':sha(path),'inputCopy':str(copy.relative_to(O)),'pins':len(entries),'acceptance':'Independent local acceptance from October23 receipts; not deployment acceptance'}
 for n,v in entries.items():
  h=v if isinstance(v,str) else v.get('after_sha256',v.get('sha256'))
  if n in selected and selected[n]!=h:assert name=='grid-r5',(name,n);superseded.append({'path':n,'prior':selected[n],'next':h})
  selected[n]=h;provenance[n]={'kind':'accepted packet pin','packet':name,'manifestSha256':sha(path)}
fdir=R/'tasks/artifacts/rso-browser-fixture-reconciliation-2026-10-23';delivery=json.loads((fdir/'DELIVERY-MANIFEST.json').read_text())
for n,h in delivery['files'].items():assert sha(fdir/n)==h,n
for n in ['DELIVERY-MANIFEST.json','CURRENT-PINS.json','CURRENT-CASE-ACCOUNTING.json']:(O/'inputs'/('rso-'+n)).write_bytes((fdir/n).read_bytes())
f=json.loads((fdir/'CURRENT-PINS.json').read_text())
for n,h in f['pins'].items():
 if n.startswith('web/'):selected[n]=h;provenance[n]={'kind':'accepted fixture pin','manifestSha256':sha(fdir/'CURRENT-PINS.json')}
layout=json.loads((P/'CURRENT-HANDOFF.json').read_text())['rsoLayoutRuntimeCandidate']
for n,h in layout['paths'].items():selected[n]=h;provenance[n]={'kind':'accepted layout correction','patchSha256':layout['patchSha256']}
for n,h in selected.items():
 source=R/n;assert sha(source)==h,('canonical drift',n)
 dest=S/n;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(source.read_bytes());assert sha(source)==h,n
# Restore public image/font assets omitted by the prior text-only archive, from pinned Git objects.
resources=[];omissions=[]
for line in subprocess.check_output(['git','ls-tree','-rl',head,'web'],cwd=R,text=True).splitlines():
 meta,n=line.split('\t',1);mode,kind,blob,size=meta.split()
 if kind!='blob' or (S/n).exists():continue
 ext=Path(n).suffix.lower()
 allow=(n.startswith('web/public/') and ext in {'.png','.jpg','.jpeg','.webp','.svg','.ico','.avif','.ttf','.woff','.woff2','.webmanifest'}) or (n.startswith('web/public/fonts/') and ext=='.txt') or n=='web/.nvmrc'
 if not allow:omissions.append({'path':n,'gitBlob':blob,'reason':'outside bounded web source/resource selection; not silently included'});continue
 b=subprocess.check_output(['git','cat-file','blob',blob],cwd=R);dest=S/n;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b)
 resources.append(n);provenance[n]={'kind':'retained static resource','gitHead':head,'gitBlob':blob}
# The Next configuration explicitly traces this non-runtime text input.
n='tasks/TASKS/cron-operations/cron-schedule.md';b=subprocess.check_output(['git','show',head+':'+n],cwd=R);(S/n).parent.mkdir(parents=True,exist_ok=True);(S/n).write_bytes(b);provenance[n]={'kind':'Next tracing dependency from retained HEAD','gitHead':head}
files={str(x.relative_to(S)):sha(x) for x in S.rglob('*') if x.is_file()}
assert not any('.env' in Path(n).name or any(x in Path(n).parts for x in ['.git','node_modules','diaries']) for n in files)
assert 'web/lib/sources/tweetLunaLocalStore.ts' not in files
# Compare candidate bytes with each retained branch without checking out a branch.
comparison={}
for ref in ['master','origin/master']:
 tree={}
 for line in subprocess.check_output(['git','ls-tree','-r',refs[ref]],cwd=R,text=True).splitlines():
  meta,n=line.split('\t',1);mode,kind,blob=meta.split()
  if kind=='blob' and n.startswith('web/'):tree[n]=blob
 rows=[]
 for n,h in files.items():
  if not n.startswith('web/'):continue
  b=(S/n).read_bytes();oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
  if tree.get(n)!=oid:rows.append({'path':n,'candidateSha256':h,'retainedGitBlob':tree.get(n),'provenance':provenance[n]})
 comparison[ref]={'sha':refs[ref],'changedOrNew':rows,'retainedPathsOutsideSelection':sorted(set(tree)-set(files))}
(O/'RETAINED-MASTER-COMPARISON.json').write_text(json.dumps(comparison,indent=2)+'\n')
archive=O/'candidate-source.tar.gz'
with archive.open('wb') as out:
 with gzip.GzipFile(fileobj=out,mode='wb',mtime=0,filename='') as gz:
  with tarfile.open(fileobj=gz,mode='w') as t:
   for n in sorted(files):
    info=tarfile.TarInfo(n);info.size=(S/n).stat().st_size;info.mode=0o644;info.mtime=0;t.addfile(info,(S/n).open('rb'))
content=''.join(n+'\t'+files[n]+'\n' for n in sorted(files));treehash=hashlib.sha256(content.encode()).hexdigest()
j={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'Frozen web validation candidate; inherited supporting context not blanket release acceptance; no release commit','snapshot':str(S),'sourceRefs':refs,'contentTreeSha256':treehash,'archiveSha256':sha(archive),'archiveBytes':archive.stat().st_size,'baseArchiveSha256':sha(base),'files':files,'provenance':provenance,'selectedPins':selected,'packetInputs':packet_metadata,'superseded':superseded,'addedStaticResources':resources,'excludedRetainedPaths':omissions,'acceptanceEvidence':{'rsoCases':44,'singleFinalGreenFullRun':False,'yahooCases':10,'note':'Existing pinned focused receipts reused; no new browser run yet'},'limits':['Web application slice, not full repository/release acceptance.','No environment files, Git metadata, private league exports, context diaries or new research.','Held manual Luna integration and optional fingerprint optimization excluded.','Registered SQL/migration application, companion functions/CMS and production state remain separate gates.','Unreviewed October24 Claude changes excluded.']}
(O/'CANDIDATE.json').write_text(json.dumps(j,indent=2)+'\n')
(O/'EXPORTED-PATHS.sha256').write_text(''.join(files[n]+'  '+n+'\n' for n in sorted(files)))
(S/'web/node_modules').symlink_to(R/'web/node_modules',target_is_directory=True)
print(json.dumps({'snapshot':str(S),'files':len(files),'selectedPins':len(selected),'resourcesAdded':len(resources),'archiveSha256':sha(archive),'contentTreeSha256':treehash,'masterDiffs':{k:len(v['changedOrNew']) for k,v in comparison.items()}},indent=2))

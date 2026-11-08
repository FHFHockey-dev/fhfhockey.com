from pathlib import Path
import datetime,hashlib,json,os,subprocess
out=Path(__file__).resolve().parent;repo=out.parents[2];m=json.loads((out/'CANDIDATE.json').read_text());root=Path(m['exportRoot'])
def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
# Next generated this declaration only for isolated browser output; keep it out of the source candidate.
(root/'web/next-env.d.ts').write_bytes(git('show',m['baseCommit']+':web/next-env.d.ts'))
expected={r['path']:r['candidateBlob'] for r in m['overlayFiles']};checked=0;omitted=[];mismatches=[]
for row in git('ls-tree','-rz','-r',m['baseCommit'],'--','web','supabase','AGENTS.md','mise-en-place.md').split(b'\0'):
 if not row:continue
 meta,path=row.split(b'\t',1);mode,kind,oid=meta.decode().split();path=path.decode();p=root/path
 if path in m['excludedEnvironmentFiles']:
  assert not p.exists();omitted.append(path);continue
 if not p.exists() and not p.is_symlink():mismatches.append({'path':path,'problem':'missing'});continue
 data=os.readlink(p).encode() if mode=='120000' else p.read_bytes();actual=blob(data);wanted=expected.get(path,oid)
 if actual!=wanted:mismatches.append({'path':path,'expected':wanted,'actual':actual})
 checked+=1
receipt={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidateTree':m['candidateTree'],'checkedTrackedFiles':checked,'intentionalEnvironmentOmissions':omitted,'mismatches':mismatches,'nextEnvDeclaration':'restored to pinned base after browser-generated scaffolding','gitMutation':False}
(out/'SOURCE-PINS.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));assert not mismatches

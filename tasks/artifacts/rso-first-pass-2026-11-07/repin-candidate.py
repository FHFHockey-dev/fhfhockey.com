from pathlib import Path
import datetime,difflib,hashlib,json,subprocess
out=Path(__file__).resolve().parent;repo=out.parents[2];m=json.loads((out/'CANDIDATE.json').read_text());root=Path(m['exportRoot'])
def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
entries={}
for row in git('ls-tree','-rz','-r',m['baseCommit']).split(b'\0'):
 if not row:continue
 meta,path=row.split(b'\t',1);mode,kind,oid=meta.decode().split();entries[path.decode()]=(mode,oid)
def tree_hash(entries):
 tree={}
 for path,value in entries.items():
  node=tree;parts=path.split('/')
  for part in parts[:-1]:node=node.setdefault(part,{})
  node[parts[-1]]=value
 def walk(node):
  result=b''
  for name,value in sorted(node.items(),key=lambda item:(item[0]+('/' if isinstance(item[1],dict) else '')).encode()):
   mode,oid=('40000',walk(value)) if isinstance(value,dict) else value
   result+=mode.encode()+b' '+name.encode()+b'\0'+bytes.fromhex(oid)
  return hashlib.sha1(b'tree '+str(len(result)).encode()+b'\0'+result).hexdigest()
 return walk(tree)
assert tree_hash(entries)==m['baseTree']
patch='';review=''
for row in m['overlayFiles']:
 path=row['path'];mode,baseoid=entries[path];data=(root/path).read_bytes();newblob=blob(data);base=git('show',m['baseCommit']+':'+path)
 row.update(baseBlob=baseoid,candidateBlob=newblob,sha256=hashlib.sha256(data).hexdigest());entries[path]=(mode,newblob)
 patch+=f'diff --git a/{path} b/{path}\nindex {baseoid}..{newblob} {mode}\n'+''.join(difflib.unified_diff(base.decode().splitlines(keepends=True),data.decode().splitlines(keepends=True),fromfile='a/'+path,tofile='b/'+path))
 old=git('show',m['sourceCommit']+':'+path)
 if old!=data:
  review+=f'diff --git a/{path} b/{path}\nindex {blob(old)}..{newblob} {mode}\n'+''.join(difflib.unified_diff(old.decode().splitlines(keepends=True),data.decode().splitlines(keepends=True),fromfile='a/'+path,tofile='b/'+path))
m['priorCandidateTree']='50766b2d31d6f5a6b9cbbcc3565be91152080c9e';m['candidateTree']=tree_hash(entries);m['candidateRevision']=2;m['patchSha256']=hashlib.sha256(patch.encode()).hexdigest();m['state']='REVIEW_CORRECTIONS_VERIFICATION_PENDING';m['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();m['reviewAmendments']=['Started O/IR occupants require explicit active or bench lock evidence.','Acquisitions effective at puck drop cannot claim that started game.','Nine regressions: O/IR missing/active/bench locks and acquisition boundary -1ms/exact/+1ms.'];m['checks']=[];m.pop('browserResult',None)
(out/'CORRECTIONS.patch').write_text(patch);(out/'REVIEW-CORRECTION.patch').write_text(review);(out/'CANDIDATE.json').write_text(json.dumps(m,indent=2)+'\n')
r=subprocess.run(['git','apply','--reverse','--check',str(out/'CORRECTIONS.patch')],cwd=root,capture_output=True,text=True);assert r.returncode==0,r.stderr
(out/'PATCH-CHECK.json').write_text(json.dumps({'at':m['updatedAt'],'candidateTree':m['candidateTree'],'exitCode':r.returncode,'command':'git apply --reverse --check CORRECTIONS.patch','mutation':False},indent=2)+'\n')
print(json.dumps({'candidateTree':m['candidateTree'],'patchSha256':m['patchSha256'],'overlayFiles':len(m['overlayFiles'])}))

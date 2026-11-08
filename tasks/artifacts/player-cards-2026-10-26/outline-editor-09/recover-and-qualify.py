from pathlib import Path
from datetime import datetime, timezone
import os,sys,subprocess,json,hashlib,uuid,time,fcntl,tempfile
p=Path(__file__).resolve().parent;repo=p.parents[3];lock=Path('/private/tmp/fhfh-heavy.lock');guard=Path('/private/tmp/fhfh-heavy.lock.recovery');token=str(uuid.uuid4())
expected=b'tuesday-rc chef 61075 2026-10-27T00:36:44Z\n';sha='a9ee8dc706b0d15a62ae6d404ced3fe15037a6ff958f3036b76b7b8c6d517737'
receipt={'at':datetime.now(timezone.utc).isoformat(),'approval':'TJyes Sentinel_279dab0afd508191bb62d8378bb39a45 2026-10-27T00:58:07Z','expectedInode':215707084,'expectedSha256':sha,'reversibleArchive':True,'processesKilled':0,'lockAcquired':False,'ownSlotReleased':False}
guard_fd=os.open(guard,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.write(guard_fd,token.encode());os.close(guard_fd)
owned=False
try:
 raw=subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,stat=,comm=,args='],text=True)
 known=[];heavy=[];gui=[]
 for line in raw.splitlines():
  parts=line.strip().split(None,4)
  if len(parts)<5:continue
  pid,ppid,state,comm,args=parts
  if int(pid) in [61075,65874,65875,65896]:known.append(int(pid))
  executable=Path(comm).name.lower()
  if executable in ['node','npm','python3','python'] and any(x in args for x in ['node_modules/.bin/playwright','node_modules/playwright/cli','node_modules/.bin/vitest','node_modules/vitest/vitest','node_modules/typescript/bin/tsc','next build','browser-check.mjs','render-preview.mjs','qualify.py']):
   if int(pid)!=os.getpid() and 'recover-and-qualify.py' not in args:heavy.append({'pid':int(pid),'ppid':int(ppid),'command':args[:400]})
  if executable=='blender':
   if any(x in args.split() for x in ['-b','--background','-a','--render-anim','-f','--render-frame','-P','--python']):heavy.append({'pid':int(pid),'command':args})
   else:gui.append({'pid':int(pid),'state':state,'observation':'Existing GUI only, no batch/render/script arguments; parent map lane checkpointed/paused'})
 receipt.update({'knownChainPresent':known,'activeHeavyWork':heavy,'existingGuiOnly':gui});assert not known and not heavy,'Active heavy work changed; stopped without recovering lock'
 fd=os.open(lock,os.O_RDONLY|os.O_NOFOLLOW);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 try:
  st=os.fstat(fd);body=os.read(fd,1024);current=os.lstat(lock)
  assert st.st_ino==215707084 and current.st_ino==st.st_ino and body==expected and hashlib.sha256(body).hexdigest()==sha,'Lock changed; no recovery'
  (p/'STALE-LOCK-ORIGINAL.txt').write_bytes(body)
  receipt['originalMetadata']={'inode':st.st_ino,'size':st.st_size,'mode':oct(st.st_mode),'uid':st.st_uid,'gid':st.st_gid,'mtimeNs':st.st_mtime_ns,'ctimeNs':st.st_ctime_ns}
  archive_dir=Path(tempfile.mkdtemp(prefix='fhfh-heavy-stale-20261027-',dir='/private/tmp'));archive=archive_dir/'original.lock'
  # Exclusive recovery guard plus advisory fd lock; recheck path immediately at rename.
  assert os.lstat(lock).st_ino==st.st_ino and lock.read_bytes()==expected,'Lock changed immediately before archive'
  os.rename(lock,archive)
  moved=os.lstat(archive)
  if moved.st_ino!=st.st_ino or archive.read_bytes()!=expected:
   # Never overwrite a new holder. Restore an unexpectedly moved file only if the name is absent.
   try:os.link(archive,lock)
   except FileExistsError:pass
   raise RuntimeError('Recovery race detected; preserved moved evidence, stopped without acquisition')
  receipt['archivePath']=str(archive);receipt['archivedInode']=moved.st_ino
 finally:os.close(fd)
 try:lock.mkdir()
 except FileExistsError:raise RuntimeError('Another holder won acquisition; not touched')
 owner=lock/'owner.json';owner.write_text(json.dumps({'owner':'player-card-editor09','pid':os.getpid(),'token':token,'action':'focused customizer and retained NHL qualification'}));owned=True;receipt['lockAcquired']=True
 for pin in json.loads((p/'SOURCE-PINS.json').read_text()):assert hashlib.sha256((repo/pin['path']).read_bytes()).hexdigest()==pin['sha256'],'Source changed; no tests started'
 env=os.environ.copy();env.pop('GIT_DIR',None);env.update({'npm_config_cache':str(p/'.npm-cache'),'NO_UPDATE_NOTIFIER':'1','NEXT_TELEMETRY_DISABLED':'1'})
 (p/'STALE-LOCK-RECOVERY.json').write_text(json.dumps(receipt,indent=2)+'\n')
 with (p/'qualify.log').open('w') as output:result=subprocess.run(['python3',str(p/'qualify.py')],cwd=repo/'web',env=env,stdout=output,stderr=subprocess.STDOUT,timeout=90)
 receipt['qualificationExitCode']=result.returncode
finally:
 if owned:
  owner=lock/'owner.json'
  if owner.exists() and json.loads(owner.read_text()).get('token')==token:owner.unlink();lock.rmdir();receipt['ownSlotReleased']=True
 if guard.exists() and guard.read_text()==token:guard.unlink()
 receipt['finishedAt']=datetime.now(timezone.utc).isoformat();(p/'STALE-LOCK-RECOVERY.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)

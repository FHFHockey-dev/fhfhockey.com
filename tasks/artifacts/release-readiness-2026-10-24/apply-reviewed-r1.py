from pathlib import Path
import datetime,gzip,hashlib,json,shutil,subprocess,tarfile,tempfile
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent;V=O/'r1';N='web/__tests__/pages/api/v1/start-chart.test.ts';B='9f70e810de91003b78d4b64d3e8a06c6740493d1902a99331f94e41405664504';A='eebd86016d6cc3809ab15b2e936b884464d41666519d689ce26112a967d203c7';PATCH='a8a2f2bf20949e303b550383047d38daa13eae2d6d4d169511ce6a5a694aa0cf'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert not V.exists(),'preserve existing r1'
assert sha(R/N)==B,'canonical drift; STOP'
assert sha(O/'proposal-start-chart-fixture.patch')==PATCH
old=json.loads((O/'CANDIDATE.json').read_text());assert sha(O/'candidate-source.tar.gz')==old['archiveSha256']
V.mkdir();S=Path(tempfile.mkdtemp(prefix='fhfh-release-readiness-r1-',dir='/tmp'))/'snapshot'
subprocess.run(['python3',str(O/'restore.py'),str(S)],check=True,stdout=subprocess.DEVNULL)
assert sha(S/N)==B
# Both applications use the exact parent-reviewed patch. No index or ref operations.
for root in [S,R]:
 assert sha(root/N)==B
 result=subprocess.run(['patch','--batch','--forward','-p1','-i',str(O/'proposal-start-chart-fixture.patch')],cwd=root,text=True,capture_output=True)
 assert result.returncode==0,result.stdout+result.stderr
 assert sha(root/N)==A
(V/'reviewed.patch').write_bytes((O/'proposal-start-chart-fixture.patch').read_bytes())
files={n:sha(S/n) for n in old['files']};changed=[n for n,h in old['files'].items() if files[n]!=h];assert changed==[N],changed
provenance=dict(old['provenance']);provenance[N]={'kind':'parent-reviewed test-only correction','patchSha256':PATCH,'beforeSha256':B,'afterSha256':A,'approval':'Direct parent delegation granting exclusive one-file local test lease; no production authority'}
selected=dict(old['selectedPins']);selected[N]=A
archive=V/'candidate-source.tar.gz'
with archive.open('wb') as out:
 with gzip.GzipFile(fileobj=out,mode='wb',mtime=0,filename='') as gz:
  with tarfile.open(fileobj=gz,mode='w') as t:
   for n in sorted(files):
    info=tarfile.TarInfo(n);info.size=(S/n).stat().st_size;info.mode=0o644;info.mtime=0;t.addfile(info,(S/n).open('rb'))
content=''.join(n+'\t'+files[n]+'\n' for n in sorted(files));tree=hashlib.sha256(content.encode()).hexdigest()
m={**old,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'R1 frozen validation candidate; parent-reviewed one-file test correction; checks pending','snapshot':str(S),'parentCandidateManifestSha256':sha(O/'CANDIDATE.json'),'parentArchiveSha256':old['archiveSha256'],'revision':'r1','changedFromR0':changed,'patchSha256':PATCH,'contentTreeSha256':tree,'archiveSha256':sha(archive),'archiveBytes':archive.stat().st_size,'files':files,'provenance':provenance,'selectedPins':selected}
(V/'CANDIDATE.json').write_text(json.dumps(m,indent=2)+'\n');(V/'EXPORTED-PATHS.sha256').write_text(''.join(files[n]+'  '+n+'\n' for n in sorted(files)))
(V/'APPLY-RECEIPT.json').write_text(json.dumps({'at':m['at'],'leasePath':N,'before':B,'after':A,'patch':PATCH,'onlyChangedCandidatePath':changed,'canonicalAfterSha256':sha(R/N),'oldArchiveStillMatches':sha(O/'candidate-source.tar.gz')==old['archiveSha256'],'oldFailureReceiptSha256':sha(O/'tests.json'),'oldDiagnosticsReceiptSha256':sha(O/'diagnostics/tests.json'),'sourceRef':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'stagedPaths':subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R,text=True).splitlines()},indent=2)+'\n')
(S/'web/node_modules').symlink_to(R/'web/node_modules',target_is_directory=True)
print(json.dumps({'snapshot':str(S),'files':len(files),'selectedPins':len(selected),'onlyChangedPath':changed,'afterSha256':A,'archiveSha256':m['archiveSha256'],'contentTreeSha256':tree},indent=2))

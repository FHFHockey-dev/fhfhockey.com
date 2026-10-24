from pathlib import Path
import json,hashlib,shutil,subprocess,difflib,tarfile,datetime
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent;F=O/'production-model-prototype';S=Path(json.loads((F/'PROPOSAL.json').read_text())['snapshot']);W=S/'web';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((O/'VERIFIED-SNAPSHOT.json').read_text())['files']
review=json.loads((R/'tasks/artifacts/rso-correctness-2026-10-23/CANDIDATE.json').read_text())
for n,pins in review['owned_delta'].items():
 assert sha(R/n)==pins['after'],n
 shutil.copyfile(R/n,S/n)
# Retain the corrected bridge expectation and all three Yahoo packet pins.
yahoo=json.loads((O/'yahoo-correction/CANDIDATE.json').read_text())
for n,h in yahoo['files'].items():
 assert sha(R/n)==h,n
 shutil.copyfile(R/n,S/n)
# External review oracle is retained as an artifact, never confused with application source.
external=W/'scripts/releaseLegacyProducerBoundary.test.ts'
if external.exists():
 assert sha(external)==sha(F/'releaseLegacyProducerBoundary.test.ts')
 external.unlink()
functions=json.loads((O/'FUNCTIONS-COMMAND.json').read_text());functionRoot=Path(functions['cwd']).parent
for n,h in functions['files'].items():
 assert sha(functionRoot/n)==h
 t=S/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(functionRoot/n,t);base[n]=h
files={n:sha(S/n) for n in base if (S/n).is_file()}
for n in [*review['owned_delta'],*yahoo['files']]:files[n]=sha(S/n)
model=[n for n in json.loads((F/'PROPOSAL.json').read_text())['replaced_with_release_c'] if sha(S/n)!=sha(R/n)]
delta={n:dict(canonical=sha(R/n),proposed=sha(S/n)) for n in model}
patch=''
for n in model:
 before=(R/n).read_text();after=(S/n).read_text();patch+=''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/'+n,tofile='b/'+n))
(F/'model-hold.patch').write_text(patch)
(F/'MODEL-HOLD-PINS.json').write_text(json.dumps(dict(source_head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),files=delta,patch_sha256=sha(F/'model-hold.patch'),canonical_edits=0),indent=2)+'\n')
manifest=dict(status='DRAFT composition for independent review; NOT accepted or ready to push',source_head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),production_base='d4c2632d39ee8a59fa683f44a0e1d21c55db66bd',snapshot=str(S),files=files,pending=['Game Grid corrected/reviewed packet','independent model composition review','native qualification tool positive-case compatibility remains held','final combined tests/types/lint and privacy-safe Git candidate manifest'],baseline_receipt=str(R/'tasks/artifacts/rso-correctness-2026-10-23/CANDIDATE.json'),yahoo_receipt=str(O/'yahoo-correction/CANDIDATE.json'))
(F/'FIXED-SNAPSHOT.json').write_text(json.dumps(manifest,indent=2)+'\n')
with tarfile.open(F/'draft-source.tar.gz','w:gz') as t:
 for n in sorted(files):t.add(S/n,arcname=n,recursive=False)
(F/'ARCHIVE.json').write_text(json.dumps(dict(path='draft-source.tar.gz',sha256=sha(F/'draft-source.tar.gz'),files=len(files),bytes=(F/'draft-source.tar.gz').stat().st_size),indent=2)+'\n')
print(json.dumps(dict(files=len(files),model_hold_files=model,archive_sha256=sha(F/'draft-source.tar.gz'))))

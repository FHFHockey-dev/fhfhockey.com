"""Run the byte-identical review probe against R1 HTML without touching old evidence."""
from pathlib import Path
import tempfile, shutil, subprocess, json, hashlib

artifact = Path(__file__).resolve().parent
repo = artifact.parents[3]
harness = Path(tempfile.mkdtemp(prefix='fhfh-player-cards-s03-r1-browser-'))
base = harness/'tasks/artifacts/player-cards-2026-10-24'
review = base/'slice-03-review';candidate = base/'slice-03'
review.mkdir(parents=True);candidate.mkdir()
(harness/'web').symlink_to(repo/'web',target_is_directory=True)
shutil.copyfile(artifact/'browser-controls.mjs',review/'browser-controls.mjs')
shutil.copyfile(artifact/'preview.html',candidate/'preview.html')
shutil.copyfile(repo/'tasks/artifacts/player-cards-2026-10-24/slice-03/partial-manifest.json',candidate/'partial-manifest.json')
original = repo/'tasks/artifacts/player-cards-2026-10-24/slice-03-review/browser-controls.mjs'
assert (review/'browser-controls.mjs').read_bytes()==original.read_bytes()
receipt = {'harness':str(harness),'purpose':'Exact path-layout bridge for unchanged browser probe; no source checkout/server/Next/auth',
 'probeSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'candidateHtmlSha256':hashlib.sha256((candidate/'preview.html').read_bytes()).hexdigest(),
 'candidateSource':str(artifact/'preview.html'),'webDependencyAccess':'read-only-purpose symlink for installed Playwright; no app execution'}
try:
 result = subprocess.run(['/usr/local/bin/node',str(review/'browser-controls.mjs')],cwd=repo/'web',timeout=45)
 receipt['exitCode']=result.returncode
finally:
 output = artifact/'browser-output';output.mkdir(exist_ok=True)
 for p in review.iterdir():
  if p.is_file() and p.name!='browser-controls.mjs':shutil.copyfile(p,output/p.name)
 (artifact/'browser-harness.json').write_text(json.dumps(receipt,indent=2)+'\n')
raise SystemExit(result.returncode)

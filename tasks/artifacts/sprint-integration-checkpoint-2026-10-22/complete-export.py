"""Add three missing read-only migration fixtures; keep the initial failed export immutable."""
from pathlib import Path
import json,hashlib,shutil,subprocess,tarfile
R=Path('/Users/tim/Code/fhfhockey.com'); O=Path(__file__).resolve().parent
S=Path((O/'snapshot-path.txt').read_text().strip()); W=S/'web'; F=O/'export-completion';F.mkdir()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(n,d):(F/n).write_text(json.dumps(d,indent=2)+'\n')
extra={
 'web/supabase/migrations/20260711214500_add_line_combinations_source_provenance.sql':'1b94c3058c59846708a9bdf0a27d321cf96b612c158201e09ca29a55add44c83',
 'supabase/config.toml':'dcb10077d5f3fbf54fef3bda99ea1d0d069d0f27d643cc43ed39ad34743371b3',
 'tasks/TASKS/super-goal/super-goal-final-summary.md':'8ac0643823ed6e7ad334bc1e772ac0b5a80173e773b5ac7961713c06ba650925',
}
for p,h in extra.items():
 assert sha(R/p)==h
 (S/p).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(R/p,S/p)
dump('ADDED-FIXTURES.json',{p:dict(sha256=h,role='retained fixture dependency; no application acceptance') for p,h in extra.items()})
review_fixtures=json.loads((O/'ADDITIONAL-REVIEW-FIXTURES.json').read_text())
tracked={p:subprocess.run(['git','ls-files','--error-unmatch','web/'+p],cwd=R,capture_output=True,text=True).returncode==0 for p in review_fixtures}
assert not any(tracked.values()) and all(not (R/'web'/p).exists() for p in review_fixtures)
config=json.loads((W/'audit.application-tsconfig.json').read_text())
config['exclude'] += list(review_fixtures)
(W/'audit.integration-application-tsconfig.json').write_text(json.dumps(config,indent=2)+'\n')
dump('APPLICATION-TYPE-SCOPE.json',dict(config=config,additional_exclusions={p:dict(tracked=tracked[p],canonical_exists=False,source=v['source']) for p,v in review_fixtures.items()},reason='These are external independent reviewer fixtures copied only into the isolated test tree. Original compiler error and fixture bytes remain unchanged; this separate check covers application files.'))
initial=json.loads((O/'FIXED-SNAPSHOT.json').read_text())['files']
assert all(sha(S/p)==h for p,h in initial.items())
files={**initial,**extra,'web/audit.integration-application-tsconfig.json':sha(W/'audit.integration-application-tsconfig.json')}
dump('FIXED-SNAPSHOT.json',dict(file_count=len(files),files=files,prior_3581_pins_unchanged=True))
with tarfile.open(F/'fixed-source.tar.gz','w:gz') as t:
 for p in sorted(files):t.add(S/p,arcname=p,recursive=False)
dump('ARCHIVE.json',dict(path='fixed-source.tar.gz',sha256=sha(F/'fixed-source.tar.gz'),files=len(files)))
print(json.dumps(dict(files=len(files),archive=sha(F/'fixed-source.tar.gz'),original_source_pins_unchanged=True)))

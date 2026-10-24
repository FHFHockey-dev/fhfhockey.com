"""Assemble only exact reviewed bytes in an ordinary isolated source directory."""
from pathlib import Path
import hashlib, json, shutil, tempfile, subprocess, tarfile

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = Path(__file__).resolve().parent
ART = ROOT / 'tasks/artifacts'
def read(name): return json.loads((ART / name).read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(name, data): (OUT / name).write_text(json.dumps(data, indent=2) + '\n')

BASE_MANIFEST = 'task10-display-2026-10-22/r1/FIXED-SNAPSHOT.json'
base = Path((ART / 'task10-display-2026-10-22/r1/SCRATCH-PATH.txt').read_text().strip())
base_files = read(BASE_MANIFEST)['files']
assert all((base/p).is_file() and sha(base/p) == h for p,h in base_files.items()), 'base changed'
packets, selected, overrides = [], {}, []
def add(label, manifest, files, review):
    packets.append(dict(packet=label, manifest=manifest, manifest_sha256=sha(ART/manifest), review=review,
                        review_sha256=sha(ART/review) if review else None, count=len(files)))
    for path, value in files.items():
        h = value if isinstance(value,str) else value['sha256']
        if path in selected and selected[path]['sha256'] != h:
            overrides.append(dict(path=path, earlier=selected[path], successor=dict(packet=label,sha256=h)))
        selected[path] = dict(sha256=h,packet=label)

m='claude-audit-fixes-2026-10-22/combined-audit-nst/CANDIDATE.json'
add('A1-A10 and NST R1',m,read(m)['accepted_files'],'claude-audit-fixes-2026-10-22/combined-audit-nst/REPORT.md')
m='task10-display-2026-10-22/r1/CANDIDATE.json'
add('P07 R2 plus task10 R1',m,read(m)['files'],'p07-task10-r1-independent-review-2026-10-22/REPORT.md')
m='forge-task1-independent-review-2026-10-22/OWNER-SOURCE-PINS.json'
add('task1 supported scoreboard',m,read(m)['changedFiles'],'forge-task1-independent-review-2026-10-22/REVIEW.md')
for suffix in ['r1','pickup-expiry']:
    m=f'p05-ownership-2026-10-22/{suffix}/FILE-HASHES.json'
    add('P05 '+suffix,m,{p:v['fixed'] for p,v in read(m)['applicationFiles'].items()},None)
for suffix, review in [('', 'p02-goalie-independent-review-2026-10-22/REVIEW.md'),('/r1-extension','p02-r1-independent-review-2026-10-22/REVIEW.md')]:
    m=f'research-backlog-readiness-2026-10-22/p02-correctness{suffix}/CANDIDATE.json'
    add('P02'+suffix,m,{v['path']:v['after_sha256'] for v in read(m)['files']},review)
m='fhfh-sprint-fixes-2026-10-22/s08-game-route/CANDIDATE.json'
add('S08 game route',m,{v['path']:v['after_sha256'] for v in read(m)['files']},'claude-audit-independent-review-2026-10-22/s08-game-route/REVIEW.md')
for label, directory in [('calendar','p01-date-identity'),('search','p04-search/prefetch-correction')]:
    m=f'claude-audit-independent-review-2026-10-22/{directory}/hash-verification-end.json'
    add(label,m,{v['file']:v['sha256'] for v in read(m)['files'] if v['file'].startswith('web/components/')},f'claude-audit-independent-review-2026-10-22/{directory}/REVIEW.md')
for suffix,review in [('contracts','luna-application-independent-review-2026-10-22/REVIEW.md'),('correction-r1','luna-r1-independent-review-2026-10-22/REVIEW.md')]:
    m=f'luna-application-{suffix}-2026-10-22/CANDIDATE.json'
    add('Luna '+suffix,m,{v['path']:v['sha256'] for v in read(m)['files']},review)
m='billing-migration-relocation-independent-review-2026-10-22/r1/RECEIPT.json'
billing = read(m)
add('billing relocation R1',m,{v['path']:v['sha256'] for v in billing['reviewedFiles'] if v['path'] not in ['tasks/TASKS/super-goal/super-goal-final-summary.md']},'billing-migration-relocation-independent-review-2026-10-22/r1/REVIEW.md')

deps, dep_overrides = {}, []
def dep(label, items):
    for p,h in items.items():
        if p in selected:
            if selected[p]['sha256'] != h: dep_overrides.append(dict(path=p,old_dependency=h,current=selected[p],basis=label))
        elif p in deps and deps[p]['sha256'] != h: raise RuntimeError('conflicting dependency '+p)
        else: deps[p]=dict(sha256=h,packet=label)
dep('task1 reviewed closure',read('forge-task1-independent-review-2026-10-22/SNAPSHOT-PINS.json')['files'])
d=read('luna-r1-independent-review-2026-10-22/end-integrity.json')
dep('Luna R1 reviewed closure',{v['path']:v['expected'] for v in d['snapshot']})
d=read('p02-r1-independent-review-2026-10-22/end-integrity.json')
dep('P02 R1 reviewed closure',{v['path']:v['expected'] for v in d['pins'] if v['path'].startswith('web/')})
for suffix in ['r1','pickup-expiry']:
    d=read(f'p05-ownership-2026-10-22/{suffix}/FILE-HASHES.json')
    dep('P05 retained '+suffix,d['retainedDependencies'])
for label,directory in [('calendar','p01-date-identity')]:
    d=read(f'claude-audit-independent-review-2026-10-22/{directory}/hash-verification-end.json')
    dep(label+' reviewed hooks',{v['file']:v['sha256'] for v in d['files'] if '/hooks/' in v['file']})
# Billing authority is a source-integrity fixture, never permission to execute SQL.
authority=read('../TASKS/repository-audit-remediation/migration-authority.json')
dep('retained migration authority registry',{v['path']:v['sha256'] for v in authority['migrations']})
archive_root=ROOT/'supabase/migration-archive/pre-baseline-20260716'
dep('retained archive fixtures',{str(p.relative_to(ROOT)):sha(p) for p in archive_root.rglob('*') if p.is_file()})
reloc=read('in-season-billing-2026-10-21/queue-sql-verification/SOURCE-RELOCATION.v1.json')
current=json.loads((ROOT/reloc['historicalManifest']).read_text())
for v in reloc['entries']: current.pop(v['from']);current[v['to']]=v['afterSha256']
dep('billing retained seven input contract',current)

all_pins={**deps,**selected}
canonical_drift=[]; unavailable=[]; source={}
for p,v in all_pins.items():
    current=sha(ROOT/p) if (ROOT/p).is_file() else None
    if current==v['sha256']:source[p]=ROOT/p
    elif p in base_files and base_files[p]==v['sha256']:source[p]=base/p
    else:unavailable.append(dict(path=p,expected=v,current=current))
    if current!=v['sha256']:canonical_drift.append(dict(path=p,expected=v,current=current))
dump('SOURCE-RESOLUTION.json',dict(canonical_drift=canonical_drift,unavailable=unavailable))
dump('PACKETS.json',packets)
dump('CANDIDATE-PINS.json',selected)
dump('DEPENDENCY-PINS.json',deps)
dump('SUPERSESSIONS.json',dict(accepted_successors=overrides,reviewed_dependencies_superseded_by_accepted_packets=dep_overrides))
assert not unavailable, f'{len(unavailable)} exact source files unavailable; inspect SOURCE-RESOLUTION.json'
snapshot=Path(tempfile.mkdtemp(prefix='fhfh-sprint-integration-',dir='/tmp'))/'snapshot'
snapshot.mkdir()
provenance={}
for p,h in base_files.items():
    target=snapshot/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(base/p,target)
    provenance[p]=dict(sha256=h,basis='preserved historical dirty audit baseline through P07/task10',acceptance='not independently accepted as a whole')
for p,v in all_pins.items():
    target=snapshot/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source[p],target)
    provenance[p]=dict(**v,basis='accepted packet' if p in selected else 'retained reviewed dependency; no new behavioral acceptance')
assert not (snapshot/'supabase/migrations/20261021210000_in_season_sandbox_billing.sql').exists()
dump('PROVENANCE.json',provenance)
dump('ASSEMBLY.json',dict(snapshot=str(snapshot),base=str(base),base_manifest=BASE_MANIFEST,base_files=len(base_files),accepted_pins=len(selected),dependencies=len(deps),canonical_head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),branch=subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip(),application_edits=0,excluded_new_work=['Task2 R2 warm-cache reproducibility hold','Claude tasks6/7/8/11 newer model/runner changes','unqualified skater experiments'],release_ready=False))
(OUT/'snapshot-path.txt').write_text(str(snapshot)+'\n')
print(json.dumps(dict(snapshot=str(snapshot),accepted=len(selected),dependencies=len(deps),overrides=len(overrides),canonical_drift=len(canonical_drift))))

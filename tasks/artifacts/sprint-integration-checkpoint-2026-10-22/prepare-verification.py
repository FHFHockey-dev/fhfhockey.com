from pathlib import Path
import json, hashlib, shutil

ROOT=Path('/Users/tim/Code/fhfhockey.com')
OUT=Path(__file__).resolve().parent
ART=ROOT/'tasks/artifacts'
S=Path((OUT/'snapshot-path.txt').read_text().strip())
W=S/'web'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
pins=read(OUT/'CANDIDATE-PINS.json')
commands=read(ART/'claude-audit-fixes-2026-10-22/combined-audit-nst/COMMANDS.json')['commands']
tests=set(commands['affected'][6:]+commands['reproductions'][6:])
tests.update(p.removeprefix('web/') for p in pins if p.startswith('web/') and ('.test.ts' in p))
tests.update(read(ART/'p07-rso-use-policy-2026-10-22/r2/TEST-FILES.json'))
tests.update(read(ART/'task10-display-2026-10-22/r1/TEST-COMMAND.json')['args'][6:])
tests.update(['lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts','lib/in-season/workspaceSchema.test.ts'])
fixtures={
    'components/RosterScheduleOptimizer/p07Task10Independent.test.tsx':'p07-task10-independent-review-2026-10-22/p07Task10Independent.test.tsx',
    'lib/rosterScheduleOptimizer/p07Task10Serialization.test.ts':'p07-task10-independent-review-2026-10-22/p07Task10Serialization.test.ts',
    'lib/rosterScheduleOptimizer/p07R2IndependentCorrelation.test.ts':'p07-r2-independent-review-2026-10-22/p07R2IndependentCorrelation.test.ts',
}
for target,source in fixtures.items():
    parent=Path(source).parent
    receipt=read(ART/parent/'RECEIPT-HASHES.json')
    assert sha(ART/source)==receipt[Path(source).name], source
    shutil.copyfile(ART/source,W/target)
dump(OUT/'ADDITIONAL-REVIEW-FIXTURES.json',{target:dict(source=source,sha256=sha(ART/source)) for target,source in fixtures.items()})
assert all((W/t).is_file() for t in tests),[t for t in tests if not (W/t).is_file()]
dump(OUT/'TEST-FILES.json',sorted(tests))
lint=sorted(p.removeprefix('web/') for p in pins if p.startswith('web/') and p.endswith(('.ts','.tsx')))
dump(OUT/'LINT-FILES.json',lint)
(W/'node_modules').symlink_to(ROOT/'web/node_modules',target_is_directory=True)
for name in ['.audit-home','.audit-tmp']: (W/name).mkdir()
# Execution configuration only: no environment file loading and no shared cache.
config=(W/'audit.vitest.config.mts').read_text().replace('defineConfig({plugins:', 'defineConfig({envDir:false,plugins:')
import re
config=re.sub(r'cacheDir:"[^"]+"', 'cacheDir:"'+str(S/'vite-cache')+'"',config)
(W/'audit.vitest.config.mts').write_text(config)
dump(OUT/'EXECUTION-CONFIG.json',dict(vitest=str(W/'audit.vitest.config.mts'),vitest_sha256=sha(W/'audit.vitest.config.mts'),application_types_exclusions=read(W/'audit.application-tsconfig.json')['exclude'],scope='Application compiler excludes four preserved external reviewer fixtures, unchanged from previous application scope. No application source exclusions added.'))
files={str(p.relative_to(S)):sha(p) for p in S.rglob('*') if p.is_file() and not p.is_symlink()}
dump(OUT/'FIXED-SNAPSHOT.json',dict(file_count=len(files),files=files))
canonical=[]
for p,h in files.items():
    current=sha(ROOT/p) if (ROOT/p).is_file() else None
    if current!=h: canonical.append(dict(path=p,snapshot_sha256=h,canonical_sha256=current,classification='accepted-packet-divergence' if p in pins else 'retained-foreign-or-review-fixture; no new acceptance'))
dump(OUT/'CANONICAL-COMPARISON.json',dict(differences=canonical,accepted_mismatch_count=sum(x['classification']=='accepted-packet-divergence' for x in canonical)))
print(json.dumps(dict(snapshot_files=len(files),test_files=len(tests),lint_files=len(lint),canonical_differences=len(canonical))))

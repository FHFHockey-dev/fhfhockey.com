# Independent P07 R2 command receipts

Environment: Node **22.11.0**, npm **10.9.0**, existing dependencies. Scratch only: `/tmp/fhfh-p07-r2-review-n7g6bsdg/web`. No repository environment files loaded. All URLs, keys, accounts and league names in fixtures/logs are synthetic.

## Snapshot preparation and hash verification

Reconstruction followed `../p07-rso-use-policy-2026-10-22/r1/VERIFY.md` and `../p07-rso-use-policy-2026-10-22/r2/VERIFY.md`: verified base archive, full R2 source overlay, R1 audit setup and unchanged C08, and three R2 review fixtures. The fixed manifest verified **3,375/3,375** files before adjusting only the temporary Vitest cache path and linking existing dependencies. Start/end source hashes are recorded separately. The network-denial preload, setup and actual Vitest configuration are copied into this receipt directory.

To repeat the fixed-source hash check against a reconstructed directory (before changing its audit config):

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib, json
repo = Path('/Users/tim/Code/fhfhockey.com')
scratch = Path('/tmp/fhfh-p07-r2-review-n7g6bsdg')
manifest = json.loads((repo / 'tasks/artifacts/p07-rso-use-policy-2026-10-22/r2/FIXED-SNAPSHOT.json').read_text())
bad = [p for p, expected in manifest['files'].items()
       if not (scratch / p).is_file() or hashlib.sha256((scratch / p).read_bytes()).hexdigest() != expected]
print({'matched': len(manifest['files']) - len(bad), 'mismatches': bad})
assert not bad
PY
```

The existing scratch has its private cache path already adjusted; the full manifest check is a pre-test reconstruction check. For post-test source verification compare the 32 `CANDIDATE.json.files` hashes; those all still match.

## Commands actually run

From the scratch `web/` directory, the following clean wrapper prefixed both npm commands:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME=/tmp/fhfh-p07-r2-review-n7g6bsdg/web/.audit-home \
  TMPDIR=/tmp/fhfh-p07-r2-review-n7g6bsdg/web/.audit-tmp \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS='--require /tmp/fhfh-p07-r2-review-n7g6bsdg/web/audit-network-deny.cjs --max-old-space-size=8192' \
  npm test -- --run --config audit.vitest.config.mts \
  lib/rosterScheduleOptimizer/p07IndependentBoundary.test.ts \
  lib/rosterScheduleOptimizer/p07IndependentComponent.test.tsx \
  lib/player-forecasts/p07BridgeClaimOracle.test.ts \
  lib/rosterScheduleOptimizer/executionAdapter.test.ts \
  hooks/useRosterPlanning.test.tsx \
  hooks/useCandidateMetrics.test.tsx \
  __tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts
```

**Exit 0: 60 tests, 7 files passed.** Full output: `focused.log`. A Node punycode deprecation warning was emitted; no tests failed.

The same wrapper, replacing only the test path list with:

```sh
npm test -- --run --config audit.vitest.config.mts \
  lib/rosterScheduleOptimizer/p07R2IndependentCorrelation.test.ts
```

**Exit 0: 3 tests, 1 file passed.** Full output: `independent-correlation.log`. This fixture was added only to scratch and this artifact directory. Copy this directory's fixture to that scratch test path when reconstructing.

## Not run

TypeScript, lint, full suite, build, browser execution and external/DB validation were not run. The owner's 294-test receipt is separate. Full TypeScript/full Vitest/build require the `/private/tmp/fhfh-heavy.lock` coordination protocol; R2's owner also holds scoped lint pending coordination. This review neither acquired nor removed that lock.

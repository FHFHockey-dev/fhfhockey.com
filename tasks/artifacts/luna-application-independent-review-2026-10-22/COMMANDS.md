# Independent command receipts

Working repository: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15` throughout. No app edits or Git mutations.

1. Read current AGENTS, named owner HANDOFF/CANDIDATE/patch, both new modules/tests, safe fixture and bounded snapshot/proposal dependencies. No applicable local review-specific skill was found. Only public-player/synthetic fixtures were used.
2. SHA-256 comparison against CANDIDATE and BASELINE: **55/55 pins match**, repeated at end. Initial receipt script had a local path-format error for a `/tmp` pin; it was corrected to preserve external absolute paths, then completed. No pin content was changed.
3. `python3 tasks/artifacts/luna-application-independent-review-2026-10-22/prepare-review.py`: `git apply --check` and `git apply` in an empty scratch directory, reconstructing five additions exactly; 12 bounded dependencies/configs copied. **17/17 source hashes match**, unchanged at end. This was the initial preparation command, not a recommendation to overwrite saved review receipts after the candidate changes.
4. `sh tasks/artifacts/luna-application-independent-review-2026-10-22/RUN-CHECK.sh owner`: **30/30 pass**, two files, Vitest 3.2.7. `owner-tests.log` / `.json`.
5. Copy artifact `review-contracts.test.ts` into scratch `web/lib/sources/`, then `sh tasks/artifacts/luna-application-independent-review-2026-10-22/RUN-CHECK.sh adversarial`: Vitest **exit 1**, **9 pass / 2 fail**, 11 cases. Failing expectations are the two R1 offset controls. `adversarial-tests.log` / `.json`. The outer display command continued to print the log; its shell exit 0 is not a passing test result.
6. `sh tasks/artifacts/luna-application-independent-review-2026-10-22/RUN-CHECK.sh tsc`: **exit 0**, empty `tsc.log`. Copies original compiler options, ES2022 as in owner scoped config, and only four candidate TypeScript files; covers imported type closure, excludes independent test from this compiler claim.
7. `sh tasks/artifacts/luna-application-independent-review-2026-10-22/RUN-CHECK.sh lint`: **exit 0**, empty `lint.log`. Exact existing ESLint config, four candidate TypeScript files.
8. Bounded `rg` import scan of `web` `.ts`/`.tsx`: only test callers. `rg` for network-denial markers across four logs: **no matches** (rg exit 1 means no markers, not a verification failure).

All command branches in RUN-CHECK.sh execute with Node `/usr/local/bin/node` **v22.11.0** and npm **10.9.0**, `env -i`, `NODE_OPTIONS` pinned network guard, inert npm config, no install and one Vitest worker. No paid/model/service calls.

## Reproduce the exact retained candidate after the tree moves

`reviewed-source.tar.gz` contains only the 17 pinned source/configuration files plus the independent configs and test. No node_modules, environment files, credentials or caches are included. Use the existing local dependencies and the pinned guard (verify its hash in start-integrity.json).

```sh
cd /Users/tim/Code/fhfhockey.com
python3 - <<'PY'
from pathlib import Path
import tarfile, tempfile
repo = Path.cwd()
out = repo / 'tasks/artifacts/luna-application-independent-review-2026-10-22'
scratch = Path(tempfile.mkdtemp(prefix='fhfh-luna-review-repro-'))
with tarfile.open(out / 'reviewed-source.tar.gz') as archive:
    archive.extractall(scratch, filter='data')
(scratch / 'web/node_modules').symlink_to(repo / 'web/node_modules', target_is_directory=True)
print(scratch / 'web')
PY
```

From the printed scratch `web` directory (replace `$REVIEW_WEB` with that printed path):

```sh
cd "$REVIEW_WEB"
env -i PATH=/usr/local/bin:/usr/bin:/bin TMPDIR=/tmp \
  NODE_OPTIONS=--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/network-guard.cjs \
  npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false \
  npm_config_userconfig=/dev/null \
  npm_config_globalconfig=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/empty-global.npmrc \
  npm_config_cache=/tmp/fhfh-luna-independent-npm \
  npx --no-install vitest run --config review.vitest.config.mjs \
  lib/sources/review-contracts.test.ts -t 'grammatical slot'
```

Expected on this pinned candidate: **two failing assertions**, both received `reviewable_held` instead of `held`. Do not interpret this expected reproduction failure as permission to modify the implementation or dispatch anything.

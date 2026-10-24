# Reproduce locally without services

Use the existing isolated copy at `/tmp/fhfh-rso-correctness-20261023/web`, existing dependencies and Node22.11.0. `FIXED-SNAPSHOT.json` records the tested bytes. The independent fixture lives in `review-fixtures/rsoBoundaryReview.test.ts` and is copied to `web/lib/rosterScheduleOptimizer/rsoBoundaryReview.test.ts` only in the temporary test tree. It is not a canonical application file.

The baseline patch is already in the sole canonical octoberBranch checkout. Do not apply it twice or overwrite concurrent changes. Its before/after files and pinned baseline HEAD permit review without Git mutations.

Run selected Vitest files listed in `CANDIDATE.json` through:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin TZ=UTC \
  NODE_OPTIONS='--require /tmp/fhfh-rso-correctness-20261023/web/audit-network-deny.cjs --max-old-space-size=8192' \
  npm_config_offline=true npm test -- --run --config audit.vitest.config.mts <test paths>
```

The saved `harness/audit.vitest.config.mts` disables environment-file loading, uses synthetic setup/network denial and a temporary Vite cache. Do not run commands against ignored local environment files or load private exports. An omitted tracked runner source initially prevented one test from collecting; the final copy includes that dependency. Do not mistake a collection failure for a test pass.

Acquire the existing mkdir/rmdir heavy-check lock at `/private/tmp/fhfh-heavy.lock` atomically before static checks. Never remove another task's lock. `evidence/static-results.json` lists exact scoped TypeScript and ESLint arguments; use the same clean environment and run them sequentially. The type scope is in `harness/audit.scoped-tsconfig.json`.

`evidence/baseline-red.log` shows the original ordinary-test failure. `identity-red.log` and `cutoff-red.log` distinguish the model and cutoff losses. `yahoo-independent-prepatch.log` runs the independent fixture against only the HEAD version of currentPlanningRead.ts in the temporary copy, then restores the release-owner correction. Do not restore that unsafe version into the canonical checkout.

The final result combines the ten passing files from `evidence/final-tests.json` (282cases) with the corrected isolated collection/run of `evidence/contribution-tests.json` (110cases). `yahoo-independent-final.json` repeats only the4artifact cases after a type annotation correction; do not add repeats to392. Final type/lint logs are empty; their exit0 receipts are in `static-results.json`.

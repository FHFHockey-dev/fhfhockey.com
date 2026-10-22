# Independent commands and limits

Run only against the verified fixed archive in a fresh nested scratch copy. The actual copy for this pass is recorded in `snapshot-path.txt`. Verify `FIXED-SNAPSHOT.json` hashes before checks and the 14 owned hashes after checks. Symlink existing canonical `web/node_modules`; never install dependencies or copy env files.

The actual `web/` cwd was:

```
/private/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-forge-ledger-lease-review-i86qaoq1/isolation/snapshot/web
```

Node/npm version receipt: `v22.11.0` / `10.9.0`. Only scratch `audit.vitest.config.mts` cacheDir changed to a fresh cache; the seven-case `auditLeaseIndependent.test.ts` was copied to scratch `web/lib/`. No owned application/test bytes changed.

```sh
audit_test() {
  env -i PATH=/usr/local/bin:/usr/bin:/bin \
    HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
    NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
    NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
    SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
    NODE_OPTIONS="--require $PWD/audit-network-deny.cjs" \
    npm test -- --run --config audit.vitest.config.mts "$@"
}

# 366 pass; existing-suites.log
audit_test lib/projections/queries/skater-queries.test.ts lib/projections/runProjectionV2.test.ts scripts/forge-reconstruction-backtest.test.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts lib/player-forecasts/servedForecastLedger.test.ts __tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts __tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts tests/api/forge-scoreboard.test.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts

# 5 pass / 2 unrelated filtered; original-reproductions.log
audit_test lib/auditTemporalCutoff.test.ts lib/auditEdgecases.test.ts -t 'reconstruction excludes|keeps a complete exact-game forecast|unrelated actual row|late durable checkpoint|coverage includes'

# 7 pass; independent-lease.log
audit_test lib/auditLeaseIndependent.test.ts
```

ESLint: same clean `PATH`, `HOME`, `TMPDIR`, network-denial `NODE_OPTIONS`; `npx --no-install eslint` with all 14 manifest paths stripped of the `web/` prefix. Exit 0; scoped-lint.log is empty.

Canonical read-only diff check: `git diff --check -- <the 14 CHANGED-FILES.json paths>`; exit 0. No GIT_DIR override.

Original pinned source patch check from `/tmp/fhfh-claude-audit-20261022/snapshot`:

```sh
git apply --check /Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/owned-fixes.patch
```

Exit 0, after all 14 base hashes matched. Python `difflib.unified_diff` independently generated `reviewed-owned-diff.patch`, exactly equal to the implementer's patch. SHA-256 comparisons are retained in start/end/base JSON files.

No typecheck, build, full suite, browser, actual database concurrency, remote service, migration or production command was run in this review. The reported implementer typecheck was inspected as a prior receipt only.

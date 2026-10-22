# Reproduce the owned fixed snapshot

The existing tested tree is `/tmp/fhfh-queue-check-ah_xhhr5/isolation/snapshot/web`. Its dependencies are a symlink to the existing canonical `web/node_modules`; no install is required. `FIXED-SNAPSHOT.json` pins every archived file. The archive SHA-256 is `f51b4291439a973f3e3d4cf35ec789c5ccfe99899b54c5059180b420568f3077`.

To restore independently, extract `fixed-source.tar.gz` into a fresh nested `/tmp/<task>/isolation/snapshot`, verify the manifest hashes, symlink the already-installed canonical `web/node_modules`, and create `web/.audit-home` and `web/.audit-tmp`. The embedded Vitest config's cache path can be changed to that fresh task's private directory; no application file needs to change. Require `node --version` to be `v22.11.0` before continuing.

From the snapshot's `web/`, use this environment for every check:

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
```

Exact test invocations (receipts retained in `evidence/`):

```sh
# Red baseline, before editing; baseline-tests.log
audit_test lib/auditTemporalCutoff.test.ts lib/auditEdgecases.test.ts

# temporal-bridge-tests.log
audit_test lib/auditTemporalCutoff.test.ts lib/projections/queries/skater-queries.test.ts lib/projections/runProjectionV2.test.ts scripts/forge-reconstruction-backtest.test.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts

# ledger-lease-tests.log (four ledger suites pass; six initial pipeline failures)
audit_test lib/player-forecasts/servedForecastLedger.test.ts __tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts __tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts tests/api/forge-scoreboard.test.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts

# lease-temporal-retest.log (final pipeline and query bytes)
audit_test __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts lib/projections/queries/skater-queries.test.ts

# fixed-edge-tests.log (A4 explicitly supplies the new independent-universe contract)
audit_test lib/auditEdgecases.test.ts -t 'keeps a complete exact-game forecast|unrelated actual row|late durable checkpoint|coverage includes'
```

Type check, same isolated snapshot and clean environment, no installation:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs --max-old-space-size=8192" \
  npx --no-install tsc --noEmit --incremental false
```

ESLint ran with the same clean environment/network preload and `npx --no-install eslint` followed by all 14 paths in `CHANGED-FILES.json`, relative to `web/`. Both log files are empty because each exited successfully without diagnostics. No build, full unit suite, remote service, browser, database, or real provider check was run.

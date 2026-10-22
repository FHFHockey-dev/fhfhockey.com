# Reproduce R1 without touching the active backfill

Use `fixed-source.tar.gz` from this directory in a fresh nested `/tmp/<task>/isolation/snapshot`. Reject absolute/parent paths, links, special files and env files. Verify every `FIXED-SNAPSHOT.json` hash. Symlink only the existing canonical `web/node_modules`; do not install. Create `web/.audit-home` and `web/.audit-tmp`; adjust only the scratch Vitest cache path. Require Node v22.11.0/npm 10.9.0. Do not run from the canonical checkout or read its env files.

From extracted `web/`:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs" \
  npm test -- --run --config audit.vitest.config.mts \
  __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts \
  __tests__/pages/api/v1/db/update-nst-gamelog.test.ts \
  lib/projections/projectionPipelineState.test.ts \
  __tests__/pages/api/v1/db/auditNstIndependent.test.ts
```

The last file is the unmodified independent reviewer fixture. Its SHA is recorded in `CANDIDATE.json`. To reproduce the red result, use a second isolated copy, restore the five `baseline/` files there, and run only that independent file. Expected: two failures and five passes. Do not restore files in canonical.

Checks actually run from the fixed snapshot:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs --max-old-space-size=8192" \
  npx --no-install tsc --noEmit --incremental false

env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs" \
  npx --no-install eslint \
  pages/api/v1/db/run-rolling-forge-pipeline.ts \
  __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts \
  lib/rollingForgePipelineRunState.ts \
  lib/projections/projectionPipelineState.ts \
  lib/projections/projectionPipelineState.test.ts
```

Logs are under `evidence/`. All network denial stays enabled. No real provider/database check or build is part of this procedure.

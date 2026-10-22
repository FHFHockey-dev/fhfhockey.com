# Reproduce this separate NST candidate

Use the frozen archive and `FIXED-SNAPSHOT.json`; do not run against the changing canonical checkout or load its env files. Extract into a fresh nested `/tmp/<task>/isolation/snapshot`, rejecting absolute/parent paths and links. Verify every file hash. Symlink only the existing `/Users/tim/Code/fhfhockey.com/web/node_modules` into the extracted `web/`; no install. Create `web/.audit-home` and `web/.audit-tmp`. The embedded Vitest cache path may be changed to a fresh scratch directory. Require `node --version` = `v22.11.0`.

From the extracted `web/`, the exact final test arguments were:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs" \
  npm test -- --run --config audit.vitest.config.mts \
  __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts \
  __tests__/pages/api/v1/db/update-nst-gamelog.test.ts
```

TypeScript and lint, from the same isolated directory:

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
  lib/rollingForgePipelineRunState.ts
```

`baseline/` preserves the three accepted pre-edit files. To reproduce the four red behavior oracles, use a second isolated copy, replace only its two implementation files with their baseline versions, retain the new test, and filter the pipeline suite with:

```sh
-t 'pauses on a continuation|blocks on a missing success|holds .* uncertainty'
```

The recorded red run preceded two additional final tests, so it reports 48 filtered skips; the final test file would report 50. The four failure oracles are unchanged. The producer test was not edited. All tests mock provider calls; a network-denial failure must be investigated, never disabled.

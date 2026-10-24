# Reproduce P07 R1 locally

Use the existing Node22.11.0/npm10.9.0 and dependencies. Do not install packages, load repository environment files, run builds, use GIT_DIR, or contact services.

1. Create a normal temporary directory, not a Git worktree. Verify and extract the combined archive `../../claude-audit-fixes-2026-10-22/combined-audit-nst/fixed-source.tar.gz` (SHA-256 `1744faa8139dde75c8affd8457771b4eef7706725cddfa23019ae54996e6bf04`).
2. Verify `source-overlay.tar.gz` against `CANDIDATE.json`, then extract it over the temporary tree. This overlay supersedes the original held P07 overlay; do not apply the held overlay afterward.
3. Copy this folder's four `audit*` verification files into temporary `web/`; copy `bridge-claim-oracle.test.ts` to temporary `web/lib/player-forecasts/p07BridgeClaimOracle.test.ts`. Verify every file against `FIXED-SNAPSHOT.json` before changing the verification-only cache path.
4. Set the `cacheDir` in temporary `web/audit.vitest.config.mts` to a private scratch directory. Symlink the canonical existing `web/node_modules` into temporary `web/node_modules`; create `.audit-home` and `.audit-tmp` there. The source snapshot excludes dependencies and diaries.
5. From temporary `web/`, run each command below through the environment wrapper. `TEST-FILES.json` gives the16actual test files. Include the oracle unchanged. No network access is needed or allowed.

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs --max-old-space-size=8192" \
  npm test -- --run --config audit.vitest.config.mts <the16pathsfromTEST-FILES.json>
```

Use the same wrapper for `npm exec --no -- tsc --noEmit --incremental false --project audit.application-tsconfig.json` and `npm exec --no -- eslint <CANDIDATE.files without web/ prefix>`. Existing six hook warnings are recorded; do not suppress them. TypeScript exclusions are explicit and preserve external reviewer fixtures; do not label this full repository typing.

`r1.patch` applies to `r1/baseline/`; `full-p07.patch` applies to original P07 baseline paths plus R1 baseline for the extension. Both were dry-run checked in independent temporary directories. `after/` supplies exact reviewable bytes, including new files. Compare hashes before and after review and report any differences rather than editing a frozen packet.

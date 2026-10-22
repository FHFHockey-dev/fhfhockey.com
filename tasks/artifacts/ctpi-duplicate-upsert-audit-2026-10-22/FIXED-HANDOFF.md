# CTPI local correction — ready for independent review

The authorized correction is applied locally to exactly two application/test files on `octoberBranch`, based on `d3f057c6c849d5d5474bc912a6f461f617c65b15`. No commit or deployment was made. The earlier REPORT.md and RECEIPT.json describe the pre-fix investigation; this handoff records the fixed candidate.

## Change

- `web/pages/api/v1/db/update-team-ctpi-daily.ts`: omit zero-history metrics and invalid team identities before `computeCtpi` performs league normalization. Identity here means a nonempty string without leading/trailing whitespace; the source identifier is preserved, not silently rewritten. Validate nonblank identities and uniqueness of every `(season_id, team, date)` across the complete prepared payload before the first 500-row batch write.
- `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`: use the real calculator for synthetic source histories. Verify uneven first-game dates, single missing history without score contamination, invalid input identities, normal current-date output, no-source skip, and preserved `legacy_unapproved`. Inject deliberately invalid calculator outputs only to exercise destination validation, including a duplicate straddling the 500-row batch boundary with zero writes.

The calculator, formula weights, publication/trust gates, NST, database schema and cron configuration are unchanged. This fixes the local payload-generation defect; it does not qualify the rejected legacy formula or establish production recovery. Historical blank-row cleanup remains outside this task.

## Verification

| Check | Outcome / receipt |
| --- | --- |
| New route regressions against original route | 6 failed, 2 passed as expected — `red-tests.log` |
| Fixed route suite | 8 passed — `fixed-tests.log` |
| Existing calculator suite | 14 passed — `calculator-tests.log` |
| Scoped TypeScript, route/test and transitive dependencies | Exit 0 — `typecheck.log` |
| ESLint, two changed files | Exit 0 — `lint.log` |
| Owned diff whitespace check | Passed |

The first combined run passed all eight route tests but could not load the calculator suite because the source-only test fixture omitted `materializationFingerprint.ts`. That unchanged dependency was copied, then only the calculator suite was rerun. The final total is **22 passing tests**, not a full application suite. No source correction was needed after the first implementation patch.

Tests used Node v22.11.0, installed repository dependencies via symlink, synthetic `.invalid` environment values, mocked service boundaries and an outbound-network-denial preload. No local env files, credentials, provider calls, live SQL or application runtime routes were used. The scoped typecheck used an external config extending the canonical web config with only the owned route/test and `next-bootstrap.d.ts` as roots; it completed under the shared heavy lock and released that lock.

## Review packet

- `candidate.patch`: exact two-file patch against the base above; SHA-256 `79474e676d3267d6deaf751f690bb657766cb108149619286000feed045025b0`.
- `FIXED-CANDIDATE.json`: base/fixed file hashes, unchanged calculator/dependency hashes, archive manifest and check outcomes.
- `fixed-test-fixture.tar.gz`: 21 source/config files for focused test reproduction; SHA-256 `55ad5f2061a7ec995e6d71dc1654e6c80c793193a5b1e1a76be3a3b1c3564c91`. No dependencies or environment files included.
- `baseline/web/...`: original owned route and test for comparison. To reproduce the red gate, use the fixed test with the baseline route.

Existing fixture: `/tmp/fhfh-ctpi-fix-20261022/web`. To restore elsewhere, extract the archive into a private temporary directory, symlink its `web/node_modules` to the existing canonical `web/node_modules`, create sibling `home` and `tmp` directories, and adjust only the fixture config's temporary cache path. From its `web/`:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME=/tmp/fhfh-ctpi-fix-20261022/home TMPDIR=/tmp/fhfh-ctpi-fix-20261022/tmp \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS='--require /tmp/fhfh-ctpi-fix-20261022/offline.cjs' \
  npm test -- --run __tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts lib/trends/ctpi.test.ts
```

Adjust the three temporary paths when restoring elsewhere. Scoped lint ran from canonical `web/` with the same network preload:

```sh
npx --no-install eslint pages/api/v1/db/update-team-ctpi-daily.ts __tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts
npx --no-install tsc --noEmit --incremental false --project /tmp/fhfh-ctpi-fix-20261022/tsconfig.ctpi.json
```

The latter config points at canonical source; it is a scoped source typecheck, not an isolated whole-application build. The original `reproduce.cjs` asserts pre-fix behavior and is not a fixed-candidate acceptance command.

Independent review remains pending with the parent. No blocked, denied or uncertain action; no running command remains. Ownership of the two changed files is ready to transfer for review. Canonical task registers remain untouched.

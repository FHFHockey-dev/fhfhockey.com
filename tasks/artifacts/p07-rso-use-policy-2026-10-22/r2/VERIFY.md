# Reproduce R2 without services

Use Node22.11.0/npm10.9.0 and existing dependencies. Never load repository environment files, install packages, use GIT_DIR, or invoke services.

1. Follow R1 `../r1/VERIFY.md` to reconstruct and verify its3372-file isolated tree. Preserve R1's original archive and C08.
2. Verify this `source-overlay.tar.gz` using `CANDIDATE.json`; extract it over that temporary tree. It contains the full32-file P07 candidate with only8changes from R1.
3. Copy the three `review-fixtures/*.ts*` files into temporary `web/lib/rosterScheduleOptimizer/`. Verify all3375hashes in `FIXED-SNAPSHOT.json` before changing only the temporary Vitest cache path. Use R1's network-denial preload/setup and synthetic environment wrapper, existing dependency symlink and private home/temp folders.
4. From temporary `web/`, run `npm test -- --run --config audit.vitest.config.mts` followed by the10paths in `TEST-FILES.json`. Actual final result294pass. All fetch calls are fixtures; external networking remains blocked.
5. Acquire the parent's shared heavy-check lock before TypeScript/lint. They were not run for R2 because its location/protocol was unavailable. Intended commands through the same clean wrapper: `npm exec --no -- tsc --noEmit --incremental false --project audit.application-tsconfig.json`; `npm exec --no -- eslint` with the8R2paths minus their `web/` prefixes. R1's application scope excludes four unrelated prior reviewer fixtures; do not claim full repository typing.

The six-case independent boundary test itself is unchanged. Only mocked response receipts were adapted to the additive route contract. Keep original reviewer artifacts immutable. Review the actual current-read/route implementation; the nonce is correlation of the live fetch, not a signature or reusable saved authorization.

R2 patch applies to `baseline/`; dry-run receipt is provided. Current canonical planner/display changes after the lease release are outside this fixed snapshot and require separate integration, not silent overlay into review.

# Schedule coverage repair and recurring readiness

Implemented locally in the canonical octoberBranch checkout. No production/provider requests or writes, DDL, activation, release, build, commit, or private-pilot reads. Public Supabase documentation was browsed.

## 2.6 implementation

before-check.log records the fresh single-row defect: one failing regression with completeness incorrectly complete. The existing bounded source reader now preserves expected regular-season game IDs per observed source day, including explicitly observed empty dates. Both producer normalizing paths persist source_metadata.scheduleCoverage; the recurring route already spreads entries, while the guarded route now forwards the new optional field. No schema addition. Existing byte/side/hash guards remain intact, so metadata contributes to their unchanged bounds and a new actual scope hash must be reviewed before any write.

Planning reads select the existing metadata field and require every source day in the requested horizon, plus both padded days for timezone conversion, exact two reciprocal sides per expected game, matching day-level capture/manifest, fresh receipts, and explicit off days. Missing/extra games, split captures, legacy/no witness, stale receipts, missing timezone padding, or contradictory empty-day evidence remain partial. New fresh complete captures recover completeness. Exact pagination remains.

All-empty captures cannot persist this witness without rows and remain partial. Full-season club captures do not emit this bounded day witness and remain partial until a bounded refresh supplies one. Unknown roster membership stays separately disclosed through identity evidence. Source coverage is not forecast qualification or a real refreshed-horizon claim.

## Actual checks

- Before correction: targeted freshness test fails as expected (before-check.log).
- Initial conservative correction: 76 planning tests passed (planning-check.log).
- Expanded durable witness implementation: 133 tests passed across planning/source/normalize/guarded route (schedule-check.log).
- Added recovery/empty assertions: changed test alone passed (recovery-check.log).
- Added explicit guarded-producer metadata-forwarding test: changed test alone passed (persistence-check.log); other 43 route tests already passed above.
- Scoped ESLint passed seven production/test files (lint.log); final two edited test files also passed (final-test-lint.log). Scoped diff whitespace passed. Lead owns full integration TypeScript verification.

## 1.6 reuse and exact remaining gates

Reused local recurring.ts, refresh-roster-optimizer-schedule.ts, and existing LOCAL-INTEGRATION.md/database-prerequisite.sql/APPROVAL-PACKAGE.md under tasks/artifacts/schedule-refresh-recurring-2026-10-15. The local five-path integration exists despite stale proposal comments. Prior verification is retained, not rerun here; source.ts now intentionally supersedes its frozen hash and must be reviewed as part of the new candidate.

The four-function/two-trigger SQL prerequisite is prepared and previously synthetic-engine tested but remains uninstalled. It protects ordinary and recurring schedule writers via a shared transaction lock and monotonic capture receipts. Recurring bounds remain 31 dates, 1000 sides, 1 MiB rows, 90-second capture age, at most five sequential source pages, fixed game key 477/NHL season 20262027; no deletions or automatic retry. Auth and separate audit remain intact. HTTP success without persisted final audit is insufficient. Unknown commit acknowledgement needs bounded readback before retry.

The proposed schedule-cache cadence is 09:50 and 21:50 UTC, using New York current/next weeks plus active Yahoo period, not activated. This does not produce player forecasts and cannot satisfy the required morning forecast baseline or per-game T-15 news revisions.

Pending: bounded production parity preflight; active-writer coordination and migration authority; explicit exact DDL installation; exact release SHA/project/environment/branch and linked-build budget; duplicate scheduler and secret-reference reconciliation; incident owner and proven audit/report delivery; separate activation and natural-run readback. The forecast morning timezone/cadence still needs an explicit owner decision (8 a.m. is hypothetical); forecast-specific T-15 scheduling and revision production remain another subsystem's unverified work. No new scheduler or forecast infrastructure was created here.

Rollback: reconcile ownership then restore only this increment's paths from before/; never reset shared checkout. Operational rollback holds/removes only the new recurring job, preserving cache/audits/shared guards. DDL removal remains separately coordinated. Genuine production completeness/readback still awaits appropriate authority and real inputs.

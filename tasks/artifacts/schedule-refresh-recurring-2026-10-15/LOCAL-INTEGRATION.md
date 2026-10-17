# Local integration handback — exact accepted recurring V2

**Complete locally on `octoberBranch`; no commit, push, build, deployment, DDL or scheduler activation.** Applied the exact accepted five-path patch after FORGE and active RSO owners explicitly confirmed no ownership conflict. All 15 original reviewed source pins matched before integration; the exact five targets were rechecked immediately before application. Three were clean existing files and two were absent. No conflicting drift or merge resolution occurred. The current five application hashes equal the frozen candidate bytes, including its historical proposal comments.

| Integrated repository path | SHA-256 |
| --- | --- |
| `web/lib/cron/cronInventory.ts` | `7ce3f8cd67c3dc5749018591899f88885e724d17352247c5bab770b145b9d8eb` |
| `web/lib/rosterScheduleData/recurring.ts` | `e876ef82ec720744588bbc4dc3e984db8669b1861229666b6637d6de1ae46136` |
| `web/lib/rosterScheduleData/source.ts` | `1aad10ae23f6a3585900b79f918d71872db3fbe28c9a9c2233011c02797406c5` |
| `web/pages/api/v1/db/cron-report.ts` | `04db8f08d9cc86bc1ad474cc3aaa33971905a33dfd747966a4e8e01ea0048b55` |
| `web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts` | `f93de7aa936a36d2274330fdd3fa5d30cb4888e63a5f8135f21c4b25ec4282d8` |

The diff is exactly **216 additions / one deletion**. Existing guarded repair route, refresh guard, Vercel configuration and cron register remain unchanged. All 22 accepted frozen files remain unchanged. Only the five authorized application paths and new integration evidence in this artifact directory were written by this integration. Unrelated working-tree changes were preserved; nothing was staged or committed.

## Focused verification of actual integrated files

- **Passed 11/11** [native wrapper cases](integrated-native-wrapper.tap). [verify-integrated.cjs](verify-integrated.cjs) checks the five repository hashes, then runs the accepted native auth/method/audit/timing assertions with the fixture forced to read actual repository paths instead of candidate overlay files. All DB/auth/NHL transports remain synthetic. Neither HTTP nor database service was started.
- **Passed 50/50** [existing guarded-route/source compatibility tests](integrated-existing-tests.log), rerun because the shared source reader now has the optional bounded-page seam. The two test files were not changed; all transports are mocks. The child environment used an allowlist with synthetic Supabase values.
- **Passed** [five actual application roots TypeScript](integrated-typecheck.log), no candidate overlay, emit or incremental cache write; and [scoped five-file lint](integrated-lint.log), zero output. Scoped `git diff --check` passed.
- **Reused, not repeated:** accepted 32-case V2 model/static evidence and 12-case real synthetic PostgreSQL evidence plus independent engineering/evidence acceptance. No new cluster, engine run, broad suite, browser or build was needed for byte-identical integration.

[LOCAL-INTEGRATION-RESULT.json](LOCAL-INTEGRATION-RESULT.json) records exact commands, exit codes, ownership, before/after/protected-path pins and evidence hashes. Earlier frozen proposal/result fields stating that the patch is unapplied describe their creation time. This handback is the current local state. The old 32-case source-binding assertion intentionally expects pre-integration anchors; use this integrated runner/receipt for current application files, rather than rewriting frozen evidence.

## Four-function / two-trigger production DDL decision

Exact SQL remains **uninstalled**, SHA-256 `2175a73ba14f776547303721ec06554a65fe6e32b00882a5a18e53c97eff4570`, in [database-prerequisite.sql](database-prerequisite.sql). It is reviewed proposal SQL, not a generated/applied migration. Current local integration does not grant permission to install it.

| Function / trigger | Impact if approved and installed |
| --- | --- |
| `roster_schedule_writer_lock()` + same-named BEFORE STATEMENT trigger | All ordinary cache INSERT/UPDATE/DELETE statements share nonblocking transaction advisory lock `(20260829,161013)`, also used by the recurring RPC. Contention rejects with `RS002`; source capture does not hold this database lock. |
| `roster_schedule_monotonic_receipt()` + same-named BEFORE ROW INSERT/UPDATE trigger | Rejects null/non-finite or >5-second-future `fetched_at` (`RS003`); UPDATE, including ON CONFLICT, rejects incoming receipt <= stored receipt (`RS001`). Protects receipt ordering, not provider publication causality. |
| `roster_schedule_observation_clock()` | Service-only scalar database clock before recurring source capture. Capture-start is a conservative receipt marker, not commit time. |
| `commit_recurring_roster_schedule(jsonb,timestamptz,date,date)` | Under the shared lock, validates pinned477/2026/20262027, <=31dates/1000sides/1MiB jsonb-text, <=90-second capture age, complete cached identity scope and strict receipt ordering including identities formerly outside the date range. Applies the entire recurring upsert once; no deletions. Known stale/busy/invalid errors roll back the function's batch before returning a zero-row receipt. Generic errors and lost acknowledgement remain errors/unknown. |

**Legacy impact is immediate when DDL is installed, even before any recurring job:** the unchanged manual/guarded route can have a complete upsert statement rejected for stale/equal/invalid receipts or contention. The row trigger rolls back that statement; the old route does not translate the new SQLSTATEs into recurring known-no-op receipts, so its existing guarded API can report HTTP500 / `writeOutcome=unknown`. Earlier chunks/statements of legacy multi-statement full maintenance can already have committed; DDL does not make that route atomic. DELETE is serialized but has no receipt/tombstone check. Preserve existing exact-game/hash authority and coordinate an exclusive writer window for installation or manual repair. No repair approval is inherited.

**Privileges:** all four functions are SECURITY INVOKER with `pg_catalog` search path and schema-qualified table access. Execute is revoked from PUBLIC / anon / authenticated and granted to service_role. There is no SECURITY DEFINER elevation and no change to existing table grants or RLS. No new table/column/index or existing-row rewrite occurs. Production role/schema/trigger/key/statement-timeout parity is still unobserved; synthetic privileges are verified only in the retained local engine fixture.

**Rollback:** a failed migration transaction leaves none of its new objects/grants installed. After activation, operational rollback holds/removes only this new recurring job and preserves cache rows, audits and shared guards. Removing the two triggers/four functions is a separate coordinated DDL decision after dependency/active-writer inspection, without CASCADE; it removes receipt/serialization protection and does not undo past cache observations. Current local code rollback must check the five current hashes then reverse only the exact patch; never reset the shared checkout.

**Remaining production decisions:** approve bounded parity preflight; approve this shared-boundary DDL through the repository migration workflow; approve an exact integrated commit SHA/project/environment/branch and inventoried Vercel build entries; then separately approve the single recurring job and its write/resource policy. No release SHA is fabricated because no commit was made. Existing [approval package](APPROVAL-PACKAGE.md) retains the finite resource budgets and activation/report-delivery requirements; its local-integration gate is now completed by this handback. No live request, production freshness or whole-week/forecast readiness claim is made.

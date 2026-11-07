# Independent NST goalie writer / lifecycle review — 2026-11-01

Verdict: **changes required before lifecycle activation**. The disabled local candidate has a reproducible global-hold regression. This is not a hosted qualification or release approval. No source fixes were made.

## Findings

### P1 — A completed goalie invocation, or a safe bounded continuation, becomes a global hold

`web/lib/nst/jobLifecycle.server.ts:133-135` requires both `body.success !== false` and `body.retrySafe !== false` before calling finish. These fields describe the route's full work queue/continuation contract, not whether this invocation's I/O has settled.

- `web/pages/api/v1/db/update-nst-goalies.ts:789-812` returns `success:true, complete:true, retrySafe:false` after a nonempty queue finishes successfully. It returns `success:false, operationStatus:"partial", retrySafe:true, requiresReview:false` after a safe bounded partial write. Both fail the enclosing predicate.
- The default export at line952 encloses both legacy modes. `runNstJob` consequently calls `nst_job_hold_v1`; the wrapper returns503 instead of the original200/207.
- This is global impact: migration `20261101161622_nst_goalie_catchup_v1.sql:451-453,499-507` rejects new direct jobs/admission and goalie claims while the held job exists. A normal supported call can stop all enabled NST callers until operator reconciliation.
- The same `success:false` mismatch applies by source trace to acknowledged gamelog continuation (`update-nst-gamelog.ts:2844-2849,2911,3132,3157`). That route's enabled test covers complete success/lost audit, not safe continuation.

**Reproduction:** `enabled-goalie-repro.test.ts` uses the actual exported goalie handler and real lifecycle wrapper; Supabase/provider/audit I/O is mocked. Both a one-dataset successful write and a one-of-ten bounded write produce503 and exactly `begin, hold`, with one acknowledged upsert and no finish. See `reproduction-web-context.log` (2 passing reproduction assertions). The test intentionally asserts the defect, not desired behavior. A temporary copy under `web/__tests__` was removed afterward.

**Needed:** settle from an explicit acknowledged invocation outcome, allowing proven safe continuation without accepting parse/write/audit uncertainty. Cover enabled complete, safe partial, pre-dispatch deferral and unresolved outcomes through actual exported route wrappers. Do not simply ignore all false success/retry fields.

### P2 — Invalid activation settings can report healthy durable progress

Migration line650 sets `configurationKnown` to `not enabled or enabled_at is not null`. It omits conditions that preparation itself treats as review-required at lines535-539: absent bootstrap date, bootstrap outside the eligible season/cutoff, or a future activation timestamp. Progress `reviewRequired` at lines652-653 does not include these conditions either.

Concrete state: enabled=true, enabled_at in the past, bootstrap_date=NULL, no units/claims/jobs. Preparation returns reviewRequired=true and refuses preparation. Progress returns configurationKnown=true, all counts0, noProgressWindows0, reviewRequired=false. `web/lib/nst/goalieFreshness.server.ts:25-36` accepts that receipt as healthy. A future enabled_at produces the same discrepancy. Since no cohort exists, the two-window detector can never alert on this preparation failure. If retained allCounts HD coverage is complete, the combined report can also remain healthy (lines63-73).

**Evidence:** direct SQL/control-flow review; no migration was applied to reproduce this state. The retained SQL test checks only enabled_at=NULL (`supabase/tests/nst_goalie_catchup_v1.py:291-292`), which the candidate already handles. This finding is not a claim that hosted control currently has these values.

**Needed:** make the progress configuration/review verdict reflect the activation/bootstrap prerequisites, with negative cases for these states. Empty queues alone must not establish a healthy configured catch-up system.

### P3 — Functions CLI opens its lifecycle before local credential loading

`functions/api/fetch_team_table.py:381` enters `nst_job` before calling `fetch_team_table`; the latter calls `ensure_loaded_for` at line105. With lifecycle enabled in the shell but credentials supplied through the supported local env loader, `_job_rpc` fails on missing configuration before that loader runs (`functions/lib/nst_admission.py:24-30,91`). The separate web CLI already loads before entering its decorated operation.

**Reproduction:** actual functions CLI `__main__` AST plus the real lifecycle helper, synthetic empty credential environment, mocked HTTP. Result: `NST lifecycle configuration or deadline unavailable`, zero fetch/env-loader calls and zero network calls. See `cli-environment-repro.json`. No env file or credentials were read. Fully exported hosted/process configuration is unaffected.

**Needed:** perform the CLI environment bootstrap before opening the lease and cover that entrypoint, while keeping HTTP authentication before any optional local loading.

## Verified evidence and scope

- All67 candidate source/test files and all67 frozen copies match the supplied manifest at start and finish. Migration SHA256 remains `f28c7923d36de3c2adc1f49cc40c087acdc1067fa66a10068bb88875e4033fa1`; accepted admission prerequisite remains `aefd3c20f2ff76328ef8b27e19244e438ad69a22ea1f9b5ef3cc1d6068784dce`. HEAD is context only, not an isolated release SHA. See `PINS.json` and `FINAL-PINS.json`.
- **Rerun PASS:** existing offline verifier's17 JS files/440tests; Python three-file suite104tests; 2 additional enabled-route defect reproductions. Existing JS network guard and Python I/O mocks prevent provider/database access. Heavy suites acquired the shared lock atomically; no other agent's lock was removed. Initial reviewer harness attempts failed on config path/module resolution, then the fixture ran successfully in the owning web package; intermediate logs retained.
- **Inspected, not rerun:** supplied scoped TypeScript/lint exit0 receipts and empty successful logs; PG15.19 `pg-check-11/RESULT.json` with17 scenario groups and actual SQL verifier assertions. No SQL migration or PostgreSQL harness was launched by this review. The proof uses fixture time in function bodies for scenarios and restores/compares exact function definitions afterward.
- **Concurrency/rate reservations:** claim locks job-control then goalie-control before daily reservation. Direct begin/admission shares the job-control lock. The PostgreSQL proof actually waits for a concurrent lock and confirms one18-attempt reservation. A global unique unresolved-claim index and persistent held/expired states prevent day/cohort rollover from clearing uncertainty. Full reservations remain charged; caller-reported unused attempts are not refunded. The accepted rolling algorithm is renamed and reused unchanged, with conservative permit timing and no fallback to instance-local coordination.
- **Durable output:** SQL validates fixed dataset/table mapping, exact date/season/identity, duplicates, core fields and appearance coverage; output upsert, stored-ID readback, receipt and unit transition share one transaction. The retained trigger-rejection scenario proves output rolls back when the receipt insert fails. Duplicate commits must have matching source/output fingerprints.
- **Finality:** official OFF/date/season/game-ID validation, bounded source body/time, exact database calendar comparison, WGO appearance IDs and counts, stale/wrong/partial rejection, atomic evidence/cohort/enqueue and explicit no-game units are supported by code and tests. AllCounts/allRates require exact retained WGO identity coverage. Other situations may be validated empty. This does not establish independent completeness of WGO, including omitted relief appearances; live source shape and coverage remain unqualified. Name ambiguity fails closed in the checkpoint path.
- **Catch-up/report:** fixed ten-dataset units, immutable whole-cohort count, acknowledged cursor/receipt handling, daily seven-step/60-reservation limit, windows/cooldown and retained holds are represented in SQL/adapter/runner tests. The route runner's checkpoint path remains separate from the legacy direct wrapper affected by P1. The two-closed-window detector uses durable backlog and receipts, not missing audits. Freshness's direct row check is allCounts HD versus WGO; it expressly does not prove all ten tables complete.
- **Caller scope:** inspected continuation diffs, actual lifecycle/dispatch helpers, supported TS route/CLI wrappers and Python entrypoints/proxy. Lazy cache-only paths acquire no lease; concurrent misses share one begin; pending admission is active work; late permits/expired contexts reject dispatch; swallowed failures mark uncertainty; enabled player-report work is awaited. Python proxy child tokens reuse authenticated parent leases without finishing them. Five historical Python paths and several legacy TS writers have private-function/AST fixture coverage, not full legacy data-repair acceptance. Bounded repository search found two extra `fetchNst...` names that only read retained tables, not new provider callers. External deployments/hosts/keys remain unknown.
- RLS and invoker grants are explicit. Least-privilege behavior depends on the reviewed database defaults, including repository migration `20261020224500_data_api_explicit_default_privileges.sql`; the isolated fixture has no broad service_role defaults. Hosted default/object ACLs still require the separately approved dependency/privilege read. The packet's protected-owner custody receipts were inspected; this review did not alter those sources or accepted artifacts.

## Remaining release limits

Keep `NST_JOB_LIFECYCLE_ENABLED` off, `nst_job_control.enforced=false`, and `nst_goalie_control.enabled=false` pending fixes and focused re-review. No current hosted state is asserted here. Actual deployed caller inventory, paired web/functions deployment/configuration, prerequisite/schema/privilege checks, qualification fingerprint/time, bootstrap and reconciliation/rollback procedures, exact release SHA/project build inventory and explicit deployment approval are still pending.

Schedule changes and actual alert delivery remain unapproved/unverified; earlier report234 inactivity does not prove a replacement. A bounded official/NST canary and ten-table coverage/backfill acceptance need separate approval with exact dates, request/retry/write/runtime bounds. The24-unit/day conservative local ceiling is not measured production throughput. Existing historical one-row skips/fixed dates/name mapping are not newly qualified repair semantics.

Production/provider requests, hosted DB operations, migrations, schedules, pushes and deployments performed by this review: **0**. Reserved holdout was not accessed. No denied or uncertain external action; no execution blocker remains for delivering this review.

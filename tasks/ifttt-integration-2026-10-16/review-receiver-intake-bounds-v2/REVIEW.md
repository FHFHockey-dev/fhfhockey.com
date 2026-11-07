# Independent bounded receiver intake correction review v2

**Accepted within the bounded local intake scope. R20 is closed.** No new implementation defect was found. This is local policy/receiver/storage evidence, not production activation, hosted transport, universal writer fencing, full52 or future-performance acceptance.

Source manifest: `../receiver-intake-bounds-v2/owned-source-v2-sha256.json`,148 pins, SHA256 `81b41d7841a72c12cdb2824a7483cb81a0a13a61d40b916c4b218447cbd0b9fb`, plus15 read-only dependencies. Owner artifact manifest: SHA256 `a36323d17b96d47a28ef59f63220b523f48e3a91b55e97f38a04eec461fdb719`,17 files.

Selected replacement SQL7: `../receiver-intake-bounds-v2/supabase/migrations/20261016085537_ifttt_bounded_receipt_intake.sql`, SHA256 `ab5d686589f78815326b1b0c942975206cfc1cc4e6288fdfa64646e4289f8c5e`. **Never apply both SQL7 alternatives.** Accepted SQL5/SQL6 replacement selections remain unchanged; task-local filenames are not migration authority/order.

## Why R20 is closed

The rejected SQL7 captured admissions only after the attempts UPDATE, letting its trigger effects establish a false baseline. The replacement captures all current-policy admission rows/count before that first mutation, refuses an already-over-cap state, and compares the full map immediately after the UPDATE outside the retention savepoint. A faulty quota mutation therefore raises and rolls back the whole attempt, including its admissions. The inner block still charges ordinary storage/cap failures where the earlier mutation is valid.

The two original R20 bodies are byte-for-byte unchanged. Both now return500 with complete before==after readbacks: admissions remain0, attempts remain0 and raw/archive state stays unchanged. The previously successful exact retry cannot certify two IDs under maxReceipts1, and the failed receipt-cap path cannot commit the quota trigger's earlier admissions. Original v1 failures remain immutable.

The correction also requires stop UPDATE to preserve the full current-policy map and new operator registration to start with no admissions. Three owner-added controls verify under-cap quota injection, stop-trigger admission injection and registration-trigger admission injection, including complete rollback and fault-removal recovery. The original104 test bodies remain unchanged.

## Independent adjacent controls

Three additional actual-PG cases pass:

- An explicitly owner-injected invalid prior map already contains2 IDs under maxReceipts1. Intake refuses before charging or changing anything; it does not reset/repair/widen that state. This is a synthetic damaged-state fixture, not a production write or a claim that service can directly insert admissions.
- Starting with one valid admitted ID, an ordinary archive failure advances attempts1→2 while preserving data/maps. A later receipt-cap refusal advances2→3, exact canonical retry advances3→4 and reuses the ID, then an exhausted retry leaves4 unchanged. This checks the distinction between whole faulty-mutation rollback and ordinary inner failure charging with an existing map.
- A private advisory barrier pauses in-flight intake while holding the policy row. `pg_locks` proves it is paused; `pg_stat_activity` proves a second connection's stop call waits on a lock. After release, intake completes, stop commits, and a later variant request is refused with no further policy/map/raw/archive change. This exercises the documented ordering, rather than assuming a stop cancels already locked work.

Evidence: `evidence/independent-preexisting-over-cap.json`, `independent-ordinary-failure-headroom.json`, `independent-concurrent-stop.json`.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Frozen current77-case actual-PG harness,20 pure policy and12 nearest mocked cases |109/109 pass in one independent run|`copied109-results.json`, `copied109.log`|
| Three independent adjacent cases |3/3 pass;77 inherited cases filtered out|`independent3-results.json`, `independent3.log`|
| Scoped runtime/policy/PG-harness TypeScript including all additions |Exit0|`scoped-tsc.log`, `tsconfig.json`|
| Final source/dependency/prior-evidence integrity |All matching|`pin-check-after.json`|

Total **112 distinct passing cases:80 actual private-PG,20 pure policy,12 nearest mocked.** No reviewer test/compiler failure or repeated successful case occurred. No aggregate compiler, build, browser, broad81/full52 or hosted action ran. Runtime source/test bytes are unchanged from intake v1, so lint was not independently rerun; earlier lint retains its original scope. Owner failure history remains copied without alteration.

## Accepted boundary

The real handler/helper uses synthetic request/response objects and a local actual PostgreSQL RPC bridge. Its controlled path requires explicit exact configured discovery-route tuples, operator-registered immutable future policy, supplied maxAttempts/maxReceipts, server window and durable stop; malformed/partial/disabled-with-policy config fails closed. Service cannot register/widen/reset/resume, directly execute the old unbounded archive core or INSERT archive evidence under the fixture grants. The narrow definer entrypoints have empty search paths and runtime lock_timeout2s. Completely absent pilot config retains the documented legacy compatibility path, not universal fencing of alternate code.

Stable receipt IDs serialize with quota/map admission, exact retries consume attempt headroom without new receipt slots, and a first legacy baseline+variant needs two slots atomically. Missing IDs reject controlled intake. Both canonical and held controlled receipts suppress immediate processor calls even with process=true/capture=true. Body/provenance variants remain evidence, not authentic edits, independent corroboration or new native r3 effects. SourceAccount remains the configured discovery route, not proof of body/original authorship.

Ordinary inner failures/cap refusals retain attempt charges; whole fatal/cancelled transactions can roll back charges too. This is an admitted-work/version budget, not a universal HTTP/network/CPU cap. No actual Next HTTP listener, external sender/queue or hosted PostgREST was exercised. The pure20 policy cases do not replace the80 actual-PG cases.

## Fidelity, isolation and release

All148 current pins and review source copies,15 owner/reviewer/live dependencies,139 prior source pins,25 prior owner artifacts,17 current owner artifacts and all **2,443 prior reviewer files** plus the status addendum matched at final pre-release rehash. Earlier reviewer manifest hashes and the separately captured scheduler also match. No runtime edit occurred relative to intake v1. Its three intentional receiver/helper/test changes and exact accepted125 before-copies retain their earlier provenance. Original r3/reducer/oracle and selected SQL1–6 bytes in these pins remain unchanged.

The current storage harness and nearest/pure tests are copied byte-identically. The prior104 prefix is unchanged. The two exact R20 bodies are retained in `evidence/unchanged-R20-reviewer-block.txt`; normalized trailing-boundary block SHA256 `8728478b484b54055651f1aa5e1c9d8d300f5d6a7557054684af5fdb60986e34`. Test-body comparison does not claim the whole current harness is byte-identical to older pre-policy setup. The pure test/module are identical copies; actual receiver code uses the frozen canonical module. Captured dependency hash checks/execution markers remain enabled; the nearest scheduler uses a hashed snapshot and a mocked queue.

Each private PG17 cluster used fresh Unix sockets, TCP disabled, synthetic credentials and explicitly registered synthetic policies, plus network denial. All tests/compiler processes finished; clusters stopped and were removed. No shared application/SQL implementation, owner evidence, previous reviewer file, branch, stage or commit was modified. No production values, registration/stop/intake, flag change, migration application, hosted call, dispatch/replay, scheduler, publication, push or deployment occurred.

All148 pins and15 snapshot holds were explicitly released after final rehash and before report-only writing. Reviewer ownership is only this new root; other source/dependency ownership remains unchanged. Exact frozen reviewer inventory is `review-artifacts-sha256.json`.

## Remaining gates

1. Separately verify deployed table/function ownership, full schema/index/default/trigger inventory, table/column/sequence/default/inherited ACL/RLS, competing writers and fences. Fixture role denials do not prove complete deployed privileges. Deferred commit-time and subsequent direct/legacy writers remain unaccepted.
2. Approve exact policy bytes/scopes, explicit future window/caps, stop owner, source candidate/commit, target, migration authority/membership/order and bounded registration/configuration/canary before activation. Select replacement SQL7 after replacement SQL6 only; SQL5's selected replacement remains separate. No policy values/defaults or rollout are authorized by this review.
3. Verify a caller-wide RPC statement deadline in the actual transport. Runtime lock_timeout2s and the DDL transaction's5s statement_timeout are distinct; the latter is not a per-RPC guarantee. Whole cancellation can roll back charges. Stop ordering here covers cooperating policy-lock users, not arbitrary after-stop writers or independent background processors.
4. Authentic source/identity/history/coverage and writer fences, authenticated correction policy, external sender/queue and legacy/deferred atomicity, genuine prospective labels/metrics and all later processing/evaluation/dispatch/replay/publication/release approvals remain open. Historical225/227 heterogeneous assertions across50/52 original rows and separate CR011/CR051 positives retain prior qualifications. This is no full52 integrated or production acceptance.

# Independent receiver retention correction review v2

**Accepted within the bounded local receiver variant-retention scope. R19 is closed.** No new implementation defect was found. This accepts the exercised local handler/storage behavior, not deployment, hosted PostgREST, external delivery, full52 or future performance.

Source manifest: `../receiver-variant-retention-v2/owned-source-v2-sha256.json`,125 files, SHA256 `a63680cd434c6ca71713853e26e2cd3c3c18a261d8f694de10da171670409964`, plus15 read-only dependencies. Selected replacement SQL6: `../receiver-variant-retention-v2/supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql`, SHA256 `789772078e3b8405539358e07413cf2fd4cf6d80a82513911bf989f8c02b0483`. **Never apply both SQL6 alternatives.** SQL5 also retains its separately accepted replacement-only selection.

## Why R19 is closed

The prior SQL6 attempted an insert before snapshotting an existing same-key carrier. A BEFORE INSERT trigger could mutate that carrier even when ON CONFLICT skipped insertion; the final comparison trusted the already-mutated snapshot. The replacement takes a per-key transaction advisory lock, selects the existing raw row FOR UPDATE before any insert, and skips insertion for an existing carrier.

Only an absent key attempts insertion. It has a prebuilt generated ID, server receipt clock and full expected row. A cooperative caller serializes on the same key. If an uncooperative direct writer wins the key, ROW_COUNT is not one and the RPC raises, rolling back its own conflict-trigger side effects instead of adopting the competing row after the fact. A fresh request may then lock and classify the actually committed carrier. The full stored raw/receipt postconditions remain.

The complete prior41-case reviewer prefix and R19 oracle are unchanged. Both original R19 probes now return HTTP200 with every canonical raw field unchanged: exact retry reuses its canonical receipt ID; changed body retains a linked held variant. This closes the observed mutation without requiring a failing response when insertion can safely be avoided. CCC's analogous two probes also pass.

## Actual race and preservation evidence

Both raw tables have a separately committed, uncooperative competing insert race. Observed private `pg_locks` proves the RPC read the key as absent and paused in its BEFORE INSERT trigger before the other connection commits the competing carrier. After release, the RPC's attempted conflict-trigger one-microsecond mutation rolls back: HTTP500, competing carrier byte-for-byte unchanged and no archive rows. A fresh request, with the same trigger still installed, skips INSERT, returns held_for_review and retains one available canonical snapshot plus one linked variant. Evidence is in `evidence/absent-race-*.json`.

The owner-added first-insert clock-rewrite controls pass on both tables. Four independent additional cases cover BEFORE INSERT changing the generated primary ID and AFTER INSERT changing status to processed, on each table. Each fault returns500 and leaves both raw tables/archive empty. Fault removal permits one canonical receipt and an identical duplicate retry, with no raw reset or extra evidence identity. This verifies the prebuilt full-row check beyond its receipt-clock field.

Two independent cases hold the actual exact per-key advisory lock on another connection. The handler makes one mutation attempt, gets SQLSTATE55P03 (lock timeout) at2,008ms, returns500 and writes no raw/archive rows. After lock release, a fresh request and exact retry converge to one canonical ID. `pg_proc.proconfig` confirms the function's runtime `lock_timeout=2s`. These are actual server-lock waits, not application fake timers.

**Deadline limit:** the top-level migration `SET LOCAL statement_timeout='5s'` bounds its DDL transaction. It does not establish a five-second RPC deadline. Function configuration contains search_path and lock_timeout only. A separately verified caller/role statement budget remains open; the runtime two-second lock wait is the only timeout accepted here.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Frozen current47-case actual-PG harness plus unchanged12-case nearest harness |59/59 pass in one independent command|`unchanged59-results.json`, `unchanged59.log`|
| Six independent adjacent controls |6/6 pass;47 inherited cases filtered out|`independent6-results.json`, `independent6.log`, `evidence/independent-*.json`|
| Scoped runtime and PG-harness TypeScript, including all six additions |Exit0|`scoped-tsc.log`, `tsconfig.json`|
| Final source/snapshot/owner/prior review integrity |All match|`pin-check-after.json`|

Total **65 distinct passing cases:53 using actual private Postgres,12 nearest mocked receiver/scheduler cases.** There were no reviewer harness failures or failing checks in this increment. No aggregate compiler, build, browser, broad81, full52 or hosted action ran. Runtime lint was not independently rerun because no application source/test changed in this correction; v1 lint evidence retains its original scope.

The owner's original57pass/two race-fixture-cast failures and subsequent two-only repair run are preserved in its copied evidence; this review does not rewrite that history as an owner full59 success. Our own full59 command succeeds against the final frozen bytes.

## Accepted local boundary

The real `createLineSourceIftttReceiver` handler runs with fixture request/response objects and a local SQL RPC bridge. Known-ID retention remains explicitly default-off; missing-ID and flag-off paths keep their existing behavior. The tests verify durable acknowledgment before HTTP success, exact retry identity, JSON-order normalization, per-source/table carrier keys, concurrent duplicates and distinct variants, immutable body/provenance/game-metadata differences linked to a baseline, no processor request for held variants, preserved available legacy rows/markers, first/late transaction rollback and uncertain RPC/HTTP reply recovery without legacy fallback or automatic mutation retry. Archive bounds, source binding, tested role denial and immutable-row protections retain their prior qualifications.

These are carrier evidence identities, not new native r3 occurrence/effect identities. Differing text, claimed author or game metadata remains held evidence; it does not authenticate an edit, supersession or independent occurrence. Existing canonical duplicate processing policy is unchanged. No Next HTTP server, hosted PostgREST or genuine sender/queue was exercised.

## Fidelity, isolation and release

All125 current source pins and review copies,15 owner/reviewer/live dependencies, prior119 sources,41 prior owner artifacts,29 current owner artifacts, and all **2,016 prior reviewer files** plus the status addendum matched at final pre-release rehash. Prior reviewer manifests retained their hashes. The separately captured nearest scheduler also matches its live read-only source at that check. Original r3/reducer/oracle/SQL1–5 and runtime receiver/helper/test bytes remain unchanged. Only six new task paths form this correction.

The storage harness is byte-identical to the frozen candidate. Its full prior reviewer41 prefix and R19 assertions are unchanged. The nearest harness is byte-identical to the frozen runtime test. Six additions are isolated in a separate copied harness with inherited47 cases filtered out. The review reads only its selected SQL6 copy and the exact captured baseline. Dependency hash-on-load checks and execution markers show the captured flags/evidence-time modules executing; nearest cases also execute the hashed scheduler snapshot with the queue mocked. Broader forecast/goalie behavior was not retested or accepted.

Fresh private PG17 clusters used Unix sockets, TCP disabled, synthetic credentials/data and network denial. All tests/compiler processes finished and clusters stopped/removed. No application/SQL implementation, owner artifact, previous reviewer file, branch, stage or commit was modified. No production DDL, hosted read/write, deployment, ingestion, dispatch, replay, flag or scheduler activation occurred.

All125 source pins and15 snapshot holds were explicitly released after final rehash and before report-only writing. Existing dependency ownership stays with its owners. Reviewer ownership is only this new root; it is now frozen under `review-artifacts-sha256.json` for combined verification.

## Remaining gates

- Deployed raw schema, unique indexes/defaults/triggers, full table/column/sequence/default/inherited ACL/RLS and competing writer inventory/fences need separately authorized evidence. Deferred commit-time triggers, subsequent caller statements and arbitrary later direct writers are unaccepted. Synthetic private races do not establish universal writer fencing or authentic production history.
- Approve exact source commit/manifest, target environment, migration authority/membership/order, caller statement deadline and a bounded natural-receipt rollout before applying SQL or enabling the flag. SQL6 needs the existing raw tables and exact known-key unique indexes. SQL1–5 retain their distinct gates; select only the reviewed replacement SQL5 and replacement SQL6 alternatives, never duplicate drafts by timestamp order.
- Genuine sender/external queue reliability, legacy/deferred atomicity, authentic source/identity/history/coverage, authenticated correction policy and genuine prospective labels/metrics remain open. Any activation, scheduler, dispatch, replay, compensation, publishing, push or deployment still needs its separate authorization.
- The historical heterogeneous225/227 assertion reconciliation across50/52 original rows, original CR011/CR051 ambiguous failures and separate approved positives retain their prior meaning. This review gives no full52 integrated or production acceptance.

# Independent bounded receiver intake review v1

**Rejected: R20 (P1), quota-update side effects can commit admission IDs beyond maxReceipts.** The owner acknowledged the finding and received release of the source hold. A separately frozen replacement SQL7 is pending. No implementation repair was made by this review.

Source manifest: `../receiver-intake-bounds-v1/owned-source-v1-sha256.json`,139 files, SHA256 `6a652678d23c8161c57b0526c80a789b69c680b699f662388e81d8283f070b45`, plus15 read-only dependencies. Owner artifact manifest: SHA256 `914699f7821cb524c0077bd28990e418383d891d2cbf9d4152657150ceae67cb`,25 files. Candidate SQL7: `supabase/migrations/20261016085537_ifttt_bounded_receipt_intake.sql` under the owner root, SHA256 `7ffd05fb1ed6f845a4f1fee7a0c37a08a0cf7cf31c3a7fd62cae7b354d252b34`.

## R20: admission snapshot misses writes from the earlier attempt UPDATE

`retain_bounded_ifttt_raw_receipt` locks the policy, snapshots the target raw carrier, increments `ifttt_intake_policies.attempts` outside the inner retention savepoint, checks the stored policy/raw row, then calls SQL6 inside the savepoint. Its first current-policy admission snapshot (`before_map`,count n) occurs only after this earlier UPDATE and its triggers.

An AFTER UPDATE trigger on `ifttt_intake_policies` can therefore insert current-policy admissions before that snapshot. The gateway treats them as preexisting. For an exact already-admitted receipt, its cap check runs only when adding another ID, so an over-cap map can pass. For an ordinary inner receipt-cap failure, the savepoint rolls back inner retention but leaves these earlier quota-trigger admission writes committed alongside the attempt charge.

The real receiver/local RPC reproductions first retain two immutable receipts under an explicitly registered synthetic fixture policy. They then register a fresh future policy with maxReceipts=1 and no admissions, install an immediate attempts-UPDATE trigger that admits those same two existing IDs to the current policy, and invoke one request:

| Path | Response | Admissions before→after | maxReceipts | Attempts after | Raw/archive |
|---|---|---|---|---|---|
| Exact canonical retry |HTTP200, canonical duplicate|0→2|1|1|Unchanged|
| Third same-post variant, receipt-cap refusal |HTTP500|0→2|1|1|Unchanged|

Evidence: `evidence/R20-successful-retry.json`, `evidence/R20-receipt-cap-refusal.json`, `independent-results.json`, `independent.log`. Both cases fail the same required assertion: actual admitted stable IDs2 must be≤explicit cap1. This is the policy's admission budget, not a claim that two new physical archive rows or native effects were created. The initial two receipts existed before this new policy; the approved new budget is still only one ID, as the documented existing-ID re-admission semantics require.

The test trigger runs within the gateway's SECURITY DEFINER UPDATE using its current privileges. It needs no direct service grant on the private admission table, other connection, response forgery, deferred trigger or postcommit writer. Source routing and all receipt IDs are valid fixture data. It is an intra-RPC preservation defect at the claimed quota/map postcondition boundary, not a request for universal fencing against arbitrary outside writers. No production trigger of this kind is asserted.

Returning500 on the second path is insufficient: two over-budget admission rows are durably committed before the inner rollback. Both raw and archive state stay unchanged, making the private admission inventory essential to the repro.

Required bounded correction: establish and validate the complete current-policy admission inventory before the first attempt UPDATE, prevent its trigger effects from becoming an unvalidated baseline, and ensure a detected faulty quota mutation rolls back its admissions. Preserve ordinary inner storage/cap failure attempt charging where no such mutation occurred. The two original assertions accept a safe retained result with exactly one matching admission or a failed result with unchanged admission inventory; they do not require a particular repair design.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Byte-identical copies of current storage, pure policy and nearest receiver tests |104/104 pass:72 actual private-PG,20 pure policy,12 nearest mocked|`copied104-results.json`, `copied104.log`|
| Two independent actual receiver/quota-trigger probes |Two failures;72 inherited cases filtered out|`independent-results.json`, `independent.log`, `evidence/R20-*.json`|
| Scoped runtime/policy/PG-harness TypeScript including both probes |Exit0|`scoped-tsc.log`, `tsconfig.json`|
| Final source/snapshot/prior-evidence integrity |All matching|`pin-check-after.json`|

No reviewer harness failure, retry or original-case rerun occurred. Owner historical47 alias-setup errors and repaired runs are copied without alteration; they were not reproduced or rewritten as passing checks. No independent lint run, aggregate/full compiler, build, browser, broad81, full52 or hosted action was performed. Owner lint evidence retains its original scope.

## What the passing evidence supports

The policy parser requires explicit exact route tuples, bounded future start/end syntax and positive safe-integer attempt/receipt budgets. Handles and scope order normalize; duplicate/wildcard/extra fields and malformed/partial/disabled-with-policy configuration fail closed. No production policy or automatic registration is supplied. Controlled intake requires known post identity and shadow mode; canonical and held receipts request no immediate processor even with process=true/capture=true.

Actual local SQL tests exercise owner-only immutable registration, no service registration/reset/widen/resume, durable monotonic stop, server start/end checks, expiry during retention, shared attempt/receipt races, duplicate IDs charging attempts without new slots, two-slot legacy-baseline/variant admission, uncertainty/retry, ordinary storage failure charges, role denial and service denial for the old unbounded core/direct archive INSERT. The gateway's explicit narrow SECURITY DEFINER privilege bridge and empty search_path were inspected. These are fixture privileges, not full deployed ACL proof.

SourceAccount denotes the configured discovery route, not authenticated body/original authorship. Provenance/body/game differences remain immutable held variants. Missing-ID/default-off compatibility changes are intentional: completely absent pilot configuration retains legacy behavior, while a configured pilot cannot use lossy legacy fallback. Alternate deployed legacy/raw writers remain outside this local fence.

These passing cases do not establish the complete admission-map invariant because of R20. Pure20 policy tests do not substitute for durable integration;72 actual-PG cases and the failing probes execute real handler→helper→SQL7→SQL6 with fixture request/response objects and a local RPC bridge. No hosted transport or real HTTP listener/sender was exercised. Earlier R19 row-preservation and coordinated race assertions remain unchanged, but the complete new intake candidate is not accepted.

## Fidelity, isolation and release

Current storage/nearest/policy test copies and the pure policy module are byte-identical to the frozen inputs. The storage harness is explicitly adapted relative to the accepted receiver-v2 harness: policy setup/SQL7 bridge, missing-ID and permission contracts change. `evidence/owner-harness-adaptation.diff` records it; `evidence/R19-fidelity.json` independently confirms the complete original R19/CCC/clock/race block unchanged. The pure test executes an identical copied stateless module; the real receiver uses the same frozen canonical module bytes.

Three accepted125 live paths intentionally changed: receiver, helper and nearest test. Their accepted before-copies exactly match prior hashes. The other122 prior paths remain live unchanged. Final rehash verified139 current source pins and review copies,15 owner/reviewer/live dependencies,25 current owner artifacts, all **2,224 prior reviewer files** plus the status addendum and previous reviewer manifest hashes. The additional captured scheduler matches its read-only live source. Original r3/reducer/oracle, selected SQL5 and accepted replacement SQL6 remain unchanged in the retained pins. No previous review or owner evidence was overwritten.

Fresh private PG17 used Unix sockets/TCP disabled, synthetic secrets and explicitly registered synthetic policies only, plus network denial. All tests/compiler processes finished; clusters stopped and were removed. No production policy values, flag changes, hosted query/DDL, migration application, live registration/intake/stop, dispatch, replay, cron, publication, push, deployment, stage/commit or branch operation occurred.

All139 source pins and15 snapshot holds were explicitly released after final rehash and before report-only writing. Only this review root is reviewer-owned; existing dependency/source owners remain unchanged. The owner acknowledged R20 and will prepare replacement SQL7 under a separate v2 root, including nearby registration/stop map invariants. That proposed correction is unreviewed; no additional work or acceptance is inferred here. This root is frozen under `review-artifacts-sha256.json`.

## Exact remaining gates

1. Close R20 with unchanged two-probe rerun and bounded success/refusal/rollback/recovery coverage, retaining exact attempt charges and current-policy maps within their limits. Review the separately pinned replacement SQL7; do not conflate a proposed fix with acceptance. Nearby registration and stop policy-mutation inventory claims need their concrete evidence.
2. Verify deployed function/table ownership, empty search paths, RLS and complete table/column/sequence/default/inherited grants, trigger inventory and competing writer fences under separately authorized bounds. Confirm no inherited EXECUTE/archive INSERT restores the old bypass. Deferred/subsequent/direct legacy writers remain unaccepted.
3. Approve exact policy bytes/scopes, explicit future window, maxAttempts/maxReceipts, stop owner, source commit, target, migration membership/order and bounded canary before any registration/configuration/activation. SQL7 must follow selected replacement SQL6 only; SQL5 remains replacement-only. Task-local drafts/timestamps are not migration authority. A later replacement SQL7 must be selected instead of v1, never silently added alongside it.
4. Prove the actual caller-wide statement deadline. Runtime lock_timeout2s is distinct from a five-second DDL transaction timeout. Fatal/cancelled whole transactions can roll back charges; this is no universal HTTP/network/CPU cap. A request already holding the policy lock may complete before stop obtains that lock; no acceptance of arbitrary after-stop writers follows.
5. Authentic identity/history/source coverage/fences, correction/supersession policy, external sender/queue and legacy/deferred atomicity, genuine future labels/metrics and all processing/dispatch/replay/publication/release approvals remain open. Historical225/227 heterogeneous assertions over50/52 original rows and separate CR011/CR051 positives retain prior qualifications. No full52 integrated or production acceptance.

# Independent receiver variant-retention review v1

**Rejected: R19 (P1), intra-RPC canonical raw preservation.** The owner accepted the finding and will prepare a separately pinned replacement SQL6. No runtime or implementation repair was made by this review. Prior accepted110/R18 boundaries remain unchanged.

Reviewed manifest: `../receiver-variant-retention-v1/owned-source-v1-sha256.json`,119 files, SHA256 `e19464cdd6d320352125971ddcae9bf9f7996df209a12e9805a0ed3b25ad19a9`, plus15 read-only dependencies. SQL6: `../receiver-variant-retention-v1/supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql`, SHA256 `9540ce4d019d67f4953b66fa62a5bff5eb45dbf00f9dae482adc77c9cef3e933`.

## R19: snapshot after the conflict INSERT misses an earlier canonical-row mutation

In `retain_ifttt_raw_receipt`, both raw-table branches first execute `INSERT ... ON CONFLICT DO NOTHING`, then select the existing row `FOR UPDATE`. A BEFORE INSERT trigger runs even when the insert conflicts. If that trigger changes the existing same-key raw row, the later `raw` snapshot already includes the mutation. The final `final_raw IS DISTINCT FROM to_jsonb(raw)` test cannot detect it.

The actual receiver/RPC reproductions seed one canonical receipt, install an immediate BEFORE INSERT trigger that updates the existing key's `received_at` by one microsecond, and call the receiver again:

| Request | Actual response | Original raw clock | Actual raw clock | Archive rows |
|---|---|---|---|---|
| Exact same-key retry | HTTP200, canonical duplicate, requiresReview=false | `2026-10-16T03:37:31.833551-05:00` | `2026-10-16T03:37:31.833552-05:00` |1→1|
| Changed same-post body | HTTP200, held_for_review, retained variant | `2026-10-16T03:37:31.889400-05:00` | `2026-10-16T03:37:31.889401-05:00` |1→2|

Evidence: `evidence/R19-exact-retry.json`, `evidence/R19-changed-variant.json`, `final-R19-results.json`, `final-R19.log`. The raw row clock in JSON may omit a trailing zero; it changes by exactly one microsecond. The variant body is retained and processing is held, but preservation of the existing canonical receipt fails. This can contradict retained receipt/observation identity clocks in later recovery. It does not require another connection, postcommit write, deferred trigger, forged response or elevated trigger privilege: the test trigger uses the existing fixture service UPDATE grant within the RPC's own attempted insert.

This is a demonstrated transaction postcondition defect. It does not assert that production currently has this trigger and does not request universal fencing against arbitrary later direct writers. Immediate raw/archive trigger fault handling is part of this candidate's claimed local preservation boundary.

The failure oracle checks complete canonical-row equality before examining the response. It allows a correct implementation either to avoid the conflicting insert and return200 with unchanged canonical/exact-duplicate or held-variant semantics, or to detect the fault, roll back and return500 with unchanged archive. Both runs fail at the same unchanged whole-row equality assertion. Initial stricter rollback-only suffix, initial logs/results/readbacks and final implementation-neutral oracle are all preserved; no passing original assertion was weakened.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Byte-identical frozen storage harness |39/39 actual private-PG cases pass|`unchanged51-results.json`, `unchanged51.log`|
| Byte-identical nearest receiver/scheduler harness |12/12 mocked cases pass after reviewer resolver repair|`nearest12-results.json`, `nearest12.log`|
| Independent actual-receiver R19 probes |Two distinct failures, reproduced twice;39 inherited cases filtered out per run|`independent-results.json`, `final-R19-results.json` and logs|
| Scoped runtime/harness TypeScript, including final R19 oracle |Exit0|`scoped-tsc.log`, `scoped-tsc-final.log`|
| Final source/dependency/prior evidence rehash |All match|`pin-check-after.json`|

Thus **51 distinct passing original cases and two distinct failing independent cases**. No broad81/full52, full compiler, build, browser or hosted action was performed. Owner lint evidence was inspected but lint was not independently rerun; reviewer code edits were artifact-only.

The initial combined command passed all39 storage cases but could not collect the copied nearest suite: its captured scheduler, outside the web path context, could not resolve the explicitly mocked `starterBoardQueue` import. Adding an exact alias repaired only the reviewer resolver. Only the previously uncollected12 cases were rerun. Initial failure log, JSON, config and explanation remain under `evidence/`. No application/SQL/test body was changed for this correction. The first combined report's success=false is disclosed and is not represented as a51-case successful command.

## What the passing evidence supports

The actual known-ID receiver invokes the new RPC behind an explicit default-off flag. The local tests verify first receipt persistence before HTTP acknowledgment; exact/JSON-order duplicate reuse; two-table and per-source-key carrier behavior; concurrent duplicates and distinct variants; immutable changed-body/provenance/game-metadata retention linked to one baseline; legacy processed rows/markers preserved in the ordinary path; lost RPC/HTTP replies and safe retry; no legacy fallback on uncertainty; and no processor call for a held variant even when requested. SQL input bounds, role denial, archive UPDATE/DELETE denial, direct INSERT source binding, selected immediate archive/raw trigger faults and first/late archive rollback are exercised. Missing-ID/default-off compatibility stays explicit.

These observations remain useful, but they do not establish the full canonical raw-preservation contract because of R19. SQL6 should not be accepted or activated from this checkpoint. Different text, author fields or game metadata are retained evidence only; no authentic edit, supersession, new lexical occurrence or independent effect is proved. Existing canonical retry processing behavior is unchanged; this is not external exactly-once processing.

## Fidelity, isolation and release

All119 source pins,15 owner/reviewer/live dependency copies, prior110 sources,36 prior owner artifacts,41 current owner artifacts and all **1,799 prior reviewer files** plus the status addendum matched at the final pre-release check. Prior reviewer manifests retained their hashes. Original r3, reducer, oracle and SQL1–5 bytes in the retained pins remain unchanged. Receiver changes preserve the recorded preexisting dirty coverage bytes; the nearest test diff contains insertions only, retaining all original test lines/assertions.

The reviewer copied the storage and nearest test harnesses byte-identically and used fresh output paths. Additional R19 cases reside in a separate copied harness; inherited39 cases are filtered out there. The selected SQL6 and captured baseline are read from this review root. Original owner outputs and all previous review roots were untouched.

Private PG17 used fresh Unix sockets/TCP disabled, synthetic data/secrets and the network-denial setup. All test/compiler processes finished and clusters stopped/removed. No hosted request, production DDL, live ingestion, dispatch, replay, deployment, activation, stage/commit or branch operation occurred. The resolver checks captured bytes on load; execution traces confirm the captured flags/evidence-time modules and, for nearest cases, the separately hashed scheduler snapshot. The queue import is mocked. Broader forecast/native-goalie behavior was not rerun or accepted.

All119 source pins and15 snapshot holds were explicitly released to the owner after final rehash and before report-only writing. The owner acknowledged R19 and proposed a bounded v2 correction; v1 and this review remain frozen. Only this new review root is reviewer-owned; read-only dependencies retain their existing owners.

## Remaining acceptance gates

1. Close R19: protect the existing key before any attempted raw insert, preserve its exact preexisting row, and avoid accepting a postconflict mutated snapshot. Check the absent-key race against a caller-owned expected insert identity/clock rather than silently adopting another writer's changed row. Retain cooperative concurrent duplicate idempotency, uncertain-response recovery, held-variant/no-extra-processing behavior and the unchanged R19 oracle. The owner's proposed advisory-lock/skip-existing-insert correction and coordinated absent-key race test are pending a new frozen candidate; this review does not accept that design or implementation yet.
2. Reconcile exact deployed raw schemas, indexes/defaults/triggers, full ACL/RLS and competing-writer fences under separately authorized read-only bounds. Deferred commit-time/subsequent writers and hosted PostgREST behavior remain unaccepted. Task-local private fixtures are not deployed schema or privilege evidence.
3. Approve exact application manifest/commit, SQL6 membership/order, target environment and bounded natural-receipt rollout before any migration or flag change. SQL6's direct prerequisites are the existing raw tables/unique indexes. SQL1–5 retain separate gates; only the accepted replacement SQL5 may be selected, never both alternatives. No staged SQL was added to an active migration tree.
4. External sender/queue reliability, legacy/deferred atomicity, authentic source/identity/history/coverage, authenticated correction policy, genuine future labels/metrics and operational dispatch/replay/release approvals remain open. Historical225/227 assertions across50/52 rows and separate CR011/CR051 positives retain prior qualifications; this review grants no full52 or production acceptance.

Exact reviewer artifact hashes are in `review-artifacts-sha256.json`.

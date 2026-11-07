# IFTTT offline correction checkpoint

The integrated local **held/shadow** implementation remains accepted at v4. The additional **pure, unwired** occurrence candidate now also has bounded independent acceptance after R10–R13 repairs. Overall implementation/rollout and full 52-case acceptance remain open. No files were staged/committed and no full compiler/build was started in this increment.

## Exact accepted bytes and ownership

- Canonical checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; base HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. Existing unrelated dirty work preserved.
- V4 integrated runtime/tests/two locally staged migrations: `next-increment/owned-source-v4-sha256.json`, 41 paths, SHA256 `8a6e3b3c27cf60860b206a4dfd068dbc0aede9ceb76ea03b815e42ffc97ac958`. All pins still match. Independent held/shadow verdict: `review-v4/REVIEW.md`.
- New occurrence candidate and its runner/test dependencies: `occurrence-increment/owned-source-v2-sha256.json`, 49 paths including all 41 v4 paths, SHA256 `b113230355acae6cbc3c1c75bad94d6d56afa9d65b6061effed651d79c90789a`. Independent verdict: `review-occurrence-v2/REVIEW.md`. This does not amend v4 or the production release snapshot.
- Current new/changed implementation surface beyond v4: `web/lib/sources/tweetClaimOccurrenceIdentity.ts` and `.test.ts`; task-only `offline-completion/run-acceptance.ts`, `immutable-registry-audit.ts`; `occurrence-increment/immutable-registry-audit.test.ts` and its task config. The new runtime module is not imported by the pipeline. SQL, consumers, r3 registry/reducer and original oracle unchanged.
- Reviewer owns only review artifact directories. No other IFTTT implementation writer, running test/compiler or database process is known. Unrelated checkout writers are coordinated separately; this checkpoint does not audit or stop them. The short holds are released; accepted hashes are preserved in review snapshots. No further IFTTT source edit is planned before a new increment.

## Behavior and verification

The original integrated slice retains immutable observations, reviewed/canonical qualification state and held outbox through actual read/commit RPCs, global CAS and bounded recovery. Its reviewed R1–R9 repairs and real disposable-storage evidence remain tied to the v4 boundary. No new production sink or dispatcher is wired.

The new candidate allocates one canonical token for a proved provisional-to-verified occurrence while retaining native r3 IDs and immutable prior evidence. R10–R12 now hold overlapping changed extraction and changed text across receipts of one original, reject conflicting original identities, and validate exact input/document span endpoints. R13 replaces the runner's first-effect-only comparison with a complete per-step prior immutable-row audit, including rows retained before any effect exists.

Independent rerun: **37/37 focused tests passed** (15 identity, 16 audit, unchanged 6 reviewer regressions). Owner targeted strict TypeScript (pure source + audit module) and scoped source/test lint passed; aggregate checks were not run for this increment. An initial task-config startup assumption was corrected before the successful audit run; details in `occurrence-increment/owner-checks-v2.json`.

The unchanged 52-case oracle executes 43 pure cases: **41 passed, 2 failed; 194/196 assertions passed; 9 persistence cases deferred**. Exit remains 1. CR019's four assertions pass in the new pure composition with an actual allocated token and separately retained native IDs. An independent deliberately rewritten earlier pending interpretation and the owner's separate mutation control each produce immutable-row count 1 and fail the unchanged CR019 assertion, versus count 0 normally. Original rejected candidates, failures, baseline v4 output (40/43) and reviewer snapshots/logs remain preserved.

## Hosted metadata action: executed, guarded/incomplete

The first exact `schema-relations.sql` request to Supabase project `fyhftlxokyjtpndbkfse` was initially denied by automatic approval review. Scout subsequently supplied TJ's explicit approval, authorizing one exact retry. It ran and returned only `guard=size_or_column_limit`, `rowCount=20`, withheld candidate `dataBytes=34006`, `missingCount=5`; complete connector response 715 bytes. The payload guard prevents identifying the five missing objects or comparing columns/ACLs. **Query two was not attempted**, as required. No further retry or alternative read was performed. This is a known guarded result, not an uncertain database outcome or a continuing authorization denial. See `offline-completion/CATALOG-READ-RESULT.md`; original rejection retained separately. Normal provider read compute/logging may occur, but no application rows/function bodies/helpers/writes/activation were requested.

## Open checklist and next task

- [x] Preserve accepted v4 bytes and all earlier review evidence.
- [x] Correct R10–R13; exact new pins independently verified and released.
- [x] Keep unchanged oracle failures and negative control results explicit.
- [x] Complete the exact authorized metadata attempt and stop at its guard.
- [ ] **Evidence/product contract:** CR011/CR051 use one original ID/author/publication/receipt but different `tonight`/`tomorrow` whole-text versions. Are these independent clauses in one retained original or edits of one clause? Supply a retained full-document/disjoint-anchor or equivalent approved new-occurrence proof, or explicitly define the transition policy. Distinct game IDs alone are insufficient. The original assertions stay unchanged and failed. Exact question: `occurrence-increment/CROSS-TEXT-PROOF.md`.
- [ ] **Next local implementation:** persist/reload the reviewed occurrence ledger/allocator under the existing global context CAS, preserve all native/legacy aliases, join complete component effects/history, and prove actual hook/RPC restart/concurrency/ack-loss behavior. No dispatcher. Exact bounded plan: `occurrence-increment/DURABLE-INTEGRATION-GATE.md`. Pure acceptance does not satisfy this gate.
- [ ] Execute all nine exact persistence DSL contracts, including every CR037 variant, against disposable storage and coordinated consumer fixtures; prior related storage tests are not relabeled as those gates.
- [ ] Authentic source coverage/intake, dated identity and complete legacy/writer fencing, consumer receipts, genuine future cohort labels/metrics, and explicit operational approvals remain separate. Historical discovery data is not an untouched holdout.
- [ ] If object-level hosted metadata is still required, prepare/review a new smaller projection; the stopped package does not authorize a guard workaround.

No production DDL, migration publication, app-data/history acquisition, ingestion/replay, delivery, compensation, scheduler/flag/forecast activation, credentials, staging/commit/push/deployment or remote build occurred in this increment. Both SQL proposals remain outside the active migration tree. The release coordinator's captured v4 web bytes remain separate from new occurrence/task/review artifacts.

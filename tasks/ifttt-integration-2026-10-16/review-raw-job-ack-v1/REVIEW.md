# Independent raw job acknowledgment and captured compatibility review v1

Accepted within two precise local boundaries: the shared job helper's acknowledgment fix, and the captured dependency bytes' existing injury-out consumer/catalog-expiry slice. No new implementation defect was found. Source manifest SHA256 `2dfe05fa78cc65199002f0f7941a4b30ae4f6e1d136d7c7d506f28c801a5edc2` pins95 source/test/task-SQL files plus15 exact dependency snapshots. This verdict establishes no atomic raw receiver completion, server-clock lease guarantee, goalie-policy correctness or broad combined FORGE/RSO acceptance.

## Job acknowledgment

The unchanged ten private-PG cases pass. Six independent nearby cases also pass: uncertain claim with a replacement owner; uncertain claim with an expired same-owner lease; another owner's complete row; a different terminal failure stage; unavailable completion readback followed by exact same-object retry; and a missing job row. The uncertain-claim probes count one RPC only. Rejected terminal/missing-row cases preserve the retained row or absence and do not report successful completion. A later exact readback recovers committed completion and prevents a route catch from downgrading it.

The helper requires matching job key/owner/running status and an unexpired lease relative to its application timestamp, requests the matched row, and reconciles only the same owner's permitted terminal state. Failure readback additionally requires the requested stage. It retains its local lease while readback is unavailable and never issues a second claim after uncertain claim response. Existing flag, retry count/delay and mechanism remain intact.

The retained owner baseline reports2 pass/8 fail and the retained corrected run10 pass; those archived results were inspected and preserved. This review independently executed the current ten and six nearby cases, not the old helper version. The two affected route files pass41 cases. AST comparison preserves all129 original route assertion expressions; changes to that prior85 pin are matched-row job mocks only. Existing claim/occurrence/consumer runtime and all four staged SQL files are unchanged; this previously unpinned shared job import is now explicitly pinned and changed.

## Captured dependencies and exact fidelity

All26 native consumer cases and8 copied expiry cases pass. AST/source comparison preserves all24 consumer case bodies (26 parameterized cases), both owner expiry case bodies and game/source fixture objects byte-for-byte. Reviewer harness copies are byte-identical. The consumer still passes the nine unchanged original CR042–044 assertions within its previously reviewed native consumer/outbox boundary.

Independent config uses the same relative and lib/ import resolution logic, redirected to this review's byte-identical snapshots. It verifies file hashes on load and adds observational runtime markers without altering snapshot files or test bodies. Runtime traces prove all10 captured TypeScript module bodies execute in the consumer suite, with exact manifest hashes; expiry cases execute captured contributions and evidenceTime. The other5 captured dependencies are actual SQL inputs read from the copied snapshot directory. All15 files remain exact. This is execution evidence, beyond a list of resolved import paths. See `captured-execution-audit.json`, `resolved-loaded-dependencies.json` and `execution-traces/`.

A provenance discrepancy was found and corrected by the owner in a separate preserved addendum: the initial prose named af6bb..., but frozen manifests/snapshots/integrity and actual execution identify contributions SHA256 `1f08b1c5ca9ea296826d899f7e57c02f2262c4c4102c11ba925a64f7e703bae6`. The snapshot and current live file match this value. Compared with the earlier accepted282c... bytes, it contains catalog expiry changes plus the owner's native-goalie-appearance-summary-win-rates-v1 admission-policy addition. The34 compatibility cases do not verify that goalie policy. Its correctness, goal-owner acknowledgment and wider combined-runtime acceptance remain with that owner; no reply is inferred from failed read-thread attempts. Original erroneous prose and the corrected addendum remain preserved; no frozen evidence was silently rewritten.

## Checks and integrity

All91 distinct scoped cases pass:10 original job,6 nearby job,26 consumer,8 expiry and41 affected route cases. Of these,41 use actual disposable PostgreSQL and50 are unit/default-off cases. Scoped TypeScript passes, exit0. No full compiler/build or broad FORGE suite ran. Job tests use the retained actual table/claim-function definitions; compatibility uses captured native SQL, real capture/queue/receipt behavior and fresh private schemas. Network-denial setup is active, TCP disabled, Unix sockets private; every cluster stopped and was removed.

All95 source pins,15 owner snapshots and review snapshot copies, and52 owner artifacts match before/after. All1176 earlier reviewer files plus status addendum remain unchanged. All15 live dependencies also matched the captured bytes at final readback; acceptance is tied to those captured hashes, not future changes to owner paths. Prior original oracle, approved game fixtures, results and assertions are intact. The historical225/227 heterogeneous ledger remains unchanged; this does not rescore originals CR011/CR051 or turn their separate positives into original full52 passes.

## Explicit remaining gates

Raw processing_status, evidence/scope commits, native consumer receipts and job completion remain separate transactions. Process death between raw status and job completion still needs durable reconciliation. WeakMap ownership is local to event objects and process state; these tests do not provide process-restart atomic receiver completion or external queue exactly-once behavior.

The settlement predicate uses application time rather than database server time. Atomic owner replacement is fenced, but clock-skew-safe lease expiry requires a separate server-side contract. Production service-role grants, other writers, real history/retention/fencing, exact schema/ACL, raw receiver/external queue acknowledgment, authentic future capture/labels/metrics and operational approvals remain open.

The owner's unactivated shadow-raw-ack-draft SQL outside95 pins was not read or reviewed and has no acceptance from this checkpoint. No raw-status/job atomic SQL, new caller, receiver activation, production DDL, ingestion/dispatch/replay, scheduler/cohort/flag activation, forecast publication, push or deployment is authorized. Goal-owner coordination success is not goal-owner acceptance.

## Release and reproduction

All95 source and15 snapshot review holds are released after final rehash. This artifact root is frozen for combined verification, with exact hashes in `review-artifacts-sha256.json`; prior roots remain frozen. Only this new root was written; no implementation/shared test/SQL edits, staging or commits occurred. No review test/compiler or private PG remains active. No hosted action occurred.

From web/, set IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin and run copied raw-job-ack.test.ts using vitest.review.config.mjs; nearby-job.test.ts with -t nearby; consumer-binding.test.ts plus expiry-compatibility.test.ts using vitest.compatibility.config.mjs. Route tests use vitest.routes.config.mjs and the two exact affected web test paths. Each log/JSON is retained. Run fidelity-audit.cjs from web/ to reproduce AST comparisons; scoped compiler project is this review root's tsconfig.json. The compatibility transform adds only runtime observation; captured bytes and original assertions remain unchanged.

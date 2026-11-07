# Independent review: R18 postcondition correction

**Accepted for the bounded local shadow raw/job transaction. R18 is closed.** No new implementation defect was found in this review. This does not accept deferred commit-time writers, production activation, full52 integration or future performance.

Reviewed source manifest: `../shadow-raw-ack-postconditions-v2/owned-source-v2-sha256.json`, 110 files, SHA256 `bbff39c42f357166a8714f0a087029bfc2aa6397b4c8989161bd1ad067d20717`, plus 15 captured read-only dependencies. Selected replacement SQL5: `../shadow-raw-ack-postconditions-v2/20261016073503_tweet_claim_shadow_raw_ack.sql`, SHA256 `be0d24b025d1b83d294b0f20c7cca40510b5ef6c712a2ad71586ad1c754df59d`. The old and replacement SQL5 are alternatives: select the replacement only in any future separately approved migration package; never apply both.

## Why R18 is closed

The rejected SQL5 built and returned a receipt before checking actual post-trigger stored rows. The replacement retains the complete locked raw/job rows, computes exact expected completion rows, performs both updates, reads both stored rows after both writes, rejects any whole-row mismatch inside the transaction, and returns the actual stored job acknowledgment. The original server-clock owner/lease check remains on the final job update. SQL1–4 and all runtime files remain unchanged from the 103-file checkpoint.

The three unchanged reviewer reproductions now reject and roll settlement back: a one-microsecond raw receipt-clock rewrite, a final job trigger dropping the acknowledgment, and the same raw-clock fault through actual `processTweetClaimShadowBatch` extraction/context/qualification/commit/settlement. Fresh readbacks show raw `pending`, job `running`, no certified receipt and unchanged attempt count. The actual hook retains its earlier immutable observations; the failed settlement does not claim delivery. Original failing v1 evidence remains unchanged.

Whole-row assertions also verify rollback on raw identity, attribution, marker and status rewrites; job receipt, owner, lease and attempt rewrites; and a nondeferred job AFTER-trigger changing the already-updated raw clock. Removing the fault allows one safe successful settlement and an identical idempotent receipt; retained job metadata and observations survive.

Four independent additional cases verify extra retained raw/job columns and AFTER-trigger deletion of either row. Each checks complete raw/job rollback and immutable observation inventory, removes the trigger, settles safely, reads the exact persisted receipt, retries identically with attempt count one and confirms no outbox dispatch. This supports the complete-row comparison, rather than only checking fields named in the receipt.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Byte-identical copied reviewer integration plus unchanged reviewer SQL prefix and ten owner controls | 54/54 pass: 53 actual private-PG cases and one default-off case | `unchanged54-results.json`, `unchanged54.log` |
| Four independent complete-row rollback/recovery cases | Four distinct passes after fixture repair | `independent-results.json`, `independent-deletion-corrected-results.json`, matching logs and `evidence/independent-*.json` |
| Scoped TypeScript, including the independent test harness | Exit 0 | `scoped-tsc.log`, `tsconfig.json` |
| Source/snapshot/owner/prior-review integrity | All matching at final pre-release check | `pin-check-before.json`, `pin-check-after.json`, `fidelity-integrity.json` |

Total: **58 distinct passing cases, 57 using actual disposable Postgres and one default-off case.** Forty inherited SQL tests were filtered out in the added-probe run; they are not additional passes. The corrected deletion-only rerun filtered 42 cases out. No broad81, route/nearest-source rerun, aggregate compiler, build, browser or hosted action was performed.

The initial extra-probe run had two passes and two reviewer-fixture failures: the minimal fixture granted no DELETE privilege, so its deletion triggers failed before the intended postcondition check. Original failed logs, JSON and harness bytes are preserved. Only the two deletion fault fixtures received explicit disposable DELETE grants, and only those two were rerun. These were fixture setup failures, not product defects or claims about deployed DELETE permissions. No source/SQL was changed to make them pass. Scoped TypeScript passed before the subsequent fixture-only SQL grant strings were added; no TypeScript structure changed afterward.

## Fidelity and isolation

The reviewer integration is byte-identical to the prior immutable `nearby-integration.test.ts`; the SQL harness retains the complete prior reviewer prefix and assertions unchanged. The final copied owner harnesses are byte-identical to the frozen candidate. The independently added file retains all original SQL test bodies and filters them out while running its four additions. The selected SQL5 is read from this review root; SQL1–3 and prerequisite raw/job schemas are the retained inputs. Only this selected SQL5 was installed in each fresh schema.

Tests used fresh private Postgres 17 Unix sockets, TCP disabled, network-denial setup and fresh output paths. All clusters stopped and were removed; test/compiler processes finished. The copied dependency resolver verifies captured bytes and maps imports to reviewer snapshots. Runtime execution traces confirm this narrow hook suite executed captured `web/lib/projections/evidenceTime.ts`; the SQL-only suites executed no captured TypeScript modules. This does not claim a fresh execution of the earlier ten-module native-consumer compatibility suite or owner goalie-policy verification. Captured `contributions.ts` remains the accepted `1f08b1c5ca9ea296826d899f7e57c02f2262c4c4102c11ba925a64f7e703bae6` dependency slice.

The final pre-release check verified all 110 current source pins and review copies, 15 owner/reviewer/live dependency copies, prior 103 source pins, 69 old owner artifacts, 36 new owner artifacts and all **1,600 prior reviewer files** plus the status addendum. The 13 prior reviewer manifests also retained their hashes. All original reducer/r3/oracle bytes within these pins remain unchanged. Reviewer writes are confined to this new review root; no shared source/test/SQL, prior evidence, stage/commit or branch operation was modified.

## Accepted boundary and remaining gates

Accepted: local, explicit shadow-only raw processed status and persisted same-owner job acknowledgment commit atomically for the two allowlisted raw tables, with complete observed stored-row postconditions checked before RPC return, rollback on the exercised immediate trigger faults, exact identity/clock/evidence checks, bounded lease handling, concurrency/idempotency and read-only lost-reply recovery. The earlier narrower reviewed boundaries retain their qualifications.

Still open:

- Deferred commit-time triggers, later caller statements and subsequent direct service writers were not accepted. Deployed schema, triggers, RLS/ACL and all-writer inventories/fences must be reconciled before activation. Whole-row checks conservatively hold on incompatible immediate triggers; they do not establish a universal writer fence.
- The future approved migration package needs exact prerequisite membership and explicit registry→qualification→occurrence→consumer→selected replacement SQL5 order. Task timestamps are not migration order. No SQL was applied to production or an active migration tree.
- HTTP raw receiver/external queue durability, legacy/deferred separate-write atomicity, authentic identity/history/fence evidence, genuine future evaluation and operational approvals remain open. No dispatch, replay, deployment, scheduler or source ingestion was activated.
- The historical heterogeneous ledger remains 225/227 assertions over 50/52 original rows. Original ambiguous CR011/CR051 failures and separately approved positives retain their prior meaning; this is no full52 integrated acceptance.

All 110 source pins and 15 snapshot holds were explicitly released to the owner after final rehash and before report-only writing. Read-only live dependency ownership remains with its existing owners. This review root is now frozen for combined verification; exact hashes are in `review-artifacts-sha256.json`.

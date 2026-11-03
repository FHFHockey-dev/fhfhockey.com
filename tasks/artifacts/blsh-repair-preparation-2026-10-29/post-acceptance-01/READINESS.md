# WGO v4 acceptance verified; execution preparation

Recorded 2026-10-29T15:00:36Z. This is a non-executing preparation record. No production connection, setup, repair, review retry or journal creation ran here. Frozen repair/setup/review artifacts remain unchanged.

## Acceptance gate satisfied for the exact packet

TJ's retry completed in “Review WGO repair evidence”, thread `01a17f0c-f75e-73ac-a6d3-f22a2deab0d4`, turn `01a18825-fb51-7454-a964-2ad436b20cdd`, without a turn error. Its final result independently accepts revision 4. The earlier failed turn remains historical evidence; it is no longer an unresolved acceptance gate for this exact packet. This records the completed result, not a general access entitlement or permission for additional retries.

Acceptance: `/Users/tim/Documents/Codex/2026-10-27/task-4/writer-review-04/ACCEPTANCE.json`, SHA-256 `8d546991dd598debe52f8056ee49df27ded4420b2cade74631904e16bf0e332a`.

| Bound material | Verified value |
| --- | --- |
| Repair bundle | `bad5cc54735e4fe402c555020c196820c0a3b6f0bc1ebd9af9a779902882f7a0` |
| Setup bundle | `2081c15fc56985c9aef37a03d0a780c00ac65ac29079972654d75ac11de3454d` |
| Actual setup SQL | `1e9839908f96559de91b07c7913a66eb10b190f6309aa77895b421dd0c43a332` |
| Repair scope | `80344c56cd127b4d7de32707dd61347027130af07a2f8c619d4d5b970cd63c27` |
| Expected post-setup profile | `e753b762acb3b1485389c74ec3197f71a8b1c7857eb0b053d3de51c652e583cf` |
| Independent report | `75a5f5c755a96c710e88b0ccd450af0042c6e0e93aa8e414f93f7990ec1b21b6` |
| Native result index | `d86e2a1b86586156e82262ebff9e9721df46828080a865fdddac56bad7125ab0` |

Both runtime bundles were independently recomputed from their pinned files; all 98 frozen receipt file hashes/sizes still match. The report and native result checksums match the acceptance. The retained result records PostgreSQL 15.19, 32 passed/0 failed, stopped server and no production connections. These checks verified retained results; they did not rerun native tests.

The acceptance includes the exact setup SQL and preserves its documented trust boundary. It is not evidence that production setup, fresh production qualification or a repair occurred. Existing repair/setup authorization stands; no repeat permission request is needed merely because this preparation record is new.

## Packet reference reconciliation

The frozen v4 directory is `/Users/tim/Documents/Codex/2026-10-27/task-3/row-repair-01/canonical-writer-04/`.

1. **Setup hash corrected in a separate reference document.** `EXECUTION-BOUNDS.reference-only.json` beside this file copies the frozen bounds and changes only `setupSQLSHA256` from `66650c6e097debadf7696d190b2238cde0c8907acd2c9c1428f3894867a3e82b` to the accepted actual SQL hash `1e9839908f96559de91b07c7913a66eb10b190f6309aa77895b421dd0c43a332`. Original bounds, SQL, setup scope and source pins remain unchanged. This correction does not change either runtime bundle or expand scope. It is not an executable grant.
2. **Journal choice remains an owner decision.** Both original grant templates point to `canonical-writer-03/live-journal`. The engine enforces equality with the approved grant's root, so the version label alone is not a runtime defect. The existing checklist proposes a separate root `/Users/tim/Documents/Codex/2026-10-27/task-3/row-repair-01/live-execution-v4-01/journal`; this preparation does not approve, reserve or create it. The owner must explicitly choose the root and bind trial/full grants and execution configuration consistently, preserving all earlier attempts. Do not request a new adversarial review merely for this bookkeeping decision if the accepted runtime remains unchanged.
3. **Historical templates remain historical.** Do not edit `REVIEW.template.json` into acceptance, or mutate the frozen final receipt. The actual independent `ACCEPTANCE.json` supplies the review evidence. Later real grant/session/window records must cite it and bind their actual facts. A corrected bounds reference does not authorize filling pending flags or expiry values.

This record supersedes the current-status statements about a still-blocked review in `../REFERENCE-CORRECTION-CHECKLIST.md`; that earlier checklist is retained unchanged. Its exact stale-reference locations and preservation requirements remain applicable.

## Writer window remains unconfirmed

The latest checked mailbox still ends at Claude-125 and Codex's qualified Yahoo-health receipt. The latter explicitly preserves the historical WGO hold and states that no writer-free repair window is certified. The known owner acknowledgement at `/Users/tim/Documents/Codex/2026-10-27/task/wgo-coordination-20261028-01/OWNER-ACKNOWLEDGEMENT.json` still binds v3, has `windowConfirmed=false`, `noOverlappingWriters=false`, `nullOverwriteProtectionReviewed=false`, `expiresEpoch=0`, and an expired October 28 proposal.

That receipt's review-blocked text is now stale history; its absent global window is still a factual blocker. Its owner-lane hold does not certify other ingestion, manual or generic-runner writers. The canonical local WGO owner retains custody; no source transfer, scheduler change or broader hold is inferred.

## Concrete next steps

1. Existing ingestion/cross-owner coordinator returns a fresh owner-authored receipt naming the accepted v4 hash/scope, current deployed ingestion revision, exact dates, actual known-writer coverage and preservation holds, earliest feasible finite UTC window and expiry. Unknown caller coverage must stay explicit. Do not auto-activate a proposed time.
2. Existing execution owner chooses the journal root and prepares actual grant/session records citing existing applicable authority, the independent acceptance and the confirmed window. No real grant is produced here. Preserve before-images and every existing attempt; do not move or overwrite journals.
3. During the confirmed window, under actual action/session authority, perform fresh bounded catalog/session/active-writer/exact-row checks. Historical snapshots do not certify current state. Stop on drift or unresolved overlap; preserve unrelated ingestion.
4. If those checks pass, the already-authorized execution sequence is exact private audit setup, actual-profile verification, one-row/six-assignment pilot (`source5587455`, `game2026020061`), exact postcommit readback, then invocations of at most five new games while every gate remains valid. This preparation does not dispatch that sequence.
5. Stop on expiry, failure, drift or uncertain commit. Reconcile uncertain outcomes through the accepted separate read-only path; do not blindly retry or automatically compensate. The ceiling remains 1,463 rows/184 games; the 116 newer rows and two populated controls remain excluded.

Owner coordination, journal-location acknowledgement, real-record preparation and retained-evidence comparisons can proceed safely. No forecast completion, new provider collection, source patch, deployment or repeat review is required by this bookkeeping work. Production execution remains outside this task.

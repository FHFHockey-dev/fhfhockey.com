# WGO v4 reference correction checklist

Status: preparation only, 2026-10-29. Nothing in this checklist authorizes execution or establishes review acceptance. Original artifacts remain frozen. Paths below are relative to `/Users/tim/Documents/Codex/2026-10-27/task-3/row-repair-01/canonical-writer-04/` unless absolute.

## Verified baseline

- Repair runtime bundle: `bad5cc54735e4fe402c555020c196820c0a3b6f0bc1ebd9af9a779902882f7a0`.
- Setup runtime bundle: `2081c15fc56985c9aef37a03d0a780c00ac65ac29079972654d75ac11de3454d`.
- Scope: `80344c56cd127b4d7de32707dd61347027130af07a2f8c619d4d5b970cd63c27`; 1,463 rows, six fields, 8,778 assignments, 184 games, maximum five new games per invocation.
- Actual `AUDIT-SETUP.sql`: 112,402 bytes, SHA-256 `1e9839908f96559de91b07c7913a66eb10b190f6309aa77895b421dd0c43a332`. `SETUP-SCOPE.json:9`, `SOURCE-PINS.json:21` and `INTERIM-STATUS.json:6` already agree with this value.

## Exact reference corrections for an owner-prepared successor packet

These are unperformed changes. Make a separate successor preparation packet with its own manifest and provenance if the owner proceeds; do not rewrite or rehash the original packet as though its historical contents had always been different.

| Reference | Observed value | Required correction or decision |
| --- | --- | --- |
| `EXECUTION-BOUNDS.json:29`, `setupSQLSHA256` | `66650c6e097debadf7696d190b2238cde0c8907acd2c9c1428f3894867a3e82b` | In the successor bounds document, replace with the actual v4 SQL SHA-256: `1e9839908f96559de91b07c7913a66eb10b190f6309aa77895b421dd0c43a332`. Retain `AUDIT-SETUP.sql` unchanged. |
| `TRIAL-GRANT.template.json:32`, `journalRoot` | `/Users/tim/Documents/Codex/2026-10-27/task-3/row-repair-01/canonical-writer-03/live-journal` | Obtain the owner’s explicit journal-location decision and use the same approved absolute root in the new trial grant and its execution configuration. Proposed separate root: `/Users/tim/Documents/Codex/2026-10-27/task-3/row-repair-01/live-execution-v4-01/journal`. This proposal is not a reservation or approval. |
| `FULL-GRANT.template.json:2043`, `journalRoot` | The same v3 root | If the proposed separate root is accepted, replace with that exact root in the new full-grant template too. Preserve all prior journals; do not move, merge, clear or reuse recorded attempts. |

The journal reference is a version/location inconsistency requiring an owner decision, not proof that the writer would reject the v3 path. The guard binds execution to the actual grant’s root. Both the old v3 root and proposed separate root were absent at this local inspection; absence does not establish exclusive ownership or authorize creating either directory. Intentional retention of the v3 root would require explicit owner confirmation and provenance rather than an unexplained template carryover.

## Binding and consistency checks before a future packet can be used

- [ ] Owner records the selected journal root and custody without transferring source ownership. Keep the new execution area separate from frozen source and review evidence.
- [ ] For the proposed root, the apply journal for the one-row pilot would resolve to `/Users/tim/Documents/Codex/2026-10-27/task-3/row-repair-01/live-execution-v4-01/journal/80344c56cd127b4d7de32707dd61347027130af07a2f8c619d4d5b970cd63c27/apply/2026020061`. Confirm this agrees exactly with the later execution configuration; do not create it now.
- [ ] Preserve the `journalRoot / scopeHash / action / game_id` relationship enforced by `engine.py:140`. Existing journal events require reconciliation rather than another attempt. The retained older implementation also checks this relationship in `invariants_v2.py:144`.
- [ ] Reconcile successor bounds, setup scope and source pins against the actual retained SQL bytes; record checksums of the changed configuration documents in a new manifest. Do not change runtime bundle hashes merely because a document changed; recompute their defined material if runtime changes are proposed.
- [ ] Return any successor packet for the required permitted review of its exact repair/setup/configuration evidence. A corrected hash or path is not acceptance, and this checklist is not a substitute review.
- [ ] Keep templates visibly pending. Do not fill `triggersReviewed`, `ACCEPTED`, `sessionAccessAuthorityRef`, a future expiry or confirmed coordination from assumptions. Those values require actual corresponding authority and evidence.

## Safe preparation that may proceed

Owners can acknowledge the journal-location decision, prepare an additive correction packet, compare retained bytes and manifests, and inventory known overlapping ingestion/manual writers using existing local records. The ingestion coordinator can collect owner-authored holds and propose a finite window without disabling schedules or starting jobs. An unconfirmed or expired proposal is never an execution window.

Prepare the action-time checklist and stopping conditions without opening a database session: current deployed revision; fresh bounded catalog, session and exact-row checks; setup/profile verification; source `5587455` in game `2026020061` as the six-assignment pilot; readback; then at most five new games per invocation while every gate remains valid. Stop on drift, expiry, failure or uncertain commit; retain separate read-only reconciliation requirements. No forecasts or new provider collection are needed to prepare these steps.

No journal directory, executable grant, hosted object or database session is created by this checklist. Do not run the blocked review, choose a substitute reviewer/writer, manually apply the SQL, or change acceptance guards as a way around the failure.

## Unresolved control and execution gates

The original independent-review turn `01a17fe2-1667-7565-9924-8f82522eb6d6` in “Review WGO repair evidence” (`01a17f0c-f75e-73ac-a6d3-f22a2deab0d4`) failed on October 28 at 00:22:11 UTC with a platform cybersecurity flag. It did not produce v4 acceptance. Its stated access route is an organization [Daybreak application](https://platform.openai.com/settings/organization/status-and-access) before retrying; granted access or another approved resolution is not evidenced. TJ reports no Daybreak access. Task authorization remains distinct from system clearance.

`engine.py:138` requires live `review.state=ACCEPTED` with matching candidate/profile/scope. That condition remains unresolved even though the blocked action was a review rather than a production write. Setup acceptance is also still pending.

The retained ingestion acknowledgement names the older v3 candidate and has `windowConfirmed=false`, `noOverlappingWriters=false`, `expiresEpoch=0`. It does not establish a current writer window. The owner-lane historical-refill hold is not a global hold. Fresh owner confirmation, preservation coverage, real session authority and action-time qualification remain necessary before any setup or repair.

## Preserved source-document fingerprints

These identify the unmodified documents this checklist describes; they are not replacement approval receipts.

| Document | SHA-256 |
| --- | --- |
| `EXECUTION-BOUNDS.json` | `c790d5eba2516e1bac751758c136f82f18540080af43c7f71fc63ce563264467` |
| `TRIAL-GRANT.template.json` | `a46daa00c3ba6fb4a4421fe55c0fc0c4cffc38dd24eab59ef09c01551d87530b` |
| `FULL-GRANT.template.json` | `961caee52e2db817680f947f5446e19ea37556159857303d5e8eb7de572b0105` |
| `SOURCE-PINS.json` | `daffe7e2fc2fb9b177da074a5391ce504e87855266848d0840caf5b57ff1419f` |
| `FINAL-RECEIPT.json` | `cabbe5ba44c96cc85c4ff88aed664efbbc65eac981442da82a8da71016b288aa` |

# Three-key metadata repair: concrete authorization summary

**Execution update:** TJ subsequently authorized step 2 after the explicit DB handoff. The unchanged candidate committed and exact-key readback passed on November 12 at 2:42 p.m. America/New_York. See [PRODUCTION-RECEIPT.md](PRODUCTION-RECEIPT.md). The preparation status below is retained as historical review evidence.

Prepared 2026-11-12T18:13Z on `octoberBranch`, HEAD `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`. **Prepared and locally verified; not authorized or ready for production execution. No production write was attempted.** This summary supersedes the earlier verification/readiness status in [REPAIR.md](REPAIR.md); that file preserves the original investigation record.

## Exact operation

Target: existing `fhfhockey.com` Supabase project **`fyhftlxokyjtpndbkfse`**, production, one serializable transaction. Three source rows and three existing external-identity rows:

| Yahoo source primary key | Player | External identity UUID | FHFH / NHL IDs |
| --- | --- | --- | --- |
| `453.p.30000` | Nikita Nesterenko | `511c1028-0302-4a98-b1e8-7abe418b7e13` | 8946 / 8481754 |
| `453.p.30024` | Frank Nazar | `2886fafe-fba8-48b3-acf8-8ca124e52a92` | 10423 / 8483493 |
| `453.p.30111` | Devon Levi | `94628264-f0b2-452d-b5b7-177b1325098c` | 10251 / 8482221 |

Each `public.yahoo_players.season` changes from null to **2024**. Each `public.fhfh_player_external_identities.season_id` changes from null to **20242025**, and `context_key` changes from `yahoo:game:453:season:unknown` to `yahoo:game:453:season:2024`. Append the exact `season_metadata_repair` provenance object in the pinned SQL. Its existing trigger sets external `updated_at` normally. These are the only six persistent rows changed; the script also uses a temporary manifest table.

Source names, player/game IDs, source freshness timestamps, NHL/FHFH identity links, canonical verification, original approval fields/provenance and current-season records stay intact. No identity creation, re-matching, status promotion, ownership-history change, permanent schema change, provider call, forecast or application deployment is included.

## Why these rows are justified

[REPAIR-EVIDENCE.json](REPAIR-EVIDENCE.json) captures already-verified external and unmerged canonical identities, approved exact-name provenance from July 15 and matching newer seasonal keys. The stored Yahoo game catalogue independently binds game/key 453 to season 2024; canonical season 20242025 exists. The newer keys corroborate the identities, not the historical season. At `17:55:21.674214Z`, the current identity reader admitted none of the three because it requires non-null season IDs. The captured target-season conflict checks found none.

This classifies three specific seasonal source rows. The saved top-20 capture predates the deployed mapping fix, and the old **2,065** unmapped figure is not a current census. Neither the causes of the other rows nor any new global total are established.

## Frozen candidate and proof

| File | SHA-256 |
| --- | --- |
| [repair-season-metadata.sql](repair-season-metadata.sql) | `99a528b95429e64123e276351240db8ca730da7abcb2440883911c1e15a8f10f` |
| [post-repair-check.sql](post-repair-check.sql) | `9544dfa2fc23c965b9eab3ec06e2d8c80e81340774662c14252abc13b43a581f` |
| [verify-season-repair.py](verify-season-repair.py) | `476ecbe38a9247fe3d2af60910f9f39b8426d33bd8c4f05f45db7d3d76494f3a` |
| REPAIR-EVIDENCE.json | `1519a4123fed3cda925c8a0f71b115c4b6ec475ec4838e6ddd9748403aca56d6` |
| [READINESS-EVIDENCE.json](READINESS-EVIDENCE.json) | `e334b775d979f8b504eb92e429055bafd35c09fae3a5c0a04510d69ac81641be` |

The lead's final fixture run passed **23 scenarios** in disposable PostgreSQL 15.19 over a temporary Unix socket, with TCP disabled. It covers default rollback, exact six-row commit, no-op repetition, fourteen precondition refusals with intended error messages, late-reader failure rollback, competing target-row lock timeout and four readback states (unrepaired, repaired, damaged marker, duplicate mapping). The temporary cluster was stopped/deleted. The earlier API file remains **44/44 passed**, with scoped ESLint passed; its unchanged results were reused. No build was run.

[INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md) found no high-severity incorrect identity, season, row-scope or transaction defect. Its follow-up independently checked the current hashes and tightened assertions/readback. The reviewer's own fixture execution was **blocked by sandbox shared-memory restrictions before server startup**, not passed; the lead's run passed with approved local escalation. Serialization/new-writer races and uncertain COMMIT transport outcomes remain untested. The fixture is not a complete production schema/RLS or performance replica.

## Concurrency, triggers and failure handling

The script locks the six targets for update and relevant canonical/catalogue/season rows for share; it checks captured values, uniqueness conflicts and row counts, then requires all three expected identities to pass the deployed identity reader. Limits are **3 seconds per statement**, **1 second waiting for locks**, and **10 seconds idle in transaction**. These are not a promised total wall-clock duration. Work beginning after the activity guard is possible; row locks and SERIALIZABLE do not reserve the whole database or prevent later writers.

Fresh metadata at 18:05–18:06Z found no source-table triggers or rewrite rules, and only immediate foreign-key checks plus an external-identity timestamp trigger whose complete body sets `NEW.updated_at`. No trigger-driven downstream writes were found. Both target tables use RLS; execution requires an existing appropriately privileged operator with full target/activity visibility. No account, policy or credential changes are authorized. Re-review metadata if the schema/candidate changes before execution.

An error aborts the transaction. **Default ROLLBACK mode still executes updates and triggers, so it is also a production write attempt and must not be used as an unapproved rehearsal.** The explicit `psql -v commit_repair=1` switch enables commit. Capture the COMMIT acknowledgment separately from the script's precommit SELECT output.

All three already-completed targets yield zero updates; a partial/mixed cohort aborts. The no-op path checks the repair ID, not every provenance field; the dedicated readback audits the full object. After an error, disconnect or uncertain outcome, reconcile the exact targets before any retry. Do not automatically retry or reverse. A post-commit reversal requires fresh guarded before/after evidence and separately reviewed/authorized compensating SQL; preserve later data and normal timestamp auditing. No reversal script has been prepared or executed.

## Operational gate and bounded execution budget

The `18:05:32.942749Z` activity snapshot showed zero active clients, long queries, IO/lock waits or normalization queries. Phase C then logged a successful game at **18:05:35Z**, demonstrating that this quiet instant was not clearance. A final local log check found successful game **2026020263 at 18:13:03Z** (3.0 seconds, probe 0.41 seconds); Phase C remained ongoing. The Chef diary still records approved game-159 recovery **after Phase C**, with no completion/handoff receipt. No further remote polling was performed.

Before execution, the parent must obtain an explicit Phase C and overlapping recovery completion/handoff, reserve this operation with their owner, and obtain current-task authorization for the exact candidate. A fresh quiet activity check is an additional gate, never a substitute for that coordination.

Once those gates are satisfied, the proposed budget is sequential, concurrency one:

1. **One read-only activity check** with a 3-second statement timeout. Stop for normalization activity, long/blocked clients, incomplete coordination or target/schema drift. Use existing operator access and verify the project before connecting.
2. **One execution of the pinned psql file** with explicit commit enabled. No bulk extension or blind retry. The file contains psql meta-commands and must not be pasted unchanged into a SQL-only connector.
3. **One read-only execution of the pinned postcheck**, after acknowledged commit or to reconcile an uncertain outcome. Success is exactly the three expected keys with all five booleans true, covering source state, canonical/external IDs, complete approval/repair provenance, one correct current-view mapping per key and one external owner per key. Stop once conclusive. A command exit of zero alone is insufficient; any false/missing value or query error requires reconciliation.

The postcheck avoids ownership history, HTTP requests and broad counts. Its mapping LIMIT bounds returned rows, not guaranteed underlying scan work; the 3-second timeout is the execution bound. No automatic retry is budgeted. No production success or new aggregate count may be claimed from local fixtures.

Suggested authorization for the parent to present once scheduling is concrete:

> Authorize one committed execution of `repair-season-metadata.sql`, SHA-256 `99a528b95429e64123e276351240db8ca730da7abcb2440883911c1e15a8f10f`, against production project `fyhftlxokyjtpndbkfse`, changing only the six listed metadata rows with the documented timestamp trigger effect. Execute only after the Phase C/recovery owner has handed off the database window, with one bounded activity check and one exact-key readback. Stop on drift, contention, error or uncertainty; no automatic retry, reversal, additional cohort, migration, provider execution or deployment.

This text is a proposed scope, **not authorization already received**. The parent explicitly prohibits production writes in the current delegation.

## Accounting and handoff

Investigation/review used **11 read-only SQL tool calls** total (8 earlier evidence calls, 3 readiness/schema calls), all with 3-second statement caps. No production writes, migrations, deployments or provider/application requests were made. Local repair/test files remain uncommitted; unrelated shared edits were preserved. The exact next action belongs to the parent: secure the operational handoff and explicit approval for this pinned six-row candidate. Further classification needs separately bounded evidence and must not silently expand this pilot.

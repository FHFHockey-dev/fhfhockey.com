# Raw job acknowledgment checkpoint

Local candidate only; independent review is pending. No deployment, database mutation outside disposable storage, scheduler/flag change, ingestion or dispatch occurred.

Owned application change: `web/lib/sources/tweetProcessingJobs.ts`. The existing interpretation flag still controls job claims. Claim reply loss is reconciled once against the exact randomly generated owner; no second claim is sent. Completion/failure writes require the retained owner, running status and an unexpired lease relative to the application clock, and request the matched row. A missing row is not success. Lost settlement replies require an exact retained terminal state for this owner. A route catch cannot downgrade committed completion to failure. Unavailable readback stays an error; the local lease is retained until acknowledgment is established. Existing retry count and delay policy are unchanged.

The nearest route test `web/__tests__/pages/api/v1/db/update-line-sources.test.ts` changes only its three job mocks to return matched rows. Original assertions remain intact. `evidence/route-mock.diff` isolates this increment from the pre-existing dirty file. No API route, forecast consumer or SQL source changed.

## Checks

- Same ten actual private-PG fault tests before/after: **2 pass / 8 fail → 10 pass / 0 fail**. Original failing JSON/log and original helper bytes retained under `evidence/`.
- Both affected route files: **41/41 pass** after mock repair. Initial post-change run **34 pass / 7 fail** exposed insufficient mocks; its log remains retained.
- Scoped TypeScript: pass, exit 0. Focused helper ESLint: pass, exit 0. No aggregate compiler, build or full suite was run.
- PG17 used a fresh private schema per case, service-role access, actual retained job table/claim-function definitions, Unix sockets and TCP disabled. Network-denial setup was inherited from the existing review config. The cluster was stopped and removed after each suite.

## Remaining boundary

This fixes **job acknowledgment**, not atomic raw receiver completion. The routes and shadow hook still write raw `processing_status` before finishing the job, and raw status, scope commits, native consumer receipts and job completion are separate transactions. Process death between those writes remains an explicit reconciliation gap. In particular, the earlier shadow test with `pendingEvents: []` never established job recovery. There is no external queue exactly-once claim.

The expiry predicate uses the application's timestamp, not a database-side server-clock settlement function. Owner replacement is fenced atomically by the update predicate. Clock-skew-safe server lease expiry is a separate requirement before stronger lease guarantees. Current service-role table privileges and other writers also remain a production fencing/ACL gate.

Next implementation: a bounded default-off shadow raw-status/job settlement transaction and retained acknowledgment readback, using the existing raw tables/job mechanism. It must bind exact retained input/evidence and reject stale owner, conflicting raw payload, incomplete evidence and unknown native effects; test rollback, response loss and process restart without replay. It needs its own prepared SQL and pin/review, with no production DDL or activation implied.

Source/test/SQL freeze: `../dependency-compatibility-increment/compatibility-source-sha256.json` (95 files plus 15 read-only dependency snapshots). No further edits to these pins are planned during the requested independent review. The two new artifact roots are this root and `../dependency-compatibility-increment/`; all older review and acceptance evidence remains preserved.

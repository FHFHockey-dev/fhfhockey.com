# Receiver same-key variant retention

Local candidate verified; **independent review pending**. Scope is the demonstrated changed-payload loss at a known raw receipt key. No ingestion redesign, semantic claim/effect allocation or hosted action occurred. Canonical checkout remains `octoberBranch`; no staging, commit, reset, synchronization, push or deployment.

- [x] Preserve the receiver's existing dirty source-coverage changes and accepted evidence.
- [x] Add default-off immutable receipt retention and held-variant response.
- [x] Verify actual local receiver/storage, fault recovery and focused compatibility.
- [ ] Independent exact-pin review.
- [ ] Separately approved deployed schema/ACL/trigger/fencing checks, migration and flag rollout.

## Implementation

With `IFTTT_RECEIPT_VARIANTS_ENABLED=true`, a known post ID uses `retain_ifttt_raw_receipt` instead of the old ignore-duplicates upsert. One transaction inserts-or-locks the existing canonical raw row and appends an immutable canonical receipt or same-post variant. The first raw body, original provenance and receipt clock remain intact. Equality compares normalized parsed JSON and provenance, excluding receiver retry timestamps/status. Exact retries reuse their retained ID; changed text, author/link metadata or game-ID fields are variants, never proof of an independent lexical occurrence or authentic edit.

The new private `ifttt_raw_receipt_variants` table is necessary because the current mutable raw queues admit one row per source/post, while projection/claim tables require already interpreted team/game/claim identity. It has unique per-carrier input hashes, one baseline, a baseline foreign key, RLS, service-only SELECT/INSERT, identity/clock/hash constraints and an immutable-row trigger. The invoker RPC uses existing raw unique keys and row locks. It verifies actual stored receipt rows and unchanged canonical raw row before returning, with bounded inputs and SQL timeouts. No jobs, claims, forecasts, occurrence IDs, outbox actions or delivery rows are created by this SQL.

`iftttReceiptRetention.ts` validates the returned input/provenance, publication clock, classification and review flag. An uncertain RPC returns HTTP500 without legacy fallback or another mutation. A normal retry is idempotent. A retained variant returns `processingStatus: held_for_review` and never requests the processor, even when processing/capture was requested. Existing canonical processing remains unchanged; this does not retract an older action or authenticate a superseding edit. Unknown-ID storage and the default-off legacy path remain unchanged.

For a preexisting raw row, the baseline is the exact available retained row, not a fabricated pristine historical request. Existing internal markers are retained; uncertain equivalence is conservatively held rather than stripping evidence. Resolving/authenticating corrections or supersession remains a later policy/intake boundary, without independent effect allocation from text/game differences.

## Verification

- **51/51 focused cases pass**: 39 actual private-PG receiver/RPC cases plus 12 nearest mocked receiver/scheduler cases. This is not a web/full52/combined-goal suite. `evidence/final51-results.json` and log retain the final run.
- Cases cover original/changed raw text and provenance; JSON-key ordering; both raw tables; exact/variant retry and concurrency; lost DB and HTTP replies; rollback on first archive or later variant fault; preserved legacy processed rows and markers; trigger-induced receipt/raw rewrites; input bounds; role denial and immutable rows; default-off/missing-ID compatibility; and no processor call for held variants.
- Before/after: `../raw-receiver-local-probes-v1/evidence/same-key-variant-boundary.json` retains the observed old success with only the first body. `evidence/same-key-variant-retained.json` shows the new held receipt plus both immutable bodies and unchanged raw carrier. Original probe artifacts are untouched. Receiver source/test diffs against preserved current dirty bytes are under `before/` and `evidence/`.
- Scoped runtime/PG-harness TypeScript and three-file ESLint pass, exit0. Early disposable-role setup, exact mock binding and SQL-variable qualification failures are preserved honestly. The failed test binding attempted the SDK path, which the network-denial harness blocked before external I/O; no hosted call succeeded. Final tests use the exact local RPC bridge. No full compiler/build/browser or broader81 run occurred.
- PG17 used private Unix sockets/TCP disabled, synthetic secrets/data, capture off except a mocked negative check, and network denial. All tests/compiler/PG processes have finished and clusters were removed.

## Exact freeze and remaining gates

Manifest `owned-source-v1-sha256.json`: **119 files**, SHA256 `e19464cdd6d320352125971ddcae9bf9f7996df209a12e9805a0ed3b25ad19a9`, plus15 read-only dependencies. Prior110 accepted source pins,36 owner artifacts and199 latest review artifacts remain unchanged. Nine new owned paths include the receiver source/test, helper and six task-only SQL/test/config inputs; no competing goal-owned source changed. The only active implementation owner is this IFTTT thread; the reviewer writes only its next review root. All119/15 are held for independent review; outside-pin report writing may continue.

SQL6 is task-local at `supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql`, SHA256 `9540ce4d019d67f4953b66fa62a5bff5eb45dbf00f9dae482adc77c9cef3e933`. The path is nested inside this artifact directory, not a deployed migration tree. Its direct prerequisites are the two existing raw tables/unique indexes. Existing SQL1–5 retain separate membership/order gates; selected SQL5 remains the accepted replacement only, never both alternatives. See `ROLLOUT-GATES.md`.

This is local evidence retention, not production/full52 acceptance, universal direct-writer fencing, sender/hosted PostgREST reliability or external exactly-once delivery. Deployed schema/ACL/triggers and real identity/history/source coverage, authenticated correction policy, genuine future labels/metrics, all migration/release/intake activation and dispatch/replay/compensation approvals remain open.

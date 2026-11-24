# H1–H10 throughput candidate: receipts (2026-11-24)

THROUGHPUT-ANALYSIS.md §3: rows 1 and 2, plus the row 3 tail checks. Local only: no push, deploy, migration or production write. Base: `648730faa`.

## What changed

- **`web/lib/forge-v2/h10Batch.server.ts` (new, H10 only)**
  - `pacedConnection`: one statement in flight, at most N statement starts per second.
  - `H10Ledger`: immutable ledger capture, 25 rows per insert, then a read-back by id that compares kind, scope, predecessor and server hash. The call-local cache holds only tuples read back from the database.
  - `runH10QueueBatch`: claim CAS, then bulk draft read, then the ledger, then one sequence block, then the four publication stages:
    - (A) fenced vintage insert;
    - (B) committed-bytes read;
    - (C) fenced receipt insert;
    - (D) receipt join read.

    Then one acknowledgement CAS. Each of A–D is its own autocommit statement and compares key sets.
  - If any statement fails or its response is lost, each unresolved key reruns A–D on its own. So one bad key fails alone, and a committed write is recognised as the original edition.
- **`h10Producer.server.ts`**
  - Nightly (`trigger === "daily"`) uses the batched ledger and queue path. Material uses the scalar path, as before.
  - Ledger interruption: the budget is checked before each ledger write. A pass cut short starts no job, and the next call resumes from the durable heads.
  - A nightly queue whose jobs are all terminal costs one read.
  - `heads()` also returns the stored tuple.
  - New `scalarQueue` switch, used only by the parity test.
- **`h10Route.server.ts`**
  - `h10RouteConfig` sets `statementsPerSecond: 30`, and the nightly handler paces every statement.
  - Material is not paced.
  - Configs without the field (local fixtures) run unpaced.
- **`h10GoalieProducer.server.ts`**: on the nightly path, a retry wait that would cross the budget ends the phase as a continuation. The next call republishes the stored draft. Scalar goalie issuance is otherwise unchanged.
- **Shared FORGE v2 files: exports only.**
  - `pipeline.server.ts` exports `preparedLedgerRecords`, `validPlan`, `sameIssuedScope`, `validatePrepared` and `refreshEventRecord`.
  - `history.server.ts` exports `decoded`.
  - No function body changed, so other callers behave byte-identically.
- **Rehearsal script**: three new flags.
  - `--latency-ms` adds a delay to every route statement and reports per-dispatch statement count, peak statement starts per second and peak in flight.
  - `--roster-max-age-hours` widens the roster window, because the saved 11-23 roster read ages out after 36 h.
  - `--frozen` uses a fixed freeze time.
- **Producer closure**: still `6ae6bf1092a3…d7ebb`. `web/lib/forge-v2` is outside the closure.

## Full night, latency-injected (proof steps 1, 2 and 5)

The fixture is the saved 11-23 packet (real reads, 32 official rosters) with `--frozen=2026-11-24T17:15:00Z --roster-max-age-hours=72`, which gives **8,040 frozen keys** (7,320 skaters, 720 goalies). Disposable PostgreSQL 17, real migrations and partitions, run through the real dispatch path.

| Run | Calls to complete | Call times (s) | Statements per call | Peak statements/s | Peak in flight | Published | Forecast sha256 |
|---|---:|---|---|---:|---:|---:|---|
| Current code (648730faa), no latency, unpaced | 2 | 200.5, 108.8 | not metered | not metered | not metered | 8,040 | `6495509c…4890` |
| **Candidate with review fixes, 10 ms per statement, 30/s** | **3** | **200.6, 200.1, 165.5 (566.2 total)** | 3,480 / 4,416 / 4,630 | **29** | **1** | **8,040** | `6495509c…4890` (same) |

- The 4th tick answered from the completion marker in 13 ms.
- Verifier (`first-night-verify.sql` on that DB): every class and H1–H10 has 0 missing, 0 extra, 0 duplicate and 0 unpublished. The missing, extra and duplicate CSVs are empty.
- The forecast digest covers class, player, game, team, horizon, model, cutoff and means. It equals the current code's digest.
- The first candidate commit (a01439f44) gave the same result: 200.2 + 200.3 + 165.0 s, the same digest, verifier zeros.
- THROUGHPUT-ANALYSIS measured 3.65 skaters/s for the scalar path at 10 ms. The fixed candidate's first call issued 4,675 skaters (23.3/s) while paced at 30 statements/s.
- Goalies stay scalar. The third call re-walks the 371 goalies already issued (about 5 statements each) before issuing the remaining 349. That is the row 4/9 tail; it was not needed to reach 4 calls.

Files: `baseline-current-code-no-latency.json`, `candidate-10ms-30ps.json`, `candidate-verify-05-reconcile.txt`.

## Tests (proof steps 3 and 4)

`LC_ALL=en_US.UTF-8 FORGE_V2_POSTGRES_BIN=… npm test -- --fileParallelism=false lib/forge-v2 __tests__/pages/api/v1/db/forge-h10-shadow.test.ts` → **28 files, 302 tests passed** (`suites.txt`). Typecheck 0; eslint 0 on every changed file.

Without `LC_ALL`, the disposable Postgres refuses to start ("postmaster became multithreaded"). That is an environment issue, not a test failure.

New tests:

- **`h10Producer.test.ts`: "nightly batched issuance matches the scalar runner".** Two databases, the same night issued each way. It compares:
  - vintages byte for byte, apart from `generatedAt` and the claim `startedAt`, including identical issuance sequence numbers;
  - the same ledger records (id, kind, scope, predecessor, hash);
  - the same queue outcomes.

  The batched run uses fewer than one fifth of the scalar statements.
- **`h10Route.test.ts`: "nightly batches after lost responses".** A committed statement's response is dropped after (A) a multi-key vintage insert, (C) a multi-key receipt insert and the acknowledgement CAS, each on a different queue. The night completes with 1,380 vintages, 1,380 keys, 1,380 sequences and 1,380 receipts. Every affected key keeps its original id, sequence and output hash, plus the original receipt time after C and after the CAS. Only the lost CAS fails its call.

Chef review fixes (second commit), each with a test in `h10Producer.test.ts`:

- **Late call: terminal queues are still claimed.**
  - The nightly skip now applies only to queues whose jobs all published.
  - A queue with failed or expired jobs goes through the claim. That includes jobs enqueued after their lock.
  - The claim records the `missing_refresh` events, as the scalar runner does.
  - Test "records the lock-passed events of a late call": 1,380 expired jobs. The reports and the history-event records are identical to the scalar runner's.
- **One bad key fails alone.**
  - When the ledger chunk, the draft read or the sequence block throws, the statement is retried one record or key at a time.
  - Only the key whose own retry fails is failed.
  - Test "fails only the key whose ledger record cannot be written": one opportunity record always refused. The batch statement and that single record are each refused once. Result: 1,379 published, and only that key pending a retry; its 20-plus queue peers published.
- **Nits.**
  - The ledger writes its first chunk even past the budget. Test "writes the first ledger chunk even past the budget": 25 of 30 records written, then stopped.
  - The first goalie key of a call always finishes its retries. No dedicated test.

Changed existing assertions, both in `h10Route.test.ts`:

- **Fault injectors**: they now also recognise the batched receipt statement (its keys are in `$2`).
- **"after a lost publication response"**:
  - Before: nightly skaters recovered the lost receipt at attempt 2 with `recoveredPublication`.
  - Now: the per-key rerun recovers the original edition in the same call, at attempt 1.
  - Unchanged: the one-vintage, one-receipt and same-bytes assertions.

Not covered:

- **Mixed-batch cases from proof step 3**: changed bytes, a closed lock or a stale lease inside one batch. Key isolation is exercised by the persistent and transient fault test, and draft reuse by the retry paths.
- **The goalie phase crossing a game start.**
- **A seeded previous night (night two) at full scale**: night two is covered only by the existing synthetic `h10Producer` test, which passes on the batched path.

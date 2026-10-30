# RSO recent-form read: receipt (lease RSO-RECENT-FORM, 2026-10-29)

Offline fix for the production `form: partial · recent_form_stats_query_failed` seen in TJ's walkthrough. Only mock DBs were used: no production reads or writes, no Yahoo calls, no Git mutations. Uncommitted; the orchestrator commits.

## Design

- **New opt-in pager:** `concurrentPages()` in `web/lib/rosterScheduleData/planningInputs.ts`, with a typed `PlanningPageReadError(code)`. The shared `pages()` is byte-for-byte unchanged and still serves every other read.
- **How it reads:**
  1. The first page (`range(0, 999)`, `count: "exact"`) fixes the exact count and the server's page size.
  2. The remaining pages are read **4 at a time** (`RECENT_FORM_CONCURRENCY`).
  3. The first failure aborts the sibling requests still in flight.
- **Round trips:** about 5–8 skater pages now take at most 3 page round trips instead of 5–8 sequential ones. Goalies fit in 1 page. The two tables still run in parallel.
- **Only the recent-form read uses it.** `loadPlanningData` (`planning.ts`) calls it for `wgo_skater_stats` and `wgo_goalie_stats`. The query shape (filters, `date desc` + unique key ordering, columns, caps of 25,000 / 2,500) is unchanged.
- **Integrity checks,** every one fatal and none silently loosened:
  - every page asks for the exact count and must equal the first page's;
  - every later page must be exactly full: `min(pageSize, count − offset)`;
  - the assembled rows must total exactly `count`;
  - every identity must be present and unique. Rows are never deduplicated or skipped.
  - A server row cap below 1,000 is honoured. A cap that would need more than 64 pages is refused.
- **Not touched:** S3's flag-guarded later-impact code in `planning.ts`.

## Budget

- `RECENT_FORM_BUDGET_MS = 6000`: `formDeadline = min(loader deadline, now + 6 s)`. It was 2 s.
- **It cannot exceed the loader's overall `deadline`** (`min(deadlineMs, start + 20 s)`).
- **Why 6 s:**
  - 3 round trips of even 1 s pages fit with room for the one retry.
  - It is well under the 20 s loader ceiling.
  - The deployment read beside it keeps its own 2 s budget.
- **Tested:** 6 pages at 1,500 ms each finish in 4.5 s on fake timers. The old sequential read would take 9 s, far past the old 2 s budget.

## Count-change policy

- **"Accept growth outside the window" does not apply here.** The query is already bounded to `start ≤ date ≤ cutoff`, and with offset paging over `date desc`, any insert inside the window shifts the later pages.
- **So the per-page exact count stays, as the drift detector.** Each count is a fast index count (4.5 ms in the timed read). Without it, a pure insert can drop a row without anything noticing. This keeps the integrity guard that the lease's "no per-page exact re-count" wording would have removed; the concurrency gives the speed instead.
- **On drift, the whole read retries once,** from scratch and inside the same 6 s budget. Drift means a changed count, or a duplicate identity, which is what offset drift looks like when insert and delete cancel out in the count.
- **A second drift fails** with `recent_form_stats_count_changed` (or `…query_failed:duplicate_rows`).
- **No other failure retries.**

## Stored reasons (`evidence.form.limitations`)

| Cause | Reason |
| --- | --- |
| Budget or loader deadline hit | `recent_form_stats_timeout` |
| Count changed on both attempts | `recent_form_stats_count_changed` |
| Count above the cap | `recent_form_stats_cap_exceeded` |
| DB error with a PostgREST / SQLSTATE code (`^[A-Z0-9]{5,8}$`) | `recent_form_stats_query_failed:<code>`, e.g. `:57014` |
| DB error without such a code | `recent_form_stats_query_failed:page_error` |
| Missing count / non-array data / short or long page | `…query_failed:missing_count` / `:bad_data` / `:incomplete_page` |
| Duplicate on both attempts / missing identity | `…query_failed:duplicate_rows` / `:missing_identity` |
| Any other thrown error in the read | `…query_failed:unexpected` |
| Failure after the read, while grouping rows | `recent_form_processing_query_failed` (unchanged) |

No raw error text or database detail is stored. The tests assert that "private database details" never appears.

## Tests (`web/lib/rosterScheduleData/planning.test.ts`, mock DB)

- **The `formDb` mock gained:**
  - `slowTable` / `delayMs`, plus in-flight tracking;
  - an `errorCode` option;
  - `count_drift_once`.
  - Its `then` now calls `result()` once instead of twice.
- **Six pages within the budget:** 5,600 rows, at 0 ms and at 1,500 ms a page. The test checks:
  - the ranges are exactly `[0..999] … [5000..5999]`;
  - at most 4 requests are in flight;
  - every page asks for the exact count;
  - `lastFive` and `recentTotals` are populated;
  - no timers are left.
- **Nine failure modes,** each giving its own reason: timeout, count changed, cap exceeded, coded error, uncoded error, missing count, duplicate rows, bad data, short pages. The tests also check that drift retries exactly once and that other failures do not retry.
- **One mid-read write:** the read retries and serves the consistent second snapshot, with `lastFive` and `recentTotals` populated.
- **Missing row identity:** gives `…query_failed:missing_identity`.
- **The shared `pages()` is unchanged:** it stays sequential (max in-flight 1, offsets 0/1000/2000), and a count drift fails at once with no retry and the original message.
- **One existing test updated:** the safe-failure test now expects `recent_form_stats_query_failed:page_error`.

## Commands and results (from `web/`)

- `npx vitest run lib/rosterScheduleData lib/rosterScheduleOptimizer`: **passed**, 34 files and 1,026 tests.
- `npx eslint lib/rosterScheduleData/planning.ts lib/rosterScheduleData/planning.test.ts lib/rosterScheduleData/planningInputs.ts`: **passed**, no output.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, run under `/private/tmp/fhfh-heavy.lock` (taken with mkdir and released): **failed, outside this lease.**
  - The one error is `__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx(121,39)`: TS2322, `StreamingChain` is not assignable to `StreamingAlternative`.
  - That file is uncommitted work in the concurrent rso-alt-tidy lane.
  - No errors in the `rosterScheduleData` files.

## sha256

- **Baselines verified before editing:** they match the lease.

| File | Baseline (lease) | After |
| --- | --- | --- |
| `web/lib/rosterScheduleData/planning.ts` | `c4df8dc9…4262a` | `be7919f534eab6278a7874be4bc8a6fce5db560d9b6ad8aa57e1fe633c0ebf81` |
| `web/lib/rosterScheduleData/planning.test.ts` | `36e0c84e…18d34` | `06e9275f55b5ec307548ebaa0017225494bdb9841d0c780983d050e872725bc1` |
| `web/lib/rosterScheduleData/planningInputs.ts` | `8193aa5d…98313` | `dc165605bef18537ae5e5bac23156e38b8e74d423da2ee4d718faa3cb67adb85` |

## Limitations

- **Not verified against the live database or Vercel.** The real cause in production (round trips versus drift) shows up only after release, through the new specific reason.
- **At most 4 requests in flight per table.** The first page runs alone, and a retry starts only after the failed attempt's requests are aborted. With both tables reading in parallel, that is at most 8 short-lived PostgREST requests at once per load.

# Independent review: R21 scheduler retain-only correction v1

**Verdict: accepted.** The three-file correction in `../scheduler-retain-only-v1/` does what its CHECKPOINT says.

- `iftttIntakePilotConfigured()` is the exact pre-fix receiver predicate, so receivers behave the same.
- `retryPendingLineSourceEvents()` makes no processor request whenever any pilot variable is present.
- With no pilot configuration, the retry is identical to the pre-fix code.
- The two new tests fail against the `before/` bytes.

This review also found one adjacent gap **outside this diff**, R22. It is a rollout precondition, not a defect in this correction, and has a reproduction. See below.

Reviewed 2026-10-17 by a separate session from the owner. Every result here comes from a new run in this folder. No live file, owner artifact or runtime code was edited. Nothing was committed, staged or deployed. No hosted call, migration or env change happened.

## Reviewed bytes

| Path | before (= `before/` = `git show HEAD:`) | after (= live) |
|---|---|---|
| `web/lib/sources/iftttIntakePolicy.ts` | `34a5f689…7a2f` | `6badd4c0…d619` |
| `web/lib/sources/lineSourceIftttReceiver.ts` | `ac22d9f9…a8ed` | `5fb55c31…87d7` |
| `web/lib/sources/lineSourceIftttReceiver.test.ts` | `946537b9…1bd2` | `bbe8d715…7306` |

The full hashes are in `pin-check-before.json` and `pin-check-after.json`.

- Live bytes equal every "after" pin in `owned-source-sha256.json`. The `before/` copies equal both the "before" pins and `HEAD` (`ceceb407a`).
- `git diff HEAD` under `web/lib/sources` touches exactly these 3 files (+27/−2).
- The diffs, regenerated from `before/` against live, are byte-identical to the owner's `evidence/*.diff`.
- The owner's unchanged pins still match: `iftttRpcDeadline.ts`, `iftttReceiptRetention.ts` and `starter-board.ts`.
- All 34 owner checkpoint artifacts are unchanged (`checkpoint-artifacts-sha256.json`).
- `pin-check-after.json` shows nothing moved during this review.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Nearest Vitest: `lineSourceIftttReceiver.test.ts` + `iftttIntakePolicy.test.ts`, including both existing 6-request scheduler cases | **34/34 pass** | `evidence/nearest.{log,json}` (file is `nearest-results.json`) |
| Mutation harness: live tests against 8 source trees (control, the `before/` bytes, 6 mutants) | **control 34/34; all 7 others killed** | `evidence/mutation-summary.json`, `evidence/mutation/*` |
| Independent before/after truth table: 480 env combinations × 2 receiver scopes, plus both retry implementations | **0 mismatches** | `evidence/independent-truth-table.json` |
| Scheduler under 9 pilot shapes the owner tests do not cover | **9/9: 200, capture skipped, 0 processor requests** | `evidence/independent-scheduler-pilot-shapes.json` |
| R22 reproduction: alias-replay cron under pilot configuration | 2/2 pass. **Documents the gap.** | `evidence/independent-replay-aliases-under-pilot.json` |
| ESLint on the 3 changed files | exit 0 | `evidence/lint.log` |
| Copied private-PG17 regression (owner harness, byte-copied): 88 PG, 10 SDK, 20 policy, 14 receiver | **132/132 pass** | `evidence/regression132.{log,json}` (file is `regression132-results.json`) |

All commands were run from `web/`:

- `npx vitest --run lib/sources/lineSourceIftttReceiver.test.ts lib/sources/iftttIntakePolicy.test.ts`
- `zsh <this>/mutation/run-mutants.sh`, which builds `mutation/mutants/` and runs `--config mutation/vitest.mutation.config.mjs` once per tree
- `npx vitest --run --config <this>/independent/vitest.independent.config.mjs`
- `npx eslint` on the three files
- `LC_ALL=en_US.UTF-8 IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npx vitest --run --no-file-parallelism --config <this>/regression.config.mjs`

Isolation:

- Every harness file was copied byte for byte (hashes match the owner manifest).
- Network was denied (`../review/deny-network.ts`); fetch and Supabase were mocked.
- PG ran on a fresh private cluster over Unix sockets and was removed afterwards. No `postgres` process remained.
- No full `tsc` or build was run. Full `tsc` was already exit 0 on these exact bytes (owner evidence).

## 1. Hashes

All match. See "Reviewed bytes".

## 2. `iftttIntakePilotConfigured()` is the old receiver predicate

Textually, the new function returns the negation of the condition `iftttIntakeConfiguration` used before. It reads the same three variables, and `iftttIntakeConfiguration` returns `{ controlled: false }` exactly when the function is false. The function's later checks still use the locals `flag`, `raw` and `stop`, so it does not depend on the extracted helper's own reads.

The truth table (`independent/independent-retain-only.test.ts`) tested this by execution:

- Each variable took these values:
  - flag: absent, `""`, `false`, `true`, `TRUE`, `0`
  - policy: absent, `""`, valid, `{bad`
  - stop: absent, `""`, `false`, `true`, `typo`
  - mode: absent or `shadow`
  - interpretation: absent or `true`
- That gives 480 combinations. For each one, and for both an in-scope and an out-of-scope receiver, before and after `iftttIntakeConfiguration` returned the same value or threw the same message.
- `iftttIntakePilotConfigured()` equals "the pre-fix function did not return `{controlled:false}`" in all 480 cases.

What "present" means:

- The pilot counts as configured when any of these holds: the flag is set to anything except `false`; the policy is set, even to `""`; or the stop is set to anything except `false`.
- Only 16 combinations keep the legacy path: flag absent or `false`, policy absent, and stop absent or `false`, crossed with mode and interpretation.
- This is the same boundary the receivers already used.

## 3. The guard makes no processor request when configured, and changes nothing otherwise

- The early return comes before the date calculation and before any `fetch`. It returns exactly `{attempted:0, failed:0, results:[], skipped:"controlled_intake"}`.
- Configured (464 of 480 combinations): 0 requests and exactly that object.
- Legacy (16): the live retry's 6 request URLs and its return value are byte-identical to the pre-fix module's.
- Both existing 6-request scheduler tests pass (34/34).
- The scheduler handler was also run under 9 pilot shapes the owner tests do not cover. Each returned 200 with the exact skipped marker and 0 processor requests:
  - policy only, and empty policy only
  - flag `TRUE` only, and empty flag only
  - misspelled stop only, and empty stop only
  - full pilot with stop `false`
  - full pilot with capture enabled only through the legacy `START_CHART_GAME_REVISIONS=true`
  - full pilot with compute on. Here dispatch still ran once and the mode is `compute`, so compute is independent of the guard.

## 4. The new tests fail against the `before/` bytes (mutation harness)

`mutation/build-mutants.mjs` writes each tree under `mutation/mutants/<name>/`. Each tree holds the two runtime files plus byte copies of their relative imports and of `iftttIntakePolicy.test.ts`. Every replacement is asserted to match exactly once.

`vitest.mutation.config.mjs` runs the **live** `lineSourceIftttReceiver.test.ts` unchanged and redirects only `lib/sources/lineSourceIftttReceiver`, which the test and `starter-board.ts` both import. The `control` tree (live bytes, 34/34) shows the redirect itself changes nothing.

| Tree | Result | Killed by |
|---|---|---|
| `control` (live bytes) | 34/34 | — |
| `before` (exact `before/` bytes) | 32/34 | both new scheduler cases |
| `no-guard` (helper kept, guard line removed) | 32/34 | both new cases |
| `guard-flag-true-only` | 33/34 | stop-only case |
| `predicate-ignores-stop` | 33/34 | stop-only case |
| `predicate-ignores-policy` | 32/34 | policy tests (legacy default-off; flag-off) |
| `guard-inverted` | 30/34 | both new cases and both 6-request cases |
| `no-skipped-marker` | 32/34 | both new cases (response contract) |

Under `before`, the first failing assertion is status 503, not the request count. The unguarded retry made all 6 processor calls into the test's bare `vi.fn()`, which counted them as failed. That is the R21 behavior, and the truth table confirms the 6 requests directly.

Coverage note (not blocking): the new scheduler cases cover full configuration and stop-only. A predicate that ignored the policy variable is caught only by the existing policy tests, through the shared helper. The other shapes are covered by the shared predicate and by this review's truth table and scheduler shapes.

## 5. Does anything else need a change for retain-only?

- **`pages/api/internal/starter-board.ts`: no.**
  - `capture` is returned as-is, and `skipped` passes through.
  - `failed: 0` keeps the response at 200.
  - Compute and dispatch are independent of the guard, which was checked with compute on.
  - The legacy `START_CHART_GAME_REVISIONS` capture path is covered, because the guard sits inside the retry.
- **Receivers: no.**
  - Under any pilot configuration, an in-scope receiver is controlled and never calls the processor (`!intake.controlled`). An out-of-scope receiver returns 503.
  - The receivers and the scheduler now share one predicate, so they cannot disagree.
- **`update-line-sources` / `update-lines-ccc`: no change is needed for R21.**
  - Neither has any pilot awareness (0 references to `iftttIntake`), so retain-only depends on every caller being fenced.
  - Without a cohort they select every pending row (`update-line-sources.ts:110-111`). With a `tweetId` they select by tweet ID with no status filter (`:101-102`; `update-lines-ccc.ts:59-60`).
- **Caller inventory.**
  - `web/vercel.json` crons: only `/api/internal/starter-board` (every minute, now guarded) and `/api/v1/db/replay-player-aliases` (every 10 minutes, **not** guarded; see R22) reach the processors.
  - No references in `.github/`, `functions/`, `webhooks/`, `supabase/` migrations (pg_cron), or `tasks/TASKS/cron-operations/cron-schedule.md`.
  - Other readers of the raw tables:
    - `rosterReconciliation.ts` only reads `processed` rows.
    - `tweet-pattern-review.ts` is a manual admin route.
    - `tweetClaim*` and `tweetProcessingJobs` are processor internals.
  - Manual admin calls to the processors are an operator matter.

## R22 (P3, outside this diff, rollout precondition): the 10-minute alias-replay cron can still request processing during the pilot

Facts:

- `web/vercel.json` schedules `/api/v1/db/replay-player-aliases` at `*/10 * * * *`.
- The route is gated only on `tweetPipelineFlags().interpretation` (`replay-player-aliases.ts:12`), and the pilot requires `TWEET_PIPELINE_INTERPRETATION_ENABLED=true`.
- For a current-Eastern-day unresolved name with an alias-replay job, the route POSTs `update-line-sources` or `update-lines-ccc` with `tweetId`, `reprocess=true` and `limit=1` (`:53-65`).
- With no cohort, the processor selects that tweet ID regardless of `processing_status`.

Reproduction: `independent/independent-replay-aliases-under-pilot.test.ts`, 2/2.

- Under full pilot configuration, and again with `IFTTT_INTAKE_STOP=true`, the live route issued exactly one processor request: `POST /api/v1/db/update-line-sources?date=<today ET>&tweetId=…&reprocess=true&limit=1&sourceKey=gamedaygoalies`.
- At that moment `iftttIntakePilotConfigured()` was true.

Reach, from my reading:

- An alias-replay job exists only after an admin saves an alias during the window (`player-name-aliases.ts:289-296`, which also needs the interpretation flag).
- A current-day unresolved name exists only if that tweet was **processed** on the same Eastern day. Nothing processes during a retain-only window, so this reaches only tweets processed on the activation day **before** activation.
- In the cases I traced, the targeted carrier is therefore already non-pending, so "pending carriers remain pending" is not directly broken.
- It does run processor work in claim-shadow mode during the window. The package says that does not happen: B6 calls this an "operator route", and the cost bound says "No cron, ETL, replay".

Not established:

- the processor's behavior on this path. That is static reading only; the handler was not executed.
- what claim-shadow mode does in hosted without SQL1–5, which may make the run fail and be retried by the replay job (up to 8 attempts).
- whether a processed-then-deferred carrier, which can be `pending` again, could be both a pilot carrier and a replay target.

Options for TJ (none applied here):

- (a) Add an operator precondition: no alias saves during the window. Alternatively, start the window with no same-Eastern-day processing before activation.
- (b) A separately reviewed guard: while `iftttIntakePilotConfigured()`, `replay-player-aliases` skips the current-day processor call and leaves the job pending.

Either way, ROLLOUT-APPROVAL B6 and section 6 should say the alias replay is a 10-minute cron.

## Observations (no change needed)

- **O-1.** While any pilot variable is present, the scheduler will not process an approved evaluation cohort either. Processing a cohort later needs its own trigger and approval. This matches ROLLOUT-APPROVAL ("the minute scheduler processes nothing").
- **O-2.** The truth table confirms ROLLOUT-APPROVAL item 11: removing every variable, or leaving only flag and stop as `false`, resumes current-day retries on the next scheduler tick.

## Folder contents

- `pin-check.mjs`, `pin-check-before.json`, `pin-check-after.json`
- Copied owner harness (byte-identical): `vitest.config.mjs`, `regression.config.mjs`, `receiver-storage.test.ts`, `rpc-deadline.test.ts`, `tsconfig.json`, `dependency-snapshot/`, `supabase/`. The R19/R20/absent-race/deadline JSON files in `evidence/` are written by that harness.
- `mutation/`: builder, config, runner, summarizer and the generated `mutants/` with `mutants-manifest.json`.
- `independent/`: the truth-table, scheduler-shape and R22 tests, and their config.
- `review-artifacts-sha256.json`: hashes of every file in this folder after the final run.

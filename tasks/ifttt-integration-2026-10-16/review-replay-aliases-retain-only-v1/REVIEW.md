# Independent review: R22 alias-replay retain-only guard

**Verdict: ACCEPT. R22 is closed for `/api/v1/db/replay-player-aliases`.** No processor request can leave this route while any pilot variable is present. Four notes below are non-blocking. One condition applies to release: the change must ship together with the R21 edit of `web/lib/sources/iftttIntakePolicy.ts`, or after it (N1).

Reviewed folder: `../replay-aliases-retain-only-v1/` (CHECKPOINT.md, owned-source-sha256.json). Git HEAD `ceceb407a`. All runs were local, on 2026-10-17 between 17:28 and 17:36 ET. Supabase and `fetch` were mocked. No hosted call was made.

I edited no live file and no owner artifact, made no commit, switched no branch and deployed nothing. I did not run `next dev`, `next build` or a full `tsc`. Every file I wrote is inside this folder.

The before-session check of linked sessions found no other R22 review. Only the R21 reviewer and the R22 author were linked.

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1a | Live route and live test against their "after" pins | **pass**, both match | `evidence/pins.log` |
| 1b | Owner `before/replay-player-aliases.ts` against its "before" pin and `git show HEAD:` | **pass**, all three byte-identical (`98261dff…b87e`) | `evidence/pins.log` |
| 1c | `uncommittedDependency` `iftttIntakePolicy.ts` (`6badd4c0…d619`) | **pass**. It also equals the R21 after-pin in `../scheduler-retain-only-v1/owned-source-sha256.json` | `evidence/pins.log` |
| 1d | `unchangedContext` (5 files) | **pass**. All match the pins and equal HEAD | `evidence/pins.log` |
| 1e | `evidence/*.diff` regenerated from `before/` vs live (`diff -u --label`) | **pass**, both byte-identical | `evidence/diff-regeneration.log`, `regenerated/` |
| 1f | `checkpoint-artifacts-sha256.json` against the folder | **pass**. 8/8 match; no file is unlisted or missing | `evidence/pins.log` |
| 2a | `npx vitest --run` on `replay-player-aliases.test.ts` + `player-name-aliases.test.ts` | **pass**, 47/47 | `evidence/nearest-vitest.log` |
| 2b | `npx eslint` on the 2 changed files | **pass**, exit 0, no output | `evidence/eslint.log` |
| 2c | Scoped `tsc` (the 2 changed files and their 28-file import graph; not a full `tsc`) | **pass**, exit 0. The negative control (wrong arity) failed with TS2554 as expected | `evidence/tsc-scoped.log` |
| 3 | Owner test against the before bytes and 7 mutants, plus a control | before bytes and all 7 meaningful mutants **killed**. Control passes. One extra mutant survives (see N2) | `evidence/mutation-summary.txt` |
| 3b | My independent scenarios (14) against the live route and the same mutants | **14/14 pass** on live. **Every mutant killed**, including the one the owner test misses | `evidence/independent-live.log`, `evidence/mutation-independent-summary.txt` |
| 4 | Reviewer reproduction, re-run from copies with the write redirected | **fails as expected**: 0 processor requests in each pilot shape. On the before bytes the same copy still passes with 1 request. The original evidence is unchanged | `evidence/reproduction/` |
| — | Full `tsc --noEmit`, `next build`, `next dev`, E2E, hosted calls | **not run**, by instruction | — |

### 3. Mutation results

Each mutant is a copy of the route under `mutants/<name>/` (built by `harness/build-mutants.py`). The **live, unedited** test file runs against it. `harness/vitest.review.config.mjs` only redirects module resolution of `pages/api/v1/db/replay-player-aliases`.

| Mutant | Owner test (3) | Independent (14) | Why the owner test fails |
|---|---|---|---|
| `control-after` (live bytes) | 0 failed | 0 failed | Harness control. |
| `before-head` (= HEAD) | **2 failed** | 11 failed | Each pilot case POSTs `update-line-sources` with `reprocess=true`. |
| `guard-removed` | **2 failed** | 11 failed | Same as `before-head`. |
| `guard-after-consumed` | **2 failed** | 5 failed | The job is written `complete`: the cursor passes the current-day row, which is then never replayed. |
| `guard-all-rows` | **2 failed** | 2 failed | `resolved: 0`: historical reconciliation also stops. |
| `guard-inverted` | **3 failed** | 13 failed | The legacy case loses its replay, and the pilot cases POST. |
| `guard-flag-only` (`IFTTT_RECEIPT_VARIANTS_ENABLED==="true"`) | **1 failed** | 6 failed | The stopped-pilot case POSTs. This shows why that case is needed. |
| `guard-skip-fetch-only` | **2 failed** | 5 failed | The current-day row is consumed and resolved under the pilot. |
| `guard-continue` (`continue` instead of `break`) | **0 failed, survives** | **1 failed** | See N2. |

### 4. Reproduction re-run

`evidence/reproduction/copy-diffs.txt` shows the exact differences from the reviewer's test (sha256 `9a7a1e93…c0e4`).

- `rerun-live.test.ts` changes only the `writeFileSync` target, to `evidence/reproduction/rerun-live.json`. Result: 2/2 fail with ``expected [] to deeply equal [ {…} ]``. That is 0 processor requests and `resolved: 0` for both the active and the env-stopped pilot.
- `rerun-mutant.test.ts` also imports the route by its bare specifier, so the harness can swap the route. With `MUTANT=before-head` it **passes** 2/2, with 1 request each. With `MUTANT=control-after` it fails 2/2, with 0 requests. So the 0 on live comes from the fix, not from a difference in the harness.
- The reviewer's evidence JSON (`1a96b1cc…6fae`) and test have the same sha256 before and after my runs (`original-hashes-{before,after}-run.txt`). Both also match `../review-scheduler-retain-only-v1/review-artifacts-sha256.json`.

## 5. Judgment

### Does any processor path remain under pilot configuration? No.

The only processor call in the route is the `fetch` at `replay-player-aliases.ts:64`. Reaching it requires both:

- `isCurrent`, because line 56 (`if (!isCurrent) continue`) diverts every historical row.
- That line 40 did not break. For a current row, line 40 breaks whenever `iftttIntakePilotConfigured()` is true.

So a processor call implies `iftttIntakePilotConfigured() === false`. The helper reads `process.env` on every row and never throws. The helper choice matters: using `iftttIntakeConfiguration()` would have thrown on a stopped or incomplete pilot and marked the job `failed`.

The env truth table in `independent/` confirms the result. These shapes all give 0 requests: flag only, flag present but empty, policy only, policy present but empty, stop only, and stop/flag `"false"` with a policy present. With no variables, or with flag and stop both `"false"` and no policy, there is 1 request.

The `lines_ccc` → `update-lines-ccc` branch is guarded the same way. It gets 1 POST without a pilot and 0 under a stopped pilot.

The other outbound effects of the route are not processor paths:

- `retryTweetAttribution()` (`lib/sources/tweetAttribution.ts:19`) runs only when `TWEET_PIPELINE_PUBLISHING_ENABLED` and an X token are both set. It calls `api.x.com` and updates `tweet_projection_reports` rows from the last 7 days.
- The digest is also publishing-gated. It POSTs `/api/v1/db/send-player-name-alias-review`, which sends email.

Neither of these calls `update-line-sources` or `update-lines-ccc`, or touches raw IFTTT rows. That makes the CHECKPOINT's "not covered" statement accurate and acceptable under the stated retain-only contract. If TJ wants the pilot to make no X API calls as well, keep publishing off during the window. `ROLLOUT-APPROVAL.md` says nothing either way.

### Trade-off 1: head-of-line hold. Accurate, and narrower than the CHECKPOINT implies.

The CHECKPOINT's description is correct, and my independent test confirms it. A held job is written back `pending`, with `attempts: 0` and `lease_expires_at: null`, and with no `next_attempt_at` key. It is therefore eligible again at once. `.order("job_key").limit(1)` re-selects it on every run, with no progress. Rows after the held row in the same job also wait (fixture 101 historical, 102 current, 103 historical: only 101 resolves, and the cursor stays at 101). Note that `job_key` is `alias-replay:${unresolvedId}` compared as **text**, so "later keys" means later in string order (`alias-replay:99` sorts after `alias-replay:100`).

The duration has a bound that the CHECKPOINT does not state:

- `lineup_unresolved_player_names` rows are created only through `persistUnresolvedPlayerNames()`. Its only callers are `update-line-sources.ts:865` and `update-lines-ccc.ts:579`.
- While the pilot is configured, the accepted retain-only contract keeps those processors from running: IFTTT receivers retain or refuse, the minute scheduler is under the R21 guard, and this route is now guarded too. So no new unresolved rows appear during the window.
- A hold can therefore only come from rows created earlier on the Eastern day the pilot was turned on. It clears at the first Eastern midnight after that.
- The bound fails only if someone runs a processor by hand during the pilot.

The cost is liveness, not safety: alias resolutions created that day are delayed. I recommend accepting it as is. An optional refinement is to write `next_attempt_at` = the next Eastern midnight for a pilot-held job, which would free the slot. That is not needed for R22.

### Trade-off 2: Eastern midnight. Accurate and verified.

The fixture has a held row published 2026-10-17 15:30Z under an active pilot:

- At **23:59 EDT** it is still held, with 0 requests and the job `pending` at `afterId` 101.
- At **00:00:30 EDT on 10-18** it is resolved with 0 requests, and the job is `complete` at `afterId` 102.

`easternReportDate` uses `Intl` with `America/New_York`, so the DST change is handled. That day's alias replay is never sent, which is consistent with retain-only and with the existing rule for historical rows.

### Trade-off 3: `retryTweetAttribution` not covered. Accurate; see the processor-path section above.

## Notes (non-blocking)

- **N1. Release coupling.** `git show HEAD:web/lib/sources/iftttIntakePolicy.ts` does not contain `iftttIntakePilotConfigured` (0 matches). The route change does not compile without the R21 edit. The new test file is untracked (`??`). Commit the route, the test and the R21 policy edit together, or commit R21 first.
- **N2. Test sensitivity, optional.** The owner's 2-row fixture cannot tell `break` from `continue` at the guard.
  - With `continue`, rows [historical, current, historical] become `consumed=2`, and `afterId` becomes the **current-day row's id**. The cursor passes that row, so it would never be replayed or resolved by this job afterwards.
  - The shipped code uses `break` and is correct. A third historical row after the current-day row in the owner fixture would pin this. My `independent/replay-aliases-pilot-scenarios.test.ts` ("holds the cursor on the first current-day row…") kills that mutant.
- **N3. CHECKPOINT nit.** The isolation line does not say that `playerIdentity.resolvePlayerIdentity` is stubbed to always match. `rosterSeasonForDate` stays real. This does not affect the result.
- **N4. Resuming after the pilot.** If the pilot variables are removed on the same Eastern day, the held job POSTs the processor on the next 10-minute run. That processor selects by `tweet_id` with no `processing_status` filter, as R22 described. This is the post-pilot regime (normal processing resumes then anyway), not a retain-only violation. It is noted so the end-of-pilot plan expects it.

The CHECKPOINT's "Still open" item stays with its owner: `../rollout-approval-2026-10-17/ROLLOUT-APPROVAL.md` should record "(b) chosen; guard reviewed" for R22.

## Folder contents

- `harness/`
  - `vitest.review.config.mjs`: the module-redirect harness, run from `web/`.
  - `deny-network.ts`: makes any fetch a test did not stub throw.
  - `build-mutants.py`, `run-mutants.sh`, `summarize.py`.
  - `tsconfig.scoped*.json` and `tsc-negative/`.
- `mutants/`: 9 route copies and `mutants-manifest.json` (sha256 of each).
- `independent/replay-aliases-pilot-scenarios.test.ts`: 14 scenarios covering the env truth table, the in-job hold, an all-current page, repeated runs and head-of-line, Eastern midnight, and the `lines_ccc` branch.
- `reproduction/`: the two redirected copies of the reviewer's reproduction.
- `regenerated/`: the regenerated diffs.
- `evidence/`: the logs and vitest JSON reports listed above, and `live-files-after-review.log`, which shows the live and owner files are unchanged after this review.
- `review-artifacts-sha256.json`: sha256 of every file in this folder except itself.

Reproduce from `web/` (paths relative to `web/`):

```bash
python3 -I ../tasks/ifttt-integration-2026-10-16/review-replay-aliases-retain-only-v1/harness/build-mutants.py
zsh ../tasks/ifttt-integration-2026-10-16/review-replay-aliases-retain-only-v1/harness/run-mutants.sh
TESTS=$(cd ../tasks/ifttt-integration-2026-10-16/review-replay-aliases-retain-only-v1 && pwd)/independent/replay-aliases-pilot-scenarios.test.ts npx vitest --run --config ../tasks/ifttt-integration-2026-10-16/review-replay-aliases-retain-only-v1/harness/vitest.review.config.mjs
```

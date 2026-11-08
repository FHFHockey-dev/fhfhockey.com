# R22 correction: keep a configured pilot retain-only under the alias-replay cron

**Status: owner-tested locally; independent review pending.** TJ chose option (b), the code guard, on 2026-10-17. The guard has no effect unless pilot configuration is present. Nothing was activated, committed or deployed, and no hosted call was made.

## Defect

R22 was found by `../review-scheduler-retain-only-v1/REVIEW.md` (section "R22").

- `web/vercel.json` runs `/api/v1/db/replay-player-aliases` every 10 minutes (`*/10 * * * *`).
- The route was gated only on `tweetPipelineFlags().interpretation`, and the pilot requires that flag.
- For a current-Eastern-day unresolved name with an alias-replay job, it POSTed `update-line-sources` or `update-lines-ccc` with `tweetId`, `reprocess=true` and `limit=1`.
- Those processors select by `tweet_id` with no `processing_status` filter, and they have no pilot awareness.
- The R21 guard (`iftttIntakePilotConfigured()`) covered only the minute scheduler.

Before evidence: `../review-scheduler-retain-only-v1/evidence/independent-replay-aliases-under-pilot.json` (reviewer's reproduction, 1 processor request per pilot shape), and `evidence/before-bytes-run.log` here.

## Change (2 files, `owned-source-sha256.json`)

- `web/pages/api/v1/db/replay-player-aliases.ts` (+3/−1). The loop already stopped at a current-day row once 2 processor calls had been made this run. It now also stops there while `iftttIntakePilotConfigured()` is true.
  - The stop comes before `consumed++`. The current-day row is therefore not resolved and not sent to a processor.
  - The cursor (`afterId`) stays on the last consumed row.
  - The job is written back as `pending`, with `attempts: 0` and an unchanged `next_attempt_at`. That is the existing "more to do" write, so the next run after the pilot ends resumes from that row.
- `web/__tests__/pages/api/v1/db/replay-player-aliases.test.ts` (new; the route had no test). It sits beside `player-name-aliases.test.ts`, which tests where alias-replay jobs are created. The fixture has 1 job and 2 rows: a historical row (2026-10-14) and a current-day row (2026-10-17), with the clock fixed at 2026-10-17T16:00Z.
  - No pilot configuration: both rows resolve, and there is exactly one `update-line-sources` POST (`date`, `tweetId`, `reprocess=true`, `limit=1`, `sourceKey`). The job is `complete` with `afterId` 102. This pins the legacy behavior.
  - Active pilot (flag, policy, `TWEET_CLAIMS_MODE=shadow`) and stopped pilot (`IFTTT_INTAKE_STOP=true` only): 0 processor requests. Only the historical row resolves. The job stays `pending` with `afterId` 101.

Before-copy: `before/replay-player-aliases.ts`, equal to `git show HEAD:` (`ceceb407a`). Diffs: `evidence/*.diff`. The test diff is against `/dev/null`.

Unchanged:

- The historical (non-current) path. Historical rows before the first current-day row are still resolved, and they still never call a processor.
- `update-line-sources`, `update-lines-ccc`, `player-name-aliases.ts`, `vercel.json` and every SQL file. Their hashes are pinned under `unchangedContext`.
- Behavior with no pilot configuration. The legacy test case passes on both the before and the after bytes.

**Dependency.** `iftttIntakePilotConfigured()` exists only in the uncommitted R21 edit of `web/lib/sources/iftttIntakePolicy.ts` (after-pin `6badd4c0…d619`, which matches `../scheduler-retain-only-v1/owned-source-sha256.json`). This change must be committed and released together with R21 or after it. It does not compile against `HEAD` alone.

## Checks

All commands were run from `web/`.

| Check | Result | Evidence |
|---|---|---|
| New test against the **before** bytes (route equal to `HEAD`) | 1 pass (legacy), 2 fail. Each pilot case got 1 `update-line-sources` POST with `reprocess=true`. | `evidence/before-bytes-run.log` |
| Nearest Vitest on the after bytes: `replay-player-aliases.test.ts` (3) + `player-name-aliases.test.ts` (44) | 47/47 pass | `evidence/nearest.log` |
| ESLint on the 2 changed files | exit 0, no output | `evidence/lint.log` |
| Full `tsc --noEmit`, `next build`, `next dev` | **Not run**, by instruction. Vitest strips types, so types are unverified beyond ESLint. | none |

Commands:

- `npx vitest --run __tests__/pages/api/v1/db/replay-player-aliases.test.ts` (on the before bytes)
- `npx vitest --run __tests__/pages/api/v1/db/replay-player-aliases.test.ts __tests__/pages/api/v1/db/player-name-aliases.test.ts --reporter=verbose`
- `npx eslint pages/api/v1/db/replay-player-aliases.ts __tests__/pages/api/v1/db/replay-player-aliases.test.ts`

Isolation: Supabase and `fetch` were mocked, and the admin middleware was stubbed. `tweetAttribution` and `lineSourceProcessing` were mocked. `iftttIntakePolicy`, `tweetInterpretation`, `projectedLineups` and `linesCccIngestion` ran with their real bytes, and tweet IDs were built as real X Snowflakes.

## Operational meaning

While any pilot variable is present:

- The alias-replay cron makes no processor request.
- An alias-replay job whose cursor reaches a current-day row is held as `pending` at that row. Every 10-minute run re-claims it, reads up to 10 rows and 1 alias set, and writes it back. Nothing else happens.

Known trade-offs, for the reviewer and TJ:

- **Queue head-of-line.** The cron claims one job per run, ordered by `job_key` (`.order("job_key").limit(1)`). A held job therefore keeps the slot. Alias-replay jobs with later keys wait until the pilot ends or until Eastern midnight, including their historical rows. Rows after the held row in the same job also wait. This is the existing serial behavior, but a held job no longer makes progress during the window.
- **Eastern midnight.** If the pilot is still on at Eastern midnight, the held row becomes historical. It is then resolved without a processor call, which is the existing historical behavior. That day's replay is never sent, which is consistent with retain-only.
- **Not covered by this guard.** `retryTweetAttribution()` and the publishing-gated review digest still run after the loop. Attribution calls the X API and updates existing projection reports. It does not call `update-line-sources` or `update-lines-ccc`, and it was not part of R22.

## Still open (outside this step's files)

- `../rollout-approval-2026-10-17/ROLLOUT-APPROVAL.md` still lists R22 as "Decision needed" (section 1 table and section 5 item 1). Once this is reviewed, its owner should record "(b) chosen; guard reviewed". B6 and section 6 already describe the route as a 10-minute cron.
- Independent review of this folder. A reviewer may re-run `../review-scheduler-retain-only-v1/independent/independent-replay-aliases-under-pilot.test.ts`. Its assertion of exactly one processor request is expected to **fail** now, because 0 requests should be made. This was not run here: the test writes `../review-scheduler-retain-only-v1/evidence/independent-replay-aliases-under-pilot.json` before it asserts, which would overwrite the reviewer's evidence. Copy the test elsewhere and redirect that write first.

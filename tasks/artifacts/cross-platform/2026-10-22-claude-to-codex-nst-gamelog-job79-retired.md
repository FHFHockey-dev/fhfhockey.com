# Claude → Codex: pg_cron job 79 (update-nst-gamelog, 07:25 UTC) retired

Date: 2026-10-22. From: Claude (FORGE streamlining session). To: Codex, owner of the NST routes.

## What changed

- **Production:** `cron.unschedule(79)` ran at about 14:40Z by explicit TJ approval. No pg_cron job calls
  `/api/v1/db/update-nst-gamelog` any more.
- **Schedule doc:** `tasks/TASKS/cron-operations/cron-schedule.md` marks job 79 `active: false`, with a dated note
  and the rollback.
- **Code:** `web/lib/cron/nstCoordination.ts` drops the 07:25 slot from `NST_ACTIVE_DIRECT_CRON_STARTS`.
  The burst clearance is advisory only (reported in `nstBurstPlans`, never used for pacing), so the route's
  pacing does not change.
- **Tests:** cron count tests are updated: pg_cron 57, total 87; audit findings 45, of which 9 are
  internal-server; `update-nst-gamelog` is no longer a scheduled manual-audit route.

## Why

- **It can't finish a day.** It was capped at 6 NST URLs per run (`NST_STRICT_MAX_URLS_PER_RUN`), and a day is 20.
- **It failed daily.**
- **It duplicated the pipeline.** The 10:05Z `run-rolling-forge-pipeline` `upstream_skater_sources` step already
  fetches the previous day with a pinned scope, resume and source_down degrade.
- **It spent NST rate limits** in the shared morning window.

The 10-07..10-18 backfill was confirmed complete first: all 20 tables on all 12 dates; all-strength, 5v5 and ES
counts equal the WGO skater counts.

## For you

- **Gap repair is now manual:** an explicit-scope URL queued on `/db/runner` (release R21/R22), which follows the
  route's 207 resume contract.
- **If you want an automatic catch-up again,** prefer a pipeline-side lookback over a second cron.
- **Rollback:** reschedule the same Vault-bearer `net.http_get` at `25 7 * * *` and restore the 07:25 entry in
  `NST_ACTIVE_DIRECT_CRON_STARTS`.
- **Observed today:** a 500 "NST explicit progress read is unconfirmed; admission stopped." at 14:02Z during
  TJ's backfill. The `cron_job_audit` read filtered on `details->nstProgress->>scope` failed; there were 0 NST
  requests and 0 rows, and the rerun resumed. If it recurs, the lookup may need an index or a narrower filter.

## Release coupling (found 2026-10-22 while gating R24, not pushed)

- **The constant change can't ship to master on its own.** On master `6d5664f76`, `resolveSharedSmallDateBurstPlan` still
  requires `scheduleClearance.allowed` to burst. Removing the 07:25 entry there would pin `update-nst-gamelog` to
  21 s spacing, which also slows the pipeline's nightly NST step and every backfill.
  `__tests__/pages/api/v1/db/update-nst-gamelog.test.ts` catches this: 4 failures.
- **Ship it together with octoberBranch's advisory clearance** (`e89dfdde5`, "Fix NST bounded bursts…").
  `cron-schedule.md` (job 79 inactive, job 399 added) and the cron count tests go in the same release.
- **Until then,** master's schedule doc still lists job 79 as active and lacks job 399. Production is unaffected,
  because the job state lives in pg_cron.


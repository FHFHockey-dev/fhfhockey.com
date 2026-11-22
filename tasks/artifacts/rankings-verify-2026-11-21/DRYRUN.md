# Paired dry run at D = 2026-11-19 · Nov 21 2026

TJ approved the read-only dry-run pair (wrap-up button "Run dry runs"). Both passed every first-marked-publish criterion. **Nothing was published.**

**Where:** `next dev` on `127.0.0.1:3110`, from a clean `git archive` of the deployed SHA `f47905d28718f6910d7acfa1471517c0235775de`. It used local-loopback admin trust (`invokedByLocalDev`), with `node_modules` and `.env.local` symlinked from the canonical checkout. TJ's `:3000` and its `.next` were untouched. The server was stopped by its exact PID afterwards.

| Step (UTC) | Route | Result |
|---|---|---|
| 17:45:53 | `update-entity-metric-rankings?season=20262027&dryRun=true` | 200 in 23.1 s. `publication.marked=true`, no `notMarkedReasons`. One D = **2026-11-19** in all 4 windows (season, last 5/10/20). 13,328 rows per window = 784 skaters × 17 metrics, 53,312 total. `writtenEntities` 784 = `expectedEntities` 784 in every window. No blockers or unavailable metrics. All 68 window/metric freshness entries are at 2026-11-19 (rolling written 2026-11-21 11:54:20 UTC). |
| 17:46:27 | `update-skater-composite-ratings?season=20262027&as_of_date=2026-11-19&dryRun=true` | 200 in 13.0 s. `publication.ready=true`, no blockers. `snapshotDate` 2026-11-19. 784 rows = `sourceCoverage.expectedPlayerCount` 784. Coverage verified (12,887 source rows scanned, 0 stale or missing players). 783 scored, 1 unscored. `pp_points_per_60` is unavailable at 5v5, as in the Nov 15 dry run. |

Compared with the Nov 15 dry runs (D = Nov 14), the cohort grew from 775 to 784, and both surfaces agree on 784.

**Writes:** `rowsUpserted` 0 and `dbWrittenRows` null on both. Each route's `withCronJobAudit` wrapper inserted its normal `cron_job_audit` row (2 rows). Readback SQL (SELECT 8 of the 10 approved) found:
- the same five Nov 14 `complete` markers with unchanged `updated_at`;
- 0 Rankings rows and 0 composite rows after Nov 14.

**Still not covered:** the K1 readiness gate (NST terminal audits, final boxscore heads, single-revision proof). The dry runs check builder-level coverage only.

**Next (separate approval):**
1. Rankings write `dryRun=false&as_of_date=2026-11-19`. Pass: `publication.complete`, `dbWrittenRows` = 53,312.
2. Composites write `dryRun=false&as_of_date=2026-11-19`. Pass: `completion.status=complete`, 784.
3. Readback of the 5 markers and physical rows.
4. 2 live GETs (page-default matrix and team=EDM at Nov 19).

The Nov 15 writes took 85.4 s and 23.7 s. Live keeps serving Nov 14 until both markers at Nov 19 complete.

Receipts: [rankings-dryrun.json](dryrun/rankings-dryrun.json) · [composites-dryrun.json](dryrun/composites-dryrun.json)

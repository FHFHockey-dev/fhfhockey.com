# G6 findings: sustainability, variance, sKO

Auditor: read-only worker, 2026-10-17. HEAD `ceceb407a`, production `457435eb`.

## (a) Coverage

- Completed rows in group: **681**. Per-source counts of `[x]` rows:
  - prd-sko-charts 25
  - sko-modeling-notes 37
  - sustainability-trends-plan 19
  - barometer 95
  - model 86
  - trends-audit 51
  - three-pillars 83
  - skater-variance 94
  - variance-section 54
  - variance v2 67
  - tasks-prd-sko-charts 70
- Rows audited in depth: **about 95 rows**, plus 14 master rows. Several rows are audited as clusters of consecutive ids that share one code path. Each cluster is listed by explicit ids in the table.
- Selection order:
  1. every master row in the group: 3.4, 3.5, 4.2, 4.3, 4.5, 4.14, 5.6, 5.6.1-5.6.3, 5.7.22, 5.7.26, 5.7.27;
  2. every completed row marked P0 or P1;
  3. rows whose owning code changed after the completion date. The group's code is byte-identical between `457435eb` and HEAD, except `web/lib/projections/*` and `web/lib/sources/*` (A-3P/Start Chart). The sustainability, variance and sKO directories differ from production only by today's uncommitted `incremental.ts` and `rebuild-score.ts`;
  4. a spread sample across all 11 sources.
- Nothing in G6's sustainability, variance or sKO code was touched by `7f094c8e6`. None of these paths is in `accepted_base_overwritten`. There are therefore **0 REGRESSED** rows. The incremental-skip bug has existed since `fbaf45caa` (2026-07-23) and is identical in production, so those rows are CONTRADICTED, not REGRESSED.

## (b) Table

Verdicts: V = VERIFIED, C = CONTRADICTED, S = STALE-EVIDENCE, U = UNVERIFIABLE-OFFLINE.

### Master rows (ledger lines in the master file)

| row | line | verdict | evidence | note |
|---|---|---|---|---|
| 3.4 A-3P (open) | 429 | V | Source list is 83/85; the open rows are C0066 and C0069 | Count agrees. The children `13.1` and `13.2` are U (see below) |
| 3.5 A-SUST (open) | 430 | V | Model source is 86/89; the open rows are C0073, C0077 and C0088 | Count agrees. C0071 is S and C0089 is U |
| 4.2 B-SUST-BAR | 449 | **C** | `web/lib/sustainability/incremental.ts:34-68` at HEAD and `457435eb`; `rebuild-score.ts:57-60`; `web/vercel.json:50-61` | "95/95" is overstated. The scheduled score chain loses its offset-250 and offset-500 batches (rows C0044, C0045, C0053, C0075, C0090) |
| 4.3 B-SUST-AUD (open) | 450 | V | 51 completed, 7 open (C0044, 48, 49, 50, 51, 52, 55) | Count agrees. The audit rows below are V, S or U |
| 4.5 B-SKO | 452 | V | 70/70; code and tests below; `get-predictions-sko.ts`, `update-predictions-sko.ts` and `update-sko-stats.ts` are identical to production | The Production-observation items are U. The ledger-integrity note on the imported sKO PRD and notes rows is under "Top problems" |
| 4.14 B-SKO-BURN | 465 | V | `web/lib/predictions/legacyQuarantine.ts`; `useQuarantinedPredictionsSko.ts`; `pages/skoCharts.tsx` is noindex and quarantined | Minor overstatement on C0044 (see below) |
| 5.6 C-VAR | 501 | V | Variance code is unchanged since production | See 5.6.1 and 5.6.3 |
| 5.6.1 | 502 | S | `pages/variance/skaters.tsx:300-410` implements the NEW 12.0 behavior; tests: `skaterMetrics.test.ts:178` and `:228`, 22 tests in the cohort | The cohort is 11+6+2+3 = 22 and matches. No test covers page-level partial-failure (12.0, P1). Behavior is correct but untested |
| 5.6.2 | 503 | V | `GoalieLeaderboard` and `goalieMetrics.test.ts:397-412` (aria-sort); `pages/goalies.js` redirect | |
| 5.6.3 | 504 | V | `variance-runbook.md:118`; `SkaterPage` | |
| 5.7.22 | 527 | V | `legacyQuarantine.test.ts`; `rg` finds no consumer of `components/Predictions` or the hook outside the registry; `modeling/` has no sKO files | Deleted in `abbc01e8c5` on 2025-09-28 |
| 5.7.26 | 531 | V | The 25 reader and writer tests are in `__tests__/pages/api/v1/ml/*sko*.test.ts` and `db/update-sko-stats*.test.ts`; Chef's run passes them | |
| 5.7.27 | 532 | **C** | Same as 4.2 | "bounded/paginated readers and writers" is false for the source-advance reader. It uses a global `limit(100)` on `computed_at` and skips batches wrongly |

### Sustainability barometer (`tasks-prd-sustainability-barometer.md`)

| row | line | verdict | evidence | note |
|---|---|---|---|---|
| C0044 (5.1 incremental/locking supplied by source-advance detection) | 3694 | **C** | `incremental.ts:39-65`, `rebuild-score.ts:55-68` | The incremental gate drops batches (see C0045). The queue path is fine because it passes `force=true` (`process-recompute-queue.ts:117`) |
| C0045 (5.2 skip only already-processed source work) | 3695 | **C** | `incremental.ts:39-65` at HEAD and `457435eb`; `vercel.json:50-61`; test gap: `incremental.test.ts:1-45` (HEAD) covers the pure classifier only and `rebuild-score.test.ts:28` mocks the detector | After offset 0 writes today's cutoff, the next 250/500 requests read the newest 100 rows by `computed_at`. They see the new cutoff and return `source_already_processed`. Only players 0-249 are scored per source-advance day |
| C0090 (NEW 12.0 P1 scheduled-pipeline completeness) | 3740 | **C** | Chunking is correct: `persist.ts:44-65`, `score.ts:277-286`, `persist.test.ts:14,72`. Completeness is not | Pagination and 400-row chunks are verified. "Scheduled-pipeline completeness" is false for the score stage |
| C0094 (NEW 16.0 canonical key first) | 3744 | V | `incremental.ts:6-17`; test `incremental.test.ts:30-45` | The key fix is correct. It did not address the batch-scope defect |
| C0053 (5.10 runbook documents the chain) | 3703 | **C** | `SUSTAINABILITY-RUNBOOK.md:82-90` | It describes "three ordered `rebuild-score` pages" as working. In effect, one runs on a source-advance day |
| C0075 (8.4 existing nightly `runAll=true` score job runs drift check) | 3725 | **C** | `vercel.json:50-61` has offset pages only. `rebuild-score.ts:205` runs drift only when `runAll && !dry`. `cron-schedule.md:496-510` shows pg_cron jobs 370/371/372 `active:false` (08-03 inventory, `:473-476`) | No active nightly `runAll` job. The scheduled score chain never emits drift, distribution snapshots or quintiles |
| C0048 (5.5 snapshots and quintiles via direct run or finalizer) | 3698 | V | `rebuild-score.ts:146-170` (HEAD), `process-recompute-queue.ts:75-98`, migration `20260725223034:236` | Correct as stated. Caveat: the daily Vercel chain uses neither path (see C0075). `sustainability_quintile` should be null on scheduled rows (U-3) |
| C0046 (5.3 400-row fail-fast batches) | 3696 | V | `persist.ts:44-65`, `score.ts:277`, `persist.test.ts:14,72` | |
| C0073 (8.2 pre-clamp \|z\|>5 metadata) | 3723 | V | `observability.ts:1-28`, `score.ts:245`, `observability.test.ts:11,24` | |
| C0074 (8.3 sampled stored vs recomputed) | 3724 | V | `rebuild-score.ts:170-186`, `observability.test.ts:32` | The sample is drawn from the batch built in this run |
| C0076 (8.5 protected GET health) | 3726 | V | `pages/api/internal/sustainability/health.ts`, `health.test.ts:39,72` | Reports row counts and latest date only, so it cannot see a partial-population snapshot (monitoring gap, P2) |
| C0056 (6.2 leaderboard filters and pagination) | 3706 | V | `read.ts:300-340`, `leaderboard.ts:30-67` | Reads the latest snapshot. It currently shows a partial snapshot because of the C0045 defect |
| C0058 (6.4 `include=components` admin-only) | 3708 | V | `leaderboard.ts:127-136`, `player-read.test.ts:163-197` | |
| C0059 (6.5 ETag, 304, no-store for components) | 3709 | V | `leaderboard.ts:70-100` | |
| C0050 (5.7 SKIP LOCKED claim) | 3700 | V | migration `20260725223034:236`; `recomputeQueue.test.ts:71,116` | |
| C0089 (NEW 11.0 component-wise season arithmetic) | 3739 | V | `priors.ts:34-43`, `priors.test.ts:93` | |
| C0091 (NEW 13.0 two-decimal score contract) | 3741 | V | `guardrails.ts`, `guardrails.test.ts:52` | The 249,520-row production count is U |
| C0077 (8.6 247,024 finite scores) | 3727 | U | Production aggregate | See U-3 |
| C0093 (NEW 15.0 ordered migration applied) | 3743 | U | Migration file present in `457435eb` | See U-4 |

### Sustainability model (`tasks-prd-sustainability-model.md`)

| row | line | verdict | evidence | note |
|---|---|---|---|---|
| C0071 (4.4.1 `window` 3/5/10/25/50) | 3818 | S | `player/[playerId].ts:8,30-33` accepts 3/5/10/20 only | Contract changed by barometer NEW 14.0. The model text is stale |
| C0070 (4.4 bounded public routes) | 3817 | V | `player/[playerId].ts`, `read.ts` summary payload `.limit(100)` | |
| C0067 (4.3 bounded protected recompute) | 3814 | V | `recompute.ts:35-74` (limit 1-50, `adminOnly`) | The 500 path returns the raw `error.message` to admins |
| C0085 + C0086 + C0087 (NEW 6.x pagination) | 3832-3834 | V | `windows.ts:253-285`, `windows.test.ts:6` | The same population (`player_baselines`) is capped by the 3 cron offsets at 750 players. Last season had 694, so it is latent |
| C0074 (5.1 "24 files / 98 tests") | 3821 | S | `lib/sustainability` now has 27 test files | Counts are out of date |
| C0089 (NEW 8.0 named hot/cold 25/25) | 3836 | U | Production response | See U-6 |

### Sustainability trends audit and plan

| row | line | verdict | evidence | note |
|---|---|---|---|---|
| C0043 (NEW 1.0 P0 trend rebuild auth) | 3882 | V | `trends/player-trends.ts:80-90` (timingSafeEqual); `__tests__/pages/api/v1/trends/player-trends.test.ts:132,142,179` | |
| C0046 (NEW 4.0 P0 six writer routes) | 3885 | V | `adminOnly` on `rebuild-priors/score/trend-bands/window-z`, `process-recompute-queue` and `db/rebuild-baselines`. `trend-bands.test.ts:89` asserts 401 | The per-route tests mock `adminOnly`. The production probes are U (U-5). The shared `adminOnlyMiddleware.ts` has an uncommitted hardening, with no weakening |
| C0047 (NEW 5.0 P0 team-rating writer) | 3886 | V | `update-team-power-ratings.ts:402`; the `-new` route is a no-write stub | |
| C0045 (NEW 3.0 team-power truncation) | 3884 | V | `trends/team-power.ts:62-107`; test `:94,130` (1,001 rows) | |
| C0053 (NEW 11.0 Start Chart default skater v1) | 3892 | V | `startChartFantasyScoring.ts:39`; `start-chart.test.ts:1695,1740` | `start-chart.ts` differs from production and the `7f094c8e6` changes are unreviewed. The v1 contract is intact. The cited "3/3" count is S |
| C0054 (NEW 12.0 nested confidence drivers) | 3893 | V | `forgeSkaterContext.ts:63-80`; `forge/players.test.ts:~300-310` | |
| C0033 (4.7 Start Chart UI wrapper) | 3872 | V | `start-chart.ts:196,855-914`; `update-start-chart-projections.ts` absent | |
| C0028 (4.2 audit of `update-start-chart-projections.ts`) | 3867 | S | evidence.json: path deleted | The file was deliberately retired. The audit outcome holds |
| C0038 (5.4 audit of `update-goalie-projections.ts`) | 3877 | S | evidence.json: path deleted | Same |
| C0057 (NEW 15.0 forward repair of 1,905 rows) | 3896 | U | Production DB | See U-7 |
| C0056 + C0058 (NEW 14.0/16.0 21-run quarantine) | 3895/3897 | U | Production `forge_runs` | See U-7 |
| plan C0007 + C0013 (sandbox correlation) | 3634/3640 | V | `trendsSandbox.tsx:2376-2396,2825-2890`; `lib/trends/trendsSurface.test.ts:127,144` | |
| plan C0019 (bulk rebuild params documented) | 3646 | V | `rebuild-trend-bands.ts:120-150` | |

### Three Pillars umbrella (A-3P)

| row | line | verdict | evidence | note |
|---|---|---|---|---|
| C0013 + C0014 + C0015 (3.1-3.3 lineup hierarchy, DFO "Last Game" rejection, GDT parsing) | 3913-3915 | V | `lineupSourceIngestion.ts:1002` (`isLastGame`), `lineupSourceIngestion.test.ts`; `7f094c8e6` narrowed parsing | The change removed the unstructured ordered-roster-hit fallback and added positional-role checks. The hierarchy is intact. Behavior is narrower than originally claimed |
| C0085 (17.4 block past-date replay) | 3985 | V | `update-lineup-source-provenance.ts:47,144` | |
| C0056 + C0057 (10.3/10.4 landing aggregates plus regression) | 3956/3957 | V | `playerStatsLandingServer.ts` unchanged since production; `playerStatsLandingServer.test.ts` | |
| C0067 (13.1 `PARLAY_API_KEY` in runtime env) | 3967 | U | Vercel env | See U-8 |
| C0068 (13.2 live featured markets upsert at `source_rank=1`) | 3968 | U | Production `market_prices_daily` | See U-8. The code path exists (`update-market-prices.ts:295`) |
| C0082 (17.1 30 NHL / 14 DFO / 42 GDT rows) | 3982 | U | Production tables | See U-8 |

### Variance (v1, section, v2)

| row | line | verdict | evidence | note |
|---|---|---|---|---|
| skater C0092 (NEW 12.0 P1 background-pagination partial failure) | 4442 | S | Code is right at `pages/variance/skaters.tsx:300-410`. No test drives it: `rg` finds no test of the page or `SkaterLeaderboard` | Behavior present, untested |
| skater C0093 (NEW 12.1 P1 week-rating sort and bucket grouping) | 4443 | V | `skaterMetrics.test.ts:178-225` | |
| skater C0094 (NEW 12.2 aria-sort and ownership percent) | 4444 | V | `SkaterTable.tsx:372-378`, `skaterMetrics.test.ts:228-251` | |
| skater C0012 (2.4 std-dev consistent with goalie) | 4362 | V | `skaterCalculations.ts:74-86` (sample SD) | The skater headers say "Week Var"/"Game Var" while the values are SDs (`SkaterTable.tsx:85-86`). Goalie headers were relabeled "Std Dev". P3 label inconsistency |
| section C0053 (NEW 10.0 goalie sortable headers) | 4500 | V | `goalieMetrics.test.ts:397-412` | |
| section C0054 (NEW 10.1 route authority) | 4501 | V | `pages/goalies.js` `getServerSideProps` redirect; `variance/goalies.js` re-exports the component | |
| section C0039 (7.1 relabel SD) | 4486 | V | `goalieMetrics.ts:496` ("WoW Std Dev") | |
| v2 C0067 (NEW 11.0 neutral-proxy MVP is historical) | 4571 | V | `skaterVariance.ts` has no runtime consumer; `SkaterPage` owns the surface | |
| v2 C0029 + C0032 + C0036 (Min GP shared; tier formula in shared code) | 4533/4536/4540 | V | `varianceFilters.test.ts`, `goalieMetrics.ts`, `goalieCalculations.test.ts` | |

### sKO (`tasks-prd-sko-charts.md` and imported PRDs/notes)

| row | line | verdict | evidence | note |
|---|---|---|---|---|
| C0054 (NEW 9.1 P0 prediction writer) | 5663 | V | `update-predictions-sko.ts:704-706` (`withCronJobAudit(adminOnly(...))`) | The Production 401/401/405 proof is U-5 |
| C0058 (NEW 9.5 P0 source-ingest writer) | 5667 | V | `update-sko-stats.ts:1843` | |
| C0059 (NEW 9.6 28-column mapper) | 5668 | V | `update-sko-stats.ts:75-111`, `update-sko-stats.test.ts:144` | |
| C0060 (NEW 9.7 model-history key) | 5669 | V | migration `20260729205048:10-20`, writer `onConflict` at `update-predictions-sko.ts:613` | |
| C0061 (NEW 9.8 complete ordered reads) | 5670 | V | `update-predictions-sko.test.ts:220,241` | |
| C0062 (NEW 9.9 stale source / offseason no-write) | 5671 | V | `update-predictions-sko.ts:50,587-594`, tests `:196,427` | The 851-row Production receipt is U-9 |
| C0063 + C0068 (NEW 9.10/9.15 public reader read-only, no raw errors) | 5672/5677 | V | `get-predictions-sko.ts:3,243-256` (`serverReadonly`, fixed error) | |
| C0064 (NEW 9.11 bounded pages) | 5673 | V | `get-predictions-sko.ts:5-6,116-175` | |
| C0066 + C0067 (NEW 9.13/9.14 pipeline fails closed; 501 stub) | 5675/5676 | V | `functions/api/index.py:20-26,100-134`; `functions/tests/test_sko_pipeline.py:12-127` | Python tests are not part of the Vitest run |
| C0029 (5.1 writers fail closed) | 5638 | V | as C0054/C0058 | |
| C0030 + C0031 (5.2/5.3 reader contract) | 5639/5640 | V | `get-predictions-sko.ts`, `get-predictions-sko.test.ts` | |
| C0040 (6.6 `/skoCharts` states quarantine) | 5649 | V | `pages/skoCharts.tsx:10-60` | |
| C0044 (7.3 "registry enumerates the complete reader/UI bundle") | 5653 | **C** | `legacyQuarantine.ts:19-24` lists 6 paths. `components/Predictions/` has 10 files and there is also `components/SkoLineChart/LineChart.tsx` | The registry omits PlayerTable, MetricCards, PredictionsHeader, SearchBox, Sparkline, Stepper, SkoLineChart, and `lib/trends/sko*`. The test only checks the hook name. P3 |
| C0049 (8.2 monitoring) | 5658 | U | local lease-race fixtures; Production reader observation | See U-9 |
| C0007 / C0009 / C0011 / C0042 / C0045 / C0053 (persistence closures) | 5616-5654 | U | Migrations are in `457435eb` | Production application is U-4 |
| prd-sko-charts C0016, C0018, C0019, C0020, C0021 ("MVP shipped": Trends consumes `predictions_sko`; day-step control; candlestick detail; search click-through) | 3080-3085 | S | `pages/trends/index.tsx:1809-1814` is a reserved candlestick placeholder; `pages/trends` has no `predictions_sko` consumer; `step-forward.ts` was deleted in `abbc01e8c5` (2025-09-28) | Original completion text, not annotated retired. The source PRD header (L7) says historical-only, but the ledger text reads as current capability |
| modeling-notes C0005, C0009, C0018, C0022, C0023 ("Implemented in `score.py`", feature builder, `backfill_seasons.py`) | 3097-3115 | S | `web/scripts/modeling/{score,backfill_seasons}.py` deleted in `abbc01e8c5`; the notes header says the `[x]` is historical-only | Same pattern |
| modeling-notes C0030, C0032, C0033, C0034 (Trends list, sparkline, detail view with D3 candlestick, `components/Predictions`) | 3122-3126 | S | The UI is quarantined and unmounted (`legacyQuarantine.ts`) | Same pattern |
| prd-sko-charts C0007, C0008, C0010, C0022-C0025 | 3071-3089 | V | Writer paging, auth and audit confirmed above | C0022/C0023 production job 327 and alert wiring are U-9 |

### Rows deliberately not audited

- The Python sustainability rows (barometer C0011-C0042). Python persistence was removed and Python is offline-only; these are pure-math functions.
- Style and SCSS rows.
- The remaining A-3P product-scope rows (C0001-C0012, C0016-C0052). They are high-level contract statements with no appended evidence; only the code-backed ones above were checked.

## (c) Top problems

**1. P1, data-correctness, likely live in Production: the scheduled sustainability score chain writes only the first 250 players per source-advance day.** (C0045, C0044, C0090, C0053; masters 4.2, 5.7.27)
- `detectSustainabilitySourceAdvance` at HEAD and at `457435eb` (`web/lib/sustainability/incremental.ts:34-68`) compares the newest `player_stats_unified` date with the newest cutoff among the latest 100 `sustainability_scores` rows ordered by `computed_at`. It uses no `snapshot_date`, player batch or offset.
- The Vercel cron (`web/vercel.json:50-61`, since 2026-05-11) calls `rebuild-score` at 11:00, 11:06 and 11:12 UTC with offsets 0, 250 and 500. Offset 0 writes the new cutoff. The next two requests read those just-written rows and return `skipped: source_already_processed`.
- The latest snapshot (the one the leaderboard reads) then contains only players 0-249 by `player_id`. Window-z has no such gate and still runs all three pages.
- Introduced by `fbaf45caa` (2026-07-23). Per the standard NHL calendar the 2026-27 season has begun, so Production is likely affected from the first source-advance day. A SQL check confirms it (U-1).
- Coverage gaps: `incremental.test.ts` at HEAD tests only the pure classifier, and `rebuild-score.test.ts` mocks the detector. The uncommitted fix adds a snapshot/batch-scoped check, a `snapshot_batch_incomplete` reason, and tests.
- Residual risk in the fix: `latestProcessedSourceDate` is the max over the batch's per-player cutoffs, and each row's cutoff is that player's own latest game (`score.ts:83-110`). A batch where some players are current but others are stale can still be judged current. `force=true` is the escape hatch.
- Latent cap: three offsets cover at most 750 players, against about 694 scored last season.

**2. P2, scheduled production never produces distributions, quintiles or drift alerts.** (C0075, with C0048 caveat)
- Barometer 8.4 relies on an "active nightly `runAll=true` score job". The pg_cron `runAll` jobs 370/371/372 are `active:false` in `cron-schedule.md` (2026-08-03 inventory). The live chain uses offset pages.
- `rebuild-score.ts:146` and `:205` produce a distribution snapshot, quintiles and drift only when `runAll`. `process-recompute-queue` is not in `vercel.json`.
- Expected effect: daily rows carry a null `sustainability_quintile` and no drift check runs (U-2, U-3).
- The `/internal/sustainability/health` endpoint (C0076) reports only row counts and latest snapshot date. It would not reveal a partial-population snapshot.

**3. P3, ledger-integrity, no runtime impact.**
- imported sKO PRD/notes rows: prd C0016, C0018-C0021 and notes C0005, C0009, C0018, C0022, C0023, C0030-C0034 are `[x]` with text describing shipped scripts, UI or controls that were deleted or quarantined. They are valid only via the 2026-07-28 historical-only disposition. The source files say so in their headers; the ledger text does not.
- C0044 (5653) says the quarantine registry is "complete". It lists 6 of roughly 16 bundle files.
- C0071 (3818) and the "24 files / 98 tests" count at C0074 (3821) are stale.
- 5.6.1 / NEW 12.0 (P1) has code but no test.
- Skater table headers "Week Var"/"Game Var" show standard deviations.

## (d) UNVERIFIABLE-OFFLINE checks needed (all read-only)

- **U-1** (confirms Problem 1). Production SQL: `select snapshot_date, window_code, count(distinct player_id) from sustainability_scores where snapshot_date >= '2026-10-01' group by 1,2 order by 1 desc;`. Expect about 250 players per game day if the bug is live, versus about 690 normally. Also run `select count(*) from sustainability_scores where snapshot_date = (select max(snapshot_date) from sustainability_scores) and window_code='l10';`.
- **U-2.** Production SQL: `select jobid, jobname, active from cron.job where jobid in (370,371,372,376);`. Also read the Vercel cron list for the deployed `457435eb` to confirm no `runAll` path.
- **U-3.** Production SQL: `select snapshot_date, count(*) filter (where sustainability_quintile is null) as null_q, count(*) from sustainability_scores group by 1 order by 1 desc limit 10;` and `select max(snapshot_date) from sustainability_distribution_snapshots;`. Also: all rows finite and in [0,100] (C0077's 247,024) and the 249,520 count for NEW 13.0.
- **U-4.** `select version from supabase_migrations.schema_migrations where version in ('20260725223034','20260728225806','20260729205048');`. Plus catalog and ACL checks for the three run-control RPCs (barometer 9.x, sKO 2.2).
- **U-5.** A Vercel deployment read of `dpl_5uhfJXZagLhhhDLq2brn56xJpBTa` and `dpl_4q8GM1wqTbHR3NbnxRxAakdLEvJr` (the NEW 4.0, 5.0, 9.1 and 9.5 401/401/405 probes).
- **U-6.** One bounded GET to the trends hot/cold endpoint, to count named rows (C0089 / NEW 8.0 "25/25").
- **U-7.** Production SQL: counts of target-season rows in the NEW 15 repair (1,905 source and 49,410 trend rows over 1,830 player-dates), the 21 contaminated `forge_runs` and 1,344 missing results (NEW 14.0/16.0), and the retained 49,410-row inverse manifest.
- **U-8.** `vercel env ls` (names only) for `PARLAY_API_KEY` (13.1). `select source_rank, count(*) from market_prices_daily where provider ilike '%parlay%' group by 1;` (13.2). Lineup archive counts (17.1: 30 NHL / 14 DFO / 42 GDT).
- **U-9.** sKO Production receipts:
  - 851 rows for target date 2026-03-22 written and rolled back;
  - the 2026-07-31 offseason no-write manifest;
  - the reader's page-1-of-851 observation;
  - `cron.job` 327 and 321 state;
  - the `predictions_sko` row count.

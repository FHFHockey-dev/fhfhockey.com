# P7 — local re-verification and pending receipts

2026-10-19; `octoberBranch`, HEAD `8a6ac8adccee73fae8e07045c86b374ce8c98008`. Source/tests unchanged. Every SQL block below is **UNEXECUTED**, a proposal for a separately authorized read owner. No hosted/provider calls, backfill, empirical backtest, migration, source edit, or task-checkbox change occurred. NEW 10/13 are excluded.

The audit row wording is retained at `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-trends-audit.md:174,178–181`. Counts/digests in its bounded manifest are historical preview evidence, not current production facts. A read receipt cannot itself establish write authorization or idempotent application. After any separately authorized repair, retain pre/post and replay receipts for the same exact identities; do not overwrite those receipts. Queries referencing staged provenance columns require schema existence to have been established by the authorized owner first; a missing column is a gate failure, not authority to migrate.

Receipt size: NEW7 may return tens of thousands of target rows; all queries are separately authorized, bounded exports, not this sprint's execution plan. They are not claims of cost-free reads.

## Local checks and isolation

Inspected test bodies, package test command, Vitest config/setup, server client, and touched imports. Selected tests use injected in-memory query objects or mocked Supabase/season/audit owners; no test shells out, mutates Git, loads ignored env files, or makes a provider request. `web/lib/supabase/server.ts:44` keeps import side-effect free. `web/__tests__/vitest.setup.js:1` supplies only synthetic fallback configuration. Route PDO/final-source tests mock all database access; their new season-window wrapper falls through a mocked incomplete query and emits a warning, retained in the log. This is fixture evidence for the repair logic, not season-window coverage.

From `web/`:

```text
npm test -- --run lib/trends/playerTrendCalculator.test.ts lib/power-ratings.test.ts __tests__/pages/api/v1/trends/player-trends.test.ts __tests__/pages/api/v1/db/update-team-power-ratings.test.ts lib/sustainability/score.test.ts
PASS: 5 files, 28 tests; FOCUSED-TESTS.log:1135–1138.
npm test -- --run lib/sustainability/backtestHarness.test.ts -t "returns an honest unavailable state when no projection history exists"
PASS: 1 test, 2 skipped; HISTORY-GATE-TEST.log:11–14.
```

Chef explicitly permitted only the empty-input availability case; no other harness case ran. Shared tsc/lint were not run by P7; no code changed and Chef owns shared checks. No new regression was needed.

## C0044 / audit NEW 2.0 — expected shooting

Claim: “`individual xG / individual unblocked attempts * 100`, using `nst_ixg` and `nst_iff`”; persisted `expected_shooting_pct` stays stable.

Code: `web/lib/trends/playerTrendCalculator.ts:307–323` implements that formula and returns null for absent/nonpositive denominator; `:219` stamps the forward version. Test: `web/lib/trends/playerTrendCalculator.test.ts:6` asserts 2.5/10 = 25%, key/version/sample; `:30` covers invalid denominator. **PASS 3/3 file tests** (`FOCUSED-TESTS.log:19`).

Pending single read, target date exactly 2026-02-05, season 20252026; source history 2025-10-07 through target. This preserves the preview's cohort definition (all persisted target identities), requiring exactly eight distinct players before comparing with its frozen candidate. Export the ordered rows; do not run the audit script, which loads environment and opens a client.

```sql
WITH target AS (
 SELECT player_id, season_id, game_date, metric_type, metric_key, position_code,
        metric_label, raw_value, average_value, rolling_avg_3, rolling_avg_5,
        rolling_avg_10, variance_value, std_dev_value, sample_size, calculation_version
 FROM public.player_trend_metrics
 WHERE season_id=20252026 AND game_date=DATE '2026-02-05'
   AND metric_key='expected_shooting_pct'
), source AS (
 SELECT s.player_id,s.date,s.season_id,s.position_code,s.nst_ixg,s.nst_iff
 FROM public.player_stats_unified s
 WHERE s.season_id=20252026 AND s.date BETWEEN DATE '2025-10-07' AND DATE '2026-02-05'
   AND s.player_id IN (SELECT player_id FROM target)
)
SELECT 'target' AS kind,to_jsonb(t) AS payload FROM target t
UNION ALL
SELECT 'source',to_jsonb(s) FROM source s
ORDER BY kind,payload->>'player_id',payload->>'game_date',payload->>'date';
```

Pass: eight exact target identities, no scope expansion; all values match the canonical full-history candidate (not merely raw ixG/iff), version `player-trend-v2-full-history-source-units`; no missing/extra target. Frozen preview: 408 source rows, eight updates, zero inserts/deletes; candidate digest `6bad00e6072bce1a87d79ca92ed339c34241be183addb784050b50fc892b1104` using its exact serialization/field set (`sustainability-forge-bounded-repair-manifest.md:74–93`). Different retained source data requires a new separately reviewed candidate, not forced parity with an old digest. Replay leaves the same values/identities; this query cannot prove replay without separate authorized replay evidence.

## C0048 / audit NEW 6.0 — missing PDO

Claim: “Source nulls remain null ... observed values only ... `pdo_observation_count=0`, `pdo_missing=true`, and neutral `pdo_z=0`”.

Code: `web/lib/power-ratings.ts:268,305` preserves nulls; `:365–368,397–398` weights observed PDO; `:436–439` excludes missing values from league moments; `:564–568` assigns neutral missing PDO; `:684` derives variance flag. Test: `web/lib/power-ratings.test.ts:141–154` proves null observation count, neutral z and observed-only league mean. **PASS 4/4 file tests** (`FOCUSED-TESTS.log:18`). The variance expression is source-confirmed; the existing test does not separately assert final `variance_flag`.

Pending read: representative preview date 2026-02-05; source interval 2025-09-08–2026-02-05. Selects PDO diagnostics and persisted rating fields; diagnostics are not first-class persisted columns. PDO EWMA uses the canonical selected 25-game mixed source window, so do not infer missingness from one null source row.

```sql
SELECT 'source' AS kind,jsonb_build_object(
 'team_abbreviation',team_abbreviation,'date',date,'pdo',pdo) AS payload
FROM public.nst_team_gamelogs_as_rates
WHERE date BETWEEN DATE '2025-09-08' AND DATE '2026-02-05'
UNION ALL
SELECT 'rating',jsonb_build_object(
 'team_abbreviation',team_abbreviation,'date',date,'xgf60',xgf60,'gf60',gf60,
 'sf60',sf60,'xga60',xga60,'ga60',ga60,'sa60',sa60,'pace60',pace60,'off_rating',off_rating,
 'def_rating',def_rating,'pace_rating',pace_rating,'special_rating',special_rating,
 'danger_rating',danger_rating,'finishing_rating',finishing_rating,'goalie_rating',goalie_rating,
 'discipline_rating',discipline_rating,'variance_flag',variance_flag,
 'calculation_version',calculation_version,'source_through_date',source_through_date)
FROM public.team_power_ratings_daily WHERE date=DATE '2026-02-05'
ORDER BY kind,payload->>'team_abbreviation',payload->>'date';
```

Pass: compare all rating fields to the frozen full-input candidate; 14 exact-source teams carry v2/current source date and 18 carry-forward teams preserve prior provenance. The bounded preview has 14/14 observed PDO and **no natural missing case** (`sustainability-forge-bounded-repair-manifest.md:215–236`); its read cannot close deployed missing-source evidence. When a natural missing case appears, propose a newly bounded equivalent window for owner approval; retain a deployed diagnostic with observed count 0, missing true, z 0 and variance flag 0. No synthetic case may be presented as that natural receipt. A rating-only query cannot reconstruct the entire multi-input rating model.

## C0049 / audit NEW 7.0 — playoff units and history

Claim: “shared source adapter ... converts seconds to minutes” and mixed history produces “`11.970075` shots/60 ... two-game accumulator”.

Code: `web/lib/trends/playerTrendCalculator.ts:18–31` converts seconds /60; `:219` versions emissions. Test: `web/__tests__/pages/api/v1/trends/player-trends.test.ts:91–123` asserts 1203 seconds →20.05 minutes, raw 11.970075, average 11.985037 and sample size 2. **PASS 11/11 file tests** (`FOCUSED-TESTS.log:20`). Full-history emission also covered by `playerTrendCalculator.test.ts:71` (3/3).

Pending single read of all persisted target output columns in the exact two playoff windows, plus source shot/TOI rows and regular-history identity counts. Existing-row repair and missing-history fill remain separate approval scopes.

```sql
WITH bounds(season_id,season_start,lo,hi) AS (VALUES
 (20242025,DATE '2024-10-04',DATE '2025-04-19',DATE '2025-06-17'),
 (20252026,DATE '2025-10-07',DATE '2026-04-18',DATE '2026-06-14'))
SELECT 'target' AS kind,to_jsonb(t) AS payload
FROM public.player_trend_metrics t JOIN bounds b ON t.season_id=b.season_id
WHERE t.game_date BETWEEN b.lo AND b.hi
UNION ALL
SELECT 'playoff_source',jsonb_build_object('player_id',s.player_id,
 'season_id',s.season_id,'date',s.date,'shots',s.shots,'toi_per_game',s.toi_per_game)
FROM public.wgo_skater_stats_playoffs s JOIN bounds b ON s.season_id=b.season_id
WHERE s.date BETWEEN b.lo AND b.hi
UNION ALL
SELECT 'regular_history_count',jsonb_build_object('player_id',s.player_id,
 'season_id',s.season_id,'rows',count(*))
FROM public.player_stats_unified s JOIN bounds b ON s.season_id=b.season_id
WHERE s.date>=b.season_start AND s.date<b.lo
GROUP BY s.player_id,s.season_id
ORDER BY kind,payload->>'season_id',payload->>'player_id',payload->>'game_date',payload->>'date',payload->>'metric_key';
```

`to_jsonb(t)` intentionally exports every target column, whose local schema is `web/lib/supabase/database-generated.types.ts:23528–23549` (all values, identity, version, updated_at). This is an archive for exact offline comparison; updated_at is excluded from value digests.

Pass after separately authorized repair-only: approved existing identity set unchanged, values match frozen complete-history reconstruction, all repaired rows versioned; missing output identities remain reported separately. After separately authorized fill: candidate sets 79,704 (2025–26) and 83,592 (2024–25), no duplicate/extra identities; 2025–26 preview separates 55,233 changed existing rows and 24,300 absent rows. Candidate digests and bounds are retained in `sustainability-forge-bounded-repair-manifest.md:70–111`. Current source counts cannot retrospectively prove the historical accumulator; compare full candidate payload to retained full-history evidence, and preserve the pre/post/replay receipts. Do not label a repair-only approval as fill approval.

## C0050 / audit NEW 8.0 — requested vs observed provenance

Claim: “explicit provenance v2 ... requested snapshot, observed raw cutoff, derived window-z snapshot, season scope, and observed age”.

Code: `web/lib/sustainability/score.ts:89–107` selects observed date from as-of input; `:122–146` builds the separated fields; `:232–236` installs them in score components. Test: `web/lib/sustainability/score.test.ts:66–123` asserts requested July 22, observed April 16, derived July 22, season 20252026 and age 97 days. **PASS 2/2 file tests** (`FOCUSED-TESTS.log:1133`).

Pending single read, season 20252026; exact July 22/23 cohorts. Preserve all score/config/model data for comparison, not just provenance counts.

```sql
SELECT player_id,snapshot_date,season_id,position_group,window_code,
       s_raw,s_100,model_version,config_hash,components
FROM public.sustainability_scores
WHERE season_id=20252026
  AND snapshot_date BETWEEN DATE '2026-07-22' AND DATE '2026-07-23'
ORDER BY snapshot_date,player_id,window_code,position_group,model_version,config_hash;
```

Pass after authorized legacy repair: July 22's 2,496 false legacy rows and July 23's 1,000 false legacy rows become `components.sourceCutoffs.version=legacy_provenance_unknown`, observed/age null, old claims only under `legacy_claims`, warning retained. July 23's 1,496 proven v2 rows stay byte-identical. Scores, model/config and identities never change. Frozen v2 digest `ff50a4d963b5842acd58edf38c721cea8798c7e639e6b761002d518766f68bcc` and candidate policy: `sustainability-forge-bounded-repair-manifest.md:175–190`; builder: `web/scripts/audit-sustainability-score-provenance.ts:116–139`. Do not reconstruct a past observed cutoff from today's source table. This two-date read is representative, not season-wide repair closure; the authorized season-wide receipt must use the separately approved date manifest, not an invented broader window.

## C0051 / audit NEW 9.0 — final source before rating/carry

Claim: “default caller recompute the prior date before today's carry-forward”; explicit scope, smoke test and empty-table behavior preserved.

Code: `web/pages/api/v1/db/update-team-power-ratings.ts:98–100,120–140` selects the two-day default; `:319–334` stamps exact-source v2 and preserves carry provenance. Test: `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts:243–330` asserts prior repair then today's copied repaired values/version/source date; other tests cover explicit ranges, smoke and empty-table scope. **PASS 8/8 file tests** (`FOCUSED-TESTS.log:1132`).

Pending single natural-run read: explicit proposed observation day 2026-10-19 UTC, prior rating day October 18. This is a proposal, not a claim that a retained natural receipt exists. Logs use a 09:00–11:00 UTC bound; rating rows use October 18–19. No route invocation or cron trigger.

```sql
SELECT 'audit' AS kind,jsonb_build_object('job_name',job_name,'run_time',run_time,
 'status',status,'rows_affected',rows_affected,'timing',details->'timing',
 'response',details->'response','responseTruncated',details->'responseTruncated') AS payload
FROM public.cron_job_audit
WHERE run_time >= TIMESTAMPTZ '2026-10-19 09:00:00+00'
  AND run_time < TIMESTAMPTZ '2026-10-19 11:00:00+00'
  AND job_name IN ('/api/v1/db/update-nst-team-daily','/api/v1/db/update-team-power-ratings')
UNION ALL
SELECT 'source',jsonb_build_object('team_abbreviation',team_abbreviation,
 'date',date,'created_at',created_at,'xgf_per_60',xgf_per_60,
 'xga_per_60',xga_per_60,'cf_per_60',cf_per_60,'ca_per_60',ca_per_60)
FROM public.nst_team_gamelogs_as_rates WHERE date=DATE '2026-10-18'
UNION ALL
SELECT 'rating',jsonb_build_object('team_abbreviation',team_abbreviation,
 'date',date,'created_at',created_at,'xgf60',xgf60,'xga60',xga60,'pace60',pace60,
 'off_rating',off_rating,'def_rating',def_rating,'pace_rating',pace_rating,
 'variance_flag',variance_flag,'calculation_version',calculation_version,
 'source_through_date',source_through_date)
FROM public.team_power_ratings_daily
WHERE date BETWEEN DATE '2026-10-18' AND DATE '2026-10-19'
ORDER BY kind,payload->>'run_time',payload->>'team_abbreviation',payload->>'date';
```

Pass: retained successful final-source ingest completion precedes rating start; default rating response proves execution scope October 18→19 and no skipped outcome; final-source team rating has v2/source-through Oct18, today's carry preserves repaired core/version/date. Decode the retained JSON response string offline. Source `created_at` alone is not an update/finality timestamp; require ingest completion and scope evidence. Missing/truncated response scope means **insufficient receipt**, not pass. Schema: `database-generated.types.ts:932–940,31201–31226`; audit timing fields: `web/lib/cron/timingContract.ts:14–31`. Ingest route ownership is source-confirmed at `web/pages/api/v1/db/update-nst-team-daily.ts:111,933`; default audit job names use request paths (`withCronJobAudit.ts:222`). Confirm it agrees with retained inventory before executing; do not broaden the filter if names differ. Historical schedule ordering (09:55→10:15) remains dated evidence at audit report `:266`; this read cannot prove the historical Feb5 repair or replay.

## C0077 / C0088 — model 5.2 and model NEW 7.0 history gate

Docs: `tasks-prd-sustainability-model.md:178–180,194–195` expressly date the zero-projection claim **2026-07-11**: 0 projections versus 219,568 score rows and 10,849,256 bands. `SUSTAINABILITY-RUNBOOK.md:68–76` repeats the dated table and forbids treating scores/bands as projection history. These remain correctly stated as historical retained reads; current hosted counts are **UNKNOWN** here. The runbook's “currently publishable” conclusion must be understood at that retained evidence boundary, not as a new October read.

Code: `web/lib/sustainability/backtestHarness.ts:74–89` reports insufficient projection/actual history honestly. Test: `web/lib/sustainability/backtestHarness.test.ts:35–48`, empty rows/mock resolver, asserts zero coverage and null best-MAE/Brier; **PASS 1, SKIPPED 2** (`HISTORY-GATE-TEST.log:11–14`). No empirical evaluation ran.

Pending coverage read: bounded July11–October19 date interval, plus the retained season's dated score interval. It returns per-horizon projection coverage without pretending maturity or accuracy.

```sql
SELECT 'projection' AS kind,horizon_games,projection_type,metric_key,
 count(*) AS rows,count(DISTINCT player_id) AS players,
 min(snapshot_date) AS first_date,max(snapshot_date) AS last_date
FROM public.sustainability_projections
WHERE snapshot_date BETWEEN DATE '2026-07-11' AND DATE '2026-10-19'
GROUP BY horizon_games,projection_type,metric_key
UNION ALL
SELECT 'score',NULL,NULL,NULL,count(*),count(DISTINCT player_id),
 min(snapshot_date),max(snapshot_date)
FROM public.sustainability_scores
WHERE snapshot_date BETWEEN DATE '2025-10-14' AND DATE '2026-10-19'
ORDER BY kind,horizon_games,projection_type,metric_key;
```

A missing projection group means zero in this interval only, not all-time zero. Unblocking data: immutable genuine prospective snapshots (or separately approved leakage-safe historical snapshots) with player/snapshot/metric/horizon/type identity, expected values/distribution provenance, real future 5/10-game outcomes and exact nonleaking baseline values. Need held-out sample/date/player coverage and resolved actuals before MAE/RMSE/Brier or baseline-win claims. A nonzero count merely removes the zero-row sub-blocker; it does not qualify calibration or authorize a backtest. Model/config identity, maturity and leakage qualification remain separate evidence gates.

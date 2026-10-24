# G3-rankings-rolling findings (read-only audit, 2026-10-17)

Repo state: branch octoberBranch, HEAD `ceceb407a`. Production is `457435eb`. For this group, production equals the branch except the 3 rolling-writer files from commit `6e14053ff`. The ranking, API and component files are identical. No uncommitted change touches the group's owning code. Only unrelated files under `lib/player-forecasts` are untracked.

## (a) Coverage

- **Completed rows in group:** 948 ledger rows, all `[x]`, 0 open. By section: 467 + 123 + 63 + 32 rankings rows, and 5 + 48 + 41 + 63 + 31 + 38 + 37 rolling rows. Plus the 8 master rows 5.2 and 5.2.1–5.2.7.
- **Rows audited in depth:** 70 rows in the table below (8 master + 62 ledger).
- **Selection:**
  1. All 8 master rows.
  2. The P0 row (action-items 6.0). The rows that say P1/P2/P3 are mostly `P1`/`P2`/`P3` defense-pair labels, not severities.
  3. Rows whose code changed after the 2026-07-30 completion. I checked `git log --since=2026-07-30` for the group's paths. Relevant commits:
     - `a5ba66196` (reader/calculator/queries)
     - `26f04ef88` (select fields, URL state, matrix)
     - `9621935b9`
     - `b0d42d90d` and `1050624e6` (TOI)
     - `5740289cc`
     - `6e14053ff` (aligned count support)
     - `7f094c8e6` touches none of this group's files. `accepted_base_overwritten` lists only `skater-queries.ts` and `.test.ts` (both from `6e14053ff`) for the group.
  4. A spread sample across all 11 sections.
- **Two systematic checks beyond per-row reads:**
  - I cross-checked every column selected from `rolling_player_game_metrics`, `skater_composite_ratings`, `wgo_team_stats`, `team_underlying_stats_summary`, `goalie_start_projections` and the NST counts tables against `database-generated.types.ts`. I did the same for the `wgo_skater_stats` columns added by `b0d42d90d`. Nothing is missing.
  - I ran a scratchpad-only Proxy script that records which row fields `buildSkaterWindowAggregatesFromRollingRow` reads. All of them are inside `ROLLING_RANKING_SELECT_FIELDS`.

### `goals` column question (2026-08-01 Production anomaly)

No current code path selects `rolling_player_game_metrics.goals`.
- The Trends player page builds its select from `${metric.key}_avg_${scope}` for additive metrics, e.g. `goals_avg_last5`. See `web/pages/trends/player/[playerId].tsx:440-492`.
- `ROLLING_ROW_SELECT_CLAUSE` (`web/lib/projections/queries/skater-queries.ts:81-126`) and `ROLLING_RANKING_SELECT_FIELDS` contain no bare `goals`.
- The scripts under `web/scripts/check-rolling-*` and `audit-rolling-player-repair.ts` select `*`, explicit fields without `goals`, or a handful of identity columns.
- The test at `web/__tests__/pages/trends/player/[playerId].test.tsx:195` asserts `not.toContain("goals")`.
- `database-generated.types.ts` has no `goals` column on the table (only `goals_avg_*`, `goals_total_*`, `goals_per_60_*`).

This matches NEW-027, which attributed the error to the Trends page `SELECT_CLAUSE`. Whether the error actually stopped in production is UNVERIFIABLE-OFFLINE (see d).

## (b) Table

| row id | ledger line | verdict | evidence | note |
|---|---|---|---|---|
| master 5.2 `C-RANK` | master L476 | CONTRADICTED | Evidence says "complete paginated reads". `teamMatrix.ts:1150,1191,1265` and `goalieMatrix.ts:1080,1136` page with `.range()` ordered by a non-unique date only. `deploymentTiers.ts:489-494` has no order at all. | P2 pagination defect, plus the P1 regression below. "Production page/filter/metadata/matrix reads pass" and "62-file/339-test cohort" are UNVERIFIABLE-OFFLINE. Skater readers are fixed (see 5.2.1). |
| master 5.2.1 base initiative | L477 | VERIFIED | `rankingCalculator.ts:84-135,208-232`, `rankingQueries.ts:352-359` (order `player_id,game_id`), `entityMetricRankingReader.ts:243-249` (order `metric_key,entity_id`) | Skater paths are deterministic after `a5ba66196`. Same code as production. |
| master 5.2.2 ecosystem alignment | L478 | VERIFIED | `rankingUrlState.ts:212-233,359`, `availableFilters.ts:200-262`, `teamTokenResolver.test.ts`, `rankingUrlState.test.ts:262-290` | Semantics align. Pagination caveat is tracked on 5.2/5.2.3. |
| master 5.2.3 post-alignment audit | L479 | CONTRADICTED | The row says "complete paginated readers". See 5.2 for the team/goalie/deployment readers. The baseline schema supports "populated RLS-enabled relations" (`20260716112908_production_schema_baseline.sql:40587,41014,42729,42735,42765,42939`). | Provenance and RLS claims hold in SQL. Population and value-free Production reads are UNVERIFIABLE-OFFLINE. |
| master 5.2.4 rolling initial audit | L480 | VERIFIED | `rollingWindowContract.ts`, `rollingPlayerAvailabilityContract.ts`, `rollingPlayerToiContract.ts` (+ `b0d42d90d`), and the matching tests exist and pass in Chef's run. | Doc-only audit claims. The downstream-consumer caveat is under 5.2.7 and RB 4.6. |
| master 5.2.5 blueprint | L481 | VERIFIED | `rollingMetricAggregation.test.ts:175-420`, `rollingMetricWindowContractCases.test.ts:165-220`, `rollingHistoricalAverages.test.ts:145,281` | Fixed-appearance, availability and PP-share contracts are implemented and tested. |
| master 5.2.6 remediation implementation | L482 | CONTRADICTED | (1) `fetchRollingPlayerAverages.ts:2862-2875` pages `games` with `.order("date")` only. (2) `:4224-4248` `fullRefresh=true` defaults to `rpc_truncate` and runs even with `dryRunUpsert`, `maxPlayers` or `playerId`. (3) `rollingPlayerValidationPayload.ts:2185-2193` compares the compacted wide row. | The writer, compat, authz and P3 NEW 6.0 parts hold. Pagination, runtime-bound and validation-payload clauses are overstated. |
| master 5.2.7 pass-two debug/trends | L483 | CONTRADICTED | `fetchRollingPlayerAverages.ts:392-403,464-476` (compaction, commit `a8e1f5495d`); `trends/player/[playerId].tsx:440-492,748-753`; `debug/rolling-player-metrics.ts:24-29` (5v5 coerced to `all`) | See Top problems #1 and #5. Freshness gates, route authz and bounded daily profile are verified. |
| contextual-rankings C0119 (23.1) | 899 | VERIFIED | `rankingCalculator.ts:84-135`; tests `rankingCalculator.test.ts:61-127` | Dense rank, cume-dist-style percentile, best 100, worst 0, sole row 100. |
| contextual-rankings C0120 (23.2) | 900 | VERIFIED | same as 23.1 | |
| contextual-rankings (8.5) | 837 | VERIFIED | `rankingUrlState.ts:148-160,359-361` | L-buckets for F, P-buckets for D, invalid combo resets to `all`. |
| contextual-rankings (17.1) | 879 | VERIFIED | `next.config.js:59-60` `watchOptions.pollIntervalMs` | Also `dev:stable` exists (`package.json:14`). |
| contextual-rankings (20.4) | 889 | VERIFIED | `rollingRankingSelectFields.ts`; Proxy check passed | `shot_attempts_per_60` select, aggregator and writer allowlist agree. |
| contextual-rankings (22.1) | 895 | UNVERIFIABLE-OFFLINE | Code: `fetchRollingPlayerAverages.ts:279-282` maps 5v5 to `nst_gamelog_5v5_*`. | The "22,644 true 5v5 rows" is a June live count. See (d). |
| contextual-rankings (27.2) | 921 | VERIFIED | `resultsLuckIndex.test.ts:41-193` (current-window exclusion and peer blend) | |
| contextual-rankings (31.3) | 942 | VERIFIED | baseline `set_contextual_snapshot_updated_at` and trigger `trg_entity_metric_rankings_updated_at` (`:4557,:37357`) | |
| contextual-rankings (33.3) | 951 | VERIFIED | `rankingQueries.ts:798-805` `latest_calculable_metric`; `rankingQueries.test.ts` | |
| contextual-rankings (44.5) | 996 | VERIFIED | `skaterCompositeWriter.ts:645` upsert; `update-skater-composite-ratings.ts:174` `adminOnly`; tests exist | The "216 rows" counts are historical, not re-checked. |
| contextual-rankings (46.3) | 1006 | VERIFIED | `update-nst-gamelog.ts:33-53`; `__tests__/.../update-nst-gamelog.test.ts:216-236` | |
| contextual-rankings (54.2) | 1069 | VERIFIED | `deploymentTiers.ts:480-500` | Unordered `.range()` is safe only because one date has fewer than 1000 rows (P3 hazard). |
| contextual-rankings (57.24) | 1111 | VERIFIED | baseline PK `skater_composite_ratings_pkey (…peer_group_type, peer_group_key)` at `:32511` | |
| contextual-rankings (60.2) | 1132 | VERIFIED | `playerMatrix.ts:1055-1115` composite sort; `resultsLuckIndex.ts` | Live counts not re-checked. |
| contextual-rankings (66.2) | 1163 | VERIFIED | `rankingQueries.ts:352-359`, `deploymentTiers.ts` | |
| contextual-rankings (76.5) | 1211 | VERIFIED | `metricDefinitions.ts` registry flip, matrix tests | |
| ecosystem C0015 (3.1) | 1265 | VERIFIED | `teamTokenResolver.ts` and `.test.ts` | |
| ecosystem C0022 (4.1) | 1272 | VERIFIED | `entityMetricRankingReader.ts:226-260`; reader tests | |
| ecosystem 4.2 | 1273 | REGRESSED | `a5ba66196` (in production) removed the `entityIds` DB filter and `limit` pushdown (`entityMetricRankingReader.ts:233-252`). The reader now pages the full snapshot per metric and re-ranks in process. | Deliberate correctness fix (full-cohort ranks under request minimums). It contradicts "read only needed entity ids" and costs performance (P3). |
| ecosystem C0034 (6.1) | 1284 | UNVERIFIABLE-OFFLINE | Timings can't be read from code. | After `a5ba66196` the cost model changed, so the sub-2s claim needs re-measurement. |
| ecosystem C0041 (7.1) | 1291 | VERIFIED | `rankingCalculator.ts:100-129`; tests `:88,:113` | |
| ecosystem C0059 (10.1) | 1309 | VERIFIED | `skaterWindowAggregation.ts:96-102`; `rollingRankingSelectFields.ts` now has `pp_points_*` and `pp_toi_seconds_*`. | They were absent until `26f04ef88` (2026-10-03). PP Points/60 had no window inputs from the ranking reader before that. |
| ecosystem C0073 (12.2) | 1323 | VERIFIED | `goalieMatrix.ts:251,521-598`; `availableFilters.ts:200-207` | `under_pressure_profile` stays source-pending (`goalieMatrix.ts:335`). |
| ecosystem C0106 (17.2) | 1356 | UNVERIFIABLE-OFFLINE | A production rebuild of `entity_metric_rankings`. | See (d). |
| ecosystem C0123 (20.5) | 1373 | VERIFIED | `teamMatrix.ts:462-478`, `rankingUrlState.ts:228-230` | Metrics are live and URL-restorable. The `team_unit_toi` reader at `:1252-1274` is subject to the pagination caveat. |
| post-align C0002 (1.1) | 1378 | VERIFIED | `rankingUrlState.ts:228-230`, `rankingUrlState.test.ts:262-290` | |
| post-align C0003 (1.2) | 1379 | VERIFIED | same test iterates `publishedTeamMetricOptions` | |
| post-align (1.3) | 1380 | VERIFIED | `teamMatrix.test.ts:109-116` | |
| post-align C0009 (2.1) | 1385 | VERIFIED | `team_unit_toi: {` in `database-generated.types.ts` (1 hit) | |
| post-align C0010 (2.2) | 1386 | VERIFIED | `rg "as any" teamMatrix.ts teamUnitToiWriter.ts` returns 0 | |
| post-align (2.4) | 1388 | VERIFIED | `teamMatrix.ts:1252-1274` | Coverage fields exist. The reader's ordering is non-unique (see 5.2). |
| post-align (3.2) | 1394 | VERIFIED | Aggregator, select list, writer allowlist agree (Proxy check). | Was not true until `26f04ef88`. Whether stored PP rows carry season-window `pp_points_avg_season` and `pp_toi_seconds_avg_season` needs a SQL check (d). No test guards select-list/aggregator drift. |
| post-align (3.5) | 1397 | VERIFIED | `metricDefinitions.ts:723-755` `availabilityStatus: "planned"` | |
| post-align (4.5) | 1406 | VERIFIED | `adjustedImpactPromotionContract.test.ts` | |
| post-align (5.2) | 1409 | VERIFIED | `availableFilters.ts:200-207`, `goalieMatrix.ts:251` | |
| post-align (6.3) | 1417 | VERIFIED | `trending.ts:59-65,147-222`; `trending.test.ts:253,336` | |
| post-align (9.3) | 1437 | UNVERIFIABLE-OFFLINE | A source-health run against a local server. | |
| workstation/context.md (goalie/team Source Pending) | 1459 | VERIFIED | `__tests__/pages/rankings.test.tsx:2040-2049` | |
| rolling-averages PRD (cron validation) | 3137 | STALE-EVIDENCE | The row cites "route tests 15/15" and "audit-wrapper inventory 4/4". `update-rolling-player-averages.test.ts` now has 16 `it()`. `cron-audit-wrappers.test.ts:72` now fails (expects 47, gets 46). | The route still has method/scope validation and `withCronJobAudit(adminOnly(...))` (`:910`). |
| remediation-blueprint C0011 (2.3) | 3246 | VERIFIED | `rollingHistoricalAverages.test.ts:281` | |
| remediation-blueprint (3.2) | 3254 | VERIFIED | `rollingMetricAggregation.test.ts:175-232` | |
| remediation-blueprint (4.6) | 3267 | REGRESSED | Done in March: `trends/player/[playerId].tsx:440-459` is canonical-first with a legacy fallback. Later commit `a8e1f5495d` (2026-06-11) added `isPrunableRollingStorageField` compaction (`fetchRollingPlayerAverages.ts:392-403`). | See Top problems #1. |
| remediation-blueprint (4.7) | 3268 | VERIFIED | `rollingPlayerMetricCompatibility.test.ts` | |
| remediation-blueprint (5.5) | 3274 | VERIFIED | `rollingPlayerToiContract.ts` and `.test.ts`, `b0d42d90d` | |
| remediation C0004 (1.3) | 3305 | VERIFIED | `rollingWindowContract.ts:50-86` | |
| remediation C0006 (1.5) | 3307 | VERIFIED | `rollingMetricAggregation.test.ts:175,334,364` | |
| remediation C0009 (2.2) | 3310 | VERIFIED | `rollingHistoricalAverages.test.ts:145` | Season availability is player-centered after a trade. |
| remediation C0031 (NEW 6.0) | 3332 | VERIFIED | `update-rolling-player-averages.test.ts:151` unauthenticated denial | |
| pass-2 main C0003 (1.2) | 3338 | VERIFIED | `dryRunUpsert` and `debugUpsertPayload` in the route; `dryRunBatchObserver` (`5740289cc`) | |
| pass-2 main C0009 (2.2) | 3344 | VERIFIED | `rollingPlayerValidationPayload.ts` `toiTraceRows`, `trustTier` | |
| pass-2 main C0011 (2.4) | 3346 | REGRESSED | `rollingPlayerValidationPayload.ts:2185-2193` reads the wide row only. `compareValues` (`:600-630`) treats stored `null` vs recomputed number as a mismatch. Compaction (`a8e1f5495d`) nulls `_avg_*`, `_last3`, `_all`, `_3ya`, `_career`. | The validation console reports false mismatches for compacted fields. |
| pass-2 main C0018 (3.3) | 3353 | VERIFIED | `rollingPlayerValidationPayload.ts:66,75,1958` | |
| pass-2 main C0023 (4.1) | 3358 | VERIFIED | `rollingPlayerMetricCompatibility.ts:28-59` | |
| pass-2 main C0024 (4.2) | 3359 | REGRESSED | Same compaction. Additive metrics (goals, assists, points, shots, hits, blocks, pp_points) read only `*_avg_*`, 164 of 480 candidate field reads. 397 of 480 are prunable. | The page never reads `rolling_player_metric_support_payloads`. |
| pass-2 main C0025 (4.3) | 3360 | STALE-EVIDENCE | `update-start-chart-projections.ts` was removed in `e976df2cdd` (2026-03-29). `run-forge-projections.ts:2` and `skater-queries.ts` still use the compat helpers. | Outcome holds. The cited path is gone. |
| pass-2 main C0031 (5.3) | 3366 | VERIFIED | `fetchRollingPlayerAverages.ts:1436`, types `pp_toi_seconds_total_last5` | |
| pass-2 main C0036 (6.2) | 3371 | VERIFIED | `trendsDebug.tsx:814,847` (`includeSourceRows` true/false) | |
| trends-debug (4.4) | 3170 | VERIFIED | `trendsDebug.tsx:102,463` | Strength options are all/ev/pp/pk only. See P3 #5. |
| action-items C0002 (1.1) | 3378 | VERIFIED | `vitest.config.mts:17-18` | |
| action-items (2.5) | 3387 | VERIFIED | `run-rolling-forge-pipeline.ts` (adminOnly at `:834`) and `.test.ts` | |
| action-items (3.5) | 3394 | VERIFIED | `rollingPlayerOperationalPolicy.ts` daily 210000 ms | Runtime evidence not re-measured. |
| action-items C0037 (6.0 P0 NEW 1) | 3413 | VERIFIED | `update-rolling-player-averages.ts:910`; `utils/adminOnlyMiddleware.ts` (the file has uncommitted hardening edits by another session); `update-rolling-player-averages.test.ts:151` | Same wrapper in production. Caveat: fullRefresh truncate behavior (Top problems #3). |

**Counts:**

| verdict | rows |
|---|---|
| VERIFIED | 56 |
| CONTRADICTED | 4 (master 5.2, 5.2.3, 5.2.6, 5.2.7) |
| REGRESSED | 4 (eco 4.2, RB 4.6, PR 2.4, PR 4.2) |
| STALE-EVIDENCE | 2 |
| UNVERIFIABLE-OFFLINE | 4 (22.1, 6.1, 17.2, 9.3) |
| NOT-CHECKED | 0 |

(70 rows total.)

## (c) Top problems (ranked)

1. **P1, REGRESSED: Trends player page and the validation console read compacted-null fields.**
   - Rows: RB 4.6 (3267), PR 4.2 (3359), PR 2.4 (3346), master 5.2.7.
   - Cause: since `a8e1f5495d` (2026-06-11, in production), every writer upsert goes through `splitRollingUpsertRowForDurableStorage`. It nulls in the wide table every key matching `_all`, `_last3`, `_3ya`, `_career`, `_avg_`, `three_year_*` or `career_*` that is not in `ROLLING_RANKING_SELECT_FIELDS` plus 7 extra keys (`fetchRollingPlayerAverages.ts:380-403`, `:445-482`, `:736-757`). The values move to `rolling_player_metric_support_payloads`.
   - Only `skater-queries.ts` (FORGE) rejoins that table. The client-side Trends page selects `goals_avg_*`, `assists_avg_*`, `points_avg_*`, `shots_avg_*`, `hits_avg_*`, `blocks_avg_*` and `pp_points_avg_*` straight from `rolling_player_game_metrics` (`pages/trends/player/[playerId].tsx:748-753`). Those are legacy-only, because the additive family has no canonical field. Almost every one is a pruned field; `points_avg_season` and `pp_points_avg_season` are the only survivors.
   - Result: those Trends charts are blank for any row written since 2026-06-11. `trendsDebug` and `check-rolling-*` stored-vs-recomputed comparisons flag every pruned field as a mismatch.
   - The test `fetchRollingPlayerAverages.test.ts:1584-1600` locks in the pruning. The page tests mock full rows (`__tests__/pages/trends/player/[playerId].test.tsx`), so nothing catches it.
   - NEW-027 only fixed the select string. Data presence is UNVERIFIABLE-OFFLINE (d.1).

2. **P2, CONTRADICTED: "complete paginated reads" is false for several non-skater readers.**
   - Affected readers use `.range()` over a non-unique or missing sort key:
     - `teamMatrix.ts:1150` `team_underlying_stats_summary` (about 2.6k rows per season, 3 pages) by `game_date` only.
     - `teamMatrix.ts:1191` `wgo_team_stats` by `date` only.
     - `teamMatrix.ts:1265` `team_unit_toi` by `game_date` only (tens of thousands of rows).
     - `goalieMatrix.ts:1080` `goalie_stats_unified` by `date` only.
     - `goalieMatrix.ts:1136` `goalie_start_projections` by `game_date` only.
     - `deploymentTiers.ts:489-494` has no order at all.
     - `fetchRollingPlayerAverages.ts:2862-2875` `games` by `date` only (full-table, about 30 pages).
   - Postgres gives no tie order across OFFSET pages, so rows can be duplicated or dropped at page boundaries. That corrupts team style and top-load sums, goalie aggregates and the rolling team-game ledger.
   - The skater readers (`rankingQueries.ts:352-359`, `entityMetricRankingReader.ts:243-249`) were fixed in `a5ba66196`; the same fix was never applied to the other readers. All of this is identical in production.

3. **P2, CONTRADICTED: `fullRefresh=true` truncates the whole rolling table regardless of dry-run or scope.**
   - `fetchRollingPlayerAverages.ts:4224-4248`: default `fullRefreshMode` is `rpc_truncate`, which calls `truncate_rolling_player_game_metrics` (it also truncates the support-payload table).
   - Neither `dryRunUpsert`, `maxPlayers` nor `playerId` gates it. The route (`update-rolling-player-averages.ts:448-449,688-690`) has no confirmation gate or `confirmBroadRun` check for it, and `playerId`+`fullRefresh` is only discouraged in a comment.
   - `adminOnly` makes it fail-closed, and execute is revoked from browser roles (`20260820013124_…sql`). But the P0-class safety claims ("bounded execution", "dry-run") do not hold for this path, and the table is empty while recompute runs. No test covers `fullRefresh` (`update-rolling-player-averages.test.ts`).

4. **P3, REGRESSED: ranking reader perf and design.**
   - `a5ba66196` dropped DB-side entity and limit pushdown (ecosystem 4.2). Every request now pages the full snapshot per metric. The 6.1/6.2 timing budgets need re-measuring.

5. **P3: debug route silently coerces `strength=5v5` to `all`.**
   - `pages/api/v1/debug/rolling-player-metrics.ts:24-29` accepts only ev/pp/pk. The validation payload type and the writer support 5v5 (`StrengthState` includes it). `trendsDebug.tsx:66,102,463` omits 5v5.
   - A 5v5 inspection returns "all" data with no warning.

6. **P3, hygiene.**
   - **Select-list drift:** nothing tests that `ROLLING_RANKING_SELECT_FIELDS` covers what the aggregator reads. PP points inputs were missing from it until 2026-10-03, so stored `pp_points_avg_season` and `pp_toi_seconds_avg_season` were nulled by pruning for older rows.
   - **Error leakage:** every `pages/api/v1/contextual-rankings/*.ts` 500 handler returns raw `error.message` and `details` to anonymous callers (e.g. `teams.ts:29-36`). The FORGE routes got a stable redacted contract.
   - **Table grants:** `entity_metric_rankings`, `metric_definitions` and `skater_composite_ratings` grant INSERT, UPDATE, DELETE and TRUNCATE to anon and authenticated (baseline `:43680-43682`, `:43925-43927`, `:44531-44533`). Only RLS with no policy blocks them; TRUNCATE is not subject to RLS.
   - **Season-scoped recompute history:** `buildPlayerHistoryReadOptions` keeps `season` (asserted by `fetchRollingPlayerAverages.test.ts:1884-1896`). A recompute with `?season=` loads only that season, so `_3ya` and `_career` baselines and cross-season windows are season-limited. The daily cron does not pass `season`. This is documented in the 2026-07-22 diary entry, and I don't treat it as a defect.

7. **P3, STALE-EVIDENCE across the rolling sources.**
   - **Deleted artifacts:** about 85 cited `tasks/artifacts/rolling-player-pass-2-*.md` and `rolling-player-game-metrics-pass-2-*.md` files were deleted in `b8cb5ce41a` (2026-03-14). The old `tasks/prd-rolling-player-metrics-*` and `tasks/tasks-prd-rolling-*` files were deleted in `91ae8d31d5` (2026-04-11).
   - **Moved tests:** three tests moved under `__tests__`: `trendsDebug.test.tsx`, `debug/rolling-player-metrics.test.ts`, and `db/update-rolling-player-averages.test.ts` (now `__tests__/pages/api/v1/db/…`).
   - **Gone source:** `update-start-chart-projections.ts` was removed in `e976df2cdd`. `availableFilters.test.ts` was never created.

## (d) UNVERIFIABLE-OFFLINE checks needed (read-only)

1. **Trends/compaction impact.** Read-only SQL:
   `select strength_state, count(*) total, count(goals_avg_last5) goals_avg, count(shooting_pct_last5) ratio_canon from rolling_player_game_metrics where player_id = 8478402 and season = 20252026 group by 1;`
   Expect `goals_avg` near 0 for rows written since 2026-06-11. Repeat for another recently recomputed player, then fetch one `/trends/player/<id>` page (HTML only).
2. **PP Points/60 season-window population.**
   `select count(*) filter (where pp_points_avg_season is not null and pp_toi_seconds_avg_season is not null), count(*) from rolling_player_game_metrics where strength_state = 'pp' and game_date = (select max(game_date) from rolling_player_game_metrics where season = 20252026 and strength_state = 'pp');`
3. **Ranking relations in production.**
   - Row counts and `max(snapshot_date)` on `entity_metric_rankings`, `skater_composite_ratings` and `team_unit_toi`.
   - `pg_class.relrowsecurity` for the six tables above.
   - `information_schema.role_table_grants` for anon on the three ranking tables.
   - `has_function_privilege('anon','public.truncate_rolling_player_game_metrics()','execute')` expecting false.
4. **Percentile semantics in durable rows (ecosystem 17.2, 17.3).** `select min(percentile), max(percentile) from entity_metric_rankings where snapshot_date = <latest> and metric_key='goals_per_60' and peer_group_type='all_skaters'` expecting 0 and 100.
5. **True 5v5 volume (22.1).** `select count(*), count(distinct player_id) from rolling_player_game_metrics where strength_state = '5v5' and season = 20252026;`
6. **`goals does not exist` and the `smallint "null"` cast.** Supabase logs (`query_logs`, postgres, last 24 hours) for both strings, and the `invalid input syntax for type integer: "null"` seen in `workstation/context.md` startup logs.
7. **Performance (6.1, 6.2).** Vercel function logs for `/api/v1/contextual-rankings/matrix` and `/metrics`. Or, if a smoke budget is approved, `npm run check:rankings-matrix-performance` against a deployment. Timing is not derivable from code.
8. **Master "62-file/339-test cohort" and "Production page/filter/metadata/matrix reads".** These need the cited Production GETs (at most 5, read-only) and the original file list. They cannot be re-derived offline.
9. **Cron job 278 (rolling writer).** `select jobid, schedule, command from cron.job where jobid = 278;` to confirm it still sends no `season` or `fullRefresh` params.

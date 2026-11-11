# W2-1 audit: SQL cross-cut (every SQL function or view that computes something)

Auditor: Claude (Fable), 2026-11-11, `octoberBranch` at `6d574deab`. Read-only. No code, migration or data was changed.

`BASE` below means `supabase/migrations/20260716112908_production_schema_baseline.sql`.

## 0. Brief

- Scope: the 52 entries TRIAGE section 2 lists for the SQL cross-cut.
- For each: (a) deployed definition against the repo, (b) live readers in `web/`, `functions/`, `modeling/` and pg_cron, (c) units, season/date/game-type filters, pooled versus averaged rates, look-ahead.
- Entries already audited in Wave 1 are cited, with only the deployed-state and reader facts added.
- **Scope correction.** TRIAGE says parts 3–5 of player-forecasts and rankings-part2 hold "Codex-only SQL records". They hold none: a case-insensitive search for `sql` in those four packets returns zero lines, and every `Where` in part 5 and rankings-part2 is a TypeScript file. The Codex SQL records (`sql-runtime-assists-*`, `sql-forecast-feature-rpc`) are all merged into M-PFC-001, which is covered here.

## 1. Summary

### Verdict counts (52 entries)

| Verdict | Count |
|---|---:|
| Sound | 7 |
| Mis-specified | 26 |
| Wrong | 17 |
| Undetermined | 2 |

Reach of the 17 wrong entries: 6 live (M-TEAM-002, 003, 004, 005, 033; M-UST-006), 2 conditional (M-UST-004 on the season requested, M-TEAM-007 on a legacy page with stale data), 1 writing with no reader (M-TEAM-009), 8 dormant.

### Deployed state against the repo

- **Every baseline view and function in scope is byte-equivalent to the repo.** 62 views and 16 functions compared by md5 of the whitespace-stripped definition (method in section 6); all match.
- Hand-written migrations (`nst_percentile_as_*`, `opponent_skater_allowed_by_position`, the `analytics.*` sKO objects, `forge_served_forecast_scoreboard_daily`, `vw_entity_sustainability_scores`) were read from the catalog and match the repo expression for expression.
- `internal_stats.player_totals_unified` equals the baseline matview after the schema move (hash equal once `internal_stats.` is mapped back to `public.`).
- **In the repo but not in production:**
  - `mock_draft_adp`, `mock_draft_ingest`, `mock_draft_register`, `mock_draft_withdraw` and the `mock_draft_*` tables. Migration `20260917133519` is not in `supabase_migrations.schema_migrations`.
  - `forge_league_skater_physical_totals`. Migration `20261020211500` is not applied.
  - `player_baselines_3yr` (M-SUS-001) and `sustainability_sigma_constants` (M-SUS-037): no such relations.
  - The `sql/001_team_power_ratings.sql` matview. `team_power_ratings_daily__new` exists as a plain **table** (about 4,900 rows, never scanned since the last stats reset).
- **In production but not what the packet assumed:**
  - `analytics.mv_sko_skater_moments` is **populated** (about 7,800 rows), not `WITH NO DATA`. No cron refreshes it and nothing has scanned it.
  - `nst_percentile_as_defense_filtered` is a stale **table**, not a view. There is no `nst_percentile_as_offense_filtered`.
  - `trigger_update_team_discipline_stats` is enabled and still writing.

### Top 5 findings by user impact

1. **Game Grid goal projections still run on the all-time legacy views (M-TEAM-003, 004, 005, 033).** Wave 1 D5 stands, and I can add that cron job 390 (`update-game-goal-projections?date=all`, 08:25 UTC) is active and `expected_goals` was updated today. Decision 64 (withhold) is not yet in effect in the data path.
2. **The NST season-long views mix playoff games, and some mis-tagged games, into "season" totals (M-UST-006, 038, 039; M-WIGO-001).** Sample, one player (8478402), 2026-11-11: season 20242025 shows GP 99 and 36 goals against 67 GP and 26 goals in the regular season; 20252026 shows GP 94 against 82. The current season is clean so far (19 of 19 rows regular season). WiGO percentiles and ratings, the player radar and the Roster Matrix read these views, so every completed season is affected now, and the current one will be from the first playoff game.
3. **WiGO Game Score is wrong for season 20242025 and off-reference in every season (M-UST-004, M-WIGO-003).** The function filters `wgo_skater_stats` by `season_id` only, and that label carries rows dated 2010–2017. Sample, three players, 2026-11-11: 158 rows for player 8478402 (91 out of season), 517 for 8471214 (452 out of season), 420 for 8471675 (340 out of season). Separately, the on-ice goal terms use all strengths where the reference formula uses 5v5.
4. **`nhl_team_data` returns three rows per team (M-TEAM-002).** 96 rows for 32 teams on 2026-11-11, one per stored NST season. FORGE and the RSO bridge pick the row whose implied games played matches the standings; that works today (32 of 32), fails silently when NST lags a game, and becomes ambiguous once the current season reaches 67–70 GP, because last season's NST rows are frozen there.
5. **Two computing migrations were never applied.** FORGE's hit and block rates therefore run on the constant F/D fallback with scale 1 (`skater-queries.ts:470-474`), and the mock-draft ADP route has no function or tables to call. Both are silent: nothing reports the missing migration.

## 2. Per-entry table

Reach labels follow consolidated rule 8: **live**, **conditional**, **dormant** (deployed, no reader), **not deployed**.

### Team (packet team-ratings-power-ctpi-sos)

| ID | Verdict | Evidence | Reference | Magnitude | Downstream and reach |
|---|---|---|---|---|---|
| M-TEAM-001, 017 | Mis-specified | `sql/001_team_power_ratings.sql:4`. Not deployed as a matview; `team_power_ratings_daily__new` is an unscanned table. Crons 277 and 281 are inactive; `refresh_team_power_ratings` is the deployed stub (`BASE:3086`, hash equal). | W1-4 D12 | None | Dormant. `update-team-power-ratings-new.ts` is a disabled stub. |
| M-TEAM-002 | **Wrong** | `BASE:14244`: `nst_team_stats` joined on `team_abbreviation` only. `nst_team_stats` holds 32 rows for each of 20242025, 20252026 and 20262027, so the view fans out. | One row per team; W1-4 D11 | 96 rows for 32 teams (2026-11-11). Team ANA shows xGF/game 3.34, 2.90 and 3.50 on the same date. | **Live.** FORGE (`team-context-queries.ts:228-263`), RSO bridge (`forgeDailyBridge.ts:91-105`), ledger snapshot (`forge-served-forecast-snapshot.ts:82`). Readers choose by implied GP; see D4. |
| M-TEAM-003, 004, 005, 033 | **Wrong** | `BASE:15206, 15590, 16216, 15253`; hashes equal. Catalog dependents confirm the chain `nst_avg_* → nst_*_team_per_game, nst_league_averages → nst_att_def_scores`. | W1-4 D5; decision 64 | As W1-4 (not re-measured) | **Live.** Cron 390 active; reader `web/lib/gameGoalProjections/fetchData.ts`. |
| M-TEAM-006, 034 | Mis-specified | `BASE:21930, 15908`. Only reader of the differentials is `nst_team_scores_all_strengths`; that view has no dependent and no code reader. | W1-4 D12 | None | Dormant. |
| M-TEAM-007 | **Wrong** | `BASE:23554`: PK% subtracted, PIM added. `rolling_games` (about 2,000 rows) has had no insert or update since the last stats reset; loader cron 330 is inactive. | Any rating should reward PK | Not measured | Conditional: `web/pages/statsPlaceholder.tsx` reads it; data is stale. |
| M-TEAM-008 | Undetermined | `BASE:26567, 26618`: x60 = x × 3600 ÷ toi. No dependent, no code reader. I did not verify the `nst_team_*` TOI unit. | Per 60 from seconds | None | Dormant. Settle by reading one `nst_team_5v5` row. |
| M-TEAM-009 | **Wrong** | `BASE:5182`; trigger enabled on `wgo_team_stats`. Per-game counts are stored in `*_per_60` columns. | Column unit | Not measured | Writing, no reader: 20 inserts and 56 updates since the last stats reset; no code or view reads `team_discipline_stats`. |
| M-TEAM-010 | **Wrong** | `BASE:7205`: averages the team's own `ltg_point_pct`, anchored on `CURRENT_DATE`, over stale `rolling_games`. | Decision 21; RPC/SRS | None | Dormant. |

### Underlying stats (packet underlying-stats-summaries-part1)

| ID | Verdict | Evidence | Reference | Magnitude | Downstream and reach |
|---|---|---|---|---|---|
| M-UST-001 | Mis-specified | `BASE:11043, 11425`. Sums NST per-game GSAA, which decision 10 forbids. The snapshot matview has no refresh job and zero scans. | Decision 10 | None | Dormant. |
| M-UST-002 | Mis-specified | `BASE:11637`. Rates are pooled correctly (Σ ÷ Σ; TOI is seconds, sample 3600 for a full game). A zero denominator returns 0, not NULL. | Pooled rates; rule 5 | Rare (relief with no shots) | **Live.** `trueGoalieValue.tsx`, `socialShare/modules/goaliePeriod.ts`. |
| M-UST-003 | Sound | `BASE:11789`. League SV%, GAA and per-60s are pooled. The `avg_*` counts are per goalie-week with TOI > 0, so backups pull them down; that is a labelling point. | Pooled rates | None | Live, same readers. |
| M-UST-004 | **Wrong** | `BASE:1342-1379`: filter is `season_id` only; see D3. Formula terms are in M-WIGO-003. | — | 91 to 452 extra rows per player for 20242025 (three-player sample) | Conditional on the season requested. `WiGO/GameScoreLineChart/index.tsx:57`. |
| M-UST-005 | Mis-specified | `BASE:1386`: per-game means with no game-type filter and no minimum games. `skatersGameStats` holds preseason and playoff games (player 8478402: 34 preseason, 102 playoff, 758 regular). | Regular-season cohort with a sample floor | Not measured | **Live.** `usePercentileRank.ts:96` (WiGO Category Coverage, `/charts`), `percentile-rank.ts:34`. The SEASON option bounds dates to the regular season; the other time options do not. |
| M-UST-006 | **Wrong** | `BASE:20388, 20429` and the ES/PP/PK twins: `GROUP BY player_id, season` over `nst_gamelog_*` with no game-type filter. | NST season tables are regular season | See D1 | **Live.** Radar (`radarSeasonStats.ts`), Roster Matrix (`RosterMatrixWrapper.tsx:219`), and the rate and percentile views. |
| M-UST-007 | **Wrong** | `BASE:18890` and five twins. Ties are counted 1.5 times, and defensive rates are ranked ascending. | Mid-rank percentile | None | Dormant: no code reader; only `web/e2e/fixtures/wigo/schema.json` names them. |
| M-UST-008 | Mis-specified | Matview equals baseline. Three defects in columns nobody is shown to read: `zone_start_pct` and `zone_start_pct_5v5` are both Σ5v5 TOI ÷ ΣTOI (`BASE:23477-23478`); `nst_oi_*_per_60` divide all-strength on-ice counts by even-strength TOI (`BASE:23449-23475`); `nst_oi_off_zone_start_pct` uses OZ ÷ (OZ + DZ), while the rate views include NZ. The columns sustainability reads (counts, `nst_ixg_per_60`, `nst_icf_per_60`, `nst_hdcf_per_60`) are pooled on matching all-strength TOI. | Decision 9; pooled rates | On-ice per-60s are inflated by total ÷ EV TOI, about 1.2–1.4× for a PP1 forward (sample player: 1474 s total, 1047 s EV, 1.41×) | **Live** for the sound columns (`web/lib/sustainability/*`, cron 374 refresh). The defective columns are dormant; `bandService.ts:151` selects `*` but `bandCalculator.ts` does not use them. |
| M-UST-009 | Mis-specified | `BASE:27290, 27556`: `percent_games` = GP ÷ the current team's GP. | Decision 16 (team of record by date) | Traded players only | **Live.** `PlayerRadarChart.tsx`, `radarSeasonStats.ts`. |
| M-UST-010 | **Wrong** | Both overloads deployed and equal to the repo. "PDO" is a ratio of sums; the `(int,int)` overload uses calendar year as season. | PDO = SH% + SV% | None | Dormant: no caller. |
| M-UST-038 | Mis-specified | `BASE:20472, 20514`: per-60s are pooled correctly (seconds confirmed). OZS% = OZ ÷ (OZ + NZ + DZ) at `BASE:20558`; zero denominators return 0, 50 or 100. Inherits D1. | Decision 9; rule 5 | OZS% is lower than NST's by the NZ share | **Live** through the percentile views and the Roster Matrix. |
| M-UST-039 | Mis-specified | `BASE:20567` and twins; duplicates the rate views and inherits D1. | — | None | Dormant. |

### WiGO, lines, misc

| ID | Verdict | Evidence | Reference | Magnitude | Downstream and reach |
|---|---|---|---|---|---|
| M-WIGO-001 | Sound | Pass-through joins. The AS views match migration `20261104011002`. They inherit D1 and the OZS% definition from their sources. | — | See D1 | **Live.** `fetchWigoPercentiles.ts`, `fetchWigoRatingStats.ts`, `fetchWigoPlayerStats.ts`. |
| M-WIGO-003 | Mis-specified | `BASE:1352-1366`. Shot-attempt terms are already 5v5 (sample: `sat_for` 19 against NST all-strength on-ice CF 25 for the same game). Goal terms add ES + PP + SH on-ice goals. Games with any NULL component are dropped. | Luszczyszyn Game Score: 5v5 CF/CA and GF/GA | +0.15 per PP on-ice goal for; about +0.05 a game for a PP1 regular (estimate, not measured) | **Live.** WiGO "Game score" card. The 5 and 10 game rolling means are TypeScript and were not re-audited. |
| M-LINE-001 | **Wrong** | `BASE:26405`: `team_pp_toi` is the sum of player PP seconds, so a share tops out near 0.2 and `pp_toi60_recent` is a scaled share, not a rate. | Share of team PP clock | None | Dormant: no dependent, no code reader. |
| M-LINE-002, 004 | Mis-specified | `BASE:2866-3068`, hash equal. Slot label comes from the roster position (`BASE:2908-2913`); forwards whose roster position is not L/C/R are dropped. PP share is games on that unit ÷ games on PP1 or PP2, not ÷ games dressed (`BASE:3040-3056`). | Share of games dressed | A player on PP1 in 3 of 20 games shows PP1 = 100% | **Live.** Cron 391; readers `stats/player/[playerId].tsx:1079`, `StarterBoardPlayerDetails.tsx`, `draft-ranker/discoveryServer.ts`, `modeling/player_forecasts/season.py`. |
| M-LINE-013 | Sound | `BASE:26007`: generated ratio with a null guard. | — | None | Live: `rankings/teamMatrix.ts`. |
| M-MISC-001 | Sound | `BASE:4360`. | z-score | None | Dormant: no caller. |
| M-MISC-002 | Mis-specified | `BASE:8685`: no game-state filter, so an unplayed or in-progress game with equal scores is `TIE`; OT and shootout losses are `LOSS`. | Decision 21 (final only); decision 46 | Not measured | **Live.** `splitsServer.ts:381`, `LineCombinations/utilities.ts:553`, `modeling/player_forecasts/season.py:540`, `daily_board_data.py:27` (which guards with WIN/LOSS = 2). |

### FORGE, forecasts, goalies

| ID | Verdict | Evidence | Reference | Magnitude | Downstream and reach |
|---|---|---|---|---|---|
| M-FRG-001 | Sound | Deployed text equals migration `20261019211444`. Regular season (`g.type = 2`), pooled sums, populated, refreshed by cron 398. The 500-day window is date-bounded, so the mislabelled 20242025 rows cannot enter. | Pooled totals | None in SQL | **Live.** `forgeDailyBridge.ts:789`. The consumer defect is W1-6 D19. |
| M-FRG-002 | Sound | Design is date- and season-bounded, pooled, strictly before the cutoff. | — | Unknown effect of the fallback | **Not deployed.** FORGE uses constant priors with scale 1 (`skater-queries.ts:470-474`). See D5. |
| M-FRG-003 | Mis-specified | Deployed text equals the migration. Probabilities are scored by mean absolute error; conditional and unconditional rows are pooled; the `dressed` count is per date and class but repeated on every `source` row. | Decisions 41 and 65; W1-6 D30 | None | Dormant: no reader. |
| M-PFC-001 | Mis-specified | Deployed 4-argument version equals `20260805003121`; the 3-argument version is gone. Beyond W1-8: the roster is `rosters.is_current`, not the roster at the cutoff (`:29`); the cutoff is game start time, not knowledge time (`:60`); every call scans all regular-season `skatersGameStats` history with a lateral `shift_charts` lookup. | Rule 10; decision 34 | Not measured | Conditional: `player-forecasts/serving.ts` (native path, unserved per decision 38). |
| M-GST-001, 003 | **Wrong** | `process_team_goalie_projections` is deployed and equals the repo; the coordinator is the deployed tombstone. | W1-5 D9 | As W1-5 | Dormant: no caller. |

### Sustainability, sKO, draft

| ID | Verdict | Evidence | Reference | Magnitude | Downstream and reach |
|---|---|---|---|---|---|
| M-SUS-001 | Mis-specified | `migrations/20250930_add_baseline_3yr_career.sql:8`; weights are not renormalised for short histories. | Decision 34 | None | Not deployed. |
| M-SUS-002 | Mis-specified | `BASE:25682`, hash equal. Joins `player_baselines` on the exact snapshot date; built on the blended formula decision 32 retires. | Decision 32 | None | Dormant: no dependent, no reader. |
| M-SUS-037 | Undetermined | `sustainability_sigma_constants` does not exist in production, so `functions/lib/sustainability/constants.py` runs on its in-code fallback. `model_sustainability_config` has one row; I did not read it (jsonb rule). | — | — | Settle with an approved read of that one row. |
| M-SUS-038 | Mis-specified | `20260725223034:325-346`. Quintiles are pooled across positions. The inventory's cross-version lead does not hold: the table key is `(player_id, snapshot_date, window_code)`, so there is one row per key. Equal scores can land in different quintiles (tie-break on player id). | Decisions 32 and 68 | Not measured | **Live.** `process-recompute-queue.ts:76`. |
| M-SUS-039 | **Wrong** | Deployed text read: `s_raw ≥ 0.75 → 'overperforming'`. | W1-9 (direction inverted) | None | Dormant: no reader. |
| M-SKO-001 | **Wrong** | Deployed text read. Player and league medians span every game ever stored, so any historical z-score sees the future. League stats null out zero SH%; player stats do not. The base view joins NST on `date_scraped = date` with no season or game-type filter. | Decision 34 | None | Dormant: quarantined (`legacyQuarantine.ts:125-130`); populated but unscanned. |
| M-SKO-002 | Mis-specified | Deployed text read: κ = 30; median and MAD are shrunk with the same weights. | — | None | Dormant. |
| M-SKO-003 | Mis-specified | Deployed coefficients equal the packet; hard-coded, not read from `sko_model_v1`; a NULL z becomes 0. | — | None | Dormant. |
| M-SKO-016 | Mis-specified | Hash equal. Baseline seasons are hard-coded to 2021-22 through 2023-24 (`20260730233451:790-801`). I did not verify the streak-lag lead. | — | None | Dormant: no runtime caller. |
| M-DRF-001 | Mis-specified | Hashes equal for all three functions. Seed order puts every preseason-ADP player ahead of every fallback average-pick player, whatever the values (`BASE:1795-1808`). Order-key arithmetic is sound. | One ordinal scale needs one source | Not measured | **Live.** `draft-ranker/server.ts`, `healthServer.ts`. Left to W2-5 for depth. |
| M-DRF-002, 004 | Mis-specified | `20260917133519:113-151`. "ADP" is the mean pick at which the human seat took the player; bot picks and drafts where he went to a bot are excluded. Snake-seat validation is correct. | ADP = average pick over all drafts | None | **Not deployed.** `mockDraft/api.ts:72,148` would fail. |
| M-DRF-047 | Sound | `BASE:4373`, hash equal. Trigram similarity ≥ 0.25; a search rule, not a hockey calculation. | — | None | Live: `draft-ranker/server.ts`, `fantasy-projections/identityResolution.ts`. |

## 3. Defects, fixes, tests, priority

Coefficients and thresholds in the fixes are hypotheses (rule 12). No object is to be dropped because of these findings (rule 6).

### P0: user-visible wrong numbers now

**D1. NST season-long views include playoff and mis-tagged games** (M-UST-006, 038, 039; M-WIGO-001). Live for every completed season; conditional for the current one.
- Evidence (player 8478402, 2026-11-11): season 20242025 has 85 game-log rows, of which 67 regular season, 17 playoff, 1 with no matching game; `gp` sums to 99, so some rows carry `gp` > 1. Season 20252026 has 90 rows (82 regular, 7 playoff, 1 unmatched), with the earliest dated 2025-05-28, which belongs to the previous season. Season 20262027: 19 rows, all regular.
- The client already knows part of this: `fetchWigoPercentiles.ts:154-155` replaces an impossible GP with the WGO value. That repairs the GP display only; rates and the percentile cohort keep the extra games.
- Fix: restrict the eight `*_counts` and `*_counts_oi` views to regular-season games (join `games` on team and date, or add a game-type column at ingest), and correct the season tag at ingest. Decide separately whether playoffs get their own views.
- Readers to re-test: WiGO percentiles and ratings, radar, Roster Matrix, `nst_seasonlong_combined_*`.
- Test: for a frozen fixture of one player with regular-season and playoff rows, the view's `gp` and goals equal the regular-season sums recomputed from the fixture.

**D2. Game Grid legacy views are still the live source** (M-TEAM-003, 004, 005, 033). This is Wave 1 D5 and decision 64; nothing new in the maths. New fact: cron 390 is active. The fix plan must include the cron and `expected_goals` readers, not only the views.

### P1

**D3. Game Score returns out-of-season rows for 20242025** (M-UST-004). Conditional on the season requested.
- Cause: `wgo_skater_stats.season_id = 20242025` on rows dated 2010–2017 (the defect noted in `20261020211500:4-5`, "data fix on hold").
- Fix: bound by date as well as season, as `forge_league_skater_physical_totals` does, then repair the labels.
- Other season-only readers of that table need the same check; `opponent_skater_allowed_by_position` and `player_totals_unified` are safe because they are date-bounded.
- Test: for a fixture with one mislabelled row, the function returns only rows inside the season's dates.

**D4. `nhl_team_data` fans out to one row per stored NST season** (M-TEAM-002). Live, currently masked.
- Readers select the row where `xga ÷ xga_per_game` is within 0.5 of the standings GP. Today 32 of 32 teams match the current season and none match an older one.
- Failure modes: (1) NST one game behind the standings gives no match, and the team silently loses its prior (bridge: `continue`; FORGE: `null`); (2) at 67–70 GP the frozen 20252026 rows also match, so the bridge drops the team and FORGE takes the smaller gap.
- Fix: add `ns.season = ls.season_id` (W1-4 D11) and keep the reader check as a guard that reports, not one that silently drops.
- Test: the view returns exactly one row per team; a reader given two candidate rows raises a named state.

**D5. Unapplied migrations leave two calculations on silent fallbacks** (M-FRG-002; M-DRF-002, 004).
- FORGE physical totals: decide to apply `20261020211500` or to record the constant-prior fallback as the production method. Either way the run should report which one it used.
- Mock draft: the API has no backing objects. Confirm whether the feature is released.
- Test: a FORGE run records `rpc_missing` in its metadata when the function is absent.

**D6. Game Score goal terms are all-strength** (M-WIGO-003). Live. Either use 5v5 on-ice goals, matching the shot-attempt terms and the reference, or label the card as an FHFH variant. Test: recompute one fixture game from its components.

**D7. Lineup deployment shares use a different denominator per group, and forwards are labelled by roster position** (M-LINE-002, 004). Live. Fix: share = games in the slot ÷ games dressed, with the PP "no unit" remainder explicit; take the slot from the line card order. Test: a fixture player with 3 PP1 games in 20 dressed shows 0.15.

### P2

- **D8. `get_skaters_avg_stats` has no game-type filter and no sample floor** (M-UST-005). Add `games.type = 2` and a minimum-games parameter; test with a fixture holding one preseason game.
- **D9. OZS% includes neutral-zone starts** in `nst_seasonlong_*_rates_oi`, against decision 9 (M-UST-038). Zero-denominator defaults of 0, 50 and 100 should be NULL (rule 5).
- **D10. `player_totals_unified` column defects** (M-UST-008): `zone_start_pct` holds the 5v5 TOI share; `nst_oi_*_per_60` use the wrong TOI. No reader found, so fix or remove the columns before anything starts using them.
- **D11. `gameOutcomes` has no final-state filter** (M-MISC-002). Add the game state; note that `LineCombinations/utilities.ts:523` also counts a missing outcome as a win, which belongs to the lines audit.
- **D12. `percent_games` uses the current team's games** (M-UST-009); decision 16 applies.
- **D13. Sustainability quintiles are pooled across positions** (M-SUS-038); decisions 32 and 68 apply.
- **D14. `goalie_weekly_aggregates` returns 0 for empty denominators** (M-UST-002).
- **D15. Draft seed mixes two ADP sources by precedence** (M-DRF-001); the mock "ADP" is human-seat picks only (M-DRF-002, 004). Label both.
- **D16. Dormant wrong objects**: `team_discipline_stats` trigger (still writing), `power_rankings`, `combined_sos`, `vw_pp_unit_share_recent`, the `*_filtered` percentile views, `get_aggregated_player_stats`, `process_team_goalie_projections`, the sKO analytics objects, `vw_entity_sustainability_scores`, `forge_served_forecast_scoreboard_daily`, `goalie_totals_unified(_snapshot)`. Inventory only; each needs its own cleanup decision.

## 4. Owner questions not answered by decisions 1–68

1. **NST season-long views:** regular season only, with playoffs in separate views? (Recommended: yes.)
2. **Game Score:** follow the published 5v5 formula, or keep all-strength on-ice goals and label it an FHFH variant?
3. **`forge_league_skater_physical_totals`:** apply the migration, or make the constant fallback the documented method?
4. **Mock-draft ADP:** is the feature released, and is "mean pick by the human seat" the intended meaning of ADP?
5. **PP deployment share:** share of games dressed, or of games on a PP unit?
6. **`wgo_skater_stats` season labels:** may the on-hold data repair for the 2010–2017 rows be scheduled?
7. **`team_discipline_stats` trigger:** it writes wrong-unit rows on every team-stats upsert and nothing reads them. Disable it now, or leave it until the cleanup inventory?

## 5. Limits

- Magnitudes are dated samples (2026-11-11) on one to three players or one date; none is a population rate.
- Not verified: the `nst_team_*` TOI unit (M-TEAM-008); `model_sustainability_config` contents (jsonb, not read); whether playoff rows exist in the ES/PP/PK game logs (inferred from the shared ingest and the client comment about GP 102, measured only for all-strength); the sKO streak-lag lead; the TypeScript halves of M-WIGO-003, M-DRF-004 and M-LINE-004.
- Reader search was a fixed-string search of `web`, `functions`, `modeling` and `webhooks`, excluding tests, generated types, e2e fixtures, Markdown, SQL and JSON. Dynamic table names would be missed. `pg_stat_all_tables` scan counts are since the last statistics reset, whose date I did not read.
- Wave 1 magnitudes for cited entries were not re-measured.
- `pg_stat_activity` showed 0 other active queries before each data read. No jsonb or payload column was read; no write, NST, NHL or Yahoo call was made.

### Reproduction

Definition diff (repo side), run from the repository root:
- Views: for each `CREATE [OR REPLACE] [MATERIALIZED] VIEW` in `supabase/migrations/*.sql` (last definition wins), strip a trailing `WITH [NO] DATA` and `;`, remove all whitespace, take md5.
- Functions: body between the dollar-quote tags, whitespace removed, md5.

Catalog side (project `fyhftlxokyjtpndbkfse`):

```sql
-- views and matviews (search_path emptied so names are schema-qualified like pg_dump)
set search_path to '';
select n.nspname, c.relname, c.relkind,
       md5(regexp_replace(rtrim(pg_catalog.pg_get_viewdef(c.oid), ';'), '\s+', '', 'g'))
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v','m','r') and c.relname ~ '<scoped names>';

-- functions
select n.nspname || '.' || p.proname || '/' || p.pronargs,
       left(md5(regexp_replace(p.prosrc, '\s+', '', 'g')), 8)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in (<scoped names>);

-- applied migrations, cron jobs, view dependents, table activity
select version, name from supabase_migrations.schema_migrations where version in (...);
select jobid, schedule, active, left(command, 220) from cron.job where command ~* '(...)';
-- dependents: pg_depend joined to pg_rewrite on classid = 'pg_rewrite'::regclass
-- activity: pg_class.reltuples with pg_stat_all_tables seq_scan, idx_scan, n_tup_ins, n_tup_upd
```

Data reads (all by primary key, player id or a 32-to-96-row table):

```sql
-- D4
select season, count(*), min(gp), max(gp), max(updated_at) from nst_team_stats group by season;
select season_id, count(*), count(distinct team_abbrev), max(date) from nhl_team_data group by season_id;
select ns.season, count(*), count(*) filter (where abs(ns.gp - d.games_played) < 0.5)
from (select distinct team_abbrev, games_played from nhl_team_data) d
join nst_team_stats ns on ns.team_abbreviation = d.team_abbrev group by 1;

-- units and strengths, player 8478402, dates >= 2026-10-25, limit 4
select w.date, w.toi_per_game, w.ev_time_on_ice, w.pp_toi, w.sat_for, w.sat_against, nc.toi
from wgo_skater_stats w left join nst_gamelog_as_counts nc
  on nc.player_id = w.player_id and nc.date_scraped = w.date
where w.player_id = 8478402 and w.date >= '2026-10-25' order by w.date desc limit 4;
select date_scraped, toi, cf, ca from nst_gamelog_as_counts_oi
where player_id = 8478402 and date_scraped >= '2026-10-25' order by date_scraped desc limit 4;

-- D1, player 8478402 (team id 22), seasons 20242025 to 20262027
select season, count(*), count(*) filter (where g.type = 2), count(*) filter (where g.type = 3),
       count(*) filter (where g.id is null), sum(nc.gp), min(nc.date_scraped), max(nc.date_scraped)
from nst_gamelog_as_counts nc
left join lateral (select g.id, g.type from games g
                   where g.date = nc.date_scraped and (g."homeTeamId" = 22 or g."awayTeamId" = 22) limit 1) g on true
where nc.player_id = 8478402 and nc.season in (20242025, 20252026, 20262027) group by season;
select season, gp, toi_seconds, goals from nst_seasonlong_as_counts
where player_id = 8478402 and season in (20242025, 20252026);
select season, games_played, goals from wgo_skater_stats_totals
where player_id = 8478402 and season in ('20242025', '20252026');

-- D3, players 8478402, 8471675, 8471214
select player_id, season_id, count(*),
       count(*) filter (where date < make_date((season_id/10000)::int, 9, 1)
                           or date >= make_date((season_id/10000)::int + 1, 9, 1)),
       min(date), max(date)
from wgo_skater_stats where player_id in (8478402, 8471675, 8471214)
  and season_id in (20242025, 20252026) group by 1, 2;

-- D8
select g.type, count(*) from "skatersGameStats" s join games g on g.id = s."gameId"
where s."playerId" = 8478402 group by g.type;
```

The two hashing scripts were scratch files (not in the repo); the description above is enough to rebuild them.

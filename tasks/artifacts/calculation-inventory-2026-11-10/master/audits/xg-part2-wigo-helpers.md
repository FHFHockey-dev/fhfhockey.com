# Math audit W3: xG part 2, WiGO and stats helpers

Entries: M-XG-061 to 070, M-WIGO-001 to 015, M-HLP-001 to 008 (33). Auditor: Claude, 2026-11-11. No code was changed. Paths are under `web/` unless they start with another top-level folder; line numbers are from the working tree on this date.

## 0. Brief (written before the audit)

**Questions**
1. xG part 2: can the approval gates stop a bad model? Do the rolling 5/10/20-game windows hold the games they claim? Do the xG explorer's ratios mix windows or models?
2. WiGO: is each rating, percentile, per-60 and percentage built from matched numerators and denominators, in the stated unit, against a stated cohort? Is the overall rating double-counting even strength (M-WIGO-005)?
3. Helpers: how many percentile conventions exist, and are null values ranked as numbers (M-HLP-005)?

**Reference standards (by name)**: mid-rank (Hazen-type) percentile rank; Luszczyszyn Game Score (2016); Natural Stat Trick glossary (per-60, IPP, oiSH%, OZS%); Mann-Whitney AUC; Brier score and log loss against a base rate; binomial standard error. Owner decisions 5–8, 12, 17, 69, 74, 76–77 and rules 1–21 bind.

**Data**: code read by symbol; bounded production reads on 2026-11-11 (section 5 lists every query); arithmetic fixtures worked by hand from the source.

**Done when**: every entry has a verdict or a "covered by" pointer with file:line; each defect has a magnitude (or says why none), readers, a fix and a valid test; Astra's upstream corrections are applied.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 10 | XG-061, 069; WIGO-002, 004, 008, 012, 015; HLP-001, 003, 007 |
| Mis-specified | 8 | XG-062, 064; WIGO-005, 007, 009, 010, 013, 014 |
| Wrong | 4 | XG-063, 066; WIGO-006; HLP-005 |
| Covered by an earlier audit, or the same code as another entry | 11 | XG-065, 067, 068, 070; WIGO-001, 003, 011; HLP-002, 004, 006, 008 |
| Undetermined | 0 | |

No new P0. Two readers are added to an existing P0 (W2-P0-1, playoff games in season data): D5 below.

**Two triage leads are refuted**
- **M-WIGO-005 (overall rating averages AS, ES and ST).** The arithmetic is as described (`utils/calculateWigoRatings.ts:281-291`), but `overall.final` has no reader. The page shows `overall.as`, `overall.es` and `overall.st` only (`components/WiGO/PlayerRatingsDisplay.tsx:165-167`; `rg "overall\.final"` finds only the assignment). It is dormant code, not a displayed number.
- **M-HLP-006 (tier thresholds are dead code).** `calculateTierThresholds` is called at `pages/projections/index.tsx:1064`. It is live.

**Top 5 findings by user impact**
1. **WiGO PP and PK ratings and percentiles rank players with almost no ice time (D3, P1, live).** The cohort gate is games, not minutes. Read on 2026-11-11 for season 20262027: of 330 players with 10+ games at PP, 134 (41%) have under 30 PP minutes and 22 have under 10; at PK it is 168 of 332 (51%) and 24. One on-ice goal in 10 minutes is 6.0 per 60. The "Special" overall and the PP/PK percentile panel inherit this.
2. **The projections page gives a rank number to players with no fantasy points, and breaks ties by input order (D2, P1, live).** `utils/projectionsRanking.ts:14-25` sorts `null` as 0. A player with no projection outranks a real negative total, and two equal players get different ranks.
3. **Team drivers show a mean of two percentiles as a percentile (D4, P1, live).** "Special teams · 67th" is the average of the PP% and PK% percentiles, printed as an ordinal and bucketed with the same 67/33 cut-offs as real percentiles. This is what decision 74 forbids.
4. **Player rolling xG windows are "last N games with a shot attempt", not last N games (D1, P1, conditional).** 14.9% of skater-games in 2025-26 have no xG row (715 skaters, 45,723 games). The stored `games_count` says 10 when the span is longer. Empty-net shots are still inside these totals (decision 7).
5. **The xG approval gate cannot reject a weak or leaky goal model (D6, P1, release gate).** It needs 10 goals, never compares to the base rate, does not forbid `isFlurryShot` (the leak Astra reproduced), scores its "holdout" partly on the split the calibrator was fitted on, and the benchmark's check passes any artifact that lacks an eligibility block.

## 2. Per-entry table

Reach: L live, C conditional, D dormant, R research or release tooling.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| M-XG-061 Goalie GSAx share | Sound | `lib/socialShare/modules/goalieGsax.ts:27-37,108-121`; NST-labelled (decision 6) | L | Social share card |
| M-XG-062 xG explorer ratios | Mis-specified | `lib/underlying-stats/xgExplorer.ts:335-448`; `pages/api/v1/underlying-stats/xg.ts:256-281,391-398`. D7 | C: 2026-27 has no rows, so the default request returns none | xG Lab |
| M-XG-063 Rolling xG windows | **Wrong** | `lib/xg/aggregates.ts:463-615,712-720`; `pages/api/v1/db/update-nhl-xg-aggregates.ts:70-112,395-411`. D1 | C: stored rows are 2025-26 only | Timeline, homepage analytics, xG Lab, FORGE prior (env-gated) |
| M-XG-064 Rebound heads, offline | Mis-specified | `scripts/train-nhl-xg-rebound-heads-offline.ts:121-205,241`. AUC and loss maths are right. D8 | R | None (`promotionAuthorized: false`) |
| M-XG-065 Release validation | Covered by nst-derived M-NST-034 / D11 | — | R | Release decision |
| M-XG-066 Approval gates | **Wrong** | `scripts/train-nhl-xg-baseline.ts:333-343,472-575,2036-2057`; `lib/xg/baselineDataset.ts:241-245`; `scripts/benchmark-nhl-xg-baselines.ts:115-128`. D6; extends xg-part1 D8 | R | Scoring route approval check |
| M-XG-067 Strength segments, TOI by split | Covered by nst-derived D1 and D8; classification by decision 70 | `lib/supabase/Upserts/nhlNstParityMetrics.ts:588-652,802-815`: both still present | L | NST-parity per-60 denominators |
| M-XG-068 Parity tolerances | Covered by nst-derived M-NST-034 / D11 | — | R | Release decision |
| M-XG-069 Tracking alignment | Sound | `lib/xg/trackingAlignment.ts:27-72`; no non-test caller | D | None |
| M-XG-070 Approval gates | Same code as M-XG-066 | — | R | — |
| M-WIGO-001 `nst_percentile_*` views | Covered by sql-cross-cut D1 and Astra PR-SQL-1 | — | L | Ratings, percentile panel |
| M-WIGO-002 PPG, rolling, game mean, consistency | Sound | `components/WiGO/PpgLineChart.tsx:61-90`; `gameLogMean.ts:12-17`; `ConsistencyChart.tsx:41-73`; `utils/formattingUtils.ts:146-170`. Inherits D5 | L | WiGO charts |
| M-WIGO-003 Game Score | Covered by sql-cross-cut D3, D6, Astra PR-SQL-3 and Tier B question 2. The TypeScript half is sound | `components/WiGO/GameScoreLineChart/index.tsx:79-99` | L | Game Score card |
| M-WIGO-004 Mid-rank percentile | Sound | `utils/calculatePercentiles.ts:13-87` | L | Ratings, panel, social |
| M-WIGO-005 Player ratings | Mis-specified | `utils/calculateWigoRatings.ts:71-291`; `components/WiGO/ratingWeights.ts`. D3, D9 | L | Ratings card |
| M-WIGO-006 Team drivers | **Wrong** (decision 74) | `components/WiGO/teamPerformanceDriverModel.ts:279-282,293-294`; `TeamPerformanceDrivers.tsx:104`. D4. The rest is sound | L | Team drivers card |
| M-WIGO-007 Tier thresholds | Mis-specified | `utils/tierUtils.ts:28-135`; caller `pages/projections/index.tsx:1064`. D10 | L | Projections chart bands |
| M-WIGO-008 Chart reference lines, ticks | Sound | `components/WiGO/StatsTableRowChart.tsx:77-86,210-225,340-352` | L | Game-log chart |
| M-WIGO-009 Career and recent builder | Mis-specified | `pages/api/v1/db/calculate-wigo-stats.ts:607-739,770-860`. D11 | L | `wigo_career`, `wigo_recent` |
| M-WIGO-010 DIFF | Mis-specified | `components/WiGO/tableUtils.ts:15-80`. D12 | L | Comparison matrix |
| M-WIGO-011 Aggregates writer | Same code as M-WIGO-009 | — | L | — |
| M-WIGO-012 Table assembly, per-60 fallback | Sound | `utils/fetchWigoPlayerStats.ts:242-345` | L | Comparison matrix |
| M-WIGO-013 Game-log series | Mis-specified | `utils/fetchWigoPlayerStats.ts:468-625`. D5. The "NST scale unverified" lead is closed: 0–100 (section 5, query 4) | L | Game-log chart, game mean |
| M-WIGO-014 Percentile panel | Mis-specified | `utils/fetchWigoPercentiles.ts:125-175`; `components/WiGO/RateStatPercentiles.tsx:277-345`. D3, D5 | L | Percentile panel |
| M-WIGO-015 Dead loader | Sound (no caller: `rg fetchPercentilePlayerData`) | `utils/fetchWigoPlayerStats.ts:986` | D | None |
| M-HLP-001 Projection maths primitives | Sound; no importer of `lib/math/utils` | `lib/math/utils.ts:39-306` | D | None |
| M-HLP-002 Team power EWMA, z-scores | Covered by the W1-4 team-ratings audit | — | L | — |
| M-HLP-003 Mid-rank helpers | Same code as M-WIGO-004 (sound) | — | L | — |
| M-HLP-004 WiGO ratings | Same code as M-WIGO-005 | — | L | — |
| M-HLP-005 Global projected and actual ranks | **Wrong** (rules 5, 20) | `utils/projectionsRanking.ts:8-27`; caller `pages/projections/index.tsx:960-1004`. D2 | L | Projections table |
| M-HLP-006 Tier thresholds | Same code as M-WIGO-007 | — | L | — |
| M-HLP-007 Social shared definitions | Sound | `lib/socialShare/modules/shared/definitions.ts:25-60` | L | Social modules |
| M-HLP-008 Percent units, pooled shares | Covered by nst-derived M-NST-033 | — | L | — |

**Percentile conventions (stats-helpers lead).** Three exist: (a) mid-rank, (worse + ½ ties) ÷ N, in WiGO, social and team drivers; (b) exclusive, strictly worse ÷ (N − 1) with dense rank, in rankings (M-RNK-003, sound); (c) the dormant, broken `percentile-rank` route (M-RNK-028). (a) and (b) differ mainly on ties: with 40% of a cohort tied at zero, (a) gives 20 and (b) gives 0. Neither is wrong; see owner question 1.

## 3. Defects

### P1

**D1 · Player rolling xG windows skip games without a shot attempt; empty-net shots are included** (M-XG-063). Conditional.
- Evidence: a player-game row exists only when the player has a prediction row (`lib/xg/aggregates.ts:712-720`). `buildRollingPlayerRows` slices the last N such rows and stores `games_count = windowRows.length` (`:535-545`). `buildXgAggregates` has no empty-net exclusion; the empty-net keys are used only by the QA check afterwards (`update-nhl-xg-aggregates.ts:411-418`).
- Magnitude (2026-11-11): 2025-26 regular season, 715 skaters with 20+ GP: 45,723 games played, 38,890 player-game xG rows, so 14.9% of games have no row. 248 of 715 skaters (35%) miss at least a fifth of their games. A "last 10" ixG for those players spans 12 or more games.
- Also conditional: with `seasonId` omitted the route loads every season of a model version (`:70-112`), so a window crosses the season boundary; `limit` can cut the last game in half. Team and goalie windows do not have the missing-row problem.
- Readers: `pages/api/v1/underlying-stats/xg.ts` (players scope), `lib/underlying-stats/xgExplorer.ts:363-394`. Team rows: `MetricsTimeline`, `lib/homepageGameAnalytics.ts`, `lib/projections/queries/team-context-queries.ts:204` (env-gated; W1-1).
- Fix: build player windows on the player's dressed games (roster or shift rows), with a zero row for a dressed game without an attempt, and store both the window size and games available (decision 16). Group windows by season. Reject a `limit` that splits a game. Exclude empty-net shots from the totals and carry them in separate columns, keeping the two net states apart (decision 7, Astra W1-1 item 10).
- Test: fixture of 12 dressed games with attempts in 8: the 10-game window holds 10 dressed games and the ixG of the 6 or 7 attempt-games inside it, not 8. A two-season fixture never yields a window containing both. An empty-net goal changes the empty-net column and not `xg_for`.
- Production step: rebuilding stored aggregates needs the owner's approval; decision 5 keeps the current champion's rows serving until the fix plan.

**D2 · Projections ranks: null ranked as zero, ties by input order** (M-HLP-005). Live.
- Evidence: `(b.fantasyPoints.projected ?? 0) - (a.fantasyPoints.projected ?? 0)` then `rank = i + 1`, and the same for actual (`utils/projectionsRanking.ts:14-25`). Mutates and re-sorts the shared array.
- Fixture (by hand from the source): projected [10, null, −2] gives ranks 1, 2, 3: the player with no projection is ranked above a real total. Two players at 100.0 get ranks 1 and 2 in input order. Early in a season every player without actuals gets a distinct "actual rank". Not measured on the live page (the inputs are assembled in the browser).
- Skaters and goalies share one list. That is a legitimate overall rank under one set of league settings; it is a labelling matter (owner question 3).
- Readers: `pages/projections/index.tsx:905-924,960-1004`; `hooks/useProcessedProjectionsData.tsx:2608-2631` (rank columns and their sort).
- Fix: rank only finite values; null gets no rank and renders "—"; ties share a competition rank (1, 2, 2, 4); do not mutate the inputs.
- Test: the three fixtures above; a sort on the rank column keeps unranked rows last in both directions.

**D3 · WiGO special-teams ratings and percentiles have no ice-time floor** (M-WIGO-005, 014; M-HLP-004). Live.
- Evidence: cohorts are filtered by `gp >= cohortMinGp` only (`utils/calculateWigoRatings.ts:44-63`; `RateStatPercentiles.tsx:285-289`), and GP at a strength means games with any time at that strength. Magnitude is in summary item 1.
- Readers: `PlayerRatingsDisplay.tsx` (PP offense, PK defense, Overall "Special"), `RateStatPercentiles.tsx` (PP and PK tabs).
- Fix: gate each strength's cohort, and the selected player's eligibility, on minutes at that strength as well as games; show "insufficient sample" below it. The floor is an owner choice (question 2); validate it by split-half stability rather than asserting a number (rule 12).
- Test: a player with 10 PP games and 8 PP minutes gets no PP rating and is not in the PP cohort; one at the floor is.

**D4 · Team drivers print a mean of percentiles as a percentile** (M-WIGO-006). Live.
- Evidence: `specialTeamsPercentile = (pct(PP%) + pct(PK%)) / 2` (`teamPerformanceDriverModel.ts:279-282`), then `formatPercentileOrdinal` and the 67/33 status cut-offs (`:293-294`, `TeamPerformanceDrivers.tsx:104`).
- Magnitude (hypothetical, independent uniform inputs): a true percentile is at or above 67 about 33% of the time; the mean of two is at or above 67 about 21.8% of the time ((2 − 1.34)² ÷ 2). So "strength" and "concern" are reached less often for special teams than for the three other drivers. The live distribution over 32 teams was not measured.
- Fix: either re-rank the mean across the league and show that true percentile, or show PP and PK as two drivers. Under decision 74 the unranked mean may be shown only as a score, without ordinal formatting.
- Test: 32-team fixture where a team is 90th in PP and 50th in PK: the displayed value equals its league rank on the composite, not 70.

**D5 · WiGO game-log and percentile readers that the season-view fix will not reach** (M-WIGO-013, 014, 002). Adds readers to W2-P0-1 and to sql-cross-cut D3.
- Evidence: `fetchPlayerGameLogForStat` filters NST game-log tables by `season` only and `wgo_skater_stats` by `season_id` only (`utils/fetchWigoPlayerStats.ts:531-540,558-564,583-600`). These read the game-log tables directly, not the season views, so making the views regular-season (decision 69) leaves playoff games in every completed season's chart and game mean. The same season-only filter is on the shared calendar (`:925-944`, Astra PR-SQL-3).
- `sanitizePercentileCohortGp` hides the same defect with a magnitude rule: GP above the WGO maximum is dropped or capped (`fetchWigoPercentiles.ts:158-175`). The rates still include the playoff games, and 70 + 10 playoff games passes unnoticed (rule 17).
- Magnitude: carried from sql-cross-cut (one player, 99 GP against 67 in 20242025). Not re-measured.
- Fix: one shared game predicate (canonical game id, season, game type 2) used by the season views, the game-log reader and the calendar. Keep the sanitiser as an alarm that reports, not a silent correction.
- Test: a fixture with one playoff NST row and one mislabelled WGO row: neither appears in the chart labels, the game mean or a rolling window; a regular-season game with a missing value stays a labelled gap.

**D6 · xG approval gates** (M-XG-066, 070). Release tooling; extends xg-part1 D8.
- Evidence, each read from source (none executed):
  1. `MIN_APPROVAL_TEST_POSITIVES = 10`, `MIN_APPROVAL_HOLDOUT_POSITIVES = 10` (`train-nhl-xg-baseline.ts:333-334`). At a 7.2% goal rate that is about 139 shots; the standard error of the observed rate is √(0.072 × 0.928 ÷ 139) = 0.022, 30% of the rate. The rebound gate beside it asks for 100 and 250.
  2. The goal gate never compares log loss or Brier to the base rate (`:517-575`); the rebound gate does (`:432-454`). The only probability check is a mean prediction inside (0.001, 0.999).
  3. The forbidden list is `shotEventType`, `missReasonBucket`, `isShortSideMiss` (`lib/xg/baselineDataset.ts:241-245`). `isFlurryShot` is still a selectable feature (`:90,164`) although Astra reproduced that it depends on later shots (W1-1 item 6).
  4. Calibration is fitted on the validation split (`:1532-1592`), and the "holdout" the gate scores is validation plus test (`:2056-2057`). Part of every gate metric is in-sample for the calibrator.
  5. `getApprovalGradeBlockingReasons` returns the artifact's own reasons, and when there are none it checks only that the test split is non-empty; it never reads `isEligible` (`benchmark-nhl-xg-baselines.ts:115-128`). An artifact with no eligibility block passes `assertApprovalGradeArtifacts`. The scoring route is stricter: it requires `isEligible === true` (`pages/api/v1/db/update-nhl-xg-shot-predictions.ts:380-394`).
- Magnitude: the candidate's test split had 17,834 shots (Astra W1-1), so the floor did not bind on that run. No served number changes today.
- Fix: a precision-based floor (question 4); test-split log loss and Brier below the base rate by a margin with a paired, game-clustered interval (rule 2, 11); gate on the test split only, never on the calibrator's fitting split; a backward-only feature contract in place of a name list (Astra W1-1 D); the benchmark requires `isEligible === true`. AUC bounds stay alarms (Astra W1-1 item 6).
- Tests: an artifact with 10 test goals is rejected; one whose test log loss equals the base rate is rejected; one selecting `isFlurryShot` is rejected; a prefix-invariance test on features; an artifact without an eligibility block fails the benchmark assertion.

### P2

**D7 · xG explorer mixes windows and fills missing data with zero** (M-XG-062). Conditional: no 2026-27 rows.
- xG columns are the latest N-game rolling row; transition and rebound columns are sums over every fetched game row of the season (`xgExplorer.ts:349-360,409-419`; `xg.ts:391-398`), shown side by side with one "games" figure. Missing created, transition and rebound values become 0 (`:371-394`), with a page-level coverage warning only (rule 5). `transitionCreatedXg` and `transitionCreatedShots` fall back between a rolling row and a season sum (`:387-388`). `expectedPrimaryAssists` is the shot-assist xG under a second name (`:390`; xg-part1 finding 5). The model is "latest by date", not registry-approved (Astra W1-1 item 9).
- Fix: one window for every column, or separate labelled groups; null for missing; pin the model through the registry.
- Test: a player with no supplemental rows shows "—", not 0.000; changing the window changes every windowed column.

**D8 · Offline rebound heads inherit the cross-game label collision** (M-XG-064). Research.
- `buildRichReboundLabels` runs once per chunk of games (`train-nhl-xg-rebound-heads-offline.ts:241`), the condition under which Astra showed labels change (W1-1 A). The gate floors (100 rows, 10 positives, AUC ≥ 0.5) are too low to mean anything; promotion is hard-coded off. Fix with W1-1's `(gameId, eventId)` key and rerun before quoting `rebound-rich-heads-v1.json`.

**D9 · Ratings: smaller definitional items** (M-WIGO-005). Live unless stated.
- `overall.as` and `overall.es` fall back to the one side that exists (`calculateWigoRatings.ts:246-254`), so an "overall" can be offense only with no flag.
- The low-GP shrink acts on the percentile, not the rate, with a hard step at 10 GP (`:22-35,152-196`). Consistent and labelled; the constants are hypotheses (rule 12).
- Forwards and defensemen share one cohort (question 2).
- `overall.final` is dormant. AS already contains ES and ST time, and ST would carry a fixed third whatever its ice time: do not wire it as it stands.
- Formatting already follows decision 74 (plain "62.3", described as a composite).

**D10 · Tier bands** (M-WIGO-007; M-HLP-006). Live.
- Round averages of actual points are not always decreasing. When round 2 averages more than round 1, Tier 2 is skipped and Tier 3's ceiling sits above Tier 1's floor, so bands overlap (`tierUtils.ts:52-71`). Negative values fall in no band (`:124-130`). "Replacement Level" here means "below the round-13 average", not the replacement level of decisions 76–77.
- Fix: sort and de-duplicate the boundaries (or use an isotonic fit) before building bands; open the bottom band downward; rename the bottom band.
- Test: averages [5.0, 5.4, 4.1] produce non-overlapping bands that cover every value.

**D11 · WiGO writer: unmatched support in a few ratios** (M-WIGO-009, 011). Live.
- Recent `pp_pct` is an unweighted mean of per-game shares (`calculate-wigo-stats.ts:855-857`); career `pp_pct` is GP-weighted (`:650-659`). Neither is pooled player PP time ÷ team PP time. Decision 71 owns the displayed PP share; this reader belongs in that lane's list.
- IPP divides WGO points by NST on-ice goals without checking both cover the same games. Sample (player 8478402, 20242025): WGO 67 GP, NST 66 GP (rule 13). Small.
- `gp` is max(NST GP, WGO GP) (`:522,570`) and is the denominator of PPTOI per game (`:645-648`), while the numerator is WGO only.
- Fix: per-metric support (the games both sources cover), and `wgo_gp` under WGO numerators.
- Test: a season with one NST game missing gives IPP from the shared games, or null with a coverage note.

**D12 · DIFF is a relative change on percentage stats** (M-WIGO-010). Live. S% 10 → 12 shows +20%. Label it "% change", or show percentage points for percent stats. A base near zero gives very large values.

## 4. Owner questions (not answered by decisions 1–79, not in Tier B)

1. **One percentile convention for the site?** Recommended: mid-rank everywhere, stated once in the help text. Alternative: keep both and label rankings percentiles "ties share the lower bound".
2. **WiGO rating and percentile cohorts.** Recommended: split forwards and defensemen, and add a minutes floor per strength (validated, see D3). Alternative: keep all skaters together and add the floor only.
3. **Projections "overall" rank.** Recommended: keep one skater-plus-goalie rank, labelled "overall", and add a position rank. Alternative: rank skaters and goalies separately only.
4. **xG approval floor.** Recommended: a precision rule (holdout goal-rate standard error at or below 5% of the rate, about 370 goals) plus beat-the-base-rate. Alternative: reuse the rebound gate's 100 and 250.

Already settled, so not asked: Game Score (Tier B 2), composite floors (Tier B 11), decisions 7, 69, 71, 74.

## 5. Limits

- Read-only. Before each heavier read `pg_stat_activity` showed 1 active query. No jsonb columns were selected. No NST, NHL or Yahoo calls. No tests were run and no fixture was executed; the fixtures in D2, D4, D6 and D10 are arithmetic from the source lines cited.
- Queries (project `fyhftlxokyjtpndbkfse`, 2026-11-11):
  1. `count(*)` over `nst_percentile_{pp_offense,pk_defense,es_offense,as_offense} where season=20262027`, filtered by `gp>=10`, `toi_seconds<600`, `toi_seconds<1800`, plus median `toi_seconds`. PP: 674 rows, median 2,206 s. PK: 646 rows, median 1,777 s. ES and AS: none under either floor.
  2. `nhl_xg_player_game_aggregates` rows per player for `game_id between 2025020001 and 2025029999`, left-joined to `wgo_skater_stats_totals` (`season='20252026'`, `games_played>=20`).
  3. `nst_seasonal_individual_counts` (strength `all`) and `wgo_skater_stats_totals`, player 8478402, seasons 20242025–20262027: GP 66/82/19 against 67/82/19.
  4. `nst_gamelog_as_counts` joined to `nst_gamelog_as_counts_oi`, player 8478402, season 20262027, 4 latest rows: `ipp` 33.33–100, `on_ice_sh_pct` 20–25, `off_zone_start_pct` = OZ ÷ (OZ + DZ).
  5. `wgo_skater_stats` rows with `game_id between 2025030000 and 2025039999`: 0. `wigo_recent`: 2,204 rows, 986 updated in the last 36 hours, oldest 2026-09-18 (stale rows not investigated).
- Not verified: the count of null-point rows on the live projections page; the live special-teams distribution; whether any deployed artifact lacks an eligibility block. Carried from upstream without re-running: WGO `sat_for` semantics (Astra C8), Astra PR-SQL-1's null-count path, the `wgo_skater_stats` 2010–2017 label contamination.
- No disagreement with Astra was found. One upstream lead is corrected here: the packet's "overall = mean(AS, ES, ST)" is not displayed.

## 6. Final analysis and fix-agent handoff

### Final analysis

**xG part 2.** Nothing here changes a number users see today: in-house xG has no 2026-27 rows and decision 5 leaves last season's rows serving. The defects are in what would be rebuilt. The rolling builder is right for teams and goalies; for players it treats "games with a shot attempt" as "games", and it still counts the empty-net shots decision 7 excludes. The approval gate has a 10-goal floor, no base-rate comparison for the goal model, a forbidden list that omits the leak Astra reproduced, a holdout that includes the calibrator's fitting split, and a benchmark check that fails open. Release validation and tolerances were judged in W1-2 (M-NST-034). Astra's corrections apply: AUC limits are alarms, not proofs; λ does not scale with rows; registry demotion alone does not change the Timeline; no registry or aggregate change is authorised.

**WiGO.** The percentile helper, rolling means, chart reference lines, per-60 fallbacks and unit conversions are right; stored NST percentages are 0–100 and OZS% matches decision 9. The headline lead was wrong about reach: the mean of AS, ES and ST is computed and never shown. Three things are wrong for users. Special-teams ratings and percentiles are ranked on games, not minutes. The team "Special teams" driver formats a mean of percentiles as a percentile. The game-log and calendar readers filter by season label only, so the regular-season view fix (decision 69) and the Game Score RPC fix (sql-cross-cut D3, Astra PR-SQL-3) will not reach them unless they are listed.

**Helpers.** The shared social definitions and the mid-rank helper are sound. The projections rank helper turns missing fantasy points into zero and breaks ties by input order. The tier helper is live, not dead, and can emit overlapping bands. The site has two working percentile conventions; that is a labelling decision, not a defect.

### Recommendations, in priority order

| # | Fix | Files and symbols | Readers to update (rule 4) | Proof |
|---|---|---|---|---|
| 1 | D2: rank finite values only; competition ranks; no mutation | `utils/projectionsRanking.ts` `assignGlobalRanks`, `injectRanks` | Rank columns in `pages/projections/index.tsx` and `hooks/useProcessedProjectionsData.tsx` (render "—", sort unranked last) | D2 fixtures on rendered rows |
| 2 | D3: minutes floor per strength for cohort and target | `utils/calculateWigoRatings.ts` `buildComparisonRows`, `calculatePlayerRatings`; `components/WiGO/RateStatPercentiles.tsx` cohort filter | `PlayerRatingsDisplay.tsx`, `WigoDashboardSections.tsx` help text, `RateStatPercentiles.tsx` threshold messages | D3 test on the displayed rating and panel |
| 3 | D4: true percentile of the composite, or two drivers | `components/WiGO/teamPerformanceDriverModel.ts` `buildTeamPerformanceDrivers` | `TeamPerformanceDrivers.tsx:104` and its help text | D4 fixture |
| 4 | D5: one game predicate for game-log readers and the calendar | `utils/fetchWigoPlayerStats.ts` `fetchPlayerGameLogForStat`, `fetchPlayerGameLogConsistencyData`; `utils/fetchWigoPercentiles.ts` `sanitizePercentileCohortGp` (alarm only) | `StatsTableRowChart.tsx`, `gameLogMean.ts`, PPG, Consistency, TOI and Game Score charts | D5 fixture; Astra PR-SQL-3's chart test |
| 5 | D1: player windows on dressed games; season grouping; empty-net split | `lib/xg/aggregates.ts` `buildRollingPlayerRows`, `buildXgAggregates`, `buildRollingTeamRows`, `buildRollingGoalieRows`; `pages/api/v1/db/update-nhl-xg-aggregates.ts` | The five readers listed in D1 | D1 fixtures; a reader test per consumer |
| 6 | D6: approval gate | `scripts/train-nhl-xg-baseline.ts` `buildApprovalGradeEligibility` and constants; `lib/xg/baselineDataset.ts` forbidden list or feature contract; `scripts/benchmark-nhl-xg-baselines.ts` `getApprovalGradeBlockingReasons` | `lib/xg/shotFeaturePersistence.ts:281-289,659` and the scoring route share the list | D6 tests |
| 7 | D7: explorer windows, nulls, model pin | `lib/underlying-stats/xgExplorer.ts` three builders; `pages/api/v1/underlying-stats/xg.ts` `resolveLatestModelVersion` | `pages/underlying-stats/xg/index.tsx` | D7 test |
| 8 | D10, D11, D12, D9, D8 | `utils/tierUtils.ts`; `pages/api/v1/db/calculate-wigo-stats.ts` `writePeriod` and the recent block; `components/WiGO/tableUtils.ts`; `utils/calculateWigoRatings.ts`; `scripts/train-nhl-xg-rebound-heads-offline.ts` | `components/Projections/PlayerMatchupWeekPerformanceChart.tsx`; `utils/fetchWigoPlayerStats.ts` readers of `wigo_career` and `wigo_recent`; comparison matrix | Tests named in each defect |

### Directional suggestions (not defects)

- WiGO ratings: shrink rates by minutes toward a position mean before ranking, instead of shrinking percentiles by games; consider on-ice metrics relative to team.
- Team drivers: use 5v5 xG per 60 rather than per game; 5v5 minutes differ by team.
- `goalieFinishMult` (dormant): 1 − Δ ÷ 0.07 is steeper than the identity (1 − SV) ÷ (1 − league SV), which gives 1 − Δ ÷ 0.10 at a .900 league. Fit or derive it before any use.
- Retire dormant `overall.final`, `fetchPercentilePlayerData` and `lib/math/utils` only through the cleanup inventory (rule 6).

### Context a fix agent needs

- **Decisions that apply:** 5 (champion keeps serving; no registry or aggregate change without the plan), 6 and 12 (NST is the headline xG), 7 (empty net excluded and reported apart, two net states), 8 (rush 4 s), 16 (games available), 17 (xSH% naming, if touched), 69 (regular season only), 71 (PP share clock), 74 (composites are scores, not percentiles), 76–77 (replacement level). Rules 5, 13, 14, 16, 17, 20.
- **Units and scales:** NST goalie and seasonal TOI are minutes; NST game-log TOI and WGO TOI are seconds; `toi_seconds` in the `nst_percentile_*` views is seconds. NST percentage columns are 0–100; WGO percentage columns are 0–1 and are multiplied by 100 at the reader. `xgPct` in the explorer is 0–1. WiGO ratings are 0–100 scores.
- **Null handling:** WiGO charts keep a game with a missing value as a gap that occupies its window slot. Do not drop those games, and do not replace a fail-closed null with a partial ratio (rule 16).
- **Do not change:** the mid-rank helper's formula; the team-driver coverage rule (90%, owner decision of 2026-10-25); the social shared definitions; the MCM composite (Astra W2-4); the xG registry; stored aggregates.
- **Ownership:** check `tasks/artifacts/cross-platform/2026-10-24-coordination/` before editing `lib/socialShare/` or the BLSH lane (Codex). Nothing here requires an edit there.
- **Production steps needing the owner's approval:** any xG aggregate rebuild or rerun of `update-nhl-xg-aggregates` (D1); any registry change; the season-view migration D5 depends on (decision 69, W2 lane); any deploy. `wigo_career` and `wigo_recent` are rewritten by the existing nightly cron once a fix is deployed.
- **Suggested lanes:** (A) Projections page helpers: fixes 1 and D10. (B) WiGO readers and ratings: fixes 2, 3, 4, D9, D12, coordinated with the W2-1 season-view and Game Score lane. (C) WiGO writer: D11, with the decision 71 PP-share lane. (D) xG aggregates and explorer: fixes 5 and 7, after the W1-1 model plan. (E) xG training gates: fix 6 and D8, with xg-part1 D2, D8 and Astra's feature contract.

# Wave 3 audit: Misc / other (M-MISC-001 to 052)

Auditor: Claude (Fable), 2026-11-11. Read-only; no code changed. Paths are under `web/` unless they start with `supabase/`.

## 0. Brief

- **Questions.** (1) Is each calculation right and true to its label? (2) Is the confirmed 60× SOG/60 error (C42, M-MISC-007) reachable? (3) Which entries are copies of work already judged in Waves 1–2?
- **Reference standards.** NHL.com: SV% = saves ÷ SA, GAA = GA × 3600 ÷ TOI seconds, points % = points ÷ (2 × GP), goalie record W-L-OTL. Natural Stat Trick: per-60 = count ÷ TOI minutes × 60, pooled over the window; on-ice share = for ÷ (for + against) on pooled counts. Standard American-odds conversion and proportional de-vig. Mid-rank percentile (ties count half). Vollman Quality Start (decision 40). Owner decisions 1–79 and rules 1–21.
- **Fixtures and data.** Algebraic fixtures for unit errors. Production reads on 2026-11-11: 8 skaters' 2026-27 NST game logs; 118 team-games (2026-11-01 to 11-09) of `forge_team_game_strength` vs `wgo_team_stats`; 4 rows of `nst_team_stats`. 25 existing Vitest files run (701 tests, all pass).
- **Done when** every entry has a verdict or a "covered by", each defect has reach, size, fix and test, and the handoff names files, readers and approvals.

## 1. Summary

**Verdicts (52):** sound 28 · mis-specified 10 · wrong 4 · undetermined 0 · covered by an earlier audit 10. **P0: none.** P1: 2. P2: 12.

**Top findings by user impact**

1. **Player stats page averages per-60 rates and on-ice shares per game instead of pooling them (D1, M-MISC-004, live, P1).** The season per-60 is the plain mean of each game's per-60, and CF%, xGF% and similar are the mean of each game's percentage. On 8 skaters' 2026-27 logs the per-60 gap is usually under 3% but reaches +11% (G/60 0.454 shown vs 0.408 pooled; ixG/60 1.486 vs 1.343, an 8-game player). CF% is off by up to 1.8 points. It meets the letter of P0 (visible now) at a small size, so I rate it P1; Chef may promote it.
2. **Share cards print a goalie's last-five record as W-(GP − W) (D2, M-MISC-019, live in the share studio, P1).** Overtime losses, relief appearances and no-decisions all print as losses on a published graphic.
3. **Legacy averages routes: SOG/60 is 60× low, and the traded-player rate row is not a rate (D3, M-MISC-007, dormant, P2).** No page or hook in the repo calls `/api/Averages/[playerId]` or `/api/ThreeYearAverages/[playerId]`. Outside use is unknown.
4. **Homepage: shots on goal come from a strength-split sum that disagrees with NHL.com in 8 of 118 team-games (−4 to +1), and the pulse line silently changes what it plots (D5, D6, M-MISC-036 and 037, live, P2).**
5. **Roster tab height can print 5'12" and trends "hot" and "cold" lists can name the same team (D4, D8, M-MISC-016 and 041, live, P2).**

## 2. Per-entry table

Reach: L live, C conditional, D dormant, R research. "Tests" means the file's Vitest suite passed on 2026-11-11.

| ID | Verdict | Evidence | Reach | Downstream |
|---|---|---|---|---|
| 001 safe_z | Covered by sql-cross-cut M-MISC-001 (sound) | — | D | None |
| 002 gameOutcomes | Covered by sql-cross-cut D11; Astra keeps it and adds: a team LOSS is not a goalie's credited loss | — | L | Splits, lines, forecasts |
| 003 Metrics timeline | Sound (points ÷ 2·GP; delta vs 5 rows back). xG series covered by xg-part1 | `components/MetricsTimeline/metricsTimelineData.ts:43,98`; tests | L | Team page |
| 004 Player stats page | **Wrong** (D1) | `components/PlayerStats/playerStatsContract.ts:276-293`; `PlayerRadarChart.tsx:417-428`; `PlayerPerformanceHeatmap.tsx:43,120-170` | L | `/stats/player/[playerId]` |
| 005 Percentile hook | Sound (mid-rank). Cohort source covered by sql-cross-cut 005 | `hooks/usePercentileRank.ts:51,112-140` | L | Category coverage radar |
| 006 Trainer confidence | Sound as a labelled review heuristic (weights are hand-set, rule 12) | `lib/sources/tweetSwipeTrainer.ts:548-600`; tests | L (internal tool) | Tweet trainer |
| 007 Legacy averages | **Wrong** (D3) | `lib/api/averages/statsService.ts:64-68,158,317-320,483-490,598-600`; `helpers.ts:121`; `pages/api/ThreeYearAverages/[playerId].ts:454` | D | Two public routes, no in-repo reader |
| 008 Implied probability | Covered by game-predictions-odds 041 / D9 (conversion sound) | — | L | Game preview |
| 009 Opponent DEF, storms | Sound. `nst_team_stats` holds totals, so ÷ GP is right | `lib/socialShare/matchups.ts:49-170`; `teamRates.ts:17-21` | L (studio) | Share cards |
| 010 Window vs baseline | Sound (pooled per-60, documented floors and caps) | `modules/whatChanged.ts:71-90`; `lastNightsStandouts.ts:80-90`; tests | L (studio) | Share cards |
| 011 Multi-cat | Sound. Two definitions, each labelled with its formula (rule 16) | `modules/categoryBlueprint.ts:49-66`; `multiCatStars.ts:28-36` | L (studio) | Share cards |
| 012 Goalie cards | Sound. Undrafted ADP value is disclosed on the card (`goaliePeriod.ts:153`). Starter boards covered by goalie-starters M-GST-010/011 | `modules/creaseShift.ts:81`; `goalieGsax.ts:106-114`; tests | L (studio) | Share cards |
| 013 L5 player score | Sound as a disclosed heuristic; formula printed from the same constants | `lib/socialShare/score.ts:21-48`; tests | L (studio) | Share cards |
| 014 Ownership trend | Covered by fantasy-scoring 015 | — | L | Top movers |
| 015 Opportunity trend | Mis-specified (D10) | `components/GameGrid/OpportunitySparkline.tsx:14-19` | L | Game Grid |
| 016 Bio conversions | **Wrong** (D4) | `components/RosterMatrix/RosterMatrixWrapper.tsx:502-512` | C | Team roster tab |
| 017 Tone encodings | Sound (tone rounds like the printed whole %) | `components/SocialShare/modules/LastNightsStandoutsCard.tsx:13` | L (studio) | Share cards |
| 018 Week Score tiers | Sound (rank quintiles, ties share a tier) | `components/SocialShare/SocialShare.tsx:124-131` | L (studio) | Monday grid |
| 019 Recent-form line | **Wrong** (D2) | `components/SocialShare/SocialShare.tsx:329-331`; `lib/socialShare/players.ts:231,258-263` | L (studio) | Spotlight, pickup cards |
| 020 Gold glow | Sound | `SocialShare.tsx:416` | L (studio) | Tuesday tiles |
| 021 Band chip | Sound. The ≥ 50% case cannot occur (`lib/socialShare/tiers.ts:70`) | `SocialShare.tsx:681` | L (studio) | Tier lists |
| 022 Team games | Sound | `modules/teamGames.ts:45`; tests | L (studio) | Share card |
| 023 Yahoo name match | Sound as coded (Python tests not run) | `lib/supabase/Upserts/Yahoo/player_name_matcher.py:92-106` | L (script) | Yahoo map |
| 024 CSV name match | Mis-specified (D11) | `pages/api/v1/db/upsert-csv.ts:77-92` | C (admin) | CSV import |
| 025 Goals correlation | Mis-specified (research): player-games pooled across positions and roles | `scripts/goals_correlation_analysis.py:184-200` | R | None |
| 026 Top scorers analysis | Mis-specified (research): season totals not per game; z-scored r repeats raw r. Judged from the inventory text | `scripts/top_scorers_relationship_analysis.py` | R | None |
| 027 Recency gap | Mis-specified (D9) | `lib/dashboard/dataFetchers.ts:366-384` | L | `/trends` |
| 028 Date Range Matrix | Covered by lines-toi-pp-units 008 (shares). Goalie SV% and GAA sound; GAA has no zero-TOI guard (`fetchAggregatedData.ts:725`) | — | L | `/drm` |
| 029 Command center | Covered by forge-projections-part2 074 (decision 58) | — | L | FORGE dashboard |
| 030 Pickup composite | Mis-specified (D7) | `components/PlayerPickupTable/PlayerPickupTable.tsx:2543-2630` | L | Pickup table |
| 031 Poisson chart | Covered by game-predictions-odds D3. Reach: imported at `pages/game/[gameId].tsx:8` and never rendered, so decision 44 holds today | — | D | None |
| 032 Calendar rating | Mis-specified (D12) | `components/TeamScheduleCalendar/TeamScheduleCalendar.tsx:416-447,2210-2232` | L | Team pages |
| 033 Skater variance | Covered by goalie-starters M-GST-020 (no importer besides its test) | — | D | None |
| 034 NST rate plan | Covered by nst-derived-stats M-NST-027 (decision 14) | — | L | NST crons |
| 035 X poller health | Sound (operational thresholds) | `lib/cron/xPollerHealth.ts`; tests | L (ops) | Cron report |
| 036 Homepage SOG | Mis-specified (D5) | `lib/homepageGameAnalytics.ts:275-287,403-405` | L | Homepage cards |
| 037 Homepage pulse | Mis-specified (D6) | `lib/homepagePulse.ts:155-200` | L | Homepage |
| 038 Weekly fantasy points | Sound (Σ stat × the user's values; missing stat skipped) | `hooks/usePlayerMatchupWeekStats.ts:60-150` | L | Projections page |
| 039 Tweet identity | Sound | `lib/sources/tweetIdentityCandidates.ts`; tests | L (internal) | News tools |
| 040 Goalie weekly averages | Covered by underlying-stats-part1 002 and Tier B question 10 | — | L | `/goalies` |
| 041 Trends hot/cold | Mis-specified (D8) | `pages/trends/index.tsx:727-736` | L | `/trends` |
| 042 Week Score callers | Sound callers. Week Score and off-night value covered by fantasy-scoring (C30, 024) | `modules/offNightEdge.ts`; `tiers.ts`; tests | L (studio) | Share cards |
| 043 Hot/cold streaks | Sound against the owner's written rule (ticket 18). Note: "QS/5" counts relief appearances in the five | `lib/socialShare/streak.ts:37-75`; tests | L (studio) | Share cards |
| 044 WiGO fallbacks | Sound for all-situation rows; a strength-specific caller would be wrong (not found) | `utils/fetchWigoPlayerStats.ts:314-334`; tests | L | WiGO |
| 045 Team Stream | Sound (null on any missing game, never a partial sum) | `modules/teamStream.ts:126,145`; tests | L (studio) | Share cards |
| 046–052 Category Counts | Sound: pooled rates, integer half-up comparison, ties and unavailable kept apart, week baselines. 33 + 56 tests pass | `modules/shared/categoryCounts.ts:38-60,85-95,115-140,207-226,275` | L (studio) | Goalie period cards |

## 3. Defects

### D1. Player stats page pools nothing for per-60 and share stats (M-MISC-004) · wrong · live · P1

- **What.** `aggregateSummaryStat` returns the plain mean of per-game values for every `PER_60_STATS` and `PER_GAME_STATS` entry (`playerStatsContract.ts:288-293`) and a games-weighted mean for `PERCENTAGE_STATS` (`:276-286`); each game row has `games_played` = 1, so that is also a plain mean. NST's season per-60 is Σ count ÷ Σ TOI × 60, and its share is Σ for ÷ Σ (for + against). The code comment says no denominators are loaded, but the page already fetches `nst_gamelog_as_counts` and `nst_gamelog_as_counts_oi` with `select("*")` (`pages/stats/player/[playerId].tsx:785-800`).
- **Size (2026-11-11, 8 skaters, season 20262027, 8–20 games each).** Shown vs pooled G/60: 0.454 vs 0.408 (+11%), 0.636 vs 0.584 (+9%), others within 3%. ixG/60: 1.486 vs 1.343 (+11%), others within 3%. CF%: 58.47 vs 60.29 at worst. xGF%: 61.12 vs 59.88 at worst. The error grows when ice time varies (short games count as much as long ones).
- **Related, same entry (P2).** (a) Radar percentile is strictly-worse ÷ n (`PlayerRadarChart.tsx:417-428`), so a tied group gets the bottom of its range, unlike the mid-rank used by M-MISC-005, 011 and 030. (b) The heat map calls a fixed-threshold step score a "weighted percentile analysis" (`PlayerPerformanceHeatmap.tsx:1013`); it is a score from hard-coded cut-offs shared by forwards and defencemen. TOI seconds ÷ 60 against minute thresholds is correct, which settles the packet's unit conflict. (c) Radar cohort and strength are covered by nst-derived M-NST-006 and decision 15.
- **Fix.** Pool: per-60 = Σ count × 3600 ÷ Σ TOI seconds from the count tables (TOI there is seconds: min 505, max 1,587 in the sample); shares from summed for/against. Return null when a game lacks either part (rule 13). Use mid-rank for the radar. Reword the heat map as a "performance score (fixed thresholds)".
- **Readers (rule 4).** Summary cards, the stat chart's season line and the "5-game ÷ season" index on `/stats/player/[playerId]`; every caller of `aggregateSummaryStat`.
- **Test.** Two-game fixture: 1 goal in 600 s and 0 goals in 1,200 s. Expect 2.0 per 60, not 3.0. CF 10/CA 0 and CF 10/CA 30: expect 40%, not 62.5%. Radar: three tied values expect the same mid-rank percentile.

### D2. Share-card goalie record folds everything that is not a win into losses (M-MISC-019) · wrong · live (studio) · P1

- **What.** `recentLine` prints `${wins}-${games − wins}` (`SocialShare.tsx:331`). `games` is the count of the last five appearances with `games_played > 0` (`players.ts:258-259`), and the loader selects no loss columns (`players.ts:231`). A goalie at 3 wins, 1 overtime loss and 1 relief no-decision prints "3-2".
- **Standard.** NHL record W-L-OTL; decision 72 (a goalie record shows his own credited decisions) and decision 46.
- **Fix.** Add the regulation-loss and overtime-loss columns of `wgo_goalie_stats` to `ShareGoalieGameRow` and the recent-form type, and print W-L-OTL. If a decision column is null, print the record as unavailable (rule 5).
- **Readers.** `recentLine` (spotlight and pickup cards); `fantasyPointsPerGame` and `streakOf` read the same `recent` object and must keep working.
- **Test.** Five rows: 3 W, 1 OTL, 1 relief with no decision. Expect "3-0-1", not "3-2".

### D3. Legacy averages service (M-MISC-007) · wrong · dormant · P2 (P1 if an outside reader exists)

- **Reach settled as far as the repo allows.** `/api/Averages/[playerId]` is imported only by `lib/nst/callerLifecycle.test.ts`. `/api/ThreeYearAverages/[playerId]` has no caller. The only live sibling is `/api/CareerAverages` (`hooks/useCareerAveragesStats.ts` → `/charts`), a separate file already judged in sustainability-part1 (040, D3). Both dormant routes are public and fetch NST on demand behind `withNstJobLifecycle`. Outside callers are unknown; I did not read Vercel logs.
- **a. SOG/60 is 60× low.** `parseTime` turns NST decimal minutes into seconds (`helpers.ts:121-125`); the service then computes SOG ÷ TOI × 60 at `statsService.ts:158` (traded-player TOT row), `:317-320` (averages) and the per-season rows (`:64-68`). The same line is at `pages/api/ThreeYearAverages/[playerId].ts:454`. Fixture: 200 SOG in 1,400.5 minutes gives 0.143; correct is 8.57.
- **b. The TOT rate row is not a rate.** `addTotalRows` sums each team's per-60 values, then the callback divides by TOI seconds and multiplies by 3,600 (`statsService.ts:483-490`). Fixture: 9.0 per 60 over 600 minutes and 6.0 over 300 minutes gives 1.0; the TOI-weighted answer is 8.0. The older route does it properly (rate × TOI ÷ 3600, then ÷ TOI × 3600, `ThreeYearAverages/[playerId].ts:561,586`), so this was lost in the refactor. The TOT shares built from those rates are still right, because the common factor cancels.
- **c. Mis-specified.** Multi-season rates are an unweighted mean of season rates (`:598-600`), not TOI-weighted. "Three-year" drops the newest season in the data as "current" (`:180`, `:525`), which is wrong for a player with no games this season. Zero denominators return 0, not null (rule 5). `xS%` is ixG ÷ SOG as a fraction, while decision 17 fixes xSH% as ixG ÷ Fenwick on 0–100: one of the two must be renamed.
- **Fix.** × 3600 at the three count sites and the sibling route; TOT rate = Σ(rate × TOI) ÷ Σ TOI; weight season rates by TOI; null on zero denominators.
- **Test.** Unit tests on the two callbacks with the fixtures above (the existing `__tests__/pages/api/Averages/helpers.test.ts` does not assert SOG/60). No deletion (rule 6).

### D4. Roster-tab height and age (M-MISC-016) · wrong · conditional · P2

`RosterMatrixWrapper.tsx:510-512` takes feet = floor(cm ÷ 30.48) and inches = round(remainder ÷ 2.54), so 181 and 182 cm print 5'12". NHL heights are whole inches stored as rounded centimetres (180, 183, 185 …), so the bad values may never occur; not counted here. Age uses 365.25-day years (`:502-507`) and can be a day early or late at a birthday. Fix: reuse `components/WiGO/playerBiography.ts` (`formatHeight`, and its UTC birthday rule). Test: 182 cm → 6'0"; a birthday today → the new age.

### D5. Homepage shots on goal (M-MISC-036) · mis-specified · live · P2

SOG = `shots_es + shots_pp + shots_pk` from `forge_team_game_strength` (`homepageGameAnalytics.ts:277-287`). On 118 team-games (2026-11-01 to 11-09) it equals NHL.com SOG in 110, is lower in 2 and higher in 6 (range −4 to +1 against official). A row with one null part still sums the others (0 of 118 in the sample). The split table's classifier is the lines-toi-pp-units audit's subject (decisions 59, 70). Fix: read official SOG for the card, or show the sum only when all three parts are present and label the source. Test: a fixture row with a null part expects no SOG.

### D6. Homepage pulse (M-MISC-037) · mis-specified · live · P2

With two or more market observations the line is |model − de-vigged market|; otherwise it is |model − 0.5| on the same chart (`homepagePulse.ts:187-200`), with no label for either. The model is the placeholder of decision 1, and decision 42 says to show "unavailable" when no production game model exists. Fix belongs with the game-predictions lane: hide or label the series under decision 42, and never switch quantity without a label. Test: fewer than two market points expects an empty or flagged series.

### D7. Pickup-table composite (M-MISC-030) · mis-specified · live · P2

Percentiles are taken on season totals, so games played is rewarded twice (GP% is also a metric). A missing metric is left out of the composite but its own cell shows percentile 0 (`PlayerPickupTable.tsx:2547,2613-2630`), which reads as worst in league (rule 5). The header already says "Score", in line with decision 74. Fix: show a missing metric as "—"; decide per-game vs totals with the fantasy-scoring lane (C30 owns this table). Test: a player with a null metric expects a null cell and an unchanged composite.

### D8. Trends hot and cold teams (M-MISC-041) · mis-specified · live · P2

Hot = percentile ≥ 70 or delta ≥ 2, first three in the incoming order; cold = percentile ≤ 35 or delta ≤ −2 (`pages/trends/index.tsx:727-736`). A low team that rose two points qualifies for both, and "hot" depends on input order (rule 20). `pages/trends/placeholder.tsx` describes a weighted last-10 trend that its plain moving average does not compute (legacy). Fix: make the lists exclusive with an explicit sort. Test: a team at percentile 30 with delta +2 appears in one list only.

### D9. Dashboard recency state (M-MISC-027) · mis-specified · live · P2

Feeds up to three days apart count as "aligned"; beyond that the warning says projection and start context "is downgraded" (`dataFetchers.ts:374-384`), but the readers only show a label (`pages/trends/index.tsx:1212,1709`). Dates are compared as UTC days (rule 19). Fix: say "may be out of date" unless a real down-weight exists; require the same slate date for projections and the start chart. Test: a four-day gap expects the reworded warning.

### D10–D12. Small labelling items · mis-specified · P2

- **D10 (M-MISC-015).** Rising or Falling compares only the first and last of four weeks with no tolerance (`OpportunitySparkline.tsx:14-19`). Add a minimum change, or label it "first vs last week".
- **D11 (M-MISC-024).** `firstNameSimilar` accepts a shared prefix of half the longer name (`upsert-csv.ts:83-88`), so "Alex" matches "Alexis" when the surname passes. Admin-only import; require an exact or alias match, or report these for review.
- **D12 (M-MISC-032).** `getPointsClass` grades season-total thresholds (100/90/80) on in-season totals, so every team reads "poor" for most of the year (`TeamScheduleCalendar.tsx:2211-2216`). Use points % or pace. The game rating is a presentation heuristic (rule 12) and should be labelled as such.

## 4. Owner questions (not answered by decisions 1–79 or Tier B)

1. **Are `/api/Averages/[playerId]` and `/api/ThreeYearAverages/[playerId]` read outside the repo?** Recommended: assume not, fix the units in place with tests (P2), and leave removal to the cleanup inventory. Alternative: check Vercel logs first; a reader makes D3 a P1.
2. **Share-card goalie record.** Recommended: W-L-OTL from credited decisions, extending decision 72 to share cards. Alternative: drop the record from the line.
3. **Player-page heat map wording.** Recommended: "performance score (fixed thresholds)". Alternative: build real per-position percentiles.
4. **Radar ties.** Recommended: mid-rank everywhere. Alternative: keep strictly-worse and say so.
5. **Homepage pulse under decision 42.** Recommended: hide until a qualified game model exists. Alternative: keep it, labelled "placeholder model vs market".

## 5. Limits

- **Not read in full.** `top_scorers_relationship_analysis.py` (026, judged from the inventory text); the Python name-matcher tests (023, not run); the bodies of several share modules whose tests passed (010, 022, 042, 045). "Sound" there means the formula sites named above match their written contract and the tests pass, not a line-by-line proof.
- **Reach.** Traced by import and route search (rule 18). The share studio is live for the owner; its numbers reach the public only on a published graphic. No Vercel logs were read.
- **Database.** `pg_stat_activity` before the reads showed 2 active backends; the only long one was the realtime replication walsender (782 s), not a query, so I continued with small reads. Queries:
  - `nst_team_stats` where season = 20262027 and situation = 'all', limit 4 (ANA: gp 18, gf 69, sf 448, xga 65.8: totals).
  - Players 8478402, 8477934, 8480012, 8476453, 8475786, 8481559, 8478483, 8479318, season 20262027: avg of `goals_per_60`, `shots_per_60`, `ixg_per_60`, `total_points_per_60` from `nst_gamelog_as_rates` vs Σ count × 3600 ÷ Σ `toi` from `nst_gamelog_as_counts`; avg `cf_pct`, `xgf_pct` vs pooled from `nst_gamelog_as_counts_oi`.
  - `forge_team_game_strength` joined to `wgo_team_stats` on team and date, 2026-11-01 to 2026-11-09: `shots_es + shots_pp + shots_pk` vs `round(shots_for_per_game)` where `games_played = 1` (n = 118).
- **Tests run.** `npm test --` on 25 files (category counts, goalie period, team stream, team games, standouts, what changed, role watch, nightly floor, BSH, crease shift, GSAx, ratio impact, off-night edge, score, streak, matchups, tiers, tweet trainer, tweet identity, X poller, NST rate policy, metrics timeline, player stats contract, averages helpers, WiGO stats): 701 passed.
- **Not maths.** `lib/supabase/GoaliePage/updateWeeklyData.ts:16-17` logs the Supabase URL and a key value (legacy script). The value was not printed or copied; it should be removed by whoever owns that script.
- **No Astra conflict.** Astra's W2-1 review touches this packet only at M-MISC-001 and 002, and I adopt both dispositions.

## 6. Final analysis and fix-agent handoff

### Final analysis

This family is mostly sound. The social-share library (about half the entries) pools rates from summed parts, keeps missing values as unknown, ranks ties explicitly and prints its formulas from the constants it uses; its tests pass. The Category Counts helpers (046–052) are the cleanest code in the packet. Ten entries are copies of things Waves 1 and 2 already judged, and I add nothing to them except reach for the game-page Poisson chart (imported, never rendered) and the skater-variance helper (no importer).

What is wrong is narrow. The player stats page averages per-game rates and percentages instead of pooling counts and exposure, which is the rule-13 defect in its simplest form: a 9-minute game counts as much as a 22-minute one. The size is small for regulars and about 10% for players with few or uneven games. The share cards' goalie record invents losses from overtime losses and relief appearances. The legacy averages service has two real unit errors (60× on SOG/60, and a summed-rates row), but nothing in the repo reads it; the older sibling route shows the second error was introduced by a refactor. Astra's upstream corrections do not change any of this: for `gameOutcomes`, keep the finality finding and do not treat a team loss as a goalie's loss.

The remaining items are labels and tie rules: a step score called a percentile, a "downgraded" warning with no downgrade, hot and cold lists that overlap, a homepage line that changes meaning, and a shots total built from a strength split that is not always the official count.

### Recommendations, in priority order

1. **P1, D1.** `components/PlayerStats/playerStatsContract.ts` `aggregateSummaryStat`: pool per-60 and on-ice shares from the NST count rows the page already loads; null when a part is missing. Readers: all `aggregateSummaryStat` callers on `/stats/player/[playerId]`. Test: the two-game fixtures in D1, in `playerStatsContract.test.ts`.
2. **P1, D2.** `lib/socialShare/players.ts` (`ShareGoalieGameRow`, the goalie `recent` builder), `lib/socialShare/types.ts:85`, `components/SocialShare/SocialShare.tsx` `recentLine`: carry losses and overtime losses; print W-L-OTL. Readers: `score.ts`, `streak.ts`, fixtures in `pickupsFixture.ts`. Test: `players.test.ts:150-154` extended with an OTL and a relief row.
3. **P2, D1 extras.** `PlayerRadarChart.tsx` `rankAgainst` to mid-rank; heat-map copy at `PlayerPerformanceHeatmap.tsx:1013,1070,1614`.
4. **P2, D3.** `lib/api/averages/statsService.ts` (three SOG/60 sites, TOT rate callback, season weighting, zero handling) and `pages/api/ThreeYearAverages/[playerId].ts:454`. Tests on the callbacks. No route removal.
5. **P2, D5 and D6.** `lib/homepageGameAnalytics.ts` (SOG source and all-parts rule); `lib/homepagePulse.ts` with `components/HomePage/HomepagePulse.tsx` (decision 42 label or hide).
6. **P2, D4, D7–D12.** One small change each, as written in section 3.

### Directional suggestions (not defects)

- Share cards use the site default scoring; a league-aware score would need decision 54's labelling.
- Opponent DEF and "easiest schedule" ignore home/away and use season-to-date totals; a recent-window or venue-adjusted version would need held-out evidence (rule 12).
- `bandChip` duplicates `PICKUP_BANDS` with different wording ("<20%" vs "Under 20%"); one source would be tidier.
- The hot streak rule fires on any one condition and wins over cold; "QS/5" counts relief appearances. Both follow the owner's written rule; revisit only if he wants starts-only.
- The research scripts (025, 026) should control for position and ice time before anyone quotes their correlations.

### Context for fix agents

- **Decisions that apply.** 15 (radar is 5v5, labelled), 17 (xSH% definition and name), 40 (Quality Start), 42 and 1 (no production game model), 44 (Poisson chart stays unserved), 46 and 72 (goalie decisions), 54 (default-weight labels), 59 and 70 (strength split), 74 (score vs percentile). Rules 4, 5, 6, 13, 16, 18, 20.
- **Unit traps.** `wgo_*` TOI is seconds. `nst_gamelog_as_counts.toi` is seconds in production (not minutes). NST HTML TOI in the averages service is decimal minutes turned into seconds by `parseTime`. WGO percentages are fractions; NST percentages are percentage points (`FRACTION_PERCENT_STATS`). Heat-map TOI thresholds are minutes. In SQL checks, cast before dividing: integer TOI makes Σ goals × 60 ÷ Σ TOI return 0.
- **Null handling.** The share library returns null on any missing game; keep that. Do not replace a null with a partial ratio (rule 16).
- **Do not change.** The Category Counts contract and its comparison precision; the disclosed share-card formulas (`SCORE_FORMULA`, multi-cat labels, the undrafted ADP note); `gameOutcomes` here (sql-cross-cut D11 owns it); NST request pacing (nst-derived M-NST-027 owns it); `/api/CareerAverages` (sustainability-part1 D3 owns it). Delete nothing (rule 6).
- **Ownership.** Social-share files are in an active Claude lane (`tasks/diaries/2026-10-31-claude-social-share-chef.md` has uncommitted edits): agree file ownership before touching `lib/socialShare/**` or `components/SocialShare/**`. `pages/buyLowSellHigh.js` is in the Codex BLSH lane. The pickup table belongs to the fantasy-scoring lane (C30).
- **Production actions.** None of these fixes needs a migration, backfill, rebuild or env change. All are code and tests. The averages routes call NST when invoked: do not call them to verify (use the unit fixtures).
- **Suggested lanes.** (A) Player stats page: D1 and its extras. (B) Social share: D2, plus the tidy-ups if wanted. (C) Legacy and small UI: D3, D4, D8–D12. (D) Homepage, joined to the game-predictions lane: D5, D6. D7 goes to the fantasy-scoring lane's pickup-table work.

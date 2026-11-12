# Audit: Underlying stats summaries, part 1 (M-UST-001 to M-UST-060)

Wave 2. Audited 2026-11-11 against `octoberBranch` at `6d574deab` plus the dirty working tree. No code was changed. Line numbers are from the current checkout; re-locate by symbol.

**How this was done.** One auditor, no sub-agents. I read the packet, OWNER-DECISIONS 1–68, both consolidated batch files, TRIAGE, and the upstream audits `nst-derived-stats.md` (W1-2) and `team-ratings-power-ctpi-sos.md` (W1-4). I then read the live code paths end to end and ran ten bounded production reads (section 6). Legacy and dormant entries got a status check and a spot-check of their strongest lead, not a line-by-line re-derivation; section 6 lists which.

**Evidence labels** (Batch B/C convention). *Measured*: a dated production read with its sample size. *Source-confirmed*: the code path was traced but not executed. *Carried*: taken from the inventory and not re-derived.

---

## 0. Brief (written before the audit)

**Why this packet.** TRIAGE ranks it 13th (risk 4, impact 4): "Goalie MD/LD goals double-counted; strength filter falls through to PK; many unit assumptions in SQL views". It sits in the aggregate layer: it reads the event and parity layer audited in W1-2 and the team ratings audited in W1-4, and it feeds the player, goalie and team underlying-stats pages, the `/underlying-stats` landing page, the goalie and skater variance pages and the team roster matrix.

**Questions to answer**

1. Are triage items C36 (goalie MD/LD goals counted twice) and C37 (skater strength filter falls through to PK) real, and how large?
2. Do the team, skater and goalie strength and score-state filters select the same situations for counts as for ice time? Do they follow owner decisions 9 and 11?
3. Which TOI unit does each table hold (seconds or minutes), and does every SQL view and reader use the right one? (Batch B/C cross-packet item "seconds read as minutes".)
4. Are percentages pooled (ratio of sums) where the label implies a season or window value? Is each percent scale (0–1, 0–100, ~100, ~1000) declared?
5. Does any reader turn an unknown into 0, 50, 100 or "average"? (Batch A rule 5.)
6. Do the landing-page context numbers (PP%, PK%, SOS, trend, luck, archetypes, narrative) inherit the W1-4 defects, and do they add their own?
7. Are the variance-page scores (goalie week tiers, percentiles, consistency, value tier; skater week ratings) internally sound and honestly labelled?
8. Which entries are live, conditional, dormant or dead? (Batch B/C rule 8.) Is each inventory status right?

**Reference standards**

- Natural Stat Trick (NST) glossary and table conventions: on-ice shares F/(F+A), per-60 = count × 60 ÷ TOI minutes, PDO = on-ice SH% + SV%, OZS% = OZ/(OZ+DZ), score-state and situation filters. Binding through owner decisions 9 and 11.
- GSAA as NST labels it: shots against × (1 − league SV%) − GA at the aggregate level (decision 10). GSAx (xGA − GA) is a different statistic.
- NHL.com conventions: GAA = GA × 3600 ÷ TOI seconds; SV% = saves ÷ shots against; points % = points ÷ (2 × GP); PP% = PP goals ÷ PP opportunities, pooled.
- Dom Luszczyszyn's Game Score (2016): the same weights as M-UST-004, with on-ice CF/CA and GF/GA at 5v5.
- Quality Start per Rob Vollman (decision 40).
- RPI-style schedule strength (2/3 opponents' record, 1/3 opponents' opponents') and decision 21 (past means final only).
- Mid-rank percentile: (count below + 0.5 × count equal) ÷ N.
- Sample SD (n − 1) against population SD (n), where the code says which it uses.
- Owner decisions 6, 7 and 12 (heuristic xG hidden, then retired; empty-net shots excluded from xG) and the W1-4 direction (pooled season-to-date PP/PK; decision 58 on risers and fallers).

Where no community formula exists (week tiers, consistency score, value tier, archetypes), I judged internal soundness and labelling only.

**Fixtures and data**

- Scalar columns of `team_underlying_stats_summary` by date (the player summaries are stored as jsonb payloads and are off-limits).
- One-date unit reads of `wgo_goalie_stats`, `wgo_skater_stats`, `wgo_team_stats`, `nst_gamelog_as_counts`, `nst_gamelog_goalie_all_counts`; three rows each of `nst_seasonal_individual_counts` and `goalie_totals_unified_snapshot`.
- Catalog reads of `pg_views` and `pg_matviews` for deployed definitions.
- Algebraic checks from source for the goalie danger split.

**Done criteria.** Every entry has a verdict with file:line evidence; every defect has a fix, a test that is an identity on a frozen fixture (Batch A rule 3, Batch B/C rule 11), a priority and its readers; every magnitude is a dated sample with its size; upstream findings are cited, not re-audited.

---

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 14 | 006, 015, 023, 024, 026, 030, 037, 039, 040, 046, 047, 054, 055, 058 |
| Mis-specified | 23 | 002, 003, 004, 005, 009, 012, 013, 014, 016, 017, 019, 025, 028, 031, 032, 035, 041, 045, 051, 052, 053, 056, 057 |
| Wrong | 23 | 001, 007, 008, 010, 011, 018, 020, 021, 022, 027, 029, 033, 034, 036, 038, 042, 043, 044, 048, 049, 050, 059, 060 |
| Undetermined | 0 | Six sub-questions stay open; see section 6 |

Of the 23 wrong entries, 10 are dead or dormant code (001, 007, 010, 011, 018, 020, 021, 027, 043, 044), and the bad columns of an eleventh (008) have no reader. The live damage is concentrated in the three underlying-stats tables and the landing page.

### Top 5 findings by user impact

1. **Team power-play and penalty-kill shot counts are swapped (new, P0; M-UST-034, 060).** The stored strength string is written away-first (`web/lib/supabase/Upserts/nhlStrengthState.ts:44`), but both landing-layer parsers read the first number as the home team's skaters (`web/lib/underlying-stats/teamStatsSummaryRefresh.ts:334-346`, used at `:631`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1708-1720`, used at `:1888`). Ice time is taken from a different, correct parse. So the team Power Play table shows short-handed shot counts over power-play minutes.
   - Measured, 66 regular-season games from 2026-11-01 to 2026-11-10 (132 team rows per strength, all scores): the "5v4 PP" rows hold CF 140, GF 8, GA 88 in 43,639 s (11.5 CF/60). The "4v5 PK" rows hold CF 1,133, GF 88, GA 8 (93.5 CF/60). "Power Play" holds GF 32 and GA 114; "Penalty Kill" holds GF 114 and GA 32.
   - Even strength, 5v5 and 3v3 are symmetric and unaffected. The empty-net filters use goalie flags and are unaffected (measured: with-empty-net GA 24 equals against-empty-net GF 24).
   - The goalie page uses the same swapped parse for its danger-bucket features (finding 2), under the PP, PK, 5v4 and 4v5 filters. Source-confirmed, not measured.
2. **Goalie medium- and low-danger goals against are counted twice (triage C36 confirmed, P0; M-UST-048, 049).** `accumulateLandingMetrics` adds the parity counts (`playerStatsLandingServer.ts:3548`, `:3551`) and then calls `accumulateGoalieShotFeatureBucketMetrics`, which adds the same goals again from the shot features (`:3458`, `:3461`, call at `:3564`). High-danger goals are added once, and only by the second routine (`:3455`). Both use the same 20 ft / 35° and 40 ft / 50° thresholds (`nhlNstParityMetrics.ts:399-405`), so the double count is exact wherever the shot has coordinates and is not an own goal.
   - Effect: MD and LD goals against and MD and LD GAA are 2× the true value. HD + MD + LD goals exceed total goals against by the MD + LD count. MD and LD "GSAA" are low by one full bucket of goals (`:5102-5116`).
   - Per-game summaries are built through the same routine (`:3670`), so stored summary payloads carry the doubled values. A code fix alone does not repair them (Batch A rule 4).
   - Not measured on stored data: the payloads are jsonb.
3. **Five skater strength filters show penalty-kill numbers (triage C37 confirmed, P0; M-UST-060).** `resolveSkaterSplitKey` returns `pk` for 5v4 PP, 4v5 PK, 3v3, With Empty Net and Against Empty Net (`playerStatsLandingServer.ts:1644-1664`), although the parity layer builds all ten splits (`nhlNstParityMetrics.ts:1868-1880`) and the goalie mapping is complete (`:1666-1706`). The filter UI offers all ten (`web/components/underlying-stats/PlayerStatsFilters.tsx:561-567`). The summary builder loops the same ten strengths (`:3566-3577`), so the mislabelled rows are stored too.
4. **Team score-state tables have no ice time, and Leading/Trailing exclude one-goal games (P0; M-UST-036, 059).** Team time segments take the score from each event's `home_score` and `away_score` (`teamStatsSummaryRefresh.ts:327-328`, `:539-568`), which the feed fills on goal events only (W1-2 D1). Shots use the running score (`:525-537`), so counts are populated and time is not.
   - Measured, 2026-11-10 (7 games, 14 team rows per split): `toi_seconds` is 0 in all six score states at all strengths, 5v5, PP and PK, against 51,600 s for all scores. Counts are present (for example CF 279 tied, 212 down one). Every per-60 rate in a team score-state table is therefore null, and TOI shows 0.
   - Leading and Trailing mean a margin of two or more in both copies (`teamStatsSummaryRefresh.ts:349-363`; `playerStatsLandingServer.ts:1722-1736`). Decision 11 makes them any lead or deficit. W1-2 D1 covers the player path; the team path is a separate reader that the parity fix does not touch.
5. **The landing page's PP% and PK% are one game's values (P0; M-UST-033).** `fetchUnderlyingStatsTeamSpecialTeamsContext` takes each team's most recent `wgo_team_stats` row (`web/lib/underlying-stats/teamSpecialTeamsContext.ts:55-60`, `:89-100`). That table holds one row per team game. A game with no opportunities is null, and `Number(null)` turns it into 0 (`:22-25`), ranked last.
   - Measured, 2026-11-07 to 2026-11-10: `games_played` is at most 1 on every row. On 2026-11-10, 11 of 14 teams show PP% = 0 and 12 of 14 show PK% of exactly 0 or 1. On 2026-11-07, 2 of 24 rows have a null PP%.
   - W1-4 D3 found the same single-row read behind the PP/PK tiers and noted this reader (its line 194). The W1-4 direction (pooled season-to-date opportunities and results) applies here unchanged.

Close behind:

- **The "GSAA" column and the heuristic xG** on these pages are already P0 in W1-2 (D2, D4) under decisions 6, 10 and 12. This packet adds only the double count and the swap above.
- **The goalie variance page's NST "GSAA" is a sum of per-game values (P1; M-UST-050),** which decision 10 forbids. Measured on 2026-11-08: the 12 goalie rows' GSAA sum to −0.01, which shows each day is centred on that day's league save percentage.
- **The roster-matrix goalie fallback (P1; M-UST-042)** computes GAA as GA × 3600 ÷ NST minutes, which is 60× too high, and builds low-danger saves from high-danger saves.

### Answers to the brief's questions

1. C36 and C37 are both real. C36 is an exact 2× on MD and LD goals. C37 affects five of ten skater strength options.
2. No. Team counts and time use two different parses of the strength code (finding 1) and two different score sources (finding 4). Decision 11 is not met in either copy.
3. Units by table, measured on one date each: `wgo_goalie_stats.time_on_ice` seconds; `wgo_skater_stats.toi_per_game` seconds; `nst_gamelog_as_counts.toi` seconds; `nst_gamelog_goalie_all_counts.toi` decimal minutes; `nst_seasonal_individual_counts.toi` minutes. Two readers treat NST goalie minutes as seconds (M-UST-001, 042). The other readers checked are right.
4. The live aggregators pool correctly (M-UST-019, 034, 008, 046). Mean-of-ratios survives in the expanded-row chart (056), in dead code (010, 020, 044) and in the single-game PP% (033). PDO appears on three scales: ~100 (team table), ~1.0 (`player_totals_unified`) and ~1000 (`wgo_avg_*`).
5. Yes, in eleven places; see the unknown-handling column of the defect list (D10).
6. They inherit W1-4 D1, D3, D4, D6 and D7 and add the single-game PP% (finding 5).
7. The week tiers and value tier are honest heuristics with three real flaws: the weekly bar includes relief appearances, single-sample goalies score as perfectly consistent, and one input is counted twice (D8, D9).
8. Two inventory statuses are wrong. M-UST-057 is **live**, not dead (`web/pages/api/v1/underlying-stats/players.ts:30`, `goalies.ts:34`). The M-UST-014 lead "only four stats get a percentile" is out of date: eleven are mapped (`web/components/GoaliePage/goalieCalculations.ts:581-601`). The M-UST-052 lead "fantasyPointsAboveAverage is never assigned" is false on the live page (`web/pages/goalies.js:361-365`).

---

## 2. Per-entry table

Reach: **L** live, **C** conditional, **D** dormant (deployed, no reader found), **X** dead or disabled.

| ID | Verdict | Evidence | Reference | Magnitude | Reach and readers |
|---|---|---|---|---|---|
| 001 `goalie_totals_unified` + snapshot | **Wrong** | NST GAA, SA/60, saves/60, GSAA/60, xGA/60 multiply by 3600 and divide by NST TOI that is in minutes (`supabase/migrations/20260716112908_production_schema_baseline.sql:11396-11404`; source `nac.toi` unconverted at `:9754`). `nst_all_gsaa` sums per-game GSAA (`:11379`). The WGO half (SV%, GAA on seconds) is right (`:11370-11374`). | NHL GAA; decision 10 | Measured, 3 snapshot rows of season 20242025: GAA 2.53 / 2.66 / 2.93 against `nst_all_gaa` 150.1 / 163.0 / 176.1; NST SA/60 1,504 to 1,732. One row has NST TOI 17,418 min for 54 GP (WGO 3,248 min), which suggests duplicated NST rows. | D. No reader in `web/`, `functions/` or `modeling/` |
| 002 `goalie_weekly_aggregates` | **Mis-specified** | Deployed definition read from `pg_views`; matches the repo. Pooled SV%, GAA, per-60 on seconds: correct. Zero shots or TOI gives 0, not null. Relief appearances are rows. | NHL GAA, SV% | Not sized | L. `web/pages/trueGoalieValue.tsx`, `pages/goalies.js`, `web/lib/socialShare/modules/goaliePeriod.ts` |
| 003 `league_weekly_goalie_averages` | **Mis-specified** | Pooled rates are right. Counting "averages" are `avg()` over every goalie-week with TOI > 0, relief included. That average is the bar in M-UST-013. | — | Not sized | L. As 002 |
| 004 `get_skater_game_scores_for_season` | **Mis-specified** | Luszczyszyn's weights with all-situation shot attempts and ES + PP + SH on-ice goals (`…baseline.sql:1353-1366`). The label is "Game Score". | Game Score uses 5v5 on-ice CF/CA, GF/GA | Not sized. A PP goal scores 0.75 + 0.15; the reference gives 0.75 | L. WiGO game-score chart. The wigo packet (Wave 3) owns the fix |
| 005 `get_skaters_avg_stats` | **Mis-specified** | Unweighted per-game means; no minimum games; no game-type filter (`…baseline.sql:1392-1406`) | — | Not sized | L. `web/pages/api/v1/player/[id]/percentile-rank.ts`, `web/hooks/usePercentileRank.ts` |
| 006 `nst_seasonlong_*_counts(_oi)` | **Sound** | Sums; TOI labelled seconds and measured in seconds (335 to 1,854 s per game on 2026-11-08, n = 216); SH% on 0–100 (`:18682-18712`) | NST season totals | — | L. Rates and percentile views, radar, roster matrix. Game type is whatever the gamelog tables hold |
| 007 `nst_percentile_*_filtered` | **Wrong** | (count ≤ + 0.5 × count =) ÷ N (`:18915-18919`). Ties are weighted 1.5×, so a unique maximum scores (N + 0.5)/N > 1. The pool depends on the subject's own GP. Defensive rates are not inverted. Zero-TOI players enter as 0.0 through 038's defaults. | Mid-rank | With all values distinct the bias is +1/N. With a tie of k players the excess is k/N; ties at 0.0 are common | X. Only `web/e2e/fixtures/wigo/schema.json` |
| 008 `player_totals_unified` | **Wrong** (on-ice per-60 only) | NST all-situation on-ice counts divided by WGO even-strength TOI (`:23449`, `:23457`; joins to `nst_gamelog_as_*` at `:23036-23039`). The rest is right: pooled shares, PDO = SH% + SV% on the 1.0 scale (`:23447`), OZS% = OZ/(OZ+DZ) (`:23448`), PP share from estimated team PP time with `pp_toi_pct_per_game` measured as a 0–1 fraction. | NST per-60 uses matching TOI; decision 9 | On-ice per-60 are high by all-situation TOI ÷ EV TOI for each player. Not sized | L for the matview (sustainability reads `nst_ixg_per_60`, `nst_oi_pdo`). D for `nst_oi_*_per_60`: no reader found |
| 009 `wgo_*_stats_per_game` | **Mis-specified** | Counts ÷ GP. `percent_games` divides by the current team's games for multi-team players (`:27297`, `:27307-27311`). Goalies use GP, not GS. | — | Not sized | L. Player radar (moves to 5v5 under decision 15) |
| 010 `get_aggregated_player_stats` | **Wrong** | "pdo" = Σ sv% ÷ Σ sh% × 100; zone-start % is an unweighted mean of game values (`supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:41-59`); the (int,int) overload filters by calendar year | PDO = SH% + SV% | — | X. No caller |
| 011 WGO averages script | **Wrong** | Per-60 and PIM rates divide by `pp_toi` as if it were total TOI (`web/scripts/WGOAverages/calculateAverages.ts:355`, `:477`). Other leads carried. | NST per-60 | — | X. Runs only with `RUN_WGO_AVERAGES_SCRIPT=true` |
| 012 Goalie FP, SV%, GAA | **Mis-specified** | Formulas right on seconds (`web/components/GoaliePage/goalieCalculations.ts:157-170`, `:176-188`; TOI measured 3,225 to 3,848 s on 2026-11-08, n = 12). SV% and GAA are 0 with no shots or time. "Variance" fields hold standard deviations. Every game row is one GP, relief included. | NHL SV%, GAA | — | L. `pages/goalies.js`, `pages/trueGoalieValue.tsx` |
| 013 Goalie week tier (WoW) | **Mis-specified** | Counting stats are compared with 003's per-goalie-week average, which includes relief rows, so any multi-start week clears the saves, wins, GP and TOI bars and tends to miss the losses bar. A tie counts as better (`:240-244`). A zero league average drops the stat and changes the denominator (`:233`). | None; FHFH heuristic | Not sized | L. Goalie list and leaderboard order |
| 014 Goalie percentiles | **Mis-specified** | The formula is the mid-rank (`:300-313`). Eleven stats are mapped (`:581-601`). The pool has no minimum sample by default (`pages/goalies.js:521`), so a one-game 1.000 SV% ranks first. | Mid-rank | — | L |
| 015 Goalie consistency score | **Sound** | `round(max(0, 100 − popSD/50 × 100))`, null under two weeks (`:79-93`). The largest SD of scores in {0…100} is 50, so the range is exactly 0–100. Labelled a stability score. | — | — | L. Uses population SD where 012 uses sample SD; say so in the tooltip |
| 016 Legacy weekly league averages | **Mis-specified** | Carried. Same per-goalie averaging as 003 | — | — | X. No importer outside `web/lib/supabase/GoaliePage/` |
| 017 Legacy season ranking points | **Mis-specified** | Carried. Totals not normalised by weeks | — | — | X |
| 018 Legacy weekly tier | **Wrong** | Carried. GAA, losses and goals against scored higher-is-better | — | — | X |
| 019 Ratio-of-sums aggregation | **Mis-specified** | Pooling is right. `addNullable` skips a null game (`playerStatsLandingServer.ts:2092-2101`), so a window with some unmeasured games reports a partial sum as the total. One game without reliable TOI nulls every rate in the window (`:3472`). | NST ratio of sums | Not sized | L. Player and goalie tables, detail pages, chart |
| 020 Legacy power rankings aggregation | **Wrong** | Carried. GF/GA labelled GF%; PP% and PK% as means of game values | — | — | X. Route returns 410 (`web/pages/api/v1/db/update-power-rankings.ts:20`) |
| 021 Legacy power-ranking ranks | **Wrong** | Carried. Ranks over every historical row | — | — | X |
| 022 Landing SOS | **Wrong** | (2 × direct + indirect) ÷ 3 per bucket; overall = mean of past and future (`web/lib/underlying-stats/teamScheduleStrength.ts:195-239`, `:314-317`). The future bucket's indirect term uses opponents' future schedules (`:211-214`). Inputs come from the SOS writer that W1-4 D7 found counting unplayed games as past and including head-to-head. The PRD's predictive half does not exist. | RPI; decision 21 | See W1-4 D7 | L. Landing page. W1-4 owns the fix |
| 023 Schedule texture | **Sound** | Counts and rest days are right (`:396-461`). Two labelling notes: 3-in-4 windows overlap, and a game tomorrow after a game today is not counted as a back-to-back because "upcoming" starts after the selected date (`:420`, `:432-437`). | Common rest conventions | — | L. Landing schedule chips |
| 024 Skater weekly aggregates and buckets | **Sound** | Sums, FP ÷ games, decile ownership buckets (`web/components/SkaterPage/skaterCalculations.ts:178-242`). The ADP round assumes 12 teams. The 0.5 `percent_drafted` floor assumes a 0–1 scale; not verified. | — | — | L. `/variance/skaters` |
| 025 Skater week rating | **Mis-specified** | Thresholds match the PRD (`:426-443`); sample SD (`:76-86`). "Variance" fields hold SDs. A week with no games is absent, so "% good weeks" ignores missed weeks. With non-negative weekly points the lowest possible z is −mean/SD, so "Really Bad" can be unreachable in a skewed bucket (hypothesis; not measured). | z-score bands | Not sized | L |
| 026 Skater FP per game | **Sound** | Σ stat × weight; TOI seconds to minutes (`:89-118`; `toi_per_game` measured in seconds). Selecting Points with Goals and Assists double counts by the user's own choice. | Points-league scoring | — | L. Weights must be labelled "FHFH default" (decision 54) |
| 027 Legacy power-ranking SOS | **Wrong** | Carried. Cumulative standings rows summed | — | — | X |
| 028 Archetype tags | **Mis-specified** | Undocumented thresholds on W1-4 ratings (`web/lib/underlying-stats/teamLandingDashboard.ts:101-144`). "Special-teams boosted" reads tiers that W1-4 D3 found come from one game. Only the first three tags in code order are kept (`:143`). | None | Inherits W1-4 D1, D3 | L. Landing chart tab |
| 029 Risers and fallers | **Wrong** | Sorted by `trend10` (`:316-345`), which W1-4 D6 found is mostly noise; power from `computeTeamPowerScore` (W1-4 D4) | Decision 58 | W1-4: stored `trend10` SD 8.1 on 2026-11-10 | L. W1-4 owns the fix |
| 030 Process quadrant | **Sound** | 0.7 z(xGF/60) + 0.3 z(SF/60) and the mirrored defence; population SD over the supplied teams (`:73-87`, `:269-279`). The mean of a weighted z is 0, so the clamped average lines are harmless. | z-score | Inherits the W1-4 component inputs | L. The 0.7/0.3 weights are a presentation choice |
| 031 PDO luck status | **Mis-specified** | Hot or cold at \|z\| ≥ 1; a missing z reads "normal" (`web/lib/underlying-stats/teamLandingRatings.ts:284-289`). The z itself is W1-4 D6. | PDO regresses to 1.000 | Inherits | L |
| 032 Narrative drivers | **Mis-specified** | Differences today's ratings against the mean of the previous ten snapshots (`web/lib/underlying-stats/teamRatingNarrative.ts:85-114`, `:284-312`), each standardised against a different slate (W1-4 D1). The special-teams driver moves when a single-game tier moves. | — | Inherits | L |
| 033 Landing PP% / PK% | **Wrong** | Top finding 5 | NHL PP%, pooled; W1-4 direction | Measured, see finding 5 | L |
| 034 Team landing aggregation | **Wrong** (inputs) | The arithmetic is right: pooled shares, SH%, SV%, per-60 (`web/lib/underlying-stats/teamStatsQueries.ts:232-254`, `:630-660`). The inputs are wrong for PP and PK (finding 1) and score states (finding 4). PDO is on ~100 beside 0–1 percentages (`:248-254`). Split-strength rows carry the whole game's W, L and points (`teamStatsSummaryRefresh.ts:1005-1012`), so "point %" at 3v3 is the points % of games that reached overtime. A game with no resolved winner adds a GP with 0 points (`:932-941`). | NST team table; NHL points % | Measured, see findings 1 and 4 | L. `/underlying-stats/teamStats` |
| 035 Official NHL overlay | **Mis-specified** | 5v5: SF% = official SF ÷ (official SF + native SA); SH% = native GF ÷ official SF; PDO adds native SV% (`teamStatsQueries.ts:561-565`). All strengths: SA rebuilt as round(per-game × GP) (`:519`). A failed fetch falls back silently (`:625-627`). The equal-GP guard is right (`:508`, `:555`). | NHL team summary, SAT | Not sized | L. Single season, all scores, all strengths or 5v5 |
| 036 Team strength-segment TOI | **Wrong** | Top finding 4. Also event-interval time, not shift or penalty-clock time (W1-2 D8) | NST team TOI | Measured, see finding 4 | L |
| 037 `fetch_team_table` header and percent checks | **Sound** | Renames only; a percentage outside 0–100 becomes None (`functions/api/fetch_team_table.py:86-94`) | NST team table | — | L. PDO is not range-checked |
| 038 `nst_seasonlong_*_rates(_oi)` | **Wrong** | OZS% and OZFO% include neutral-zone starts in the denominator (`:18848-18849`), against decision 9. Zero denominators report 0, 50 or 100 (`:18809-18846`). | NST OZS% = OZ/(OZ+DZ) | W1-2 D12 reproduced 50 against 66.7 on a fixture for the parity copy | L. WiGO percentile views, radar |
| 039 `nst_seasonlong_combined_*` | **Sound** | Carried. Duplicate of 038's per-60 arithmetic | — | — | X. No reader |
| 040 Leaderboard colour bands, FP diff | **Sound** | Presentation thresholds (`web/components/GoaliePage/GoalieLeaderboard.tsx:35-40`). Undefined is coloured as low. | — | — | L |
| 041 Roster-matrix heat shade | **Mis-specified** | Only GAA is inverted (`web/components/RosterMatrix/RosterMatrix.tsx:360`); other lower-is-better columns shade the wrong way | — | — | L |
| 042 Roster-matrix goalie fallback | **Wrong** | GAA = GA × 3600 ÷ `nst_gamelog_goalie_all_counts.toi`, which is minutes (`web/components/RosterMatrix/RosterMatrixWrapper.tsx:435-438`). LD saves are built as `hd_saves \|\| …`, which adds high-danger saves (`:421-426`). Zero shots gives 0. | NHL GAA | GAA 60× too high; LD SV% = Σ HD saves ÷ Σ LD shots. TOI measured 53.75 to 64.13 on 2026-11-08 (n = 12) | C. Only for goalies missing from the primary stats map (`:497`) |
| 043 Legacy three-year counts | **Wrong** | Carried | — | — | X. No caller |
| 044 Legacy three-year rates | **Wrong** | Carried. Unweighted mean of per-60 rates | — | — | X |
| 045 NST scrape normalisation | **Mis-specified** | Carried for the parsers. Confirmed in data: TOI is seconds in skater gamelogs and minutes in goalie gamelogs and seasonal tables, under one column name. This is the root of 001 and 042. | — | See 001, 042 | L |
| 046 `update-wgo-averages` | **Sound** | Per-60 = count × 60 ÷ TOI on a table measured in minutes (`web/pages/api/v1/db/update-wgo-averages.ts:884-918`; 3 rows of 2025-26, 17.4 to 20.6 min per GP); pooled shares; OZS% excludes neutral. PDO on ~1000. | NST conventions | — | L writer. No reader of `wgo_avg_*` found in the repo |
| 047 Client display transforms | **Sound** | Carried. Unit conversions only | — | — | L |
| 048 Goalie danger-split accumulation | **Wrong** | Top finding 2. Also inherits the swapped strength parse (finding 1) and the heuristic xG (W1-2 D2) | NST HD/MD/LD goalie splits | 2× on MD and LD goals, by construction | L. Goalie table, detail, chart; stored summaries |
| 049 Goalie SV%, GAA, "GSAA", danger metrics | **Wrong** | SV% and GAA are right. "GSAA" = xGA − GA (`playerStatsLandingServer.ts:5084-5087`; W1-2 D4). HD SV% uses parity shots and saves while HD goals come from the second routine. MD and LD GAA and GSAA carry the double count. | Decision 10 | As 048 | L |
| 050 Goalie advanced NST metrics | **Wrong** (GSAA) | GSAA = Σ per-game NST GSAA (`web/components/GoaliePage/goalieMetrics.ts:185`). Per-60 on NST minutes is right (`:93-94`). QS% = Σ quality starts ÷ Σ starts from the NHL-supplied flag (`:155-161`, `:214-215`). | Decision 10; Vollman QS (decision 40) | Measured, 2026-11-08: 12 goalie rows sum to −0.01 | L. `pages/goalies.js` advanced table |
| 051 Leader groups, relative variance | **Mis-specified** | Carried. "Consistency leaders" add an SD of week points to an SD of game fantasy points | — | — | L |
| 052 Goalie value tier | **Mis-specified** | SD of fewer than two samples is 0 (`goalieCalculations.ts:146-150`) and is ranked smaller-is-better, so a one-game goalie tops the consistency component (`goalieMetrics.ts:596-607`). The default minimum GP is 0 (`pages/goalies.js:521`). "FP above average" is FP/G minus a constant, so the fantasy component is one input counted twice (`pages/goalies.js:361-365`; `goalieMetrics.ts:582-593`). | None; FHFH heuristic | Not sized | L. Tier 1–5 badge |
| 053 Legacy goalie week pipeline | **Mis-specified** | Carried. The script prints connection settings at start-up (`web/lib/supabase/GoaliePage/updateWeeklyData.ts:16`); not a maths issue | — | — | X. Standalone script |
| 054 NHL Edge ingestion and freshness | **Sound** | Carried. Pass-through; 14-day freshness gate | NHL Edge | — | L. Percent scales are not declared |
| 055 Declared percent units | **Sound** | Carried; W1-4 found the same for the team share helper in this file | Ratio of sums | — | L |
| 056 Expanded-row chart averages | **Mis-specified** | Unweighted means of per-game rates and percentages, with partial windows at the start (`web/components/underlying-stats/PlayerStatsExpandedRowChart.tsx:412-440`). The chart's "season average" differs from the pooled table value for the same metric. | NST pooled rates | Not sized | L |
| 057 Entity ratings overlay | **Mis-specified** | Always the latest snapshot, whatever season or dates the table shows; unpaged `.in()` ordered by date (`web/lib/underlying-stats/entityRatingsOverlay.ts:69-80`, `:121-126`). | — | Not sized | **L**. `pages/api/v1/underlying-stats/players.ts:30`, `goalies.ts:34`. The inventory says dead |
| 058 Native parity game build per split | **Sound** | A selector over 7 score states × 10 strengths; the formulas are W1-2's | — | Inherits W1-2 and 059, 060 | L |
| 059 Score-state classifier | **Wrong** | Leading and Trailing are ±2 or more in both copies (finding 4). The team copy's segment score is the event's posted score. | Decision 11 | Measured for the team path, see finding 4 | L |
| 060 Strength classifier | **Wrong** | Findings 1 and 3. Also, PP and PK are decided by raw skater counts, so 6v5 with the goalie pulled counts as a power play (`teamStatsSummaryRefresh.ts:420-426`). | NST situations; decision 9 | Measured: PP time 48,531 s against 43,639 s at 5v4 over the 66 games; the rest is 5v3, 4v3 and extra-attacker time | L |

---

## 3. Defects, fixes and tests

Priority: **P0** user-visible wrong numbers now, **P1** wrong or misleading with lower or conditional reach, **P2** latent, dormant or dead. Tests are identities on frozen fixtures. No deletion is proposed for any dead entry (Batch A rule 6).

### P0

**D1. Strength string parsed home-first but written away-first** (M-UST-034, 048, 060)
- Fix: one shared parser beside `formatStrengthExact` that returns `{ awaySkaters, homeSkaters }`, used by both landing files. Better still, carry the parsed counts on the shot feature and stop re-parsing a string.
- Readers to repair: team shot metrics (`teamStatsSummaryRefresh.ts:631`), goalie shot features (`playerStatsLandingServer.ts:1888`), and every stored team and player summary row for PP, PK, 5v4 and 4v5. Stored rows need a bounded rebuild as its own approved step.
- Tests: on a fixture game with one home 5v4 power play, the home team's PP row holds the shots taken during it and the away team's PK row holds the same shots as against. For every game, PP CF for one team equals PK CA for the other. Parse(format(x)) returns x.

**D2. Goalie MD and LD goals counted twice; HD goals from a different routine** (M-UST-048, 049)
- Fix: take all three buckets' shots, saves and goals from one routine. Remove the goal increments from `accumulateGoalieShotFeatureBucketMetrics` (`:3455`, `:3458`, `:3461`) and add `hd_goals_against` to the parity counts, or the reverse. Apply the own-goal rule once.
- Depends on: decision 10 (GSAA formula) and Astra's W1-2 note that danger-split GSAA needs bucket-specific league baselines. Fixing the formula without this leaves the split totals wrong, and fixing this without the formula leaves the label wrong.
- Readers: goalie table, detail page, chart, stored summaries (rebuild).
- Tests: HD + MD + LD goals against + unclassified goals = goals against. For each bucket, shots − saves = goals. One fixture goal from 30 ft at 20° adds exactly 1 to MD goals.

**D3. Skater split key falls through to PK** (M-UST-060)
- Fix: map all ten strengths in `resolveSkaterSplitKey`, as `resolveGoalieSplitKey` does, with an exhaustive switch that fails to compile on a new strength.
- Readers: skater individual and on-ice tables, detail, chart, stored summaries for five strengths (rebuild).
- Tests: on a fixture with one 3v3 shift and one 4v5 shift, the 3v3 row's TOI equals the 3v3 shift length and differs from the PK row. Each strength's TOI equals the parity split of the same name.

**D4. Team score-state time and the Leading/Trailing definition** (M-UST-036, 059)
- Fix: stamp each segment with the running score after its starting event, from the same score-state builder the shots use, and define Leading as any positive margin and Trailing as any negative one in both copies (decision 11; W1-2 D1 and Astra's ordering note for goals and stoppages on the same clock).
- Readers: team table for six score states, stored team summaries (rebuild).
- Tests: tied + leading + trailing TOI = all-scores TOI per team-game and strength. Up 1 TOI ≤ Leading TOI. A goal at a segment boundary moves the following segment, not the preceding one. A game with no scores on non-goal events still conserves time.

**D5. Landing PP% and PK% from one game** (M-UST-033)
- Fix: pooled season-to-date PP goals ÷ PP opportunities and 1 − PP goals against ÷ times short-handed, for the selected date's season, with null when there are no opportunities. Share the implementation with the W1-4 D3 tier fix.
- Tests: two fixture games of 1/2 and 0/4 give 16.7%, not 0%. A team with no opportunities is unranked, not last. Rank uses the pooled value.

Upstream P0s that surface in this packet and are owned elsewhere: heuristic xG (W1-2 D2; decisions 6, 12), "GSAA" = xGA − GA (W1-2 D4; decision 10), player-path score state (W1-2 D1), slate-relative ratings, tiers, trend and SOS on the landing page (W1-4 D1, D3, D6, D7).

### P1

**D6. Goalie variance page GSAA is a sum of per-game values** (M-UST-050). Fix: compute SA × (1 − league SV%) − GA over the selected range, strength and season from pooled league totals. Test: a goalie at exactly the pooled league SV% for the range scores 0; the league's GSAA sums to 0 for the range.

**D7. Roster-matrix goalie fallback** (M-UST-042). Fix: divide by TOI minutes × 60; select `ld_saves`, or compute LD saves as LD shots − LD goals; null for zero denominators. Tests: 60 minutes and 3 GA gives 3.00; LD SV% uses LD saves.

**D8. Goalie week tier compares counts with an average that includes relief** (M-UST-003, 013). Fix is the owner's choice (section 4, item 2). Whatever the bar, a tie should not count as better for a counting stat, and the number of compared stats should be shown. Test: with the bar frozen, a goalie exactly at the bar on every stat is "Average".

**D9. Goalie value tier rewards single samples and counts one input twice** (M-UST-014, 052). Fix: a goalie with fewer than two games or weeks has no variance (null), is excluded from that component's pool and is shown as "insufficient sample"; drop "FP above average" from the fantasy component or replace it with something independent. Tests: adding a one-game goalie to the pool does not change any other goalie's consistency percentile; subtracting a constant from every FP/G leaves every score unchanged.

**D10. Unknowns shown as values** (Batch A rule 5). One fix pattern: return null and render a dash.

| Where | Unknown becomes |
|---|---|
| 002 weekly SV%, GAA, per-60 | 0 |
| 012 overall SV%, GAA (`goalieCalculations.ts:161`, `:167-169`) | 0 |
| 014 `calculatePercentile` on empty or NaN (`:275-277`) | 0 |
| 019 partial xG or chance sums (`addNullable`) | A partial total |
| 031 missing PDO z | "normal" |
| 033 null PP% | 0, ranked last |
| 034 unresolved game result | 0 points in a counted game |
| 038 zero-TOI rates and shares | 0, 50, 100 |
| 040 undefined percentage | "low" colour |
| 042 zero shots | SV% 0 |
| 052 variance of one sample | 0, ranked best |

Test for each: the fixture's unknown input yields null, and no rank or percentile is produced from it.

**D11. OZS% and OZFO% include the neutral zone** (M-UST-038). Fix: OZ ÷ (OZ + DZ), as `player_totals_unified` and `update-wgo-averages` already do (decision 9; W1-2 D12 for the parity copy). Test: 6 OZ, 6 NZ, 3 DZ gives 66.7. Reader: WiGO percentile views.

**D12. Official overlay mixes sources inside one metric** (M-UST-035). Fix: overlay a ratio only when both of its parts come from the same source; otherwise keep the native ratio. Flag the response when the overlay is skipped or the fetch fails. Test: after overlay, SF% × (SF + SA) = SF with the row's own SF and SA.

**D13. Split-strength standings columns** (M-UST-034). Fix: show W, L, OTL, points and point % only for all strengths and all scores, or label them "in games with time in this split" (section 4, item 6). Test: a 3v3 row carries no point %.

**D14. Entity rating overlay ignores the table's season** (M-UST-057). Fix: return the snapshot date with the rating and hide or label the rating when the table's range is not current (section 4, item 5); page the read. Test: a 2024-25 table does not show a 2026-27 rating without its date.

**D15. PP and PK include extra-attacker time** (M-UST-060). Depends on section 4, item 1. Test once decided: the 6v5 seconds of a fixture game land in the agreed bucket and nowhere else.

### P2

| ID | Entries | Defect | Fix | Test |
|---|---|---|---|---|
| D16 | 001, 045 | NST goalie minutes treated as seconds in the totals view; per-game GSAA summed; snapshot rows look duplicated and stale | Convert at the source view (minutes × 60) or divide by minutes × 60; replace the GSAA sum per decision 10; check the join grain | GA 150 in 3,600 NST minutes gives 2.50; one row per goalie-game |
| D17 | 008 | NST all-situation on-ice counts ÷ WGO EV TOI | Divide by the NST on-ice TOI of the same rows | Rate × TOI ÷ 3600 returns the count |
| D18 | 007 | Tie weight 1.5×; subject-relative pool; no inversion | (count < + 0.5 × count =) ÷ N on one fixed pool; invert lower-is-better | A unique maximum scores (N − 0.5)/N; no value exceeds 1 |
| D19 | 056 | Chart averages are means of game ratios | Pool numerator and denominator over the window; mark partial windows | The chart's season value equals the table's value |
| D20 | 019 | One unreliable game nulls every rate | Report coverage (games with TOI ÷ games) and compute rates over covered games, labelled | A 10-game window with one uncovered game shows 9/10 coverage |
| D21 | 025 | "Variance" labels hold SDs; missed weeks invisible | Rename to "Std dev"; show weeks played ÷ weeks in range | — |
| D22 | 041, 051 | Heat shade direction; sum of two SDs in different units | A direction per column; rank each SD, then combine | Lower GA shades better |
| D23 | 004, 005, 009 | Game Score variant under the reference's name; no minimum games or game-type filter; multi-team `percent_games` | Owned by the wigo and stats-helpers packets; noted here for the SQL cross-cut | — |
| D24 | 023 | Back-to-back misses "plays today and tomorrow"; overlapping 3-in-4 | Include the selected date's game as the possible first leg; label the count as windows | Today + tomorrow = 1 back-to-back |
| D25 | 010, 011, 016–018, 020, 021, 027, 043, 044, 053 | Dead or disabled code with wrong maths | No deletion. Record as not for reuse; inventory dependencies first | — |

---

## 4. Owner questions not answered by decisions 1–68

1. **Extra-attacker time in "Power Play" and "Penalty Kill".** The code calls any skater advantage a power play, so 6v5 with the goalie pulled is PP for the trailing team. Decision 9 says NST-named filters follow NST; NST's own rule for pulled-goalie time has to be confirmed from its glossary before this can be called a defect. Recommended: follow NST once confirmed, and state the rule in the filter's help text.
2. **The goalie week bar.** The league "average" is per goalie-week with any ice time, relief included. Options: per start, starters only (at least one start), or a per-60 basis for counting stats. Recommended: starters only, with rates compared on pooled league values.
3. **Default minimum sample on the variance pages.** The goalie page defaults to 0 games. Recommended: a visible default (for example 5 starts) that the user can lower, with single-sample players shown as "insufficient sample".
4. **Missed weeks in "% good weeks".** Excluded today. Recommended: keep them excluded and show weeks played beside the percentage.
5. **Ratings beside a historical table.** Show the latest rating with its date, or hide it when the table is not the current season? Recommended: hide it for non-current ranges.
6. **Standings columns in split tables.** Hide W, L, points and point % outside all strengths and all scores, or relabel them? Recommended: hide.
7. **Landing SOS and the PRD.** The PRD asks for 50% record and 50% predictive; the code is record-only. Decision 21 settles "past" only. Recommended: keep record-only for now, labelled as such, and revisit the predictive half after the W1-4 rating fixes.
8. **Dormant goalie totals view.** `goalie_totals_unified` has no reader and wrong NST rates. Fix it in the SQL cross-cut, or mark it "not for use" until something needs it? Recommended: mark it, and fix it only with a reader in view.

---

## 5. Notes for the fix plan

- **Rebuild scope.** D1, D2, D3 and D4 all change stored summary rows. They should land together and be followed by one bounded rebuild, approved as its own step, not four.
- **One parser, one classifier.** The strength parser, the score-state bucket function and the strength matcher each exist twice (`playerStatsLandingServer.ts` and `teamStatsSummaryRefresh.ts`). D1 and D4 exist because the copies drifted from their source. Share them.
- **Conservation tests catch this class.** PP for = PK against, state times sum to total time, and bucket goals sum to goals would each have failed on current production data.
- **TOI unit contract.** Seconds and minutes share the column name `toi` across the NST tables. A declared unit per table, checked in one place, would have prevented D7 and D16 and matches the Batch B/C cross-packet item.

---

## 6. Limits

- **Not measured.** The goalie double count (D2), the skater fall-through (D3) and the goalie-side strength swap are source-confirmed only, because the player summaries are jsonb payloads. Their size on stored data is unknown.
- **Carried, not re-derived.** Entries 016, 017, 018, 020, 021, 027, 039, 043, 044, 047, 051, 053, 054 and 055 rest on the two inventories' descriptions plus a status check. Entries 009, 010, 011 and 037 had one or two lines confirmed. Their verdicts should be read as "consistent with the inventory", not as audited line by line.
- **Open sub-questions.** (a) NST's rule for extra-attacker time. (b) The scale of Yahoo `percent_drafted` (M-UST-024). (c) Whether NHL team-summary goals include shootout-deciding goals, which would enter the overlay's SH% and SV% (M-UST-035). (d) Whether `goalie_totals_unified_snapshot` is stale and why one row's NST minutes are about 5.4× its WGO minutes (M-UST-001). (e) Whether "Really Bad" skater weeks are reachable in practice (M-UST-025). (f) Which game types the NST gamelog tables hold (M-UST-006).
- **Samples are small and dated.** The team-table magnitudes cover 66 games over ten days in November 2026. They show the mechanism, not a season rate.
- **A read-hygiene slip.** The last production read bundled the `pg_stat_activity` check into the same statement as the data read, and it returned 7 active queries, above the limit of 5. The read was three rows by an indexed filter and had already run. I stopped all database reads at that point. Earlier checks showed 0 active queries.
- No NST, NHL API or Yahoo calls. No tests were run. No code, migration, cron or deployment was touched.

### Production reads (project `fyhftlxokyjtpndbkfse`, 2026-11-11, read-only)

1. Activity check: `select count(*) … from pg_stat_activity where state='active' and pid<>pg_backend_pid()` plus the longest running client query. Result 0 / 0 s.
2. `information_schema.columns` for `team_underlying_stats_summary` (confirms scalar columns).
3. Team summary by split for the latest date in 2026-11-01..2026-11-10: `select game_date, strength, score_state, count(*), sum(toi_seconds), sum(cf), sum(sf), sum(gf), sum(points) from team_underlying_stats_summary where game_date = (latest) and strength in ('allStrengths','fiveOnFive','threeOnThree','powerPlay','penaltyKill') group by 1,2,3`.
4. Team summary by strength: `select strength, count(*), count(distinct game_id), sum(toi_seconds), sum(cf), sum(sf), sum(gf), sum(ga), sum(otl) from team_underlying_stats_summary where game_date between '2026-11-01' and '2026-11-10' and score_state='allScores' and game_type=2 group by 1`.
5. `wgo_team_stats` by date, 2026-11-07..2026-11-10: row count, min and max of `power_play_pct` and `penalty_kill_pct`, null and zero counts, `max(games_played)` (with the activity check: 0).
6. `pg_views` for sixteen view names: definition lengths, and the full text of `goalie_weekly_aggregates` and `league_weekly_goalie_averages`.
7. Unit sample for 2026-11-08 (with the activity check: 0): min and max of `wgo_goalie_stats.time_on_ice`; min, max and `sum(gsaa)` of `nst_gamelog_goalie_all_counts` by `date_scraped`; min and max `toi` of `nst_gamelog_as_counts` by `date_scraped`; maxima of `toi_per_game`, `pp_toi_pct_per_game`, `zone_start_pct`, `shooting_percentage_5v5`, `skater_save_pct_5v5` in `wgo_skater_stats` by `date`.
8. `pg_matviews` for `goalie_totals_unified_snapshot` and `player_totals_unified` (both populated; the second lives in `internal_stats`).
9. `goalie_totals_unified_snapshot`: `select season_id, games_played, goals_against_avg, nst_all_gaa, nst_all_shots_against_per_60, nst_all_toi, time_on_ice … where nst_all_toi > 1500 order by season_id desc limit 3`. Two earlier forms filtered on season 20262027 and 20252026 and returned no rows.
10. `nst_seasonal_individual_counts`: `select season, gp, toi … where gp >= 70 order by season desc limit 3` (the activity count in the same statement returned 7; see above).

No scratch scripts were written. Every figure in this report comes from the reads above or from the cited source lines.

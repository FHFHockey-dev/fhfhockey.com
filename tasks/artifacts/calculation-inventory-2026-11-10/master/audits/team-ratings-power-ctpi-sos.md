# Audit: team ratings, power, CTPI, SOS (M-TEAM-001 to M-TEAM-056)

Wave 1, pass W1-4. Audited 2026-11-10 against `octoberBranch` at `c093e8d79` plus the dirty working tree. No code was changed. Line numbers are from the current checkout; paths are relative to the repo root.

**How this was done.** I read the live rating path end to end (`web/lib/power-ratings.ts`, `web/pages/api/v1/db/update-team-power-ratings.ts`, `web/lib/teamRatingsTrend.ts`, `web/lib/dashboard/teamContext.ts`), CTPI (`web/lib/trends/ctpi.ts`, its writer and readers), SOS (writer, `strengthOfSchedule.ts`, the landing-page `teamScheduleStrength.ts`, the research contract) and the consumers. Two read-only research passes covered the legacy SQL objects (M-TEAM-001–010, 017, 023, 033, 034, 046) and the dashboard helpers (M-TEAM-016, 028–032, 035, 036, 042, 043, 049–054, 056); I re-checked their decisive claims in code or data before using them.

**Data used (bounded, read-only).** `pg_stat_activity` showed 0 active queries before each heavier read. Reads were catalog lookups, one-date reads of `team_power_ratings_daily`, `sos_standings` (no jsonb) and `team_ctpi_daily`, server-side aggregates of `nst_team_all`, and one narrow export of team game rows for 2026-05-01 to 2026-11-10 (six tables, 17 or fewer columns each, about 6,900 rows in total, saved outside the repo). All of these tables are under 11,000 rows except `wgo_team_stats` (38,000 rows, read by its date index).

**Reproduction.** I ran the production functions (`calculateEwma` through `calculateFinalRating`) offline on that export and simulated the writer day by day. The stored `off_rating` for 12 of 12 spot-checked teams on 2026-11-10 matched to two decimals. The sizing below therefore describes what the cron actually does, not a reading of the code.

---

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 19 | 008, 012, 015, 027, 028, 031, 035, 036, 039–043, 047, 050, 053–056 |
| Mis-specified | 16 | 002, 004, 005, 009, 013, 014, 018, 022, 026, 029, 033, 038, 045, 046, 049, 052 |
| Wrong | 21 | 001, 003, 006, 007, 010, 011, 016, 017, 019, 020, 021, 023, 024, 025, 030, 032, 034, 037, 044, 048, 051 |
| Undetermined | 0 | Two sub-items are open: the join in 029 and the predictive validity of 015 |

Of the 21 wrong entries, 6 have no live reader (001, 006, 010, 017, 023, 034) and 1 feeds only an orphan page (007).

### Top 5 findings by user impact

1. **Team ratings are graded against that night's slate, then frozen (D1; M-TEAM-020, 021, 045).** `calculateEwma` returns a value only for teams that played on the target date, so the league mean and SD come from 4 to 32 teams. Teams that did not play keep the rating from their last slate. On 2026-11-10 the 32 served ratings came from four different slates (6, 24, 12 and 6 teams). Recomputing with all 32 teams on one date moves 9 teams by 5 or more offence ranks (largest: EDM 11th to 24th, NYI 12th to 25th) and 9 teams by 5 or more places in the Power Score (NYI 11th to 26th, EDM 13th to 27th, NYR 5th to 15th).
2. **PP and PK tiers describe each team's last single game (D3; M-TEAM-011, 025).** `wgo_team_stats` holds one game per row (570 of 570 rows this season have `games_played = 1`). On 2026-11-10 thirteen teams had a last-game PP% of 0, the 33rd percentile was 0, and no team was in PP Tier 3 (15 / 17 / 0). Tiers agree with season-to-date tiers for 11 of 32 teams, which is chance. 16 PP tiers and 23 PK tiers changed within seven days. The landing page also prints the last game's PP% and its rank beside the tier.
3. **Game Grid win odds come from legacy views that ignore this season (D5; M-TEAM-003, 004, 005, 033).** `nst_avg_all` sums every stored row of `nst_team_all` with no season filter, and half of those rows (5,446 of 10,848) are season-to-date snapshots, so totals are counted many times. The current season is about 0.13% of the weight. The resulting attack scores correlate 0.34 with this season's scoring (ANA 0.88 served against 1.22 this season). The cron is active and writes `expected_goals`, which the Game Grid and its Poisson heat map read.
4. **Season-total rows are counted as games (D2; M-TEAM-019, 044).** `nst_team_gamelogs_as_rates` holds a `gp = 82` row for every team on each of the 61 dates from May 1 to June 30 (earlier dates were not checked). The writer does not filter them. On opening night they carried 92% of the EWMA weight, 59% by a team's seventh game, and 14% on 2026-11-09. They also inflate `gp_to_date` (52 or more through the first two weeks), so the early-season blend toward the league mean has never fired this season.
5. **The Power Score counts pace as a third of team strength, and trend numbers are mostly noise (D4, D6; M-TEAM-018, 024, 025).** Pace correlates 0.17 with offence-plus-defence quality. Removing it moves 9 teams by 5 or more places (DAL 24th to 7th). Stored `trend10` has an SD of 8.1 on a 15-SD scale and 29 of 32 teams sit outside the ±0.5 colour band, because it subtracts ratings standardised against different slates.

### Triage issues C21–C23

| # | Status | Notes |
|---|---|---|
| C21 (mode mix, each game counted twice) | **Not occurring.** Latent only. | The writer's 5v5 query filters `situation = 'all'` on `nst_team_5v5` (`web/lib/power-ratings.ts:154`), but all 10,670 rows in that table carry `situation = '5v5'`. The query returns nothing, and stored ratings reproduce exactly from all-situation rows alone. The branch would double-count if the filter were ever "fixed" on its own (D10). |
| C22 (slate-only league distribution) | **Confirmed, sized.** | D1. On every date from 2026-10-20 to 2026-11-09 the rows computed that day have a mean of exactly 100.00 and SD of exactly 15.00, on slates of 4 to 24 teams. |
| C23 (`power_rankings` signs) | **Confirmed, low impact.** | PK% is subtracted and PIM added (baseline `:23558`). The only reader is `/statsPlaceholder`, which has no nav link, and `rolling_games` stopped at 2025-03-09. Retire (D12). |

### Recomputation for one date (the brief's done-criterion)

"Served" is what the table held on 2026-11-10 (ratings through 2026-11-09). "League-wide" keeps the formula (all situations, 25 games, half-life 10, weights 0.7 xG / 0.2 shots / 0.1 goals) and changes two things: season-total rows are dropped, and every team's EWMA as of its last game is standardised across all 32 teams on one date. This is the definition I propose for approval (question 1), not an approved one.

| Rating | Spearman | Mean rank move | Max | Teams moving ≥ 5 | RMS point difference | Max |
|---|---:|---:|---:|---:|---:|---:|
| Offence | 0.878 | 3.2 | 13 | 9 | 6.2 | 16.3 |
| Defence | 0.934 | 2.7 | 8 | 6 | 5.2 | 12.4 |
| Pace | 0.918 | 3.1 | 8 | 8 | 6.4 | 16.2 |
| (off + def + pace) / 3 | 0.823 | 3.9 | 15 | 9 | 4.8 | 11.3 |
| Goalie | 0.985 | 1.1 | 4 | 0 | 3.3 | 7.9 |
| Finishing | 0.973 | 1.4 | 5 | 3 | 2.8 | 5.7 |

The slates explain the pattern. The six teams that played on 2026-11-09 were weak offensively as a group (slate mean xGF/60 2.94 against a league mean of 3.23), so all six look better than they are: EDM, NYI, NYR, PHI, SJS and VAN account for most of the large moves.

| Team | Last game | Off served | Off league-wide | Def served | Def league-wide | Power rank served → league-wide |
|---|---|---:|---:|---:|---:|---|
| ANA | 11-08 | 102.8 | 104.3 | 75.2 | 83.8 | 25 → 23 |
| BOS | 11-08 | 94.9 | 99.8 | 96.6 | 102.0 | 28 → 22 |
| BUF | 11-08 | 112.6 | 114.5 | 94.2 | 98.5 | 6 → 8 |
| CAR | 11-07 | 131.8 | 134.9 | 123.4 | 126.9 | 2 → 1 |
| CBJ | 11-06 | 86.5 | 80.6 | 98.0 | 88.1 | 30 → 30 |
| CGY | 11-08 | 83.0 | 89.7 | 93.2 | 98.0 | 12 → 14 |
| CHI | 11-07 | 72.8 | 73.6 | 78.0 | 75.4 | 32 → 31 |
| COL | 11-07 | 106.6 | 105.6 | 102.3 | 101.3 | 7 → 7 |
| DAL | 11-07 | 91.8 | 92.2 | 124.8 | 130.3 | 27 → 24 |
| DET | 11-07 | 91.5 | 91.5 | 105.6 | 107.4 | 20 → 17 |
| EDM | 11-09 | 106.2 | 91.3 | 116.3 | 110.9 | 13 → 27 |
| FLA | 11-08 | 117.7 | 118.5 | 104.0 | 106.4 | 14 → 10 |
| LAK | 11-07 | 103.7 | 107.0 | 98.3 | 95.3 | 8 → 5 |
| MIN | 11-07 | 119.4 | 122.7 | 113.1 | 116.2 | 3 → 3 |
| MTL | 11-07 | 101.9 | 103.5 | 88.8 | 87.8 | 21 → 18 |
| NJD | 11-08 | 128.6 | 128.7 | 131.1 | 128.3 | 1 → 2 |
| NSH | 11-07 | 95.9 | 96.8 | 106.9 | 110.8 | 10 → 9 |
| NYI | 11-09 | 104.3 | 89.9 | 97.4 | 90.3 | 11 → 26 |
| NYR | 11-09 | 122.8 | 106.4 | 108.0 | 101.6 | 5 → 15 |
| OTT | 11-07 | 106.5 | 107.9 | 100.6 | 98.6 | 17 → 13 |
| PHI | 11-09 | 92.6 | 82.1 | 112.5 | 104.6 | 16 → 25 |
| PIT | 11-08 | 96.9 | 99.5 | 96.8 | 100.0 | 22 → 16 |
| SEA | 11-07 | 80.9 | 81.5 | 85.9 | 83.8 | 29 → 29 |
| SJS | 11-09 | 96.1 | 84.8 | 78.0 | 65.7 | 19 → 28 |
| STL | 11-07 | 93.2 | 96.4 | 98.5 | 97.5 | 23 → 19 |
| TBL | 11-08 | 109.3 | 110.6 | 119.3 | 117.5 | 9 → 6 |
| TOR | 11-08 | 88.9 | 95.1 | 90.6 | 97.2 | 24 → 20 |
| UTA | 11-07 | 112.7 | 116.2 | 105.9 | 108.1 | 4 → 4 |
| VAN | 11-09 | 78.1 | 71.4 | 87.8 | 78.2 | 31 → 32 |
| VGK | 11-08 | 96.8 | 100.3 | 112.5 | 110.1 | 18 → 11 |
| WPG | 11-08 | 92.4 | 97.8 | 87.5 | 92.4 | 26 → 21 |
| WSH | 11-07 | 103.9 | 104.7 | 88.8 | 87.2 | 15 → 12 |

Power rank here is the base (off + def + pace) / 3 without the tier bonus, so the table isolates D1 and D2.

---

## 2. Per-entry table

"Live" means a user-facing page, API or scheduled writer reads it. "Dormant" means the code runs but its output is gated off. Baseline = `supabase/migrations/20260716112908_production_schema_baseline.sql`.

### Live power-rating path

| ID | Verdict | Evidence | Reference standard | Magnitude | Downstream |
|---|---|---|---|---|---|
| 011 writer, tiers, carry-forward | **Wrong** | Tiers use the latest `wgo_team_stats` row per team (`update-team-power-ratings.ts:249-259`, `:313-314`); that row is one game. Missing value becomes Tier 3 (`:297`). | Team PP% = goals ÷ opportunities over the season (NHL.com) | Finding 2. Tier counts 15 / 17 / 0; 11 of 32 agree with season tiers | Power Score, opponent bands, landing page, `web/lib/sustainability/data.ts:167` (PK tier) |
| 018 Power Score and matchup edge | **Mis-specified** | `(off + def + pace) / 3` plus 1.5 per tier step (`web/lib/dashboard/teamContext.ts:34-40`); null rating counts as 0 (`:36`); edge is a plain difference (`:65-66`); a second definition without the bonus at `web/lib/teamRatingsTrend.ts:48-53` | SRS and Elo rate strength by goal or win margin; neither counts event volume, and Elo adds home ice | Pace: 9 teams move ≥ 5 places, max 17. Tier bonus (0 to 6 points on a base SD of 9.8) moves ranks by 1.1 on average, max 5. A null rating would drop a score by about 33 | Landing rank, "Home edge", opponent bands |
| 019 EWMA | **Wrong** | No `gp = 1` or season filter (`power-ratings.ts:137-146`); window is the last 25 rows (`:332`); nulls count as 0 (`:357-372`) | A game log holds games; pooled rates | Finding 4 | Everything below |
| 020 league distribution, blend, z | **Wrong** | Null unless the team played that date (`power-ratings.ts:328-330`); league stats from the returned teams (`update-team-power-ratings.ts:196-208`); `gp_to_date` counts rows in a 150-day window (`:189`); blended value is standardised against the unblended SD (`power-ratings.ts:510-549`) | "Standardisation must be against all 32 teams on one date" (brief) | Finding 1. Blend never active (minimum `gp_to_date` used was 61 on opening night) | All ratings |
| 021 off / def / pace ratings | **Wrong** | Raw scores re-standardised across the same slate (`power-ratings.ts:604-628`, `:664-670`) | Same; also score- and venue-adjusted 5v5 rates (McCurdy), opponent adjustment (SRS) | Finding 1. On a 4-team slate every rating is confined to 77.5–122.5; a 2-team slate would give 110.6 and 89.4 whatever the inputs | Game-prediction features, rankings team matrix, landing page |
| 022 sub-ratings, variance flag | **Mis-specified** (and inherits D1) | Special = `100 + 15 × 0.2 × (z_pp − z_pk)` (`:681-682`); goalie = team xGA/60 − GA/60 (`:525`); finishing = GF/60 − xGF/60 (`:524`); none shrunk; flag is \|PDO z\| ≥ 1 against the slate (`:684`) | GSAx = xGA − GA on shots a goalie faced (MoneyPuck, Evolving-Hockey); owner decision 7 excludes empty-net shots | Special SD is 4.0–4.6 on every date against 15 for the others. Goalie and finishing include empty-net goals | Game-prediction goalie and special differences |
| 024 form context (trend, PDO) | **Wrong** | Trend = current score minus the mean of the previous 10 game-day snapshots, each from a different slate (`teamRatingsTrend.ts:268-279`); PDO fallback is 100 on a 1.0 scale (`:292`) | A trend must difference like with like | Offence-trend SD 8.7 as served against 6.1 league-wide; game-to-game offence change averages 4.5 points against 2.7 | Landing page trend, "Puck Luck" |
| 025 tiers and `trend10` | **Wrong** | As 011 and 024 (`teamRatingsTrend.ts:218-247`) | As above | Stored `trend10` SD 8.1, max 24.9; 29 of 32 outside the ±0.5 colour band | Landing page, schedule calendar |
| 038 landing popovers | **Mis-specified** | z-scores recomputed across the 32-team snapshot (`web/pages/underlying-stats/index.tsx:487`, `:857`) | The explanation should reproduce the rating | NYR: xGF/60 3.47 is about +0.6 SD league-wide, shown beside an offence rating of 122.8 (+1.5 SD) | Landing page |
| 044 game-log assembly | **Wrong** | Same missing filters as 019; 5v5 branch filters the wrong `situation` (`:154`) and hard-codes season 20242025 (`:291`); a missing PP or PK row becomes 0 inside the EWMA | As 019 | Finding 4; 5v5 branch is dead | EWMA |
| 045 carry-forward | **Mis-specified** | Copies the last slate-relative rating forward for up to 60 days (`update-team-power-ratings.ts:227-236`, `:325-355`); keeps `source_through_date`, which is honest | Carry forward the inputs, re-standardise daily | Mechanism behind finding 1 | All readers |
| 047 opponent strength bands | **Sound** | Tertiles of the Power Score per date, needs ≥ 30 teams (`web/lib/teamOpponentStrength.ts:17-51`) | — | Inherits D1, D3, D4 through its inputs | Team schedule calendar |
| 055 as-of snapshot selection | **Sound** | Latest date on or before the request, no look-ahead (`web/lib/teamRatingsService.ts:223-256`) | — | — | Predictions, start chart |

### CTPI (unpublished)

All 544 rows written since 2026-10-25 carry `legacy_unapproved`, and every reader requires `approved` (`web/pages/api/v1/trends/team-ctpi.ts:103-110`, `web/lib/game-predictions/featureBuilder.ts:2119`, `web/pages/api/v1/start-chart.ts:1816`). Nothing below reaches a user today. The cron still runs daily.

| ID | Verdict | Evidence | Reference standard | Magnitude | Downstream |
|---|---|---|---|---|---|
| 012 delta and spark series | **Sound** | Last minus first of the spark series (`teamContext.ts:42-50`) | — | — | Dormant |
| 013 recent-form inputs | **Mis-specified** | Missing data becomes 0 per 60 (`ctpi.ts:114`); the `?? 100` PDO fallback is unreachable (`:211-220`); PP and PK rates are means of per-game rates (`:151-162`); `_weightDecay` is ignored (`:232`); no shrinkage below 10 games | Pooled rates; regression by sample size | Not measured (dormant) | `computeCtpi` |
| 014 composite and 0–100 mapping | **Mis-specified** | Weights 0.35 + 0.30 + 0.20 + 0.15 + 0.10 = 1.10 (`ctpi.ts:301-306`); PDO adds; `50 + 15 × raw` is unbounded (`:321`) | PDO regresses toward 100 (NST glossary), so it is not a strength input | On 2026-11-10 the "0 to 100" score ran 27.7 to 68.8 (SD 9.3). The luck term correlates 0.69 with the goaltending term and 0.42 with offence, so results are counted twice. Dropping it moves ranks by 1.5 on average, max 4 | Dormant |
| 015 v2 candidate | **Sound** (design) | No PDO, missing metrics renormalised, logistic bound, confidence from games and coverage (`web/lib/trends/recentTeamFormV2.ts:300-420`) | — | Predictive value not validated here | Scripts only |
| 039 audit re-derivation | **Sound** | Documents the v1 contract, including the 1.10 total | — | — | Manual script |
| 040 forward-association test | **Sound** | Overlapping samples are acknowledged in its output notes | — | — | Manual script |
| 041 multi-season audit | **Sound** | Rank correlation uses sort-order ranks (`web/scripts/audit-ctpi-multiseason.ts:745-755`); equals Spearman unless scores tie | — | — | Manual script |

### Strength of schedule

| ID | Verdict | Evidence | Reference standard | Magnitude | Downstream |
|---|---|---|---|---|---|
| 026 SOS ratings | **Mis-specified** | Win% = W ÷ GP, documented (`strengthOfSchedule.ts:53-60`); "combined" weights past and future by opponents' games played (`:87-91`); no opponents-of-opponents term | RPI: OWP excludes head-to-head, OOWP is 25% | Combined is close to a full-season figure and varies little | `/api/v1/trends/team-sos`, dashboards |
| 027 descriptive SOS contract | **Sound** | Excludes head-to-head, values opponents as known then, uses opponents' history for the indirect term (`strengthOfScheduleContract.ts:60-158`) | Matches RPI's OWP and OOWP | — | No production caller |
| 037 / 048 SOS writer (same code, listed twice) | **Wrong** | Games dated today count as past before they are played (`update-team-sos.ts:276`; the cron runs at 09:12 UTC); opponents' records include games against the team (`:274-287`); records are as of today | RPI OWP | 14 teams on 2026-11-10 had an unplayed game in "past". Past SOS correlates −0.73 with the team's own win%; removing head-to-head lifts that to −0.59, changes values by up to 0.017 (SD 0.034) and ranks by up to 3 (6 teams by 3) | `sos_standings`, landing SOS, team-sos API |

### Legacy SQL and loaders

| ID | Verdict | Live? | Evidence | Magnitude or note |
|---|---|---|---|---|
| 001 / 017 SQL power ratings | **Wrong** | Dead | Same slate-only distribution (`sql/001_team_power_ratings.sql:139-140`, `:186-193`); cannot run because the target names are now tables; stub function only raises a notice (baseline `:3086`) | Origin of D1. Packet correction: the SQL does cap at 25 games and partitions by season (`:116-119`) |
| 002 `nhl_team_data` | **Mis-specified** | Live | Join to `nst_team_stats` has no season key (baseline `:14238`); the table holds three seasons, so three rows per team; global `MAX(date)` (`:14201`) | Readers pick the season by implied games played (`web/lib/projections/queries/team-context-queries.ts:226-257`). A historical as-of falls back to the latest row (`:371-379`), which is look-ahead in backfills |
| 003 `nst_avg_*` | **Wrong** | Live (`all` counts) | No `WHERE` (confirmed in `pg_views`); `nst_team_all` mixes 5,446 cumulative rows with single-game rows; percentages are unweighted means of row percentages (baseline `:15206-15246`) | Finding 3. Mean summed "GP" is 13,232 per team |
| 004 `nst_league_averages` | **Mis-specified** | Live (one cell) | Counts pooled correctly as Σ ÷ Σ, but over the inputs above (baseline `:15763`) | League GF/game 3.01 served against 3.15 this season |
| 005 `nst_att_def_scores` | **Mis-specified** | Live | `att_score_all` = GF/game ÷ league GF/game (baseline `:16316-16323`); composite weights sum to 5.25 but divide by 5 (`:16328`), unused; 47 rows for 32 teams because the grouping includes `team_name` | Only `att_score_all` and `def_score_all` are consumed (`web/lib/gameGoalProjections/calculations.ts:167-177`). No home-ice term |
| 006 `nst_team_scores_all_strengths` | **Wrong** | Dead | Inherits 034; weights differ by strength with no normalisation (baseline `:21938-21945`) | Retire |
| 007 `power_rankings` | **Wrong** | Orphan page | C23. No season filter; sums of hits, blocks and PIM dominate | `/statsPlaceholder` shows it as "Power Rankings – Last 10 Games" from data frozen at 2025-03-09 |
| 008 `vw_team_strength_state_daily(_norm)` | **Sound** | Dead | count × 3600 ÷ TOI seconds (baseline `:26567-26610`) | `_norm` carries the last game forward with no season bound |
| 009 discipline trigger | **Mis-specified** | No reader, still written | Per-game counts stored in `*_per_60` columns (baseline `:5207-5208`) | The trigger exists and fires two upserts on every `wgo_team_stats` write |
| 010 `combined_sos` | **Wrong** | Dead | Averages the team's own last-10 point% (baseline `:7205-7220`) | Not an SOS |
| 023 `fetchPowerRankings.js` | **Wrong** | Dead | GF ÷ GA called a percentage (`:122-123`); ranks over every stored row (`:809-832`); future SOS reads later snapshots (`:916-921`) | Route returns 410 |
| 033 `nst_*_team_per_game` | **Mis-specified** | Live (`all`) | Total ÷ GP with no `NULLIF` (baseline `:15253-15292`) | Inherits 003 |
| 034 `nst_*_team_differentials` | **Wrong** | Dead | The 5v5, PK and PP variants read all-strength team values against per-strength league baselines (baseline `:15947-15986`; confirmed in `pg_views`) | Differences of several hundred percent |
| 046 `sosStandings.js` | **Mis-specified** | Dead | Missing opponent standings become 0-0-0 (`:446-454`) | A manual run would overwrite the live `sos_standings` |

### Dashboard and trend helpers

| ID | Verdict | Evidence | Magnitude | Consumer |
|---|---|---|---|---|
| 016 Top Adds score | **Wrong** | `uncertainty` must be a number (`web/lib/dashboard/topAddsRanking.ts:80`); `web/pages/FORGE.tsx:356` and `web/pages/forge/player/[playerId].tsx:338` pass the stored JSON object; the rail and watchlist unwrap it first | Object × 1.5 is NaN, so `/FORGE` would print "Add score NaN" and keep API order. Stored column type is `object`. Not observed in a browser. Separately, `delta × 5` swamps the projection terms, and week mode pairs a 5-game projection with a rest-of-week schedule bonus | `/FORGE`, player page, rail, watchlist |
| 028 game performance score | **Sound** | Hand-set colour heuristic (`GameByGameTimeline.tsx:336-353`) | A game with no penalties taken shows PK "0.0%" (`:301`) | Team page |
| 029 standings chart rolling averages | **Mis-specified** | PP% and PK% "rolling average" is the mean of single-game percentages (`TeamStandingsChart.tsx:101`); a missing join becomes 0% (`:250`) | Games of 1/1, 0/5, 0/4, 0/3, 0/4 show 20% where the pooled figure is 5.9%. The date-and-name join is unverified | Homepage |
| 030 trend category percentiles | **Wrong** | Ranks each team's Nth single game; ties get different percentiles by sort order (`teamPercentiles.ts:77-90`); the "latest" ranking compares teams at different game numbers (`:135-147`) | Tied goal counts spread about 19 percentile points; at the latest game number a percentile can be among 1–3 teams. Captioned "Rolling percentile by games played" with no rolling | `/trends` |
| 031 trend utilities | **Sound** on live paths | `percentile` divides by zero at n = 1 (`utils.ts:34`) but has no importer | — | Trends sandbox |
| 032 player trend records | **Wrong** | Fallback shots/60 = `(shots / toi) × 60` treats `toi_per_game` as minutes (`playerTrendCalculator.ts:252-255`); stored values are seconds (mean 990 on 2026-11-08). Averages of per-game ratios throughout (`:185-193`) | Fallback rates are 60 times too low where the NST rate is null (frequency not measured). TOI trend is seconds in the regular season and minutes in the playoffs. A goalie at 30/32 then 3/6 averages .719 against a pooled .868 | `/trends` player and goalie power |
| 035 power card thresholds | **Sound** | No importer | — | Dead |
| 036 rating bar width | **Sound** | 70–130 mapped to 4–100% (`UnderlyingStatsDashboard.tsx:56-57`); number shown beside | — | Landing page |
| 042 freshness and tone bands | **Sound** | Policy object unused; tone bands only in unmounted cards | — | None |
| 043 Top Adds schedule context | **Sound** | Off-night is ≤ 8 games (`topAddsScheduleContext.ts:20`) | — | Top Adds |
| 049 score-state shot shares | **Mis-specified** | Honest label, but one 0.52 / 0.48 colour band for every score state (`GameStateAnalysis.tsx:265`, `:273`) | Score effects push shot share below 50% when leading, so most teams read "poor" when leading | Team page |
| 050 L10 metrics | **Sound** | Pooled; 5v5 block labelled | — | Team page |
| 051 team dashboard aggregates | **Wrong** (minor) | Goalie start share divides by scheduled games through today, with no game-state check (`TeamDashboard.tsx:582-587`, `:618-621`) | At 15 GP on a game day a 10-start goalie shows 62.5% against 66.7% | Team page |
| 052 team leaders BSH | **Mis-specified** | Season totals from a league-wide row tagged with the player's current team (`TeamLeaders.tsx:124`) | A traded player's earlier totals count for the new club | Team page |
| 053 team share aggregation | **Sound** | Ratios of sums; PDO = SH% + SV% on the 1.000 scale (`web/lib/stats/percentUnits.ts:107-142`) | — | Team pages |
| 054 goalie trend confidence | **Sound** | Sample size capped at 10 and printed as "GP" | — | `/trends` |
| 056 goal differential trend | **Sound** | GF − GA per game, summed | — | Team page |

---

## 3. Defects

Priority: **P0** user-visible wrong numbers; **P1** wrong or misleading, smaller or indirect effect; **P2** latent, dormant or cleanup.

### P0

**D1. Ratings standardised against the night's slate and carried forward** (M-TEAM-020, 021, 045; C22)
- Fix: compute each team's EWMA as of its most recent game on or before the date, for all 32 teams, every day. Build the league mean, SD and raw-score distribution from those 32. Skip the write if fewer than 30 teams have a value. Carry forward inputs, never a rating.
- Tests: (a) with 32 teams and any subset playing, the 32 stored ratings have mean 100 and SD 15; (b) a team's rating does not change when a different set of other teams plays that night; (c) a two-team slate does not return 110.61 and 89.39.

**D3. PP and PK tiers from the last single game** (M-TEAM-011, 025)
- Fix: PP% = Σ PP goals ÷ Σ opportunities and PK% = 1 − Σ PP goals against ÷ Σ times shorthanded, over the season to date (or the rating's 25-game window), then tertiles across 32 teams. A missing value is null, not Tier 3.
- Test: a team 1-for-1 last game and 5-for-50 on the season lands in Tier 3; tier counts are 10 to 12 each.
- Related, outside this packet: `web/lib/underlying-stats/teamSpecialTeamsContext.ts:106-108` takes the same single row for the PP% and PK% values and ranks printed on the landing page (M-UST-033).

**D5. Game Grid win odds from all-time, snapshot-weighted goals** (M-TEAM-003, 004, 005, 033)
- Fix: either retire the chain and source Game Grid odds from the game-prediction model, or rebuild the inputs from single-game rows of the current season (`gp = 1`, date on or after season start), add home ice, and write only future games.
- Tests: Σ GP per team equals games played; adding a prior-season or cumulative row leaves `att_score_all` unchanged; one row per team.

**D14. Top Adds score is NaN at two call sites** (M-TEAM-016)
- Fix: move `extractUncertaintyPenalty` into `topAddsRanking.ts` and apply it inside `scoreTopAddsCandidate`.
- Test: a candidate whose `uncertainty` is the stored object yields a finite total. Confirm in the running page first.

### P1

**D2. Season-total rows counted as games; no season boundary; blend never fires** (M-TEAM-019, 020, 044)
- Effect today: removing them moves offence by up to 3.2 points and 3 ranks. In the first two weeks of a season the ratings are mostly last season's totals. That may be a reasonable prior, but nobody chose it, and it vanishes abruptly when the rows age out of the 150-day window.
- Fix: filter `gp = 1` and the current `season_id` in `fetchGameLogs` (the CTPI writer already does, `update-team-ctpi-daily.ts:80-81`). Count `gp_to_date` from this season's games. Replace the accidental prior with a stated one (question 2).
- Tests: `gp = 82` rows in the window do not change the EWMA; `gp_to_date` equals games played; a team with 3 games is pulled toward the prior.

**D4. Power Score includes pace; nulls count as zero; no home ice in "Home edge"** (M-TEAM-018)
- Fix: score = (off + def) / 2 or fitted weights, plus a special-teams term from D3. Show pace as context. A null rating gives a null score. One definition, shared by `teamContext.ts` and `teamRatingsTrend.ts`.
- Tests: a team at 100 / 100 with pace 130 does not outrank a team at 105 / 105 with pace 85; a null input returns null.

**D6. Trend and luck flags built on slate-relative values** (M-TEAM-024, 025)
- Fix: after D1, difference the league-wide daily ratings (or the raw EWMA xG differential). Set colour bands in SD units. Use null, not 100, when PDO is missing.
- Tests: a team with constant inputs has a trend of 0 whoever else plays; the PDO series never contains 100.

**D7. SOS: unplayed games as past, head-to-head included, wrong indirect term** (M-TEAM-026, 037, 048)
- Fix: count a game as past only when it is final. Exclude head-to-head from opponents' records. On the landing page, use opponents' past records for the indirect term in both buckets (`web/lib/underlying-stats/teamScheduleStrength.ts:211-215` uses the opponent's future schedule for the future bucket, which the repo's own contract forbids at `strengthOfScheduleContract.ts:128-129`). `strengthOfScheduleContract.ts` already implements the right definition and has tests.
- Tests: flipping the result of A against B leaves A's past SOS unchanged; a game scheduled for today is not in "past" before it ends.

**D8. CTPI v1** (M-TEAM-013, 014). Fix before any publication.
- Fix: adopt the v2 candidate, or in v1 drop the luck term, make the weights sum to 1, treat missing data as missing, pool PP and PK rates by ice time, and rename or bound the score.
- Tests: weights sum to 1; a team with no PP time does not get a z-score from 0; the published score stays inside its stated range.

**D15. Trend category percentiles** (M-TEAM-030)
- Fix: mid-ranks for ties; rank on a common date or trailing window with a minimum team count; fix the caption.
- Tests: identical inputs give identical percentiles; a game number with too few teams yields no ranking.

**D16. Player trend TOI unit and unpooled ratios** (M-TEAM-032)
- Fix: normalise TOI to one unit in one adapter; carry numerators and denominators and pool.
- Test: a mixed regular-season and playoff fixture in stored units (the current test uses minutes for the regular-season row).

### P2

**D9. Sub-rating scale and labels** (M-TEAM-022). Standardise the special-teams composite to SD 15. Pool PP and PK rates by ice time; treat a game with no PP time as missing. Relabel "Goaltending" as team save gap (xGA − GA), or exclude empty-net goals per owner decision 7. Test: special rating SD is 15 ± 1 across 32 teams.

**D10. Dead 5v5 branch** (M-TEAM-044; C21). Delete it, or make the mode an explicit parameter. Test: the logs passed to `calculateEwma` hold one row per team and date.

**D11. `nhl_team_data` season join** (M-TEAM-002). Add `ns.season = ls.season_id`. Test: one row per team. Hand the look-ahead note to the FORGE audit.

**D12. Retire legacy objects** (M-TEAM-001, 006–010, 017, 023, 034, 046). Drop the discipline trigger, function and table; `nst_team_scores_all_strengths`; the three per-strength differential views; `combined_sos`; `vw_team_strength_state_daily(_norm)`; `power_rankings` and its two tables on `/statsPlaceholder`; `sql/001_team_power_ratings.sql`; `fetchPowerRankings.js`; `sosStandings.js`; `team_power_ratings_daily__new`; the `refresh_team_power_ratings` stub. Check for dependents in the catalog before each drop.

**D13. Landing popover z-scores** (M-TEAM-038). Resolved by D1; then show the z-scores the rating used.

**D17. Smaller display defects.** Standings chart rolling PP% and PK% should be pooled (029). Goalie start share should count final games only (051). Score-state colour bands should be relative to each state's league mean (049). Team leaders should be labelled as current-roster totals or built from per-team rows (052).

### Exposure of the live rating defects

| Consumer | Reads | Affected by |
|---|---|---|
| `/underlying-stats` landing | All ratings, Power Score, tiers, trend, luck, SOS | D1–D4, D6, D7 |
| Game predictions (`featureBuilder.ts:43-49`) | Off, def, goalie, special, pace ratings; xGF/60, xGA/60 | D1, D2, D9. The rating noise is about 6 points RMS per team, so about 9 on a home-minus-away difference. The game-prediction audit should size the effect on win probability |
| Rankings team matrix (`web/lib/rankings/teamMatrix.ts:20-31`) | Off, def, pace, special, trend, tiers | D1–D3, D6 |
| Team schedule calendar | Opponent bands from the Power Score | D1, D3, D4 |
| Start chart (`start-chart.ts:720-734`) | xGA/60 rank (raw EWMA) | D2 only |
| Sustainability (`web/lib/sustainability/data.ts:167`) | Opponent PK tier | D3 |
| FORGE dashboard and command centre | Power Score, matchup edge | D1, D3, D4 |
| Game Grid | `expected_goals` win odds and heat map | D5 |

---

## 4. Questions for the owner

1. **Power rating definition.** Approve "all situations, last 25 games with a 10-game half-life, standardised across all 32 teams daily"? The reference standard (score- and venue-adjusted 5v5, opponent-adjusted) is a larger change; is it wanted later?
2. **Early season.** Should last season count at the start of a season? If yes, with what weight and for how many games?
3. **Pace.** Should pace be part of the Power Score, or shown beside it?
4. **PP and PK tiers.** Season to date, or the same 25-game window as the rating?
5. **Game Grid win odds.** Retire the legacy Poisson chain in favour of the game-prediction model, or repair it?
6. **SOS.** Keep record-based SOS with a 2:1 direct-to-indirect weighting (what the landing page does)? Win% or points%? Opponents' records as of today or as of each game?
7. **CTPI.** Retire v1 and take the v2 candidate forward for validation?
8. **Legacy objects.** May the list in D12 be scheduled for removal?

---

## 5. Limits

- **One date.** The recomputation covers 2026-11-09 only. Slate effects vary by day; six-team slates will not always be this lopsided.
- **No reference-standard build.** I did not build score- and venue-adjusted or opponent-adjusted ratings, so I cannot say how far the proposed definition is from that standard. The 0.7 / 0.2 / 0.1 weights and the 25-game, 10-game half-life window were not validated against future results.
- **Fixtures.** `tasks/artifacts/ctpi-independent-review-2026-10-22` and `tasks/artifacts/sos-candidate-2026-10-23` contain empty folders in this checkout; I used live rows instead.
- **Head-to-head correction is approximate.** It subtracts each played game once. Opponents met twice need a slightly larger correction, so the stated effect is a floor.
- **Not observed in a browser.** The Top Adds NaN (D14) and all page-copy findings are from code. No page was loaded and no test was run.
- **Not measured.** How often the player-trend TOI fallback fires (032); the standings chart join (029); the size of empty-net goals in the goalie and finishing ratings; the effect of the rating noise on game-prediction probabilities.
- **Legacy SQL.** Definitions were read from the baseline migration. The catalog confirmed that all 20 views, both functions and the discipline trigger exist, that `nst_avg_all` has no `WHERE`, and that the PP differential view reads all-strength values. Other definitions were not diffed against the catalog.
- **Delegated reading.** The legacy SQL and dashboard-helper entries were read by research passes. I re-checked the claims behind every P0 and P1 defect; the remaining sound verdicts in those groups rest on those passes.
- **No external calls.** No NST, NHL API or Yahoo requests, no cron routes, no writes.

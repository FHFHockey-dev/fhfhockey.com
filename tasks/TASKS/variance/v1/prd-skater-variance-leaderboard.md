# Skater Variance Leaderboard PRD

## Introduction/Overview

Build a full skater variance leaderboard at `/variance/skaters` modeled after the existing goalie variance experience, but with skater-specific fantasy scoring, ownership-relative valuation, and ADP-relative valuation.

The feature should help fantasy hockey users evaluate whether skaters are producing good weekly fantasy value relative to comparable peers, instead of comparing every skater against the full league. Users should be able to customize fantasy scoring categories, choose a valuation mode, and inspect both value outcomes and raw/advanced stat context.

## Goals

1. Replace the current `/variance/skaters` MVP production-proxy table with a skater leaderboard experience that mirrors the goalie page structure.
2. Calculate skater fantasy points from user-selected scoring categories and editable point values.
3. Default selected scoring categories to the values in `DEFAULT_SKATER_FANTASY_POINTS`: goals, assists, power-play points, shots on goal, hits, and blocked shots.
4. Support two valuation modes:
   - Relative to Ownership
   - Relative to ADP
5. Group players into peer buckets based on the selected valuation mode.
6. Calculate weekly fantasy point variance and game-to-game fantasy point variance from the active scoring settings.
7. Classify each player-week as `Elite`, `Quality`, `Average`, `Bad`, or `Really Bad` using standard deviation bands within that player's weekly peer bucket.
8. Add `Value Overview`, `Metrics`, and `Advanced Analytics` tabs for skater evaluation.
9. Include transparent valuation context columns: `OWN%` in ownership mode and `ADP` in ADP mode.
10. Preserve existing variance page filtering patterns, sortable tables, loading states, and error handling.

## User Stories

1. As a fantasy hockey manager, I want to evaluate skaters relative to similarly owned players so I can find overperforming streamers and underperforming rostered players.
2. As a fantasy hockey manager, I want to evaluate skaters relative to draft cost so I can understand which draft picks returned strong or weak weekly value.
3. As a user in a custom points league, I want to choose scoring categories and edit point values so the leaderboard matches my league settings.
4. As a user, I want bucket average rows so I can see the peer baseline behind each player valuation.
5. As a user, I want standard, advanced, and value-oriented views so I can understand both the result and the underlying stats driving it.

## Functional Requirements

1. The `/variance/skaters` page must fetch the latest available skater season from `wgo_skater_stats`, consistent with the current MVP behavior.
2. The page must fetch matching Yahoo player data from `yahoo_players` for the same season when available.
3. The implementation must create skater-specific helper modules modeled after the goalie path:
   - `skaterTypes.ts`
   - `skaterCalculations.ts`
   - `skaterMetrics.ts`
   - `skaterFilters.ts`
4. The implementation must create skater-specific UI components modeled after the goalie path:
   - `SkaterLeaderboard.tsx`
   - `SkaterTable.tsx`
   - `SkaterAdvancedMetricsTable.tsx`
   - `SkaterList.tsx`
5. The page must expose a scoring settings UI with checkboxes and editable numeric point values for supported skater categories.
6. The default selected scoring settings must come from `DEFAULT_SKATER_FANTASY_POINTS` in `web/lib/projectionsConfig/fantasyPointsConfig.ts`.
7. Supported scoring categories must include, where data exists:
   - Goals
   - Assists
   - Points
   - Hits
   - Penalty minutes
   - Blocks
   - Shots
   - Power-play points
   - Power-play goals
   - Power-play assists
   - Short-handed points
   - Short-handed goals
   - Short-handed assists
   - Plus-minus
   - Time on ice
   - Any additional skater categories already supported by local scoring label/config patterns
8. Scoring labels should reuse or extract the `SKATER_LABELS` pattern from `DraftSettings.tsx` instead of duplicating incompatible labels.
9. The page must calculate fantasy points per game from active scoring settings.
10. The page must aggregate fantasy points by matchup week.
11. Weekly variance must be calculated as the standard deviation of each player's weekly fantasy point totals.
12. Game-to-game variance must be calculated as the standard deviation of each player's game fantasy point totals.
13. The page must support a valuation mode toggle with:
   - `Relative to Ownership`
   - `Relative to ADP`
14. In `Relative to Ownership` mode, each player-week must be assigned to an ownership bucket based on average ownership across that week.
15. Ownership buckets must be:
   - `0-9%`
   - `10-19%`
   - `20-29%`
   - `30-39%`
   - `40-49%`
   - `50-59%`
   - `60-69%`
   - `70-79%`
   - `80-89%`
   - `90-100%`
16. Weekly average ownership must be calculated from `ownership_timeline` entries whose `date` falls within the week.
17. If no ownership timeline entries exist for a player-week, the implementation may fall back to the closest prior ownership value, then `percent_ownership`, then an unknown/WW-style bucket.
18. In `Relative to ADP` mode, each player must be assigned to a draft bucket using `average_pick` from `draft_analysis` or the denormalized Yahoo ADP fields.
19. ADP round buckets must default to a 12-team league using `Math.ceil(average_pick / 12)`.
20. ADP bucket labels must use ordinal round labels such as `1st Rd`, `2nd Rd`, `3rd Rd`, and so on.
21. Players without usable ADP must be assigned to `WW`.
22. The ADP mode must include a `percent_drafted` slider.
23. The `percent_drafted` slider must default to `0.5`.
24. Players below the selected `percent_drafted` threshold must be grouped with waiver-wire players but labeled distinctly as `LOW %D`.
25. Undrafted players must be labeled `WW`.
26. The user must be able to configure a minimum games played or minimum sample threshold.
27. The default ranking and inclusion logic must avoid over-ranking tiny samples.
28. Each peer bucket must calculate:
   - Average fantasy points per week
   - Average fantasy points per game
   - Standard deviation of weekly fantasy points
   - Standard deviation of game fantasy points where useful for classification
29. Each player-week must be classified using standard deviation bands relative to that week and peer bucket.
30. The initial classification thresholds should be:
   - `Elite`: player weekly fantasy points >= bucket weekly average + 1.5 standard deviations
   - `Quality`: >= bucket weekly average + 0.5 standard deviations and < +1.5 standard deviations
   - `Average`: within +/- 0.5 standard deviations of bucket weekly average
   - `Bad`: <= bucket weekly average - 0.5 standard deviations and > -1.5 standard deviations
   - `Really Bad`: <= bucket weekly average - 1.5 standard deviations
31. If a bucket has too few valid players to calculate a meaningful standard deviation, the implementation must fall back to a documented minimum behavior, such as treating the week as `Average` or using adjacent bucket/global baseline.
32. The `Value Overview` tab must include these columns:
   - Rank
   - Name
   - Team
   - Tier
   - `OWN%` or `ADP`, based on active valuation mode
   - Elite
   - Quality
   - AVG
   - Bad
   - Really Bad
   - `% OK weeks`
   - `% Good weeks`
   - Weekly Variance
   - Game-to-game variance
   - Avg FPts/Gm
   - Avg FPts/Week
   - `+/- Avg Fpts`
   - GP
   - Total FPts
33. `% OK weeks` must represent weeks classified at least `Average`.
34. `% Good weeks` must represent weeks classified above `Average`, meaning `Quality` or `Elite`.
35. `+/- Avg Fpts` must compare the player to the selected peer bucket average and respect a weekly or per-game display option.
36. The `Metrics` tab must include these standard columns:
   - Rank
   - Name
   - Team
   - `OWN%` or `ADP`, based on active valuation mode
   - GP
   - Average Time on Ice
   - Goals
   - Assists
   - Points
   - Shots
   - Shooting Percentage
   - Avg PPTOI
   - Power Play Goals
   - Power Play Assists
   - PPP
   - Hits
   - Blocks
   - Penalty Minutes
   - Plus Minus
37. The `Advanced Analytics` tab must include these columns:
   - Rank
   - Name
   - Team
   - `OWN%` or `ADP`, based on active valuation mode
   - GP
   - G/60
   - A/60
   - PT/60
   - SOG/60
   - PPG/60
   - PPA/60
   - PPP/60
   - HIT/60
   - BLK/60
   - PIM/60
   - CF/60
   - IPP
   - iXG/60
38. If a requested advanced metric is unavailable in `wgo_skater_stats`, the implementation must either map it from available fields or leave it out with a clear code comment and PRD follow-up note.
39. Bucket average rows must appear in both the `Value Overview` and `Metrics` tabs.
40. Bucket average rows must display average values for the relevant visible columns.
41. Bucket average rows must be visually distinct from player rows.
42. ADP round buckets must use distinct row color styling by round.
43. Ownership buckets should use distinct but readable row color styling by bucket.
44. Row styling must preserve zebra striping, tinted by the bucket color.
45. Color values must use variables from `web/styles/vars.scss` where possible.
46. Sorting must work for all numeric and text columns.
47. Loading and error states must be explicit and consistent with existing variance pages.
48. Missing Yahoo data must not prevent the skater variance page from rendering WGO stat rows.
49. The implementation must include focused unit tests for scoring, bucket assignment, weekly aggregation, standard-deviation classification, and ADP/ownership fallback behavior.

## Non-Goals (Out of Scope)

1. Do not change goalie variance behavior.
2. Do not change Yahoo ingestion or database schema unless an implementation blocker is discovered.
3. Do not add league-specific Yahoo authentication or user league imports.
4. Do not build a full draft dashboard replacement.
5. Do not add persistence of custom scoring settings unless a local pattern already exists and is cheap to reuse.
6. Do not create new Supabase tables for this feature.
7. Do not support custom league sizes beyond the default 12-team ADP round calculation in the first pass.

## Design Considerations

1. The UI should follow the existing goalie variance/page patterns for tabs, controls, sorting, table density, and responsive behavior.
2. The valuation toggle should be near the scoring and filter controls so users understand the table context.
3. `OWN%` or `ADP` should be shown next to `Tier` in `Value Overview`.
4. `OWN%` or `ADP` should be shown next to `Team` in `Metrics` and `Advanced Analytics`.
5. Bucket average rows should appear directly beneath or within each bucket grouping.
6. `WW` and `LOW %D` should be visually related but distinguishable.
7. Keep table labels compact and consistent with `SKATER_LABELS`.

## Technical Considerations

1. Main page:
   - `web/pages/variance/skaters.tsx`
2. Existing skater MVP helper:
   - `web/components/Variance/skaterVariance.ts`
3. Goalie templates:
   - `web/components/GoaliePage/GoalieLeaderboard.tsx`
   - `web/components/GoaliePage/GoalieTable.tsx`
   - `web/components/GoaliePage/GoalieAdvancedMetricsTable.tsx`
   - `web/components/GoaliePage/GoalieList.tsx`
   - `web/components/GoaliePage/goalieCalculations.ts`
   - `web/components/GoaliePage/goalieMetrics.ts`
   - `web/components/GoaliePage/goalieFilters.ts`
   - `web/components/GoaliePage/goalieTypes.ts`
4. Scoring defaults:
   - `web/lib/projectionsConfig/fantasyPointsConfig.ts`
5. Scoring labels/reference:
   - `web/components/DraftDashboard/DraftSettings.tsx`
6. Skater game source:
   - `wgo_skater_stats`
7. Season totals context:
   - `wgo_skater_stats_totals`
8. Yahoo valuation source:
   - `yahoo_players`
9. Relevant Yahoo columns:
   - `player_id`
   - `season`
   - `ownership_timeline`
   - `percent_ownership`
   - `draft_analysis`
   - `average_draft_pick`
   - `average_draft_round`
   - `average_draft_cost`
   - `percent_drafted`
10. Relevant skater stat columns include:
   - `player_id`
   - `player_name`
   - `date`
   - `team_abbrev`
   - `current_team_abbreviation`
   - `position_code`
   - `games_played`
   - `goals`
   - `assists`
   - `points`
   - `shots`
   - `shooting_percentage`
   - `plus_minus`
   - `pp_points`
   - `pp_goals`
   - `pp_assists`
   - `pp_toi`
   - `pp_toi_per_game`
   - `sh_points`
   - `sh_goals`
   - `sh_assists`
   - `hits`
   - `blocked_shots`
   - `penalty_minutes`
   - `toi_per_game`
   - `time_on_ice_per_shift`
   - `individual_sat_for_per_60`
11. `iXG/60` availability must be verified during implementation. If no current table column supports it, mark it unavailable in the advanced table rather than inventing a value.
12. `IPP` availability must be verified during implementation. If a reliable numerator/denominator is unavailable, mark it unavailable or defer it.
13. Matchup week construction should reuse any existing variance week logic if available; otherwise centralize it in skater helpers so tests can cover it.
14. Standard deviation should use a consistent implementation. If aligning with goalie calculations, document whether sample or population standard deviation is used.
15. Yahoo `player_id` is stored as text in `yahoo_players`; joins to WGO integer `player_id` must normalize safely.

## Success Metrics

1. Users can load `/variance/skaters` and see a populated `Value Overview` table for the latest season.
2. Users can switch between ownership and ADP valuation modes without page errors.
3. Users can edit scoring settings and see fantasy point totals, variance, rankings, and bucket averages update.
4. Bucket average rows are visible in `Value Overview` and `Metrics`.
5. `OWN%` or `ADP` context appears in all tabs according to the active valuation mode.
6. Unit tests cover scoring, bucketing, weekly aggregation, and classification edge cases.
7. Existing goalie variance tests and current skater variance tests continue to pass.

## Open Questions

1. Should custom scoring settings persist to local storage, URL state, or remain session-only for the first pass?
2. What minimum player count should be required before a bucket standard deviation is considered reliable?
3. Should low-sample buckets fall back to adjacent ownership/round buckets or to all-skater weekly averages?
4. Should ADP mode eventually allow the user to change league size from 12 teams?
5. Should defensemen be evaluated separately from forwards in a later pass?
6. Should `LOW %D` players be included in the same average baseline as `WW`, or shown with `WW` while excluded from the `WW` average calculation?
7. Which source should be canonical for unavailable advanced metrics such as `iXG/60` if `wgo_skater_stats` does not currently include them?


# WiGO live source evidence

Read-only inspection on 2026-09-19 of the repository-linked Supabase project `fyhftlxokyjtpndbkfse`. No remote updates, migrations, recomputes or deployments were executed. This is targeted evidence, not certification of every player or component.

## Verified units and reconstruction

Player 8476453 (Kucherov), season 20252026:

| Check | Observed result |
| --- | --- |
| Latest five NHL dates | April 7, 9, 11, 13, 15, 2026 |
| NST `toi` versus WGO `toi_per_game` on those dates | Exact matches: 1181, 1392, 1221, 989, 1254 seconds |
| Recent five total TOI | 6037 seconds |
| Recent five goals | 1 |
| Independently reconstructed G/60 | 1 × 3600 / 6037 = 0.596322676826238 |
| Stored `wigo_recent.l5_g_per_60` | 0.0099387112804373 (60 times too small) |
| Recent mean TOI | 1207.4 seconds = 20:07.4 |
| Recent mean PPTOI | 229.4 seconds |
| Unique season logs / GP | 76 / 76 |
| Reconstructed G / A / PTS / SOG | 44 / 86 / 130 / 231; matches season totals |
| Season PPTOI sum | 19352 seconds; matches season totals |
| Correct season PPTOI average | 19352 / 76 = 254.6315789 seconds |
| Stored `wigo_career.std_pptoi` | 322.533333333333 = seasonal PP seconds / 60, not seconds per game |
| Source shooting percentage | 0.19047, a fraction; display converts once to percentage points |
| Game Score RPC returned games | 74, versus 76 canonical games (coverage defect remains open) |

Local writer correction now uses seconds for recent per-60 calculations and total PP seconds / GP for STD, LY, 3YA and CA. Regression fixtures exercise the actual handler with mocked source rows and captured upserts; they do not execute remote writes. Existing production aggregate rows remain unchanged pending separately authorized release/recompute.

## Refresh ownership discovered

Active database cron jobs include:

| Job | Stored schedule |
| --- | --- |
| update-nst-gamelog | 25 7 * * * |
| update-all-wgo-skaters | 30 7 * * * |
| update-all-wgo-skater-totals | 40 7 * * * |
| update-nst-current-season | 45 8 * * * |
| update-wigo-table-stats | 50 8 * * * |
| update-nst-team-daily-incremental | 55 9 * * * |
| update-nst-team-stats-all | 55 10 * * * |

These are stored cron expressions; job completion order, runtime overlap, timezone configuration and failure history still need checking. Commands/headers were deliberately not returned because they can contain credentials.

`wigo_rates` currently contains **zero rows**. No public SQL function body references that table. Its optional precedence is therefore not responsible for the sampled incorrect rates; external writers and legacy status remain to be resolved before removing the path.

## Deployed RPCs

The deployed Game Score RPC matches the checked-in weighted arithmetic, including null propagation and `WHERE sub.game_score IS NOT NULL`. This explains how missing inputs can remove games. Do not turn absent inputs into zero indiscriminately; preserve the canonical game sequence and disclose incomplete scores.

The deployed radar RPC aggregates `skatersGameStats` joined to `games` within date bounds and returns `numgames`. The client now prevents inverted preseason windows and uses the same midrank tie rule as WiGO. Source performance and full cohort coverage still require measurement.

## Shared-query verification

The totals consumer regression mounts three consumers and observes one fetch, then changes player/season and observes one additional fetch. Returning to the original context within the 60-second freshness window reuses data. Ratings regression confirms changing player/min-GP reuses the season cohort; changing season fetches a new cohort. This proves request deduplication in tests, not measured production page latency.

PP defense and PK offense have no configured rating weights. Their two unused cohort fetches were removed; six weighted cohorts remain. Existing rating semantics and the nine displayed cells are preserved.

## Shared season game calendar — September 19 follow-up

Read-only SQL over all 20252026 `wgo_skater_stats` rows found 47,230 rows, zero missing game IDs, zero duplicate `(player_id, game_id)` pairs and zero rows with `games_played` other than 1. Joining `games` by ID matched every row to game type 2, with zero missing points; date range was 2025-10-07 through 2026-04-16. The `games` table does not expose a completed/live state, so this validates participation, identity and regular-season scope, not an independent final-status check.

The shared reader now selects game IDs, filters `games_played=1`, collapses identical duplicates and rejects conflicting duplicate rows or missing identities. Existing source values remain unchanged. Fourteen fetch tests pass, including these new safeguards.

## Team Special Teams source mismatch — September 19 follow-up

Live `wgo_team_stats` for Tampa Bay (`team_id=14`, season20252026) ends with May 3, May 1 and April 29 games, IDs2025030127/126/125, each `games_played=1`. May3 has `power_play_pct=0.333333`, `penalty_kill_pct=1`; the prior two games have PP0 and PK1. Thus the existing card's PP33.3%/PK100% describes one playoff game, not cumulative regular-season performance. The `overall_*` columns are also individual-game values and cannot fix this by substitution. `fetchWGOdata.js` maps NHL per-game summary values directly and additionally stores PP opportunities and goal counts. The next required source fix is a season/game-type-matched ratio of summed opportunities/goals; do not average these daily percentages. The 5v5 snapshot window must also be bounded to the requested season.

## Correction: 5v5 rows are daily, too

The writer `update-nst-team-daily.ts` sets `fd=td=date` and `stype=2`. Live TBL's March21 row has GP1, xGF2.44, xGA1.79, GF2. Thus all prior team-card values were individual-game context, despite the original cumulative-snapshot assumption. Through March21, TBL has 66 unique NST dates with summed GP66, xGF146.83, xGA129.65 and GF160. Canonical regular-season metadata expects 68 games; missing dates are October28 (2025020156) and October30 (2025020169), 2025.

Independent SQL over regular-season WGO team games through March21 yields PP22.1153846% and PK82.3255814% over68 games, with no missing opportunity/goal inputs. These match the partially corrected browser output before the 5v5 completeness gate was added. They do not validate a complete four-card population.

The local reader now paginates regular-season game metadata and season-bounded daily sources, sums 5v5 counts and PP/PK opportunities/goals, and rejects teams with missing expected games or invalid metrics. All four card labels remain visible when coverage is incomplete. Source repair/backfill has not been performed.

## Percentile cohorts — September 19 source validation

Read-only production queries counted distinct player IDs, exposure and missing displayed metrics for each strength/season:

| Strength | Season | Rows / unique players | Invalid GP/TOI | Rows missing ≥1 metric | Max GP |
| --- | --- | --- | --- | --- | --- |
| AS | 20242025 | 925 / 925 | 0 | 0 | 119 |
| AS | 20252026 | 633 / 633 | 0 | 0 | 5 |
| ES | 20242025 | 925 / 925 | 0 | 0 | 119 |
| ES | 20252026 | 941 / 941 | 0 | 20 | 102 |
| PK | 20242025 | 801 / 801 | 0 | 0 | 113 |
| PK | 20252026 | 827 / 827 | 0 | 20 | 82 |
| PP | 20242025 | 842 / 842 | 0 | 0 | 116 |
| PP | 20252026 | 841 / 841 | 0 | 0 | 86 |

These are raw rates, not stored ranks. Live ES view definitions match the schema baseline: percentile offense left-joins individual and on-ice season rates by player/season; rates derive count ×3600 / TOI seconds. Percentage columns use percentage points. Database types are bigint for player ID, GP and TOI, integer for season, double precision for rates. Zero-denominator SQL defaults to zero for many rates and 50 for on-ice percentages, which still requires a missing-exposure policy.

The GP maxima reveal contamination that the low-GP freshness heuristic cannot detect. Live `nst_seasonlong_es_counts` sums all `nst_gamelog_es_counts` rows grouped only by player/season, with no date or game-type validation. For 20252026, game-log GP distribution is: GP1:49,173 rows; GP2:104; GP3:446; GP4:524; GP5:120. Player8477964 has aggregated GP102, including two identical GP4 observations dated2025-05-28 and2025-05-29 but tagged season20252026 (each G1, PTS3, TOI3461). These dates precede that season and the rows are not single-game observations. This proves contaminated source aggregation; it does not yet establish the original ingestion cause or a complete repair.

Next bounded investigation: `web/pages/api/v1/db/update-nst-gamelog.ts` and `update-nst-last-ten.ts`, the located writers, then a reviewed season/game-identity repair with coverage checks. Do not clamp GP or hide contaminated games by display scaling. No production changes were made. AS stored-table refresh ownership remains unresolved; current AS stops at GP5 while its fallback cohort is also contaminated.

# Cron Failed Jobs Root Cause Matrix

## Matrix

| Job | Root Cause | Dependent Systems | Proposed Fix Type | Required Validation |
| --- | --- | --- | --- | --- |
| `update-rolling-player-averages` `07:45 GET` | Unbounded full-skater rebuild hitting DB statement timeout | `players`, rolling metrics pipeline, FORGE downstream | Bound cron scope; change default daily mode to bounded recent window; tune workload | Re-run both cron shapes with explicit params and confirm structured success |
| `update-rolling-player-averages` `09:00 POST` | Same unbounded rebuild, but outer HTTP timeout/fetch failure instead of inner DB error | Same as above | Same as above; stop using meaningless `POST {}` cron shape | Re-run `POST` with bounded query params and confirm no `fetch failed` |
| `update-nst-goalies` | NST route runtime instability under current pacing/workload | NST upstream, goalie priors chain | Audit burst-mode eligibility; tighten bounded runs; harden error handling | Re-run route with compliant burst logic and confirm rate-safe success |
| `calculate-wigo-stats` | Broad multi-source route timing out before returning structured error | `wgo_skater_stats_totals`, `nst_seasonal_individual_counts`, `nst_gamelog_as_counts`, `nst_gamelog_as_counts_oi`, `wigo_recent`, `wigo_career` | Reduce workload or batch route; add structured progress/failure surfacing | Re-run route and confirm bounded completion or clean partial/timed-out JSON |
| `goalie_stats_unified` refresh | Supabase `execute_sql` transport failure (`520`) | Supabase RPC path; downstream goalie actual consumers | Harden SQL execution path / retry / alternate execution path | Re-run SQL refresh and confirm structured DB result instead of HTML |
| `update-start-chart-projections` | Oversized single-request builder timing out at outer boundary | `games`, `lineCombinations`, `team_power_ratings_daily`, `goalie_start_projections`, `rolling_player_game_metrics`, `player_projections` | Add bounded date execution, chunking, or lighter query fan-out | Re-run with explicit date and confirm route returns JSON before timeout |
| `ingest-projection-inputs` | Ingest loop hitting upstream fetch/load failure under tight single-request budget | `games`, `pbp_games`, `shift_charts`, PBP/shifts upstream sources | Improve chunking/resume defaults and failure detail; bound cron inputs | Re-run with `startDate/endDate/chunkDays` and verify actionable JSON |
| `build-projection-derived-v2` | Multi-stage derived build timing out as one broad request | `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game` and source ingest tables | Use bounded windows/resume; reduce per-request work | Re-run with bounded dates and confirm full or timed partial JSON |
| `update-nst-team-daily` `09:55` | NST route runtime instability / fetch failure | NST upstream, WGO team downstream consumers | Audit burst-mode eligibility and route pacing | Re-run route with compliant pacing and confirm success |
| `yahoo_nhl_player_map_mat` refresh | Supabase `execute_sql` transport timeout (`522`) | Supabase RPC path; Yahoo-mapping consumers | Harden SQL execution path / retry / alternate execution path | Re-run SQL refresh and confirm no HTML `522` |
| `run-projection-v2` | Preflight dependency read failed through upstream HTML instead of clean stale-data `422` | `lineCombinations`, `pbp_games`, `shift_charts`, `forge_*_game_strength`, `forge_goalie_game`, `goalie_start_projections`, `players` | Repair upstream freshness first; normalize HTML leak into structured gate failure | Re-run after upstream fixes and confirm `200` or clean `422` |
| `refresh_team_power_ratings(...)` | Supabase `execute_sql` transport timeout (`522`) | Supabase RPC path; `team_power_ratings_daily` consumers | Harden SQL execution path; consider decomposing heavy refresh path | Re-run SQL function and confirm no HTML `522` |
| `update-season-stats` | Latest-processed lookup failed on `goaliesGameStats` | `goaliesGameStats`, `skatersGameStats`, `teamGameStats`, `games` | Normalize upstream HTML failures; restore base table/query stability | Re-run route and confirm lookup completes before game processing |
| `update-rolling-games?date=recent` | Application defect: `require is not a function` | Legacy loader path `fetchRollingGames.js` | Fix module-loading/runtime compatibility | Re-run route and add regression test |
| `update-sko-stats` | Latest-date lookup failed on `sko_skater_stats` | `sko_skater_stats` | Normalize upstream HTML failures; restore source table/query stability | Re-run route and confirm latest-date lookup works |
| `update-wgo-averages` | Direct source fetch failed on `nst_seasonal_on_ice_counts` | `nst_seasonal_on_ice_counts`, `nst_seasonal_individual_counts`, `teamsinfo`, `team_summary_years` | Restore upstream table/query stability; keep structured source-table errors | Re-run route and confirm source fetches complete |
| `rebuild-baselines` | Direct unified-view read failed on `player_stats_unified`; also depends on `player_totals_unified` | `player_stats_unified`, `player_totals_unified`, `player_baselines` | Restore unified views first; preserve structured view-specific errors | Re-run route after view refreshes |
| `player_totals_unified` refresh | Supabase `execute_sql` transport timeout (`522`) | Supabase RPC path; sustainability and ML consumers | Harden SQL execution path / retry / alternate execution path | Re-run SQL refresh and confirm no HTML `522` |
| `rebuild-priors` | Downstream failure on `player_totals_unified` path | `player_totals_unified`, `sustainability_priors` | Restore unified view; normalize route errors | Re-run after `player_totals_unified` is healthy |
| `rebuild-window-z` | Downstream failure on `sustainability_priors` and `player_stats_unified` chain | `sustainability_priors`, `player_stats_unified`, `sustainability_window_z` | Restore priors and unified view; use explicit batches if needed | Re-run bounded batch URL and confirm success |
| `rebuild-score` | Downstream failure on `player_totals_unified`, `sustainability_window_z`, and `player_stats_unified` chain | `player_totals_unified`, `sustainability_window_z`, `player_stats_unified`, `sustainability_scores` | Restore prerequisites; prefer explicit batches | Re-run bounded batch URL and confirm success |
| `update-predictions-sko` | Source read failure on `player_stats_unified` | `player_stats_unified`, `predictions_sko` | Restore unified view; normalize route error context | Re-run route and confirm player discovery + series fetch works |
| `rebuild-trend-bands` | Downstream failure on `player_stats_unified` and `player_totals_unified` | `player_stats_unified`, `player_totals_unified`, trend-band tables | Restore unified views; prefer explicit batches | Re-run bounded batch URL and confirm success |
| `update-nst-team-daily` `10:50` | Same NST route/runtime issue as earlier run | NST upstream and downstream team metrics chain | Same NST hardening as 09:55 run | Re-run after NST hardening |
| `/api/Teams/nst-team-stats` | NST route/runtime instability or upstream NST dependency failure | NST upstream, team stats downstream consumers | Audit burst-mode opportunity and stabilize route | Re-run route after NST hardening |
| `update-power-rankings` | Application defect: `require is not a function` | Legacy loader/runtime path | Fix module-loading/runtime compatibility | Re-run route and add regression test |
| `run-projection-accuracy` | Fast downstream dependency / Supabase transport instability, not runtime-budget issue | `forge_runs`, `forge_player_projections`, `forge_goalie_projections`, `goalie_stats_unified`, `forge_goalie_game`, accuracy tables | Repair upstream FORGE outputs and normalize HTML-leaking reads/writes | Re-run after FORGE + unified-view fixes |

## Fix Order

1. Fix standalone code defects:
   - `update-rolling-games`
   - `update-power-rankings`
2. Fix SQL execution-path stability:
   - `goalie_stats_unified`
   - `yahoo_nhl_player_map_mat`
   - `refresh_team_power_ratings(...)`
   - `player_totals_unified`
3. Fix oversized or unbounded route execution:
   - `update-rolling-player-averages`
   - `calculate-wigo-stats`
   - `update-start-chart-projections`
   - `ingest-projection-inputs`
   - `build-projection-derived-v2`
4. Fix direct table/view dependency readers:
   - `update-season-stats`
   - `update-sko-stats`
   - `update-wgo-averages`
   - `rebuild-baselines`
   - `update-predictions-sko`
5. Fix downstream gated consumers:
   - `run-projection-v2`
   - `rebuild-priors`
   - `rebuild-window-z`
   - `rebuild-score`
   - `rebuild-trend-bands`
   - `run-projection-accuracy`
6. Fix NST-specific runtime/pacing jobs:
   - `update-nst-goalies`
   - `update-nst-team-daily`
   - `nst-team-stats`

## Notes

- Any job whose benchmark reason included Cloudflare HTML from `fyhftlxokyjtpndbkfse.supabase.co` should be treated as a transport or upstream query-path failure first.
- Any cron route currently invoked as bare `POST {}` despite supporting explicit dates or chunking should be considered misconfigured until proven otherwise.
- The sustainability chain is mostly downstream fallout from broken unified views and missing prior/window prerequisites, not five independent first-order failures.

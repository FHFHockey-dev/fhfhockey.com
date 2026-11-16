# Rankings acceptance — bounded read packet (proposed 2026-11-14)

Target: Supabase `fyhftlxokyjtpndbkfse` (read-only SELECT), deployed `fhfhockey` `dpl_8paYEhJ2hjQqDzyGyfw35jvahbAr` at `89da739cb`.
One reader at a time (Chef only), sequential, `SET LOCAL statement_timeout = '5s'` on every SQL call. No writes, RPCs that write, cron/ETL/recompute routes, NST/provider calls.

## Stage A — publication state (1 query, decides everything else)
`entity_metric_rankings` and `skater_composite_ratings` grouped by season_id, snapshot_date, window_type, strength_state, peer_group_type: row count, distinct entity/player IDs, distinct metric_key, methodology_version, max(updated_at). Answers: is 2026-27 served from durable rows or the rolling fallback; is it 764 or 740 players (50,320 = 740 x 68).

## Stage B — independent expected populations (≤10 queries, raw tables only, never reader code)
Seasons 20262027 (current, cutoff = latest completed game) and 20252026 (historical):
1. Skaters: distinct player IDs with ≥1 regular-season appearance in `wgo_skater_stats` (count + ID list).
2. Skaters with matched source: distinct IDs in `rolling_player_game_metrics` per strength (5v5, all) + latest game_date.
3. Goalies: distinct `goalie_id` in `wgo_goalie_stats` regular season; starts/appearances per goalie; goalies with >1 team.
4. Teams: distinct team IDs in `games` regular season; completed game count per team.
5. Published IDs (if Stage A shows rows): distinct entity_id per season/window/strength; set difference vs 1 and 2 (ID lists capped at 200).
6. Freshness: max event date and max updated_at per source used by the readers (rolling, wgo skater/goalie/team, team_power_ratings_daily, team_unit_toi, nst_team_5v5, goalie_start_projections).
Stop: any timeout → do not retry with longer timeout; narrow the query or record as unmeasured.

## Stage C — local reader against production data (≤12 sequential view requests)
Isolated dev server (`PLAYWRIGHT_ISOLATED_NEXT=1`, port 3100), one request at a time, 30 s client cap. Views: skater matrix current/historical (5v5 season, all-strength last10, team=EDM), snapshot + comparison for selected players, goalie matrix current/historical, team matrix current/historical. Compare returned IDs/ranks to Stage B. Stop: any request >30 s, any 5xx/DB error, or DB CPU warning.

## Stage D — deployed timing (≤5 sequential production GETs, concurrency 1)
1–2. Same skater matrix URL as the 11-08 audit, twice back-to-back (cold-ish then warm).
3. Goalie matrix current season, page_size 10.
4. Team matrix current season.
5. Snapshot for one player with `team=EDM`.
Record status, total ms, bytes, x-vercel-cache, source field. Stop after any >20 s or 5xx. No load test; these are samples, not percentiles.

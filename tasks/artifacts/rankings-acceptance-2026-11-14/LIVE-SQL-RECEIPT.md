# Live SQL receipt — Stage A/B (2026-11-14, read-only, Supabase fyhftlxokyjtpndbkfse)
Approved by TJ pop-up ("Approve A–D"). All SELECT, `set local statement_timeout` 4–5 s, sequential, Chef only.
Calls: 12 total = A 1 + schema lookup 1 + B 10 (3 of them hit the timeout and were narrowed, not retried longer).

## A. Publication state
| table | season | snapshot | window | strength / peer | method | rows | ids | written |
|---|---|---|---|---|---|---|---|---|
| entity_metric_rankings | 20262027 | 2026-11-11 | season, last_5, last_10, last_20 | 5v5 / all_skaters | contextual_rankings_v1 | 12,580 each = 50,320 | 740 | 2026-11-13 07:06 UTC |
| entity_metric_rankings | 20252026 | 2026-04-16 | 4 windows | 5v5 / all_skaters | v1 | 13,192 each | 776 | 2026-06-22 |
| skater_composite_ratings | 20262027 | 2026-11-11 | season | 5v5 / all_skaters | contextual_composites_v3 | 764 | 764 | 2026-11-13 07:06 UTC |
| skater_composite_ratings | 20262027 | 2026-11-07 | season | 5v5 / all_skaters | contextual_composites_v1 | 732 | 732 | 2026-11-09 (older generation still present) |
| skater_composite_ratings | 20252026 | 2026-04-16 | season, last_20 | all_skaters + deployment | v1 | 776 each | 776 | 2026-06-09 |
17 metrics per window. No current-season deployment-peer composites, no last_N composites, no non-5v5 or position/team cohorts persisted.

## B. Freshness (max event date)
games regular season 20262027 starts 2026-09-29 (preseason type 1: 09-19..09-26). Scheduled reg-season games through 11-11: 298; through 11-13: 311.
wgo_skater_stats, wgo_goalie_stats, goalie_stats_unified, wgo_team_stats, rolling_player_game_metrics (5v5 and all), nst_team_5v5: 2026-11-13. team_unit_toi: games through 11-12, snapshot 11-13. team_power_ratings_daily: 11-14. goalie_start_projections: game_date up to 11-19 (future slates).
=> Durable skater publication (11-11) lags sources by 2 days / 13 games.

## B. Skater population reconciliation (season 20262027, through snapshot 2026-11-11)
- Independent: distinct player_id in wgo_skater_stats, dates 09-29..11-11 = **764**; of these, last appearance ≥ 10-12 = **740**.
- Published rankings = **740**, composites v3 = **764**. Published ⊂ composites; pub_not_cmp = none.
- 24 composite-only IDs: 8473419, 8473533, 8476891, 8477493, 8477845, 8478424, 8479324, 8479336, 8479346, 8480068, 8480813, 8481014, 8482074, 8482169, 8482667, 8482691, 8482715, 8482742, 8482806, 8482874, 8484180, 8484185, 8484428, 8484984. Every one has 1–6 WGO games and matching rolling 5v5 rows, last game between 10-01 and 10-11.
- Cause (pending code confirmation by the correctness worker): rankings population = players seen within the latest ~30 game dates (audit R03 horizon), not the season's eligible appearances. The composite writer uses the full season. The 24 players are valid season-window rows silently omitted, not a missing source.

## B-extension (TJ pop-up "Allow 3 more SQLs") — 3 calls, 1 timed out
- Goalies, WGO 09-29..11-13: **76** with GP>0 (75 with a start; 655 rows); 1 multi-team goalie, 8482076. The deployed goalie view returns totalRankedRows **76** → match.
- 2025-26 skaters vs WGO (09/10..04-16): **timed out at 5 s**; not retried longer.
- 2025-26 skaters vs matched rolling 5v5 rows (game_date 2025-10-01..2026-04-16): **940** distinct; published 776; **164 rolling-only**, 0 published-only. Caveat: may include any preseason rows stored under season 20252026 between 10-01 and the season opener.
- Team completed-game coverage: not queried independently. The reader's own styleCoverage (eligible = covered games) is the only evidence.

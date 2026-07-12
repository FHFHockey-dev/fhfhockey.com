-- Supports unfiltered latest-source-date probes without sorting the full
-- player_trend_metrics table. Existing indexes lead with metric_key/player_id
-- and cannot satisfy ORDER BY game_date DESC LIMIT 1 efficiently.
create index if not exists player_trend_metrics_game_date_idx
  on public.player_trend_metrics (game_date desc);

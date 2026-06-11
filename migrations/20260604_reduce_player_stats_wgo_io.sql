-- Reduce IO from known hot player_stats_unified and WGO read paths.

DROP INDEX IF EXISTS public.idx_wgo_team_stats_team_season_date_desc;

CREATE INDEX IF NOT EXISTS idx_player_stats_unified_player_date_desc
ON public.player_stats_unified (player_id ASC, date DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_unified_date_player
ON public.player_stats_unified (date DESC, player_id);

CREATE INDEX IF NOT EXISTS idx_wgo_team_stats_date_desc
ON public.wgo_team_stats (date DESC);

CREATE INDEX IF NOT EXISTS idx_wgo_team_stats_team_date_desc
ON public.wgo_team_stats (team_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_wgo_team_stats_season_date
ON public.wgo_team_stats (season_id, date);

CREATE INDEX IF NOT EXISTS idx_wgo_goalie_stats_team_date_desc
ON public.wgo_goalie_stats (team_abbreviation, date DESC);

CREATE INDEX IF NOT EXISTS idx_wgo_goalie_stats_goalie_season_date_desc
ON public.wgo_goalie_stats (goalie_id, season_id, date DESC);

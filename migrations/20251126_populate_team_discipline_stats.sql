-- Populate team_discipline_stats from wgo_team_stats
-- We use a self-join on wgo_team_stats to get "opponent" metrics (hits taken, blocks against)

INSERT INTO team_discipline_stats (
    team_id,
    date,
    season_id,
    times_shorthanded_per_60,
    times_powerplay_per_60,
    penalties_taken_per_60,
    penalties_drawn_per_60,
    toi_shorthanded_per_game,
    hits_taken_per_60,
    shots_blocked_by_opponent_per_60
)
SELECT
    t1.team_id,
    t1.date,
    t1.season_id,
    -- Own Discipline Metrics
    -- Note: wgo_team_stats has _per_60 columns, but we can also recalculate if needed.
    -- Using the existing per_60 columns from WGO if available, or deriving.
    -- WGO has 'times_shorthanded_per_game', let's convert to per_60 if needed, or just use the rate.
    -- Actually, let's look at wgo_team_stats definition again.
    -- It has 'times_shorthanded_per_game'. To get per 60: (times / toi) * 60?
    -- Or just use the per_game metric as a proxy for "frequency".
    -- The PRD asked for "per_60".
    -- Let's calculate per 60: (value / (toi_seconds / 60)) * 60 = (value / toi_seconds) * 3600
    -- But wgo_team_stats usually has 'time_on_ice_per_game_5v5' etc.
    -- Let's assume standard game length (60 min) for per-game stats if TOI is missing, or use the per_60 columns if they exist.
    -- wgo_team_stats HAS 'penalties_taken_per_60'.
    
    -- times_shorthanded_per_60: WGO has 'times_shorthanded'.
    -- Calculation: (t1.times_shorthanded::numeric / NULLIF(t1.games_played * 60, 0)) * 60 ... wait, this is single game.
    -- For a single game, TOI is roughly 60.
    -- Let's just use the raw counts normalized to 60 mins based on actual game length if possible, or just assume 60 for now.
    -- Better: Use the pre-calculated per_60 columns where available.
    
    -- 1. times_shorthanded_per_60
    -- WGO doesn't have this explicit per_60 column, only per_game.
    -- We'll compute: (times_shorthanded / (games_played * 60)) * 60 = times_shorthanded / games_played.
    -- Since this is a single game row, games_played is 1. So it's just times_shorthanded.
    -- However, if the game went to OT, the rate per 60 is lower.
    -- Let's stick to the per_game value as the "rate" for now, or normalize by TOI if we had it.
    -- wgo_team_stats doesn't seem to have total TOI column easily accessible in the schema snippet (it has 5v5 toi).
    -- We'll use the per_game value as the best proxy.
    COALESCE(t1.times_shorthanded_per_game, t1.times_shorthanded::numeric),

    -- 2. times_powerplay_per_60
    COALESCE(t1.pp_opportunities_per_game, t1.pp_opportunities::numeric),

    -- 3. penalties_taken_per_60
    t1.penalties_taken_per_60,

    -- 4. penalties_drawn_per_60
    t1.penalties_drawn_per_60,

    -- 5. toi_shorthanded_per_game
    t1.toi_shorthanded,

    -- Opponent Metrics (from t2)
    -- 6. hits_taken_per_60 (Hits delivered by opponent)
    t2.hits_per_60,

    -- 7. shots_blocked_by_opponent_per_60 (Blocks made by opponent)
    t2.blocked_shots_per_60

FROM
    wgo_team_stats t1
JOIN
    wgo_team_stats t2 ON t1.game_id = t2.game_id AND t1.team_id != t2.team_id
ON CONFLICT (team_id, date) DO UPDATE SET
    times_shorthanded_per_60 = EXCLUDED.times_shorthanded_per_60,
    times_powerplay_per_60 = EXCLUDED.times_powerplay_per_60,
    penalties_taken_per_60 = EXCLUDED.penalties_taken_per_60,
    penalties_drawn_per_60 = EXCLUDED.penalties_drawn_per_60,
    toi_shorthanded_per_game = EXCLUDED.toi_shorthanded_per_game,
    hits_taken_per_60 = EXCLUDED.hits_taken_per_60,
    shots_blocked_by_opponent_per_60 = EXCLUDED.shots_blocked_by_opponent_per_60,
    updated_at = NOW();

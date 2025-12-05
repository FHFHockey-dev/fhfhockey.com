-- Create a function to update team_discipline_stats when wgo_team_stats changes
CREATE OR REPLACE FUNCTION update_team_discipline_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- We need to update discipline stats for BOTH teams involved in the game
    -- The trigger fires on a row in wgo_team_stats, which represents ONE team's stats for a game.
    -- We need to find the opponent's stats to calculate "hits taken" etc.
    
    -- Insert or Update for the team that just got updated (NEW.team_id)
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
        COALESCE(t1.times_shorthanded_per_game, t1.times_shorthanded::numeric),
        COALESCE(t1.pp_opportunities_per_game, t1.pp_opportunities::numeric),
        t1.penalties_taken_per_60,
        t1.penalties_drawn_per_60,
        t1.toi_shorthanded,
        t2.hits_per_60, -- Opponent's hits
        t2.blocked_shots_per_60 -- Opponent's blocks
    FROM
        wgo_team_stats t1
    JOIN
        wgo_team_stats t2 ON t1.game_id = t2.game_id AND t1.team_id != t2.team_id
    WHERE
        t1.id = NEW.id -- Only for the row being inserted/updated
    ON CONFLICT (team_id, date) DO UPDATE SET
        times_shorthanded_per_60 = EXCLUDED.times_shorthanded_per_60,
        times_powerplay_per_60 = EXCLUDED.times_powerplay_per_60,
        penalties_taken_per_60 = EXCLUDED.penalties_taken_per_60,
        penalties_drawn_per_60 = EXCLUDED.penalties_drawn_per_60,
        toi_shorthanded_per_game = EXCLUDED.toi_shorthanded_per_game,
        hits_taken_per_60 = EXCLUDED.hits_taken_per_60,
        shots_blocked_by_opponent_per_60 = EXCLUDED.shots_blocked_by_opponent_per_60,
        updated_at = NOW();

    -- Also try to update the OPPONENT's discipline stats, because their "hits taken" depends on THIS team's hits (NEW.hits)
    -- We find the opponent by game_id
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
        t2.team_id, -- The opponent
        t2.date,
        t2.season_id,
        COALESCE(t2.times_shorthanded_per_game, t2.times_shorthanded::numeric),
        COALESCE(t2.pp_opportunities_per_game, t2.pp_opportunities::numeric),
        t2.penalties_taken_per_60,
        t2.penalties_drawn_per_60,
        t2.toi_shorthanded,
        t1.hits_per_60, -- THIS team's hits (NEW)
        t1.blocked_shots_per_60 -- THIS team's blocks (NEW)
    FROM
        wgo_team_stats t1
    JOIN
        wgo_team_stats t2 ON t1.game_id = t2.game_id AND t1.team_id != t2.team_id
    WHERE
        t1.id = NEW.id -- t1 is the NEW row, t2 is the opponent
    ON CONFLICT (team_id, date) DO UPDATE SET
        hits_taken_per_60 = EXCLUDED.hits_taken_per_60,
        shots_blocked_by_opponent_per_60 = EXCLUDED.shots_blocked_by_opponent_per_60,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on wgo_team_stats
DROP TRIGGER IF EXISTS trigger_update_team_discipline_stats ON wgo_team_stats;

CREATE TRIGGER trigger_update_team_discipline_stats
AFTER INSERT OR UPDATE ON wgo_team_stats
FOR EACH ROW
EXECUTE FUNCTION update_team_discipline_stats();

-- Function to calculate and populate goalie start projections
-- Logic:
-- 1. For a given game, identify the teams.
-- 2. Look at the last 10 games for each team.
-- 3. Calculate goalie start share (Probability).
-- 4. Calculate GSAA/60 based on those last 10 games.

CREATE OR REPLACE FUNCTION calculate_goalie_start_projections(target_date DATE)
RETURNS VOID AS $$
DECLARE
    game_record RECORD;
BEGIN
    -- Loop through all games on the target date
    FOR game_record IN
        SELECT id, "homeTeamId", "awayTeamId"
        FROM games
        WHERE date = target_date
    LOOP
        -- Process Home Team
        PERFORM process_team_goalie_projections(game_record.id, game_record."homeTeamId", target_date);
        
        -- Process Away Team
        PERFORM process_team_goalie_projections(game_record.id, game_record."awayTeamId", target_date);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_team_goalie_projections(p_game_id INT, p_team_id INT, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_team_abbrev TEXT;
    v_league_sv_pct NUMERIC := 0.900; -- Conservative league average
BEGIN
    -- Get Team Abbreviation
    SELECT abbreviation INTO v_team_abbrev FROM teams WHERE id = p_team_id;
    
    -- If team not found, exit
    IF v_team_abbrev IS NULL THEN
        RETURN;
    END IF;

    -- Calculate and Insert Projections
    WITH last_games AS (
        -- Get dates of the last 10 games for this team
        SELECT date
        FROM wgo_team_stats
        WHERE team_id = p_team_id AND date < p_date
        ORDER BY date DESC
        LIMIT 10
    ),
    goalie_stats AS (
        -- Aggregate stats for goalies in those games
        SELECT
            gs.goalie_id,
            SUM(gs.games_started) as starts,
            SUM(gs.shots_against) as sa,
            SUM(gs.goals_against) as ga,
            SUM(gs.time_on_ice) as toi -- Assuming minutes
        FROM wgo_goalie_stats gs
        WHERE gs.team_abbreviation = v_team_abbrev
          AND gs.date IN (SELECT date FROM last_games)
        GROUP BY gs.goalie_id
    ),
    total_stats AS (
        -- Total starts in the sample (should be ~10)
        SELECT SUM(starts) as total_starts FROM goalie_stats
    )
    INSERT INTO goalie_start_projections (
        game_id,
        team_id,
        player_id,
        start_probability,
        projected_gsaa_per_60,
        confirmed_status
    )
    SELECT
        p_game_id,
        p_team_id,
        gs.goalie_id,
        -- Probability: starts / total_starts
        COALESCE(gs.starts::NUMERIC / NULLIF((SELECT total_starts FROM total_stats), 0), 0),
        -- GSAA per 60: ((SA * AvgSv%) - GA) / TOI * 60
        CASE 
            WHEN gs.toi > 0 THEN
                (((gs.sa * v_league_sv_pct) - gs.ga) / gs.toi) * 60
            ELSE 0
        END,
        FALSE -- Default confirmed status
    FROM goalie_stats gs
    ON CONFLICT (game_id, player_id) DO UPDATE SET
        start_probability = EXCLUDED.start_probability,
        projected_gsaa_per_60 = EXCLUDED.projected_gsaa_per_60,
        updated_at = NOW();
        
END;
$$ LANGUAGE plpgsql;

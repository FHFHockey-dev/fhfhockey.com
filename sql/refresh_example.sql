-- refresh_example.sql
-- Refresh the team power ratings materialized view for the latest two days.

-- Optional: uncomment to run the calculation in 5v5-only mode.
-- SET team_power_mode = '5v5';

SELECT public.refresh_team_power_ratings(current_date - 1, current_date);

-- RESET team_power_mode;

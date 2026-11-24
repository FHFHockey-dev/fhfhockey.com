-- PROPOSED BOUNDED PRODUCTION READ #2 (read-only; for Chef to put to TJ). This is the goalie-line SELECT the hosted
-- route runs (web/lib/forge-v2/h10Reader.server.ts H10_SQL.goalieLogs), bound for the 2026-11-23 dry run. Without it
-- the real-data goalie run has no training starts, and every goalie value comes back unavailable
-- ("sparse_goalie_start_history"). That is a data gap, not a model result.
-- Expected size: about 32 clubs × about 22 games × 1–2 goalies ≈ 750–900 rows (limit 5,000).
begin read only;
set local statement_timeout = '30s';
select s.goalie_id as player_id, s.date::text as date, s.season_id, t.id as team_id, s.games_played, s.games_started, s.wins, s.saves,
  s.goals_against, s.shots_against, s.shutouts
from public.wgo_goalie_stats s join public.teams t on t.abbreviation = s.team_abbreviation
where s.season_id = 20262027 and s.date >= date '2026-09-24' order by s.date, s.goalie_id limit 5000;
-- Shape check (no row data): whether wgo_goalie_stats holds one row per goalie per game date.
select count(*) as rows, count(*) filter (where games_played = 1) as one_game_rows, count(distinct (goalie_id, date)) as goalie_dates
from public.wgo_goalie_stats where season_id = 20262027 and date >= date '2026-09-24';
-- Mapping check (no row data). The reader maps a goalie line to the game by (club, date), so this proves one regular
-- season game per club and date, and that team_abbreviation is the club the goalie played for that day.
select count(*) as lines,
  count(*) filter (where m.games = 1) as exactly_one_game,
  count(*) filter (where m.games = 0) as no_game,
  count(*) filter (where m.games > 1) as several_games
from public.wgo_goalie_stats s join public.teams t on t.abbreviation = s.team_abbreviation
cross join lateral (select count(*) as games from public.games g where g."seasonId" = 20262027 and g.type = 2 and g.date = s.date
  and t.id in (g."homeTeamId", g."awayTeamId")) m
where s.season_id = 20262027 and s.date >= date '2026-09-24';
rollback;

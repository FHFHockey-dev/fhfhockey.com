-- Season inventory: games, teamGameStats rows, PBP game coverage (aggregates only; no jsonb).
\timing on
set statement_timeout = '10s';
select g."seasonId", g.type, count(*) as games,
       count(*) filter (where g.date < current_date) as past_games
from games g group by 1,2 order by 1 desc, 2 limit 30;
select (t."gameId" / 1000000) as season_start, count(*) as tgs_rows, count(distinct t."gameId") as tgs_games
from "teamGameStats" t group by 1 order by 1 desc;

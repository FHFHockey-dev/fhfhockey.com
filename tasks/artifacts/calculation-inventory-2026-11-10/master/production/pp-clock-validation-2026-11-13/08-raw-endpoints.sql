-- Which raw NHL endpoints are stored for sample placeholder games (no jsonb read).
set statement_timeout = '10s';
select game_id, endpoint, count(*) as snapshots, min(fetched_at)::date as first_fetch, max(fetched_at)::date as last_fetch
from nhl_api_game_payloads_raw
where game_id in (2025020467, 2025020700, 2025020850, 2025021000, 2025021090, 2026020100)
group by 1, 2 order by 1, 2;
select min(date), max(date) from games where id between 2025020657 and 2025021095;
select min(date), max(date) from games where id between 2025020467 and 2025020476;

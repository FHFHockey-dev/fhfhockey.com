-- One-game probe (two payloads): does any stored raw endpoint carry a team PP
-- TOI that could repair a placeholder row without a new fetch? Returns only
-- matching paths/values, never the payload.
set statement_timeout = '10s';
with latest as (
  select distinct on (endpoint) endpoint, payload
  from nhl_api_game_payloads_raw
  where game_id = 2025020700 and endpoint in ('boxscore', 'landing')
  order by endpoint, fetched_at desc
)
select endpoint,
       jsonb_path_query_array(payload, 'strict $.**.powerPlayToi') as pp_toi_values,
       jsonb_path_query_array(payload, 'strict $.**.category') as categories
from latest;

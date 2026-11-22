-- Page source rows before reading history. Both arrays contain every non-null
-- observation in the same primary-key date order, including old baselines.
create function public.homepage_yahoo_ownership_page(p_offset integer, p_season integer default null)
returns table (
  player_key text, player_id text, season integer, full_name text,
  headshot_url text, display_position text, editorial_team_full_name text,
  editorial_team_abbreviation text, eligible_positions jsonb, uniform_number smallint,
  observation_dates date[], observation_values double precision[], page_count integer
)
language sql stable security invoker
set search_path = ''
as $$
  with page as materialized (
    select p.player_key, p.player_id, p.season, p.full_name, p.headshot_url,
           p.display_position, p.editorial_team_full_name, p.editorial_team_abbreviation,
           p.eligible_positions, p.uniform_number
    from public.yahoo_players p
    where p_season is null or p.season = p_season
    order by p.player_id, p.season nulls first, p.player_key
    limit 1000 offset greatest(p_offset, 0)
  )
  select p.player_key::text, p.player_id::text, p.season, p.full_name::text,
         p.headshot_url::text, p.display_position::text, p.editorial_team_full_name::text,
         p.editorial_team_abbreviation::text, p.eligible_positions, p.uniform_number,
         coalesce(h.dates, '{}'::date[]), coalesce(h.ownership, '{}'::double precision[]),
         (count(*) over ())::integer
  from page p
  cross join lateral (
    select array_agg(o.ownership_date order by o.ownership_date) as dates,
           array_agg(o.ownership_pct order by o.ownership_date) as ownership
    from public.yahoo_player_ownership_history o
    where o.player_key = p.player_key and o.ownership_pct is not null
  ) h
  order by p.player_id, p.season nulls first, p.player_key;
$$;

revoke all on function public.homepage_yahoo_ownership_page(integer, integer) from public;
grant execute on function public.homepage_yahoo_ownership_page(integer, integer) to anon, authenticated, service_role;

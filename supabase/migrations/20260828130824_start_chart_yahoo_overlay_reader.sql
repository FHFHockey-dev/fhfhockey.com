create or replace function public.read_yahoo_player_overlay_as_of(
  p_nhl_player_ids bigint[],
  p_season integer,
  p_as_of_date date
)
returns table (
  nhl_player_id bigint,
  yahoo_player_id bigint,
  nhl_team_abbreviation text,
  yahoo_team text,
  player_name text,
  full_name text,
  eligible_positions jsonb,
  percent_ownership double precision,
  ownership_as_of_date date,
  last_updated timestamp without time zone
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with requested_ids as (
    select distinct requested.nhl_player_id
    from unnest(p_nhl_player_ids) as requested(nhl_player_id)
    where requested.nhl_player_id > 0
      and cardinality(p_nhl_player_ids) between 1 and 500
  ),
  mapping_rows as (
    select
      mapping.nhl_player_id,
      mapping.yahoo_player_id,
      mapping.nhl_team_abbreviation,
      mapping.yahoo_team,
      case
        when mapping.yahoo_player_id ~ '^[0-9]+$'
          then mapping.yahoo_player_id
        when mapping.yahoo_player_id ~ '^[0-9]+[.]p[.][0-9]+$'
          then split_part(mapping.yahoo_player_id, '.', 3)
        else null
      end as yahoo_numeric_id
    from requested_ids as requested
    join public.yahoo_nhl_player_map_read as mapping
      on mapping.nhl_player_id = requested.nhl_player_id::text
    where mapping.nhl_player_id ~ '^[0-9]+$'
  )
  select
    mapping.nhl_player_id::bigint,
    case
      when player.player_id ~ '^[0-9]+$' then player.player_id::bigint
      else null
    end as yahoo_player_id,
    mapping.nhl_team_abbreviation::text,
    mapping.yahoo_team::text,
    player.player_name::text,
    player.full_name::text,
    player.eligible_positions,
    coalesce(
      ownership.ownership_pct,
      case
        when player.last_updated::date <= p_as_of_date
          then player.percent_ownership
        else null
      end
    ) as percent_ownership,
    coalesce(
      ownership.ownership_date,
      case
        when player.last_updated::date <= p_as_of_date
          and player.percent_ownership is not null
          then player.last_updated::date
        else null
      end
    ) as ownership_as_of_date,
    player.last_updated
  from mapping_rows as mapping
  left join lateral (
    select
      candidate.player_id,
      candidate.player_key,
      candidate.player_name,
      candidate.full_name,
      candidate.eligible_positions,
      candidate.percent_ownership,
      candidate.last_updated
    from public.yahoo_players as candidate
    where candidate.season = p_season
      and (
        candidate.player_key = mapping.yahoo_player_id
        or candidate.player_id = mapping.yahoo_player_id
        or candidate.player_id = mapping.yahoo_numeric_id
      )
    order by
      (candidate.player_key = mapping.yahoo_player_id) desc,
      candidate.last_updated desc nulls last,
      candidate.player_key
    limit 1
  ) as player on true
  left join lateral (
    select history.ownership_pct, history.ownership_date
    from public.yahoo_player_ownership_history as history
    where history.player_key = player.player_key
      and history.ownership_date <= p_as_of_date
      and history.ownership_pct is not null
    order by history.ownership_date desc
    limit 1
  ) as ownership on true
  order by
    mapping.nhl_player_id::bigint,
    mapping.nhl_team_abbreviation nulls last,
    yahoo_player_id nulls last;
$function$;

comment on function public.read_yahoo_player_overlay_as_of(
  bigint[], integer, date
) is
  'Service-only bounded Yahoo identity, eligible-position, and latest-on-or-before ownership reader for dated projection surfaces.';

revoke all on function public.read_yahoo_player_overlay_as_of(
  bigint[], integer, date
) from public, anon, authenticated;

grant execute on function public.read_yahoo_player_overlay_as_of(
  bigint[], integer, date
) to service_role;

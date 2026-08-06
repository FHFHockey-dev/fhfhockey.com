create function public.build_player_forecast_runtime_features(
  p_team_id bigint,
  p_season_id bigint,
  p_cutoff_at timestamptz
)
returns table (
  player_id bigint,
  population text,
  features jsonb,
  missingness jsonb,
  source_manifest jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidate_roster as (
    select distinct on (r."playerId")
      r."playerId"::bigint as player_id,
      p.position::text as position
    from public.rosters r
    join public.players p on p.id = r."playerId"
    where r."teamId" = p_team_id
      and r."seasonId" = p_season_id
      and r.is_current is true
      and p.position::text <> 'G'
    order by r."playerId", r.created_at desc
  ),
  player_history as (
    select
      c.player_id,
      c.position,
      g."seasonId"::bigint as season_id,
      g."startTime" as game_start_at,
      s.assists::numeric as assists,
      s.hits::numeric as hits,
      s.created_at,
      row_number() over (
        partition by c.player_id
        order by g."startTime" desc, g.id desc
      ) as reverse_game_number
    from candidate_roster c
    join public."skatersGameStats" s on s."playerId" = c.player_id
    join public.games g on g.id = s."gameId"
    where g.type = 2
      and g."startTime" < p_cutoff_at
  ),
  player_aggregates as (
    select
      c.player_id,
      c.position,
      count(h.game_start_at)::integer as history_count,
      avg(h.assists) as assists_career,
      avg(h.assists) filter (where h.season_id = p_season_id) as assists_current,
      avg(h.assists) filter (where h.season_id = p_season_id - 10001) as assists_previous,
      avg(h.assists) filter (where h.reverse_game_number <= 20) as assists_last_20,
      sum(h.assists * pg_catalog.power(0.9::numeric, (h.reverse_game_number - 1)::numeric))
        / nullif(sum(pg_catalog.power(0.9::numeric, (h.reverse_game_number - 1)::numeric)), 0)
        as assists_ewma_0_1,
      avg(h.hits) as hits_career,
      avg(h.hits) filter (where h.season_id = p_season_id) as hits_current,
      avg(h.hits) filter (where h.season_id = p_season_id - 10001) as hits_previous,
      avg(h.hits) filter (where h.reverse_game_number <= 20) as hits_last_20,
      sum(h.hits * pg_catalog.power(0.9::numeric, (h.reverse_game_number - 1)::numeric))
        / nullif(sum(pg_catalog.power(0.9::numeric, (h.reverse_game_number - 1)::numeric)), 0)
        as hits_ewma_0_1,
      max(h.created_at) as source_max_created_at
    from candidate_roster c
    left join player_history h on h.player_id = c.player_id
    group by c.player_id, c.position
  ),
  position_priors as (
    select
      p.position::text as position,
      avg(s.assists::numeric) as assists_position_prior,
      avg(s.hits::numeric) as hits_position_prior
    from public."skatersGameStats" s
    join public.games g on g.id = s."gameId"
    join public.players p on p.id = s."playerId"
    where g.type = 2
      and g."startTime" < p_cutoff_at
    group by p.position::text
  )
  select
    a.player_id,
    case when a.position = 'D' then 'defense' else 'forward' end as population,
    pg_catalog.jsonb_build_object(
      'assists', pg_catalog.jsonb_build_object(
        'history_count', a.history_count,
        'position_prior', pp.assists_position_prior,
        'career_rate', a.assists_career,
        'previous_season_rate', a.assists_previous,
        'season_to_date_rate', a.assists_current,
        'multi_season_weighted_rate', case
          when a.assists_current is not null and a.assists_previous is not null
            then 0.7 * a.assists_current + 0.3 * a.assists_previous
          else coalesce(a.assists_current, a.assists_previous)
        end,
        'last_20_mean', a.assists_last_20,
        'ewma_0_1', a.assists_ewma_0_1
      ),
      'hits', pg_catalog.jsonb_build_object(
        'history_count', a.history_count,
        'position_prior', pp.hits_position_prior,
        'career_rate', a.hits_career,
        'previous_season_rate', a.hits_previous,
        'season_to_date_rate', a.hits_current,
        'multi_season_weighted_rate', case
          when a.hits_current is not null and a.hits_previous is not null
            then 0.7 * a.hits_current + 0.3 * a.hits_previous
          else coalesce(a.hits_current, a.hits_previous)
        end,
        'last_20_mean', a.hits_last_20,
        'ewma_0_1', a.hits_ewma_0_1
      )
    ) as features,
    pg_catalog.jsonb_build_object(
      'no_completed_game_history', a.history_count = 0,
      'missing_previous_season', a.assists_previous is null,
      'missing_current_season', a.assists_current is null
    ) as missingness,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'source', 'official_nhl_boxscore_history',
      'cutoffExclusive', p_cutoff_at,
      'sourceMaxCreatedAt', a.source_max_created_at,
      'providerConditionalInputsIncluded', false
    )) as source_manifest
  from player_aggregates a
  left join position_priors pp on pp.position = a.position
  order by a.player_id;
$$;

revoke all on function public.build_player_forecast_runtime_features(bigint, bigint, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.build_player_forecast_runtime_features(bigint, bigint, timestamptz)
  to service_role;

comment on function public.build_player_forecast_runtime_features(bigint, bigint, timestamptz) is
  'Builds versioned historical-core skater features from completed official boxscores strictly before the requested cutoff. Current roster membership supplies candidates but never rewrites historical outcomes.';

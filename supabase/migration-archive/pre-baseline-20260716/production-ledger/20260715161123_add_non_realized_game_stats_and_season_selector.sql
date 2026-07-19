-- Add a truthful terminal outcome for confirmed non-realized schedule rows and
-- give routine stats writers a season-bounded discovery surface. Historical
-- discovery remains available only through the existing explicitly invoked RPC.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public."statsUpdateStatus"
  add constraint stats_update_status_manifest_state_check_v2 check ((
    (
      outcome = 'pending'
      and updated = false
      and contract_version = 1
      and reason is null
      and expected_team_rows is null
      and observed_team_rows is null
      and expected_skater_rows is null
      and observed_skater_rows is null
      and expected_goalie_rows is null
      and observed_goalie_rows is null
      and completed_at is null
    )
    or
    (
      outcome = 'legacy_unverified'
      and updated = true
      and contract_version = 0
      and reason is null
      and expected_team_rows is null
      and observed_team_rows is null
      and expected_skater_rows is null
      and observed_skater_rows is null
      and expected_goalie_rows is null
      and observed_goalie_rows is null
      and completed_at is null
    )
    or
    (
      outcome = 'complete'
      and updated = true
      and contract_version = 1
      and reason is null
      and completed_at is not null
      and expected_team_rows = 2
      and observed_team_rows = expected_team_rows
      and expected_skater_rows between 1 and 100
      and observed_skater_rows = expected_skater_rows
      and expected_goalie_rows between 1 and 100
      and observed_goalie_rows = expected_goalie_rows
      and expected_skater_rows + expected_goalie_rows <= 100
    )
    or
    (
      outcome = 'quarantined'
      and updated = true
      and contract_version = 1
      and reason in ('game_not_finished', 'schedule_not_realized')
      and completed_at is not null
      and expected_team_rows = 0
      and observed_team_rows = 0
      and expected_skater_rows = 0
      and observed_skater_rows = 0
      and expected_goalie_rows = 0
      and observed_goalie_rows = 0
    )
  ) is true) not valid;

alter table public."statsUpdateStatus"
  validate constraint stats_update_status_manifest_state_check_v2;

alter table public."statsUpdateStatus"
  drop constraint stats_update_status_manifest_state_check;

alter table public."statsUpdateStatus"
  rename constraint stats_update_status_manifest_state_check_v2
  to stats_update_status_manifest_state_check;

create or replace function public.finalize_non_realized_game_stats_v1(
  p_game_id bigint
)
returns table (
  game_id bigint,
  outcome text,
  reason text,
  contract_version smallint,
  expected_team_rows integer,
  observed_team_rows integer,
  expected_skater_rows integer,
  observed_skater_rows integer,
  expected_goalie_rows integer,
  observed_goalie_rows integer,
  completed_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status_count integer;
  v_completed_at timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_game_id is null or p_game_id <= 0 then
    raise exception using message = 'INVALID_NON_REALIZED_GAME_STATS_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:game-stats:' || p_game_id::text, 0)
  );

  if not exists (
    select 1
    from public.games
    where id = p_game_id
      and "startTime" <= v_completed_at - pg_catalog.make_interval(days => 7)
  ) then
    raise exception using message = 'NON_REALIZED_GAME_STATS_NOT_OLD_ENOUGH';
  end if;

  if exists (
    select 1 from public."teamGameStats" where "gameId" = p_game_id
    union all
    select 1 from public."skatersGameStats" where "gameId" = p_game_id
    union all
    select 1 from public."goaliesGameStats" where "gameId" = p_game_id
  ) then
    raise exception using message = 'NON_REALIZED_GAME_STATS_PARTIAL_DATA_PRESENT';
  end if;

  update public."statsUpdateStatus" as status
  set
    updated = true,
    outcome = 'quarantined',
    reason = 'schedule_not_realized',
    contract_version = 1,
    expected_team_rows = 0,
    observed_team_rows = 0,
    expected_skater_rows = 0,
    observed_skater_rows = 0,
    expected_goalie_rows = 0,
    observed_goalie_rows = 0,
    completed_at = v_completed_at
  where status."gameId" = p_game_id
    and status.updated = false
    and status.outcome = 'pending'
    and status.reason is null
    and status.contract_version = 1
    and status.expected_team_rows is null
    and status.observed_team_rows is null
    and status.expected_skater_rows is null
    and status.observed_skater_rows is null
    and status.expected_goalie_rows is null
    and status.observed_goalie_rows is null
    and status.completed_at is null;
  get diagnostics v_status_count = row_count;

  if v_status_count <> 1 then
    raise exception using message = 'NON_REALIZED_GAME_STATS_STATUS_NOT_PENDING';
  end if;

  return query
  select
    p_game_id,
    'quarantined'::text,
    'schedule_not_realized'::text,
    1::smallint,
    0, 0, 0, 0, 0, 0,
    v_completed_at;
end;
$$;

revoke all on function public.finalize_non_realized_game_stats_v1(bigint)
  from public, anon, authenticated;
grant execute on function public.finalize_non_realized_game_stats_v1(bigint)
  to service_role;

create or replace function public.get_unupdated_games_for_season(
  p_season_id bigint
)
returns table(gameid bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select games.id
  from public.games
  join public."statsUpdateStatus" as status
    on status."gameId" = games.id
  where games."seasonId" = p_season_id
    and status.outcome = 'pending'
    and status.updated = false
    and status.contract_version = 1
    and games."startTime" < current_date
  order by games.date desc, games.id desc
$$;

revoke all on function public.get_unupdated_games_for_season(bigint)
  from public, anon, authenticated;
grant execute on function public.get_unupdated_games_for_season(bigint)
  to service_role;

reset lock_timeout;
reset statement_timeout;
;

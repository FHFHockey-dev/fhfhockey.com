-- What each opponent allowed per game to forwards and to defencemen (regular season only, current and last season).
-- The RSO interim FORGE bridge reads it for an opponent's positional tilt (its share of points and shots going to
-- F vs D against the league share); team strength itself comes from xG elsewhere. Small (about 128 rows) and
-- refreshed once a day (09:42 UTC) by the job that fhfh_internal.register_opponent_allowed_refresh_cron() schedules.
-- Applying this migration does not schedule the refresh; calling the register function is a separate approval.

create materialized view if not exists public.opponent_skater_allowed_by_position as
select
  s.season_id,
  s.opponent_team_abbrev as opponent,
  case when s.position_code = 'D' then 'D' else 'F' end as position_group,
  count(distinct s.game_id)::integer as games,
  count(*)::integer as player_games,
  sum(coalesce(s.goals, 0))::integer as goals,
  sum(coalesce(s.assists, 0))::integer as assists,
  sum(coalesce(s.points, 0))::integer as points,
  sum(coalesce(s.shots, 0))::integer as shots,
  max(s.date) as through_date
from public.wgo_skater_stats s
join public.games g on g.id = s.game_id and g.type = 2
where s.date >= (current_date - 500)
  and s.opponent_team_abbrev is not null
  and s.position_code in ('C', 'L', 'R', 'D')
group by s.season_id, s.opponent_team_abbrev, case when s.position_code = 'D' then 'D' else 'F' end
with data;

-- Required by `refresh materialized view concurrently`.
create unique index if not exists opponent_skater_allowed_by_position_key
  on public.opponent_skater_allowed_by_position (season_id, opponent, position_group);

revoke all on public.opponent_skater_allowed_by_position from anon, authenticated;
grant select on public.opponent_skater_allowed_by_position to service_role;

create or replace function fhfh_internal.register_opponent_allowed_refresh_cron()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_job_id bigint;
begin
  if pg_catalog.to_regclass('cron.job') is null then
    raise exception using
      errcode = '55000',
      message = 'OPPONENT_ALLOWED_PG_CRON_UNAVAILABLE';
  end if;

  for existing_job_id in
    select jobid from cron.job where jobname = 'opponent-skater-allowed-refresh'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  -- After the overnight WGO skater update; a concurrent refresh keeps readers unblocked.
  perform cron.schedule(
    'opponent-skater-allowed-refresh',
    '42 9 * * *',
    'refresh materialized view concurrently public.opponent_skater_allowed_by_position'
  );
end;
$$;

revoke all on function fhfh_internal.register_opponent_allowed_refresh_cron() from public;

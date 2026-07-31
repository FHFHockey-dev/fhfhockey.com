-- Keep the canonical Data API names while moving their materialized storage
-- outside every exposed PostgREST schema.
--
-- Rollback metadata:
--   1. restore cron jobs 248/272/374 to their prior unqualified commands;
--   2. replace the repair RPC's internal_stats refresh target with public;
--   3. drop the three public wrapper views;
--   4. move the three internal_stats materialized views back to public; and
--   5. drop internal_stats after confirming it is empty.

do $$
declare
  mismatched_relations text;
begin
  select string_agg(expected.relname, ', ' order by expected.relname)
    into mismatched_relations
  from (
    values
      ('goalie_stats_unified', '2c33f57213f3494dd01f8530611322da'),
      ('player_stats_unified', '1d45f09f8af9f7282ce7caf6a01a2d8d'),
      ('player_totals_unified', '4d5cc500e1755e965973458181123f6a')
  ) as expected(relname, definition_md5)
  left join pg_catalog.pg_class relation
    on relation.relnamespace = 'public'::pg_catalog.regnamespace
   and relation.relname = expected.relname
  where relation.oid is null
     or relation.relkind <> 'm'
     or pg_catalog.md5(pg_catalog.pg_get_viewdef(relation.oid, true))
        <> expected.definition_md5;

  if mismatched_relations is not null then
    raise exception
      'unified materialized-view contract mismatch: %',
      mismatched_relations;
  end if;

  if pg_catalog.to_regnamespace('internal_stats') is not null then
    raise exception 'internal_stats schema already exists';
  end if;
end
$$;

create schema internal_stats authorization postgres;

revoke all on schema internal_stats from public;
grant usage on schema internal_stats to anon, authenticated, service_role;

alter materialized view public.goalie_stats_unified
  set schema internal_stats;
alter materialized view public.player_stats_unified
  set schema internal_stats;
alter materialized view public.player_totals_unified
  set schema internal_stats;

revoke all on table
  internal_stats.goalie_stats_unified,
  internal_stats.player_stats_unified,
  internal_stats.player_totals_unified
from public, anon, authenticated, service_role;

grant select on table
  internal_stats.goalie_stats_unified,
  internal_stats.player_stats_unified,
  internal_stats.player_totals_unified
to anon, authenticated, service_role;

create view public.goalie_stats_unified
with (security_invoker = true)
as
select *
from internal_stats.goalie_stats_unified;

create view public.player_stats_unified
with (security_invoker = true)
as
select *
from internal_stats.player_stats_unified;

create view public.player_totals_unified
with (security_invoker = true)
as
select *
from internal_stats.player_totals_unified;

revoke all on table
  public.goalie_stats_unified,
  public.player_stats_unified,
  public.player_totals_unified
from public, anon, authenticated, service_role;

grant select on table
  public.goalie_stats_unified,
  public.player_stats_unified,
  public.player_totals_unified
to anon, authenticated, service_role;

comment on schema internal_stats is
  'Non-Data-API storage for canonical read-only aggregate materializations.';
comment on view public.goalie_stats_unified is
  'Security-invoker Data API wrapper over internal_stats.goalie_stats_unified.';
comment on view public.player_stats_unified is
  'Security-invoker Data API wrapper over internal_stats.player_stats_unified.';
comment on view public.player_totals_unified is
  'Security-invoker Data API wrapper over internal_stats.player_totals_unified.';

-- The separately gated WGO repair RPC is created by the immediately preceding
-- candidate migration. Preserve its complete body and ACL while retargeting
-- its one materialized refresh to the non-exposed relation.
do $$
declare
  function_oid oid;
  function_definition text;
  prior_refresh constant text :=
    'refresh materialized view public.player_stats_unified;';
  canonical_refresh constant text :=
    'refresh materialized view internal_stats.player_stats_unified;';
  occurrence_count integer;
begin
  function_oid := pg_catalog.to_regprocedure(
    'public.repair_wgo_player_season_identity(uuid,text,text,text)'
  );

  if function_oid is null then
    raise exception 'repair_wgo_player_season_identity RPC is unavailable';
  end if;

  function_definition := pg_catalog.pg_get_functiondef(function_oid);
  occurrence_count :=
    (
      pg_catalog.length(function_definition)
      - pg_catalog.length(
          pg_catalog.replace(function_definition, prior_refresh, '')
        )
    ) / pg_catalog.length(prior_refresh);

  if occurrence_count <> 1 then
    raise exception
      'expected exactly one public player_stats_unified refresh, found %',
      occurrence_count;
  end if;

  execute pg_catalog.replace(
    function_definition,
    prior_refresh,
    canonical_refresh
  );

  if pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(function_oid),
    canonical_refresh
  ) = 0 then
    raise exception 'repair RPC refresh retargeting failed';
  end if;
end
$$;

-- Production owns three active refresh jobs. The supported data-free baseline
-- contains no cron rows, so only that exact empty state may skip retargeting.
do $$
declare
  expected record;
  matching_jobs integer;
  resolved_job_id bigint;
  current_schedule text;
  current_command text;
  current_active boolean;
begin
  if pg_catalog.to_regclass('cron.job') is null then
    raise exception 'cron.job is unavailable';
  end if;

  if not exists (select 1 from cron.job) then
    raise notice
      'unified materialized-view cron retargeting skipped for data-free baseline replay';
    return;
  end if;

  for expected in
    select *
    from (
      values
        (
          'daily-refresh-player-unified-matview',
          '50 7 * * *',
          'REFRESH MATERIALIZED VIEW player_stats_unified;',
          'REFRESH MATERIALIZED VIEW internal_stats.player_stats_unified;'
        ),
        (
          'daily-refresh-goalie-unified-matview',
          '05 9 * * *',
          'REFRESH MATERIALIZED VIEW goalie_stats_unified;',
          'REFRESH MATERIALIZED VIEW internal_stats.goalie_stats_unified;'
        ),
        (
          'daily-refresh-player-totals-unified-matview',
          '41 10 * * *',
          'REFRESH MATERIALIZED VIEW player_totals_unified;',
          'REFRESH MATERIALIZED VIEW internal_stats.player_totals_unified;'
        )
    ) as target(job_name, expected_schedule, prior_command, canonical_command)
  loop
    select
      pg_catalog.count(*),
      pg_catalog.min(jobid),
      pg_catalog.min(schedule),
      pg_catalog.min(command),
      pg_catalog.bool_and(active)
    into
      matching_jobs,
      resolved_job_id,
      current_schedule,
      current_command,
      current_active
    from cron.job
    where jobname = expected.job_name;

    if matching_jobs <> 1
       or current_schedule <> expected.expected_schedule
       or current_command <> expected.prior_command
       or current_active is not true then
      raise exception
        'cron contract mismatch for %: count %, schedule %, command %, active %',
        expected.job_name,
        matching_jobs,
        current_schedule,
        current_command,
        current_active;
    end if;

    perform cron.alter_job(
      job_id := resolved_job_id,
      command := expected.canonical_command,
      active := true
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';

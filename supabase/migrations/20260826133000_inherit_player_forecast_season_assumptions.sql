alter table public.player_forecast_season_overrides
  add column if not exists inherited_from_id uuid
    references public.player_forecast_season_overrides(id);

create index if not exists player_forecast_season_overrides_inherited_from_idx
  on public.player_forecast_season_overrides (inherited_from_id)
  where inherited_from_id is not null;

drop trigger if exists player_forecast_season_override_enqueue
  on public.player_forecast_season_overrides;

create trigger player_forecast_season_override_enqueue
after insert on public.player_forecast_season_overrides
for each row
when (new.inherited_from_id is null)
execute function fhfh_internal.enqueue_player_forecast_season_change();

create or replace function public.inherit_player_forecast_season_assumptions(
  p_source_run_id uuid,
  p_target_run_id uuid,
  p_additional_source_run_ids uuid[] default '{}'::uuid[],
  p_include_stat_overrides boolean default false
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_run public.player_forecast_season_runs;
  target_run public.player_forecast_season_runs;
  inherited_count integer;
begin
  select * into source_run
  from public.player_forecast_season_runs
  where id = p_source_run_id and status = 'validated';

  select * into target_run
  from public.player_forecast_season_runs
  where id = p_target_run_id and status = 'draft';

  if source_run.id is null or target_run.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'PLAYER_FORECAST_SEASON_ASSUMPTION_RUN_NOT_FOUND';
  end if;

  if source_run.season_id <> target_run.season_id
    or exists (
      select 1
      from pg_catalog.unnest(coalesce(p_additional_source_run_ids, '{}'::uuid[]))
        as requested(run_id)
      left join public.player_forecast_season_runs candidate
        on candidate.id = requested.run_id
       and candidate.season_id = source_run.season_id
       and candidate.status in ('draft', 'validated')
      where candidate.id is null
    )
  then
    raise exception using
      errcode = '23514',
      message = 'PLAYER_FORECAST_SEASON_ASSUMPTION_RUN_MISMATCH';
  end if;

  with candidate_overrides as (
    select
      source_override.*,
      case
        when source_override.run_id = any(coalesce(p_additional_source_run_ids, '{}'::uuid[]))
          then 2
        else 1
      end as source_priority
    from public.player_forecast_season_overrides source_override
    where (
        source_override.run_id = source_run.id
        or source_override.run_id = any(coalesce(p_additional_source_run_ids, '{}'::uuid[]))
      )
      and (p_include_stat_overrides or source_override.field_path not like 'stats.%')
      and source_override.effective_at <= now()
      and (source_override.expires_at is null or source_override.expires_at > now())
      and not exists (
        select 1
        from public.player_forecast_season_overrides newer
        where newer.run_id = source_override.run_id
          and newer.supersedes_id = source_override.id
      )
  ), ranked_overrides as (
    select
      candidate_overrides.*,
      row_number() over (
        partition by
          scope_type,
          fhfh_player_id,
          team_id,
          field_path
        order by source_priority desc, effective_at desc, created_at desc, id desc
      ) as precedence
    from candidate_overrides
  )
  insert into public.player_forecast_season_overrides (
    season_id,
    run_id,
    scope_type,
    fhfh_player_id,
    team_id,
    field_path,
    base_value,
    override_value,
    reason,
    effective_at,
    expires_at,
    created_by,
    inherited_from_id
  )
  select
    target_run.season_id,
    target_run.id,
    selected.scope_type,
    selected.fhfh_player_id,
    selected.team_id,
    selected.field_path,
    selected.base_value,
    selected.override_value,
    selected.reason,
    selected.effective_at,
    selected.expires_at,
    selected.created_by,
    selected.id
  from ranked_overrides selected
  where selected.precedence = 1
    and not exists (
      select 1
      from public.player_forecast_season_overrides existing
      where existing.run_id = target_run.id
        and existing.scope_type = selected.scope_type
        and existing.fhfh_player_id is not distinct from selected.fhfh_player_id
        and existing.team_id is not distinct from selected.team_id
        and existing.field_path = selected.field_path
    );

  get diagnostics inherited_count = row_count;
  return inherited_count;
end;
$$;

create or replace function public.clone_player_forecast_season_run_with_assumptions(
  p_source_run_id uuid,
  p_idempotency_key text,
  p_include_stat_overrides boolean default false
)
returns public.player_forecast_season_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cloned public.player_forecast_season_runs;
begin
  select * into cloned
  from public.clone_player_forecast_season_run(p_source_run_id, p_idempotency_key);

  perform public.inherit_player_forecast_season_assumptions(
    p_source_run_id,
    cloned.id,
    '{}'::uuid[],
    p_include_stat_overrides
  );

  return cloned;
end;
$$;

create or replace function public.create_player_forecast_season_event_run_with_assumptions(
  p_source_run_id uuid,
  p_roster_snapshot_id uuid,
  p_schedule_snapshot_id uuid,
  p_cutoff_at timestamptz,
  p_source_high_watermark timestamptz,
  p_idempotency_key text,
  p_affected_player_ids bigint[],
  p_affected_team_ids smallint[],
  p_override_source_run_ids uuid[] default '{}'::uuid[]
)
returns public.player_forecast_season_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_run public.player_forecast_season_runs;
begin
  select * into event_run
  from public.create_player_forecast_season_event_run(
    p_source_run_id,
    p_roster_snapshot_id,
    p_schedule_snapshot_id,
    p_cutoff_at,
    p_source_high_watermark,
    p_idempotency_key,
    p_affected_player_ids,
    p_affected_team_ids
  );

  perform public.inherit_player_forecast_season_assumptions(
    p_source_run_id,
    event_run.id,
    p_override_source_run_ids,
    false
  );

  return event_run;
end;
$$;

revoke all on function public.inherit_player_forecast_season_assumptions(uuid, uuid, uuid[], boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.inherit_player_forecast_season_assumptions(uuid, uuid, uuid[], boolean)
  to service_role;

revoke all on function public.clone_player_forecast_season_run_with_assumptions(uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.clone_player_forecast_season_run_with_assumptions(uuid, text, boolean)
  to service_role;

revoke all on function public.create_player_forecast_season_event_run_with_assumptions(
  uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[], uuid[]
) from public, anon, authenticated, service_role;
grant execute on function public.create_player_forecast_season_event_run_with_assumptions(
  uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[], uuid[]
) to service_role;

comment on column public.player_forecast_season_overrides.inherited_from_id is
  'Audit lineage for a long-lived non-stat assumption copied into a later draft; inherited rows never enqueue another reforecast.';

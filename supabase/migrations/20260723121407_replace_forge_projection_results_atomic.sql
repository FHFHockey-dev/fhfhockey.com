create or replace function public.replace_forge_projection_results_atomic(
  p_as_of_date date,
  p_actual_date date,
  p_source_run_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  deleted_count integer := 0;
  inserted_count integer := 0;
begin
  if p_as_of_date is null or p_actual_date is null or p_source_run_id is null then
    raise exception using
      errcode = '22023',
      message = 'Projection-result scope is required.';
  end if;

  if p_source_run_id is distinct from (
    select run_id
    from public.forge_runs
    where as_of_date = p_as_of_date
      and status = 'succeeded'
    order by created_at desc
    limit 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Projection-result source must be the latest succeeded run.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Projection-result rows must be a JSON array.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      as_of_date date,
      actual_date date,
      game_id bigint,
      player_id bigint,
      player_type text,
      team_id smallint,
      opponent_team_id smallint,
      predicted_fp numeric,
      actual_fp numeric,
      error_abs numeric,
      error_sq numeric,
      accuracy numeric,
      source_run_id uuid,
      created_at timestamptz
    )
    where row_data.as_of_date is distinct from p_as_of_date
      or row_data.actual_date is distinct from p_actual_date
      or row_data.source_run_id is distinct from p_source_run_id
      or row_data.game_id is null
      or row_data.player_id is null
      or row_data.player_type not in ('skater', 'goalie')
      or row_data.predicted_fp is null
      or row_data.actual_fp is null
      or row_data.error_abs is null
      or row_data.error_sq is null
      or row_data.accuracy is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Projection-result rows do not match the requested canonical scope.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      as_of_date date,
      actual_date date,
      game_id bigint,
      player_id bigint,
      player_type text,
      source_run_id uuid
    )
    group by
      row_data.as_of_date,
      row_data.actual_date,
      row_data.player_id,
      row_data.game_id,
      row_data.player_type
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Projection-result rows contain duplicate canonical identities.';
  end if;

  delete from public.forge_projection_results
  where as_of_date = p_as_of_date
    and actual_date = p_actual_date;
  get diagnostics deleted_count = row_count;

  insert into public.forge_projection_results (
    as_of_date,
    actual_date,
    game_id,
    player_id,
    player_type,
    team_id,
    opponent_team_id,
    predicted_fp,
    actual_fp,
    error_abs,
    error_sq,
    accuracy,
    source_run_id,
    created_at
  )
  select
    row_data.as_of_date,
    row_data.actual_date,
    row_data.game_id,
    row_data.player_id,
    row_data.player_type,
    row_data.team_id,
    row_data.opponent_team_id,
    row_data.predicted_fp,
    row_data.actual_fp,
    row_data.error_abs,
    row_data.error_sq,
    row_data.accuracy,
    row_data.source_run_id,
    coalesce(row_data.created_at, now())
  from jsonb_to_recordset(p_rows) as row_data(
    as_of_date date,
    actual_date date,
    game_id bigint,
    player_id bigint,
    player_type text,
    team_id smallint,
    opponent_team_id smallint,
    predicted_fp numeric,
    actual_fp numeric,
    error_abs numeric,
    error_sq numeric,
    accuracy numeric,
    source_run_id uuid,
    created_at timestamptz
  );
  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'deleted', deleted_count,
    'inserted', inserted_count,
    'asOfDate', p_as_of_date,
    'actualDate', p_actual_date,
    'sourceRunId', p_source_run_id
  );
end;
$$;

revoke all on function public.replace_forge_projection_results_atomic(
  date,
  date,
  uuid,
  jsonb
) from public, anon, authenticated;
grant execute on function public.replace_forge_projection_results_atomic(
  date,
  date,
  uuid,
  jsonb
) to service_role;

comment on function public.replace_forge_projection_results_atomic(
  date,
  date,
  uuid,
  jsonb
) is
  'Atomically replaces one canonical FORGE projection-result date scope, including empty-result scopes that must remove stale rerun rows.';

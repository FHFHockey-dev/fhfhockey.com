-- Atomically repair the exact April 2023 WGO/player-trend season identity
-- cohort. The migration is deliberately inert until a service-role caller
-- stages the complete replacement (or retained inverse) trend payload and
-- supplies the matching value-free preflight receipts.

create table if not exists public.wgo_player_season_repair_trend_staging (
  operation_id uuid not null,
  direction text not null
    check (direction in ('forward', 'inverse')),
  player_id integer not null,
  season_id integer not null,
  game_date date not null,
  position_code text,
  metric_type text not null
    check (metric_type = 'skater'),
  metric_key text not null,
  metric_label text not null,
  raw_value numeric,
  average_value numeric,
  rolling_avg_3 numeric,
  rolling_avg_5 numeric,
  rolling_avg_10 numeric,
  variance_value numeric,
  std_dev_value numeric,
  sample_size integer not null,
  updated_at timestamp with time zone not null,
  staged_at timestamp with time zone not null default pg_catalog.now(),
  primary key (operation_id, player_id, game_date, metric_key)
);

alter table public.wgo_player_season_repair_trend_staging
  enable row level security;

revoke all on table public.wgo_player_season_repair_trend_staging
  from public, anon, authenticated, service_role;

grant select, insert, update, delete
  on table public.wgo_player_season_repair_trend_staging
  to service_role;

comment on table public.wgo_player_season_repair_trend_staging is
  'Service-only bounded forward/inverse payloads for the April 2023 WGO season repair.';

create or replace function public.stage_wgo_player_season_repair_trends(
  p_operation_id uuid,
  p_direction text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_target_season integer;
  v_input_count integer;
  v_input_identity_count integer;
  v_invalid_count integer;
  v_changed_count integer;
  v_total_staged integer;
begin
  if p_operation_id is null then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_OPERATION_INVALID';
  end if;

  if p_direction = 'forward' then
    v_target_season := 20222023;
  elsif p_direction = 'inverse' then
    v_target_season := 20242025;
  else
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_DIRECTION_INVALID';
  end if;

  if p_rows is null
    or pg_catalog.jsonb_typeof(p_rows) <> 'array'
    or pg_catalog.jsonb_array_length(p_rows) < 1
    or pg_catalog.jsonb_array_length(p_rows) > 500
  then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_STAGE_SIZE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'fhfh:wgo-player-season-stage:' || p_operation_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.wgo_player_season_repair_trend_staging as existing
    where existing.operation_id = p_operation_id
      and existing.direction <> p_direction
  ) then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_OPERATION_CONFLICT';
  end if;

  with input as materialized (
    select *
    from pg_catalog.jsonb_populate_recordset(
      null::public.player_trend_metrics,
      p_rows
    )
  )
  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct (player_id, game_date, metric_key))::integer,
    pg_catalog.count(*) filter (
      where player_id is null
        or season_id <> v_target_season
        or game_date not between date '2023-04-01' and date '2023-04-06'
        or metric_type <> 'skater'
        or metric_key is null
        or metric_label is null
        or sample_size is null
        or updated_at is null
    )::integer
  into v_input_count, v_input_identity_count, v_invalid_count
  from input;

  if v_input_count <> v_input_identity_count or v_invalid_count <> 0 then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_STAGE_ROWS_INVALID';
  end if;

  insert into public.wgo_player_season_repair_trend_staging as target (
    operation_id,
    direction,
    player_id,
    season_id,
    game_date,
    position_code,
    metric_type,
    metric_key,
    metric_label,
    raw_value,
    average_value,
    rolling_avg_3,
    rolling_avg_5,
    rolling_avg_10,
    variance_value,
    std_dev_value,
    sample_size,
    updated_at
  )
  select
    p_operation_id,
    p_direction,
    input.player_id,
    input.season_id,
    input.game_date,
    input.position_code,
    input.metric_type,
    input.metric_key,
    input.metric_label,
    input.raw_value,
    input.average_value,
    input.rolling_avg_3,
    input.rolling_avg_5,
    input.rolling_avg_10,
    input.variance_value,
    input.std_dev_value,
    input.sample_size,
    input.updated_at
  from pg_catalog.jsonb_populate_recordset(
    null::public.player_trend_metrics,
    p_rows
  ) as input
  on conflict (operation_id, player_id, game_date, metric_key) do update
  set
    direction = excluded.direction,
    season_id = excluded.season_id,
    position_code = excluded.position_code,
    metric_type = excluded.metric_type,
    metric_label = excluded.metric_label,
    raw_value = excluded.raw_value,
    average_value = excluded.average_value,
    rolling_avg_3 = excluded.rolling_avg_3,
    rolling_avg_5 = excluded.rolling_avg_5,
    rolling_avg_10 = excluded.rolling_avg_10,
    variance_value = excluded.variance_value,
    std_dev_value = excluded.std_dev_value,
    sample_size = excluded.sample_size,
    updated_at = excluded.updated_at,
    staged_at = pg_catalog.now()
  where (
    target.direction,
    target.season_id,
    target.position_code,
    target.metric_type,
    target.metric_label,
    target.raw_value,
    target.average_value,
    target.rolling_avg_3,
    target.rolling_avg_5,
    target.rolling_avg_10,
    target.variance_value,
    target.std_dev_value,
    target.sample_size,
    target.updated_at
  ) is distinct from (
    excluded.direction,
    excluded.season_id,
    excluded.position_code,
    excluded.metric_type,
    excluded.metric_label,
    excluded.raw_value,
    excluded.average_value,
    excluded.rolling_avg_3,
    excluded.rolling_avg_5,
    excluded.rolling_avg_10,
    excluded.variance_value,
    excluded.std_dev_value,
    excluded.sample_size,
    excluded.updated_at
  );

  get diagnostics v_changed_count = row_count;

  select pg_catalog.count(*)::integer
  into v_total_staged
  from public.wgo_player_season_repair_trend_staging
  where operation_id = p_operation_id;

  return pg_catalog.jsonb_build_object(
    'operationId', p_operation_id,
    'direction', p_direction,
    'chunkRows', v_input_count,
    'chunkRowsChanged', v_changed_count,
    'totalStagedRows', v_total_staged
  );
end;
$function$;

revoke all on function public.stage_wgo_player_season_repair_trends(
  uuid,
  text,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.stage_wgo_player_season_repair_trends(
  uuid,
  text,
  jsonb
) to service_role;

comment on function public.stage_wgo_player_season_repair_trends(
  uuid,
  text,
  jsonb
) is
  'Stages at most 500 deterministic trend rows for one April 2023 repair operation.';

create or replace function public.repair_wgo_player_season_identity(
  p_operation_id uuid,
  p_direction text,
  p_expected_source_manifest_md5 text,
  p_expected_trend_identity_md5 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_from_season integer;
  v_to_season integer;
  v_source_count integer;
  v_source_distinct_count integer;
  v_source_from_count integer;
  v_source_to_count integer;
  v_source_manifest_md5 text;
  v_current_trend_count integer;
  v_current_trend_player_dates integer;
  v_current_trend_from_count integer;
  v_current_trend_to_count integer;
  v_current_trend_identity_md5 text;
  v_input_trend_count integer;
  v_input_trend_player_dates integer;
  v_input_trend_identities integer;
  v_input_metric_keys integer;
  v_input_source_matches integer;
  v_input_invalid_count integer;
  v_input_trend_identity_md5 text;
  v_source_changed integer := 0;
  v_trend_changed integer := 0;
begin
  if p_operation_id is null then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_OPERATION_INVALID';
  elsif p_direction = 'forward' then
    v_from_season := 20242025;
    v_to_season := 20222023;
  elsif p_direction = 'inverse' then
    v_from_season := 20222023;
    v_to_season := 20242025;
  else
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_DIRECTION_INVALID';
  end if;

  if p_expected_source_manifest_md5 is null
    or p_expected_source_manifest_md5 !~ '^[0-9a-f]{32}$'
    or p_expected_trend_identity_md5 is null
    or p_expected_trend_identity_md5 !~ '^[0-9a-f]{32}$'
  then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_RECEIPT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:wgo-player-season-identity:2023-04', 0)
  );

  lock table public.wgo_skater_stats in share row exclusive mode;
  lock table public.player_trend_metrics in share row exclusive mode;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct (w.player_id, w.date))::integer,
    pg_catalog.count(*) filter (where w.season_id = v_from_season)::integer,
    pg_catalog.count(*) filter (where w.season_id = v_to_season)::integer,
    pg_catalog.md5(
      pg_catalog.string_agg(
        w.id::text || ':' || w.player_id::text || ':' || w.date::text,
        ',' order by w.id
      )
    )
  into
    v_source_count,
    v_source_distinct_count,
    v_source_from_count,
    v_source_to_count,
    v_source_manifest_md5
  from public.wgo_skater_stats as w
  where w.date between date '2023-04-01' and date '2023-04-06'
    and w.season_id in (20222023, 20242025);

  if v_source_count <> 1905
    or v_source_distinct_count <> 1905
    or v_source_manifest_md5 <> p_expected_source_manifest_md5
    or not (
      (v_source_from_count = 1905 and v_source_to_count = 0)
      or (v_source_from_count = 0 and v_source_to_count = 1905)
    )
  then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_SOURCE_MISMATCH';
  end if;

  with input as materialized (
    select staged.*
    from public.wgo_player_season_repair_trend_staging as staged
    where staged.operation_id = p_operation_id
      and staged.direction = p_direction
  )
  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct (player_id, game_date))::integer,
    pg_catalog.count(distinct (player_id, game_date, metric_key))::integer,
    pg_catalog.count(distinct metric_key)::integer,
    pg_catalog.count(*) filter (
      where exists (
        select 1
        from public.wgo_skater_stats as source
        where source.player_id = input.player_id
          and source.date = input.game_date
          and source.season_id in (20222023, 20242025)
      )
    )::integer,
    pg_catalog.count(*) filter (
      where input.player_id is null
        or input.game_date is null
        or input.metric_key is null
        or input.metric_label is null
        or input.metric_type <> 'skater'
        or input.season_id <> v_to_season
        or input.game_date not between date '2023-04-01' and date '2023-04-06'
        or input.sample_size is null
        or input.updated_at is null
    )::integer,
    pg_catalog.md5(
      pg_catalog.string_agg(
        player_id::text || ':' || game_date::text || ':' || metric_key,
        ',' order by player_id, game_date, metric_key
      )
    )
  into
    v_input_trend_count,
    v_input_trend_player_dates,
    v_input_trend_identities,
    v_input_metric_keys,
    v_input_source_matches,
    v_input_invalid_count,
    v_input_trend_identity_md5
  from input;

  if v_input_trend_count <> 49410
    or v_input_trend_player_dates <> 1830
    or v_input_trend_identities <> 49410
    or v_input_metric_keys <> 27
    or v_input_source_matches <> 49410
    or v_input_invalid_count <> 0
    or v_input_trend_identity_md5 <> p_expected_trend_identity_md5
  then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_TRENDS_MISMATCH';
  end if;

  with replacement as materialized (
    select staged.*
    from public.wgo_player_season_repair_trend_staging as staged
    where staged.operation_id = p_operation_id
      and staged.direction = p_direction
  )
  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct (t.player_id, t.game_date))::integer,
    pg_catalog.count(*) filter (where t.season_id = v_from_season)::integer,
    pg_catalog.count(*) filter (where t.season_id = v_to_season)::integer,
    pg_catalog.md5(
      pg_catalog.string_agg(
        t.player_id::text || ':' || t.game_date::text || ':' || t.metric_key,
        ',' order by t.player_id, t.game_date, t.metric_key
      )
    )
  into
    v_current_trend_count,
    v_current_trend_player_dates,
    v_current_trend_from_count,
    v_current_trend_to_count,
    v_current_trend_identity_md5
  from public.player_trend_metrics as t
  join replacement
    on replacement.player_id = t.player_id
   and replacement.game_date = t.game_date
   and replacement.metric_key = t.metric_key
  where t.season_id in (20222023, 20242025);

  if v_current_trend_count <> 49410
    or v_current_trend_player_dates <> 1830
    or v_current_trend_identity_md5 <> p_expected_trend_identity_md5
    or not (
      (v_current_trend_from_count = 49410 and v_current_trend_to_count = 0)
      or (v_current_trend_from_count = 0 and v_current_trend_to_count = 49410)
    )
  then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_CURRENT_TRENDS_MISMATCH';
  end if;

  if v_source_from_count = 1905 then
    update public.wgo_skater_stats as w
    set season_id = v_to_season
    where w.season_id = v_from_season
      and w.date between date '2023-04-01' and date '2023-04-06';

    get diagnostics v_source_changed = row_count;

    if v_source_changed <> 1905 then
      raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_SOURCE_UPDATE_MISMATCH';
    end if;

    refresh materialized view public.player_stats_unified;
  end if;

  insert into public.player_trend_metrics as target (
    player_id,
    season_id,
    game_date,
    position_code,
    metric_type,
    metric_key,
    metric_label,
    raw_value,
    average_value,
    rolling_avg_3,
    rolling_avg_5,
    rolling_avg_10,
    variance_value,
    std_dev_value,
    sample_size,
    updated_at
  )
  select
    player_id,
    season_id,
    game_date,
    position_code,
    metric_type,
    metric_key,
    metric_label,
    raw_value,
    average_value,
    rolling_avg_3,
    rolling_avg_5,
    rolling_avg_10,
    variance_value,
    std_dev_value,
    sample_size,
    updated_at
  from public.wgo_player_season_repair_trend_staging
  where operation_id = p_operation_id
    and direction = p_direction
  on conflict (player_id, game_date, metric_key) do update
  set
    season_id = excluded.season_id,
    position_code = excluded.position_code,
    metric_type = excluded.metric_type,
    metric_label = excluded.metric_label,
    raw_value = excluded.raw_value,
    average_value = excluded.average_value,
    rolling_avg_3 = excluded.rolling_avg_3,
    rolling_avg_5 = excluded.rolling_avg_5,
    rolling_avg_10 = excluded.rolling_avg_10,
    variance_value = excluded.variance_value,
    std_dev_value = excluded.std_dev_value,
    sample_size = excluded.sample_size,
    updated_at = excluded.updated_at
  where (
    target.season_id,
    target.position_code,
    target.metric_type,
    target.metric_label,
    target.raw_value,
    target.average_value,
    target.rolling_avg_3,
    target.rolling_avg_5,
    target.rolling_avg_10,
    target.variance_value,
    target.std_dev_value,
    target.sample_size,
    target.updated_at
  ) is distinct from (
    excluded.season_id,
    excluded.position_code,
    excluded.metric_type,
    excluded.metric_label,
    excluded.raw_value,
    excluded.average_value,
    excluded.rolling_avg_3,
    excluded.rolling_avg_5,
    excluded.rolling_avg_10,
    excluded.variance_value,
    excluded.std_dev_value,
    excluded.sample_size,
    excluded.updated_at
  );

  get diagnostics v_trend_changed = row_count;

  if exists (
    select 1
    from public.wgo_skater_stats as w
    where w.date between date '2023-04-01' and date '2023-04-06'
      and w.season_id in (20222023, 20242025)
      and w.season_id <> v_to_season
  ) or exists (
    with replacement as materialized (
      select staged.*
      from public.wgo_player_season_repair_trend_staging as staged
      where staged.operation_id = p_operation_id
        and staged.direction = p_direction
    )
    select 1
    from replacement
    join public.player_trend_metrics as t
      on t.player_id = replacement.player_id
     and t.game_date = replacement.game_date
     and t.metric_key = replacement.metric_key
    where t.season_id <> v_to_season
  ) then
    raise exception using message = 'WGO_PLAYER_SEASON_REPAIR_POSTCONDITION_MISMATCH';
  end if;

  return pg_catalog.jsonb_build_object(
    'operationId', p_operation_id,
    'direction', p_direction,
    'fromSeason', v_from_season,
    'toSeason', v_to_season,
    'sourceRows', 1905,
    'sourceRowsChanged', v_source_changed,
    'sourceManifestMd5', v_source_manifest_md5,
    'trendRows', 49410,
    'trendRowsChanged', v_trend_changed,
    'trendPlayerDates', 1830,
    'trendIdentityMd5', v_input_trend_identity_md5
  );
end;
$function$;

revoke all on function public.repair_wgo_player_season_identity(
  uuid,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.repair_wgo_player_season_identity(
  uuid,
  text,
  text,
  text
) to service_role;

comment on function public.repair_wgo_player_season_identity(
  uuid,
  text,
  text,
  text
) is
  'Atomically repairs or reverses the exact April 2023 WGO/trend season-identity cohort after complete value-free manifest validation.';

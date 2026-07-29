begin;

set lock_timeout = '5s';
set statement_timeout = '30s';

create unique index if not exists game_prediction_model_versions_one_production_per_model
  on public.game_prediction_model_versions (model_name)
  where status = 'production';

create or replace function public.promote_game_prediction_model_version_atomic(
  p_model_name text,
  p_model_version text,
  p_feature_set_version text,
  p_promoted_at timestamptz,
  p_metadata jsonb
)
returns table (
  promoted boolean,
  retired_production_rows integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_candidate_rows integer := 0;
  v_retired_rows integer := 0;
begin
  if nullif(btrim(p_model_name), '') is null
    or nullif(btrim(p_model_version), '') is null
    or nullif(btrim(p_feature_set_version), '') is null
    or p_promoted_at is null
  then
    raise exception using
      errcode = '22023',
      message = 'GAME_PREDICTION_PROMOTION_INVALID_ARGUMENT';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('fhfh:game-prediction-promotion:' || p_model_name, 0)
  );

  perform 1
  from public.game_prediction_model_versions
  where model_name = p_model_name
  for update;

  update public.game_prediction_model_versions
  set
    status = 'retired',
    retired_at = p_promoted_at,
    updated_at = p_promoted_at
  where model_name = p_model_name
    and status = 'production'
    and (
      model_version <> p_model_version
      or feature_set_version <> p_feature_set_version
    );
  get diagnostics v_retired_rows = row_count;

  update public.game_prediction_model_versions
  set
    status = 'production',
    promoted_at = p_promoted_at,
    retired_at = null,
    metadata = coalesce(p_metadata, '{}'::jsonb),
    updated_at = p_promoted_at
  where model_name = p_model_name
    and model_version = p_model_version
    and feature_set_version = p_feature_set_version
    and status = 'candidate';
  get diagnostics v_candidate_rows = row_count;

  if v_candidate_rows <> 1 then
    raise exception using
      errcode = 'P0002',
      message = 'GAME_PREDICTION_PROMOTION_CANDIDATE_NOT_FOUND';
  end if;

  return query
  select true, v_retired_rows;
end;
$$;

revoke all on function public.promote_game_prediction_model_version_atomic(
  text,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;

grant execute on function public.promote_game_prediction_model_version_atomic(
  text,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;

reset lock_timeout;
reset statement_timeout;

commit;

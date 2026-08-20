do $$
declare
  function_definition text;
  old_checksum constant text := 'add4a5c9e89a922d70a0946d5d1b25ed5de8e0388d4def15dcc08de6231fc7da';
  approved_checksum constant text := 'e0b10f508d4f3e96b93cb3b203930e05d15c1f75dcc969030e4a04f20de18150';
begin
  select pg_catalog.pg_get_functiondef(
    'public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)'::regprocedure
  ) into function_definition;

  if pg_catalog.strpos(function_definition, old_checksum) > 0 then
    execute pg_catalog.replace(function_definition, old_checksum, approved_checksum);
  elsif pg_catalog.strpos(function_definition, approved_checksum) = 0 then
    raise exception 'PLAYER_FORECAST_V4_CONTRACT_CHECKSUM_BINDING_NOT_FOUND';
  end if;
end;
$$;

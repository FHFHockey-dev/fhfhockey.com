do $$
declare
  function_definition text;
  old_checksum constant text := '009406f21b35e6e7eb6a8a7be54fcc26adcfcd9f901bdb67567d829304b38e35';
  approved_checksum constant text := '9b91e7d1de540664f404cc518222e61fcb837127a25916ee735f37d7a185a435';
begin
  select pg_catalog.pg_get_functiondef(
    'public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)'::regprocedure
  ) into function_definition;

  if pg_catalog.strpos(function_definition, old_checksum) > 0 then
    execute pg_catalog.replace(function_definition, old_checksum, approved_checksum);
  elsif pg_catalog.strpos(function_definition, approved_checksum) = 0 then
    raise exception 'PLAYER_FORECAST_V5_CONTRACT_CHECKSUM_BINDING_NOT_FOUND';
  end if;
end;
$$;

do $migration$
declare
  function_definition text;
  previous_checksum constant text :=
    '2584a196f799906042c019d4aa7f607afa829b1f90a611aec418a9375ac944b4';
  amended_checksum constant text :=
    '29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93';
begin
  select pg_catalog.pg_get_functiondef(
    'public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)'::regprocedure
  )
  into function_definition;

  if pg_catalog.strpos(function_definition, amended_checksum) > 0 then
    return;
  end if;
  if pg_catalog.strpos(function_definition, previous_checksum) = 0 then
    raise exception using
      errcode = '55000',
      message = 'PLAYER_FORECAST_SEASON_SETTLED_LABEL_CONTRACT_SOURCE_MISMATCH';
  end if;

  execute pg_catalog.replace(
    function_definition,
    previous_checksum,
    amended_checksum
  );
end;
$migration$;

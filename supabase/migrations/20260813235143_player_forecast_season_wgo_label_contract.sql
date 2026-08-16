do $migration$
declare
  function_definition text;
  previous_checksum constant text :=
    '0d6abe81b48d9eb236d8281725beb62f00b96a773b4d80406fd1148a929d2350';
  interim_checksum constant text :=
    '0ceb3a481870e38e3e4a724485aeb0958918576f3e0680c5f620d77f37651be0';
  amended_checksum constant text :=
    '2584a196f799906042c019d4aa7f607afa829b1f90a611aec418a9375ac944b4';
  future_checksum constant text :=
    '29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93';
  source_checksum text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)'::regprocedure
  )
  into function_definition;

  if pg_catalog.strpos(function_definition, amended_checksum) > 0
    or pg_catalog.strpos(function_definition, future_checksum) > 0 then
    return;
  end if;
  if pg_catalog.strpos(function_definition, previous_checksum) > 0 then
    source_checksum := previous_checksum;
  elsif pg_catalog.strpos(function_definition, interim_checksum) > 0 then
    source_checksum := interim_checksum;
  else
    raise exception using
      errcode = '55000',
      message = 'PLAYER_FORECAST_SEASON_CONTRACT_CHECKSUM_SOURCE_MISMATCH';
  end if;

  execute pg_catalog.replace(
    function_definition,
    source_checksum,
    amended_checksum
  );
end;
$migration$;

do $repair$
declare
  function_oid regprocedure :=
    'public.upsert_yahoo_players_atomic(jsonb[])'::regprocedure;
  definition text;
begin
  definition := pg_get_functiondef(function_oid);

  if position(E'  captured_at timestamptz;' in definition) = 0
    or position(E'    captured_at := snapshot_date::timestamp at time zone ''UTC'';' in definition) = 0
    or position(E'        captured_at,\n        nullif(p->>''average_draft_pick''' in definition) = 0
  then
    raise exception using
      errcode = '55000',
      message = 'Yahoo atomic writer no longer matches the expected captured_at definition.';
  end if;

  definition := replace(
    definition,
    E'  captured_at timestamptz;',
    E'  snapshot_captured_at timestamptz;'
  );
  definition := replace(
    definition,
    E'    captured_at := snapshot_date::timestamp at time zone ''UTC'';',
    E'    snapshot_captured_at := snapshot_date::timestamp at time zone ''UTC'';'
  );
  definition := replace(
    definition,
    E'        captured_at,\n        nullif(p->>''average_draft_pick''',
    E'        snapshot_captured_at,\n        nullif(p->>''average_draft_pick'''
  );

  execute definition;
end
$repair$;

comment on function public.upsert_yahoo_players_atomic(jsonb[]) is
  'Atomic fail-closed Yahoo latest, daily ownership, and daily draft snapshot writer.';

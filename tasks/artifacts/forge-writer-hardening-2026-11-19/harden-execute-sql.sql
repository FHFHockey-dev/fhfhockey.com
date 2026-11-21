-- Writer hardening: take arbitrary SQL away from the FORGE writer's credential (service_role) and give the CSV admin
-- route (/api/v1/db/upsert-csv) the one statement it needs instead. Apply once as postgres. One transaction.
--
-- Before: service_role may EXECUTE public.execute_sql(text), a SECURITY DEFINER owned by postgres (CREATEROLE,
-- BYPASSRLS) whose body is EXECUTE sql_statement. Any holder of the service role key can therefore run any SQL as
-- postgres: grant itself forge_witness_owner, read the witness credential, disable the publication verdict trigger, or
-- replace the publisher gate (writer-reach-audit.sql, probes F1-F4).
-- After: only postgres (and superusers) may EXECUTE execute_sql. service_role may EXECUTE csv_create_table_v1, which can
-- only run CREATE TABLE in public for a validated name, validated column names and a fixed type list, plus a fixed
-- FK to players, then grant service_role exactly SELECT and INSERT on that new table. It never alters, drops or
-- grants on an existing relation.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';

do $$ begin
  if to_regprocedure('public.execute_sql(text)') is null then raise exception 'execute_sql_missing'; end if;
  if to_regprocedure('public.csv_create_table_v1(text, jsonb)') is not null then raise exception 'already_hardened'; end if;
  if to_regclass('public.players') is null then raise exception 'players_missing'; end if;
end $$;

create function public.csv_create_table_v1(p_table text, p_columns jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  col jsonb; nm text; ty text; defs text[] := '{}'; seen text[] := array['upload_batch_id', 'player_id'];
begin
  if p_table is null or p_table !~ '^[a-zA-Z_][a-zA-Z0-9_]{2,62}$' or lower(p_table) like 'pg\_%' then
    raise exception 'csv_table_name_invalid' using errcode = '22023';
  end if;
  -- An existing relation of that name is used as is: no DDL, no grant (the route then inserts with its own rights).
  if pg_catalog.to_regclass(pg_catalog.format('public.%I', p_table)) is not null then
    return pg_catalog.jsonb_build_object('created', false, 'table', p_table);
  end if;
  -- Never create a public name that shadows a relation in another schema.
  if exists (select from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
             where c.relname = p_table and n.nspname <> 'public') then
    raise exception 'csv_table_name_shadows' using errcode = '22023';
  end if;
  if p_columns is null or pg_catalog.jsonb_typeof(p_columns) <> 'array'
     or pg_catalog.jsonb_array_length(p_columns) not between 1 and 200 then
    raise exception 'csv_columns_invalid' using errcode = '22023';
  end if;
  for col in select value from pg_catalog.jsonb_array_elements(p_columns) loop
    nm := col->>'name';
    ty := pg_catalog.upper(col->>'type');
    if pg_catalog.jsonb_typeof(col) <> 'object' or nm is null or nm !~ '^[a-zA-Z_][a-zA-Z0-9_]{0,62}$'
       or nm = any (seen) then
      raise exception 'csv_column_name_invalid' using errcode = '22023', detail = coalesce(nm, '');
    end if;
    -- The type is never interpolated from input: each accepted name maps to a fixed literal.
    ty := case ty when 'TEXT' then 'text' when 'INTEGER' then 'integer' when 'NUMERIC' then 'numeric'
      when 'BOOLEAN' then 'boolean' when 'DATE' then 'date' when 'TIMESTAMP WITH TIME ZONE' then 'timestamp with time zone'
      when 'UUID' then 'uuid' when 'BIGINT' then 'bigint' end;
    if ty is null then raise exception 'csv_column_type_invalid' using errcode = '22023', detail = nm; end if;
    seen := seen || nm;
    defs := defs || pg_catalog.format('%I %s', nm, ty);
  end loop;
  execute pg_catalog.format('create table public.%I (upload_batch_id uuid primary key default pg_catalog.gen_random_uuid(), '
    'player_id bigint, %s, constraint fk_player foreign key (player_id) references public.players(id))',
    p_table, pg_catalog.array_to_string(defs, ', '));
  execute pg_catalog.format('grant select, insert on table public.%I to service_role', p_table);
  return pg_catalog.jsonb_build_object('created', true, 'table', p_table);
end $$;

revoke all on function public.csv_create_table_v1(text, jsonb) from public, anon, authenticated;
grant execute on function public.csv_create_table_v1(text, jsonb) to service_role;

revoke all on function public.execute_sql(text) from public, anon, authenticated, service_role;

do $$ begin
  if has_function_privilege('service_role', 'public.execute_sql(text)', 'EXECUTE') then raise exception 'execute_sql_still_reachable'; end if;
  if not has_function_privilege('service_role', 'public.csv_create_table_v1(text, jsonb)', 'EXECUTE') then raise exception 'csv_create_unreachable'; end if;
end $$;
commit;
notify pgrst, 'reload schema';
select json_build_object(
  'serviceRoleExecuteSql', has_function_privilege('service_role', 'public.execute_sql(text)', 'EXECUTE'),
  'serviceRoleCsvCreate', has_function_privilege('service_role', 'public.csv_create_table_v1(text, jsonb)', 'EXECUTE'),
  'anonCsvCreate', has_function_privilege('anon', 'public.csv_create_table_v1(text, jsonb)', 'EXECUTE'));
